import {
  USD_RATES,
  currencyLabel,
  formatCharge,
  type Currency,
} from "@/lib/currency";

/** Transparent FX markup applied when pay currency != settlement currency. */
export const FX_FEE_BPS = 150;

export type RateBook = Partial<Record<Currency, number>>;

export type FxQuote = {
  listUsdCents: number;
  payCurrency: Currency;
  payoutCurrency: Currency;
  midRate: number;
  customerRate: number;
  feeBps: number;
  payMinor: number;
  feeMinor: number;
  payMinorBeforeFee: number;
  creatorUsdCents: number;
  creatorPayoutMinor: number;
  platformFeeUsdCents: number;
  stale: boolean;
  source: "live" | "book";
  asOf: string;
};

function unitsPerUsd(currency: Currency, book: RateBook): number {
  const live = book[currency];
  if (typeof live === "number" && live > 0) return live;
  return USD_RATES[currency];
}

/** Mid-market units of `to` per 1 unit of `from`. */
export function midRate(from: Currency, to: Currency, book: RateBook = {}): number {
  if (from === to) return 1;
  return unitsPerUsd(to, book) / unitsPerUsd(from, book);
}

export function majorToMinor(major: number, currency: Currency): number {
  const zeroDecimal = currency === "JPY" || currency === "NGN" || currency === "KES" || currency === "XOF" || currency === "UGX" || currency === "TZS";
  return Math.round(major * (zeroDecimal ? 1 : 100));
}

export function quoteConversion(opts: {
  listUsdCents: number;
  payCurrency: Currency;
  payoutCurrency: Currency;
  feeBps?: number;
  platformFeeBps: number;
  book?: RateBook;
  source?: "live" | "book";
  asOf?: string;
  stale?: boolean;
}): FxQuote {
  const feeBps = opts.feeBps ?? FX_FEE_BPS;
  const book = opts.book ?? {};
  const same = opts.payCurrency === opts.payoutCurrency && opts.payCurrency === "USD";
  const applyFx = opts.payCurrency !== "USD";
  const mid = midRate("USD", opts.payCurrency, book);
  const customerRate = applyFx ? mid * (1 + feeBps / 10000) : mid;
  const payMajorBefore = (opts.listUsdCents / 100) * mid;
  const payMajor = (opts.listUsdCents / 100) * customerRate;
  const payMinorBeforeFee = Math.round(payMajorBefore * 100);
  const payMinor = Math.round(payMajor * 100);
  const feeMinor = Math.max(0, payMinor - payMinorBeforeFee);
  const platformFeeUsdCents = Math.round(opts.listUsdCents * (opts.platformFeeBps / 10000));
  const creatorUsdCents = Math.max(0, opts.listUsdCents - platformFeeUsdCents);
  const payoutMid = midRate("USD", opts.payoutCurrency, book);
  const creatorPayoutMinor = Math.round((creatorUsdCents / 100) * payoutMid * 100);
  return {
    listUsdCents: opts.listUsdCents,
    payCurrency: opts.payCurrency,
    payoutCurrency: opts.payoutCurrency,
    midRate: mid,
    customerRate,
    feeBps: applyFx && !same ? feeBps : 0,
    payMinor,
    feeMinor: applyFx ? feeMinor : 0,
    payMinorBeforeFee,
    creatorUsdCents,
    creatorPayoutMinor,
    platformFeeUsdCents,
    stale: Boolean(opts.stale),
    source: opts.source ?? "book",
    asOf: opts.asOf ?? new Date(0).toISOString(),
  };
}

export function formatMinor(minor: number, currency: Currency): string {
  return formatCharge(Math.round((minor / 100) * 100), currency);
}

export function formatQuote(quote: FxQuote): string {
  const pay = formatCharge(quote.listUsdCents, quote.payCurrency);
  const list = formatCharge(quote.listUsdCents, "USD");
  const creator = formatCharge(quote.creatorUsdCents, quote.payoutCurrency);
  const feePct = (quote.feeBps / 100).toFixed(2);
  const rateLine =
    quote.payCurrency === "USD"
      ? `List price ${list}`
      : `List price ${list}\nYou pay ${pay}\nMid-market 1 USD = ${quote.midRate.toFixed(4)} ${quote.payCurrency}\nConversion fee ${feePct}%`;
  return `${rateLine}\nCreator receives ${creator} in ${currencyLabel(quote.payoutCurrency)} after the platform cut.`;
}

export function checkoutQuoteLines(quote: FxQuote): string {
  const pay = formatCharge(quote.listUsdCents, quote.payCurrency);
  const list = formatCharge(quote.listUsdCents, "USD");
  const out = formatCharge(quote.creatorUsdCents, quote.payoutCurrency);
  if (quote.payCurrency === "USD" && quote.payoutCurrency === "USD") {
    return `${list} USD.`;
  }
  const fee = (quote.feeBps / 100).toFixed(2);
  return [
    `List ${list} USD`,
    `You pay ${pay}`,
    quote.payCurrency !== "USD" ? `Rate 1 USD → ${quote.midRate.toFixed(4)} ${quote.payCurrency}` : null,
    quote.feeBps ? `FX fee ${fee}% — shown before you pay` : null,
    `Settles to creator as ${out}`,
    quote.source === "live" ? "Rate from live feed" : "Rate from settlement book",
  ]
    .filter(Boolean)
    .join("\n");
}
