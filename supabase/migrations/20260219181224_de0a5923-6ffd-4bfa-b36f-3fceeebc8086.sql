
CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION unaccent SET SCHEMA extensions;

-- Update the unaccent wrapper functions to reference the new schema
CREATE OR REPLACE FUNCTION public.unaccent(text)
RETURNS text
LANGUAGE sql
STABLE PARALLEL SAFE STRICT
SET search_path = 'extensions'
AS $$
  SELECT extensions.unaccent($1);
$$;
