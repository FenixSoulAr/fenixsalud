-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;

-- Create new SELECT policy that allows shared profile access
-- Files are stored as: {profile_owner_id}/{entity_type}/{entity_id}/{filename}
-- The first folder segment is the profile owner's user_id
CREATE POLICY "Users can view accessible files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'health-files' 
  AND public.can_access_profile(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Update INSERT policy to use can_modify_data (owner + contributor can upload)
DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;

CREATE POLICY "Users can upload to accessible profiles" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'health-files' 
  AND public.can_modify_data(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Update DELETE policy to only allow data owner (not contributor)
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

CREATE POLICY "Only owners can delete files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'health-files' 
  AND public.is_data_owner(auth.uid(), (storage.foldername(name))[1]::uuid)
);