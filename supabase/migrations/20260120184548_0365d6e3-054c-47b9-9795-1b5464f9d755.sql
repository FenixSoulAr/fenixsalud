-- Drop existing SELECT policies for shared users
DROP POLICY IF EXISTS "Shared users can view their received shares" ON public.profile_shares;

-- Create new SELECT policy that allows users to see shares:
-- 1. Where they are already linked as shared_with_user_id
-- 2. Where their email matches shared_with_email (for pending invites they need to link)
CREATE POLICY "Shared users can view their received shares"
ON public.profile_shares
FOR SELECT
USING (
  auth.uid() = shared_with_user_id
  OR (
    shared_with_user_id IS NULL 
    AND lower(shared_with_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  )
);

-- Also need to allow updating shares to link the user_id
-- Drop any existing update policy for shared users if it exists
DROP POLICY IF EXISTS "Shared users can link themselves" ON public.profile_shares;

-- Create policy to allow users to update shares where their email matches (to link themselves)
CREATE POLICY "Shared users can link themselves"
ON public.profile_shares
FOR UPDATE
USING (
  shared_with_user_id IS NULL
  AND lower(shared_with_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
)
WITH CHECK (
  shared_with_user_id = auth.uid()
);