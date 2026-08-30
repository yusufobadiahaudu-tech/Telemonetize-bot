import { useLayoutEffect, useRef } from "react";
import { ArrowLeft, MoreVertical } from "lucide-react";
import { BOT_CHAT_ID } from "@/lib/constants";
import { submitCallback } from "@/lib/bot/engine";
import { dayLabel } from "@/lib/format";
import { useApp } from "@/lib/store";
import { Avatar } from "./Avatar";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";

export function ChatView() {
  const selectedChatId = useApp((s) => s.selectedChatId);
  const chats = useApp((s) => s.chats);
  const messages = useApp((s) => s.messages);
  const typing = useApp((s) => s.typing);
  const setListOpen = useApp((s) => s.setListOpen);
  const isMemberOf = useApp((s) => s.isMemberOf);
  const communities = useApp((s) => s.communities);
  const me = useApp((s) => s.me());
  const scroller = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const chat = chats.find((c) => c.id === selectedChatId);
  const list = messages[selectedChatId] ?? [];
  const community = communities.find((c) => c.chatId === selectedChatId);
  const canPost =
    !community ||
    community.ownerId === me.id ||
    isMemberOf(community.id) ||
    selectedChatId === BOT_CHAT_ID;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [list, typing, selectedChatId]);

  if (!chat) return null;

  const grouped: { key: string; items: typeof list }[] = [];
  for (const msg of list) {
    const key = dayLabel(msg.at);
    const last = grouped.at(-1);
    if (last && last.key === key) last.items.push(msg);
    else grouped.push({ key, items: [msg] });
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-chat">
      <header className="flex items-center gap-2 border-b border-border bg-surface px-2 py-2">
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center text-fg md:hidden"
          aria-label="Back to chats"
          onClick={() => setListOpen(true)}
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} />
        </button>
        <Avatar name={chat.title} bot={chat.kind === "bot"} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{chat.title}</p>
          <p className="truncate text-xs text-success">
            {chat.kind === "bot" ? "bot · online" : chat.subtitle}
          </p>
        </div>
        <span className="inline-flex size-11 items-center justify-center text-muted">
          <MoreVertical className="size-5" strokeWidth={1.75} />
        </span>
      </header>

      <div ref={scroller} className="chat-wallpaper min-h-0 flex-1 overflow-y-auto py-3">
        {grouped.map((g) => (
          <div key={g.key} className="mb-3">
            <p className="mx-auto mb-3 w-fit rounded-full bg-elevated/80 px-3 py-1 text-[11px] text-muted">
              {g.key}
            </p>
            <div className="flex flex-col gap-2">
              {g.items.map((m) => (
                <MessageBubble key={m.id} message={m} group={chat.kind !== "bot"} />
              ))}
            </div>
          </div>
        ))}
        {typing && selectedChatId === BOT_CHAT_ID ? (
          <div className="flex justify-start px-3">
            <div className="flex items-center gap-1 rounded-lg rounded-bl-xs bg-bubble-in px-3 py-3">
              <span className="typing-dot size-1.5 rounded-full bg-muted" />
              <span className="typing-dot size-1.5 rounded-full bg-muted" />
              <span className="typing-dot size-1.5 rounded-full bg-muted" />
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} className="h-px" />
      </div>

      {!canPost && community ? (
        <div className="border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => void submitCallback(`community:${community.code}`)}
            className="flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg active:scale-[0.96]"
          >
            Subscribe to {community.name}
          </button>
        </div>
      ) : (
        <Composer />
      )}
    </section>
  );
}
