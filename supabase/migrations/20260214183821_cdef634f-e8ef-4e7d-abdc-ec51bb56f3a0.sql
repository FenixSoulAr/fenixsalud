
-- 1. Add new columns to doctors table (soft delete + new fields)
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- 2. Create professional_status enum
DO $$ BEGIN
  CREATE TYPE public.professional_status AS ENUM ('assigned', 'unassigned', 'unknown', 'not_recorded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Add professional_status to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS professional_status public.professional_status NOT NULL DEFAULT 'assigned';

-- 4. Add professional_status to procedures
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS professional_status public.professional_status NOT NULL DEFAULT 'assigned';

-- 5. Add doctor_id and professional_status to tests
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES public.doctors(id),
  ADD COLUMN IF NOT EXISTS professional_status public.professional_status NOT NULL DEFAULT 'assigned';

-- 6. Backfill professional_status based on existing doctor_id
UPDATE public.appointments SET professional_status = 'unassigned' WHERE doctor_id IS NULL;
UPDATE public.procedures SET professional_status = 'unassigned' WHERE doctor_id IS NULL;
UPDATE public.tests SET professional_status = 'unassigned' WHERE doctor_id IS NULL;

-- 7. Add index for filtering doctors by institution
CREATE INDEX IF NOT EXISTS idx_doctors_institution_id ON public.doctors(institution_id);
CREATE INDEX IF NOT EXISTS idx_doctors_is_active ON public.doctors(is_active);
