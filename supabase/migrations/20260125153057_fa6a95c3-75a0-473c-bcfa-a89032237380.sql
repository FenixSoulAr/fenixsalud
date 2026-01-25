-- Step 1: Add owner_user_id column to profiles
ALTER TABLE public.profiles ADD COLUMN owner_user_id uuid;

-- Step 2: Set owner_user_id = user_id for all existing rows
UPDATE public.profiles SET owner_user_id = user_id;

-- Step 3: Make owner_user_id NOT NULL
ALTER TABLE public.profiles ALTER COLUMN owner_user_id SET NOT NULL;

-- Step 4: Create index for efficient queries
CREATE INDEX idx_profiles_owner_user_id ON public.profiles(owner_user_id);

-- Step 5: Drop existing RLS policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Shared users can view owner profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_owner" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_shared_active" ON public.profiles;

-- Step 6: Create new RLS policies for profiles based on owner_user_id
-- Owners can view all their profiles
CREATE POLICY "profiles_select_owner"
ON public.profiles FOR SELECT
USING (auth.uid() = owner_user_id);

-- Owners can insert profiles for themselves
CREATE POLICY "profiles_insert_owner"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = owner_user_id);

-- Owners can update their profiles
CREATE POLICY "profiles_update_owner"
ON public.profiles FOR UPDATE
USING (auth.uid() = owner_user_id);

-- Owners can delete their family profiles (not the primary one where user_id = owner_user_id)
CREATE POLICY "profiles_delete_owner"
ON public.profiles FOR DELETE
USING (auth.uid() = owner_user_id AND user_id IS NULL);

-- Shared users can view profiles shared with them
CREATE POLICY "profiles_select_shared"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profile_shares ps
    WHERE ps.profile_id = profiles.id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.status = 'active'
  )
);

-- Step 7: Update profile_shares RLS to use profile_id properly
-- Drop old policies
DROP POLICY IF EXISTS "Owners can create shares" ON public.profile_shares;
DROP POLICY IF EXISTS "Owners can delete their shares" ON public.profile_shares;
DROP POLICY IF EXISTS "Owners can update their shares" ON public.profile_shares;
DROP POLICY IF EXISTS "Owners can view their shares" ON public.profile_shares;
DROP POLICY IF EXISTS "Shared users can link themselves" ON public.profile_shares;
DROP POLICY IF EXISTS "Shared users can view their received shares" ON public.profile_shares;
DROP POLICY IF EXISTS "profile_shares_owner_read" ON public.profile_shares;
DROP POLICY IF EXISTS "profile_shares_read_active" ON public.profile_shares;

-- New profile_shares policies using owner_user_id from linked profile
CREATE POLICY "profile_shares_select_owner"
ON public.profile_shares FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "profile_shares_insert_owner"
ON public.profile_shares FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "profile_shares_update_owner"
ON public.profile_shares FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "profile_shares_delete_owner"
ON public.profile_shares FOR DELETE
USING (auth.uid() = owner_id);

-- Shared users can view shares targeting them
CREATE POLICY "profile_shares_select_shared"
ON public.profile_shares FOR SELECT
USING (
  auth.uid() = shared_with_user_id
  OR (shared_with_user_id IS NULL AND lower(shared_with_email) = lower(get_current_user_email()))
);

-- Shared users can link themselves (update pending to active)
CREATE POLICY "profile_shares_link_self"
ON public.profile_shares FOR UPDATE
USING (
  shared_with_user_id IS NULL 
  AND status = 'pending'
  AND lower(shared_with_email) = lower(get_current_user_email())
)
WITH CHECK (
  shared_with_user_id = auth.uid()
  AND status = 'active'
);

-- Step 8: Update helper functions to work with new model
CREATE OR REPLACE FUNCTION public.can_access_profile(_user_id uuid, _profile_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- User is the owner of this profile's owner_user_id
    _user_id = _profile_owner_id
    OR EXISTS (
      -- Or user has an active share to a profile owned by _profile_owner_id
      SELECT 1 FROM public.profile_shares ps
      JOIN public.profiles p ON ps.profile_id = p.id
      WHERE p.owner_user_id = _profile_owner_id
        AND ps.shared_with_user_id = _user_id
        AND ps.status = 'active'
    )
$$;

CREATE OR REPLACE FUNCTION public.can_modify_data(_user_id uuid, _profile_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    _user_id = _profile_owner_id
    OR EXISTS (
      SELECT 1 FROM public.profile_shares ps
      JOIN public.profiles p ON ps.profile_id = p.id
      WHERE p.owner_user_id = _profile_owner_id
        AND ps.shared_with_user_id = _user_id
        AND ps.role = 'contributor'
        AND ps.status = 'active'
    )
$$;

CREATE OR REPLACE FUNCTION public.get_sharing_role(_user_id uuid, _profile_owner_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN _user_id = _profile_owner_id THEN 'owner'
      ELSE (
        SELECT ps.role::text FROM public.profile_shares ps
        JOIN public.profiles p ON ps.profile_id = p.id
        WHERE p.owner_user_id = _profile_owner_id
          AND ps.shared_with_user_id = _user_id
          AND ps.status = 'active'
        LIMIT 1
      )
    END
$$;