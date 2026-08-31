import { createServerFn } from "@tanstack/react-start";
import type { Payment } from "@/lib/types";
import { getSql } from "@/lib/db";
import { applyTelegramKick, fulfillPayment } from "./access";
import { runMoneyLoop } from "./loop";
import { demoPaymentsEnabled } from "./production";

export const persistCheckoutFn = createServerFn({ method: "POST" })
  .validator((input: Payment) => input)
  .handler(async ({ data }) => {
    if (!demoPaymentsEnabled()) return { ok: false as const, error: "demo_disabled" };
    const sql = await getSql();
    await sql`
      insert into payments (
        id, user_id, creator_id, subscription_id, plan_id, amount, currency, charged_minor,
        provider, provider_ref, status, platform_fee, creator_payout, settlement_status, created_at
      ) values (
        ${data.id}, ${data.userId}, ${data.communityId}, ${data.subscriptionId || null}, ${data.planId},
        ${data.amount}, ${data.currency}, ${data.chargedMinor}, ${data.provider}, ${data.providerRef},
        ${data.status}, ${data.platformFee}, ${data.creatorPayout}, ${data.settlement}, ${data.createdAt}
      )
      on conflict (id) do update set
        status = excluded.status,
        provider_ref = excluded.provider_ref
    `;
    return { ok: true as const };
  });

export const persistFulfillFn = createServerFn({ method: "POST" })
  .validator((input: { reference: string }) => input)
  .handler(async ({ data }) => {
    if (!demoPaymentsEnabled()) return { ok: false as const, error: "demo_disabled" };
    const sql = await getSql();
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
    }>`select * from payments where provider_ref = ${data.reference} limit 1`;
    const payment = payments[0];
    if (!payment) return { ok: false as const, error: "unknown" };
    if (payment.status === "success") return { ok: true as const };
    await fulfillPayment(payment);
    return { ok: true as const };
  });

export const persistKickFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      communityId: string;
      telegramUserId: string | null;
      username: string;
      inviteUrl: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    if (!demoPaymentsEnabled()) return { ok: false as const, error: "demo_disabled" };
    const sql = await getSql();
    const handle = data.username.replace(/^@/, "").toLowerCase();
    const creators = await sql<{ telegram_chat_id: string | null }>`
      select telegram_chat_id from creators where id = ${data.communityId} limit 1
    `;
    await sql`
      update telegram_members set
        status = 'removed',
        removed_at = now(),
        remove_reason = 'removed_by_admin',
        invite_url = '',
        invite_token = null
      where creator_id = ${data.communityId}
        and (
          lower(coalesce(telegram_username, '')) = ${handle}
          or (${data.telegramUserId} is not null and telegram_user_id = ${data.telegramUserId})
        )
    `;
    await sql`
      update subscriptions set status = 'cancelled', auto_renew = false
      where creator_id = ${data.communityId}
        and (
          lower(coalesce(telegram_username, '')) = ${handle}
          or (${data.telegramUserId} is not null and telegram_user_id = ${data.telegramUserId})
          or (${data.telegramUserId} is not null and user_id = ${data.telegramUserId})
        )
    `;
    await applyTelegramKick({
      creatorId: data.communityId,
      chatId: creators[0]?.telegram_chat_id ?? null,
      telegramUserId: data.telegramUserId,
      inviteUrl: data.inviteUrl,
    });
    return { ok: true as const };
  });

export const runLoopFn = createServerFn({ method: "POST" })
  .validator((input: { creatorId?: string } = {}) => input)
  .handler(async ({ data }) => {
    if (!demoPaymentsEnabled()) return { expired: 0, renewed: 0, retried: 0, warned: 0, kicked: 0, reminded: 0 };
    return runMoneyLoop(data.creatorId);
  });
