-- Create procedure type enum
CREATE TYPE public.procedure_type AS ENUM ('Surgery', 'Hospitalization', 'Vaccine');

-- Create procedures table
CREATE TABLE public.procedures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type public.procedure_type NOT NULL,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for owner-only access
CREATE POLICY "Users can view their own procedures" 
ON public.procedures 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own procedures" 
ON public.procedures 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own procedures" 
ON public.procedures 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own procedures" 
ON public.procedures 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_procedures_updated_at
BEFORE UPDATE ON public.procedures
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add 'Procedure' to entity_type enum for file attachments
ALTER TYPE public.entity_type ADD VALUE 'Procedure';