import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quoteConversion } from "./fx.ts";
import { validatePayoutHandle } from "./payouts.ts";

describe("fx quotes", () => {
  it("USD to USD has no conversion fee", () => {
    const q = quoteConversion({
      listUsdCents: 1500,
      payCurrency: "USD",
      payoutCurrency: "USD",
      platformFeeBps: 500,
    });
    assert.equal(q.feeBps, 0);
    assert.equal(q.payMinor, 1500);
    assert.equal(q.creatorUsdCents, 1425);
  });

  it("EUR checkout applies the stated FX fee on top of mid-market", () => {
    const q = quoteConversion({
      listUsdCents: 10000,
      payCurrency: "EUR",
      payoutCurrency: "NGN",
      feeBps: 150,
      platformFeeBps: 500,
    });
    assert.equal(q.feeBps, 150);
    assert.ok(q.payMinor > q.payMinorBeforeFee);
    assert.ok(q.creatorPayoutMinor > 0);
  });
});

describe("payout handles", () => {
  it("accepts NUBAN, IBAN, PayPal email, and mobile-money numbers", () => {
    assert.equal(
      validatePayoutHandle({ rail: "bank", country: "NG", handle: "0123444421", institution: "GTBank" }),
      null,
    );
    assert.equal(
      validatePayoutHandle({ rail: "bank", country: "EU", handle: "DE89370400440532013000", institution: "Wise" }),
      null,
    );
    assert.equal(
      validatePayoutHandle({ rail: "paypal", country: "US", handle: "ada@example.com", institution: "PayPal" }),
      null,
    );
    assert.equal(
      validatePayoutHandle({ rail: "mobile_money", country: "KE", handle: "254711000000", institution: "M-Pesa" }),
      null,
    );
    assert.ok(
      validatePayoutHandle({ rail: "paypal", country: "US", handle: "not-an-email", institution: "PayPal" }),
    );
  });
});
