import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  demoPaymentsEnabled,
  isOperatorActor,
  isProdDeploy,
  nextFulfillAction,
} from "./production.ts";

const snapshot = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  NODE_ENV: process.env.NODE_ENV,
  ALLOW_DEMO_PAYMENTS: process.env.ALLOW_DEMO_PAYMENTS,
  OPERATOR_TELEGRAM_ID: process.env.OPERATOR_TELEGRAM_ID,
};

afterEach(() => {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("fail-closed production switches", () => {
  it("treats Vercel production as prod even when NODE_ENV is production on preview", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.NODE_ENV = "production";
    assert.equal(isProdDeploy(), false);
    process.env.VERCEL_ENV = "production";
    assert.equal(isProdDeploy(), true);
  });

  it("never enables demo payments on the production deploy", () => {
    process.env.VERCEL_ENV = "production";
    process.env.ALLOW_DEMO_PAYMENTS = "1";
    assert.equal(demoPaymentsEnabled(), false);
  });

  it("enables demo payments only on non-prod with the flag", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.ALLOW_DEMO_PAYMENTS = "1";
    assert.equal(demoPaymentsEnabled(), true);
    process.env.ALLOW_DEMO_PAYMENTS = "0";
    assert.equal(demoPaymentsEnabled(), false);
  });

  it("claim-then-fulfill: pending fulfills, success skips, processing rejects", () => {
    assert.equal(nextFulfillAction("pending"), "fulfill");
    assert.equal(nextFulfillAction("success"), "skip");
    assert.equal(nextFulfillAction("processing"), "reject");
    assert.equal(nextFulfillAction("failed"), "reject");
  });

  it("matches operator Telegram ids with or without tg- prefix", () => {
    process.env.OPERATOR_TELEGRAM_ID = "701005,999";
    assert.equal(isOperatorActor({ id: "tg-701005", telegramUserId: "701005" }), true);
    assert.equal(isOperatorActor({ id: "tg-111", telegramUserId: "111" }), false);
  });
});
