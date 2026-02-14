
-- Drop existing check constraint on role
ALTER TABLE public.admin_roles DROP CONSTRAINT IF EXISTS admin_roles_role_check;

-- Add new check constraint allowing superadmin and admin
ALTER TABLE public.admin_roles ADD CONSTRAINT admin_roles_role_check CHECK (role IN ('superadmin', 'admin'));

-- Update the primary admin (owner) to superadmin
UPDATE public.admin_roles SET role = 'superadmin' WHERE user_id = '0b5a826e-949d-469f-8f73-8ab05c9eb619';

-- Update has_admin_role function to also recognize superadmin
CREATE OR REPLACE FUNCTION public.has_admin_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = _user_id AND role IN ('admin', 'superadmin')
  )
$$;
