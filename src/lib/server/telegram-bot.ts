import { reduce } from "@/lib/bot/fsm";
import type { BotEvent, BotReply, Effect } from "@/lib/bot/effects";
import type { InlineBtn } from "@/lib/types";
import type { Actor } from "@/lib/bot/world";
import { getSql } from "@/lib/db";
import { usdToMinor, type Currency } from "@/lib/currency";
import { splitAmounts } from "@/lib/format";
import { nid } from "@/lib/utils";
import { bankByCode } from "@/lib/banks";
import { institutionLabel, validatePayoutHandle, type PayoutDraft } from "@/lib/payouts";
import { quoteConversion } from "@/lib/fx";
import { getRateBook } from "@/lib/server/fx-live";
import { issueCreatorCode, ownedCommunity } from "@/lib/bot/world";
import {
  applyTelegramKick,
  checkoutEmail,
  fulfillPayment,
  startPaystackCheckout,
} from "./access";
import { runMoneyLoop } from "./loop";
import { ensureAccount, loadWorld, saveSession } from "./repo";
import {
  answerCallbackQuery,
  sendMessage,
  type TelegramUpdate,
} from "./telegram-api";

async function platformToken() {
  const env = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (env) return env;
  const sql = await getSql();
  const rows = await sql<{ telegram_bot_token: string | null }>`
    select telegram_bot_token from platform_bot where id = 'singleton' limit 1
  `;
  return rows[0]?.telegram_bot_token?.trim() || null;
}

