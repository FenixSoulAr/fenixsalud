-- Fix: Allow users to read their own plan_overrides
-- Currently the policy denies ALL reads which breaks entitlements detection

-- Drop the restrictive "no read" policy
DROP POLICY IF EXISTS "plan_overrides_no_client_read" ON public.plan_overrides;

-- Create a policy that allows users to read their OWN overrides
CREATE POLICY "Users can read own overrides"
ON public.plan_overrides
FOR SELECT
USING (auth.uid() = user_id);