import { createHmac, timingSafeEqual } from "node:crypto";

export function looksLikePaystackSecret(value: string) {
  return /^sk_(test|live)_[A-Za-z0-9]+$/.test(value.trim());
}

export function amountsMatch(expectedMinor: number, receivedMinor: number) {
  return Math.abs(expectedMinor - receivedMinor) <= 2;
}

export function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
