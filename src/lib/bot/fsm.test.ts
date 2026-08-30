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
});

describe("numericTelegramId", () => {
  it("strips the tg- prefix used as actor ids", () => {
    assert.equal(numericTelegramId("tg-701005"), "701005");
    assert.equal(numericTelegramId("701005"), "701005");
    assert.equal(numericTelegramId("you"), null);
    assert.equal(numericTelegramId(null), null);
  });
});
