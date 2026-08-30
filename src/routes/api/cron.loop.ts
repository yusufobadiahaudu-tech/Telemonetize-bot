import { createFileRoute } from "@tanstack/react-router";
import { runMoneyLoop } from "@/lib/server/loop";

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return new Response("unauthorized", { status: 401 });
    }
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
