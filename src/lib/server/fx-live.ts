import { USD_RATES, type Currency, CURRENCIES } from "@/lib/currency";
import type { RateBook } from "@/lib/fx";

type Cache = { book: RateBook; asOf: string; source: "live" | "book"; expiresAt: number };

const globalRef = globalThis as typeof globalThis & { __fxCache__?: Cache; __fxInflight__?: Promise<Cache> };

const TTL_MS = 30 * 60 * 1000;

function bookFromRates(rates: Record<string, number>): RateBook {
  const book: RateBook = { USD: 1 };
  for (const code of CURRENCIES) {
    const n = rates[code];
    if (typeof n === "number" && n > 0) book[code] = n;
  }
  return book;
}

async function fetchOpenEr(): Promise<Cache | null> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(4000) });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: string; time_last_update_utc?: string; rates?: Record<string, number> };
  if (json.result !== "success" || !json.rates) return null;
  return {
    book: bookFromRates(json.rates),
    asOf: json.time_last_update_utc ? new Date(json.time_last_update_utc).toISOString() : new Date().toISOString(),
    source: "live",
    expiresAt: Date.now() + TTL_MS,
  };
}

async function fetchFrankfurter(): Promise<Cache | null> {
  const res = await fetch("https://api.frankfurter.app/latest?from=USD", { signal: AbortSignal.timeout(4000) });
  if (!res.ok) return null;
  const json = (await res.json()) as { date?: string; rates?: Record<string, number> };
  if (!json.rates) return null;
  return {
    book: bookFromRates(json.rates),
    asOf: json.date ? `${json.date}T00:00:00.000Z` : new Date().toISOString(),
    source: "live",
    expiresAt: Date.now() + TTL_MS,
  };
}

function fallback(): Cache {
  return {
    book: { ...USD_RATES },
    asOf: new Date(0).toISOString(),
    source: "book",
    expiresAt: Date.now() + 60_000,
  };
}

export async function getRateBook(): Promise<Cache> {
  const hit = globalRef.__fxCache__;
  if (hit && hit.expiresAt > Date.now()) return hit;
  globalRef.__fxInflight__ ??= (async () => {
    try {
      const live = (await fetchOpenEr()) ?? (await fetchFrankfurter());
      const next = live ?? fallback();
      globalRef.__fxCache__ = next;
      return next;
    } catch {
      const next = fallback();
      globalRef.__fxCache__ = next;
      return next;
    } finally {
      globalRef.__fxInflight__ = undefined;
    }
  })();
  return globalRef.__fxInflight__;
}

export function staticBook(): Cache {
  return fallback();
}
