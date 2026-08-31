import { getSql } from "@/lib/db";
import type { Currency } from "@/lib/currency";
import type {
  Community,
  Keyword,
  Member,
  ModEvent,
  Payment,
  Pending,
  Plan,
  Provider,
  Role,
  Subscription,
} from "@/lib/types";
import type { Actor, World } from "@/lib/bot/world";
import { nid } from "@/lib/utils";

type CreatorRow = {
  id: string;
  user_id: string;
  slug: string;
  code: string;
  name: string;
  bio: string;
  category: string;
  fee_bps: number;
  platform_plan: "trial" | "starter" | "pro";
  telegram_chat_id: string | null;
  telegram_chat_type: "group" | "channel";
  is_public: boolean;
  payout_connected: boolean;
  bank_name: string | null;
  bank_code: string | null;
  account_number: string | null;
  account_name: string | null;
  payout_rail: string | null;
  payout_country: string | null;
  payout_currency: string | null;
  payout_handle: string | null;
  fx_fee_bps: number | null;
};

function toCommunity(row: CreatorRow): Community {
  return {
    id: row.id,
    ownerId: row.user_id,
    slug: row.slug,
    code: row.code,
    name: row.name,
    bio: row.bio,
    category: row.category,
    feeBps: row.fee_bps,
    platformPlan: row.platform_plan,
    chatId: row.telegram_chat_id ? `tg:${row.telegram_chat_id}` : `chat_${row.id}`,
    chatType: row.telegram_chat_type === "channel" ? "channel" : "group",
    telegramChatId: row.telegram_chat_id,
    botUsername: "TeleMonetizeBot",
    isPublic: row.is_public,
    payoutConnected: row.payout_connected,
    bankName: row.bank_name,
    bankCode: row.bank_code,
    accountNumber: row.account_number,
    accountName: row.account_name,
    payoutRail: (row.payout_rail as Community["payoutRail"]) ?? (row.payout_connected ? "bank" : null),
    payoutCountry: row.payout_country ?? (row.bank_code ? "NG" : null),
    payoutCurrency: (row.payout_currency as Community["payoutCurrency"]) || "USD",
    payoutHandle: row.payout_handle ?? row.account_number,
    fxFeeBps: row.fx_fee_bps ?? 150,
  };
}

export async function ensureAccount(actor: Actor) {
  const sql = await getSql();
  const telegramUserId = actor.telegramUserId ?? actor.id;
  await sql`
    insert into telegram_accounts (id, user_id, telegram_user_id, telegram_username, telegram_first_name, role)
    values (${nid("tga")}, ${actor.id}, ${telegramUserId}, ${actor.username}, ${actor.name}, 'member')
    on conflict (user_id) do update set
      telegram_user_id = excluded.telegram_user_id,
      telegram_username = excluded.telegram_username
  `;
}

