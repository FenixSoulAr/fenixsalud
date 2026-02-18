
-- ============================================================
-- 3-TIER SUBSCRIPTION MODEL MIGRATION
-- Plans: Free | Plus ($7/mo) | Pro ($12/mo)
-- ============================================================

-- 1. Upsert the three plans (free already exists, update it; insert plus/pro)
INSERT INTO public.plans (code, name, price_cents, currency, billing_cycle, is_active)
VALUES
  ('free',        'Free',  0,    'usd', 'none',    true),
  ('plus_monthly','Plus',  700,  'usd', 'monthly', true),
  ('pro_monthly', 'Pro',   1200, 'usd', 'monthly', true)
ON CONFLICT (code) DO UPDATE SET
  name        = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  is_active   = EXCLUDED.is_active;

-- 2. Delete old entitlements for these plans so we can re-seed cleanly
DELETE FROM public.entitlements
WHERE plan_id IN (
  SELECT id FROM public.plans WHERE code IN ('free', 'plus_monthly', 'pro_monthly')
);

-- 3. Seed FREE plan entitlements
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'profiles.max',          '{"limit": 1}'::jsonb  FROM public.plans WHERE code = 'free';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'attachments.max',       '{"limit": 10}'::jsonb FROM public.plans WHERE code = 'free';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'pdf_export.enabled',    '{"enabled": false}'::jsonb FROM public.plans WHERE code = 'free';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'sharing.enabled',       '{"enabled": false}'::jsonb FROM public.plans WHERE code = 'free';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'sharing.max_grantees',  '{"limit": 0}'::jsonb  FROM public.plans WHERE code = 'free';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'sharing.roles',         '{"enabled": false}'::jsonb FROM public.plans WHERE code = 'free';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'procedures.enabled',    '{"enabled": false}'::jsonb FROM public.plans WHERE code = 'free';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'export_backup.enabled', '{"enabled": false}'::jsonb FROM public.plans WHERE code = 'free';

-- 4. Seed PLUS plan entitlements
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'profiles.max',          '{"limit": 1}'::jsonb   FROM public.plans WHERE code = 'plus_monthly';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'attachments.max',       '{"limit": 100}'::jsonb FROM public.plans WHERE code = 'plus_monthly';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'pdf_export.enabled',    '{"enabled": true}'::jsonb  FROM public.plans WHERE code = 'plus_monthly';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'sharing.enabled',       '{"enabled": true}'::jsonb  FROM public.plans WHERE code = 'plus_monthly';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'sharing.max_grantees',  '{"limit": 1}'::jsonb   FROM public.plans WHERE code = 'plus_monthly';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'sharing.roles',         '{"enabled": true}'::jsonb  FROM public.plans WHERE code = 'plus_monthly';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'procedures.enabled',    '{"enabled": true}'::jsonb  FROM public.plans WHERE code = 'plus_monthly';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'export_backup.enabled', '{"enabled": false}'::jsonb FROM public.plans WHERE code = 'plus_monthly';

-- 5. Seed PRO plan entitlements
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'profiles.max',          '{"limit": 5}'::jsonb   FROM public.plans WHERE code = 'pro_monthly';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'attachments.max',       '{"limit": 200}'::jsonb FROM public.plans WHERE code = 'pro_monthly';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'pdf_export.enabled',    '{"enabled": true}'::jsonb  FROM public.plans WHERE code = 'pro_monthly';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'sharing.enabled',       '{"enabled": true}'::jsonb  FROM public.plans WHERE code = 'pro_monthly';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'sharing.max_grantees',  '{"limit": 99}'::jsonb  FROM public.plans WHERE code = 'pro_monthly';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'sharing.roles',         '{"enabled": true}'::jsonb  FROM public.plans WHERE code = 'pro_monthly';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'procedures.enabled',    '{"enabled": true}'::jsonb  FROM public.plans WHERE code = 'pro_monthly';
INSERT INTO public.entitlements (plan_id, key, value)
SELECT id, 'export_backup.enabled', '{"enabled": true}'::jsonb  FROM public.plans WHERE code = 'pro_monthly';

-- 6. Add UNIQUE constraint to plans.code if not already present (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plans_code_key'
  ) THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_code_key UNIQUE (code);
  END IF;
END$$;
