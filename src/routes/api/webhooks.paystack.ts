import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { fulfillPayment } from "@/lib/server/access";
import { amountsMatch, getPaystackKeys, verifyPaystackSignature, verifyTransaction } from "@/lib/server/paystack";

async function handle(request: Request) {
  const keys = await getPaystackKeys();
  if (!keys) {
    return new Response("paystack not configured", { status: 503 });
  }
  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (!verifyPaystackSignature(raw, signature, keys.secret)) {
    return new Response("invalid signature", { status: 401 });
  }

  let body: { event?: string; data?: { reference?: string } } = {};
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const reference = body.data?.reference;
  if (!reference) return new Response("ignored", { status: 200 });

  const sql = await getSql();
  const payments = await sql<{
    id: string;
    user_id: string;
    creator_id: string;
    subscription_id: string | null;
    plan_id: string;
    amount: number;
    currency: string;
    charged_minor: number;
    provider: string;
    provider_ref: string | null;
    status: string;
  }>`select * from payments where provider_ref = ${reference} limit 1`;
  const payment = payments[0];
  if (!payment) return new Response("unknown", { status: 200 });
  if (payment.status === "success") return new Response("ok", { status: 200 });

  const event = body.event ?? "";
  if (event.includes("failed") || event.includes("abandoned")) {
    await sql`update payments set status = 'failed', settlement_status = 'unsplit' where id = ${payment.id} and status = 'pending'`;
    return new Response("failed", { status: 200 });
  }

  if (event && event !== "charge.success" && !event.includes("success")) {
    return new Response("ignored", { status: 200 });
  }

  let verified;
  try {
    verified = await verifyTransaction(reference);
  } catch {
    return new Response("verify failed", { status: 502 });
  }
  if (verified.status !== "success") {
    await sql`update payments set status = 'failed' where id = ${payment.id} and status = 'pending'`;
    return new Response("not success", { status: 200 });
  }
  if (payment.charged_minor > 0 && !amountsMatch(payment.charged_minor, verified.amount)) {
    await sql`update payments set status = 'failed', settlement_status = 'unsplit' where id = ${payment.id} and status = 'pending'`;
    return new Response("amount mismatch", { status: 200 });
  }

  await fulfillPayment(payment, null, {
    amount: verified.amount,
    currency: verified.currency,
    authorizationCode: verified.authorizationCode,
    email: verified.email,
  });
  return new Response("ok", { status: 200 });
}

export const Route = createFileRoute("/api/webhooks/paystack")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});
