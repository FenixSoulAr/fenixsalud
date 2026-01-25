-- Add profile_id column to all health data tables
-- This enables proper scoping of data to individual profiles (including family profiles)

-- Appointments
ALTER TABLE public.appointments ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Diagnoses  
ALTER TABLE public.diagnoses ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Medications
ALTER TABLE public.medications ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Medication Logs
ALTER TABLE public.medication_logs ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Tests
ALTER TABLE public.tests ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Procedures
ALTER TABLE public.procedures ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Reminders
ALTER TABLE public.reminders ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Doctors
ALTER TABLE public.doctors ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Institutions
ALTER TABLE public.institutions ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- File Attachments
ALTER TABLE public.file_attachments ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Backfill existing data: set profile_id to the primary profile for each user
-- Primary profile is where user_id = owner_user_id
UPDATE public.appointments a SET profile_id = p.id FROM public.profiles p WHERE p.user_id = a.user_id AND p.user_id = p.owner_user_id;
UPDATE public.diagnoses d SET profile_id = p.id FROM public.profiles p WHERE p.user_id = d.user_id AND p.user_id = p.owner_user_id;
UPDATE public.medications m SET profile_id = p.id FROM public.profiles p WHERE p.user_id = m.user_id AND p.user_id = p.owner_user_id;
UPDATE public.medication_logs ml SET profile_id = p.id FROM public.profiles p WHERE p.user_id = ml.user_id AND p.user_id = p.owner_user_id;
UPDATE public.tests t SET profile_id = p.id FROM public.profiles p WHERE p.user_id = t.user_id AND p.user_id = p.owner_user_id;
UPDATE public.procedures pr SET profile_id = p.id FROM public.profiles p WHERE p.user_id = pr.user_id AND p.user_id = p.owner_user_id;
UPDATE public.reminders r SET profile_id = p.id FROM public.profiles p WHERE p.user_id = r.user_id AND p.user_id = p.owner_user_id;
UPDATE public.doctors d SET profile_id = p.id FROM public.profiles p WHERE p.user_id = d.user_id AND p.user_id = p.owner_user_id;
UPDATE public.institutions i SET profile_id = p.id FROM public.profiles p WHERE p.user_id = i.user_id AND p.user_id = p.owner_user_id;
UPDATE public.file_attachments fa SET profile_id = p.id FROM public.profiles p WHERE p.user_id = fa.user_id AND p.user_id = p.owner_user_id;

-- Create indexes for performance
CREATE INDEX idx_appointments_profile_id ON public.appointments(profile_id);
CREATE INDEX idx_diagnoses_profile_id ON public.diagnoses(profile_id);
CREATE INDEX idx_medications_profile_id ON public.medications(profile_id);
CREATE INDEX idx_medication_logs_profile_id ON public.medication_logs(profile_id);
CREATE INDEX idx_tests_profile_id ON public.tests(profile_id);
CREATE INDEX idx_procedures_profile_id ON public.procedures(profile_id);
CREATE INDEX idx_reminders_profile_id ON public.reminders(profile_id);
CREATE INDEX idx_doctors_profile_id ON public.doctors(profile_id);
CREATE INDEX idx_institutions_profile_id ON public.institutions(profile_id);
CREATE INDEX idx_file_attachments_profile_id ON public.file_attachments(profile_id);

-- Create helper function to check profile access by profile_id
CREATE OR REPLACE FUNCTION public.can_access_profile_by_id(_profile_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _profile_id
      AND (
        p.owner_user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.profile_shares ps
          WHERE ps.profile_id = p.id
            AND ps.shared_with_user_id = _user_id
            AND ps.status = 'active'
        )
      )
  )
$$;

-- Create helper function to check modify access by profile_id
CREATE OR REPLACE FUNCTION public.can_modify_profile_by_id(_profile_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _profile_id
      AND (
        p.owner_user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.profile_shares ps
          WHERE ps.profile_id = p.id
            AND ps.shared_with_user_id = _user_id
            AND ps.role = 'contributor'
            AND ps.status = 'active'
        )
      )
  )
