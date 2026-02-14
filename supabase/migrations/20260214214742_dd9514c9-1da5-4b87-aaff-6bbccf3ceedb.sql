
-- Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

-- Add normalized_name column
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS normalized_name text;

-- Create function to normalize doctor names
CREATE OR REPLACE FUNCTION public.normalize_doctor_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.normalized_name := lower(trim(regexp_replace(public.unaccent(NEW.full_name), '\s+', ' ', 'g')));
  RETURN NEW;
END;
$$;

-- Create trigger to auto-populate normalized_name
CREATE TRIGGER trg_normalize_doctor_name
BEFORE INSERT OR UPDATE OF full_name ON public.doctors
FOR EACH ROW
EXECUTE FUNCTION public.normalize_doctor_name();

-- Backfill existing records
UPDATE public.doctors
SET normalized_name = lower(trim(regexp_replace(public.unaccent(full_name), '\s+', ' ', 'g')));

-- Create unique index (only for active records within same profile)
CREATE UNIQUE INDEX idx_doctors_profile_normalized_name
ON public.doctors (profile_id, normalized_name)
WHERE profile_id IS NOT NULL;
