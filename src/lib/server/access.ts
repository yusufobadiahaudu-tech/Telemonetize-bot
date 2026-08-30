import { getSql } from "@/lib/db";
import { usdToMinor, type Currency } from "@/lib/currency";
import { periodEnd, splitAmounts } from "@/lib/format";
import { nid } from "@/lib/utils";
import { publicOrigin } from "./origin";
import { getPaystackKeys, initializeTransaction } from "./paystack";
import {
  banChatMember,
  createChatInviteLink,
  numericTelegramId,
  revokeChatInviteLink,
  sendMessage,
} from "./telegram-api";

type CreatorRow = {
  id: string;
  name: string;
  slug: string;
  code: string;
  fee_bps: number;
  payout_connected: boolean;
  paystack_subaccount: string | null;
  telegram_chat_id: string | null;
  telegram_chat_title: string | null;
  telegram_chat_type: string;
};

type PlanRow = {
  id: string;
  creator_id: string;
  name: string;
  interval: string;
  price_usd: number;
  is_active: boolean;
};

type PaymentRow = {
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
};

async function platformToken() {
  const env = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (env) return env;
  const sql = await getSql();
  const rows = await sql<{ telegram_bot_token: string | null }>`
    select telegram_bot_token from platform_bot where id = 'singleton' limit 1
  `;
  return rows[0]?.telegram_bot_token?.trim() || null;
}

async function logBot(creatorId: string, event: string, message: string) {
  const sql = await getSql();
  await sql`
    insert into bot_logs (id, creator_id, event_type, message)
    values (${nid("log")}, ${creatorId}, ${event}, ${message})
  `;
}

async function resolveTelegramIdentity(userId: string, username?: string | null) {
  const sql = await getSql();
  const accounts = await sql<{ telegram_user_id: string; telegram_username: string | null }>`
    select telegram_user_id, telegram_username from telegram_accounts
    where user_id = ${userId} or telegram_user_id = ${userId}
    limit 1
  `;
  const telegramUserId =
    numericTelegramId(accounts[0]?.telegram_user_id) ??
    numericTelegramId(userId) ??
    accounts[0]?.telegram_user_id ??
    userId;
  const handle = (username ?? accounts[0]?.telegram_username ?? "").replace(/^@/, "").trim();
  return { telegramUserId, username: handle || null };
}

export async function issueTelegramInvite(
  creator: CreatorRow,
  label: string,
): Promise<{ token: string; url: string; live: boolean }> {
  const token = nid("inv").slice(4);
  const botToken = await platformToken();
  if (botToken && creator.telegram_chat_id) {
    try {
      const link = await createChatInviteLink(botToken, creator.telegram_chat_id, label);
      return { token, url: link.invite_link, live: true };
    } catch (err) {
      await logBot(
        creator.id,
        "warn",
        `Could not mint a live invite: ${err instanceof Error ? err.message : "Telegram error"}`,
      );
    }
  }
  return { token, url: `https://t.me/+${token}`, live: false };
}

export async function applyTelegramKick(opts: {
  creatorId: string;
  chatId: string | null;
  telegramUserId: string | null;
  inviteUrl: string | null;
}) {
  const botToken = await platformToken();
  if (!botToken || !opts.chatId) return { live: false as const };
  const userId = numericTelegramId(opts.telegramUserId);
  if (userId) {
    try {
      await banChatMember(botToken, opts.chatId, userId);
    } catch (err) {
      await logBot(
        opts.creatorId,
        "warn",
        `banChatMember failed: ${err instanceof Error ? err.message : "error"}`,
      );
    }
  }
  if (opts.inviteUrl && opts.inviteUrl.startsWith("https://t.me/")) {
    try {
      await revokeChatInviteLink(botToken, opts.chatId, opts.inviteUrl);
    } catch {
      // Demo links or already revoked.
    }
  }
  return { live: true as const };
}

export async function startPaystackCheckout(opts: {
  paymentId: string;
  email: string;
  amountMinor: number;
  currency: string;
  reference: string;
  provider: "card" | "transfer";
  subaccount?: string | null;
  metadata: Record<string, unknown>;
}) {
  const keys = await getPaystackKeys();
  if (!keys) {
    return {
      authorizationUrl: `${publicOrigin()}/api/demo/paystack?ref=${encodeURIComponent(opts.reference)}`,
      reference: opts.reference,
      demo: true as const,
    };
  }
  const channels = opts.provider === "transfer" ? (["bank_transfer"] as const) : (["card"] as const);
  const live = await initializeTransaction({
    email: opts.email,
    amount: opts.amountMinor,
    reference: opts.reference,
    callbackUrl: `${publicOrigin()}/api/demo/paystack?ref=${encodeURIComponent(opts.reference)}`,
    currency: opts.currency === "NGN" ? "NGN" : "USD",
    channels: [...channels],
    subaccount: opts.subaccount,
    metadata: opts.metadata,
  });
  return { authorizationUrl: live.authorizationUrl, reference: live.reference, demo: false as const };
}

