-- Sync sandbox with production after H-15 incident
-- D-1: discounts.plan_code (text NOT NULL DEFAULT 'plus')
ALTER TABLE public.discounts
  ADD COLUMN IF NOT EXISTS plan_code text NOT NULL DEFAULT 'plus';

-- D-3: subscriptions.pending_plan_code (text NULL)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan_code text;

-- D-2: profile_shares.profile_id already exists in sandbox — no-op.