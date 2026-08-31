import { BOT_CHAT_ID } from "./constants";
import type {
  BotLog,
  Chat,
  ChatMessage,
  Community,
  Keyword,
  Member,
  ModEvent,
  Payment,
  Person,
  Plan,
  Subscription,
} from "./types";

const now = Date.parse("2026-08-30T15:00:00.000Z");
const day = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

export const YOU: Person = {
  id: "900001",
  username: "you",
  name: "You",
};

export const ADAEZE: Person = {
  id: "600001",
  username: "adaeze_alpha",
  name: "Adaeze Okonkwo",
};

export const KEMI: Person = {
  id: "600002",
  username: "kemi_nolly",
  name: "Kemi Adeyemi",
};

export const BOT: Person = {
  id: "bot",
  username: "TeleMonetizeBot",
  name: "TeleMonetize",
};

export const SEED_WELCOME: ChatMessage = {
  id: "msg_welcome",
  chatId: BOT_CHAT_ID,
  from: "bot",
  author: BOT,
  text: "You own this bot.\n\nCreators subscribe and get an ID — like LA-ADA. They bind a group name and a bank account to that ID. Member money for the ID goes to that account. Your percentage credits your Telegram wallet.\n\nCustomers send the ID or the group name to @TeleMonetizeBot. They pay in dollars — or another currency — by card or bank transfer. I send the join link after Paystack confirms. They never see the split.\n\nIf they do not renew, I kick them. A server cron runs that loop; /loop is a manual override.",
  at: now - 30_000,
  buttons: [
    [
      { label: "Join a group", payload: "discover", tone: "primary" },
      { label: "I run a group", payload: "become_creator" },
    ],
    [
      { label: "Walk Adaeze’s desk", payload: "as_adaeze" },
      { label: "How it works", payload: "help" },
    ],
    [{ label: "Your take", payload: "take" }],
  ],
  kind: "text",
  status: "read",
};

export const SEED_COMMUNITIES: Community[] = [
  {
    id: "cre_lagos_alpha",
    ownerId: ADAEZE.id,
    slug: "lagos-alpha",
    code: "LA-ADA",
    name: "Lagos Alpha Circle",
    bio: "Private research desk for Nigerian equities, FX, and alternatives. Daily setups, weekend recaps, and a members-only alerts channel.",
    category: "Trading",
    feeBps: 500,
    platformPlan: "pro",
    chatId: "chat_lagos",
    chatType: "group",
    telegramChatId: "-1001",
    botUsername: "TeleMonetizeBot",
    isPublic: true,
    payoutConnected: true,
    bankName: "Guaranty Trust Bank",
    bankCode: "058",
    accountNumber: "0123444421",
    accountName: "ADAEZE OKONKWO",
    payoutRail: "bank",
    payoutCountry: "NG",
    payoutCurrency: "NGN",
    payoutHandle: "0123444421",
    fxFeeBps: 150,
  },
  {
    id: "cre_nolly",
    ownerId: KEMI.id,
    slug: "nolly-unlocked",
    code: "NOLLY",
    name: "Nollywood Unlocked",
    bio: "Early screeners, director AMAs, and festival tickets for the inner circle of West African film.",
    category: "Entertainment",
    feeBps: 1000,
    platformPlan: "starter",
    chatId: "chat_nolly",
    chatType: "channel",
    telegramChatId: "-1002",
    botUsername: "TeleMonetizeBot",
    isPublic: true,
    payoutConnected: true,
    bankName: "Zenith Bank",
    bankCode: "057",
    accountNumber: "2088123340",
    accountName: "KEMI ADEYEMI",
    payoutRail: "bank",
    payoutCountry: "NG",
    payoutCurrency: "NGN",
    payoutHandle: "2088123340",
    fxFeeBps: 150,
  },
];

export const SEED_PLANS: Plan[] = [
  {
    id: "pln_la_basic",
    communityId: "cre_lagos_alpha",
    name: "Basic",
    description: "Daily market brief and weekend recap.",
    interval: "monthly",
    priceUsd: 500,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "pln_la_premium",
    communityId: "cre_lagos_alpha",
    name: "Premium",
    description: "Live trade alerts, watchlists, and the private research group.",
    interval: "monthly",
    priceUsd: 1500,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: "pln_la_vip",
    communityId: "cre_lagos_alpha",
    name: "VIP Desk",
    description: "Direct desk access, monthly office hours, priority alerts.",
    interval: "yearly",
    priceUsd: 18000,
    isActive: true,
    sortOrder: 3,
  },
  {
    id: "pln_nu_circle",
    communityId: "cre_nolly",
    name: "Inner Circle",
    description: "Screener drops and member AMAs.",
    interval: "monthly",
    priceUsd: 400,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "pln_nu_patron",
    communityId: "cre_nolly",
    name: "Patron",
    description: "Festival tickets pool plus a yearly director salon.",
    interval: "yearly",
    priceUsd: 4000,
    isActive: true,
    sortOrder: 2,
  },
];

