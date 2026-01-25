import { useAuth } from "@/contexts/AuthContext";
import { useSharing, SharingRole } from "@/contexts/SharingContext";
import { getLanguage } from "@/i18n";

export type ProfileTypeLabel = "primary" | "family" | "contributor" | "viewer";

interface ProfileTypeLabelResult {
  /** The localized label to display (e.g., "Propietario", "Familiar", "Colaborador", "Solo lectura") */
  label: string;
  /** The raw type key for conditional styling */
  type: ProfileTypeLabel;
}

/**
 * Computes the correct profile type label based on the active profile:
 * - If activeProfile.user_id IS NULL => "Familiar" (family profile)
 * - If activeProfile.user_id === auth.uid() => "Propietario" (primary profile)
 * - Else (viewing via profile_shares) => based on share role: "Colaborador" or "Solo lectura"
 */
export function useProfileTypeLabel(): ProfileTypeLabelResult {
  const { user } = useAuth();
  const { myProfiles, sharedWithMe, activeProfileId } = useSharing();
  const lang = getLanguage();

  // Find the active profile in owned profiles
  const activeOwnProfile = myProfiles.find(p => p.id === activeProfileId);
  
  // Find the active profile in shared profiles
  const activeSharedProfile = sharedWithMe.find(s => s.profile_id === activeProfileId);

  // Determine profile type based on the rules
  if (activeOwnProfile) {
    // This is one of my owned profiles
    if (activeOwnProfile.user_id === null) {
      // Family profile (user_id IS NULL)
      return {
        type: "family",
        label: lang === "es" ? "Familiar" : "Family",
      };
    } else if (activeOwnProfile.user_id === user?.id) {
      // Primary profile (user_id === auth.uid())
      return {
        type: "primary",
        label: lang === "es" ? "Propietario" : "Owner",
      };
    }
  }
  
  if (activeSharedProfile) {
    // This is a shared profile - use the share role
    if (activeSharedProfile.role === "contributor") {
      return {
        type: "contributor",
        label: lang === "es" ? "Colaborador" : "Contributor",
      };
    } else {
      return {
        type: "viewer",
        label: lang === "es" ? "Solo lectura" : "Viewer",
      };
    }
  }

  // Fallback - shouldn't happen but be safe
  return {
    type: "primary",
    label: lang === "es" ? "Propietario" : "Owner",
  };
}
