-- App config key-value table for runtime feature flags (kill switch, etc.)
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO public.app_config (key, value, description) VALUES
  ('sw_kill_switch', 'false', 'If true, forces unregister of Service Worker on all web clients. Activate only in deploy emergencies.'),
  ('sw_kill_message', '', 'Optional message shown when kill switch is active. Empty = default text.'),
  ('app_min_version', '1.0.10', 'Minimum mobile app version. Reserved for future use.')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read config (kill switch must reach all clients)
CREATE POLICY "app_config_read_all_authenticated"
  ON public.app_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Only superadmins can write (uses existing admin_roles convention)
CREATE POLICY "app_config_write_superadmin_only"
  ON public.app_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.role = 'superadmin'
    )
  );

-- Auto-maintain updated_at and updated_by
CREATE OR REPLACE FUNCTION public.update_app_config_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_config_updated_at ON public.app_config;
CREATE TRIGGER app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_config_timestamp();