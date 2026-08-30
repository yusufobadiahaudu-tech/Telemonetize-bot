import type { Currency } from "./currency";
import { formatCharge, PRIMARY_CURRENCY } from "./currency";

export type { Currency };
export type BillingInterval = "monthly" | "yearly" | "one_time";

export const DEFAULT_CURRENCY: Currency = PRIMARY_CURRENCY;

/** Amounts in the app are USD cents. Pass another currency to show the converted charge. */
export function formatMoney(usdCents: number, currency: Currency = DEFAULT_CURRENCY): string {
  return formatCharge(usdCents, currency);
}

export function intervalLabel(interval: string): string {
  if (interval === "monthly") return "month";
  if (interval === "yearly") return "year";
  return "once";
}

export function planCadence(interval: string): string {
  if (interval === "monthly") return "Monthly";
  if (interval === "yearly") return "Yearly";
  return "One-time";
}

export function relativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (mins < 60) return rtf.format(Math.sign(diff) * mins, "minute");
  if (hours < 48) return rtf.format(Math.sign(diff) * hours, "hour");
  return rtf.format(Math.sign(diff) * days, "day");
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function clock(ts: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ts));
}

export function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yday = new Date(today);
  yday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function feePct(bps: number): string {
  return `${(bps / 100).toFixed(0)}%`;
}

export function splitAmounts(usdCents: number, feeBps: number) {
  const platformFee = Math.round(usdCents * (feeBps / 10000));
  return {
    platformFee,
    creatorPayout: Math.max(0, usdCents - platformFee),
    settlementStatus: "wallet_and_bank" as const,
  };
}

export function periodEnd(interval: string, start = new Date()): Date {
  const end = new Date(start);
  if (interval === "yearly") end.setFullYear(end.getFullYear() + 1);
  else if (interval === "one_time") end.setFullYear(end.getFullYear() + 100);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

export function providerLabel(provider: string): string {
  if (provider === "card") return "card";
  if (provider === "transfer") return "bank transfer";
  return provider;
}

export function destinationFor(c: {
  payoutConnected: boolean;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
}): string | null {
  if (!c.payoutConnected || !c.bankName || !c.accountNumber) return null;
  const last4 = c.accountNumber.slice(-4);
  const who = c.accountName ? ` · ${c.accountName}` : "";
  return `${c.bankName} •••• ${last4}${who}`;
}
