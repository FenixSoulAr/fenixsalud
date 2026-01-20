-- Allow shared users to view the owner's profile (for display name)
CREATE POLICY "Shared users can view owner profile" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profile_shares
    WHERE profile_shares.owner_id = profiles.user_id
      AND profile_shares.shared_with_user_id = auth.uid()
      AND profile_shares.status = 'active'
  )
);