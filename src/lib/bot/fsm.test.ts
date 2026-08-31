import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADAEZE, SEED_COMMUNITIES, SEED_MEMBERS, SEED_PAYMENTS, SEED_PLANS, SEED_SUBS, YOU } from "../seed.ts";
import { numericTelegramId } from "../server/telegram-api.ts";
import { reduce } from "./fsm.ts";
import type { World } from "./world.ts";

function world(over: Partial<World> = {}): World {
  return {
    actor: YOU,
    role: "member",
    actingAs: "self",
    pending: null,
    communities: SEED_COMMUNITIES,
    plans: SEED_PLANS,
    members: SEED_MEMBERS,
    subscriptions: SEED_SUBS,
    payments: SEED_PAYMENTS,
    keywords: [],
    modEvents: [],
    reminded: [],
    now: Date.now(),
    ...over,
  };
}

describe("bot FSM", () => {
  it("is a pure (world, event) => result module", () => {
    const w = world();
    const first = reduce(w, { type: "input", text: "LA-ADA" });
    const second = reduce(w, { type: "input", text: "LA-ADA" });
    assert.equal(first.replies[0]?.text, second.replies[0]?.text);
    assert.ok(first.replies[0]?.text.includes("LA-ADA"));
    assert.equal(first.effects.length, 0);
  });

  it("/start is the full three-party loop, not a web-checkout pointer", () => {
    const result = reduce(world(), { type: "input", text: "/start" });
    assert.equal(result.effects.length, 0);
    const text = result.replies[0]?.text ?? "";
    assert.ok(/LA-ADA/.test(text));
    assert.ok(/Paystack|charge\.success/i.test(text));
    assert.ok(!/telemonetize\.app\/checkout/i.test(text));
    assert.ok(result.replies[0]?.buttons?.some((row) => row.some((b) => b.payload === "discover")));
  });

  it("does not mint a seat on pay — it emits a Paystack checkout effect", () => {
    const result = reduce(world(), {
      type: "callback",
      payload: "pay:pln_la_premium:USD:card",
    });
    assert.equal(result.effects.length, 1);
    assert.equal(result.effects[0]?.type, "checkout");
    if (result.effects[0]?.type === "checkout") {
      assert.equal(result.effects[0].planId, "pln_la_premium");
      assert.equal(result.effects[0].provider, "card");
    }
    assert.ok(result.replies.some((r) => /Paystack|charge\.success/i.test(r.text)));
    assert.equal(
      world().members.some((m) => m.userId === YOU.id && m.status === "active"),
      false,
    );
  });

  it("I've paid still emits checkout — join link waits for charge.success", () => {
    const result = reduce(world(), {
      type: "callback",
      payload: "paid:pln_la_premium:USD:transfer",
    });
    assert.equal(result.effects[0]?.type, "checkout");
    if (result.effects[0]?.type === "checkout") {
      assert.equal(result.effects[0].provider, "transfer");
    }
  });

  it("routes /loop to a run_loop effect instead of kicking inline", () => {
    const result = reduce(world({ actor: ADAEZE, role: "creator", actingAs: "adaeze" }), {
      type: "input",
      text: "/loop",
    });
    assert.ok(result.effects.some((e) => e.type === "run_loop"));
    assert.ok(result.replies[0]?.text.toLowerCase().includes("cron"));
  });

  it("/kick emits a kick effect and does not mutate world", () => {
    const w = world({ actor: ADAEZE, role: "creator", actingAs: "adaeze" });
    const before = w.members.find((m) => m.username === "ibrahim_ngn")?.status;
    const result = reduce(w, { type: "input", text: "/kick ibrahim_ngn" });
    assert.deepEqual(
      result.effects.filter((e) => e.type === "kick"),
      [{ type: "kick", username: "ibrahim_ngn" }],
    );
    assert.equal(w.members.find((m) => m.username === "ibrahim_ngn")?.status, before);
  });

  it("routes simcharge to fulfill — still no Zustand", () => {
    const result = reduce(world(), { type: "callback", payload: "simcharge:PSK_demo" });
    assert.deepEqual(result.effects, [{ type: "fulfill", reference: "PSK_demo" }]);
    assert.equal(result.replies.length, 0);
  });

  it("walks rail → country → currency → PayPal handle for a new creator ID", () => {
    let w = world({
      pending: { kind: "await_community_rail", name: "Berlin Desk", priceUsd: 2000, platformPlan: "trial" },
      role: "creator",
    });
    const rail = reduce(w, { type: "callback", payload: "crail:paypal" });
    assert.equal(rail.pending?.kind, "await_community_country");
    w = { ...w, pending: rail.pending };
    const country = reduce(w, { type: "callback", payload: "pcountry:DE".replace("DE", "EU") });
    assert.equal(country.pending?.kind, "await_community_currency");
    w = { ...w, pending: country.pending };
    const settle = reduce(w, { type: "callback", payload: "settle:EUR" });
    assert.equal(settle.pending?.kind, "await_community_handle");
    w = { ...w, pending: settle.pending };
    const done = reduce(w, { type: "input", text: "ada@example.com" });
    assert.equal(done.effects[0]?.type, "create_community");
    if (done.effects[0]?.type === "create_community") {
      assert.equal(done.effects[0].payout?.rail, "paypal");
      assert.equal(done.effects[0].payout?.currency, "EUR");
      assert.equal(done.effects[0].payout?.handle, "ada@example.com");
    }
  });

  it("changes an existing ID to M-Pesa without minting a new community", () => {
    const base = world({
      actor: ADAEZE,
      role: "creator",
      actingAs: "adaeze",
      pending: { kind: "await_payout_rail" },
    });
    const rail = reduce(base, { type: "callback", payload: "rail:mobile_money" });
    assert.equal(rail.pending?.kind, "await_payout_country");
    const country = reduce({ ...base, pending: rail.pending }, { type: "callback", payload: "pcountry:KE" });
    assert.equal(country.pending?.kind, "await_payout_currency");
    const settle = reduce({ ...base, pending: country.pending }, { type: "callback", payload: "settle:KES" });
    assert.equal(settle.pending?.kind, "await_payout_handle");
    const handle = reduce({ ...base, pending: settle.pending }, { type: "input", text: "254711000000" });
    assert.equal(handle.effects[0]?.type, "connect_payout");
    if (handle.effects[0]?.type === "connect_payout") {
      assert.equal(handle.effects[0].payout.rail, "mobile_money");
      assert.equal(handle.effects[0].payout.country, "KE");
      assert.equal(handle.effects[0].payout.currency, "KES");
    }
  });

  it("quotes conversion before emitting a mobile-money checkout", () => {
    const result = reduce(world(), { type: "callback", payload: "ccy:pln_la_premium:EUR" });
    assert.match(result.replies[0]?.text ?? "", /FX fee|You pay|List/);
    assert.ok(result.replies[0]?.buttons?.some((row) => row.some((b) => b.payload.includes("mobile_money"))));
  });
});

describe("numericTelegramId", () => {
  it("strips the tg- prefix used as actor ids", () => {
    assert.equal(numericTelegramId("tg-701005"), "701005");
    assert.equal(numericTelegramId("701005"), "701005");
    assert.equal(numericTelegramId("you"), null);
    assert.equal(numericTelegramId(null), null);
  });
});
