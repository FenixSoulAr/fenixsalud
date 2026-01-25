import { useSharing } from "@/contexts/SharingContext";
import { useProfileTypeLabel } from "@/hooks/useProfileTypeLabel";
import { User, Users } from "lucide-react";
import { getLanguage } from "@/i18n";

export function ActiveProfileBanner() {
  const { 
    myProfiles, 
    sharedWithMe, 
    activeProfileId, 
    loading 
  } = useSharing();
  const { label: roleLabel, type: profileType } = useProfileTypeLabel();
  const lang = getLanguage();

  // Don't show while loading or if no profile selected
  if (loading || !activeProfileId) {
    return null;
  }

  // Find the active profile
  const activeOwnProfile = myProfiles.find(p => p.id === activeProfileId);
  const activeSharedProfile = sharedWithMe.find(s => s.profile_id === activeProfileId);
  const isOwnProfile = !!activeOwnProfile;

  // Build the display name with fallbacks
  const profileName = activeOwnProfile?.full_name 
    || activeSharedProfile?.profile_name 
    || activeSharedProfile?.owner_name
    || (lang === "es" ? "Perfil sin nombre" : "Unnamed Profile");

  // Determine visual style based on profile type
  const isViewer = profileType === "viewer";
  const isContributor = profileType === "contributor";
  const isFamily = profileType === "family";

  return (
    <div 
      className={`
        flex items-center gap-3 px-4 py-3 mb-6 rounded-xl border
        ${isViewer 
          ? "bg-secondary/50 border-secondary" 
          : isContributor 
            ? "bg-accent/30 border-accent" 
            : isFamily
              ? "bg-muted/50 border-muted-foreground/20"
              : "bg-primary/5 border-primary/20"
        }
      `}
    >
      {isOwnProfile ? (
        <div className={`h-9 w-9 rounded-full flex items-center justify-center ${isFamily ? "bg-muted" : "bg-primary/10"}`}>
          <User className={`h-5 w-5 ${isFamily ? "text-muted-foreground" : "text-primary"}`} />
        </div>
      ) : (
        <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center">
          <Users className="h-5 w-5 text-accent-foreground" />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">
          {lang === "es" ? "Perfil activo" : "Active Profile"}
        </p>
        <p className="text-sm font-semibold text-foreground truncate">
          {profileName}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({roleLabel})
          </span>
        </p>
      </div>
    </div>
  );
}
