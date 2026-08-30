export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "GHS",
  "KES",
  "CAD",
  "AUD",
  "NZD",
  "CHF",
  "JPY",
  "CNY",
  "INR",
  "AED",
  "SAR",
  "ZAR",
  "EGP",
  "MAD",
  "XOF",
  "UGX",
  "TZS",
  "BRL",
  "MXN",
  "SGD",
  "HKD",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "TRY",
] as const;

export type Currency = (typeof CURRENCIES)[number];

export const PRIMARY_CURRENCY: Currency = "USD";

/** Dollar first, then the currencies customers actually tap. */
export const FEATURED_CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "NGN", "GHS", "KES", "CAD", "AUD"];

export const CHECKOUT_CURRENCIES: Currency[] = [...CURRENCIES];

export const MORE_CURRENCIES: Currency[] = CURRENCIES.filter((c) => !FEATURED_CURRENCIES.includes(c));

/** Units of each currency equal to 1 USD. Demo rates, not a live feed. */
export const USD_RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  NGN: 1550,
  GHS: 12.2,
  KES: 129,
  CAD: 1.37,
  AUD: 1.52,
  NZD: 1.66,
  CHF: 0.88,
  JPY: 148,
  CNY: 7.24,
  INR: 83.5,
  AED: 3.67,
  SAR: 3.75,
  ZAR: 18.4,
  EGP: 48.5,
  MAD: 10.1,
  XOF: 605,
  UGX: 3720,
  TZS: 2680,
  BRL: 5.45,
  MXN: 17.1,
  SGD: 1.34,
  HKD: 7.78,
  SEK: 10.6,
  NOK: 10.8,
  DKK: 6.85,
  PLN: 3.95,
  TRY: 32.4,
};

const META: Record<Currency, { label: string; locale: string; maxFrac: number }> = {
  USD: { label: "US Dollar", locale: "en-US", maxFrac: 2 },
  EUR: { label: "Euro", locale: "de-DE", maxFrac: 2 },
  GBP: { label: "British Pound", locale: "en-GB", maxFrac: 2 },
  NGN: { label: "Nigerian Naira", locale: "en-NG", maxFrac: 0 },
  GHS: { label: "Ghanaian Cedi", locale: "en-GH", maxFrac: 2 },
  KES: { label: "Kenyan Shilling", locale: "en-KE", maxFrac: 0 },
  CAD: { label: "Canadian Dollar", locale: "en-CA", maxFrac: 2 },
  AUD: { label: "Australian Dollar", locale: "en-AU", maxFrac: 2 },
  NZD: { label: "New Zealand Dollar", locale: "en-NZ", maxFrac: 2 },
  CHF: { label: "Swiss Franc", locale: "de-CH", maxFrac: 2 },
  JPY: { label: "Japanese Yen", locale: "ja-JP", maxFrac: 0 },
  CNY: { label: "Chinese Yuan", locale: "zh-CN", maxFrac: 2 },
  INR: { label: "Indian Rupee", locale: "en-IN", maxFrac: 2 },
  AED: { label: "UAE Dirham", locale: "ar-AE", maxFrac: 2 },
  SAR: { label: "Saudi Riyal", locale: "ar-SA", maxFrac: 2 },
  ZAR: { label: "South African Rand", locale: "en-ZA", maxFrac: 2 },
  EGP: { label: "Egyptian Pound", locale: "en-EG", maxFrac: 2 },
  MAD: { label: "Moroccan Dirham", locale: "fr-MA", maxFrac: 2 },
  XOF: { label: "West African CFA", locale: "fr-SN", maxFrac: 0 },
  UGX: { label: "Ugandan Shilling", locale: "en-UG", maxFrac: 0 },
  TZS: { label: "Tanzanian Shilling", locale: "en-TZ", maxFrac: 0 },
  BRL: { label: "Brazilian Real", locale: "pt-BR", maxFrac: 2 },
  MXN: { label: "Mexican Peso", locale: "es-MX", maxFrac: 2 },
  SGD: { label: "Singapore Dollar", locale: "en-SG", maxFrac: 2 },
  HKD: { label: "Hong Kong Dollar", locale: "en-HK", maxFrac: 2 },
  SEK: { label: "Swedish Krona", locale: "sv-SE", maxFrac: 2 },
  NOK: { label: "Norwegian Krone", locale: "nb-NO", maxFrac: 2 },
  DKK: { label: "Danish Krone", locale: "da-DK", maxFrac: 2 },
  PLN: { label: "Polish Zloty", locale: "pl-PL", maxFrac: 2 },
  TRY: { label: "Turkish Lira", locale: "tr-TR", maxFrac: 2 },
};

