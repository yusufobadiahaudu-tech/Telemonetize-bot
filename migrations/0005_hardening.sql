-- Production hardening: unique payment refs, card authorizations, owner-proof group bind.

delete from payments a
using payments b
where a.provider_ref is not null
  and a.provider_ref = b.provider_ref
  and a.ctid < b.ctid;

create unique index if not exists payments_provider_ref_unique
  on payments (provider_ref)
  where provider_ref is not null;

alter table payments add column if not exists authorization_code text;
alter table subscriptions add column if not exists authorization_code text;
alter table subscriptions add column if not exists authorization_email text;
alter table subscriptions add column if not exists authorization_currency text;

alter table creators add column if not exists bind_token text;
create unique index if not exists creators_bind_token_idx
  on creators (bind_token)
  where bind_token is not null;
