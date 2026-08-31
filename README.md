# Telemonetize-bot

You own **one** Telegram bot — `@TeleMonetizeBot`. Creators subscribe to it, get an ID (like `LA-ADA`), bind a Nigerian bank account, then add this bot as admin. Members send that ID to the same bot. They pay in their currency. The charge confirms. The bot mints a one-time join link and kicks anyone who does not renew.

This is **not** the per-creator BotFather-token product. One token. One webhook. Every group.

Live payouts are **Nigerian bank + Paystack subaccount**. Other rails (PayPal, M-Pesa, Stripe) are paused until each one has a settlement API.

## The loop

1. A creator subscribes — 14-day trial at 8%, or Pro at $15/month and 5%.
2. They get a creator ID and attach a NUBAN. Paystack `resolve` + `subaccount` puts member money on that account. Your take credits the operator Telegram wallet.
3. They add `@TeleMonetizeBot` as admin **from the Telegram account that owns the ID**, or send `/bind TOKEN` in the group. The bot does **not** bind by title match.
4. Customers send `LA-ADA` or the group name to `@TeleMonetizeBot`.
5. They pick their currency. Live FX plus a stated conversion fee. They pay by **card or bank transfer**. **Checkout `initialize` runs first.** The join link is minted only on **`charge.success`**.
6. A server cron charges stored Paystack `authorization_code`s, retries, warns, then `banChatMember`s and revokes the invite. `/loop` is a manual override. Cron never inserts a local success.

Customers never see the split.

## Architecture

- `src/lib/bot/fsm.ts` — pure `(world, event) => { next, replies, effects }`. No Zustand, no React. Live worlds hide Adaeze / simcharge.
- `src/lib/bot/engine.ts` — Telegram simulator adapter (web playground).
- `src/lib/server/telegram-bot.ts` — live webhook drives the same FSM with `{ live: true }`.
- `src/lib/server/access.ts` — checkout initialize + webhook fulfill (`pending` → `processing` → `success`) + `createChatInviteLink`.
- `src/lib/fx.ts` / `src/lib/server/fx-live.ts` — conversion quotes and live mid-market rates.
- `src/lib/server/loop.ts` — cron job at `GET|POST /api/cron/loop`.
- `migrations/0002_schema.sql` + `0004_global_rails.sql` + `0005_hardening.sql` — unique `provider_ref`, authorizations, bind tokens.

## Production env (fail-closed)

Required on the production deploy. Missing secrets return 401/503 — they do not fall through to demo money.

| Variable | Purpose |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Platform bot |
| `TELEGRAM_WEBHOOK_SECRET` | `x-telegram-bot-api-secret-token` |
| `PAYSTACK_SECRET_KEY` | Checkout, verify, charge_authorization, resolve, subaccount |
| `CRON_SECRET` | `Authorization: Bearer` on `/api/cron/loop` |
| `OPERATOR_TELEGRAM_ID` | Telegram user id(s) allowed to `/take` |
| `DATABASE_URL` | Neon |

Optional: `PAYSTACK_PUBLIC_KEY`. `ALLOW_DEMO_PAYMENTS=1` unlocks simcharge / `/api/demo/paystack` on **preview and local only** — ignored when `VERCEL_ENV=production`.

## Try the demo

Seeded desk: Adaeze’s **Lagos Alpha Circle** (`LA-ADA`). Web simulator only.

- Pay as a customer (initialize, then simulate `charge.success`), then kick non-renewals.
- Open the bot and send `LA-ADA` or `Lagos Alpha`.
- Claim a creator ID, or walk Adaeze’s desk and run `/loop`.

## Run locally

```bash
npm install
npm run dev
npm test
```

Auth stays off. Postgres (Neon in production, PGLite in preview) holds creators, plans, members, and payments.

Webhooks:

- `POST /api/webhooks/telegram`
- `POST /api/webhooks/paystack`
- `GET /api/fx`
- `GET|POST /api/cron/loop`