$$;

-- Create helper function to check if user is profile owner
CREATE OR REPLACE FUNCTION public.is_profile_owner(_profile_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _profile_id
      AND p.owner_user_id = _user_id
  )
$$;

-- Update RLS policies for appointments
DROP POLICY IF EXISTS "Users can view accessible appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can update accessible appointments" ON public.appointments;
DROP POLICY IF EXISTS "Only owners can delete appointments" ON public.appointments;

CREATE POLICY "Users can view accessible appointments" ON public.appointments
FOR SELECT USING (can_access_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can insert appointments" ON public.appointments
FOR INSERT WITH CHECK (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can update accessible appointments" ON public.appointments
FOR UPDATE USING (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Only owners can delete appointments" ON public.appointments
FOR DELETE USING (is_profile_owner(profile_id, auth.uid()));

-- Update RLS policies for diagnoses
DROP POLICY IF EXISTS "Users can view accessible diagnoses" ON public.diagnoses;
DROP POLICY IF EXISTS "Users can insert diagnoses" ON public.diagnoses;
DROP POLICY IF EXISTS "Users can update accessible diagnoses" ON public.diagnoses;
DROP POLICY IF EXISTS "Only owners can delete diagnoses" ON public.diagnoses;

CREATE POLICY "Users can view accessible diagnoses" ON public.diagnoses
FOR SELECT USING (can_access_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can insert diagnoses" ON public.diagnoses
FOR INSERT WITH CHECK (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can update accessible diagnoses" ON public.diagnoses
FOR UPDATE USING (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Only owners can delete diagnoses" ON public.diagnoses
FOR DELETE USING (is_profile_owner(profile_id, auth.uid()));

-- Update RLS policies for medications
DROP POLICY IF EXISTS "Users can view accessible medications" ON public.medications;
DROP POLICY IF EXISTS "Users can insert medications" ON public.medications;
DROP POLICY IF EXISTS "Users can update accessible medications" ON public.medications;
DROP POLICY IF EXISTS "Only owners can delete medications" ON public.medications;

CREATE POLICY "Users can view accessible medications" ON public.medications
FOR SELECT USING (can_access_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can insert medications" ON public.medications
FOR INSERT WITH CHECK (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can update accessible medications" ON public.medications
FOR UPDATE USING (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Only owners can delete medications" ON public.medications
FOR DELETE USING (is_profile_owner(profile_id, auth.uid()));

-- Update RLS policies for medication_logs
DROP POLICY IF EXISTS "Users can view accessible medication logs" ON public.medication_logs;
DROP POLICY IF EXISTS "Users can insert medication logs" ON public.medication_logs;
DROP POLICY IF EXISTS "Users can update accessible medication logs" ON public.medication_logs;
DROP POLICY IF EXISTS "Only owners can delete medication logs" ON public.medication_logs;

CREATE POLICY "Users can view accessible medication logs" ON public.medication_logs
FOR SELECT USING (can_access_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can insert medication logs" ON public.medication_logs
FOR INSERT WITH CHECK (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can update accessible medication logs" ON public.medication_logs
FOR UPDATE USING (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Only owners can delete medication logs" ON public.medication_logs
FOR DELETE USING (is_profile_owner(profile_id, auth.uid()));

-- Update RLS policies for tests
DROP POLICY IF EXISTS "Users can view accessible tests" ON public.tests;
DROP POLICY IF EXISTS "Users can insert tests" ON public.tests;
DROP POLICY IF EXISTS "Users can update accessible tests" ON public.tests;
DROP POLICY IF EXISTS "Only owners can delete tests" ON public.tests;

CREATE POLICY "Users can view accessible tests" ON public.tests
FOR SELECT USING (can_access_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can insert tests" ON public.tests
FOR INSERT WITH CHECK (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can update accessible tests" ON public.tests
FOR UPDATE USING (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Only owners can delete tests" ON public.tests
FOR DELETE USING (is_profile_owner(profile_id, auth.uid()));

-- Update RLS policies for procedures
DROP POLICY IF EXISTS "Users can view accessible procedures" ON public.procedures;
DROP POLICY IF EXISTS "Users can insert procedures" ON public.procedures;
DROP POLICY IF EXISTS "Users can update accessible procedures" ON public.procedures;
DROP POLICY IF EXISTS "Only owners can delete procedures" ON public.procedures;

CREATE POLICY "Users can view accessible procedures" ON public.procedures
FOR SELECT USING (can_access_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can insert procedures" ON public.procedures
FOR INSERT WITH CHECK (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can update accessible procedures" ON public.procedures
FOR UPDATE USING (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Only owners can delete procedures" ON public.procedures
FOR DELETE USING (is_profile_owner(profile_id, auth.uid()));

-- Update RLS policies for reminders
DROP POLICY IF EXISTS "Users can view accessible reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can insert reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can update accessible reminders" ON public.reminders;
DROP POLICY IF EXISTS "Only owners can delete reminders" ON public.reminders;

CREATE POLICY "Users can view accessible reminders" ON public.reminders
FOR SELECT USING (can_access_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can insert reminders" ON public.reminders
FOR INSERT WITH CHECK (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can update accessible reminders" ON public.reminders
FOR UPDATE USING (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Only owners can delete reminders" ON public.reminders
FOR DELETE USING (is_profile_owner(profile_id, auth.uid()));

-- Update RLS policies for doctors
DROP POLICY IF EXISTS "Users can view accessible doctors" ON public.doctors;
DROP POLICY IF EXISTS "Users can insert doctors" ON public.doctors;
DROP POLICY IF EXISTS "Users can update accessible doctors" ON public.doctors;
DROP POLICY IF EXISTS "Only owners can delete doctors" ON public.doctors;

CREATE POLICY "Users can view accessible doctors" ON public.doctors
FOR SELECT USING (can_access_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can insert doctors" ON public.doctors
FOR INSERT WITH CHECK (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can update accessible doctors" ON public.doctors
FOR UPDATE USING (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Only owners can delete doctors" ON public.doctors
FOR DELETE USING (is_profile_owner(profile_id, auth.uid()));

-- Update RLS policies for institutions
DROP POLICY IF EXISTS "Users can view accessible institutions" ON public.institutions;
DROP POLICY IF EXISTS "Users can insert institutions" ON public.institutions;
DROP POLICY IF EXISTS "Users can update accessible institutions" ON public.institutions;
DROP POLICY IF EXISTS "Only owners can delete institutions" ON public.institutions;

CREATE POLICY "Users can view accessible institutions" ON public.institutions
FOR SELECT USING (can_access_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can insert institutions" ON public.institutions
FOR INSERT WITH CHECK (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can update accessible institutions" ON public.institutions
FOR UPDATE USING (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Only owners can delete institutions" ON public.institutions
FOR DELETE USING (is_profile_owner(profile_id, auth.uid()));

-- Update RLS policies for file_attachments
DROP POLICY IF EXISTS "Users can view accessible attachments" ON public.file_attachments;
DROP POLICY IF EXISTS "Users can insert attachments" ON public.file_attachments;
DROP POLICY IF EXISTS "Users can update accessible attachments" ON public.file_attachments;
DROP POLICY IF EXISTS "Only owners can delete attachments" ON public.file_attachments;

CREATE POLICY "Users can view accessible attachments" ON public.file_attachments
FOR SELECT USING (can_access_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can insert attachments" ON public.file_attachments
FOR INSERT WITH CHECK (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Users can update accessible attachments" ON public.file_attachments
FOR UPDATE USING (can_modify_profile_by_id(profile_id, auth.uid()));

CREATE POLICY "Only owners can delete attachments" ON public.file_attachments
FOR DELETE USING (is_profile_owner(profile_id, auth.uid()));