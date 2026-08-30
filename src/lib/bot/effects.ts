import type { Currency } from "@/lib/currency";
import type {
  Community,
  FilterAction,
  InlineBtn,
  Plan,
  Provider,
  Role,
} from "@/lib/types";
import type { Pending } from "@/lib/types";

export type BotReply = {
  text: string;
  buttons?: InlineBtn[][];
  kind?: "text" | "receipt" | "invite" | "invoice";
};

export type BotEvent = { type: "input"; text: string } | { type: "callback"; payload: string };

export type Effect =
  | { type: "checkout"; planId: string; currency: Currency; provider: Provider }
  | { type: "checkout_pro"; currency: Currency; provider: Provider }
  | { type: "fulfill"; reference: string }
  | { type: "kick"; username: string; reason?: string }
  | { type: "extend"; username: string; days: number }
  | { type: "fail_card"; username: string }
  | {
      type: "create_community";
      name: string;
      priceUsd: number;
      platformPlan: "trial" | "pro";
      bankCode: string;
      accountNumber: string;
    }
  | { type: "connect_bank"; bankCode: string; accountNumber: string }
  | { type: "add_plan"; name: string; priceUsd: number }
  | { type: "add_filter"; keyword: string; action: FilterAction }
  | { type: "scan"; text: string }
  | { type: "run_loop" }
  | { type: "open_chat"; chatId: string }
  | { type: "log"; communityId: string; event: string; message: string };

export type ReduceResult = {
  pending: Pending;
  role: Role;
  actingAs: "self" | "adaeze";
  replies: BotReply[];
  effects: Effect[];
};

export type CreatedCommunity = { community: Community; plan: Plan };
