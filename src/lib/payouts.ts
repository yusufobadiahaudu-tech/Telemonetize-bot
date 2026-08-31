import { NG_BANKS, digitsOnly, isNuban } from "@/lib/banks";
import { isCurrency, type Currency } from "@/lib/currency";

export const PAYOUT_RAILS = ["bank", "mobile_money", "paypal", "stripe"] as const;
export type PayoutRail = (typeof PAYOUT_RAILS)[number];

export type PayoutCountry = {
  code: string;
  name: string;
  currency: Currency;
  rails: PayoutRail[];
  accountHint: string;
};

export const PAYOUT_COUNTRIES: PayoutCountry[] = [
  { code: "NG", name: "Nigeria", currency: "NGN", rails: ["bank", "mobile_money", "paypal", "stripe"], accountHint: "10-digit NUBAN" },
  { code: "GH", name: "Ghana", currency: "GHS", rails: ["bank", "mobile_money", "paypal", "stripe"], accountHint: "bank account or mobile-money number" },
  { code: "KE", name: "Kenya", currency: "KES", rails: ["bank", "mobile_money", "paypal", "stripe"], accountHint: "account number or M-Pesa MSISDN" },
  { code: "ZA", name: "South Africa", currency: "ZAR", rails: ["bank", "paypal", "stripe"], accountHint: "account number" },
  { code: "EG", name: "Egypt", currency: "EGP", rails: ["bank", "mobile_money", "paypal", "stripe"], accountHint: "account number" },
  { code: "US", name: "United States", currency: "USD", rails: ["bank", "paypal", "stripe"], accountHint: "routing + account, or IBAN" },
  { code: "GB", name: "United Kingdom", currency: "GBP", rails: ["bank", "paypal", "stripe"], accountHint: "sort code + account, or IBAN" },
  { code: "EU", name: "Eurozone", currency: "EUR", rails: ["bank", "paypal", "stripe"], accountHint: "IBAN" },
  { code: "CA", name: "Canada", currency: "CAD", rails: ["bank", "paypal", "stripe"], accountHint: "institution + account" },
  { code: "AU", name: "Australia", currency: "AUD", rails: ["bank", "paypal", "stripe"], accountHint: "BSB + account" },
  { code: "IN", name: "India", currency: "INR", rails: ["bank", "paypal", "stripe"], accountHint: "account + IFSC" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", rails: ["bank", "paypal", "stripe"], accountHint: "IBAN" },
  { code: "SG", name: "Singapore", currency: "SGD", rails: ["bank", "paypal", "stripe"], accountHint: "account number" },
  { code: "BR", name: "Brazil", currency: "BRL", rails: ["bank", "paypal", "stripe"], accountHint: "PIX key or account" },
  { code: "MX", name: "Mexico", currency: "MXN", rails: ["bank", "paypal", "stripe"], accountHint: "CLABE" },
  { code: "JP", name: "Japan", currency: "JPY", rails: ["bank", "paypal", "stripe"], accountHint: "bank account" },
];

export const MOBILE_MONEY_NETWORKS: Record<string, { id: string; name: string }[]> = {
  NG: [
    { id: "opay", name: "OPay" },
    { id: "palmpay", name: "PalmPay" },
    { id: "moniepoint", name: "Moniepoint" },
  ],
  GH: [
    { id: "mtn_momo_gh", name: "MTN MoMo" },
    { id: "vodafone_cash", name: "Telecel Cash" },
    { id: "airteltigo", name: "AirtelTigo Money" },
  ],
  KE: [
    { id: "mpesa", name: "M-Pesa" },
    { id: "airtel_money_ke", name: "Airtel Money" },
  ],
  EG: [{ id: "vodafone_cash_eg", name: "Vodafone Cash" }],
};

export type PayoutDraft = {
  rail: PayoutRail;
  country: string;
  currency: Currency;
  institution: string;
  handle: string;
  accountName?: string;
};

export function railLabel(rail: PayoutRail): string {
  if (rail === "bank") return "Local bank";
  if (rail === "mobile_money") return "Mobile money";
  if (rail === "paypal") return "PayPal";
  return "Stripe";
}

export function countryByCode(code: string) {
  return PAYOUT_COUNTRIES.find((c) => c.code === code) ?? null;
}

export function countriesForRail(rail: PayoutRail) {
  return PAYOUT_COUNTRIES.filter((c) => c.rails.includes(rail));
}

export function defaultCurrencyForCountry(code: string): Currency {
  return countryByCode(code)?.currency ?? "USD";
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function looksLikeIban(value: string) {
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/i.test(value.replace(/\s+/g, ""));
}

export function looksLikePhone(value: string) {
  const digits = digitsOnly(value);
  return digits.length >= 8 && digits.length <= 15;
}

export function validatePayoutHandle(draft: Pick<PayoutDraft, "rail" | "country" | "handle" | "institution">): string | null {
  const handle = draft.handle.trim();
  if (!handle) return "Send the payout destination.";
  if (draft.rail === "paypal") {
    return isEmail(handle) ? null : "Send the PayPal email that should receive payouts.";
  }
  if (draft.rail === "stripe") {
    if (isEmail(handle) || /^acct_[A-Za-z0-9]+$/.test(handle)) return null;
    return "Send a Stripe account email or acct_ id.";
  }
  if (draft.rail === "mobile_money") {
    return looksLikePhone(handle) ? null : "Send the mobile-money number, digits only, with country code if you have it.";
  }
  if (draft.country === "NG") {
    return isNuban(handle) ? null : "Enter a 10-digit NUBAN account number.";
  }
  if (looksLikeIban(handle) || digitsOnly(handle).length >= 6) return null;
  return "Send an IBAN or local account number.";
}

export function institutionLabel(draft: Pick<PayoutDraft, "rail" | "country" | "institution">): string {
  if (draft.institution) return draft.institution;
  if (draft.rail === "paypal") return "PayPal";
  if (draft.rail === "stripe") return "Stripe";
  if (draft.rail === "mobile_money") return "Mobile money";
  return countryByCode(draft.country)?.name ?? "Bank";
}

export function maskHandle(handle: string | null | undefined, rail?: PayoutRail | null) {
  const raw = (handle ?? "").trim();
  if (!raw) return "••••";
  if (rail === "paypal" || raw.includes("@")) {
    const [user, domain] = raw.split("@");
    if (!domain) return "••••";
    return `${user.slice(0, 2)}•••@${domain}`;
  }
  const digits = digitsOnly(raw);
  if (digits.length >= 4) return `•••• ${digits.slice(-4)}`;
  return `•••• ${raw.slice(-4)}`;
}

export function describePayout(opts: {
  payoutConnected: boolean;
  payoutRail?: PayoutRail | null;
  payoutCountry?: string | null;
  payoutCurrency?: Currency | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  payoutHandle?: string | null;
}): string | null {
  if (!opts.payoutConnected) return null;
  const rail = opts.payoutRail ?? "bank";
  const handle = opts.payoutHandle || opts.accountNumber;
  const inst = opts.bankName || institutionLabel({ rail, country: opts.payoutCountry ?? "", institution: opts.bankName ?? "" });
  const who = opts.accountName ? ` · ${opts.accountName}` : "";
  const ccy = opts.payoutCurrency ? ` · ${opts.payoutCurrency}` : "";
  return `${railLabel(rail)} · ${inst} ${maskHandle(handle, rail)}${who}${ccy}`;
}

export function ngBankByCode(code: string) {
  return NG_BANKS.find((b) => b.code === code) ?? null;
}

export function parseRail(raw: string): PayoutRail | null {
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (t === "bank" || t === "local_bank" || t === "banks") return "bank";
  if (t === "mobile_money" || t === "momo" || t === "opay" || t === "mpesa") return "mobile_money";
  if (t === "paypal") return "paypal";
  if (t === "stripe" || t === "card") return "stripe";
  return null;
}

export function isPayoutCurrency(value: string): value is Currency {
  return isCurrency(value);
}