export async function loadWorld(actor: Actor): Promise<World> {
  const sql = await getSql();
  const sessions = await sql<{ pending_json: string | null; role: string }>`
    select pending_json, role from telegram_accounts where user_id = ${actor.id} limit 1
  `;
  let pending: Pending = null;
  try {
    pending = sessions[0]?.pending_json ? (JSON.parse(sessions[0].pending_json) as Pending) : null;
  } catch {
    pending = null;
  }
  const role = (sessions[0]?.role === "creator" ? "creator" : "member") as Role;

  const creatorRows = await sql<CreatorRow>`select * from creators order by created_at`;
  const planRows = await sql<{
    id: string;
    creator_id: string;
    name: string;
    description: string;
    interval: Plan["interval"];
    price_usd: number;
    is_active: boolean;
    sort_order: number;
  }>`select * from plans order by sort_order`;
  const memberRows = await sql<{
    id: string;
    creator_id: string;
    user_id: string | null;
    telegram_user_id: string;
    telegram_username: string | null;
    display_name: string | null;
    status: Member["status"];
    invite_token: string | null;
    invite_url: string | null;
    joined_at: string | null;
    removed_at: string | null;
    remove_reason: string | null;
  }>`select * from telegram_members`;
  const subRows = await sql<{
    id: string;
    user_id: string;
    creator_id: string;
    plan_id: string;
    status: Subscription["status"];
    auto_renew: boolean;
    current_period_start: string | null;
    current_period_end: string | null;
    telegram_username: string | null;
    retry_count: number;
    card_failing: boolean;
  }>`select * from subscriptions`;
  const payRows = await sql<{
    id: string;
    user_id: string;
    creator_id: string;
    subscription_id: string | null;
    plan_id: string;
    amount: number;
    currency: string;
    charged_minor: number;
    provider: string;
    provider_ref: string | null;
    status: Payment["status"];
    platform_fee: number;
    creator_payout: number;
    settlement_status: Payment["settlement"];
    created_at: string;
  }>`select * from payments order by created_at desc`;
  const kwRows = await sql<{
    id: string;
    creator_id: string;
    keyword: string;
    action: Keyword["action"];
  }>`select * from keyword_filters`;
  const modRows = await sql<{
    id: string;
    creator_id: string;
    telegram_username: string | null;
    message_text: string;
    classification: ModEvent["classification"];
    confidence: number | null;
    action: ModEvent["action"];
    created_at: string;
  }>`select * from moderation_events order by created_at desc limit 40`;
  const reminded = await sql<{ subscription_id: string }>`select subscription_id from reminders`;

  const communities = creatorRows.map(toCommunity);
  const plans: Plan[] = planRows.map((p) => ({
    id: p.id,
    communityId: p.creator_id,
    name: p.name,
    description: p.description,
    interval: p.interval,
    priceUsd: p.price_usd,
    isActive: p.is_active,
    sortOrder: p.sort_order,
  }));
  const members: Member[] = memberRows.map((m) => ({
    id: m.id,
    communityId: m.creator_id,
    userId: m.user_id ?? m.telegram_user_id,
    username: m.telegram_username ?? "member",
    name: m.display_name ?? m.telegram_username ?? "Member",
    telegramUserId: m.telegram_user_id,
    status: m.status,
    inviteToken: m.invite_token ?? "",
    inviteUrl: m.invite_url ?? "",
    joinedAt: m.joined_at,
    removedAt: m.removed_at,
    removeReason: m.remove_reason,
  }));
  const subscriptions: Subscription[] = subRows.map((s) => ({
    id: s.id,
    communityId: s.creator_id,
    planId: s.plan_id,
    userId: s.user_id,
    username: s.telegram_username ?? "",
    status: s.status,
    autoRenew: s.auto_renew,
    periodStart: s.current_period_start ?? new Date().toISOString(),
    periodEnd: s.current_period_end ?? new Date().toISOString(),
    retryCount: s.retry_count,
    cardFailing: s.card_failing,
  }));
  const payments: Payment[] = payRows.map((p) => ({
    id: p.id,
    communityId: p.creator_id,
    subscriptionId: p.subscription_id ?? "",
    planId: p.plan_id,
    userId: p.user_id,
    amount: p.amount,
    currency: (p.currency as Currency) || "USD",
    chargedMinor: p.charged_minor,
    provider: (["card", "transfer", "mobile_money", "paypal", "stripe"].includes(p.provider)
      ? p.provider
      : "card") as Provider,
    providerRef: p.provider_ref,
    status: p.status,
    platformFee: p.platform_fee,
    creatorPayout: p.creator_payout,
    settlement: p.settlement_status,
    createdAt: p.created_at,
  }));
  const keywords: Keyword[] = kwRows.map((k) => ({
    id: k.id,
    communityId: k.creator_id,
    keyword: k.keyword,
    action: k.action,
  }));
  const modEvents: ModEvent[] = modRows.map((e) => ({
    id: e.id,
    communityId: e.creator_id,
    username: e.telegram_username ?? "",
    text: e.message_text,
    classification: e.classification,
    confidence: e.confidence ?? 0,
    action: e.action,
    reason: "",
    at: e.created_at,
  }));

  return {
    actor,
    role,
    actingAs: "self",
    pending,
    communities,
    plans,
    members,
    subscriptions,
    payments,
    keywords,
    modEvents,
    reminded: reminded.map((r) => r.subscription_id),
    now: Date.now(),
  };
}

export async function saveSession(actorId: string, pending: Pending, role: Role) {
  const sql = await getSql();
  await sql`
    update telegram_accounts set
      pending_json = ${pending ? JSON.stringify(pending) : null},
      role = ${role}
    where user_id = ${actorId}
  `;
}
