import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { fulfillPayment } from "@/lib/server/access";
import { demoPaymentsEnabled } from "@/lib/server/production";

async function handle(request: Request) {
  if (!demoPaymentsEnabled()) {
    return new Response("Not found", { status: 404 });
  }
  const url = new URL(request.url);
  const reference = url.searchParams.get("ref");
  if (!reference) return new Response("missing ref", { status: 400 });

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
  if (!payment) {
    return new Response("Unknown checkout. Pay from the bot, then return here to simulate charge.success.", {
      status: 404,
    });
  }
  if (payment.status !== "success") {
    await fulfillPayment(payment);
  }
  return new Response(
    `charge.success recorded for ${reference}. Return to @TeleMonetizeBot — the join link is there.`,
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/demo/paystack")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
