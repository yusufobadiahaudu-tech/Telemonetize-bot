# Telemonetize-bot

You own **one** Telegram bot — `@TeleMonetizeBot`. Creators subscribe to it, get an ID (like `LA-ADA`), bind a group name and a global payout rail, then add this bot as admin. Members send that ID to the same bot. They pay in their currency. The charge confirms. The bot mints a one-time join link and kicks anyone who does not renew.

This is **not** the per-creator BotFather-token product. One token. One webhook. Every group.

## The loop

1. A creator subscribes — 14-day trial at 8%, or Pro at $15/month and 5%.
2. They get a creator ID and bind a group name + a payout rail to it — local bank in any supported country, mobile money (OPay, M-Pesa, MTN MoMo), PayPal, or Stripe — in the currency they want to receive. Member money for that ID settles there. Your take credits the operator Telegram wallet.
3. Customers send `LA-ADA` or the group name to `@TeleMonetizeBot`.
4. They pick their currency. Live FX plus a stated conversion fee. They pay by card, bank transfer, mobile money, or PayPal. **Checkout `initialize` runs first.** The join link is minted only on **`charge.success`**.
5. A server cron retries, warns, then `banChatMember`s and revokes the invite. `/loop` is a manual override.

Customers never see the split.

## Architecture

- `src/lib/bot/fsm.ts` — pure `(world, event) => { next, replies, effects }`.
- `src/lib/fx.ts` / `src/lib/server/fx-live.ts` — conversion quotes and live mid-market rates.
- `src/lib/payouts.ts` — global rails (bank, mobile money, PayPal, Stripe).
- `migrations/0002_schema.sql` + `0004_global_rails.sql` — payout rails and FX columns.

## Try the demo

Seeded desk: Adaeze’s **Lagos Alpha Circle** (`LA-ADA`).

Webhooks:

- `POST /api/webhooks/telegram`
- `POST /api/webhooks/paystack`
- `GET /api/fx`
- `POST /api/cron/loop`