export const SEED_MEMBERS: Member[] = [
  member("tgm_la_01", "cre_lagos_alpha", "701001", "chinedu_fx", "Chinedu Okafor", "active", now - 40 * day),
  member("tgm_la_02", "cre_lagos_alpha", "701002", "zainab_mkt", "Zainab Bello", "active", now - 28 * day),
  member("tgm_la_03", "cre_lagos_alpha", "701003", "tunde_alpha", "Tunde Bakare", "active", now - 18 * day),
  member("tgm_la_04", "cre_lagos_alpha", "701004", "amaka_eq", "Amaka Eze", "active", now - 12 * day),
  member("tgm_la_05", "cre_lagos_alpha", "701005", "ibrahim_ngn", "Ibrahim Musa", "active", now - 9 * day),
  {
    ...member("tgm_la_06", "cre_lagos_alpha", "701006", "folake_desk", "Folake Adeyemi", "removed", now - 60 * day),
    removedAt: iso(now - 4 * day),
    removeReason: "subscription_expired",
  },
  member("tgm_la_07", "cre_lagos_alpha", "701007", "kelvin_opt", "Kelvin Mensah", "active", now - 6 * day),
  member("tgm_nu_01", "cre_nolly", "801001", "bisi_films", "Bisi Adebayo", "active", now - 21 * day),
  member("tgm_nu_02", "cre_nolly", "801002", "david_screen", "David Okoro", "active", now - 14 * day),
  {
    ...member("tgm_nu_03", "cre_nolly", "801003", "lola_ama", "Lola Shittu", "pending", now - 1 * day),
    joinedAt: null,
  },
];

function member(
  id: string,
  communityId: string,
  userId: string,
  username: string,
  name: string,
  status: Member["status"],
  joined: number,
): Member {
  return {
    id,
    communityId,
    userId,
    username,
    name,
    telegramUserId: userId,
    status,
    inviteToken: id.replace("tgm_", "inv_"),
    inviteUrl: `https://t.me/+${id.replace("tgm_", "inv_")}`,
    joinedAt: status === "pending" ? null : iso(joined),
    removedAt: null,
    removeReason: null,
  };
}

export const SEED_SUBS: Subscription[] = [
  sub("sub_la_01", "cre_lagos_alpha", "pln_la_premium", "701001", "chinedu_fx", "active", true, 20, -10),
  sub("sub_la_02", "cre_lagos_alpha", "pln_la_basic", "701002", "zainab_mkt", "active", true, 8, -22),
  sub("sub_la_03", "cre_lagos_alpha", "pln_la_vip", "701003", "tunde_alpha", "active", true, 80, -285),
  sub("sub_la_04", "cre_lagos_alpha", "pln_la_premium", "701004", "amaka_eq", "active", true, 2, -28),
  sub("sub_la_05", "cre_lagos_alpha", "pln_la_basic", "701005", "ibrahim_ngn", "past_due", false, 35, 5, 1, true),
  sub("sub_la_06", "cre_lagos_alpha", "pln_la_premium", "701006", "folake_desk", "expired", false, 64, 4),
  sub("sub_la_07", "cre_lagos_alpha", "pln_la_premium", "701007", "kelvin_opt", "active", true, 6, -24),
  sub("sub_nu_01", "cre_nolly", "pln_nu_circle", "801001", "bisi_films", "active", true, 10, -20),
  sub("sub_nu_02", "cre_nolly", "pln_nu_patron", "801002", "david_screen", "active", true, 40, -325),
];

function sub(
  id: string,
  communityId: string,
  planId: string,
  userId: string,
  username: string,
  status: Subscription["status"],
  autoRenew: boolean,
  startDaysAgo: number,
  endDaysFromNow: number,
  retryCount = 0,
  cardFailing = false,
): Subscription {
  return {
    id,
    communityId,
    planId,
    userId,
    username,
    status,
    autoRenew,
    periodStart: iso(now - startDaysAgo * day),
    periodEnd: iso(now - endDaysFromNow * day),
    retryCount,
    cardFailing,
  };
}

export const SEED_PAYMENTS: Payment[] = [
  pay("pay_la_01", "cre_lagos_alpha", "sub_la_01", "pln_la_premium", "701001", 1500, "card", "USD", 1500, "success", 75, 1425, "wallet_and_bank", 40),
  pay("pay_la_02", "cre_lagos_alpha", "sub_la_01", "pln_la_premium", "701001", 1500, "card", "USD", 1500, "success", 75, 1425, "wallet_and_bank", 20),
  pay("pay_la_03", "cre_lagos_alpha", "sub_la_02", "pln_la_basic", "701002", 500, "transfer", "NGN", 775000, "success", 25, 475, "wallet_and_bank", 28),
  pay("pay_la_07", "cre_lagos_alpha", "sub_la_05", "pln_la_basic", "701005", 500, "card", "USD", 500, "failed", 0, 0, "unsplit", 5),
  pay("pay_nu_01", "cre_nolly", "sub_nu_01", "pln_nu_circle", "801001", 400, "transfer", "USD", 400, "success", 40, 360, "wallet_and_bank", 21),
];

