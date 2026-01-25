-- Drop the insecure view that exposes auth.users
DROP VIEW IF EXISTS public.v_admin_user_list;

-- Create a security definer function to fetch user list for admins
-- This will only be called from edge functions with service role
CREATE OR REPLACE FUNCTION public.get_admin_user_list()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  user_created_at TIMESTAMPTZ,
  subscription_status TEXT,
  plan_code TEXT,
  plan_name TEXT,
  stripe_subscription_id TEXT,
  override_id UUID,
  override_expires_at TIMESTAMPTZ,
  override_granted_by TEXT,
  override_created_at TIMESTAMPTZ,
  effective_plan TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    au.id as user_id,
    au.email,
    au.created_at as user_created_at,
    s.status as subscription_status,
    p.code as plan_code,
    p.name as plan_name,
    s.stripe_subscription_id,
    po.id as override_id,
    po.expires_at as override_expires_at,
    po.granted_by_email as override_granted_by,
    po.created_at as override_created_at,
    CASE 
      WHEN po.id IS NOT NULL AND po.revoked_at IS NULL 
           AND (po.expires_at IS NULL OR po.expires_at > now()) THEN 'override_plus'
      WHEN s.status = 'active' AND p.code IN ('plus_monthly', 'plus_yearly') THEN 'stripe_plus'
      ELSE 'free'
    END as effective_plan
  FROM auth.users au
  LEFT JOIN public.subscriptions s ON s.user_id = au.id
  LEFT JOIN public.plans p ON p.id = s.plan_id
  LEFT JOIN public.plan_overrides po ON po.user_id = au.id AND po.revoked_at IS NULL
  ORDER BY au.created_at DESC
$$;

-- Function to check if user has an active override (for entitlements)
CREATE OR REPLACE FUNCTION public.has_active_override(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plan_overrides
    WHERE user_id = _user_id
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;