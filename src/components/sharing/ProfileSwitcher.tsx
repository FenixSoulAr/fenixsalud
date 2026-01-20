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

  // Don't show if no shared profiles available
  if (loading || sharedWithMe.length === 0) {
    return null;
  }

  const currentLabel = isViewingOwnProfile
    ? lang === "es"
      ? "Mi perfil"
      : "My Profile"
    : activeProfileOwnerName || (lang === "es" ? "Perfil compartido" : "Shared Profile");

  const roleLabel = currentRole === "viewer" 
    ? (lang === "es" ? "Solo lectura" : "View only")
    : currentRole === "contributor"
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
              {roleLabel && !isViewingOwnProfile && (
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

        {/* My own profile */}
        <DropdownMenuItem
          onClick={switchToOwnProfile}
          className="flex items-center gap-2 cursor-pointer"
        >
          <User className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="block truncate font-medium">
              {lang === "es" ? "Mi perfil" : "My Profile"}
            </span>
            <span className="text-xs text-muted-foreground">
              {lang === "es" ? "Propietario" : "Owner"}
            </span>
          </div>
          {isViewingOwnProfile && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
        </DropdownMenuItem>

        {sharedWithMe.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              {lang === "es" ? "Perfiles compartidos" : "Shared Profiles"}
            </DropdownMenuLabel>
          </>
        )}

        {/* Shared profiles */}
        {sharedWithMe.map((profile) => {
          const isSelected = !isViewingOwnProfile && profile.owner_id === activeProfileOwnerId;
          const displayName = profile.owner_name || profile.owner_email || 
            `User ${profile.owner_id.slice(0, 8)}...`;
          
          return (
            <DropdownMenuItem
              key={profile.owner_id}
              onClick={() => switchToProfile(profile.owner_id)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Users className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="block truncate font-medium">
                  {displayName}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {profile.role === "viewer"
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
