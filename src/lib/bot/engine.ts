import { BOT_CHAT_ID } from "@/lib/constants";
import { useApp } from "@/lib/store";
import type { ChatMessage, InlineBtn } from "@/lib/types";
import { applyClientResult } from "./apply-client";
import { customerWelcome, reduce, startWelcome } from "./fsm";
import type { World } from "./world";

export { startWelcome } from "./fsm";
export type { BotReply as Reply } from "./effects";

function worldFromStore(): World {
  const s = useApp.getState();
  return {
    actor: s.me(),
    role: s.role,
    actingAs: s.actingAs,
    pending: s.pending,
    communities: s.communities,
    plans: s.plans,
    members: s.members,
    subscriptions: s.subscriptions,
    payments: s.payments,
    keywords: s.keywords,
    modEvents: s.modEvents,
    reminded: s.reminded,
    now: Date.now(),
  };
}

function send(replies: { text: string; buttons?: InlineBtn[][]; kind?: ChatMessage["kind"] }[]) {
  const { pushBot } = useApp.getState();
  for (const r of replies) pushBot(r.text, r.buttons, r.kind);
}

export function handleInput(raw: string) {
  return applyClientResult(reduce(worldFromStore(), { type: "input", text: raw }));
}

export function handleCallback(payload: string) {
  return applyClientResult(reduce(worldFromStore(), { type: "callback", payload }));
}

export function handleHelp() {
  return handleInput("/help");
}

export function bootFromIntent(as: "adaeze" | "creator" | "join") {
  const { selectChat, setRole, setActingAs } = useApp.getState();
  selectChat(BOT_CHAT_ID);
  useApp.setState((s) => ({
    messages: { ...s.messages, [BOT_CHAT_ID]: [] },
    pending: null,
  }));
  if (as === "adaeze") {
    setRole("creator");
    setActingAs("adaeze");
    send(handleCallback("studio"));
    return;
  }
  if (as === "creator") {
    send(handleCallback("become_creator"));
    return;
  }
  setRole("member");
  setActingAs("self");
  send(customerWelcome());
  send(handleInput("LA-ADA"));
}

export async function submitUserText(text: string) {
  const { selectedChatId, pushMe, isMemberOf, communities, me, moderateText, pushSystem, setTyping } =
    useApp.getState();
  const trimmed = text.trim();
  if (!trimmed) return;

  if (selectedChatId !== BOT_CHAT_ID) {
    const community = communities.find((c) => c.chatId === selectedChatId);
    if (!community) return;
    const person = me();
    const member = isMemberOf(community.id) || community.ownerId === person.id;
    if (!member) {
      pushMe(trimmed);
      useApp.getState().pushBot(
        `${community.name} is private. Pay on checkout and I send the invite here.`,
        [[{ label: `Join ${community.name}`, payload: `community:${community.code}`, tone: "primary" }]],
      );
      useApp.getState().selectChat(BOT_CHAT_ID);
      return;
    }
    useApp.getState().pushMember(selectedChatId, person, trimmed);
    const event = moderateText(community.id, person, trimmed);
    if (event.action === "removed") {
      pushSystem(selectedChatId, `Removed @${person.username} — ${event.reason}`);
    } else if (event.action === "flagged") {
      pushSystem(selectedChatId, `Flagged @${person.username} — ${event.reason}`);
    }
    return;
  }

  pushMe(trimmed);
  setTyping(true);
  await wait(420);
  const replies = handleInput(trimmed);
  setTyping(false);
  send(replies);
}

export async function submitCallback(payload: string) {
  if (payload.startsWith("openchat:")) {
    useApp.getState().selectChat(payload.slice("openchat:".length));
    return;
  }
  if (payload.startsWith("openpay:")) {
    return;
  }
  const { setTyping } = useApp.getState();
  setTyping(true);
  await wait(280);
  const replies = handleCallback(payload);
  setTyping(false);
  send(replies);
}

export function ensureWelcome() {
  const msgs = useApp.getState().messages[BOT_CHAT_ID] ?? [];
  if (msgs.length > 0) return;
  send(startWelcome());
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
