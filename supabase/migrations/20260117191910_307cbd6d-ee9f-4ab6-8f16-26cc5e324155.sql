-- Add 'Daily' to the repeat_rule enum
ALTER TYPE public.repeat_rule ADD VALUE IF NOT EXISTS 'Daily' AFTER 'None';