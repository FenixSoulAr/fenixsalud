
-- Server-side enforcement of share limits based on plan entitlements
-- Priority: Admin > Override > Subscription > Free (0 shares)

CREATE OR REPLACE FUNCTION public.check_share_limit_by_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid := NEW.owner_id;
  v_active_share_count int;
  v_max_shares int;
  v_is_admin boolean;
  v_has_override boolean;
BEGIN
  -- 1) Admins bypass limits
  SELECT EXISTS (
    SELECT 1 FROM admin_roles WHERE user_id = v_owner_id AND role IN ('admin', 'superadmin')
  ) INTO v_is_admin;
  
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- 2) Count existing active/pending shares for this profile
  SELECT COUNT(*) INTO v_active_share_count
  FROM profile_shares
  WHERE profile_id = NEW.profile_id
    AND status IN ('pending', 'active');

  -- 3) Check for active plan override (treated as Plus = 1 share)
  SELECT EXISTS (
    SELECT 1 FROM plan_overrides
    WHERE user_id = v_owner_id
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_has_override;

  IF v_has_override THEN
    -- Override users get Plus-level sharing (1 share per profile)
    IF v_active_share_count >= 1 THEN
      RAISE EXCEPTION 'Maximum 1 share allowed per profile for current plan';
    END IF;
    RETURN NEW;
  END IF;

  -- 4) Check subscription entitlements
  SELECT COALESCE(
    (SELECT (e.value->>'limit')::int
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     JOIN entitlements e ON e.plan_id = p.id AND e.key = 'sharing.max_grantees'
     WHERE s.user_id = v_owner_id
       AND s.status = 'active'
     ORDER BY s.current_period_end DESC NULLS LAST
     LIMIT 1),
    0  -- Free plan default
  ) INTO v_max_shares;

  IF v_active_share_count >= v_max_shares THEN
    RAISE EXCEPTION 'Maximum % shares allowed per profile for current plan', v_max_shares;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_share_limit_by_plan
  BEFORE INSERT ON public.profile_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.check_share_limit_by_plan();
