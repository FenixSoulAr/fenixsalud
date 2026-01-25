import { User, UserCircle, Users, ChevronDown, Check, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSharing } from "@/contexts/SharingContext";
import { useProfileTypeLabel } from "@/hooks/useProfileTypeLabel";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { useNavigate } from "react-router-dom";
import { getLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function ActiveProfileIndicator() {
  const {
    myProfiles,
    sharedWithMe,
    activeProfileId,
    switchToProfile,
    loading,
    needsProfileSelection,
  } = useSharing();
  const { label: roleLabel } = useProfileTypeLabel();
  const { isPlus, hasPromoOverride, promoExpiresAt } = useEntitlementsContext();
  const lang = getLanguage();
  const navigate = useNavigate();

  // Plan badge configuration
  const getPlanBadgeConfig = () => {
    if (hasPromoOverride) {
      return {
        label: "Plus",
        className: "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25 cursor-pointer",
        showIcon: true,
      };
    }
    if (isPlus) {
      return {
        label: "Plus",
        className: "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25 cursor-pointer",
        showIcon: false,
      };
    }
    return {
      label: "Free",
      className: "bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted/80 cursor-pointer",
      showIcon: false,
    };
  };

  const planBadge = getPlanBadgeConfig();

  // Generate tooltip content
  const getTooltipContent = () => {
    if (hasPromoOverride && promoExpiresAt) {
      const expirationDate = new Date(promoExpiresAt);
      const formattedDate = format(expirationDate, "dd/MM/yyyy", { 
        locale: lang === "es" ? es : undefined 
      });
      return lang === "es" 
        ? `Plan Plus promocional — vence el ${formattedDate}`
        : `Promotional Plus plan — expires ${formattedDate}`;
    }
    if (hasPromoOverride) {
      return lang === "es" ? "Plan Plus promocional" : "Promotional Plus plan";
    }
    if (isPlus) {
      return lang === "es" ? "Plan Plus activo" : "Plus plan active";
    }
    return lang === "es" ? "Plan Free" : "Free plan";
  };

  const handleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigate("/settings");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-sidebar-accent/50 rounded-lg animate-pulse">
        <div className="h-4 w-4 bg-muted rounded" />
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
    );
  }

  // Find current active profile
  const activeOwnProfile = myProfiles.find(p => p.id === activeProfileId);
  const activeSharedProfile = sharedWithMe.find(s => s.profile_id === activeProfileId);
  const isOwnProfile = !!activeOwnProfile;
  const isFamilyProfile = activeOwnProfile?.user_id === null;

  // Determine display name with proper fallbacks
  const profileName = activeOwnProfile?.full_name 
    || activeSharedProfile?.profile_name 
    || activeSharedProfile?.owner_name
    || (lang === "es" ? "Perfil sin nombre" : "Unnamed Profile");

  const hasMultipleProfiles = myProfiles.length > 1 || sharedWithMe.length > 0;

  // Plan badge component with tooltip
  const PlanBadgeWithTooltip = () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          onClick={handleBadgeClick}
          className={cn(
            "text-[10px] px-1.5 py-0 h-4 font-semibold border flex items-center gap-0.5 flex-shrink-0 transition-colors",
            planBadge.className
          )}
        >
          {planBadge.showIcon && <Gift className="h-2.5 w-2.5" />}
          {planBadge.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {getTooltipContent()}
      </TooltipContent>
    </Tooltip>
  );

  // If no multiple profiles, just show static indicator
  if (!hasMultipleProfiles) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-sidebar-accent/50 rounded-lg border border-sidebar-border">
        {isFamilyProfile ? (
          <UserCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <User className="h-4 w-4 text-primary flex-shrink-0" />
        )}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs text-muted-foreground">
            {lang === "es" ? "Perfil" : "Profile"}
          </span>
          <span className="text-sm font-medium text-sidebar-foreground truncate">
            {profileName} <span className="text-muted-foreground font-normal">({roleLabel})</span>
          </span>
        </div>
        <PlanBadgeWithTooltip />
      </div>
    );
  }

  // With multiple profiles, show dropdown
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
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isOwnProfile ? (
              isFamilyProfile ? (
                <UserCircle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              ) : (
                <User className="h-4 w-4 flex-shrink-0 text-primary" />
              )
            ) : (
              <Users className="h-4 w-4 flex-shrink-0 text-primary" />
            )}
            <div className="flex flex-col items-start min-w-0 flex-1">
              <span className="text-xs text-muted-foreground">
                {lang === "es" ? "Perfil" : "Profile"}
              </span>
              <span className="text-sm font-medium truncate">
                {profileName} <span className="text-muted-foreground font-normal">({roleLabel})</span>
              </span>
            </div>
          </div>
          <PlanBadgeWithTooltip />
          <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 bg-popover border border-border shadow-lg z-50">
        {/* My profiles section */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {lang === "es" ? "Mis Perfiles" : "My Profiles"}
        </DropdownMenuLabel>
        
        {myProfiles.map((profile) => {
          const isSelected = profile.id === activeProfileId;
          const isFamily = profile.user_id === null;
          const displayName = profile.full_name || (profile.is_primary 
            ? (lang === "es" ? "Mi Salud" : "My Health")
            : (lang === "es" ? "Sin nombre" : "Unnamed"));
          
          // Compute the sub-label for each profile in the list
          const profileSubLabel = isFamily
            ? (lang === "es" ? "Familiar" : "Family")
            : (lang === "es" ? "Principal" : "Primary");
          
          return (
            <DropdownMenuItem
              key={profile.id}
              onClick={() => switchToProfile(profile.id)}
              className="flex items-center gap-2 cursor-pointer py-3"
            >
              {isFamily ? (
                <UserCircle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              ) : (
                <User className="h-4 w-4 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="block truncate font-medium">
                  {displayName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {profileSubLabel}
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

        {/* Shared profiles */}
        {sharedWithMe.map((share) => {
          const isSelected = share.profile_id === activeProfileId;
          const displayName = share.profile_name || share.owner_name || 
            `User ${share.owner_id.slice(0, 8)}...`;
          const sharedRoleLabel = share.role === "viewer"
            ? lang === "es" ? "Solo lectura" : "Viewer"
            : lang === "es" ? "Colaborador" : "Contributor";
          
          return (
            <DropdownMenuItem
              key={share.profile_id}
              onClick={() => switchToProfile(share.profile_id)}
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
