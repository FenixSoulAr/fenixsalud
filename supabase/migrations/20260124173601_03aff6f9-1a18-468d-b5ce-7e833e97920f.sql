-- Enable pgcrypto extension
create extension if not exists pgcrypto;

-- Helper function for updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Helper function to check if user is authenticated
create or replace function public.is_authenticated_user()
returns boolean
language sql
stable
set search_path = public
as $$
  select auth.uid() is not null;
$$;

-- Plans table
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_cents integer not null default 0,
  currency text not null default 'usd',
  billing_cycle text not null default 'none',
  stripe_price_id text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Subscriptions table
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null default 'active',
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  cancel_at_period_end boolean not null default false,
  provider text not null default 'stripe',
  stripe_customer_id text null,
  stripe_subscription_id text null unique,
  default_payment_method_last4 text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger for subscriptions updated_at
drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- Discounts table
create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null,
  value integer not null,
  duration_type text not null,
  duration_value integer null,
  max_redemptions integer null,
  redeemed_count integer not null default 0,
  valid_from timestamptz null,
  valid_to timestamptz null,
  applicable_plan_id uuid null references public.plans(id),
  stackable boolean not null default false,
  is_active boolean not null default true,
  stripe_coupon_id text null,
  created_at timestamptz not null default now()
);

-- Subscription discounts junction table
create table if not exists public.subscription_discounts (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  discount_id uuid not null references public.discounts(id),
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  applied_by text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists idx_subscription_discounts_subscription_id
on public.subscription_discounts(subscription_id);

-- Referral codes table
create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

-- Referrals tracking table
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null,
  status text not null default 'signed_up',
  first_payment_at timestamptz null,
  reward_discount_id uuid null references public.discounts(id),
  reward_applied_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_referrals_referrer_user_id
on public.referrals(referrer_user_id);

-- Invoices table
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid null references public.subscriptions(id) on delete set null,
  provider text not null default 'stripe',
  stripe_invoice_id text not null unique,
  amount_paid_cents integer not null default 0,
  currency text not null default 'usd',
  status text not null,
  period_start timestamptz null,
  period_end timestamptz null,
  paid_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoices_user_id on public.invoices(user_id);

-- Entitlements table
create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(plan_id, key)
);

-- Check constraints
alter table public.plans
  add constraint plans_billing_cycle_chk
  check (billing_cycle in ('none','monthly','yearly'));

alter table public.subscriptions
  add constraint subscriptions_status_chk
  check (status in ('active','past_due','suspended','canceled','trialing'));

alter table public.discounts
  add constraint discounts_type_chk
  check (type in ('percentage','fixed_cents','free'));

alter table public.discounts
  add constraint discounts_duration_type_chk
  check (duration_type in ('months','forever','one_time'));

alter table public.subscription_discounts
  add constraint subscription_discounts_status_chk
  check (status in ('active','expired','canceled'));

alter table public.subscription_discounts
  add constraint subscription_discounts_applied_by_chk
  check (applied_by in ('system','admin','referral'));

alter table public.referrals
  add constraint referrals_status_chk
  check (status in ('signed_up','first_payment_completed','reward_applied','invalid'));

alter table public.invoices
  add constraint invoices_status_chk
  check (status in ('paid','open','uncollectible','void'));

-- Seed plans
insert into public.plans (code, name, price_cents, currency, billing_cycle, stripe_price_id, is_active)
values
  ('free', 'Free', 0, 'usd', 'none', null, true),
  ('plus_monthly', 'Plus Monthly', 500, 'usd', 'monthly', null, true),
  ('plus_yearly', 'Plus Yearly', 5000, 'usd', 'yearly', null, true)
on conflict (code) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  billing_cycle = excluded.billing_cycle,
  is_active = excluded.is_active;

-- Enable RLS on all tables
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.discounts enable row level security;
alter table public.subscription_discounts enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.invoices enable row level security;
alter table public.entitlements enable row level security;

-- RLS Policies

-- Plans: readable by all
drop policy if exists "plans_read_all" on public.plans;
create policy "plans_read_all" on public.plans for select using (true);

-- Entitlements: readable by all
drop policy if exists "entitlements_read_all" on public.entitlements;
create policy "entitlements_read_all" on public.entitlements for select using (true);

-- Subscriptions: users can read and insert their own, no client updates
drop policy if exists "subscriptions_read_own" on public.subscriptions;
create policy "subscriptions_read_own" on public.subscriptions
for select using (public.is_authenticated_user() and user_id = auth.uid());

drop policy if exists "subscriptions_insert_own" on public.subscriptions;
create policy "subscriptions_insert_own" on public.subscriptions
for insert with check (public.is_authenticated_user() and user_id = auth.uid());

drop policy if exists "subscriptions_no_client_update" on public.subscriptions;
create policy "subscriptions_no_client_update" on public.subscriptions for update using (false);

-- Discounts: not readable by clients
drop policy if exists "discounts_read_none" on public.discounts;
create policy "discounts_read_none" on public.discounts for select using (false);

