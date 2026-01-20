import { User, Users, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSharing } from "@/contexts/SharingContext";
import { getLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

export function ActiveProfileIndicator() {
  const {
    sharedWithMe,
    isViewingOwnProfile,
    activeProfileOwnerId,
    activeProfileOwnerName,
    currentRole,
    switchToProfile,
    switchToOwnProfile,
    loading,
    needsProfileSelection,
  } = useSharing();
  const lang = getLanguage();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-sidebar-accent/50 rounded-lg animate-pulse">
        <div className="h-4 w-4 bg-muted rounded" />
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
    );
  }

  // Determine display name and role label
  const profileName = isViewingOwnProfile
    ? lang === "es"
      ? "Mi Salud"
      : "My Health"
    : activeProfileOwnerName || (lang === "es" ? "Perfil compartido" : "Shared Profile");

  const roleLabel = 
    currentRole === "owner" 
      ? lang === "es" ? "Propietario" : "Owner"
      : currentRole === "contributor"
      ? lang === "es" ? "Colaborador" : "Contributor"
      : lang === "es" ? "Solo lectura" : "Viewer";

  const hasMultipleProfiles = sharedWithMe.length > 0;

  // If no shared profiles, just show static indicator
  if (!hasMultipleProfiles) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-sidebar-accent/50 rounded-lg border border-sidebar-border">
        <User className="h-4 w-4 text-primary flex-shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-muted-foreground">
            {lang === "es" ? "Perfil" : "Profile"}
          </span>
          <span className="text-sm font-medium text-sidebar-foreground truncate">
            {profileName} <span className="text-muted-foreground font-normal">({roleLabel})</span>
          </span>
        </div>
      </div>
    );
  }

  // With shared profiles, show dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-between gap-2 px-3 py-5 h-auto bg-sidebar-accent/50 border border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent",
            needsProfileSelection && "ring-2 ring-primary animate-pulse"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isViewingOwnProfile ? (
              <User className="h-4 w-4 flex-shrink-0 text-primary" />
            ) : (
              <Users className="h-4 w-4 flex-shrink-0 text-primary" />
            )}
            <div className="flex flex-col items-start min-w-0">
              <span className="text-xs text-muted-foreground">
                {lang === "es" ? "Perfil" : "Profile"}
              </span>
              <span className="text-sm font-medium truncate">
                {profileName} <span className="text-muted-foreground font-normal">({roleLabel})</span>
              </span>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 bg-popover border border-border shadow-lg z-50">
        {/* My own profile */}
        <DropdownMenuItem
          onClick={switchToOwnProfile}
          className="flex items-center gap-2 cursor-pointer py-3"
        >
          <User className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="block truncate font-medium">
              {lang === "es" ? "Mi Salud" : "My Health"}
            </span>
            <span className="text-xs text-muted-foreground">
              {lang === "es" ? "Propietario" : "Owner"}
            </span>
          </div>
          {isViewingOwnProfile && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
        </DropdownMenuItem>

        {sharedWithMe.length > 0 && <DropdownMenuSeparator />}

        {/* Shared profiles */}
        {sharedWithMe.map((profile) => {
          const isSelected = !isViewingOwnProfile && profile.owner_id === activeProfileOwnerId;
          const displayName = profile.owner_name || profile.owner_email || 
            `User ${profile.owner_id.slice(0, 8)}...`;
          const sharedRoleLabel = profile.role === "viewer"
            ? lang === "es" ? "Solo lectura" : "Viewer"
            : lang === "es" ? "Colaborador" : "Contributor";
          
          return (
            <DropdownMenuItem
              key={profile.owner_id}
              onClick={() => switchToProfile(profile.owner_id)}
              className="flex items-center gap-2 cursor-pointer py-3"
            >
              <Users className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="block truncate font-medium">
                  {displayName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {sharedRoleLabel}
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
