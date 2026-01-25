import { Check, ChevronDown, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSharing } from "@/contexts/SharingContext";
import { getLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

export function ProfileSwitcher() {
  const {
    myProfiles,
    sharedWithMe,
    activeProfileId,
    switchToProfile,
    loading,
    needsProfileSelection,
  } = useSharing();
  const lang = getLanguage();

  // Don't show if only one profile and no shared profiles
  if (loading || (myProfiles.length <= 1 && sharedWithMe.length === 0)) {
    return null;
  }

  const activeProfile = myProfiles.find(p => p.id === activeProfileId);
  const activeShared = sharedWithMe.find(s => s.profile_id === activeProfileId);
  
  const currentLabel = activeProfile?.full_name 
    || activeShared?.profile_name 
    || activeShared?.owner_name
    || (lang === "es" ? "Mi perfil" : "My Profile");

  const roleLabel = activeShared?.role === "viewer" 
    ? (lang === "es" ? "Solo lectura" : "View only")
    : activeShared?.role === "contributor"
    ? (lang === "es" ? "Colaborador" : "Contributor")
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full justify-between gap-2 bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent",
            needsProfileSelection && "ring-2 ring-primary animate-pulse"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Users className="h-4 w-4 flex-shrink-0 text-primary" />
            <div className="flex flex-col items-start min-w-0">
              <span className="truncate text-sm">{currentLabel}</span>
              {roleLabel && !activeProfile && (
                <span className="text-xs text-muted-foreground">{roleLabel}</span>
              )}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>
          {lang === "es" ? "Cambiar perfil" : "Switch Profile"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* My profiles */}
        {myProfiles.map((profile) => {
          const isSelected = profile.id === activeProfileId;
          const displayName = profile.full_name || (profile.is_primary 
            ? (lang === "es" ? "Mi perfil" : "My Profile")
            : (lang === "es" ? "Sin nombre" : "Unnamed"));
          
          return (
            <DropdownMenuItem
              key={profile.id}
              onClick={() => switchToProfile(profile.id)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <User className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="block truncate font-medium">
                  {displayName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {profile.is_primary 
                    ? (lang === "es" ? "Principal" : "Primary")
                    : (lang === "es" ? "Familiar" : "Family")}
                </span>
              </div>
              {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
            </DropdownMenuItem>
          );
        })}

        {sharedWithMe.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              {lang === "es" ? "Perfiles compartidos" : "Shared Profiles"}
            </DropdownMenuLabel>
          </>
        )}

        {/* Shared profiles */}
        {sharedWithMe.map((share) => {
          const isSelected = share.profile_id === activeProfileId;
          const displayName = share.profile_name || share.owner_name || 
            `User ${share.owner_id.slice(0, 8)}...`;
          
          return (
            <DropdownMenuItem
              key={share.profile_id}
              onClick={() => switchToProfile(share.profile_id)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Users className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="block truncate font-medium">
                  {displayName}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {share.role === "viewer"
                    ? lang === "es"
                      ? "Solo lectura"
                      : "View only"
                    : lang === "es"
                    ? "Colaborador"
                    : "Contributor"}
                </span>
              </div>
              {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