-- Subscription discounts: users can read their own
drop policy if exists "subscription_discounts_read_own" on public.subscription_discounts;
create policy "subscription_discounts_read_own" on public.subscription_discounts
for select
using (
  public.is_authenticated_user()
  and exists (
    select 1 from public.subscriptions s
    where s.id = subscription_discounts.subscription_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "subscription_discounts_no_client_write" on public.subscription_discounts;
create policy "subscription_discounts_no_client_write" on public.subscription_discounts
for insert with check (false);

drop policy if exists "subscription_discounts_no_client_update" on public.subscription_discounts;
create policy "subscription_discounts_no_client_update" on public.subscription_discounts
for update using (false);

drop policy if exists "subscription_discounts_no_client_delete" on public.subscription_discounts;
create policy "subscription_discounts_no_client_delete" on public.subscription_discounts
for delete using (false);

-- Referral codes: users can read and insert their own
drop policy if exists "referral_codes_read_own" on public.referral_codes;
create policy "referral_codes_read_own" on public.referral_codes
for select using (public.is_authenticated_user() and user_id = auth.uid());

drop policy if exists "referral_codes_insert_own" on public.referral_codes;
create policy "referral_codes_insert_own" on public.referral_codes
for insert with check (public.is_authenticated_user() and user_id = auth.uid());

drop policy if exists "referral_codes_no_client_update" on public.referral_codes;
create policy "referral_codes_no_client_update" on public.referral_codes for update using (false);

-- Referrals: users can read if they're involved
drop policy if exists "referrals_read_involved" on public.referrals;
create policy "referrals_read_involved" on public.referrals
for select
using (
  public.is_authenticated_user()
  and (referrer_user_id = auth.uid() or referred_user_id = auth.uid())
);

drop policy if exists "referrals_no_client_insert" on public.referrals;
create policy "referrals_no_client_insert" on public.referrals
for insert with check (false);

drop policy if exists "referrals_no_client_update" on public.referrals;
create policy "referrals_no_client_update" on public.referrals
for update using (false);

drop policy if exists "referrals_no_client_delete" on public.referrals;
create policy "referrals_no_client_delete" on public.referrals
for delete using (false);

-- Invoices: users can read their own
drop policy if exists "invoices_read_own" on public.invoices;
create policy "invoices_read_own" on public.invoices
for select using (public.is_authenticated_user() and user_id = auth.uid());

drop policy if exists "invoices_no_client_insert" on public.invoices;
create policy "invoices_no_client_insert" on public.invoices
for insert with check (false);

drop policy if exists "invoices_no_client_update" on public.invoices;
create policy "invoices_no_client_update" on public.invoices
for update using (false);

drop policy if exists "invoices_no_client_delete" on public.invoices;
create policy "invoices_no_client_delete" on public.invoices
for delete using (false);

-- Create billing status view
create or replace view public.v_user_billing_status
as
select
  s.user_id,
  p.code as plan_code,
  p.name as plan_name,
  s.status,
  s.current_period_end,
  s.cancel_at_period_end
from public.subscriptions s
join public.plans p on p.id = s.plan_id;

-- Seed entitlements for each plan
do $$
declare
  free_id uuid;
  plus_m_id uuid;
  plus_y_id uuid;
begin
  select id into free_id from public.plans where code='free';
  select id into plus_m_id from public.plans where code='plus_monthly';
  select id into plus_y_id from public.plans where code='plus_yearly';

  -- FREE plan entitlements
  insert into public.entitlements(plan_id, key, value) values
    (free_id, 'profiles.max', jsonb_build_object('limit', 1)),
    (free_id, 'attachments.max', jsonb_build_object('limit', 9)),
    (free_id, 'sharing.enabled', jsonb_build_object('enabled', false)),
    (free_id, 'sharing.roles', jsonb_build_object('enabled', false)),
    (free_id, 'pdf_export.enabled', jsonb_build_object('enabled', false)),
    (free_id, 'backup_export.enabled', jsonb_build_object('enabled', false)),
    (free_id, 'procedures.enabled', jsonb_build_object('enabled', false))
  on conflict (plan_id, key) do update set value=excluded.value;

  -- PLUS Monthly entitlements
  insert into public.entitlements(plan_id, key, value) values
    (plus_m_id, 'profiles.max', jsonb_build_object('limit', 99)),
    (plus_m_id, 'attachments.max', jsonb_build_object('limit', 999999)),
    (plus_m_id, 'sharing.enabled', jsonb_build_object('enabled', true)),
    (plus_m_id, 'sharing.roles', jsonb_build_object('enabled', true)),
    (plus_m_id, 'pdf_export.enabled', jsonb_build_object('enabled', true)),
    (plus_m_id, 'backup_export.enabled', jsonb_build_object('enabled', true)),
    (plus_m_id, 'procedures.enabled', jsonb_build_object('enabled', true))
  on conflict (plan_id, key) do update set value=excluded.value;

  -- PLUS Yearly entitlements
  insert into public.entitlements(plan_id, key, value) values
    (plus_y_id, 'profiles.max', jsonb_build_object('limit', 99)),
    (plus_y_id, 'attachments.max', jsonb_build_object('limit', 999999)),
    (plus_y_id, 'sharing.enabled', jsonb_build_object('enabled', true)),
    (plus_y_id, 'sharing.roles', jsonb_build_object('enabled', true)),
    (plus_y_id, 'pdf_export.enabled', jsonb_build_object('enabled', true)),
    (plus_y_id, 'backup_export.enabled', jsonb_build_object('enabled', true)),
    (plus_y_id, 'procedures.enabled', jsonb_build_object('enabled', true))
  on conflict (plan_id, key) do update set value=excluded.value;
end $$;