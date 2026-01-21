-- Update storage INSERT policy to allow contributors to upload files
-- First, drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Owner and contributor can upload files" ON storage.objects;

-- Create new INSERT policy that allows owner OR contributor to upload
CREATE POLICY "Owner and contributor can upload files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'health-files'
  AND (
    -- Owner can always upload
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Contributor can upload to profiles they have contributor access to
    EXISTS (
      SELECT 1 FROM public.profile_shares
      WHERE profile_shares.owner_id::text = (storage.foldername(name))[1]
        AND profile_shares.shared_with_user_id = auth.uid()
        AND profile_shares.role = 'contributor'
        AND profile_shares.status = 'active'
    )
  )
);