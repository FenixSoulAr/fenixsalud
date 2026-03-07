
-- =============================================================
-- Security Fix 1: Remove subscriptions_insert_own policy
-- Prevents users from self-inserting subscription records
-- to claim premium plans without paying.
-- =============================================================
DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;

-- =============================================================
-- Security Fix 2: Restrict profile_shares_link_self
-- Prevents invited users from escalating their role (viewer→contributor)
-- or tampering with profile_id/owner_id/email during invitation acceptance.
-- =============================================================
DROP POLICY IF EXISTS "profile_shares_link_self" ON public.profile_shares;

CREATE POLICY "profile_shares_link_self"
ON public.profile_shares
FOR UPDATE
TO authenticated
USING (
  shared_with_user_id IS NULL
  AND status = 'pending'
  AND lower(shared_with_email) = lower(get_current_user_email())
)
WITH CHECK (
  shared_with_user_id = auth.uid()
  AND status = 'active'
  AND role = (SELECT ps.role FROM public.profile_shares ps WHERE ps.id = profile_shares.id)
  AND profile_id = (SELECT ps.profile_id FROM public.profile_shares ps WHERE ps.id = profile_shares.id)
  AND owner_id = (SELECT ps.owner_id FROM public.profile_shares ps WHERE ps.id = profile_shares.id)
  AND shared_with_email = (SELECT ps.shared_with_email FROM public.profile_shares ps WHERE ps.id = profile_shares.id)
);

-- =============================================================
-- Security Fix 3: Replace v_user_billing_status view with
-- a SECURITY DEFINER function scoped to auth.uid()
-- =============================================================
DROP VIEW IF EXISTS public.v_user_billing_status;

CREATE OR REPLACE FUNCTION public.get_my_billing_status()
RETURNS TABLE (
  user_id uuid,
  status text,
  plan_code text,
  plan_name text,
  current_period_end timestamptz,
  cancel_at_period_end boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.user_id,
    s.status,
    p.code AS plan_code,
    p.name AS plan_name,
    s.current_period_end,
    s.cancel_at_period_end
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.user_id = auth.uid()
  LIMIT 1;
$$;
