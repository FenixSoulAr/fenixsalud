
-- 1) Drop the overly permissive shared select policy
DROP POLICY IF EXISTS profiles_select_shared ON public.profiles;

-- 2) Create secure RPC that filters columns based on caller's role
CREATE OR REPLACE FUNCTION public.get_profile_for_role(_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _profile profiles%ROWTYPE;
  _is_owner boolean;
  _has_share boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Fetch the profile
  SELECT * INTO _profile FROM profiles WHERE id = _profile_id;

  IF _profile IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if caller is owner
  _is_owner := (_profile.owner_user_id = _user_id);

  IF _is_owner THEN
    -- Owner gets all fields
    RETURN jsonb_build_object(
      'id', _profile.id,
      'user_id', _profile.user_id,
      'owner_user_id', _profile.owner_user_id,
      'first_name', _profile.first_name,
      'last_name', _profile.last_name,
      'full_name', _profile.full_name,
      'national_id', _profile.national_id,
      'phone', _profile.phone,
      'insurance_provider', _profile.insurance_provider,
      'insurance_plan', _profile.insurance_plan,
      'insurance_member_id', _profile.insurance_member_id,
      'allergies', _profile.allergies,
      'notes', _profile.notes,
      'timezone', _profile.timezone,
      'notification_in_app', _profile.notification_in_app,
      'notification_email', _profile.notification_email,
      'created_at', _profile.created_at,
      'updated_at', _profile.updated_at
    );
  END IF;

  -- Check if caller has shared access
  SELECT EXISTS (
    SELECT 1 FROM profile_shares ps
    WHERE ps.profile_id = _profile_id
      AND ps.shared_with_user_id = _user_id
      AND ps.status = 'active'
  ) INTO _has_share;

  IF _has_share THEN
    -- Shared user gets limited fields only
    RETURN jsonb_build_object(
      'id', _profile.id,
      'user_id', _profile.user_id,
      'owner_user_id', _profile.owner_user_id,
      'first_name', _profile.first_name,
      'last_name', _profile.last_name,
      'full_name', _profile.full_name,
      'allergies', _profile.allergies,
      'timezone', _profile.timezone,
      'created_at', _profile.created_at,
      'updated_at', _profile.updated_at
    );
  END IF;

  -- No access
  RETURN NULL;
END;
$$;
