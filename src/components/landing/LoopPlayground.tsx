import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FEATURED_CURRENCIES, formatCharge, type Currency } from "@/lib/currency";
import { formatMoney, providerLabel } from "@/lib/format";
import { platformSnapshot } from "@/lib/platform";
import { YOU } from "@/lib/seed";
import { useApp } from "@/lib/store";
import type { LoopResult, Provider } from "@/lib/types";
import { cn } from "@/lib/utils";

const PREMIUM_USD = 1500;

export function LoopPlayground() {
  const communities = useApp((s) => s.communities);
  const members = useApp((s) => s.members);
  const payments = useApp((s) => s.payments);
  const initializeCheckout = useApp((s) => s.initializeCheckout);
  const fulfillCharge = useApp((s) => s.fulfillCharge);
  const runLoop = useApp((s) => s.runLoop);
  const setRole = useApp((s) => s.setRole);
  const setActingAs = useApp((s) => s.setActingAs);
  const resetDemo = useApp((s) => s.resetDemo);

  const [invite, setInvite] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [loop, setLoop] = useState<LoopResult | null>(null);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [method, setMethod] = useState<Provider>("card");

  const ada = communities.find((c) => c.code === "LA-ADA");
  const mySeat = members.find(
    (m) => m.userId === YOU.id && m.communityId === ada?.id && m.status !== "removed",
  );
  const ibrahim = members.find((m) => m.username === "ibrahim_ngn");
  const snap = platformSnapshot({ communities, payments, members });
  const charge = formatCharge(PREMIUM_USD, currency);

  function payAsCustomer() {
    setActingAs("self");
    setRole("member");
    const started = initializeCheckout("pln_la_premium", method, currency);
    if (!started.ok) {
      setPayError(started.error);
      return;
    }
    setPendingRef(started.reference);
    setReceipt(`Paystack initialize · ${charge} via ${providerLabel(method)}. Waiting for charge.success.`);
    setPayError(null);
    setInvite(null);
  }

  function confirmCharge() {
    if (!pendingRef) return;
    const done = fulfillCharge(pendingRef);
    if (!done.ok) {
      setPayError(done.error);
      return;
    }
    if (done.kind !== "member") {
      setPayError("Unexpected checkout.");
      return;
    }
    setInvite(done.inviteUrl);
    setReceipt(`${charge} via ${providerLabel(method)} · charge.success`);
    setPendingRef(null);
    setPayError(null);
  }

  function kickLapsed() {
    setActingAs("adaeze");
    setRole("creator");
    setLoop(runLoop());
  }

  return (
    <section id="loop" className="border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <p className="text-xs font-medium tracking-widest text-accent uppercase">Play the loop</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Mr. A’s desk, live.
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          Adaeze already subscribed to your bot. She has ID LA-ADA bound to Lagos Alpha Circle, with
          her GTBank attached. Customers pay in dollars first — or another currency — by card or
          transfer. They never see the split. Your percentage credits your Telegram wallet.
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Creators on your bot" value={String(snap.creatorCount)} />
          <Stat label="Pro to you" value={`$${snap.proUsd}/mo`} />
          <Stat label="Telegram wallet" value={formatMoney(snap.cut)} />
          <Stat label="Seats / kicked" value={`${snap.activeSeats} / ${snap.kicked}`} />
        </dl>

        <ol className="mt-8 grid gap-4 lg:grid-cols-3">
          <li className="rounded-xl border border-border bg-surface p-5">
            <p className="font-mono text-xs text-accent">01</p>
            <h3 className="mt-2 font-display text-lg font-semibold">Creator subscribes</h3>
            <p className="mt-2 text-sm text-muted">
              Adaeze paid Pro by card. You issued ID LA-ADA, bound the group name, and attached her
              bank account.
            </p>
            <p className="mt-4 rounded-md bg-elevated px-3 py-3 font-mono text-sm">
              ID {ada?.code}
              <span className="mt-1 block text-muted">{ada?.name}</span>
              <span className="mt-1 block text-success">
                {ada?.bankName} •••• {ada?.accountNumber?.slice(-4)}
              </span>
            </p>
            <p className="mt-3 text-sm text-muted">
              She tells customers: send LA-ADA or “Lagos Alpha Circle” to @TeleMonetizeBot.
            </p>
          </li>

          <li className="rounded-xl border border-border bg-surface p-5">
            <p className="font-mono text-xs text-accent">02</p>
            <h3 className="mt-2 font-display text-lg font-semibold">Customer pays</h3>
            <p className="mt-2 text-sm text-muted">
              Dollar first. Other currencies on tap. Card or bank transfer. Paystack initialize first —
              the join link is minted only after charge.success. They never see the split.
            </p>
            {mySeat ? (
              <p className="mt-4 rounded-md bg-elevated px-3 py-3 text-sm">
                Seat active.
                {receipt ? <span className="mt-1 block text-muted">{receipt}</span> : null}
                <span className="mt-1 block font-mono text-success">{invite ?? mySeat.inviteUrl}</span>
              </p>
            ) : pendingRef ? (
              <div className="mt-4 space-y-3">
                <p className="rounded-md bg-elevated px-3 py-3 text-sm">
                  Checkout open. Ref {pendingRef}.
                  {receipt ? <span className="mt-1 block text-muted">{receipt}</span> : null}
                </p>
                <button
                  type="button"
                  onClick={confirmCharge}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg transition-transform duration-150 active:scale-[0.98]"
                >
                  Simulate charge.success
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {FEATURED_CURRENCIES.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCurrency(code)}
                      className={cn(
                        "min-h-9 rounded-md px-2.5 text-xs font-medium",
                        currency === code ? "bg-accent text-accent-fg" : "bg-elevated text-fg",
                      )}
                    >
                      {code}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMethod("card")}
                    className={cn(
                      "min-h-9 flex-1 rounded-md text-xs font-medium",
                      method === "card" ? "bg-accent text-accent-fg" : "bg-elevated text-fg",
                    )}
                  >
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod("transfer")}
                    className={cn(
                      "min-h-9 flex-1 rounded-md text-xs font-medium",
                      method === "transfer" ? "bg-accent text-accent-fg" : "bg-elevated text-fg",
                    )}
                  >
                    Bank transfer
                  </button>
                </div>
                <button
                  type="button"
                  onClick={payAsCustomer}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg transition-transform duration-150 active:scale-[0.98]"
                >
                  Pay {charge}
                </button>
              </div>
            )}
            {payError ? <p className="mt-2 text-sm text-danger">{payError}</p> : null}
          </li>

          <li className="rounded-xl border border-border bg-surface p-5">
            <p className="font-mono text-xs text-accent">03</p>
            <h3 className="mt-2 font-display text-lg font-semibold">Bot kicks lapsed seats</h3>
            <p className="mt-2 text-sm text-muted">
              @ibrahim_ngn did not renew. A server cron retries, warns, then kicks and revokes the
              invite. This button is the /loop override.
            </p>
            {ibrahim?.status === "removed" || loop ? (
              <p className="mt-4 rounded-md bg-elevated px-3 py-3 text-sm">
                {loop
                  ? `${loop.kicked} kicked · ${loop.expired} expired · ${loop.warned} warned`
                  : `@${ibrahim?.username} removed — ${ibrahim?.removeReason?.replaceAll("_", " ")}`}
              </p>
            ) : (
              <button
                type="button"
                onClick={kickLapsed}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-elevated px-4 text-sm font-medium text-fg transition-transform duration-150 active:scale-[0.98]"
              >
                Kick non-renewals
              </button>
            )}
          </li>
        </ol>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/bot"
            search={{ as: "join" }}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-fg"
          >
            Open the bot as a customer
          </Link>
          <Link
            to="/bot"
            search={{ as: "adaeze" }}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-elevated px-5 text-sm font-medium"
          >
            Open Adaeze’s studio
          </Link>
          <button
            type="button"
            onClick={() => {
              resetDemo();
              setInvite(null);
              setReceipt(null);
              setPendingRef(null);
              setPayError(null);
              setLoop(null);
              setPayError(null);
              setReceipt(null);
              setLoop(null);
              setCurrency("USD");
              setMethod("card");
            }}
            className="inline-flex min-h-11 items-center px-3 text-sm text-muted transition-colors duration-150 hover:text-fg"
          >
            Reset demo
          </button>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-display text-xl font-semibold tabular-nums tracking-tight">{value}</dd>
    </div>
  );
}
