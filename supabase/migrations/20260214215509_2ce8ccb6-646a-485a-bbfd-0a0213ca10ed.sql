
-- Table for audit run traceability
CREATE TABLE public.audit_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  admin_user_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  totals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.audit_runs ENABLE ROW LEVEL SECURITY;

-- Only admins via service_role can insert (no client access)
CREATE POLICY "audit_runs_no_client_insert" ON public.audit_runs FOR INSERT WITH CHECK (false);
CREATE POLICY "audit_runs_no_client_update" ON public.audit_runs FOR UPDATE USING (false);
CREATE POLICY "audit_runs_no_client_delete" ON public.audit_runs FOR DELETE USING (false);

-- Admins can read all audit runs (via service_role in edge function)
-- Regular users cannot read
CREATE POLICY "audit_runs_no_client_read" ON public.audit_runs FOR SELECT USING (false);
