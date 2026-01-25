-- Create plan_overrides table for admin-granted Plus access
CREATE TABLE public.plan_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  granted_by_email TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL = indefinite
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id) -- One override per user
);

-- Enable RLS
ALTER TABLE public.plan_overrides ENABLE ROW LEVEL SECURITY;

-- Only allow reading via service role (edge functions)
-- No direct client access
CREATE POLICY "plan_overrides_no_client_read" 
ON public.plan_overrides 
FOR SELECT 
USING (false);

CREATE POLICY "plan_overrides_no_client_insert" 
ON public.plan_overrides 
FOR INSERT 
WITH CHECK (false);

CREATE POLICY "plan_overrides_no_client_update" 
ON public.plan_overrides 
FOR UPDATE 
USING (false);

CREATE POLICY "plan_overrides_no_client_delete" 
ON public.plan_overrides 
FOR DELETE 
USING (false);

-- Create an admin_users view to list users with their plan status
-- This will be queried via edge function with service role
CREATE VIEW public.v_admin_user_list AS
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
LEFT JOIN public.plan_overrides po ON po.user_id = au.id AND po.revoked_at IS NULL;