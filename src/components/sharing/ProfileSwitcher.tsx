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
import { useAuth } from "@/contexts/AuthContext";
import { getLanguage } from "@/i18n";

export function ProfileSwitcher() {
  const { user } = useAuth();
  const {
    sharedWithMe,
    isViewingOwnProfile,
    activeProfileOwnerId,
    activeProfileOwnerName,
    switchToProfile,
    switchToOwnProfile,
    loading,
  } = useSharing();
  const lang = getLanguage();

  // Don't show if no shared profiles
  if (loading || sharedWithMe.length === 0) {
    return null;
  }

  const currentLabel = isViewingOwnProfile
    ? lang === "es"
      ? "Mi perfil"
      : "My Profile"
    : activeProfileOwnerName || (lang === "es" ? "Perfil compartido" : "Shared Profile");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between gap-2 bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Users className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="truncate text-sm">{currentLabel}</span>
          </div>
          <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>
          {lang === "es" ? "Cambiar perfil" : "Switch Profile"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* My own profile */}
        <DropdownMenuItem
          onClick={switchToOwnProfile}
          className="flex items-center gap-2 cursor-pointer"
        >
          <User className="h-4 w-4" />
          <span className="flex-1">
            {lang === "es" ? "Mi perfil" : "My Profile"}
          </span>
          {isViewingOwnProfile && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>

        {sharedWithMe.length > 0 && <DropdownMenuSeparator />}

        {/* Shared profiles */}
        {sharedWithMe.map((profile) => (
          <DropdownMenuItem
            key={profile.owner_id}
            onClick={() => switchToProfile(profile.owner_id)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Users className="h-4 w-4" />
            <div className="flex-1 min-w-0">
              <span className="block truncate">
                {profile.owner_name || profile.owner_email || (lang === "es" ? "Usuario" : "User")}
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
            {!isViewingOwnProfile && profile.owner_id === activeProfileOwnerId && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
