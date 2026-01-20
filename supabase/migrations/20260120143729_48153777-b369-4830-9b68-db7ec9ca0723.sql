-- Drop existing policies and recreate with sharing support

-- APPOINTMENTS TABLE
DROP POLICY IF EXISTS "Users can view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can insert own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can update own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can delete own appointments" ON public.appointments;

CREATE POLICY "Users can view accessible appointments"
ON public.appointments FOR SELECT
USING (public.can_access_profile(auth.uid(), user_id));

CREATE POLICY "Users can insert appointments"
ON public.appointments FOR INSERT
WITH CHECK (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Users can update accessible appointments"
ON public.appointments FOR UPDATE
USING (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Only owners can delete appointments"
ON public.appointments FOR DELETE
USING (public.is_data_owner(auth.uid(), user_id));

-- DOCTORS TABLE
DROP POLICY IF EXISTS "Users can view own doctors" ON public.doctors;
DROP POLICY IF EXISTS "Users can insert own doctors" ON public.doctors;
DROP POLICY IF EXISTS "Users can update own doctors" ON public.doctors;
DROP POLICY IF EXISTS "Users can delete own doctors" ON public.doctors;

CREATE POLICY "Users can view accessible doctors"
ON public.doctors FOR SELECT
USING (public.can_access_profile(auth.uid(), user_id));

CREATE POLICY "Users can insert doctors"
ON public.doctors FOR INSERT
WITH CHECK (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Users can update accessible doctors"
ON public.doctors FOR UPDATE
USING (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Only owners can delete doctors"
ON public.doctors FOR DELETE
USING (public.is_data_owner(auth.uid(), user_id));

-- INSTITUTIONS TABLE
DROP POLICY IF EXISTS "Users can view own institutions" ON public.institutions;
DROP POLICY IF EXISTS "Users can insert own institutions" ON public.institutions;
DROP POLICY IF EXISTS "Users can update own institutions" ON public.institutions;
DROP POLICY IF EXISTS "Users can delete own institutions" ON public.institutions;

CREATE POLICY "Users can view accessible institutions"
ON public.institutions FOR SELECT
USING (public.can_access_profile(auth.uid(), user_id));

CREATE POLICY "Users can insert institutions"
ON public.institutions FOR INSERT
WITH CHECK (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Users can update accessible institutions"
ON public.institutions FOR UPDATE
USING (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Only owners can delete institutions"
ON public.institutions FOR DELETE
USING (public.is_data_owner(auth.uid(), user_id));

-- MEDICATIONS TABLE
DROP POLICY IF EXISTS "Users can view own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can insert own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can update own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can delete own medications" ON public.medications;

CREATE POLICY "Users can view accessible medications"
ON public.medications FOR SELECT
USING (public.can_access_profile(auth.uid(), user_id));

CREATE POLICY "Users can insert medications"
ON public.medications FOR INSERT
WITH CHECK (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Users can update accessible medications"
ON public.medications FOR UPDATE
USING (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Only owners can delete medications"
ON public.medications FOR DELETE
USING (public.is_data_owner(auth.uid(), user_id));

-- MEDICATION_LOGS TABLE
DROP POLICY IF EXISTS "Users can view own medication logs" ON public.medication_logs;
DROP POLICY IF EXISTS "Users can insert own medication logs" ON public.medication_logs;
DROP POLICY IF EXISTS "Users can update own medication logs" ON public.medication_logs;
DROP POLICY IF EXISTS "Users can delete own medication logs" ON public.medication_logs;

CREATE POLICY "Users can view accessible medication logs"
ON public.medication_logs FOR SELECT
USING (public.can_access_profile(auth.uid(), user_id));

CREATE POLICY "Users can insert medication logs"
ON public.medication_logs FOR INSERT
WITH CHECK (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Users can update accessible medication logs"
ON public.medication_logs FOR UPDATE
USING (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Only owners can delete medication logs"
ON public.medication_logs FOR DELETE
USING (public.is_data_owner(auth.uid(), user_id));

-- PROCEDURES TABLE
DROP POLICY IF EXISTS "Users can view their own procedures" ON public.procedures;
DROP POLICY IF EXISTS "Users can create their own procedures" ON public.procedures;
DROP POLICY IF EXISTS "Users can update their own procedures" ON public.procedures;
DROP POLICY IF EXISTS "Users can delete their own procedures" ON public.procedures;

CREATE POLICY "Users can view accessible procedures"
ON public.procedures FOR SELECT
USING (public.can_access_profile(auth.uid(), user_id));

CREATE POLICY "Users can insert procedures"
ON public.procedures FOR INSERT
WITH CHECK (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Users can update accessible procedures"
ON public.procedures FOR UPDATE
USING (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Only owners can delete procedures"
ON public.procedures FOR DELETE
USING (public.is_data_owner(auth.uid(), user_id));

-- REMINDERS TABLE
DROP POLICY IF EXISTS "Users can view own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can insert own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can update own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can delete own reminders" ON public.reminders;

CREATE POLICY "Users can view accessible reminders"
ON public.reminders FOR SELECT
USING (public.can_access_profile(auth.uid(), user_id));

CREATE POLICY "Users can insert reminders"
ON public.reminders FOR INSERT
WITH CHECK (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Users can update accessible reminders"
ON public.reminders FOR UPDATE
USING (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Only owners can delete reminders"
ON public.reminders FOR DELETE
USING (public.is_data_owner(auth.uid(), user_id));

-- TESTS TABLE
DROP POLICY IF EXISTS "Users can view own tests" ON public.tests;
DROP POLICY IF EXISTS "Users can insert own tests" ON public.tests;
DROP POLICY IF EXISTS "Users can update own tests" ON public.tests;
DROP POLICY IF EXISTS "Users can delete own tests" ON public.tests;

CREATE POLICY "Users can view accessible tests"
ON public.tests FOR SELECT
USING (public.can_access_profile(auth.uid(), user_id));

CREATE POLICY "Users can insert tests"
ON public.tests FOR INSERT
WITH CHECK (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Users can update accessible tests"
ON public.tests FOR UPDATE
USING (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Only owners can delete tests"
ON public.tests FOR DELETE
USING (public.is_data_owner(auth.uid(), user_id));

-- FILE_ATTACHMENTS TABLE
DROP POLICY IF EXISTS "Users can view own attachments" ON public.file_attachments;
DROP POLICY IF EXISTS "Users can insert own attachments" ON public.file_attachments;
DROP POLICY IF EXISTS "Users can update own attachments" ON public.file_attachments;
DROP POLICY IF EXISTS "Users can delete own attachments" ON public.file_attachments;

CREATE POLICY "Users can view accessible attachments"
ON public.file_attachments FOR SELECT
USING (public.can_access_profile(auth.uid(), user_id));

CREATE POLICY "Users can insert attachments"
ON public.file_attachments FOR INSERT
WITH CHECK (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Users can update accessible attachments"
ON public.file_attachments FOR UPDATE
USING (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Only owners can delete attachments"
ON public.file_attachments FOR DELETE
USING (public.is_data_owner(auth.uid(), user_id));