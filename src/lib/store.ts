import { create } from "zustand";
import { BOT_CHAT_ID } from "./constants";
import { nid } from "./utils";
import { periodEnd, splitAmounts } from "./format";
import { bankByCode, digitsOnly, isNuban } from "./banks";
import type { Currency } from "./currency";
import { usdToMinor } from "./currency";
import {
  ADAEZE,
  BOT,
  SEED_CHATS,
  SEED_COMMUNITIES,
  SEED_KEYWORDS,
  SEED_LOGS,
  SEED_MEMBERS,
  SEED_MOD,
  SEED_PAYMENTS,
  SEED_PLANS,
  SEED_SUBS,
  SEED_WELCOME,
  YOU,
  seedGroupMessages,
} from "./seed";
import { classifyLocal } from "./moderation";
import type {
  BotLog,
  Chat,
  ChatMessage,
  Community,
  InlineBtn,
  Keyword,
  LoopResult,
  Member,
  ModEvent,
  Payment,
  Pending,
  Person,
  Plan,
  Provider,
  Role,
  Subscription,
} from "./types";

export type AppState = {
  role: Role;
  actingAs: "self" | "adaeze";
  selectedChatId: string;
  listOpen: boolean;
  typing: boolean;
  pending: Pending;
  chats: Chat[];
  messages: Record<string, ChatMessage[]>;
  communities: Community[];
  plans: Plan[];
  members: Member[];
  subscriptions: Subscription[];
  payments: Payment[];
  keywords: Keyword[];
  modEvents: ModEvent[];
  logs: BotLog[];
  reminded: string[];
};

type AppActions = {
  me: () => Person;
  selectChat: (id: string) => void;
  setListOpen: (open: boolean) => void;
  setRole: (role: Role) => void;
  setActingAs: (who: "self" | "adaeze") => void;
  setPending: (pending: Pending) => void;
  setTyping: (typing: boolean) => void;
  resetDemo: () => void;
  pushMe: (text: string) => void;
  pushBot: (text: string, buttons?: InlineBtn[][], kind?: ChatMessage["kind"]) => void;
  pushSystem: (chatId: string, text: string) => void;
  pushMember: (chatId: string, author: Person, text: string) => ChatMessage;
  ownedCommunity: () => Community | undefined;
  communityBySlug: (slug: string) => Community | undefined;
  mySeats: () => { member: Member; sub: Subscription | undefined; plan: Plan | undefined; community: Community }[];
  isMemberOf: (communityId: string) => boolean;
  log: (communityId: string, event: string, message: string) => void;
  subscribe: (
    planId: string,
    provider: Provider,
    currency?: Currency,
  ) => { ok: true; inviteUrl: string; community: Community; plan: Plan } | { ok: false; error: string };
  kick: (username: string, reason?: string) => string;
  extend: (username: string, days: number) => string;
  connectBank: (bankCode: string, accountNumber: string) => string;
  disconnectBank: () => string;
  createCommunity: (
    name: string,
    monthlyUsd: number,
    platformPlan?: "trial" | "pro",
    payout?: { bankCode: string; accountNumber: string },
  ) => Community;
  addPlan: (name: string, monthlyUsd: number) => Plan;
  addFilter: (keyword: string, action: Keyword["action"]) => void;
  runLoop: () => LoopResult;
  moderateText: (communityId: string, author: Person, text: string) => ModEvent;
};

const initial = (): AppState => ({
  role: "member",
  actingAs: "self",
  selectedChatId: BOT_CHAT_ID,
  listOpen: false,
  typing: false,
  pending: null,
  chats: SEED_CHATS,
  messages: {
    [BOT_CHAT_ID]: [SEED_WELCOME],
    chat_lagos: seedGroupMessages().filter((m) => m.chatId === "chat_lagos"),
    chat_nolly: seedGroupMessages().filter((m) => m.chatId === "chat_nolly"),
  },
  communities: SEED_COMMUNITIES,
  plans: SEED_PLANS,
  members: SEED_MEMBERS,
  subscriptions: SEED_SUBS,
  payments: SEED_PAYMENTS,
  keywords: SEED_KEYWORDS,
  modEvents: SEED_MOD,
  logs: SEED_LOGS,
  reminded: ["sub_la_01"],
});

