/** Fail-closed switches for money and webhooks. Demo never runs on the production deploy. */

export function isProdDeploy() {
  const vercel = process.env.VERCEL_ENV?.trim();
  if (vercel) return vercel === "production";
  return process.env.NODE_ENV === "production";
}

/**
 * Simulated charge.success (demo Paystack route, simcharge button) is off unless
 * ALLOW_DEMO_PAYMENTS=1 on a non-production deploy.
 */
export function demoPaymentsEnabled() {
  if (isProdDeploy()) return false;
  return process.env.ALLOW_DEMO_PAYMENTS === "1";
}

export function requiredCronSecret() {
  return process.env.CRON_SECRET?.trim() || "";
}

export function operatorTelegramIds() {
  return (process.env.OPERATOR_TELEGRAM_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isOperatorActor(opts: { id: string; telegramUserId?: string | null }) {
  const ids = operatorTelegramIds();
  if (ids.length === 0) return false;
  const tg = (opts.telegramUserId ?? "").replace(/^tg-/i, "");
  const actor = opts.id.replace(/^tg-/i, "");
  return ids.includes(opts.id) || ids.includes(actor) || (tg ? ids.includes(tg) : false);
}

export function nextFulfillAction(status: string): "fulfill" | "skip" | "reject" {
  if (status === "success") return "skip";
  if (status === "pending") return "fulfill";
  return "reject";
}
