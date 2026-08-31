import { createFileRoute } from "@tanstack/react-router";
import { runMoneyLoop } from "@/lib/server/loop";
import { requiredCronSecret } from "@/lib/server/production";

async function handle(request: Request) {
  const secret = requiredCronSecret();
  if (!secret) {
    return new Response("cron secret not configured", { status: 503 });
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const result = await runMoneyLoop();
  return Response.json({ ok: true, source: "cron", ...result });
}

export const Route = createFileRoute("/api/cron/loop")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
