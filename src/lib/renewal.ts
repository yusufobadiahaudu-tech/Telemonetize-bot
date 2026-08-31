export type RenewalAction = "wait" | "remind" | "charge" | "retry_warn" | "kick_cancel" | "kick_fail";

export function planRenewal(opts: {
  periodEndMs: number;
  now: number;
  autoRenew: boolean;
  retryCount: number;
  cardFailing: boolean;
  hasAuthorization: boolean;
  payoutConnected: boolean;
  alreadyReminded: boolean;
}): RenewalAction {
  if (opts.periodEndMs > opts.now) {
    if (opts.periodEndMs < opts.now + 3 * 86_400_000 && !opts.alreadyReminded) return "remind";
    return "wait";
  }
  if (!opts.autoRenew) return "kick_cancel";
  if (opts.cardFailing || !opts.hasAuthorization || !opts.payoutConnected) {
    return opts.retryCount >= 2 ? "kick_fail" : "retry_warn";
  }
  return "charge";
}
