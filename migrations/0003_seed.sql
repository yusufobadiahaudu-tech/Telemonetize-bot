-- Demo desk: Adaeze LA-ADA + Kemi NOLLY. Matches src/lib/seed.ts.

insert into creators (
  id, user_id, slug, code, name, bio, category, fee_bps, platform_plan,
  telegram_chat_id, telegram_chat_title, telegram_chat_type, is_public,
  bank_name, bank_code, account_number, account_name, payout_connected, payout_connected_at
) values
  (
    'cre_lagos_alpha', '600001', 'lagos-alpha', 'LA-ADA', 'Lagos Alpha Circle',
    'Private research desk for Nigerian equities, FX, and alternatives.',
    'Trading', 500, 'pro', '-1001', 'Lagos Alpha Circle', 'group', true,
    'Guaranty Trust Bank', '058', '0123444421', 'ADAEZE OKONKWO', true, now() - interval '30 days'
  ),
  (
    'cre_nolly', '600002', 'nolly-unlocked', 'NOLLY', 'Nollywood Unlocked',
    'Early screeners, director AMAs, and festival tickets.',
    'Entertainment', 1000, 'starter', '-1002', 'Nollywood Unlocked', 'channel', true,
    'Zenith Bank', '057', '2088123340', 'KEMI ADEYEMI', true, now() - interval '20 days'
  )
on conflict (id) do nothing;

insert into plans (id, creator_id, name, description, interval, price_usd, is_active, sort_order) values
  ('pln_la_basic', 'cre_lagos_alpha', 'Basic', 'Daily market brief and weekend recap.', 'monthly', 500, true, 1),
  ('pln_la_premium', 'cre_lagos_alpha', 'Premium', 'Live trade alerts, watchlists, and the private research group.', 'monthly', 1500, true, 2),
  ('pln_la_vip', 'cre_lagos_alpha', 'VIP Desk', 'Direct desk access, monthly office hours, priority alerts.', 'yearly', 18000, true, 3),
  ('pln_nu_circle', 'cre_nolly', 'Inner Circle', 'Screener drops and member AMAs.', 'monthly', 400, true, 1),
  ('pln_nu_patron', 'cre_nolly', 'Patron', 'Festival tickets pool plus a yearly director salon.', 'yearly', 4000, true, 2)
on conflict (id) do nothing;

insert into telegram_members (
  id, creator_id, user_id, telegram_user_id, telegram_username, display_name,
  status, invite_token, invite_url, joined_at, removed_at, remove_reason
) values
  ('tgm_la_01', 'cre_lagos_alpha', '701001', '701001', 'chinedu_fx', 'Chinedu Okafor', 'active', 'inv_la_01', 'https://t.me/+inv_la_01', now() - interval '40 days', null, null),
  ('tgm_la_02', 'cre_lagos_alpha', '701002', '701002', 'zainab_mkt', 'Zainab Bello', 'active', 'inv_la_02', 'https://t.me/+inv_la_02', now() - interval '28 days', null, null),
  ('tgm_la_03', 'cre_lagos_alpha', '701003', '701003', 'tunde_alpha', 'Tunde Bakare', 'active', 'inv_la_03', 'https://t.me/+inv_la_03', now() - interval '18 days', null, null),
  ('tgm_la_04', 'cre_lagos_alpha', '701004', '701004', 'amaka_eq', 'Amaka Eze', 'active', 'inv_la_04', 'https://t.me/+inv_la_04', now() - interval '12 days', null, null),
  ('tgm_la_05', 'cre_lagos_alpha', '701005', '701005', 'ibrahim_ngn', 'Ibrahim Musa', 'active', 'inv_la_05', 'https://t.me/+inv_la_05', now() - interval '9 days', null, null),
  ('tgm_la_06', 'cre_lagos_alpha', '701006', '701006', 'folake_desk', 'Folake Adeyemi', 'removed', 'inv_la_06', '', now() - interval '60 days', now() - interval '4 days', 'subscription_expired'),
  ('tgm_la_07', 'cre_lagos_alpha', '701007', '701007', 'kelvin_opt', 'Kelvin Mensah', 'active', 'inv_la_07', 'https://t.me/+inv_la_07', now() - interval '6 days', null, null),
  ('tgm_nu_01', 'cre_nolly', '801001', '801001', 'bisi_films', 'Bisi Adebayo', 'active', 'inv_nu_01', 'https://t.me/+inv_nu_01', now() - interval '21 days', null, null),
  ('tgm_nu_02', 'cre_nolly', '801002', '801002', 'david_screen', 'David Okoro', 'active', 'inv_nu_02', 'https://t.me/+inv_nu_02', now() - interval '14 days', null, null),
  ('tgm_nu_03', 'cre_nolly', '801003', '801003', 'lola_ama', 'Lola Shittu', 'pending', 'inv_nu_03', 'https://t.me/+inv_nu_03', null, null, null)
