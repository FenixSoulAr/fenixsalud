import { useSharing } from "@/contexts/SharingContext";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook that provides the correct user_id for data operations based on the active profile.
 * 
 * When viewing your own profile: returns your user ID
 * When viewing a shared profile: returns the profile owner's user ID
 * 
 * This ensures that data is created under the correct profile owner.
 */
export function useActiveProfile() {
  const { user } = useAuth();
  const { 
    activeProfileOwnerId, 
    activeProfileOwnerName,
    currentRole,
    isViewingOwnProfile,
    canEdit,
    canDelete,
    canManageSharing,
    loading,
  } = useSharing();

  // The user_id to use for all data operations (insert)
  // When viewing own profile: use logged-in user's ID
  // When viewing shared profile: use the profile owner's ID
  const dataOwnerId = isViewingOwnProfile ? user?.id : activeProfileOwnerId;

  return {
    // The user_id to use for INSERT operations
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
