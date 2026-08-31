import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planRenewal } from "../renewal.ts";

const base = {
  periodEndMs: Date.now() + 10 * 86_400_000,
  now: Date.now(),
  autoRenew: true,
  retryCount: 0,
  cardFailing: false,
  hasAuthorization: true,
  payoutConnected: true,
  alreadyReminded: false,
};

describe("planRenewal", () => {
  it("waits when the seat is still current", () => {
    assert.equal(planRenewal(base), "wait");
  });

  it("reminds inside the 3-day window once", () => {
    assert.equal(
      planRenewal({ ...base, periodEndMs: base.now + 2 * 86_400_000 }),
      "remind",
    );
    assert.equal(
      planRenewal({ ...base, periodEndMs: base.now + 2 * 86_400_000, alreadyReminded: true }),
      "wait",
    );
  });

  it("charges only when authorization and payout exist — never fakes success", () => {
    const due = { ...base, periodEndMs: base.now - 1000 };
    assert.equal(planRenewal(due), "charge");
    assert.equal(planRenewal({ ...due, hasAuthorization: false }), "retry_warn");
    assert.equal(planRenewal({ ...due, payoutConnected: false }), "retry_warn");
    assert.equal(planRenewal({ ...due, cardFailing: true, retryCount: 2 }), "kick_fail");
    assert.equal(planRenewal({ ...due, autoRenew: false }), "kick_cancel");
  });
});
