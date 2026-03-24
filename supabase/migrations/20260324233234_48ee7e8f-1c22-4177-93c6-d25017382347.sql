
-- Add plan_code column to plan_overrides (default 'plus' for backward compat)
ALTER TABLE public.plan_overrides
  ADD COLUMN IF NOT EXISTS plan_code text NOT NULL DEFAULT 'plus';

-- Update get_admin_user_list to return override_plan_code
CREATE OR REPLACE FUNCTION public.get_admin_user_list()
RETURNS TABLE(
  user_id uuid, email text, user_created_at timestamp with time zone,
  subscription_status text, plan_code text, plan_name text,
  stripe_subscription_id text, override_id uuid,
  override_expires_at timestamp with time zone, override_granted_by text,
  override_created_at timestamp with time zone, effective_plan text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
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
           AND (po.expires_at IS NULL OR po.expires_at > now()) THEN
        CASE WHEN po.plan_code = 'pro' THEN 'override_pro' ELSE 'override_plus' END
      WHEN s.status = 'active' AND p.code IN ('plus_monthly', 'plus_yearly') THEN 'stripe_plus'
      WHEN s.status = 'active' AND p.code IN ('pro_monthly', 'pro_yearly') THEN 'stripe_pro'
      ELSE 'free'
    END as effective_plan
  FROM auth.users au
  LEFT JOIN public.subscriptions s ON s.user_id = au.id
  LEFT JOIN public.plans p ON p.id = s.plan_id
  LEFT JOIN public.plan_overrides po ON po.user_id = au.id AND po.revoked_at IS NULL
  ORDER BY au.created_at DESC
$$;
