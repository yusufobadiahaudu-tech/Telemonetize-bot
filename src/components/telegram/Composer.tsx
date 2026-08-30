import { useEffect, useMemo, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { BOT_CHAT_ID, COMMANDS } from "@/lib/constants";
import { submitCallback, submitUserText } from "@/lib/bot/engine";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

const QUICK_CUSTOMER = [
  { label: "Join a group", payload: "discover" },
  { label: "I run a group", payload: "become_creator" },
  { label: "My seats", payload: "my" },
  { label: "How it works", payload: "help" },
];

const QUICK_OPERATOR = [
  { label: "Join a group", payload: "discover" },
  { label: "I run a group", payload: "become_creator" },
  { label: "Your take", payload: "take" },
  { label: "How it works", payload: "help" },
];

export function Composer() {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const role = useApp((s) => s.role);
  const chatId = useApp((s) => s.selectedChatId);
  const isBot = chatId === BOT_CHAT_ID;

  const suggestions = useMemo(() => {
    if (!value.startsWith("/")) return [];
    const q = value.toLowerCase();
    return COMMANDS.filter((c) => {
      if (role === "member" && c.who === "creator") return false;
      return c.cmd.startsWith(q);
    }).slice(0, 6);
  }, [value, role]);

  useEffect(() => {
    ref.current?.focus();
  }, [chatId]);

  async function send(text = value) {
    const next = text.trim();
    if (!next) return;
    setValue("");
    await submitUserText(next);
  }

  return (
    <div className="relative border-t border-border bg-surface px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {isBot ? (
        <div className="mb-2 flex gap-1 overflow-x-auto px-1">
          {(role === "member" ? QUICK_CUSTOMER : QUICK_OPERATOR).map((q) => (
            <button
              key={q.payload}
              type="button"
              onClick={() => void submitCallback(q.payload)}
              className="h-9 shrink-0 rounded-md bg-elevated px-3 text-sm font-medium text-fg transition-colors duration-150 hover:bg-elevated/80 active:scale-[0.96]"
            >
              {q.label}
            </button>
          ))}
        </div>
      ) : null}
      {suggestions.length > 0 ? (
        <ul className="absolute inset-x-2 bottom-full mb-1 overflow-hidden rounded-lg bg-elevated shadow-[var(--shadow-border)]">
          {suggestions.map((s) => (
            <li key={s.cmd}>
              <button
                type="button"
                onClick={() => void send(s.cmd)}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface"
              >
                <span className="font-mono text-sm text-accent">{s.cmd}</span>
                <span className="truncate text-xs text-muted">{s.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex items-end gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isBot ? "ID or group name · @TeleMonetizeBot" : "Message"}
          aria-label="Message"
          suppressHydrationWarning
          className="min-h-11 min-w-0 flex-1 rounded-md bg-elevated px-3 py-2.5 text-[15px] text-fg outline-none placeholder:text-subtle"
          autoComplete="off"
          autoCorrect="off"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="Send"
          className={cn(
            "mb-0 inline-flex size-11 items-center justify-center rounded-full transition-colors duration-150 active:scale-[0.96]",
            value.trim() ? "bg-accent text-accent-fg" : "text-subtle",
          )}
        >
          <SendHorizonal className="size-5" strokeWidth={1.75} />
        </button>
      </form>
    </div>
  );
}
