import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Mark } from "@/components/logo";
import { APP_NAME } from "@/lib/constants";
import { LoopPlayground } from "./LoopPlayground";
import { PhoneMock } from "./PhoneMock";

const STEPS = [
  {
    n: "01",
    title: "You publish the bot",
    body: "One Telegram bot. You own it. Creators pay you to use it.",
  },
  {
    n: "02",
    title: "Mr. A subscribes",
    body: "Trial at 8%, or Pro at $15/month and 5%. He gets admin on the bot with a unique ID.",
  },
  {
    n: "03",
    title: "He binds name and payout",
    body: "Lagos Alpha Circle plus a Nigerian bank account sit on ID LA-ADA. Paystack splits member charges to that NUBAN. Your percentage credits your Telegram wallet.",
  },
  {
    n: "04",
    title: "Customers pay here",
    body: "They pay in their currency. Live FX plus a stated conversion fee. Card or bank transfer. They never see how the money is shared.",
  },
  {
    n: "05",
    title: "The bot kicks lapsed seats",
    body: "No renewal, no seat. Retry, warn, then remove. Mr. A does not chase anyone.",
  },
];

export function Landing() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Mark className="size-7" />
            <span className="font-display text-sm font-semibold tracking-tight">{APP_NAME}</span>
          </Link>
          <Link
            to="/bot"
            search={{}}
            className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
          >
            Open the bot
          </Link>
        </div>
      </header>

      <section className="hero-grid border-b border-border">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className="text-xs font-medium tracking-widest text-accent uppercase">Telegram group monetization</p>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              You own the bot. Creators pay you. Members pay them.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Mr. A subscribes, gets an ID, binds his group and a Nigerian bank account. Customers
              pay in their local currency. The bot converts at a live rate, shows the FX fee, and
              mints a join link after Paystack confirms. They never see the split. If they do not
              renew, the bot kicks them. Other payout rails stay paused until each one has an API.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/bot"
                search={{ as: "creator" }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-accent-fg"
              >
                Claim a creator ID
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Link>
              <Link
                to="/bot"
                search={{ as: "join" }}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-elevated px-5 text-sm font-medium"
              >
                Send LA-ADA as a customer
              </Link>
            </div>
          </div>
          <div className="hidden lg:block">
            <PhoneMock />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <p className="text-xs font-medium tracking-widest text-accent uppercase">The loop</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          How you make money from creators.
        </h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-lg bg-surface p-4">
              <p className="font-mono text-xs text-accent">{s.n}</p>
              <h3 className="mt-2 font-display text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <LoopPlayground />

      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <p className="text-xs font-medium tracking-widest text-accent uppercase">What creators pay you</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">Two ways in.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-border bg-surface p-6">
              <p className="text-sm text-muted">Trial</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-tight">14 days free</p>
              <p className="mt-2 text-muted">8% of every member payment credits your Telegram wallet.</p>
              <ul className="mt-6 space-y-2 text-sm text-muted">
                <li>Creator ID issued on subscribe</li>
                <li>Group name and a Nigerian bank account bound to that ID via Paystack</li>
                <li>Customers pay in local currency; conversion and FX fee are shown first</li>
              </ul>
            </article>
            <article className="rounded-xl border border-accent/40 bg-surface p-6">
              <p className="text-sm text-accent">Pro</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-tight">$15 / month</p>
              <p className="mt-2 text-muted">5% of every member payment credits your Telegram wallet, plus the $15.</p>
              <ul className="mt-6 space-y-2 text-sm text-muted">
                <li>Pay Pro by card or bank transfer</li>
                <li>Creator share hits the account on their ID</li>
                <li>Customers never see how the money is shared</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <Mark className="size-6" />
            <p className="text-sm text-muted">One bot. Charge creators. Run the door.</p>
          </div>
          <Link to="/bot" search={{}} className="text-sm font-medium text-accent">
            Open @TeleMonetizeBot
          </Link>
        </div>
      </footer>
    </div>
  );
}
