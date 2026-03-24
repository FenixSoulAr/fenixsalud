
-- Add columns needed for Google Play RTDN webhook handling
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS provider_product_id text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

-- Create index for looking up subscriptions by provider_subscription_id (purchaseToken)
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_subscription_id
  ON public.subscriptions (provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
