
-- Create admin_roles table
CREATE TABLE public.admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Enable RLS - fully locked down (service_role only)
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_roles_no_client_select" ON public.admin_roles FOR SELECT USING (false);
CREATE POLICY "admin_roles_no_client_insert" ON public.admin_roles FOR INSERT WITH CHECK (false);
CREATE POLICY "admin_roles_no_client_update" ON public.admin_roles FOR UPDATE USING (false);
CREATE POLICY "admin_roles_no_client_delete" ON public.admin_roles FOR DELETE USING (false);

-- Security definer function to check admin role (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_admin_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Seed initial admins
INSERT INTO public.admin_roles (user_id, role, created_by) VALUES
  ('0b5a826e-949d-469f-8f73-8ab05c9eb619', 'admin', NULL),
  ('ae8f0af0-f62e-4b3f-ae2e-536aa7766013', 'admin', '0b5a826e-949d-469f-8f73-8ab05c9eb619'),
  ('f2991c62-a8c4-482b-befb-e7c5717db508', 'admin', '0b5a826e-949d-469f-8f73-8ab05c9eb619');
