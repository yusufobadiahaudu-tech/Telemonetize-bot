import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extendPeriodEnd } from "./format.ts";

describe("extendPeriodEnd", () => {
  it("adds days onto a future period instead of replacing it", () => {
    const now = Date.parse("2026-08-31T11:00:00.000Z");
    const current = "2026-09-30T11:00:00.000Z";
    const next = extendPeriodEnd(current, 7, now);
    assert.equal(next, "2026-10-07T11:00:00.000Z");
  });

  it("starts from now when the current period has already ended", () => {
    const now = Date.parse("2026-08-31T11:00:00.000Z");
    const current = "2026-08-01T11:00:00.000Z";
    const next = extendPeriodEnd(current, 7, now);
    assert.equal(next, "2026-09-07T11:00:00.000Z");
  });
});
