export const APP_NAME = "TeleMonetize";
export const APP_TAGLINE =
  "You own the bot. Creators subscribe. Members pay. The bot runs the door.";
export const BOT_USERNAME = "TeleMonetizeBot";
export const BOT_CHAT_ID = "chat_bot";

export const PLATFORM_PLANS = [
  {
    id: "trial",
    name: "Trial",
    priceLabel: "14 days free",
    fee: "8% of each member payment",
    feeBps: 800,
    detail: "Mr. A tries the bot. You take 8% of every member who pays him.",
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "$15 / month",
    fee: "5% of each member payment",
    feeBps: 500,
    detail: "Mr. A pays you $15 every month. You take 5% of his members.",
  },
] as const;

export const COMMANDS = [
  { cmd: "/start", hint: "Open the bot", who: "any" },
  { cmd: "/help", hint: "How this bot makes you money", who: "any" },
  { cmd: "/join", hint: "Send a creator ID or group name", who: "member" },
  { cmd: "/discover", hint: "Browse creator IDs", who: "member" },
  { cmd: "/my", hint: "Your paid seats", who: "member" },
  { cmd: "/studio", hint: "Your creator ID and group", who: "creator" },
  { cmd: "/id", hint: "Share your creator ID", who: "creator" },
  { cmd: "/status", hint: "Seats and past due", who: "creator" },
  { cmd: "/members", hint: "Who is in the group", who: "creator" },
  { cmd: "/kick", hint: "Remove a seat", who: "creator" },
  { cmd: "/extend", hint: "Add days to a seat", who: "creator" },
  { cmd: "/payout", hint: "Account attached to this ID", who: "creator" },
  { cmd: "/loop", hint: "Run the money loop now (cron already does this)", who: "creator" },
  { cmd: "/take", hint: "Your Telegram wallet", who: "any" },
] as const;

export const SPAM_MARKERS = [
  "guaranteed",
  "whatsapp me",
  "click this link",
  "free download",
  "double your money",
  "pump this",
];
