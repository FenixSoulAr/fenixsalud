
-- Drop existing check constraints
ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_duration_type_chk;
ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_type_chk;

-- Add new check constraints with all valid types
ALTER TABLE public.discounts ADD CONSTRAINT discounts_type_chk 
  CHECK (type IN ('percentage', 'fixed', 'stripe_coupon', 'internal_override'));

ALTER TABLE public.discounts ADD CONSTRAINT discounts_duration_type_chk 
  CHECK (duration_type IN ('once', 'repeating', 'forever', 'days'));

-- Insert the 3 promo codes for internal overrides
INSERT INTO public.discounts (code, type, value, duration_type, duration_value, max_redemptions, is_active)
VALUES 
  ('TESTER30', 'internal_override', 100, 'days', 30, NULL, true),
  ('FAMILIA', 'internal_override', 100, 'forever', NULL, NULL, true),
  ('PRENSA', 'internal_override', 100, 'days', 90, NULL, true)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type,
  value = EXCLUDED.value,
  duration_type = EXCLUDED.duration_type,
  duration_value = EXCLUDED.duration_value,
  max_redemptions = EXCLUDED.max_redemptions,
  is_active = EXCLUDED.is_active;
