-- Add last_used_at to discounts table for tracking
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS last_used_at timestamp with time zone;

-- Create promo code redemptions table
CREATE TABLE public.promo_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id uuid NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  redeemed_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'checkout', -- 'checkout' or 'admin_grant'
  override_id uuid REFERENCES public.plan_overrides(id), -- if internal override was created
  UNIQUE(discount_id, user_id) -- prevent multiple redemptions per user
);

-- Enable RLS
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS: No direct client access - only via edge functions
CREATE POLICY "promo_code_redemptions_no_client_read" ON public.promo_code_redemptions
  FOR SELECT USING (false);
CREATE POLICY "promo_code_redemptions_no_client_insert" ON public.promo_code_redemptions
  FOR INSERT WITH CHECK (false);
CREATE POLICY "promo_code_redemptions_no_client_update" ON public.promo_code_redemptions
  FOR UPDATE USING (false);
CREATE POLICY "promo_code_redemptions_no_client_delete" ON public.promo_code_redemptions
  FOR DELETE USING (false);

-- Function to get promo codes with usage stats (for admin)
CREATE OR REPLACE FUNCTION public.get_admin_promo_codes()
RETURNS TABLE (
  id uuid,
  code text,
  type text,
  value integer,
  duration_type text,
  duration_value integer,
  max_redemptions integer,
  redeemed_count integer,
  is_active boolean,
  valid_from timestamp with time zone,
  valid_to timestamp with time zone,
  stripe_coupon_id text,
  created_at timestamp with time zone,
  last_used_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    d.id,
    d.code,
    d.type,
    d.value,
    d.duration_type,
    d.duration_value,
    d.max_redemptions,
    d.redeemed_count,
    d.is_active,
    d.valid_from,
    d.valid_to,
    d.stripe_coupon_id,
    d.created_at,
    d.last_used_at
  FROM public.discounts d
  ORDER BY d.created_at DESC
$$;

-- Function to validate and redeem a promo code
CREATE OR REPLACE FUNCTION public.validate_promo_code(_code text, _user_id uuid)
RETURNS TABLE (
  valid boolean,
  error_message text,
  discount_id uuid,
  discount_type text,
  discount_value integer,
  duration_type text,
  duration_value integer,
  stripe_coupon_id text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _discount RECORD;
  _already_redeemed boolean;
BEGIN
  -- Find the discount by code (case-insensitive)
  SELECT * INTO _discount
  FROM public.discounts
  WHERE LOWER(code) = LOWER(_code);
  
  -- Code not found
  IF _discount IS NULL THEN
    RETURN QUERY SELECT false, 'Invalid promo code'::text, NULL::uuid, NULL::text, NULL::integer, NULL::text, NULL::integer, NULL::text;
    RETURN;
  END IF;
  
  -- Code is inactive
  IF NOT _discount.is_active THEN
    RETURN QUERY SELECT false, 'This promo code is no longer active'::text, NULL::uuid, NULL::text, NULL::integer, NULL::text, NULL::integer, NULL::text;
    RETURN;
  END IF;
  
  -- Check valid_from
  IF _discount.valid_from IS NOT NULL AND _discount.valid_from > now() THEN
    RETURN QUERY SELECT false, 'This promo code is not yet active'::text, NULL::uuid, NULL::text, NULL::integer, NULL::text, NULL::integer, NULL::text;
    RETURN;
  END IF;
  
  -- Check valid_to (expires_at)
  IF _discount.valid_to IS NOT NULL AND _discount.valid_to < now() THEN
    RETURN QUERY SELECT false, 'This promo code has expired'::text, NULL::uuid, NULL::text, NULL::integer, NULL::text, NULL::integer, NULL::text;
    RETURN;
  END IF;
  
  -- Check max redemptions
  IF _discount.max_redemptions IS NOT NULL AND _discount.redeemed_count >= _discount.max_redemptions THEN
    RETURN QUERY SELECT false, 'This promo code has reached its maximum redemptions'::text, NULL::uuid, NULL::text, NULL::integer, NULL::text, NULL::integer, NULL::text;
    RETURN;
  END IF;
  
  -- Check if user already redeemed
  SELECT EXISTS (
    SELECT 1 FROM public.promo_code_redemptions
    WHERE discount_id = _discount.id AND user_id = _user_id
  ) INTO _already_redeemed;
  
  IF _already_redeemed THEN
    RETURN QUERY SELECT false, 'You have already used this promo code'::text, NULL::uuid, NULL::text, NULL::integer, NULL::text, NULL::integer, NULL::text;
    RETURN;
  END IF;
  
  -- Valid!
  RETURN QUERY SELECT 
    true,
    NULL::text,
    _discount.id,
    _discount.type,
    _discount.value,
    _discount.duration_type,
    _discount.duration_value,
    _discount.stripe_coupon_id;
END;
$$;