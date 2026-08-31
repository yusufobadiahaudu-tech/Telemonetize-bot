import { createFileRoute, Link } from "@tanstack/react-router";
import { Mark } from "@/components/logo";

export const Route = createFileRoute("/paid")({
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === "string" ? search.ref : "",
  }),
  component: Paid,
});

function Paid() {
  const { ref } = Route.useSearch();
  return (
    <main className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
        <Mark className="size-10" />
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">Payment received</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Paystack confirmed the charge. Return to Telegram — @TeleMonetizeBot sends the join link
          there. This page does not mint access.
        </p>
        {ref ? <p className="mt-4 font-mono text-xs text-muted">Ref {ref}</p> : null}
        <Link
          to="/bot"
          search={{}}
          className="mt-8 inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-sm font-medium text-accent-fg"
        >
          Open the bot
        </Link>
      </div>
    </main>
  );
}
