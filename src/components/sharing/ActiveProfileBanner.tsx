import { useSharing } from "@/contexts/SharingContext";
import { useProfileTypeLabel } from "@/hooks/useProfileTypeLabel";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { User, UserCircle, Users, Gift } from "lucide-react";
import { getLanguage } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function ActiveProfileBanner() {
  const { 
    myProfiles, 
    sharedWithMe, 
    activeProfileId, 
    loading 
  } = useSharing();
  const { label: roleLabel, type: profileType } = useProfileTypeLabel();
  const { isPlus, isPro, hasPromoOverride, promoExpiresAt } = useEntitlementsContext();
  const lang = getLanguage();
  const navigate = useNavigate();

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

  // Plan badge configuration
  const getPlanBadgeConfig = () => {
    if (hasPromoOverride) {
      return {
        label: lang === "es" ? "Plus (Promo)" : "Plus (Promo)",
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

  // Generate tooltip content - standardized promo messages
  const getTooltipContent = () => {
    if (hasPromoOverride && promoExpiresAt) {
      const expirationDate = new Date(promoExpiresAt);
      const formattedDate = format(expirationDate, "dd/MM", { 
        locale: lang === "es" ? es : undefined 
      });
      const planLabel = isPro ? "Pro" : "Plus";
      return lang === "es" 
        ? `Tu acceso ${planLabel} promocional vence el ${formattedDate}.`
        : `Your promotional ${planLabel} access expires on ${formattedDate}.`;
    }
    if (hasPromoOverride) {
      const planLabel = isPro ? "Pro" : "Plus";
      return lang === "es" 
        ? `Tenés acceso ${planLabel} promocional activo.`
        : `You have active promotional ${planLabel} access.`;
    }
    if (isPlus) {
      return lang === "es" ? "Plan Plus activo" : "Plus plan active";
    }
    return lang === "es" ? "Plan Free" : "Free plan";
  };

  const handleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate("/settings");
  };

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
        isFamily ? (
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
          </div>
        ) : (
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
        )
      ) : (
        <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center">
          <Users className="h-5 w-5 text-accent-foreground" />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">
          {lang === "es" ? "Perfil activo" : "Active Profile"}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate">
            {profileName}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({roleLabel})
            </span>
          </p>
          {isFamily && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">
              {lang === "es" ? "Familiar" : "Family"}
            </Badge>
          )}
        </div>
      </div>
      
      {/* Plan Badge with Tooltip */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex-shrink-0" onClick={handleBadgeClick}>
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] px-2 py-0.5 h-5 font-semibold border flex items-center gap-1 transition-colors",
                planBadge.className
              )}
            >
              {planBadge.showIcon && <Gift className="h-3 w-3" />}
              {planBadge.label}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
