import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Mark } from "@/components/logo";
import { submitCallback } from "@/lib/bot/engine";
import { BOT_CHAT_ID } from "@/lib/constants";
import { clock } from "@/lib/format";
import { ADAEZE, YOU } from "@/lib/seed";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

export function Sidebar() {
  const [query, setQuery] = useState("");
  const chats = useApp((s) => s.chats);
  const selected = useApp((s) => s.selectedChatId);
  const selectChat = useApp((s) => s.selectChat);
  const messages = useApp((s) => s.messages);
  const communities = useApp((s) => s.communities);
  const role = useApp((s) => s.role);
  const actingAs = useApp((s) => s.actingAs);
  const setRole = useApp((s) => s.setRole);
  const setActingAs = useApp((s) => s.setActingAs);
  const resetDemo = useApp((s) => s.resetDemo);
  const me = role === "creator" && actingAs === "adaeze" ? ADAEZE : YOU;

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return chats;
    return chats.filter((c) => c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
  }, [chats, q]);

  const hits = useMemo(() => {
    if (q.length < 2) return [];
    return communities.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.slug.includes(q),
    );
  }, [communities, q]);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-surface md:w-80 md:shrink-0 md:border-r md:border-border lg:w-96">
      <header className="flex items-center gap-3 px-4 pt-3 pb-3">
        <Link to="/" aria-label="Home">
          <Mark className="size-8" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-semibold tracking-tight">@TeleMonetizeBot</p>
          <p className="truncate text-xs text-muted">as @{me.username}</p>
        </div>
      </header>

      <div className="px-3 pb-3">
        <div className="grid grid-cols-2 rounded-lg bg-elevated p-1">
          <button
            type="button"
            onClick={() => {
              setActingAs("self");
              setRole("member");
            }}
            className={cn(
              "min-h-11 rounded-md px-2 text-xs font-medium transition-colors duration-150",
              role === "member" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => {
              setActingAs("self");
              setRole("creator");
            }}
            className={cn(
              "min-h-11 rounded-md px-2 text-xs font-medium transition-colors duration-150",
              role === "creator" && actingAs === "self" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            Creator
          </button>
        </div>
      </div>

      <div className="px-3 pb-2">
        <label className="flex h-11 items-center gap-2 rounded-lg bg-elevated px-3 text-muted">
          <Search className="size-4 shrink-0" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ID or group name"
            aria-label="Search chats and creator IDs"
            className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
          />
        </label>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Chats">
        {hits.length > 0 ? (
          <div className="mb-3">
            <p className="px-2 pb-1 text-xs text-subtle">Creator IDs</p>
            {hits.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  selectChat(BOT_CHAT_ID);
                  void submitCallback(`community:${c.code}`);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-elevated/60"
              >
                <Avatar name={c.name} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.code}</span>
                  <span className="block truncate text-sm text-muted">{c.name}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {filtered.map((chat) => {
          const last = (messages[chat.id] ?? []).at(-1);
          const active = selected === chat.id;
          return (
            <button
              key={chat.id}
              type="button"
              onClick={() => selectChat(chat.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors duration-150",
                active ? "bg-elevated" : "hover:bg-elevated/60",
              )}
            >
              <Avatar name={chat.title} bot={chat.kind === "bot"} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{chat.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-subtle">
                    {last ? clock(last.at) : ""}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-muted">
                    {last?.text.split("\n")[0] ?? chat.subtitle}
                  </span>
                  {chat.unread > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-medium text-accent-fg tabular-nums">
                      {chat.unread}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            setActingAs("adaeze");
            setRole("creator");
            selectChat(BOT_CHAT_ID);
            void submitCallback("as_adaeze");
          }}
          className="text-xs text-muted transition-colors duration-150 hover:text-fg"
        >
          Adaeze’s desk
        </button>
        <button
          type="button"
          onClick={() => resetDemo()}
          className="text-xs text-muted transition-colors duration-150 hover:text-fg"
        >
          Reset demo
        </button>
      </footer>
    </aside>
  );
}
