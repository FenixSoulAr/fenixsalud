-- Add soft delete columns to institutions table
ALTER TABLE public.institutions 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.institutions 
ADD COLUMN IF NOT EXISTS deactivated_at timestamptz NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_institutions_is_active ON public.institutions(is_active);