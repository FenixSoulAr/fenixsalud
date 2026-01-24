-- Fix security definer view warning by recreating with security_invoker
drop view if exists public.v_user_billing_status;

create view public.v_user_billing_status
with (security_invoker = true)
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