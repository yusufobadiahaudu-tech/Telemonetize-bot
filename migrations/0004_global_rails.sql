-- Global payout rails + FX quote columns. Money stays USD cents on amount.
-- Customer charge and creator settlement are stored in their own currencies.

alter table creators add column if not exists payout_rail text;
alter table creators add column if not exists payout_country text;
alter table creators add column if not exists payout_currency text not null default 'USD';
alter table creators add column if not exists payout_handle text;
alter table creators add column if not exists fx_fee_bps integer not null default 150;

update creators
set
  payout_rail = coalesce(payout_rail, case when payout_connected then 'bank' else null end),
  payout_country = coalesce(payout_country, case when bank_code is not null then 'NG' else null end),
  payout_currency = coalesce(nullif(payout_currency, ''), currency_default, 'USD'),
  payout_handle = coalesce(payout_handle, account_number)
where true;

alter table payments add column if not exists payout_currency text;
alter table payments add column if not exists fx_rate numeric;
alter table payments add column if not exists fx_fee_bps integer not null default 0;
alter table payments add column if not exists fx_fee_minor integer not null default 0;
alter table payments add column if not exists payout_minor integer not null default 0;
alter table payments add column if not exists rate_source text not null default 'book';

alter table platform_bot add column if not exists stripe_secret_key text;
alter table platform_bot add column if not exists paypal_client_id text;
alter table platform_bot add column if not exists paypal_secret text;
