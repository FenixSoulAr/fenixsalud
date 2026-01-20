-- Create a SECURITY DEFINER function to safely get the current user's email
-- This avoids the "permission denied for table users" error in RLS policies
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- Drop the problematic policies that query auth.users directly
DROP POLICY IF EXISTS "Shared users can view their received shares" ON public.profile_shares;
DROP POLICY IF EXISTS "Shared users can link themselves" ON public.profile_shares;

-- Recreate policies using the security definer function instead
CREATE POLICY "Shared users can view their received shares"
ON public.profile_shares
FOR SELECT
USING (
  (auth.uid() = shared_with_user_id) 
  OR (
    shared_with_user_id IS NULL 
    AND lower(shared_with_email) = lower(public.get_current_user_email())
  )
);

CREATE POLICY "Shared users can link themselves"
ON public.profile_shares
FOR UPDATE
USING (
  shared_with_user_id IS NULL 
  AND status = 'pending'
  AND lower(shared_with_email) = lower(public.get_current_user_email())
)
WITH CHECK (
  shared_with_user_id = auth.uid()
  AND status = 'active'
);