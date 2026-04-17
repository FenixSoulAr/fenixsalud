import { User, UserCircle, Users, Check, Gift, Settings, CreditCard, Shield, Info, Mail, LogOut, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useSharing } from "@/contexts/SharingContext";
import { useProfileTypeLabel } from "@/hooks/useProfileTypeLabel";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { getLanguage, setLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Returns the small plan dot color class */
function getPlanDotClass(isAdmin: boolean, isPro: boolean, isPlus: boolean): string {
  if (isAdmin) return "bg-destructive";
  if (isPro) return "bg-violet-500";
  if (isPlus) return "bg-primary";
  return "bg-muted-foreground/40";
}

export function NavbarProfileMenu() {
  const {
    myProfiles,
    sharedWithMe,
    activeProfileId,
    switchToProfile,
    loading,
    needsProfileSelection,
  } = useSharing();
  const { label: roleLabel, type: profileType } = useProfileTypeLabel();
  const { isPlus, isPro, hasPromoOverride } = useEntitlementsContext();
  const { isAdmin } = useAdmin();
  const { signOut } = useAuth();
  const lang = getLanguage();
  const navigate = useNavigate();

  if (loading || !activeProfileId) return null;

  const activeOwnProfile = myProfiles.find(p => p.id === activeProfileId);
  const activeSharedProfile = sharedWithMe.find(s => s.profile_id === activeProfileId);
  const isOwnProfile = !!activeOwnProfile;
  const isFamilyProfile = activeOwnProfile?.user_id === null;

  const profileName = activeOwnProfile?.full_name
    || activeSharedProfile?.profile_name
    || activeSharedProfile?.owner_name
    || (lang === "es" ? "Perfil" : "Profile");

  const hasMultipleProfiles = myProfiles.length > 1 || sharedWithMe.length > 0;

  // Plan badge config
  const getPlanLabel = () => {
    if (isAdmin) return "Admin";
    if (isPro) return hasPromoOverride ? "Pro (Promo)" : "Pro";
    if (isPlus) return hasPromoOverride ? "Plus (Promo)" : "Plus";
    return "Free";
  };

  const getPlanBadgeClassName = () => {
    if (isAdmin) return "bg-destructive/15 text-destructive border-destructive/30";
    if (isPro) return "bg-violet-500/15 text-violet-600 border-violet-500/30";
    if (isPlus) return "bg-primary/15 text-primary border-primary/30";
    return "bg-muted text-muted-foreground border-muted-foreground/20";
  };

  const dotClass = getPlanDotClass(isAdmin, isPro, isPlus);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "relative flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary font-semibold text-sm transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            needsProfileSelection && "ring-2 ring-primary animate-pulse"
          )}
          aria-label={lang === "es" ? "Menú de perfil" : "Profile menu"}
        >
          {/* Initials */}
          {isOwnProfile ? (
            isFamilyProfile
              ? <UserCircle className="h-5 w-5 text-muted-foreground" />
              : <span>{getInitials(profileName)}</span>
          ) : (
            <Users className="h-5 w-5" />
          )}
          {/* Plan dot indicator */}
          <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background", dotClass)} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 bg-popover border border-border shadow-lg z-50">
        {/* Active profile header */}
        <div className="px-3 py-3 space-y-1.5">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0",
              isOwnProfile && !isFamilyProfile
                ? "bg-primary/10 text-primary"
                : isOwnProfile && isFamilyProfile
                  ? "bg-muted text-muted-foreground"
                  : "bg-accent/20 text-accent-foreground"
            )}>
              {isOwnProfile ? (
                isFamilyProfile
                  ? <UserCircle className="h-5 w-5" />
                  : <span>{getInitials(profileName)}</span>
              ) : (
                <Users className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{profileName}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-2 py-0.5 h-5 font-semibold border flex items-center gap-1 flex-shrink-0",
                getPlanBadgeClassName()
              )}
            >
              {hasPromoOverride && !isAdmin && <Gift className="h-2.5 w-2.5" />}
              {getPlanLabel()}
            </Badge>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Profile list (only if multiple) */}
        {hasMultipleProfiles && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {lang === "es" ? "Cambiar perfil" : "Switch Profile"}
            </DropdownMenuLabel>

            {myProfiles.map((profile) => {
              const isSelected = profile.id === activeProfileId;
              const isFamily = profile.user_id === null;
              const displayName = profile.full_name || (profile.is_primary
                ? (lang === "es" ? "Mi perfil" : "My profile")
                : (lang === "es" ? "Sin nombre" : "Unnamed"));

              return (
                <DropdownMenuItem
                  key={profile.id}
                  onClick={() => switchToProfile(profile.id)}
                  className="flex items-center gap-2 cursor-pointer py-2.5"
                >
                  {isFamily
                    ? <UserCircle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    : <User className="h-4 w-4 flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium text-sm">{displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {isFamily ? (lang === "es" ? "Familiar" : "Family") : (lang === "es" ? "Principal" : "Primary")}
                    </span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                </DropdownMenuItem>
              );
            })}

            {sharedWithMe.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {lang === "es" ? "Compartidos conmigo" : "Shared with me"}
                </DropdownMenuLabel>
              </>
            )}

            {sharedWithMe.map((share) => {
              const isSelected = share.profile_id === activeProfileId;
              const displayName = share.profile_name || share.owner_name || `User ${share.owner_id.slice(0, 8)}...`;
              const sharedRoleLabel = share.role === "viewer"
                ? (lang === "es" ? "Solo lectura" : "Viewer")
                : (lang === "es" ? "Colaborador" : "Contributor");

              return (
                <DropdownMenuItem
                  key={share.profile_id}
                  onClick={() => switchToProfile(share.profile_id)}
                  className="flex items-center gap-2 cursor-pointer py-2.5"
                >
                  <Users className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium text-sm">{displayName}</span>
                    <span className="text-xs text-muted-foreground">{sharedRoleLabel}</span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />
          </>
        )}

        {/* Configuración */}
        <DropdownMenuItem onClick={() => navigate("/settings")} className="flex items-center gap-2 cursor-pointer py-2.5">
          <Settings className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{lang === "es" ? "Configuración" : "Settings"}</span>
        </DropdownMenuItem>

        {/* Ver planes */}
        <DropdownMenuItem onClick={() => navigate("/pricing")} className="flex items-center gap-2 cursor-pointer py-2.5">
          <CreditCard className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{lang === "es" ? "Ver planes" : "View plans"}</span>
        </DropdownMenuItem>

        {/* Admin — solo si isAdmin */}
        {isAdmin && (
          <DropdownMenuItem onClick={() => navigate("/admin")} className="flex items-center gap-2 cursor-pointer py-2.5">
            <Shield className="h-4 w-4 flex-shrink-0 text-destructive" />
            <span className="text-sm text-destructive font-medium">Admin</span>
          </DropdownMenuItem>
        )}

        {/* Idioma */}
        <DropdownMenuItem
          onClick={() => setLanguage(lang === "es" ? "en" : "es")}
          className="flex items-center gap-2 cursor-pointer py-2.5"
        >
          <Globe className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">
            {lang === "es" ? "Switch to English" : "Cambiar a Español"}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Acerca de */}
        <DropdownMenuItem onClick={() => navigate("/about")} className="flex items-center gap-2 cursor-pointer py-2.5">
          <Info className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{lang === "es" ? "Acerca de" : "About"}</span>
        </DropdownMenuItem>

        {/* Contactar */}
        <DropdownMenuItem onClick={() => navigate("/contact")} className="flex items-center gap-2 cursor-pointer py-2.5">
          <Mail className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{lang === "es" ? "Contactar" : "Contact"}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Cerrar sesión */}
        <DropdownMenuItem onClick={signOut} className="flex items-center gap-2 cursor-pointer py-2.5 text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm font-medium">{lang === "es" ? "Cerrar sesión" : "Sign out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
