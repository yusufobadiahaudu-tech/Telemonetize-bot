import { Mark } from "@/components/logo";

const BUBBLES = [
  { from: "me" as const, text: "Lagos Alpha Circle" },
  {
    from: "bot" as const,
    text: "Lagos Alpha Circle\nCreator ID LA-ADA\nPremium · $15.00 / month\n\nDollar is the list price. Pay in USD, or pick another currency.",
  },
  { from: "me" as const, text: "USD · $15.00, then card" },
  {
    from: "bot" as const,
    text: "Payment received.\n$15.00 via card\nYou're in.",
  },
];

export function PhoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="overflow-hidden rounded-xl border border-border bg-chat shadow-[var(--shadow-border)]">
        <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
          <Mark className="size-8" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight">TeleMonetize</p>
            <p className="text-xs text-success">bot · online</p>
          </div>
        </div>
        <div className="chat-wallpaper flex flex-col gap-2 px-3 py-4">
          {BUBBLES.map((b, i) => (
            <div key={i} className={`flex ${b.from === "me" ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-snug ${
                  b.from === "me"
                    ? "rounded-br-xs bg-bubble-out"
                    : "rounded-bl-xs bg-bubble-in"
                }`}
              >
                {b.text}
              </p>
            </div>
          ))}
          <div className="flex flex-wrap gap-1 px-1">
            <span className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-fg">USD · $15.00</span>
            <span className="rounded-md bg-elevated px-2.5 py-1.5 text-xs font-medium">NGN · ₦23,250</span>
            <span className="rounded-md bg-elevated px-2.5 py-1.5 text-xs font-medium">EUR · 13,80 €</span>
          </div>
        </div>
      </div>
    </div>
  );
}
