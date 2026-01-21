-- Fix storage policies for contributor uploads
-- The current policy may not be working correctly

-- First, drop all existing INSERT policies for health-files
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Owner and contributor can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Contributors can upload files" ON storage.objects;

-- Create a more robust INSERT policy using can_modify_data function
CREATE POLICY "Owner and contributor can upload files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'health-files'
  AND (
    -- The folder structure is: owner_id/entity_type/entity_id/filename
    -- Check if user can modify data for this profile owner
    public.can_modify_data(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);

-- Also ensure SELECT policy exists for all with access
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Owner contributor viewer can view files" ON storage.objects;

CREATE POLICY "Users with access can view files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'health-files'
  AND public.can_access_profile(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Ensure DELETE policy exists for owner only
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Only owner can delete files" ON storage.objects;

CREATE POLICY "Only owner can delete files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'health-files'
  AND public.is_data_owner(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Ensure UPDATE policy exists for owner and contributor
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Owner and contributor can update files" ON storage.objects;

CREATE POLICY "Owner and contributor can update files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'health-files'
  AND public.can_modify_data(auth.uid(), (storage.foldername(name))[1]::uuid)
);