async function applyEffect(actor: Actor, effect: Effect): Promise<BotReply[]> {
  const sql = await getSql();
  switch (effect.type) {
    case "checkout": {
      const plans = await sql<{ id: string; creator_id: string; name: string; price_usd: number }>`
        select id, creator_id, name, price_usd from plans where id = ${effect.planId} and is_active = true
      `;
      const plan = plans[0];
      if (!plan) return [{ text: "That plan is gone." }];
      const creators = await sql<{
        id: string;
        name: string;
        fee_bps: number;
        payout_connected: boolean;
        paystack_subaccount: string | null;
        payout_currency: string | null;
        fx_fee_bps: number | null;
      }>`select id, name, fee_bps, payout_connected, paystack_subaccount, payout_currency, fx_fee_bps from creators where id = ${plan.creator_id}`;
      const creator = creators[0];
      if (!creator?.payout_connected) return [{ text: "Checkout is closed until a payout method is attached." }];
      const paymentId = nid("pay");
      const reference = `PSK_${paymentId.slice(4, 14)}`;
      const split = splitAmounts(plan.price_usd, creator.fee_bps);
      const rates = await getRateBook();
      const quote = quoteConversion({
        listUsdCents: plan.price_usd,
        payCurrency: effect.currency,
        payoutCurrency: (creator.payout_currency as Currency) || "USD",
        feeBps: creator.fx_fee_bps ?? 150,
        platformFeeBps: creator.fee_bps,
        book: rates.book,
        source: rates.source,
        asOf: rates.asOf,
      });
      await sql`
        insert into payments (
          id, user_id, creator_id, plan_id, amount, currency, charged_minor, provider, provider_ref,
          status, platform_fee, creator_payout, settlement_status,
          payout_currency, fx_rate, fx_fee_bps, fx_fee_minor, payout_minor, rate_source
        ) values (
          ${paymentId}, ${actor.id}, ${creator.id}, ${plan.id}, ${plan.price_usd}, ${effect.currency},
          ${quote.payMinor}, ${effect.provider}, ${reference},
          'pending', ${split.platformFee}, ${split.creatorPayout}, 'pending',
          ${quote.payoutCurrency}, ${quote.customerRate}, ${quote.feeBps}, ${quote.feeMinor},
          ${quote.creatorPayoutMinor}, ${quote.source}
        )
      `;
      const started = await startPaystackCheckout({
        paymentId,
        email: checkoutEmail(actor.id),
        amountMinor: quote.payMinor,
        currency: effect.currency,
        reference,
        provider: effect.provider,
        subaccount: creator.paystack_subaccount,
        metadata: {
          planId: plan.id,
          creatorId: creator.id,
          userId: actor.id,
          payoutCurrency: quote.payoutCurrency,
          fxFeeBps: quote.feeBps,
        },
      });
      const buttons: InlineBtn[][] = [
        [{ label: "Pay on Paystack", payload: `openpay:${started.reference}`, url: started.authorizationUrl, tone: "primary" }],
      ];
      if (started.demo) {
        buttons.push([{ label: "Simulate charge.success", payload: `simcharge:${started.reference}`, tone: "primary" }]);
      }
      return [
        {
          text: `Checkout is open for ${creator.name} · ${plan.name} via ${effect.provider}.\n${started.authorizationUrl}\n\nThe join link is minted only after charge.success.`,
          buttons,
          kind: "invoice",
        },
      ];
    }
    case "checkout_pro": {
      const paymentId = nid("pay");
      const reference = `PRO_${paymentId.slice(4, 14)}`;
      await sql`
        insert into payments (
          id, user_id, creator_id, plan_id, amount, currency, charged_minor, provider, provider_ref,
          status, platform_fee, creator_payout, settlement_status
        ) values (
          ${paymentId}, ${actor.id}, 'platform', 'pro', 1500, ${effect.currency},
          ${usdToMinor(1500, effect.currency)}, ${effect.provider}, ${reference},
          'pending', 1500, 0, 'pending'
        )
      `;
      const started = await startPaystackCheckout({
        paymentId,
        email: checkoutEmail(actor.id),
        amountMinor: usdToMinor(1500, effect.currency),
        currency: effect.currency,
        reference,
        provider: effect.provider,
        metadata: { kind: "pro", userId: actor.id },
      });
      const buttons: InlineBtn[][] = [
        [{ label: "Pay Pro on Paystack", payload: `openpay:${started.reference}`, url: started.authorizationUrl, tone: "primary" }],
      ];
      if (started.demo) {
        buttons.push([{ label: "Simulate charge.success", payload: `simcharge:${started.reference}`, tone: "primary" }]);
      }
      return [
        {
          text: `Pro checkout is open.\n${started.authorizationUrl}\n\nThe creator ID is issued only after charge.success.`,
          buttons,
        },
      ];
    }
    case "fulfill": {
      const payments = await sql<{
        id: string;
        user_id: string;
        creator_id: string;
        subscription_id: string | null;
        plan_id: string;
        amount: number;
        currency: string;
        provider: string;
        provider_ref: string | null;
        status: string;
      }>`select * from payments where provider_ref = ${effect.reference} limit 1`;
      const payment = payments[0];
      if (!payment) return [{ text: "No checkout with that reference." }];
      if (payment.status === "success") return [{ text: "Already paid. Check /my." }];
      const done = await fulfillPayment(payment, actor.username);
      if (done.kind === "pro") {
        return [
          {
            text: "Pro is live. Send the Telegram group name you want bound to your ID.",
            buttons: [[{ label: "Cancel", payload: "cancel" }]],
          },
        ];
      }
      return [
        {
          text: `Payment received.\n\n${done.creator.name} · ${done.plan.name}\n\nYou're in:\n${done.inviteUrl}`,
          kind: "receipt",
        },
      ];
    }
    case "kick": {
      const world = await loadWorld(actor);
      const community = ownedCommunity(world);
      if (!community) return [{ text: "Create a community first." }];
      const handle = effect.username.replace(/^@/, "").toLowerCase();
      const member = world.members.find(
        (m) => m.communityId === community.id && m.username.toLowerCase() === handle,
      );
      if (!member) return [{ text: `No member @${handle}.` }];
      await sql`
        update telegram_members set
          status = 'removed', removed_at = now(), remove_reason = ${effect.reason ?? "removed_by_admin"},
          invite_url = '', invite_token = null
        where id = ${member.id}
      `;
      await sql`
        update subscriptions set status = 'cancelled', auto_renew = false
        where creator_id = ${community.id} and user_id = ${member.userId}
      `;
      await applyTelegramKick({
        creatorId: community.id,
        chatId: community.telegramChatId,
        telegramUserId: member.telegramUserId,
        inviteUrl: member.inviteUrl,
      });
      return [{ text: `Kicked @${member.username}. Invite revoked.` }];
    }
    case "run_loop": {
      const world = await loadWorld(actor);
      const community = ownedCommunity(world);
      const r = await runMoneyLoop(community?.id);
      return [
        {
          text: `Money loop${community ? ` on ${community.name}` : ""}\n${r.renewed} renewed\n${r.retried} retried\n${r.warned} warned\n${r.expired} expired\n${r.kicked} kicked\n${r.reminded} reminded\n\nCron runs this. This was a manual override.`,
        },
      ];
    }
    case "create_community": {
      const draft: PayoutDraft = effect.payout ?? {
        rail: "bank",
        country: "NG",
        currency: "NGN",
        institution: bankByCode(effect.bankCode)?.name ?? "Bank",
        handle: effect.accountNumber,
      };
      const invalid = validatePayoutHandle(draft);
      if (invalid) return [{ text: invalid }];
      const existing = await sql<{ id: string }>`select id from creators where user_id = ${actor.id} limit 1`;
      if (existing[0]) return [{ text: "You already have a creator ID. /studio" }];
      const taken = await sql<{ code: string }>`select code from creators`;
      const code = issueCreatorCode(effect.name, new Set(taken.map((t) => t.code.toLowerCase())));
      const slug =
        effect.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 32) || "my-room";
      const id = nid("cre");
      const fee = effect.platformPlan === "pro" ? 500 : 800;
      const inst = institutionLabel(draft);
      const handle = draft.handle.trim();
      await sql`
        insert into creators (
          id, user_id, slug, code, name, bio, fee_bps, platform_plan,
          bank_name, bank_code, account_number, account_name, payout_connected, payout_connected_at,
          payout_rail, payout_country, payout_currency, payout_handle, fx_fee_bps
        ) values (
          ${id}, ${actor.id}, ${slug}, ${code}, ${effect.name}, 'Paid Telegram group on TeleMonetize.',
          ${fee}, ${effect.platformPlan}, ${inst}, ${effect.bankCode}, ${handle},
          ${actor.name.toUpperCase()}, true, now(),
          ${draft.rail}, ${draft.country}, ${draft.currency}, ${handle}, 150
        )
      `;
      await sql`
        insert into plans (id, creator_id, name, description, interval, price_usd, is_active, sort_order)
        values (${nid("pln")}, ${id}, 'Monthly', 'Access to the private group.', 'monthly', ${effect.priceUsd}, true, 1)
      `;
      return [
        {
          text: `You're live.\n\nCreator ID  ${code}\nGroup  ${effect.name}\nAdd @TeleMonetizeBot as admin with Invite users and Ban users.`,
          buttons: [[{ label: "Studio", payload: "studio", tone: "primary" }]],
        },
      ];
    }
    case "connect_bank": {
      const world = await loadWorld(actor);
      const community = ownedCommunity(world);
      if (!community) return [{ text: "Create a community first." }];
      const draft: PayoutDraft = effect.payout ?? {
        rail: "bank",
        country: "NG",
        currency: "NGN",
        institution: bankByCode(effect.bankCode)?.name ?? "Bank",
        handle: effect.accountNumber,
      };
      const invalid = validatePayoutHandle(draft);
      if (invalid) return [{ text: invalid }];
      const inst = institutionLabel(draft);
      const handle = draft.handle.trim();
      await sql`
        update creators set
          bank_name = ${inst}, bank_code = ${effect.bankCode}, account_number = ${handle},
          account_name = ${actor.name.toUpperCase()}, payout_connected = true, payout_connected_at = now(),
          payout_rail = ${draft.rail}, payout_country = ${draft.country},
          payout_currency = ${draft.currency}, payout_handle = ${handle}
        where id = ${community.id}
      `;
      return [{ text: `ID ${community.code} now pays out via ${draft.rail} in ${draft.currency} to ${inst}.` }];
    }
    case "connect_payout": {
      const world = await loadWorld(actor);
      const community = ownedCommunity(world);
      if (!community) return [{ text: "Create a community first." }];
      const invalid = validatePayoutHandle(effect.payout);
      if (invalid) return [{ text: invalid }];
      const inst = institutionLabel(effect.payout);
      const handle = effect.payout.handle.trim();
      await sql`
        update creators set
          bank_name = ${inst}, bank_code = ${effect.payout.country}, account_number = ${handle},
          account_name = ${actor.name.toUpperCase()}, payout_connected = true, payout_connected_at = now(),
          payout_rail = ${effect.payout.rail}, payout_country = ${effect.payout.country},
          payout_currency = ${effect.payout.currency}, payout_handle = ${handle}
        where id = ${community.id}
      `;
      return [{ text: `ID ${community.code} now pays out via ${effect.payout.rail} in ${effect.payout.currency} to ${inst}.` }];
    }
    case "add_plan": {
      const world = await loadWorld(actor);
      const community = ownedCommunity(world);
      if (!community) return [{ text: "Create a community first." }];
      await sql`
        insert into plans (id, creator_id, name, description, interval, price_usd, is_active, sort_order)
        values (${nid("pln")}, ${community.id}, ${effect.name}, ${`${effect.name} access.`}, 'monthly', ${effect.priceUsd}, true, 1)
      `;
      return [{ text: `${effect.name} is live.` }];
    }
    case "fail_card": {
      const world = await loadWorld(actor);
      const community = ownedCommunity(world);
      if (!community) return [];
      const handle = effect.username.replace(/^@/, "").toLowerCase();
      const member = world.members.find((m) => m.username.toLowerCase() === handle);
      if (!member) return [];
      await sql`
        update subscriptions set card_failing = true, auto_renew = true, current_period_end = now() - interval '1 minute'
        where creator_id = ${community.id} and user_id = ${member.userId}
      `;
      return [];
    }
    case "extend": {
      const world = await loadWorld(actor);
      const community = ownedCommunity(world);
      if (!community) return [{ text: "Create a community first." }];
      const handle = effect.username.replace(/^@/, "").toLowerCase();
      const member = world.members.find((m) => m.username.toLowerCase() === handle);
      if (!member) return [{ text: `No member @${handle}.` }];
      await sql`
        update subscriptions set
          status = 'active',
          current_period_end = ${new Date(Date.now() + effect.days * 86_400_000).toISOString()}
        where creator_id = ${community.id} and user_id = ${member.userId}
      `;
      return [{ text: `Extended @${member.username} by ${effect.days} days.` }];
    }
    case "add_filter": {
      const world = await loadWorld(actor);
      const community = ownedCommunity(world);
      if (!community) return [];
      await sql`
        insert into keyword_filters (id, creator_id, keyword, action)
        values (${nid("kw")}, ${community.id}, ${effect.keyword}, ${effect.action})
      `;
      return [];
    }
    case "log": {
      await sql`
        insert into bot_logs (id, creator_id, event_type, message)
        values (${nid("log")}, ${effect.communityId}, ${effect.event}, ${effect.message})
      `;
      return [];
    }
    default:
      return [];
  }
}

