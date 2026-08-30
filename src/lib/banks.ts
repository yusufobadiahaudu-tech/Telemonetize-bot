export const NG_BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "063", name: "Access Bank (Diamond)" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "50211", name: "Kuda Bank" },
  { code: "50515", name: "Moniepoint MFB" },
  { code: "100033", name: "PalmPay" },
  { code: "076", name: "Polaris Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank for Africa" },
  { code: "215", name: "Unity Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
  { code: "100004", name: "OPay" },
] as const;

export function bankByCode(code: string) {
  return NG_BANKS.find((b) => b.code === code) ?? null;
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function isNuban(value: string) {
  return /^\d{10}$/.test(digitsOnly(value));
}

export function maskAccount(value: string | null | undefined) {
  const digits = digitsOnly(value ?? "");
  if (digits.length < 4) return "••••";
  return `•••• ${digits.slice(-4)}`;
}
