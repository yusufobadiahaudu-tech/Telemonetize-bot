import { createFileRoute } from "@tanstack/react-router";
import { quoteConversion } from "@/lib/fx";
import type { Currency } from "@/lib/currency";
import { isCurrency } from "@/lib/currency";
import { getRateBook } from "@/lib/server/fx-live";

async function handle(request: Request) {
  const url = new URL(request.url);
  const pay = url.searchParams.get("pay") ?? "USD";
  const payout = url.searchParams.get("payout") ?? "USD";
  const usd = Number(url.searchParams.get("usd") ?? "1500");
  const feeBps = Number(url.searchParams.get("feeBps") ?? "800");
  if (!isCurrency(pay) || !isCurrency(payout) || !Number.isFinite(usd) || usd < 0) {
    return Response.json({ error: "bad quote" }, { status: 400 });
  }
  const rates = await getRateBook();
  const quote = quoteConversion({
    listUsdCents: Math.round(usd),
    payCurrency: pay as Currency,
    payoutCurrency: payout as Currency,
    platformFeeBps: Number.isFinite(feeBps) ? feeBps : 800,
    book: rates.book,
    source: rates.source,
    asOf: rates.asOf,
  });
  return Response.json({ ok: true, quote, bookUpdatedAt: rates.asOf, source: rates.source });
}

export const Route = createFileRoute("/api/fx")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
    },
  },
});
