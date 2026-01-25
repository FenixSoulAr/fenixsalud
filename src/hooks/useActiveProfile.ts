import { useSharing } from "@/contexts/SharingContext";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook that provides the correct profile_id for data operations based on the active profile.
 * 
 * All health data is now scoped by profile_id, not user_id.
 * This allows family profiles (user_id = NULL) to have their own separate data.
 * 
 * IMPORTANT: 
 * - Use `dataProfileId` for filtering/inserting profile-scoped data
 * - Use `currentUserId` for the `user_id` column in INSERT operations (tracks who created the record)
 */
export function useActiveProfile() {
  const { user } = useAuth();
  const { 
    activeProfileId,
    activeProfileOwnerId, 
    activeProfileOwnerName,
    currentRole,
    isViewingOwnProfile,
    canEdit,
    canDelete,
    canManageSharing,
    loading,
  } = useSharing();

  // The profile_id to use for all data operations (insert/filter)
  // This is the KEY change: we now use the actual profile ID, not the owner's user ID
  const dataProfileId = activeProfileId;

  // The current authenticated user's ID - use this for user_id in INSERT operations
  // This tracks WHO created the record, not WHICH profile it belongs to
  const currentUserId = user?.id || null;

  // Legacy: dataOwnerId kept for backward compatibility during migration
  // New code should use dataProfileId instead
  const dataOwnerId = isViewingOwnProfile ? user?.id : activeProfileOwnerId;

  return {
    // The active profile's ID - USE THIS FOR ALL DATA OPERATIONS
    activeProfileId,
    // The profile_id to use for INSERT operations and data filtering
    dataProfileId,
    // The current authenticated user's ID - use for user_id column in INSERTs
    currentUserId,
    // Legacy: The user_id for backward compatibility (deprecated)
    dataOwnerId,
    // The profile owner's ID (for display/filtering purposes)
    activeProfileOwnerId,
    // The profile owner's name (for display)
    activeProfileOwnerName,
    // Current user's role
    currentRole,
    // Whether viewing own profile
    isViewingOwnProfile,
    // Permission flags
    canEdit,
    canDelete,
    canManageSharing,
    // Loading state
    loading,
  };
}
