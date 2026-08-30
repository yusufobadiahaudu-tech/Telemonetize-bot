-- TeleMonetize — one platform bot. Money is integer minor units (USD cents).
-- Owners are keyed by telegram/demo user ids (text). No per-creator BotFather token.

create table if not exists creators (
  id text primary key,
  user_id text not null,
  slug text not null unique,
  code text not null unique,
  name text not null,
  bio text not null default '',
  category text not null default 'Community',
  currency_default text not null default 'USD',
  fee_bps integer not null default 800,
  platform_plan text not null default 'trial',
  trial_ends_at timestamptz,
  telegram_chat_id text,
  telegram_chat_title text,
  telegram_chat_type text not null default 'group',
  is_public boolean not null default true,
  bank_name text,
  bank_code text,
  account_number text,
  account_name text,
  payout_connected boolean not null default false,
  paystack_subaccount text,
  payout_connected_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists creators_slug_idx on creators (slug);
create index if not exists creators_code_idx on creators (code);
create index if not exists creators_user_id_idx on creators (user_id);

create table if not exists plans (
  id text primary key,
  creator_id text not null references creators(id) on delete cascade,
  name text not null,
  description text not null default '',
  interval text not null,
  price_usd integer not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists plans_creator_id_idx on plans (creator_id);

create table if not exists subscriptions (
  id text primary key,
  user_id text not null,
  creator_id text not null,
  plan_id text not null,
  status text not null,
  auto_renew boolean not null default true,
  current_period_start timestamptz,
  current_period_end timestamptz,
  telegram_user_id text,
  telegram_username text,
  retry_count integer not null default 0,
  card_failing boolean not null default false,
  last_dunning_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists subscriptions_user_id_idx on subscriptions (user_id);
create index if not exists subscriptions_creator_id_idx on subscriptions (creator_id);
create index if not exists subscriptions_status_idx on subscriptions (status);

create table if not exists payments (
  id text primary key,
  user_id text not null,
  creator_id text not null,
  subscription_id text,
  plan_id text not null,
  amount integer not null,
  currency text not null,
  charged_minor integer not null default 0,
  provider text not null,
  provider_ref text,
  status text not null,
  platform_fee integer not null default 0,
  creator_payout integer not null default 0,
  settlement_status text not null default 'unsplit',
  settled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_creator_id_idx on payments (creator_id);
create index if not exists payments_user_id_idx on payments (user_id);
create index if not exists payments_provider_ref_idx on payments (provider_ref);

create table if not exists telegram_accounts (
  id text primary key,
  user_id text not null unique,
  telegram_user_id text not null,
  telegram_username text,
  telegram_first_name text,
  pending_json text,
  role text not null default 'member',
  linked_at timestamptz not null default now()
);

create table if not exists telegram_members (
  id text primary key,
  creator_id text not null,
  user_id text,
  telegram_user_id text not null,
  telegram_username text,
  display_name text,
  status text not null,
  invite_token text unique,
  invite_url text,
  joined_at timestamptz,
  removed_at timestamptz,
  remove_reason text,
  created_at timestamptz not null default now()
);
create index if not exists telegram_members_creator_idx on telegram_members (creator_id);
create index if not exists telegram_members_invite_idx on telegram_members (invite_token);

create table if not exists keyword_filters (
  id text primary key,
  creator_id text not null,
  keyword text not null,
  action text not null default 'flag',
  created_at timestamptz not null default now()
);

create table if not exists moderation_events (
  id text primary key,
  creator_id text not null,
  telegram_user_id text,
  telegram_username text,
  message_text text not null,
  classification text not null,
  confidence real,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists bot_logs (
  id text primary key,
  creator_id text not null,
  event_type text not null,
  message text not null,
  meta text,
  created_at timestamptz not null default now()
);
create index if not exists bot_logs_creator_idx on bot_logs (creator_id, created_at desc);

create table if not exists reminders (
  id text primary key,
  subscription_id text not null,
  kind text not null,
  sent_at timestamptz not null default now()
);

create table if not exists platform_bot (
  id text primary key,
  telegram_bot_token text,
  telegram_bot_username text not null default 'TeleMonetizeBot',
  telegram_webhook_secret text,
  wallet_usd integer not null default 0,
  paystack_secret_key text,
  paystack_public_key text
);

insert into platform_bot (id, telegram_bot_username, wallet_usd)
values ('singleton', 'TeleMonetizeBot', 0)
on conflict (id) do nothing;
