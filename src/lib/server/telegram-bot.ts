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
import { issueBindToken, issueCreatorCode, issueSlug, ownedCommunity, parseBindCommand } from "@/lib/bot/world";
import {
  applyTelegramKick,
  checkoutEmail,
  connectNigerianPayout,
  fulfillPayment,
  startPaystackCheckout,
} from "./access";
import { runMoneyLoop } from "./loop";
import { demoPaymentsEnabled, isOperatorActor } from "./production";
import { extendPeriodEnd } from "@/lib/format";
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
      if (!demoPaymentsEnabled()) {
        return [{ text: "Payment confirms from Paystack, not from this button." }];
      }
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
      const world = await loadWorld(actor, { live: true, operator: isOperatorActor(actor) });
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
      const world = await loadWorld(actor, { live: true, operator: isOperatorActor(actor) });
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
      if (draft.rail !== "bank" || draft.country !== "NG") {
        return [
          {
            text: "Live payouts are Nigerian bank accounts via Paystack. Other rails are paused until each one has a settlement API.",
          },
        ];
      }
      const invalid = validatePayoutHandle(draft);
      if (invalid) return [{ text: invalid }];
      const existing = await sql<{ id: string }>`select id from creators where user_id = ${actor.id} limit 1`;
      if (existing[0]) return [{ text: "You already have a creator ID. /studio" }];
      const takenCodes = await sql<{ code: string }>`select code from creators where code ilike ${`${effect.name.replace(/[^a-zA-Z]/g, "").slice(0, 4) || "CRE"}-%`}`;
      const allCodes = takenCodes.length
        ? takenCodes
        : await sql<{ code: string }>`select code from creators`;
      const code = issueCreatorCode(effect.name, new Set(allCodes.map((t) => t.code.toLowerCase())));
      const takenSlugs = await sql<{ slug: string }>`select slug from creators`;
      const slug = issueSlug(effect.name, new Set(takenSlugs.map((s) => s.slug)));
      const bindToken = issueBindToken();
      const id = nid("cre");
      const fee = effect.platformPlan === "pro" ? 500 : 800;
      const inst = institutionLabel(draft);
      const handle = draft.handle.trim();
      let accountName = actor.name.toUpperCase();
      let subaccount: string | null = null;
      let verified = false;
      try {
        const payout = await connectNigerianPayout({
          creatorId: id,
          bankCode: effect.bankCode,
          accountNumber: handle,
          businessName: effect.name,
          feeBps: fee,
          actorName: actor.name,
        });
        accountName = payout.accountName;
        subaccount = payout.subaccount;
        verified = payout.verified;
      } catch (err) {
        return [{ text: err instanceof Error ? err.message : "Could not attach that NUBAN." }];
      }
      await sql`
        insert into creators (
          id, user_id, slug, code, name, bio, fee_bps, platform_plan,
          bank_name, bank_code, account_number, account_name, payout_connected, payout_connected_at,
          payout_rail, payout_country, payout_currency, payout_handle, fx_fee_bps,
          bind_token, paystack_subaccount
        ) values (
          ${id}, ${actor.id}, ${slug}, ${code}, ${effect.name}, 'Paid Telegram group on TeleMonetize.',
          ${fee}, ${effect.platformPlan}, ${inst}, ${effect.bankCode}, ${handle},
          ${accountName}, true, now(),
          ${draft.rail}, ${draft.country}, ${draft.currency}, ${handle}, 150,
          ${bindToken}, ${subaccount}
        )
      `;
      await sql`
        insert into plans (id, creator_id, name, description, interval, price_usd, is_active, sort_order)
        values (${nid("pln")}, ${id}, 'Monthly', 'Access to the private group.', 'monthly', ${effect.priceUsd}, true, 1)
      `;
      return [
        {
          text: `You're live.\n\nCreator ID  ${code}\nGroup  ${effect.name}\nAdd @TeleMonetizeBot as admin with Invite users and Ban users. I bind the group to the Telegram account that added me — not the title.\nOr send /bind ${bindToken} in the group.${verified ? "" : "\nNUBAN saved (Paystack verify skipped in demo)."}`,
          buttons: [[{ label: "Studio", payload: "studio", tone: "primary" }]],
        },
      ];
    }
    case "connect_bank": {
      const world = await loadWorld(actor, { live: true, operator: isOperatorActor(actor) });
      const community = ownedCommunity(world);
      if (!community) return [{ text: "Create a community first." }];
      const draft: PayoutDraft = effect.payout ?? {
        rail: "bank",
        country: "NG",
        currency: "NGN",
        institution: bankByCode(effect.bankCode)?.name ?? "Bank",
        handle: effect.accountNumber,
      };
      if (draft.rail !== "bank" || draft.country !== "NG") {
        return [
          {
            text: "Live payouts are Nigerian bank accounts via Paystack. Other rails are paused until each one has a settlement API.",
          },
        ];
      }
      const invalid = validatePayoutHandle(draft);
      if (invalid) return [{ text: invalid }];
      const inst = institutionLabel(draft);
      const handle = draft.handle.trim();
      let accountName = actor.name.toUpperCase();
      let subaccount: string | null = null;
      let verified = false;
      try {
        const payout = await connectNigerianPayout({
          creatorId: community.id,
          bankCode: effect.bankCode,
          accountNumber: handle,
          businessName: community.name,
          feeBps: community.feeBps,
          actorName: actor.name,
        });
        accountName = payout.accountName;
        subaccount = payout.subaccount;
        verified = payout.verified;
      } catch (err) {
        return [{ text: err instanceof Error ? err.message : "Could not attach that NUBAN." }];
      }
      await sql`
        update creators set
          bank_name = ${inst}, bank_code = ${effect.bankCode}, account_number = ${handle},
          account_name = ${accountName}, payout_connected = true, payout_connected_at = now(),
          payout_rail = ${draft.rail}, payout_country = ${draft.country},
          payout_currency = ${draft.currency}, payout_handle = ${handle},
          paystack_subaccount = ${subaccount}
        where id = ${community.id}
      `;
      return [
        {
          text: `ID ${community.code} now pays out to ${inst} · ${accountName}.${verified ? "" : " NUBAN saved (Paystack verify skipped in demo)."}`,
        },
      ];
    }
    case "connect_payout": {
      return [
        {
          text: "Live payouts are Nigerian bank accounts via Paystack. Other rails are paused until each one has a settlement API. Pick a Nigerian bank, then send the 10-digit NUBAN.",
        },
      ];
    }
    case "add_plan": {
      const world = await loadWorld(actor, { live: true, operator: isOperatorActor(actor) });
      const community = ownedCommunity(world);
      if (!community) return [{ text: "Create a community first." }];
      await sql`
        insert into plans (id, creator_id, name, description, interval, price_usd, is_active, sort_order)
        values (${nid("pln")}, ${community.id}, ${effect.name}, ${`${effect.name} access.`}, 'monthly', ${effect.priceUsd}, true, 1)
      `;
      return [{ text: `${effect.name} is live.` }];
    }
    case "fail_card": {
      if (!demoPaymentsEnabled()) return [{ text: "That demo control is off." }];
      const world = await loadWorld(actor, { live: true, operator: isOperatorActor(actor) });
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
      const world = await loadWorld(actor, { live: true, operator: isOperatorActor(actor) });
      const community = ownedCommunity(world);
      if (!community) return [{ text: "Create a community first." }];
      const handle = effect.username.replace(/^@/, "").toLowerCase();
      const member = world.members.find((m) => m.username.toLowerCase() === handle);
      if (!member) return [{ text: `No member @${handle}.` }];
      const current = await sql<{ current_period_end: string | null }>`
        select current_period_end from subscriptions
        where creator_id = ${community.id} and user_id = ${member.userId}
        limit 1
      `;
      await sql`
        update subscriptions set
          status = 'active',
          current_period_end = ${extendPeriodEnd(current[0]?.current_period_end, effect.days)}
        where creator_id = ${community.id} and user_id = ${member.userId}
      `;
      return [{ text: `Extended @${member.username} by ${effect.days} days.` }];
    }
    case "add_filter": {
      const world = await loadWorld(actor, { live: true, operator: isOperatorActor(actor) });
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
  const world = await loadWorld(actor, { live: true, operator: isOperatorActor(actor) });
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

async function bindChatToCreator(opts: {
  chat: { id: number; type: string; title?: string };
  adderId?: number;
  bindToken?: string | null;
}) {
  const sql = await getSql();
  const type = opts.chat.type === "channel" ? "channel" : "group";
  const chatId = String(opts.chat.id);
  const title = opts.chat.title ?? null;

  if (opts.bindToken) {
    const token = opts.bindToken.trim().toUpperCase();
    const rows = await sql<{ id: string; code: string; name: string }>`
      update creators set
        telegram_chat_id = ${chatId},
        telegram_chat_title = ${title},
        telegram_chat_type = ${type}
      where bind_token = ${token}
        and (telegram_chat_id is null or telegram_chat_id = ${chatId})
      returning id, code, name
    `;
    return rows[0] ?? null;
  }

  if (opts.adderId) {
    const ownerId = `tg-${opts.adderId}`;
    const rows = await sql<{ id: string; code: string; name: string }>`
      update creators set
        telegram_chat_id = ${chatId},
        telegram_chat_title = ${title},
        telegram_chat_type = ${type}
      where user_id = ${ownerId}
        and (telegram_chat_id is null or telegram_chat_id = ${chatId})
      returning id, code, name
    `;
    return rows[0] ?? null;
  }
  return null;
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
      const bound = await bindChatToCreator({ chat, adderId: added.from?.id });
      if (bound) {
        await sendMessage(
          token,
          chat.id,
          `Bound “${chat.title ?? "this chat"}” to creator ID ${bound.code}. Invites and kicks now run here.`,
        );
      } else {
        await sendMessage(
          token,
          chat.id,
          "I bind a group to the Telegram account that added me — not the title. Add me from the account that owns the creator ID, or send /bind TOKEN here.",
        );
      }
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
    const dest = cb.message?.chat.type === "private" ? cb.from.id : cb.message?.chat.id ?? cb.from.id;
    for (const reply of replies) {
      await sendMessage(token, dest, reply.text, keyboard([reply]));
    }
    return;
  }

  const message = update.message;
  if (!message?.from || !message.text) return;

  if (message.chat.type === "private") {
    await handlePrivateMessage(message.from, message.text);
    return;
  }

  if (message.chat.type === "group" || message.chat.type === "supergroup" || message.chat.type === "channel") {
    const bindToken = parseBindCommand(message.text);
    if (!bindToken) return;
    const bound = await bindChatToCreator({ chat: message.chat, bindToken });
    if (bound) {
      await sendMessage(
        token,
        message.chat.id,
        `Bound “${message.chat.title ?? "this chat"}” to creator ID ${bound.code}. Invites and kicks now run here.`,
      );
    } else {
      await sendMessage(
        token,
        message.chat.id,
        "That bind token did not match an unbound creator ID. Send the token from /studio, or add me from the account that owns the ID.",
      );
    }
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
