-- Create diagnosis status enum
CREATE TYPE public.diagnosis_status AS ENUM ('active', 'resolved');

-- Create diagnoses table
CREATE TABLE public.diagnoses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  condition TEXT NOT NULL,
  notes TEXT,
  diagnosed_date DATE,
  status public.diagnosis_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies following existing pattern
CREATE POLICY "Users can view accessible diagnoses"
ON public.diagnoses
FOR SELECT
USING (public.can_access_profile(auth.uid(), user_id));

CREATE POLICY "Users can insert diagnoses"
ON public.diagnoses
FOR INSERT
WITH CHECK (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Users can update accessible diagnoses"
ON public.diagnoses
FOR UPDATE
USING (public.can_modify_data(auth.uid(), user_id));

CREATE POLICY "Only owners can delete diagnoses"
ON public.diagnoses
FOR DELETE
USING (public.is_data_owner(auth.uid(), user_id));

-- Add updated_at trigger
CREATE TRIGGER update_diagnoses_updated_at
  BEFORE UPDATE ON public.diagnoses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add diagnosis_id to medications table
ALTER TABLE public.medications
ADD COLUMN diagnosis_id UUID REFERENCES public.diagnoses(id) ON DELETE SET NULL;