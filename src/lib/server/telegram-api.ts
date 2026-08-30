export function looksLikeBotToken(token: string) {
  return /^\d{6,12}:[A-Za-z0-9_-]{20,}$/.test(token.trim());
}

/** Numeric Telegram user id. Accepts `123456789` or `tg-123456789`. */
export function numericTelegramId(value: string | null | undefined): string | null {
  if (!value) return null;
  const stripped = value.trim().replace(/^tg-/i, "");
  return /^\d{5,}$/.test(stripped) ? stripped : null;
}

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  date: number;
  text?: string;
  from?: TelegramUser;
  chat: TelegramChat;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  my_chat_member?: {
    chat: TelegramChat;
    from?: TelegramUser;
    new_chat_member: { user: TelegramUser; status: string };
  };
  chat_member?: {
    chat: TelegramChat;
    new_chat_member: { user: TelegramUser; status: string };
  };
};

type TgOk<T> = { ok: true; result: T };
type TgErr = { ok: false; description?: string; error_code?: number };

async function tg<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as TgOk<T> | TgErr;
  if (!json.ok) {
    throw new Error(json.description || `Telegram ${method} failed`);
  }
  return json.result;
}

export async function getMe(token: string) {
  return tg<TelegramUser & { username?: string }>(token, "getMe");
}

export async function getChat(token: string, chatId: string | number) {
  return tg<TelegramChat>(token, "getChat", { chat_id: chatId });
}

export async function setWebhook(token: string, url: string, secretToken: string) {
  return tg<boolean>(token, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query", "my_chat_member", "chat_member"],
    drop_pending_updates: false,
  });
}

export async function deleteWebhook(token: string) {
  return tg<boolean>(token, "deleteWebhook", { drop_pending_updates: false });
}

export async function createChatInviteLink(token: string, chatId: string | number, name: string) {
  const expire = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  return tg<{ invite_link: string; name?: string }>(token, "createChatInviteLink", {
    chat_id: chatId,
    name: name.slice(0, 32),
    expire_date: expire,
    member_limit: 1,
  });
}

export async function revokeChatInviteLink(
  token: string,
  chatId: string | number,
  inviteLink: string,
) {
  return tg<{ invite_link: string }>(token, "revokeChatInviteLink", {
    chat_id: chatId,
    invite_link: inviteLink,
  });
}

export async function banChatMember(token: string, chatId: string | number, userId: string | number) {
  await tg<boolean>(token, "banChatMember", { chat_id: chatId, user_id: userId });
  try {
    await tg<boolean>(token, "unbanChatMember", {
      chat_id: chatId,
      user_id: userId,
      only_if_banned: true,
    });
  } catch {
    // Already unbanned or not a supergroup.
  }
}

export type InlineKeyboard = { text: string; callback_data?: string; url?: string }[][];

export async function sendMessage(
  token: string,
  chatId: string | number,
  text: string,
  keyboard?: InlineKeyboard,
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: text.slice(0, 3900),
    disable_web_page_preview: true,
  };
  if (keyboard?.length) {
    body.reply_markup = {
      inline_keyboard: keyboard.map((row) =>
        row.map((b) =>
          b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: (b.callback_data ?? "").slice(0, 64) },
        ),
      ),
    };
  }
  return tg<TelegramMessage>(token, "sendMessage", body);
}

export async function answerCallbackQuery(token: string, id: string, text?: string) {
  return tg<boolean>(token, "answerCallbackQuery", {
    callback_query_id: id,
    text: text?.slice(0, 180),
  });
}

export async function deleteMessage(token: string, chatId: string | number, messageId: number) {
  return tg<boolean>(token, "deleteMessage", { chat_id: chatId, message_id: messageId });
}

export function webhookSecret(): string {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return `tm_${raw}`;
}
