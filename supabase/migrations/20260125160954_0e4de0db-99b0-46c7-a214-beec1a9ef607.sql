-- Make user_id nullable for family profiles (user_id = NULL means no auth user linked)
ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;