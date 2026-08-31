import type { Currency } from "./currency";
import type { PayoutRail } from "./payouts";

export type Role = "member" | "creator";
export type ChatKind = "bot" | "group" | "channel";
export type MemberStatus = "active" | "pending" | "removed";
export type SubStatus = "active" | "past_due" | "expired" | "cancelled";
export type PayStatus = "success" | "failed" | "pending";
export type Provider = "card" | "transfer" | "mobile_money" | "paypal" | "stripe";
export type Interval = "monthly" | "yearly" | "one_time";
export type FilterAction = "flag" | "remove";
export type ModAction = "none" | "flagged" | "removed";

export type Person = {
  id: string;
  username: string;
  name: string;
};

export type Community = {
  id: string;
  ownerId: string;
  slug: string;
  code: string;
  name: string;
  bio: string;
  category: string;
  feeBps: number;
  platformPlan: "trial" | "starter" | "pro";
  chatId: string;
  chatType: ChatKind;
  telegramChatId: string | null;
  botUsername: string;
  isPublic: boolean;
  payoutConnected: boolean;
  bankName: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
  payoutRail?: PayoutRail | null;
  payoutCountry?: string | null;
  payoutCurrency?: Currency;
  payoutHandle?: string | null;
  fxFeeBps?: number;
};

export type Plan = {
  id: string;
  communityId: string;
  name: string;
  description: string;
  interval: Interval;
  priceUsd: number;
  isActive: boolean;
  sortOrder: number;
};

export type Member = {
  id: string;
  communityId: string;
  userId: string;
  username: string;
  name: string;
  telegramUserId: string | null;
  status: MemberStatus;
  inviteToken: string;
  inviteUrl: string;
  joinedAt: string | null;
  removedAt: string | null;
  removeReason: string | null;
};

export type Subscription = {
  id: string;
  communityId: string;
  planId: string;
  userId: string;
  username: string;
  status: SubStatus;
  autoRenew: boolean;
  periodStart: string;
  periodEnd: string;
  retryCount: number;
  cardFailing: boolean;
};

export type Payment = {
  id: string;
  communityId: string;
  subscriptionId: string;
  planId: string;
  userId: string;
  amount: number;
  currency: Currency;
  chargedMinor: number;
  provider: Provider;
  providerRef: string | null;
  status: PayStatus;
  platformFee: number;
  creatorPayout: number;
  settlement: "wallet_and_bank" | "unsplit" | "pending";
  createdAt: string;
  payoutCurrency?: Currency;
  fxRate?: number;
  fxFeeBps?: number;
  fxFeeMinor?: number;
  payoutMinor?: number;
  rateSource?: "live" | "book";
};

export type Keyword = {
  id: string;
  communityId: string;
  keyword: string;
  action: FilterAction;
};

export type ModEvent = {
  id: string;
  communityId: string;
  username: string;
  text: string;
  classification: "ok" | "spam" | "abuse" | "keyword";
  confidence: number;
  action: ModAction;
  reason: string;
  at: string;
};

export type BotLog = {
  id: string;
  communityId: string;
  event: string;
  message: string;
  at: string;
};

export type InlineBtn = {
  label: string;
  payload: string;
  url?: string;
  tone?: "default" | "primary" | "danger";
};

export type ChatMessage = {
  id: string;
  chatId: string;
  from: "bot" | "me" | "member" | "system";
  author?: Person;
  text: string;
  at: number;
  buttons?: InlineBtn[][];
  kind?: "text" | "receipt" | "invite" | "invoice" | "system";
  status?: "sent" | "read";
};

export type Chat = {
  id: string;
  kind: ChatKind;
  title: string;
  subtitle: string;
  communityId?: string;
  unread: number;
  pinned?: boolean;
};

export type Pending =
  | null
  | { kind: "await_nuban"; bankCode: string }
  | { kind: "await_community_name"; platformPlan: "trial" | "pro" }
  | { kind: "await_community_price"; name: string; platformPlan: "trial" | "pro" }
  | { kind: "await_community_rail"; name: string; priceUsd: number; platformPlan: "trial" | "pro" }
  | { kind: "await_community_country"; name: string; priceUsd: number; platformPlan: "trial" | "pro"; rail: PayoutRail }
  | {
      kind: "await_community_bank";
      name: string;
      priceUsd: number;
      platformPlan: "trial" | "pro";
      rail?: PayoutRail;
      country?: string;
      currency?: Currency;
    }
  | {
      kind: "await_community_nuban";
      name: string;
      priceUsd: number;
      platformPlan: "trial" | "pro";
      bankCode: string;
      rail?: PayoutRail;
      country?: string;
      currency?: Currency;
    }
  | {
      kind: "await_community_handle";
      name: string;
      priceUsd: number;
      platformPlan: "trial" | "pro";
      rail: PayoutRail;
      country: string;
      currency: Currency;
      institution: string;
    }
  | { kind: "await_payout_rail" }
  | { kind: "await_payout_country"; rail: PayoutRail }
  | { kind: "await_payout_handle"; rail: PayoutRail; country: string; currency: Currency; institution: string }
  | { kind: "await_checkout_currency"; planId: string }
  | { kind: "await_pro_currency" }
  | { kind: "await_plan_name" }
  | { kind: "await_plan_price"; name: string }
  | { kind: "await_kick" }
  | { kind: "await_extend_user" }
  | { kind: "await_extend_days"; username: string }
  | { kind: "await_filter" }
  | { kind: "await_scan" };

export type LoopResult = {
  expired: number;
  renewed: number;
  retried: number;
  warned: number;
  kicked: number;
  reminded: number;
};