/** Paid → active seat + invite. Idempotent. Never mint the link before charge.success. */
export async function fulfillPayment(payment: PaymentRow, telegramUsername?: string | null) {
  const sql = await getSql();
  const identity = await resolveTelegramIdentity(payment.user_id, telegramUsername);

  if (payment.plan_id === "pro") {
    await sql`
      update payments set status = 'success', settlement_status = 'wallet_and_bank', settled_at = now()
      where id = ${payment.id}
    `;
    await sql`
      update platform_bot set wallet_usd = wallet_usd + ${payment.amount} where id = 'singleton'
    `;
    const pending = JSON.stringify({ kind: "await_community_name", platformPlan: "pro" });
    await sql`
      update telegram_accounts set pending_json = ${pending}, role = 'creator'
      where user_id = ${payment.user_id}
    `;
    const botToken = await platformToken();
    const tgUser = numericTelegramId(identity.telegramUserId);
    if (botToken && tgUser) {
      try {
        await sendMessage(
          botToken,
          tgUser,
          "Pro is live. Send the Telegram group name you want bound to your ID.",
        );
      } catch {
        // User has not started the bot yet.
      }
    }
    return { kind: "pro" as const, paymentId: payment.id };
  }

  const plans = await sql<PlanRow>`select * from plans where id = ${payment.plan_id}`;
  const plan = plans[0];
  if (!plan) throw new Error("Plan missing");
  const creators = await sql<CreatorRow>`select * from creators where id = ${payment.creator_id}`;
  const creator = creators[0];
  if (!creator) throw new Error("Creator missing");

  const username = identity.username;
  const start = new Date();
  const end = periodEnd(plan.interval, start);
  const split = splitAmounts(payment.amount, creator.fee_bps);

  let subId = payment.subscription_id;
  if (!subId) {
    const existing = await sql<{ id: string }>`
      select id from subscriptions
      where user_id = ${payment.user_id} and creator_id = ${creator.id}
      order by created_at desc limit 1
    `;
    subId = existing[0]?.id ?? null;
  }

  if (subId) {
    await sql`
      update subscriptions set
        plan_id = ${plan.id},
        status = 'active',
        auto_renew = true,
        card_failing = false,
        retry_count = 0,
        current_period_start = ${start.toISOString()},
        current_period_end = ${end.toISOString()},
        telegram_user_id = ${identity.telegramUserId},
        telegram_username = coalesce(${username}, telegram_username)
      where id = ${subId}
    `;
  } else {
    subId = nid("sub");
    await sql`
      insert into subscriptions (
        id, user_id, creator_id, plan_id, status, auto_renew,
        current_period_start, current_period_end, telegram_user_id, telegram_username
      ) values (
        ${subId}, ${payment.user_id}, ${creator.id}, ${plan.id}, 'active', true,
        ${start.toISOString()}, ${end.toISOString()}, ${identity.telegramUserId}, ${username}
      )
    `;
  }

  await sql`
    update payments set
      status = 'success',
      subscription_id = ${subId},
      platform_fee = ${split.platformFee},
      creator_payout = ${split.creatorPayout},
      settlement_status = 'wallet_and_bank',
      settled_at = now()
    where id = ${payment.id}
  `;
  await sql`
    update platform_bot set wallet_usd = wallet_usd + ${split.platformFee} where id = 'singleton'
  `;

  const existingMember = await sql<{
    id: string;
    status: string;
    invite_url: string | null;
    invite_token: string | null;
  }>`
    select id, status, invite_url, invite_token from telegram_members
    where creator_id = ${creator.id} and user_id = ${payment.user_id}
    limit 1
  `;
  const alreadyIn = existingMember[0]?.status === "active" && Boolean(existingMember[0].invite_url);
  const minted = alreadyIn
    ? {
        token: existingMember[0]!.invite_token ?? nid("inv").slice(4),
        url: existingMember[0]!.invite_url as string,
        live: Boolean(creator.telegram_chat_id),
      }
    : await issueTelegramInvite(creator, username ?? "paid seat");

  if (existingMember[0]) {
    await sql`
      update telegram_members set
        status = 'active',
        joined_at = coalesce(joined_at, now()),
        invite_token = ${minted.token},
        invite_url = ${minted.url},
        telegram_user_id = ${identity.telegramUserId},
        telegram_username = coalesce(${username}, telegram_username),
        removed_at = null,
        remove_reason = null
      where id = ${existingMember[0].id}
    `;
  } else {
    await sql`
      insert into telegram_members (
        id, creator_id, user_id, telegram_user_id, telegram_username, display_name,
        status, invite_token, invite_url, joined_at
      ) values (
        ${nid("tgm")}, ${creator.id}, ${payment.user_id},
        ${identity.telegramUserId}, ${username}, ${username},
        'active', ${minted.token}, ${minted.url}, now()
      )
    `;
  }

  await logBot(
    creator.id,
    "invite",
    `charge.success. Admitted ${username ? `@${username}` : "subscriber"} to ${creator.telegram_chat_title ?? creator.name} (${plan.name}). Invite ${minted.url}.`,
  );

  const botToken = await platformToken();
  const tgUser = numericTelegramId(identity.telegramUserId);
  if (botToken && tgUser) {
    try {
      await sendMessage(
        botToken,
        tgUser,
        `Payment received.\n\n${creator.name} · ${plan.name}\n\nYou're in. Tap to join:\n${minted.url}`,
      );
    } catch {
      // User has not started the bot yet.
    }
  }

  return {
    kind: "member" as const,
    paymentId: payment.id,
    inviteUrl: minted.url,
    liveInvite: minted.live,
    creator,
    plan,
  };
}

export function checkoutEmail(userId: string) {
  return `member-${userId.replace(/[^a-z0-9]/gi, "").slice(0, 12)}@telemonetize.app`;
}

export function chargedMinor(usdCents: number, currency: string) {
  return usdToMinor(usdCents, (currency as Currency) || "USD");
}
