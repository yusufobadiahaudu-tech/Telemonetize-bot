import { CheckCheck } from "lucide-react";
import { clock } from "@/lib/format";
import { submitCallback } from "@/lib/bot/engine";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

export function MessageBubble({
  message,
  group,
}: {
  message: ChatMessage;
  group?: boolean;
}) {
  if (message.from === "system") {
    return (
      <p className="mx-auto max-w-[22rem] px-4 py-1 text-center text-xs text-muted">{message.text}</p>
    );
  }

  const mine = message.from === "me";
  const bot = message.from === "bot";

  return (
    <div className={cn("flex w-full gap-2 px-3", mine ? "justify-end" : "justify-start")}>
      {!mine && group && message.author ? (
        <Avatar name={message.author.name} bot={bot} size="sm" />
      ) : !mine && bot ? (
        <Avatar name="TeleMonetize" bot size="sm" />
      ) : null}
      <div className={cn("max-w-[min(100%,22rem)] min-w-0", mine ? "items-end" : "items-start")}>
        <div
          className={cn(
            "msg-enter rounded-lg px-3 py-2 shadow-[var(--shadow-border)]",
            mine
              ? "rounded-br-xs bg-bubble-out text-fg"
              : bot
                ? "rounded-bl-xs bg-bubble-in text-fg"
                : "rounded-bl-xs bg-bubble-in text-fg",
          )}
        >
          {!mine && group && message.author ? (
            <p className="mb-0.5 text-xs font-medium text-accent">
              {message.author.name}
              <span className="ml-1 font-normal text-subtle">@{message.author.username}</span>
            </p>
          ) : null}
          <p className="whitespace-pre-wrap text-[15px] leading-snug">{message.text}</p>
          <span className="mt-1 flex items-center justify-end gap-1 text-[11px] text-subtle">
            <span className="font-mono tabular-nums">{clock(message.at)}</span>
            {mine ? <CheckCheck className="size-3.5 text-accent" strokeWidth={2} /> : null}
          </span>
        </div>
        {message.buttons && message.buttons.length > 0 ? (
          <div className="mt-1.5 flex flex-col gap-1">
            {message.buttons.map((row, i) => (
              <div key={i} className="flex flex-wrap gap-1">
                {row.map((btn) => (
                  <button
                    key={btn.payload}
                    type="button"
                    onClick={() => {
                      if (btn.url) {
                        window.open(btn.url, "_blank", "noopener,noreferrer");
                        return;
                      }
                      void submitCallback(btn.payload);
                    }}
                    className={cn(
                      "min-h-10 flex-1 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-150 active:scale-[0.96]",
                      btn.tone === "danger"
                        ? "bg-elevated text-danger hover:bg-elevated/80"
                        : btn.tone === "primary"
                          ? "bg-accent text-accent-fg hover:bg-accent/90"
                          : "bg-elevated text-fg hover:bg-elevated/80",
                    )}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
