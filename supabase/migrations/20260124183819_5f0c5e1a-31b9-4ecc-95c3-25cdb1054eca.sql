-- Seed/update entitlements for free and plus_monthly plans
-- Uses ON CONFLICT for idempotent upserts on (plan_id, key) unique constraint

do $$
declare
  free_id uuid;
  plus_m_id uuid;
begin
  select id into free_id from public.plans where code = 'free';
  select id into plus_m_id from public.plans where code = 'plus_monthly';

  -- FREE plan entitlements
  insert into public.entitlements(plan_id, key, value) values
    (free_id, 'profiles.max', '{"limit":1}'::jsonb),
    (free_id, 'attachments.max', '{"limit":9}'::jsonb),
    (free_id, 'pdf_export.enabled', '{"enabled":false}'::jsonb),
    (free_id, 'sharing.enabled', '{"enabled":false}'::jsonb),
    (free_id, 'sharing.roles', '{"enabled":false}'::jsonb),
    (free_id, 'export_backup.enabled', '{"enabled":false}'::jsonb),
    (free_id, 'procedures.enabled', '{"enabled":false}'::jsonb)
  on conflict (plan_id, key) do update set value = excluded.value;

  -- PLUS MONTHLY plan entitlements (treating as Plus/Premium)
  insert into public.entitlements(plan_id, key, value) values
    (plus_m_id, 'profiles.max', '{"limit":10}'::jsonb),
    (plus_m_id, 'attachments.max', '{"limit":9999}'::jsonb),
    (plus_m_id, 'pdf_export.enabled', '{"enabled":true}'::jsonb),
    (plus_m_id, 'sharing.enabled', '{"enabled":true}'::jsonb),
    (plus_m_id, 'sharing.roles', '{"enabled":true}'::jsonb),
    (plus_m_id, 'export_backup.enabled', '{"enabled":true}'::jsonb),
    (plus_m_id, 'procedures.enabled', '{"enabled":true}'::jsonb)
  on conflict (plan_id, key) do update set value = excluded.value;
end $$;