-- Create enum for sharing roles
CREATE TYPE public.sharing_role AS ENUM ('viewer', 'contributor');

-- Create profile_shares table for managing shared access
CREATE TABLE public.profile_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  shared_with_email TEXT NOT NULL,
  shared_with_user_id UUID,
  role sharing_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (owner_id, shared_with_email)
);

-- Enable RLS
ALTER TABLE public.profile_shares ENABLE ROW LEVEL SECURITY;

-- Owners can view their shares
CREATE POLICY "Owners can view their shares"
ON public.profile_shares
FOR SELECT
USING (auth.uid() = owner_id);

-- Shared users can view shares where they are the recipient
CREATE POLICY "Shared users can view their received shares"
ON public.profile_shares
FOR SELECT
USING (auth.uid() = shared_with_user_id);

-- Owners can insert shares (max 2 enforced in app)
CREATE POLICY "Owners can create shares"
ON public.profile_shares
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- Owners can update their shares
CREATE POLICY "Owners can update their shares"
ON public.profile_shares
FOR UPDATE
USING (auth.uid() = owner_id);

-- Owners can delete their shares
CREATE POLICY "Owners can delete their shares"
ON public.profile_shares
FOR DELETE
USING (auth.uid() = owner_id);

-- Add trigger for updated_at
CREATE TRIGGER update_profile_shares_updated_at
BEFORE UPDATE ON public.profile_shares
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer function to check if user can access a profile
CREATE OR REPLACE FUNCTION public.can_access_profile(_user_id UUID, _profile_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    _user_id = _profile_owner_id
    OR EXISTS (
      SELECT 1 FROM public.profile_shares
      WHERE owner_id = _profile_owner_id
        AND shared_with_user_id = _user_id
    )
$$;

-- Security definer function to check sharing role
CREATE OR REPLACE FUNCTION public.get_sharing_role(_user_id UUID, _profile_owner_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN _user_id = _profile_owner_id THEN 'owner'
      ELSE (
        SELECT role::text FROM public.profile_shares
        WHERE owner_id = _profile_owner_id
          AND shared_with_user_id = _user_id
        LIMIT 1
      )
    END
$$;

-- Function to check if user can modify data (owner or contributor)
CREATE OR REPLACE FUNCTION public.can_modify_data(_user_id UUID, _profile_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    _user_id = _profile_owner_id
    OR EXISTS (
      SELECT 1 FROM public.profile_shares
      WHERE owner_id = _profile_owner_id
        AND shared_with_user_id = _user_id
        AND role = 'contributor'
    )
$$;

-- Function to check if user is owner (for delete operations)
CREATE OR REPLACE FUNCTION public.is_data_owner(_user_id UUID, _data_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = _data_owner_id
$$;