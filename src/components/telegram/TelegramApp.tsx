import { useLayoutEffect } from "react";
import { Link } from "@tanstack/react-router";
import { bootFromIntent, ensureWelcome } from "@/lib/bot/engine";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ChatView } from "./ChatView";
import { Sidebar } from "./Sidebar";

export function TelegramApp({ intent }: { intent?: "adaeze" | "creator" | "join" }) {
  const selectedChatId = useApp((s) => s.selectedChatId);
  const listOpen = useApp((s) => s.listOpen);

  useLayoutEffect(() => {
    if (intent) bootFromIntent(intent);
    else ensureWelcome();
  }, [intent]);

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-bg text-fg">
      <div className="flex min-h-10 shrink-0 items-center justify-between border-b border-border bg-surface px-3 pt-[env(safe-area-inset-top)]">
        <Link to="/" className="text-xs font-medium text-muted transition-colors duration-150 hover:text-fg">
          TeleMonetize
        </Link>
        <p className="text-xs text-subtle">Demo bot · not Telegram</p>
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            "h-full min-h-0 w-full md:flex md:w-auto",
            listOpen ? "flex" : "hidden md:flex",
          )}
        >
          <Sidebar />
        </div>
        <div className={cn("min-h-0 min-w-0 flex-1", listOpen ? "hidden md:flex" : "flex")}>
          {selectedChatId ? <ChatView /> : null}
        </div>
      </div>
    </div>
  );
}
