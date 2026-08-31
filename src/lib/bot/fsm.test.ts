import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADAEZE, SEED_COMMUNITIES, SEED_MEMBERS, SEED_PAYMENTS, SEED_PLANS, SEED_SUBS, YOU } from "../seed.ts";
import { numericTelegramId } from "../server/telegram-api.ts";
import { reduce } from "./fsm.ts";
import { issueBindToken, issueSlug, parseBindCommand, type World } from "./world.ts";

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

  it("routes simcharge to fulfill in the demo world — still no Zustand", () => {
    const result = reduce(world(), { type: "callback", payload: "simcharge:PSK_demo" });
    assert.deepEqual(result.effects, [{ type: "fulfill", reference: "PSK_demo" }]);
    assert.equal(result.replies.length, 0);
  });

  it("issues create_community after NG bank + NUBAN", () => {
    const base = world({
      role: "creator",
      pending: { kind: "await_community_bank", name: "Lagos Desk", priceUsd: 1500, platformPlan: "trial" },
    });
    const bank = reduce(base, { type: "callback", payload: "bank:058" });
    assert.equal(bank.pending?.kind, "await_community_nuban");
    const done = reduce({ ...base, pending: bank.pending }, { type: "input", text: "0123444421" });
    assert.equal(done.effects[0]?.type, "create_community");
    if (done.effects[0]?.type === "create_community") {
      assert.equal(done.effects[0].bankCode, "058");
      assert.equal(done.effects[0].accountNumber, "0123444421");
    }
  });

  it("quotes conversion before card or transfer — no mobile money", () => {
    const result = reduce(world(), { type: "callback", payload: "ccy:pln_la_premium:EUR" });
    assert.match(result.replies[0]?.text ?? "", /FX fee|You pay|List/);
    const payloads = result.replies[0]?.buttons?.flat().map((b) => b.payload) ?? [];
    assert.ok(payloads.some((p) => p.includes(":card")));
    assert.ok(payloads.some((p) => p.includes(":transfer")));
    assert.ok(!payloads.some((p) => p.includes("mobile_money")));
    assert.ok(!payloads.some((p) => p.includes("paypal")));
  });
});

describe("live FSM gates", () => {
  it("hides Adaeze, simcharge, and fail-card on a live world", () => {
    const w = world({ live: true });
    const start = reduce(w, { type: "input", text: "/start" });
    const startPayloads = start.replies[0]?.buttons?.flat().map((b) => b.payload) ?? [];
    assert.ok(!startPayloads.includes("as_adaeze"));
    assert.ok(!startPayloads.includes("take"));

    const sim = reduce(w, { type: "callback", payload: "simcharge:PSK_demo" });
    assert.equal(sim.effects.length, 0);
    assert.match(sim.replies[0]?.text ?? "", /Paystack/i);

    const ada = reduce(w, { type: "callback", payload: "as_adaeze" });
    assert.equal(ada.actingAs, "self");
    assert.match(ada.replies[0]?.text ?? "", /simulator/i);

    const fail = reduce(
      world({ live: true, actor: ADAEZE, role: "creator" }),
      { type: "callback", payload: "fail:ibrahim_ngn" },
    );
    assert.equal(fail.effects.length, 0);
    assert.match(fail.replies[0]?.text ?? "", /demo control is off/i);
  });

  it("yourTake requires operator in live mode", () => {
    const denied = reduce(world({ live: true, operator: false, role: "creator" }), {
      type: "input",
      text: "/take",
    });
    assert.match(denied.replies[0]?.text ?? "", /owns this bot/i);
    const allowed = reduce(world({ live: true, operator: true, role: "creator" }), {
      type: "input",
      text: "/take",
    });
    assert.match(allowed.replies[0]?.text ?? "", /wallet/i);
  });
});

describe("slug and bind tokens", () => {
  it("issueSlug collides to -2 then -3", () => {
    const taken = new Set(["lagos-desk"]);
    const second = issueSlug("Lagos Desk", taken);
    assert.equal(second, "lagos-desk-2");
    taken.add(second);
    assert.equal(issueSlug("Lagos Desk", taken), "lagos-desk-3");
  });

  it("parseBindCommand accepts /bind TOKEN from a group", () => {
    assert.equal(parseBindCommand("/bind BIND-AB12CD"), "BIND-AB12CD");
    assert.equal(parseBindCommand("/bind@TeleMonetizeBot BIND-zz99"), "BIND-ZZ99");
    assert.equal(parseBindCommand("/bind not-a-token"), null);
    assert.ok(issueBindToken().startsWith("BIND-"));
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
