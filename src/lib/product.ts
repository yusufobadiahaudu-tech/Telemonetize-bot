import { BOT_USERNAME } from "./constants";

/**
 * Product decision: one platform bot.
 *
 * Members send a creator ID (LA-ADA) or the group name to @TeleMonetizeBot.
 * Creators subscribe on that same bot, receive an ID, bind a group name and a
 * bank, then add THIS bot as admin (Invite users + Ban users).
 *
 * Per-creator BotFather tokens (the private dashboard path) are a different
 * product and are not used here. One token. One webhook. Every group.
 */
export const PRODUCT = {
  model: "platform_bot" as const,
  botUsername: BOT_USERNAME,
};

export function botMention() {
  return `@${PRODUCT.botUsername}`;
}
