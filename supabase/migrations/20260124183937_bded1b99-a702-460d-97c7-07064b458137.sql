-- Seed entitlements for plus_yearly plan (same as plus_monthly)
-- Uses ON CONFLICT for idempotent upserts on (plan_id, key) unique constraint

do $$
declare
  plus_y_id uuid;
begin
  select id into plus_y_id from public.plans where code = 'plus_yearly';

  -- PLUS YEARLY plan entitlements (same as Plus Monthly)
  insert into public.entitlements(plan_id, key, value) values
    (plus_y_id, 'profiles.max', '{"limit":10}'::jsonb),
    (plus_y_id, 'attachments.max', '{"limit":9999}'::jsonb),
    (plus_y_id, 'pdf_export.enabled', '{"enabled":true}'::jsonb),
    (plus_y_id, 'sharing.enabled', '{"enabled":true}'::jsonb),
    (plus_y_id, 'sharing.roles', '{"enabled":true}'::jsonb),
    (plus_y_id, 'export_backup.enabled', '{"enabled":true}'::jsonb),
    (plus_y_id, 'procedures.enabled', '{"enabled":true}'::jsonb)
  on conflict (plan_id, key) do update set value = excluded.value;
end $$;