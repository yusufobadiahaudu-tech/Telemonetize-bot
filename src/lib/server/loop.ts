import { getSql } from "@/lib/db";
import { periodEnd, splitAmounts } from "@/lib/format";
import type { LoopResult } from "@/lib/types";
import { nid } from "@/lib/utils";
import { applyTelegramKick } from "./access";

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
};

type CreatorRow = {
  id: string;
  name: string;
  fee_bps: number;
  payout_connected: boolean;
  telegram_chat_id: string | null;
};

type PlanRow = { id: string; name: string; interval: string; price_usd: number };

async function logBot(creatorId: string, event: string, message: string) {
  const sql = await getSql();
  await sql`
    insert into bot_logs (id, creator_id, event_type, message)
    values (${nid("log")}, ${creatorId}, ${event}, ${message})
  `;
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
  await logBot(
    creator.id,
    "kick",
    `Removed @${member?.telegram_username ?? sub.telegram_username ?? sub.user_id} — ${reason}. Invite revoked.`,
  );
  return Boolean(member);
}

/** Retry, warn, then kick. Used by the cron and by /loop as a manual override. */
export async function runMoneyLoop(creatorId?: string): Promise<LoopResult> {
  const sql = await getSql();
  const result: LoopResult = { expired: 0, renewed: 0, retried: 0, warned: 0, kicked: 0, reminded: 0 };
  const creators = creatorId
    ? await sql<CreatorRow>`select id, name, fee_bps, payout_connected, telegram_chat_id from creators where id = ${creatorId}`
    : await sql<CreatorRow>`select id, name, fee_bps, payout_connected, telegram_chat_id from creators`;

  const now = Date.now();

  for (const creator of creators) {
    const subs = await sql<SubRow>`
      select * from subscriptions
      where creator_id = ${creator.id} and status in ('active', 'past_due')
    `;
    for (const sub of subs) {
      const plans = await sql<PlanRow>`select * from plans where id = ${sub.plan_id}`;
      const plan = plans[0];
      if (!plan) continue;
      const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
      const who = `@${sub.telegram_username ?? sub.user_id}`;

      if (end > now) {
        if (end < now + 3 * 86_400_000) {
          const existing = await sql<{ id: string }>`
            select id from reminders where subscription_id = ${sub.id} and kind = '3day' limit 1
          `;
          if (!existing[0]) {
            await sql`
              insert into reminders (id, subscription_id, kind) values (${nid("rmd")}, ${sub.id}, '3day')
            `;
            await logBot(creator.id, "remind", `Sent 3-day expiry reminder to ${who} (${plan.name}).`);
            result.reminded += 1;
          }
        }
        continue;
      }

      if (!sub.auto_renew) {
        result.expired += 1;
        if (await kickSeat(creator, sub, "renewal_cancelled")) result.kicked += 1;
        continue;
      }

      const failing = sub.card_failing || sub.status === "past_due";
      if (failing) {
        const next = sub.retry_count + 1;
        const split = splitAmounts(plan.price_usd, creator.fee_bps);
        await sql`
          insert into payments (
            id, user_id, creator_id, subscription_id, plan_id, amount, currency, charged_minor,
            provider, provider_ref, status, platform_fee, creator_payout, settlement_status
          ) values (
            ${nid("pay")}, ${sub.user_id}, ${creator.id}, ${sub.id}, ${plan.id},
            ${plan.price_usd}, 'USD', ${plan.price_usd}, 'card', ${`PSK_${nid("f").slice(2, 10)}`},
            'failed', ${split.platformFee}, 0, 'unsplit'
          )
        `;
        if (next === 1) {
          await sql`update subscriptions set status = 'past_due', retry_count = 1 where id = ${sub.id}`;
          await logBot(creator.id, "warn", `Card declined for ${who} (${plan.name}). Retrying. They stay in the group.`);
          result.retried += 1;
          result.warned += 1;
        } else if (next === 2) {
          await sql`update subscriptions set status = 'past_due', retry_count = 2 where id = ${sub.id}`;
          await logBot(creator.id, "warn", `Last warning to ${who}: pay today or the bot kicks them.`);
          result.retried += 1;
          result.warned += 1;
        } else {
          result.expired += 1;
          if (await kickSeat(creator, sub, "payment_failed")) result.kicked += 1;
        }
        continue;
      }

      if (!creator.payout_connected) {
        await sql`
          update subscriptions set status = 'past_due', card_failing = true, retry_count = retry_count + 1
          where id = ${sub.id}
        `;
        await logBot(creator.id, "warn", `Renewal for ${who} was not charged — connect a bank.`);
        result.retried += 1;
        result.warned += 1;
        continue;
      }

      const start = new Date();
      const nextEnd = periodEnd(plan.interval, start);
      const split = splitAmounts(plan.price_usd, creator.fee_bps);
      await sql`
        insert into payments (
          id, user_id, creator_id, subscription_id, plan_id, amount, currency, charged_minor,
          provider, provider_ref, status, platform_fee, creator_payout, settlement_status, settled_at
        ) values (
          ${nid("pay")}, ${sub.user_id}, ${creator.id}, ${sub.id}, ${plan.id},
          ${plan.price_usd}, 'USD', ${plan.price_usd}, 'card', ${`PSK_${nid("r").slice(2, 10)}`},
          'success', ${split.platformFee}, ${split.creatorPayout}, 'wallet_and_bank', now()
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
