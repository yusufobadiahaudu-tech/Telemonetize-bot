import { getSql } from "@/lib/db";
import { periodEnd, splitAmounts } from "@/lib/format";
import { planRenewal } from "@/lib/renewal";
import type { LoopResult } from "@/lib/types";
import { nid } from "@/lib/utils";
import { applyTelegramKick } from "./access";
import { chargeAuthorization, getPaystackKeys } from "./paystack";
import { demoPaymentsEnabled } from "./production";
import { numericTelegramId, sendMessage } from "./telegram-api";

type SubRow = {
  id: string;
  user_id: string;
  creator_id: string;
  plan_id: string;
  status: string;
  auto_renew: boolean;
  current_period_end: string | null;
  telegram_username: string | null;
  telegram_user_id: string | null;
  retry_count: number;
  card_failing: boolean;
  authorization_code: string | null;
  authorization_email: string | null;
  authorization_currency: string | null;
};

type CreatorRow = {
  id: string;
  name: string;
  fee_bps: number;
  payout_connected: boolean;
  telegram_chat_id: string | null;
};

type PlanRow = { id: string; name: string; interval: string; price_usd: number };

export { planRenewal } from "@/lib/renewal";

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

async function dmMember(telegramUserId: string | null, text: string) {
  const token = await platformToken();
  const userId = numericTelegramId(telegramUserId);
  if (!token || !userId) return;
  try {
    await sendMessage(token, userId, text);
  } catch {
    // User has not started the bot.
  }
}

async function kickSeat(creator: CreatorRow, sub: SubRow, reason: string) {
  const sql = await getSql();
  const members = await sql<{
    id: string;
    telegram_user_id: string | null;
    invite_url: string | null;
    telegram_username: string | null;
  }>`
    select id, telegram_user_id, invite_url, telegram_username
    from telegram_members
    where creator_id = ${creator.id} and user_id = ${sub.user_id}
    limit 1
  `;
  const member = members[0];
  await sql`
    update subscriptions set status = 'expired', auto_renew = false, card_failing = false
    where id = ${sub.id}
  `;
  if (member) {
    await sql`
      update telegram_members set
        status = 'removed',
        removed_at = now(),
        remove_reason = ${reason},
        invite_url = '',
        invite_token = null
      where id = ${member.id}
    `;
    await applyTelegramKick({
      creatorId: creator.id,
      chatId: creator.telegram_chat_id,
      telegramUserId: member.telegram_user_id,
      inviteUrl: member.invite_url,
    });
  }
  const who = member?.telegram_username ?? sub.telegram_username ?? sub.user_id;
  await logBot(creator.id, "kick", `Removed @${who} — ${reason}. Invite revoked.`);
  await dmMember(member?.telegram_user_id ?? sub.telegram_user_id, `Your seat in ${creator.name} ended (${reason.replaceAll("_", " ")}). Pay again to rejoin.`);
  return Boolean(member);
}

async function recordFailedCharge(creator: CreatorRow, sub: SubRow, plan: PlanRow) {
  const sql = await getSql();
  const split = splitAmounts(plan.price_usd, creator.fee_bps);
  const payId = nid("pay");
  await sql`
    insert into payments (
      id, user_id, creator_id, subscription_id, plan_id, amount, currency, charged_minor,
      provider, provider_ref, status, platform_fee, creator_payout, settlement_status
    ) values (
      ${payId}, ${sub.user_id}, ${creator.id}, ${sub.id}, ${plan.id},
      ${plan.price_usd}, 'USD', ${plan.price_usd}, 'card', ${`FAIL_${payId.slice(4)}`},
      'failed', ${split.platformFee}, 0, 'unsplit'
    )
  `;
}

