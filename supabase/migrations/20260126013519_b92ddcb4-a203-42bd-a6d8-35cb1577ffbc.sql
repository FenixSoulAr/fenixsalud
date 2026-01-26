-- Drop old conflicting/mismatched storage policies
DROP POLICY IF EXISTS "Only owner can delete files" ON storage.objects;
DROP POLICY IF EXISTS "Only owners can delete files" ON storage.objects;
DROP POLICY IF EXISTS "Owner and contributor can update files" ON storage.objects;
DROP POLICY IF EXISTS "Owner and contributor can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to accessible profiles" ON storage.objects;
DROP POLICY IF EXISTS "Users can view accessible files" ON storage.objects;
DROP POLICY IF EXISTS "Users with access can view files" ON storage.objects;

-- CREATE NEW POLICIES using profile_id (first folder segment)
-- The upload path is: {profile_id}/{entityType}/{entityId}/{timestamp_filename}

-- SELECT: Owners, Contributors, and Viewers can view files
CREATE POLICY "storage_select_accessible_profiles"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'health-files' 
  AND can_access_profile_by_id(
    (storage.foldername(name))[1]::uuid, 
    auth.uid()
  )
);

-- INSERT: Only Owners and Contributors can upload files
CREATE POLICY "storage_insert_modifiable_profiles"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'health-files' 
  AND can_modify_profile_by_id(
    (storage.foldername(name))[1]::uuid, 
    auth.uid()
  )
);

-- UPDATE: Only Owners and Contributors can update files
CREATE POLICY "storage_update_modifiable_profiles"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'health-files' 
  AND can_modify_profile_by_id(
    (storage.foldername(name))[1]::uuid, 
    auth.uid()
  )
);

-- DELETE: Only profile Owners can delete files
CREATE POLICY "storage_delete_owner_only"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'health-files' 
  AND is_profile_owner(
    (storage.foldername(name))[1]::uuid, 
    auth.uid()
  )
);