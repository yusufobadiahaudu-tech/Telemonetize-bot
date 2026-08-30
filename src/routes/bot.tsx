import { createFileRoute } from "@tanstack/react-router";
import { TelegramApp } from "@/components/telegram/TelegramApp";

type BotSearch = { as?: "adaeze" | "creator" | "join" };

export const Route = createFileRoute("/bot")({
  validateSearch: (s: Record<string, unknown>): BotSearch => {
    if (s.as === "adaeze" || s.as === "creator" || s.as === "join") return { as: s.as };
    return {};
  },
  component: BotPage,
});

function BotPage() {
  const { as } = Route.useSearch();
  return <TelegramApp intent={as} />;
}