function pay(
  id: string,
  communityId: string,
  subscriptionId: string,
  planId: string,
  userId: string,
  amount: number,
  provider: Payment["provider"],
  currency: Payment["currency"],
  chargedMinor: number,
  status: Payment["status"],
  platformFee: number,
  creatorPayout: number,
  settlement: Payment["settlement"],
  daysAgo: number,
): Payment {
  return {
    id,
    communityId,
    subscriptionId,
    planId,
    userId,
    amount,
    currency,
    chargedMinor,
    provider,
    providerRef: `PSK_${id.slice(4)}`,
    status,
    platformFee,
    creatorPayout,
    settlement,
    createdAt: iso(now - daysAgo * day),
  };
}

export const SEED_KEYWORDS: Keyword[] = [
  { id: "kw_la_01", communityId: "cre_lagos_alpha", keyword: "guaranteed returns", action: "remove" },
  { id: "kw_la_02", communityId: "cre_lagos_alpha", keyword: "whatsapp me", action: "flag" },
  { id: "kw_la_03", communityId: "cre_lagos_alpha", keyword: "pump", action: "flag" },
  { id: "kw_nu_01", communityId: "cre_nolly", keyword: "free download", action: "remove" },
];

export const SEED_MOD: ModEvent[] = [
  {
    id: "mod_la_01",
    communityId: "cre_lagos_alpha",
    username: "spam_broker",
    text: "Guaranteed 40% returns this week, WhatsApp me for the VIP signal group",
    classification: "spam",
    confidence: 0.96,
    action: "removed",
    reason: "Keyword filter “guaranteed returns”.",
    at: iso(now - 2 * day),
  },
  {
    id: "mod_la_02",
    communityId: "cre_lagos_alpha",
    username: "zainab_mkt",
    text: "Anyone else seeing weakness in DANGCEM at this level?",
    classification: "ok",
    confidence: 0.91,
    action: "none",
    reason: "Ordinary market talk.",
    at: iso(now - 1 * day),
  },
];

export const SEED_LOGS: BotLog[] = [
  { id: "log_la_01", communityId: "cre_lagos_alpha", event: "invite", message: "Generated one-time join link for @kelvin_opt (Premium).", at: iso(now - 6 * day) },
  { id: "log_la_02", communityId: "cre_lagos_alpha", event: "join", message: "@kelvin_opt joined Lagos Alpha Circle via invite.", at: iso(now - 6 * day + 4 * 60_000) },
  { id: "log_la_03", communityId: "cre_lagos_alpha", event: "kick", message: "Removed @folake_desk — subscription expired.", at: iso(now - 4 * day) },
  { id: "log_la_04", communityId: "cre_lagos_alpha", event: "remind", message: "Sent 3-day expiry reminder to @chinedu_fx.", at: iso(now - 1 * day) },
  { id: "log_la_05", communityId: "cre_lagos_alpha", event: "moderate", message: "Removed @spam_broker for spam (guaranteed returns).", at: iso(now - 2 * day) },
];

export const SEED_CHATS: Chat[] = [
  {
    id: BOT_CHAT_ID,
    kind: "bot",
    title: "TeleMonetize",
    subtitle: "Bot · charge, admit, kick",
    pinned: true,
    unread: 0,
  },
  {
    id: "chat_lagos",
    kind: "group",
    title: "Lagos Alpha Circle",
    subtitle: "Private research desk",
    communityId: "cre_lagos_alpha",
    unread: 0,
  },
  {
    id: "chat_nolly",
    kind: "channel",
    title: "Nollywood Unlocked",
    subtitle: "Channel · screeners",
    communityId: "cre_nolly",
    unread: 0,
  },
];

export function seedGroupMessages(): ChatMessage[] {
  return [
    {
      id: "gm_1",
      chatId: "chat_lagos",
      from: "member",
      author: { id: "701002", username: "zainab_mkt", name: "Zainab Bello" },
      text: "Anyone else seeing weakness in DANGCEM at this level?",
      at: now - 3 * 60 * 60_000,
    },
    {
      id: "gm_2",
      chatId: "chat_lagos",
      from: "member",
      author: { id: "701004", username: "amaka_eq", name: "Amaka Eze" },
      text: "Holding GTCO through earnings. Recap was clean.",
      at: now - 2 * 60 * 60_000,
    },
    {
      id: "gm_3",
      chatId: "chat_lagos",
      from: "system",
      text: "Removed @spam_broker — spam filter (guaranteed returns).",
      at: now - 90 * 60_000,
      kind: "system",
    },
    {
      id: "gm_4",
      chatId: "chat_lagos",
      from: "member",
      author: { id: "701001", username: "chinedu_fx", name: "Chinedu Okafor" },
      text: "USD/NGN still bid into the close. Watching the window.",
      at: now - 40 * 60_000,
    },
    {
      id: "gm_n1",
      chatId: "chat_nolly",
      from: "member",
      author: { id: "801001", username: "bisi_films", name: "Bisi Adebayo" },
      text: "Screener for the Lagos festival short dropped in files.",
      at: now - 5 * 60 * 60_000,
    },
  ];
}
