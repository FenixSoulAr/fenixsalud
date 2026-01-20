-- Add status column to profile_shares for explicit state tracking
ALTER TABLE public.profile_shares 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- Add constraint to validate status values
ALTER TABLE public.profile_shares 
ADD CONSTRAINT profile_shares_status_check 
CHECK (status IN ('pending', 'active', 'revoked'));

-- Create index for faster lookups by owner and status
CREATE INDEX IF NOT EXISTS idx_profile_shares_owner_status 
ON public.profile_shares(owner_id, status);

-- Create index for faster lookups by shared user
CREATE INDEX IF NOT EXISTS idx_profile_shares_shared_user 
ON public.profile_shares(shared_with_user_id) 
WHERE shared_with_user_id IS NOT NULL;

-- Backfill existing rows: set status based on shared_with_user_id
UPDATE public.profile_shares 
SET status = CASE 
  WHEN shared_with_user_id IS NOT NULL THEN 'active'
  ELSE 'pending'
END
WHERE status = 'pending' AND shared_with_user_id IS NOT NULL;

-- Normalize all emails to lowercase
UPDATE public.profile_shares 
SET shared_with_email = LOWER(shared_with_email)
WHERE shared_with_email != LOWER(shared_with_email);

-- Create unique constraint to prevent duplicate invites (same owner + email, excluding revoked)
-- Use a partial unique index instead of constraint for more flexibility
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_shares_unique_active 
ON public.profile_shares(owner_id, LOWER(shared_with_email)) 
WHERE status != 'revoked';