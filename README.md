# Telemonetize-bot

You own **one** Telegram bot — `@TeleMonetizeBot`. Creators subscribe to it, get an ID (like `LA-ADA`), bind a group name and a bank, then add this bot as admin. Members send that ID to the same bot. They pay. Paystack confirms. The bot mints a one-time join link and kicks anyone who does not renew.

This is **not** the per-creator BotFather-token product. One token. One webhook. Every group.

## The loop

1. A creator subscribes — 14-day trial at 8%, or Pro at $15/month and 5%.
2. They get a creator ID and bind a group name + NUBAN to it. Member money for that ID settles to that account. Your take credits the operator Telegram wallet.
3. Customers send `LA-ADA` or the group name to `@TeleMonetizeBot`.
4. They pick a currency (USD first) and pay by card or bank transfer. **Paystack `initialize` runs first.** The join link is minted only on **`charge.success`**.
5. A server cron retries, warns, then `banChatMember`s and revokes the invite. `/loop` is a manual override.

Customers never see the split.

## Architecture

- `src/lib/bot/fsm.ts` — pure `(world, event) => { next, replies, effects }`. No Zustand, no React.
- `src/lib/bot/engine.ts` — Telegram simulator adapter.
- `src/lib/server/telegram-bot.ts` — `handlePrivateMessage` drives the same FSM.
- `src/lib/server/access.ts` — Paystack initialize + webhook fulfill + `createChatInviteLink`.
- `src/lib/server/loop.ts` — cron job at `POST /api/cron/loop`.
- `migrations/0002_schema.sql` — communities, plans, members, payments.

## Try the demo

Seeded desk: Adaeze’s **Lagos Alpha Circle** (`LA-ADA`).

- Pay as a customer (initialize, then simulate `charge.success`), then kick non-renewals.
- Open the bot and send `LA-ADA` or `Lagos Alpha`.
- Claim a creator ID, or walk Adaeze’s desk and run `/loop`.

## Run locally

```bash
npm install
npm run dev
```

Auth stays off. Postgres (Neon in production, PGLite in preview) holds creators, plans, members, and payments.

Webhooks:

- `POST /api/webhooks/telegram`
- `POST /api/webhooks/paystack`
- `POST /api/cron/loop`
