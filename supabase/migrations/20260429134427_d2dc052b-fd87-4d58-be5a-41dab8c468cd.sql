ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blood_type text,
  ADD COLUMN IF NOT EXISTS emergency_phone text;

COMMENT ON COLUMN public.profiles.blood_type IS 'Emergency: blood type (e.g. A+, O-)';
COMMENT ON COLUMN public.profiles.emergency_phone IS 'Emergency contact phone number';