/** Retry, warn, then kick. Renewals charge Paystack — they never mint a local success. */
export async function runMoneyLoop(creatorId?: string): Promise<LoopResult> {
  const sql = await getSql();
  const result: LoopResult = { expired: 0, renewed: 0, retried: 0, warned: 0, kicked: 0, reminded: 0 };
  const creators = creatorId
    ? await sql<CreatorRow>`select id, name, fee_bps, payout_connected, telegram_chat_id from creators where id = ${creatorId}`
    : await sql<CreatorRow>`select id, name, fee_bps, payout_connected, telegram_chat_id from creators`;

  const now = Date.now();
  const keys = await getPaystackKeys();
  const canCharge = Boolean(keys) || demoPaymentsEnabled();

  for (const creator of creators) {
    const subs = await sql<SubRow>`
      select id, user_id, creator_id, plan_id, status, auto_renew, current_period_end,
        telegram_username, telegram_user_id, retry_count, card_failing,
        authorization_code, authorization_email, authorization_currency
      from subscriptions
      where creator_id = ${creator.id} and status in ('active', 'past_due')
    `;
    const planIds = [...new Set(subs.map((s) => s.plan_id))];
    const planRows =
      planIds.length === 0
        ? []
        : await sql<PlanRow>`select id, name, interval, price_usd from plans where creator_id = ${creator.id}`;
    const plansById = new Map(planRows.map((p) => [p.id, p]));

    for (const sub of subs) {
      const plan = plansById.get(sub.plan_id);
      if (!plan) continue;
      const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
      const who = `@${sub.telegram_username ?? sub.user_id}`;
      const existing = await sql<{ id: string }>`
        select id from reminders where subscription_id = ${sub.id} and kind = '3day' limit 1
      `;
      const action = planRenewal({
        periodEndMs: end,
        now,
        autoRenew: sub.auto_renew,
        retryCount: sub.retry_count,
        cardFailing: sub.card_failing || !canCharge,
        hasAuthorization: Boolean(sub.authorization_code && sub.authorization_email),
        payoutConnected: creator.payout_connected,
        alreadyReminded: Boolean(existing[0]),
      });

      if (action === "wait") continue;

      if (action === "remind") {
        await sql`
          insert into reminders (id, subscription_id, kind) values (${nid("rmd")}, ${sub.id}, '3day')
        `;
        await logBot(creator.id, "remind", `Sent 3-day expiry reminder to ${who} (${plan.name}).`);
        await dmMember(
          sub.telegram_user_id,
          `Your ${plan.name} seat in ${creator.name} ends in 3 days. Stay on auto-renew or pay again before then.`,
        );
        result.reminded += 1;
        continue;
      }

      if (action === "kick_cancel") {
        result.expired += 1;
        if (await kickSeat(creator, sub, "renewal_cancelled")) result.kicked += 1;
        continue;
      }

      if (action === "kick_fail") {
        await recordFailedCharge(creator, sub, plan);
        result.expired += 1;
        if (await kickSeat(creator, sub, "payment_failed")) result.kicked += 1;
        continue;
      }

      if (action === "retry_warn") {
        const next = sub.retry_count + 1;
        await recordFailedCharge(creator, sub, plan);
        await sql`update subscriptions set status = 'past_due', retry_count = ${next}, card_failing = true where id = ${sub.id}`;
        const last = next >= 2;
        await logBot(
          creator.id,
          "warn",
          last
            ? `Last warning to ${who}: pay today or the bot kicks them.`
            : `Card declined for ${who} (${plan.name}). Retrying. They stay in the group.`,
        );
        await dmMember(
          sub.telegram_user_id,
          last
            ? `Last warning: your ${plan.name} seat in ${creator.name} will be removed if payment does not go through today.`
            : `We could not renew ${plan.name} for ${creator.name}. We will retry. You still have access for now.`,
        );
        result.retried += 1;
        result.warned += 1;
        continue;
      }

      const auth = sub.authorization_code;
      const email = sub.authorization_email;
      if (!auth || !email || !keys) {
        await sql`
          update subscriptions set status = 'past_due', card_failing = true, retry_count = retry_count + 1
          where id = ${sub.id}
        `;
        await logBot(creator.id, "warn", `Renewal for ${who} was not charged — no reusable authorization.`);
        result.retried += 1;
        result.warned += 1;
        continue;
      }

      const lastPay = await sql<{ charged_minor: number; currency: string }>`
        select charged_minor, currency from payments
        where subscription_id = ${sub.id} and status = 'success'
        order by created_at desc
        limit 1
      `;
      const currency = sub.authorization_currency === "NGN" || lastPay[0]?.currency === "NGN" ? "NGN" : "USD";
      const amount =
        lastPay[0] && lastPay[0].currency === currency && lastPay[0].charged_minor > 0
          ? lastPay[0].charged_minor
          : plan.price_usd;
      const reference = `RNW_${nid("r").slice(2, 12)}`;
      let charged = false;
      try {
        const res = await chargeAuthorization({
          authorizationCode: auth,
          email,
          amount,
          currency,
          reference,
          metadata: { subscriptionId: sub.id, creatorId: creator.id, kind: "renewal" },
        });
        charged = res.status === "success";
      } catch {
        charged = false;
      }

      if (!charged) {
        const next = sub.retry_count + 1;
        await recordFailedCharge(creator, sub, plan);
        if (next >= 3) {
          result.expired += 1;
          if (await kickSeat(creator, sub, "payment_failed")) result.kicked += 1;
        } else {
          await sql`update subscriptions set status = 'past_due', retry_count = ${next}, card_failing = true where id = ${sub.id}`;
          await logBot(creator.id, "warn", `Renewal charge failed for ${who} (${plan.name}).`);
          result.retried += 1;
          result.warned += 1;
        }
        continue;
      }

      const start = new Date();
      const nextEnd = periodEnd(plan.interval, start);
      const split = splitAmounts(plan.price_usd, creator.fee_bps);
      await sql`
        insert into payments (
          id, user_id, creator_id, subscription_id, plan_id, amount, currency, charged_minor,
          provider, provider_ref, status, platform_fee, creator_payout, settlement_status, settled_at,
          authorization_code
        ) values (
          ${nid("pay")}, ${sub.user_id}, ${creator.id}, ${sub.id}, ${plan.id},
          ${plan.price_usd}, ${currency}, ${amount}, 'card', ${reference},
          'success', ${split.platformFee}, ${split.creatorPayout}, 'wallet_and_bank', now(),
          ${auth}
        )
      `;
      await sql`
        update subscriptions set
          status = 'active', card_failing = false, retry_count = 0,
          current_period_start = ${start.toISOString()},
          current_period_end = ${nextEnd.toISOString()}
        where id = ${sub.id}
      `;
      await sql`update platform_bot set wallet_usd = wallet_usd + ${split.platformFee} where id = 'singleton'`;
      await logBot(creator.id, "renew", `Auto-renewed ${plan.name} for ${who}.`);
      result.renewed += 1;
    }
  }
  return result;
}