on conflict (id) do nothing;

insert into subscriptions (
  id, user_id, creator_id, plan_id, status, auto_renew,
  current_period_start, current_period_end, telegram_user_id, telegram_username,
  retry_count, card_failing
) values
  ('sub_la_01', '701001', 'cre_lagos_alpha', 'pln_la_premium', 'active', true, now() - interval '20 days', now() + interval '10 days', '701001', 'chinedu_fx', 0, false),
  ('sub_la_02', '701002', 'cre_lagos_alpha', 'pln_la_basic', 'active', true, now() - interval '8 days', now() + interval '22 days', '701002', 'zainab_mkt', 0, false),
  ('sub_la_03', '701003', 'cre_lagos_alpha', 'pln_la_vip', 'active', true, now() - interval '80 days', now() + interval '285 days', '701003', 'tunde_alpha', 0, false),
  ('sub_la_04', '701004', 'cre_lagos_alpha', 'pln_la_premium', 'active', true, now() - interval '2 days', now() + interval '28 days', '701004', 'amaka_eq', 0, false),
  ('sub_la_05', '701005', 'cre_lagos_alpha', 'pln_la_basic', 'past_due', false, now() - interval '35 days', now() - interval '5 days', '701005', 'ibrahim_ngn', 1, true),
  ('sub_la_06', '701006', 'cre_lagos_alpha', 'pln_la_premium', 'expired', false, now() - interval '64 days', now() - interval '4 days', '701006', 'folake_desk', 0, false),
  ('sub_la_07', '701007', 'cre_lagos_alpha', 'pln_la_premium', 'active', true, now() - interval '6 days', now() + interval '24 days', '701007', 'kelvin_opt', 0, false),
  ('sub_nu_01', '801001', 'cre_nolly', 'pln_nu_circle', 'active', true, now() - interval '10 days', now() + interval '20 days', '801001', 'bisi_films', 0, false),
  ('sub_nu_02', '801002', 'cre_nolly', 'pln_nu_patron', 'active', true, now() - interval '40 days', now() + interval '325 days', '801002', 'david_screen', 0, false)
on conflict (id) do nothing;

insert into payments (
  id, user_id, creator_id, subscription_id, plan_id, amount, currency, charged_minor,
  provider, provider_ref, status, platform_fee, creator_payout, settlement_status, settled_at, created_at
) values
  ('pay_la_01', '701001', 'cre_lagos_alpha', 'sub_la_01', 'pln_la_premium', 1500, 'USD', 1500, 'card', 'PSK_la_01', 'success', 75, 1425, 'wallet_and_bank', now() - interval '40 days', now() - interval '40 days'),
  ('pay_la_02', '701001', 'cre_lagos_alpha', 'sub_la_01', 'pln_la_premium', 1500, 'USD', 1500, 'card', 'PSK_la_02', 'success', 75, 1425, 'wallet_and_bank', now() - interval '20 days', now() - interval '20 days'),
  ('pay_la_03', '701002', 'cre_lagos_alpha', 'sub_la_02', 'pln_la_basic', 500, 'NGN', 775000, 'transfer', 'PSK_la_03', 'success', 25, 475, 'wallet_and_bank', now() - interval '28 days', now() - interval '28 days'),
  ('pay_la_07', '701005', 'cre_lagos_alpha', 'sub_la_05', 'pln_la_basic', 500, 'USD', 500, 'card', 'PSK_la_07', 'failed', 0, 0, 'unsplit', null, now() - interval '5 days'),
  ('pay_nu_01', '801001', 'cre_nolly', 'sub_nu_01', 'pln_nu_circle', 400, 'USD', 400, 'transfer', 'PSK_nu_01', 'success', 40, 360, 'wallet_and_bank', now() - interval '21 days', now() - interval '21 days')
on conflict (id) do nothing;

insert into keyword_filters (id, creator_id, keyword, action) values
  ('kw_la_01', 'cre_lagos_alpha', 'guaranteed returns', 'remove'),
  ('kw_la_02', 'cre_lagos_alpha', 'whatsapp me', 'flag'),
  ('kw_la_03', 'cre_lagos_alpha', 'pump', 'flag'),
  ('kw_nu_01', 'cre_nolly', 'free download', 'remove')
on conflict (id) do nothing;

update platform_bot set wallet_usd = 215 where id = 'singleton';