const ALIASES: Record<string, Currency> = {
  dollar: "USD",
  dollars: "USD",
  usd: "USD",
  $: "USD",
  us: "USD",
  euro: "EUR",
  euros: "EUR",
  eur: "EUR",
  "€": "EUR",
  pound: "GBP",
  pounds: "GBP",
  sterling: "GBP",
  gbp: "GBP",
  "£": "GBP",
  naira: "NGN",
  ngn: "NGN",
  "₦": "NGN",
  cedi: "GHS",
  cedis: "GHS",
  ghs: "GHS",
  shilling: "KES",
  shillings: "KES",
  ksh: "KES",
  kes: "KES",
  cad: "CAD",
  canadian: "CAD",
  aud: "AUD",
  aussie: "AUD",
  australian: "AUD",
  nzd: "NZD",
  kiwi: "NZD",
  chf: "CHF",
  franc: "CHF",
  francs: "CHF",
  yen: "JPY",
  jpy: "JPY",
  "¥": "JPY",
  yuan: "CNY",
  rmb: "CNY",
  cny: "CNY",
  rupee: "INR",
  rupees: "INR",
  inr: "INR",
  "₹": "INR",
  dirham: "AED",
  dirhams: "AED",
  aed: "AED",
  sar: "SAR",
  riyal: "SAR",
  rand: "ZAR",
  zar: "ZAR",
  egp: "EGP",
  mad: "MAD",
  cfa: "XOF",
  xof: "XOF",
  ugx: "UGX",
  tzs: "TZS",
  real: "BRL",
  brl: "BRL",
  peso: "MXN",
  mxn: "MXN",
  sgd: "SGD",
  hkd: "HKD",
  sek: "SEK",
  krona: "SEK",
  nok: "NOK",
  krone: "NOK",
  dkk: "DKK",
  pln: "PLN",
  zloty: "PLN",
  try: "TRY",
  lira: "TRY",
};

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value.toUpperCase());
}

/** Accepts ISO codes, names, and casual words like “naira” or “euro”. */
export function parseCurrency(raw: string): Currency | null {
  const t = raw.trim();
  if (!t) return null;
  const upper = t.toUpperCase();
  if ((CURRENCIES as readonly string[]).includes(upper)) return upper as Currency;
  const key = t.toLowerCase().replace(/[^a-z$€£¥₹₦]/g, "");
  if (key && ALIASES[key]) return ALIASES[key];
  const token = t.toUpperCase().replace(/[^A-Z]/g, "");
  if ((CURRENCIES as readonly string[]).includes(token)) return token as Currency;
  return null;
}

export function usdToMinor(usdCents: number, to: Currency): number {
  const major = (usdCents / 100) * USD_RATES[to];
  return Math.round(major * 100);
}

export function formatCharge(usdCents: number, currency: Currency = "USD"): string {
  const minor = usdToMinor(usdCents, currency);
  const meta = META[currency];
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency,
    maximumFractionDigits: meta.maxFrac,
    minimumFractionDigits: meta.maxFrac === 0 ? 0 : 2,
  }).format(minor / 100);
}

export function currencyLabel(code: Currency): string {
  return META[code].label;
}

export function supportedCurrencyList(): string {
  return FEATURED_CURRENCIES.join(", ") + ", plus " + MORE_CURRENCIES.length + " more";
}

const TRANSFER_BOOK: Partial<Record<Currency, { bank: string; account: string; extra: string }>> = {
  USD: {
    bank: "Mercury Bank (US)",
    account: "9900 4412 8831",
    extra: "Routing 0260 0959 3 · SWIFT MRCHUS33",
  },
  EUR: {
    bank: "Wise Europe",
    account: "DE89 3704 0044 0532 0130 00",
    extra: "BIC TRWIBEB1XXX",
  },
  GBP: {
    bank: "Starling Bank",
    account: "40-12-34  40123456",
    extra: "Payee TeleMonetize Ltd",
  },
  NGN: {
    bank: "Providus Bank",
    account: "9981234567",
    extra: "Name TeleMonetize Checkout",
  },
  GHS: {
    bank: "GTBank Ghana",
    account: "201134567890",
    extra: "Name TeleMonetize GH",
  },
  KES: {
    bank: "Equity Bank",
    account: "1234567890123",
    extra: "Paybill 247247 · Acc TeleMonetize",
  },
  CAD: {
    bank: "EQ Bank",
    account: "003 100 8842199",
    extra: "Payee TeleMonetize CAD",
  },
  AUD: {
    bank: "Wise Australia",
    account: "062-000 1234 5678",
    extra: "Payee TeleMonetize AU",
  },
  AED: {
    bank: "Mashreq Neo",
    account: "AE07 0331 2345 6789 0123 456",
    extra: "Payee TeleMonetize MENA",
  },
  ZAR: {
    bank: "Standard Bank",
    account: "00 123 456 789",
    extra: "Payee TeleMonetize ZA",
  },
  INR: {
    bank: "Yes Bank",
    account: "012345678901234",
    extra: "IFSC YESB0000123 · TeleMonetize IN",
  },
};

export function transferDetails(currency: Currency, usdCents: number, ref: string) {
  const amount = formatCharge(usdCents, currency);
  const d = TRANSFER_BOOK[currency] ?? {
    bank: "TeleMonetize Settlement",
    account: `TM-${currency}-8821944`,
    extra: `Payee TeleMonetize · ${currency} virtual account`,
  };
  return {
    amount,
    bank: d.bank,
    account: d.account,
    extra: d.extra,
    ref,
    text: `Send ${amount}\n${d.bank}\n${d.account}\n${d.extra}\nRef  ${ref}`,
  };
}
