# Telemonetize-bot

You own one Telegram bot. Creators pay you to use it. Their members pay them. The bot runs the door.

**TeleMonetize** is a Telegram group-monetization product: creators subscribe to your bot, receive a creator ID, bind a group name, send customers to the bot, and the bot admits paying members and kicks anyone who does not renew.

## The loop

1. A creator (Mr. A) subscribes — 14-day trial at 8%, or Pro at $15/month and 5%.
2. He gets a creator ID (for example `LA-ADA`) and binds his group name to it.
3. He tells customers: send `LA-ADA` or the group name to `@TeleMonetizeBot`.
4. They pay. The bot sends a one-time join link.
5. If they do not renew, the bot retries, warns, then kicks them.

You keep 5–10% of every card payment, plus $15/month from every Pro creator. Member money splits to the creator’s Nigerian bank at Paystack or Flutterwave. Telegram Stars settle to the creator.

## Try the demo

This repo ships an interactive bot (not a live Telegram webhook). Seeded desk: Adaeze’s **Lagos Alpha Circle** (`LA-ADA`).

- Pay as a customer, then kick non-renewals on the home page.
- Open the bot and send `LA-ADA` or `Lagos Alpha`.
- Claim a creator ID, or walk Adaeze’s desk and run `/loop`.

## Run locally

```bash
npm install
npm run dev
```

The app listens on `0.0.0.0:8080`.

```bash
npm run typecheck
npm run build
```

Auth and the database stay off in this demo. State lives in the browser.

## Stack

React 19, TanStack Start, Tailwind v4, Zustand. Payments and Telegram kicks are simulated in the bot engine (`src/lib/bot/engine.ts`).
