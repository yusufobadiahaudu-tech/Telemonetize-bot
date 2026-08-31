import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { amountsMatch, looksLikePaystackSecret, verifyPaystackSignature } from "../paystack-guard.ts";

describe("Paystack signature", () => {
  it("accepts a matching HMAC and rejects a wrong one", () => {
    const secret = "sk_test_example";
    const raw = JSON.stringify({ event: "charge.success", data: { reference: "PSK_1" } });
    const good = createHmac("sha512", secret).update(raw).digest("hex");
    assert.equal(verifyPaystackSignature(raw, good, secret), true);
    assert.equal(verifyPaystackSignature(raw, "deadbeef", secret), false);
    assert.equal(verifyPaystackSignature(raw, null, secret), false);
    assert.equal(verifyPaystackSignature(raw, good.slice(0, 8), secret), false);
  });

  it("amountsMatch allows a 2-minor-unit drift and nothing more", () => {
    assert.equal(amountsMatch(150000, 150000), true);
    assert.equal(amountsMatch(150000, 150002), true);
    assert.equal(amountsMatch(150000, 150003), false);
  });

  it("looksLikePaystackSecret is strict", () => {
    assert.equal(looksLikePaystackSecret("sk_test_abc123"), true);
    assert.equal(looksLikePaystackSecret("sk_live_abc123"), true);
    assert.equal(looksLikePaystackSecret("pk_test_abc123"), false);
    assert.equal(looksLikePaystackSecret(""), false);
  });
});
