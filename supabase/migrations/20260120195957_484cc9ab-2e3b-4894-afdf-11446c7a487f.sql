-- Update the "Shared users can link themselves" policy to also update status
DROP POLICY IF EXISTS "Shared users can link themselves" ON public.profile_shares;

CREATE POLICY "Shared users can link themselves"
ON public.profile_shares
FOR UPDATE
USING (
  shared_with_user_id IS NULL 
  AND status = 'pending'
  AND lower(shared_with_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
)
WITH CHECK (
  shared_with_user_id = auth.uid()
  AND status = 'active'
);