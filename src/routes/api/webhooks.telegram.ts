import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { processTelegramUpdate } from "@/lib/server/telegram-bot";
import type { TelegramUpdate } from "@/lib/server/telegram-api";

function secretsMatch(expected: string, received: string | null) {
  if (!received || expected.length !== received.length) return false;
  let out = 0;
  for (let i = 0; i < expected.length; i += 1) out |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return out === 0;
}

async function handle(request: Request) {
  const sql = await getSql();
  const rows = await sql<{ telegram_webhook_secret: string | null }>`
    select telegram_webhook_secret from platform_bot where id = 'singleton' limit 1
  `;
  const expected = rows[0]?.telegram_webhook_secret || process.env.TELEGRAM_WEBHOOK_SECRET || "";
  const received = request.headers.get("x-telegram-bot-api-secret-token");
  if (expected && !secretsMatch(expected, received)) {
    return new Response("invalid secret", { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  try {
    await processTelegramUpdate(update);
  } catch (err) {
    console.error("[telegram webhook]", err);
  }
  return new Response("ok", { status: 200 });
}

export const Route = createFileRoute("/api/webhooks/telegram")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});