function bumpChat(chats: Chat[], id: string, subtitle?: string, unread = false): Chat[] {
  return chats.map((c) =>
    c.id === id
      ? { ...c, subtitle: subtitle ?? c.subtitle, unread: unread ? c.unread + 1 : c.unread }
      : c,
  );
}

export const useApp = create<AppState & AppActions>()((set, get) => ({
      ...initial(),

      me: () => (get().role === "creator" && get().actingAs === "adaeze" ? ADAEZE : YOU),

      selectChat: (id) =>
        set((s) => ({
          selectedChatId: id,
          listOpen: false,
          chats: s.chats.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
        })),

      setListOpen: (listOpen) => set({ listOpen }),
      setRole: (role) => set({ role, pending: null }),
      setActingAs: (actingAs) => set({ actingAs, pending: null }),
      setPending: (pending) => set({ pending }),
      setTyping: (typing) => set({ typing }),

      resetDemo: () => set({ ...initial(), role: get().role }),

      pushMe: (text) => {
        const me = get().me();
        const chatId = get().selectedChatId;
        const msg: ChatMessage = {
          id: nid("msg"),
          chatId,
          from: "me",
          author: me,
          text,
          at: Date.now(),
          status: "sent",
        };
        set((s) => ({
          messages: { ...s.messages, [chatId]: [...(s.messages[chatId] ?? []), msg] },
          chats: bumpChat(s.chats, chatId, text),
        }));
      },

      pushBot: (text, buttons, kind = "text") => {
        const msg: ChatMessage = {
          id: nid("msg"),
          chatId: BOT_CHAT_ID,
          from: "bot",
          author: BOT,
          text,
          at: Date.now(),
          buttons,
          kind,
          status: "read",
        };
        set((s) => ({
          messages: {
            ...s.messages,
            [BOT_CHAT_ID]: [...(s.messages[BOT_CHAT_ID] ?? []), msg],
          },
          chats: bumpChat(
            s.chats,
            BOT_CHAT_ID,
            text.split("\n")[0],
            s.selectedChatId !== BOT_CHAT_ID,
          ),
        }));
      },

      pushSystem: (chatId, text) => {
        const msg: ChatMessage = {
          id: nid("sys"),
          chatId,
          from: "system",
          text,
          at: Date.now(),
          kind: "system",
        };
        set((s) => ({
          messages: { ...s.messages, [chatId]: [...(s.messages[chatId] ?? []), msg] },
        }));
      },

      pushMember: (chatId, author, text) => {
        const msg: ChatMessage = {
          id: nid("msg"),
          chatId,
          from: author.id === get().me().id ? "me" : "member",
          author,
          text,
          at: Date.now(),
        };
        set((s) => ({
          messages: { ...s.messages, [chatId]: [...(s.messages[chatId] ?? []), msg] },
          chats: bumpChat(s.chats, chatId, text, s.selectedChatId !== chatId),
        }));
        return msg;
      },

      ownedCommunity: () => {
        const me = get().me();
        return get().communities.find((c) => c.ownerId === me.id);
      },

      communityBySlug: (slug) => {
        const q = slug.trim().toLowerCase().replace(/^\//, "");
        if (!q) return undefined;
        const list = get().communities;
        const exact = list.find(
          (c) =>
            c.slug === q ||
            c.code.toLowerCase() === q ||
            c.name.toLowerCase() === q ||
            c.id === slug,
        );
        if (exact) return exact;
        if (q.length < 3) return undefined;
        const hits = list.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.slug.includes(q) ||
            c.code.toLowerCase().includes(q),
        );
        if (hits.length === 0) return undefined;
        const starts = hits.find(
          (c) => c.name.toLowerCase().startsWith(q) || c.code.toLowerCase().startsWith(q),
        );
        return starts ?? hits[0];
      },

      mySeats: () => {
        const me = get().me();
        return get()
          .members.filter((m) => m.userId === me.id && m.status !== "removed")
          .map((member) => {
            const community = get().communities.find((c) => c.id === member.communityId)!;
            const sub = get().subscriptions.find(
              (s) => s.userId === me.id && s.communityId === member.communityId,
            );
            const plan = get().plans.find((p) => p.id === sub?.planId);
            return { member, sub, plan, community };
          })
          .filter((row) => row.community);
      },

      isMemberOf: (communityId) => {
        const me = get().me();
        return get().members.some(
          (m) => m.communityId === communityId && m.userId === me.id && m.status === "active",
        );
      },

      log: (communityId, event, message) => {
        const entry: BotLog = { id: nid("log"), communityId, event, message, at: new Date().toISOString() };
        set((s) => ({ logs: [entry, ...s.logs].slice(0, 80) }));
      },

      subscribe: (planId, provider, currency = "USD") => {
        const plan = get().plans.find((p) => p.id === planId && p.isActive);
        if (!plan) return { ok: false as const, error: "That plan is gone." };
        const community = get().communities.find((c) => c.id === plan.communityId);
        if (!community) return { ok: false as const, error: "Community not found." };
        if (!community.payoutConnected) {
          return {
            ok: false as const,
            error: `${community.name} (${community.code}) has no payout account yet. Checkout is closed until the creator attaches a bank.`,
          };
        }
        const me = get().me();
        const existing = get().members.find(
          (m) => m.communityId === community.id && m.userId === me.id && m.status === "active",
        );
        if (existing) return { ok: false as const, error: "You already have a seat." };

        const start = new Date();
        const end = periodEnd(plan.interval, start);
        const split = splitAmounts(plan.priceUsd, community.feeBps);
        const token = nid("inv").slice(4);
        const inviteUrl = `https://t.me/+${token}`;
        const subId = nid("sub");
        const member: Member = {
          id: nid("tgm"),
          communityId: community.id,
          userId: me.id,
          username: me.username,
          name: me.name,
          status: "active",
          inviteToken: token,
          inviteUrl,
          joinedAt: start.toISOString(),
          removedAt: null,
          removeReason: null,
        };
        const sub: Subscription = {
          id: subId,
          communityId: community.id,
          planId: plan.id,
          userId: me.id,
          username: me.username,
          status: "active",
          autoRenew: true,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          retryCount: 0,
          cardFailing: false,
        };
        const payment: Payment = {
          id: nid("pay"),
          communityId: community.id,
          subscriptionId: subId,
          planId: plan.id,
          userId: me.id,
          amount: plan.priceUsd,
          currency,
          chargedMinor: usdToMinor(plan.priceUsd, currency),
          provider,
          status: "success",
          platformFee: split.platformFee,
          creatorPayout: split.creatorPayout,
          settlement: split.settlementStatus,
          createdAt: start.toISOString(),
        };
        set((s) => ({
          members: [...s.members, member],
          subscriptions: [
            ...s.subscriptions.filter((x) => !(x.userId === me.id && x.communityId === community.id)),
            sub,
          ],
          payments: [payment, ...s.payments],
        }));
        get().log(
          community.id,
          "join",
          `@${me.username} paid ${plan.name} via ${provider} (${currency}). Invite ${inviteUrl}. Fee ${split.platformFee}¢ to Telegram wallet.`,
        );
        get().pushSystem(community.chatId, `@${me.username} joined ${community.name}.`);
        return { ok: true as const, inviteUrl, community, plan };
      },

      kick: (username, reason = "removed_by_admin") => {
        const community = get().ownedCommunity();
        if (!community) return "Create a community first. Send /studio.";
        const handle = username.replace(/^@/, "").toLowerCase();
        const member = get().members.find(
          (m) =>
            m.communityId === community.id &&
            (m.username.toLowerCase() === handle || m.name.toLowerCase() === handle),
        );
        if (!member) return `No member @${handle} in ${community.name}.`;
        set((s) => ({
          members: s.members.map((m) =>
            m.id === member.id
              ? {
                  ...m,
                  status: "removed" as const,
                  removedAt: new Date().toISOString(),
                  removeReason: reason,
                }
              : m,
          ),
          subscriptions: s.subscriptions.map((sub) =>
            sub.userId === member.userId && sub.communityId === community.id
              ? { ...sub, status: "cancelled" as const, autoRenew: false, cardFailing: false }
              : sub,
          ),
        }));
        get().log(community.id, "kick", `Removed @${member.username} — ${reason.replaceAll("_", " ")}.`);
        get().pushSystem(community.chatId, `Removed @${member.username} — ${reason.replaceAll("_", " ")}.`);
        return `Kicked @${member.username} from ${community.name}.`;
      },

      extend: (username, days) => {
        const community = get().ownedCommunity();
        if (!community) return "Create a community first. Send /studio.";
        const handle = username.replace(/^@/, "").toLowerCase();
        const member = get().members.find(
          (m) => m.communityId === community.id && m.username.toLowerCase() === handle,
        );
        if (!member) return `No member @${handle}.`;
        const sub = get().subscriptions.find(
          (s) => s.communityId === community.id && s.userId === member.userId,
        );
        if (!sub) return `No subscription for @${handle}.`;
        const next = new Date(sub.periodEnd);
        next.setDate(next.getDate() + days);
        set((s) => ({
          subscriptions: s.subscriptions.map((x) =>
            x.id === sub.id
              ? {
                  ...x,
                  status: "active" as const,
                  autoRenew: true,
                  cardFailing: false,
                  retryCount: 0,
                  periodEnd: next.toISOString(),
                }
              : x,
          ),
          members: s.members.map((m) =>
            m.id === member.id
              ? { ...m, status: "active" as const, removedAt: null, removeReason: null }
              : m,
          ),
        }));
        get().log(community.id, "extend", `Extended @${member.username} by ${days} days.`);
        return `Extended @${member.username} by ${days} days. New end ${next.toISOString().slice(0, 10)}.`;
      },

      connectBank: (bankCode, accountNumber) => {
        const community = get().ownedCommunity();
        if (!community) return "Create a community first.";
        const digits = digitsOnly(accountNumber);
        if (!isNuban(digits)) return "Enter a 10-digit NUBAN account number.";
        const bank = bankByCode(bankCode);
        if (!bank) return "Pick a Nigerian bank.";
        const accountName = (community.accountName || get().me().name).toUpperCase();
        set((s) => ({
          communities: s.communities.map((c) =>
            c.id === community.id
              ? {
                  ...c,
                  payoutConnected: true,
                  bankName: bank.name,
                  bankCode: bank.code,
                  accountNumber: digits,
                  accountName,
                }
              : c,
          ),
        }));
        get().log(
          community.id,
          "payout",
          `Account attached to ID ${community.code} · ${bank.name} •••• ${digits.slice(-4)} as ${accountName}. Member money for this ID settles here.`,
        );
        return `ID ${community.code} now pays out to ${bank.name} •••• ${digits.slice(-4)} as ${accountName}. Member money for this ID goes there.`;
      },

      disconnectBank: () => {
        const community = get().ownedCommunity();
        if (!community) return "Create a community first.";
        set((s) => ({
          communities: s.communities.map((c) =>
            c.id === community.id
              ? {
                  ...c,
                  payoutConnected: false,
                  bankName: null,
                  bankCode: null,
                  accountNumber: null,
                  accountName: null,
                }
              : c,
          ),
        }));
        get().log(community.id, "payout", "Bank disconnected. Checkout is closed until an account is attached again.");
        return "Bank disconnected. Checkout is closed until you attach an account again.";
      },

      createCommunity: (name, monthlyUsd, platformPlan = "trial", payout) => {
        const me = get().me();
        const existing = get().communities.find((c) => c.ownerId === me.id);
        if (existing) return existing;
        const slug =
          name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 32) || "my-room";
        const taken = new Set(get().communities.map((c) => c.code.toLowerCase()));
        const letters = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4) || "CRE";
        let code = `${letters}-${nid("id").slice(-3).toUpperCase()}`;
        while (taken.has(code.toLowerCase())) {
          code = `${letters}-${nid("id").slice(-3).toUpperCase()}`;
        }
        const chatId = nid("chat");
        const feeBps = platformPlan === "pro" ? 500 : 800;
        let payoutFields: Pick<
          Community,
          "payoutConnected" | "bankName" | "bankCode" | "accountNumber" | "accountName"
        > = {
          payoutConnected: false,
          bankName: null,
          bankCode: null,
          accountNumber: null,
          accountName: null,
        };
        if (payout) {
          const digits = digitsOnly(payout.accountNumber);
          const bank = bankByCode(payout.bankCode);
          if (isNuban(digits) && bank) {
            payoutFields = {
              payoutConnected: true,
              bankName: bank.name,
              bankCode: bank.code,
              accountNumber: digits,
              accountName: me.name.toUpperCase(),
            };
          }
        }
        const community: Community = {
          id: nid("cre"),
          ownerId: me.id,
          slug,
          code,
          name,
          bio: "Paid Telegram group on TeleMonetize.",
          category: "Community",
          feeBps,
          platformPlan,
          chatId,
          chatType: "group",
          botUsername: "TeleMonetizeBot",
          isPublic: true,
          ...payoutFields,
        };
        const plan: Plan = {
          id: nid("pln"),
          communityId: community.id,
          name: "Monthly",
          description: "Access to the private group.",
          interval: "monthly",
          priceUsd: monthlyUsd,
          isActive: true,
          sortOrder: 1,
        };
        const chat: Chat = {
          id: chatId,
          kind: "group",
          title: name,
          subtitle: `ID ${code}`,
          communityId: community.id,
          unread: 0,
        };
        set((s) => ({
          communities: [...s.communities, community],
          plans: [...s.plans, plan],
          chats: [...s.chats, chat],
          messages: { ...s.messages, [chatId]: [] },
          role: "creator",
          actingAs: "self",
        }));
        get().log(
          community.id,
          "connect",
          `Creator ID ${code} issued for “${name}”. ${platformPlan === "pro" ? "Pro $15/mo at 5%." : "Trial 14 days at 8%."}${
            community.payoutConnected
              ? ` Account ${community.bankName} •••• ${community.accountNumber?.slice(-4)} attached — member money for this ID settles there.`
              : ""
          }`,
        );
        return community;
      },

      addPlan: (name, monthlyUsd) => {
        const community = get().ownedCommunity()!;
        const plan: Plan = {
          id: nid("pln"),
          communityId: community.id,
          name,
          description: `${name} access.`,
          interval: "monthly",
          priceUsd: monthlyUsd,
          isActive: true,
          sortOrder: get().plans.filter((p) => p.communityId === community.id).length + 1,
        };
        set((s) => ({ plans: [...s.plans, plan] }));
        return plan;
      },

      addFilter: (keyword, action) => {
        const community = get().ownedCommunity();
        if (!community) return;
        set((s) => ({
          keywords: [
            ...s.keywords,
            { id: nid("kw"), communityId: community.id, keyword: keyword.toLowerCase(), action },
          ],
        }));
      },

      runLoop: () => {
        const community = get().ownedCommunity();
        const empty: LoopResult = { expired: 0, renewed: 0, retried: 0, warned: 0, kicked: 0, reminded: 0 };
        if (!community) return empty;
        const now = Date.now();
        let result = { ...empty };
        const subs = get().subscriptions.filter(
          (s) => s.communityId === community.id && (s.status === "active" || s.status === "past_due"),
        );

        for (const sub of subs) {
          const plan = get().plans.find((p) => p.id === sub.planId);
          if (!plan) continue;
          const end = new Date(sub.periodEnd).getTime();
          const who = `@${sub.username}`;

          if (end > now) {
            if (end < now + 3 * 86_400_000 && !get().reminded.includes(sub.id)) {
              set((s) => ({ reminded: [...s.reminded, sub.id] }));
              get().log(community.id, "remind", `Sent 3-day expiry reminder to ${who} (${plan.name}).`);
              result.reminded += 1;
            }
            continue;
          }

          if (!sub.autoRenew) {
            set((s) => ({
              subscriptions: s.subscriptions.map((x) =>
                x.id === sub.id ? { ...x, status: "expired" as const, cardFailing: false } : x,
              ),
            }));
            result.expired += 1;
            const kicked = get().kick(sub.username, "renewal_cancelled");
            if (kicked.startsWith("Kicked")) result.kicked += 1;
            continue;
          }

          const failing = sub.cardFailing || sub.status === "past_due";
          if (failing) {
            const next = sub.retryCount + 1;
            const split = splitAmounts(plan.priceUsd, community.feeBps);
            const failPay: Payment = {
              id: nid("pay"),
              communityId: community.id,
              subscriptionId: sub.id,
              planId: plan.id,
              userId: sub.userId,
              amount: plan.priceUsd,
              currency: "USD",
              chargedMinor: plan.priceUsd,
              provider: "card",
              status: "failed",
              platformFee: split.platformFee,
              creatorPayout: 0,
              settlement: "unsplit",
              createdAt: new Date().toISOString(),
            };
            if (next === 1) {
              set((s) => ({
                payments: [failPay, ...s.payments],
                subscriptions: s.subscriptions.map((x) =>
                  x.id === sub.id ? { ...x, status: "past_due" as const, retryCount: 1 } : x,
                ),
              }));
              get().log(community.id, "warn", `Card declined for ${who} (${plan.name}). Retrying. They stay in the group.`);
              result.retried += 1;
              result.warned += 1;
            } else if (next === 2) {
              set((s) => ({
                payments: [failPay, ...s.payments],
                subscriptions: s.subscriptions.map((x) =>
                  x.id === sub.id ? { ...x, status: "past_due" as const, retryCount: 2 } : x,
                ),
              }));
              get().log(community.id, "warn", `Last warning to ${who}: pay today or the bot kicks them.`);
              result.retried += 1;
              result.warned += 1;
            } else {
              set((s) => ({
                payments: [failPay, ...s.payments],
                subscriptions: s.subscriptions.map((x) =>
                  x.id === sub.id
                    ? { ...x, status: "expired" as const, retryCount: next, autoRenew: false }
                    : x,
                ),
              }));
              result.expired += 1;
              const kicked = get().kick(sub.username, "payment_failed");
              if (kicked.startsWith("Kicked")) result.kicked += 1;
            }
            continue;
          }

          if (!community.payoutConnected) {
            set((s) => ({
              subscriptions: s.subscriptions.map((x) =>
                x.id === sub.id
                  ? { ...x, status: "past_due" as const, cardFailing: true, retryCount: x.retryCount + 1 }
                  : x,
              ),
            }));
            get().log(community.id, "warn", `Renewal for ${who} was not charged — connect a bank.`);
            result.retried += 1;
            result.warned += 1;
            continue;
          }

          const start = new Date();
          const nextEnd = periodEnd(plan.interval, start);
          const split = splitAmounts(plan.priceUsd, community.feeBps);
          const okPay: Payment = {
            id: nid("pay"),
            communityId: community.id,
            subscriptionId: sub.id,
            planId: plan.id,
            userId: sub.userId,
            amount: plan.priceUsd,
            currency: "USD",
            chargedMinor: plan.priceUsd,
            provider: "card",
            status: "success",
            platformFee: split.platformFee,
            creatorPayout: split.creatorPayout,
            settlement: "wallet_and_bank",
            createdAt: start.toISOString(),
          };
          set((s) => ({
            payments: [okPay, ...s.payments],
            subscriptions: s.subscriptions.map((x) =>
              x.id === sub.id
                ? {
                    ...x,
                    status: "active" as const,
                    cardFailing: false,
                    retryCount: 0,
                    periodStart: start.toISOString(),
                    periodEnd: nextEnd.toISOString(),
                  }
                : x,
            ),
          }));
          get().log(community.id, "renew", `Auto-renewed ${plan.name} for ${who}.`);
          result.renewed += 1;
        }

        get().log(
          community.id,
          "sync",
          `Loop: ${result.renewed} renewed, ${result.retried} retried, ${result.warned} warned, ${result.expired} expired, ${result.kicked} kicked, ${result.reminded} reminded.`,
        );
        return result;
      },

      moderateText: (communityId, author, text) => {
        const keywords = get().keywords.filter((k) => k.communityId === communityId);
        const result = classifyLocal(text, keywords);
        const event: ModEvent = {
          id: nid("mod"),
          communityId,
          username: author.username,
          text,
          classification: result.classification,
          confidence: result.confidence,
          action: result.action,
          reason: result.reason,
          at: new Date().toISOString(),
        };
        set((s) => ({ modEvents: [event, ...s.modEvents].slice(0, 40) }));
        if (result.action === "removed") {
          get().kick(author.username, "moderation");
          get().log(
            communityId,
            "moderate",
            `Removed @${author.username} — ${result.classification} (${result.reason}).`,
          );
        } else if (result.action === "flagged") {
          get().log(communityId, "moderate", `Flagged @${author.username} — ${result.classification}. ${result.reason}`);
        }
        return event;
      },
    }),
);