export async function dispatchTelegramEvent(actor: Actor, event: BotEvent): Promise<BotReply[]> {
  await ensureAccount(actor);
  const world = await loadWorld(actor);
  const result = reduce(world, event);
  await saveSession(actor.id, result.pending, result.role);
  const extra: BotReply[] = [];
  for (const effect of result.effects) {
    extra.push(...(await applyEffect(actor, effect)));
  }
  return [...result.replies, ...extra];
}

function keyboard(replies: BotReply[]) {
  const last = [...replies].reverse().find((r) => r.buttons?.length);
  if (!last?.buttons) return undefined;
  return last.buttons.map((row) =>
    row.map((b) => ({
      text: b.label,
      callback_data: b.url ? undefined : b.payload,
      url: b.url,
    })),
  );
}

export async function processTelegramUpdate(update: TelegramUpdate) {
  const token = await platformToken();
  if (!token) return;

  const added = update.my_chat_member;
  if (
    added &&
    (added.new_chat_member.status === "administrator" || added.new_chat_member.status === "member")
  ) {
    const chat = added.chat;
    if (chat.type === "group" || chat.type === "supergroup" || chat.type === "channel") {
      const sql = await getSql();
      const type = chat.type === "channel" ? "channel" : "group";
      await sql`
        update creators set
          telegram_chat_id = ${String(chat.id)},
          telegram_chat_title = ${chat.title ?? null},
          telegram_chat_type = ${type}
        where telegram_chat_id is null and lower(name) = ${chat.title?.toLowerCase() ?? ""}
      `;
    }
  }

  const cb = update.callback_query;
  if (cb?.from && cb.data) {
    const actor: Actor = {
      id: `tg-${cb.from.id}`,
      username: cb.from.username ?? String(cb.from.id),
      name: cb.from.first_name ?? "Member",
      telegramUserId: String(cb.from.id),
    };
    const replies = await dispatchTelegramEvent(actor, { type: "callback", payload: cb.data });
    await answerCallbackQuery(token, cb.id);
    for (const reply of replies) {
      await sendMessage(token, cb.from.id, reply.text, keyboard([reply]));
    }
    return;
  }

  const message = update.message;
  if (message?.chat.type === "private" && message.from && message.text) {
    await handlePrivateMessage(message.from, message.text);
  }
}

/** Drive the pure FSM from a real Telegram private chat — not a thin /start that only links out. */
export async function handlePrivateMessage(
  from: { id: number; username?: string; first_name?: string },
  text: string,
) {
  const token = await platformToken();
  if (!token) return;
  const actor: Actor = {
    id: `tg-${from.id}`,
    username: from.username ?? String(from.id),
    name: from.first_name ?? "Member",
    telegramUserId: String(from.id),
  };
  const replies = await dispatchTelegramEvent(actor, { type: "input", text });
  for (const reply of replies) {
    await sendMessage(token, from.id, reply.text, keyboard([reply]));
  }
}
