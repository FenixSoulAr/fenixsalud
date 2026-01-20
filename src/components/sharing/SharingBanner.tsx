import { useSharing } from "@/contexts/SharingContext";
import { Eye, Edit2 } from "lucide-react";
import { getLanguage } from "@/i18n";

export function SharingBanner() {
  const { currentRole, isViewingOwnProfile, activeProfileOwnerName, loading } = useSharing();
  const lang = getLanguage();

  // Don't show while loading
  if (loading) {
    return null;
  }

  // Don't show banner for owners viewing their own profile
  if (isViewingOwnProfile || currentRole === "owner") {
    return null;
  }

  // Show banner for viewer or contributor roles
  if (currentRole === "viewer" || currentRole === "contributor") {
    const ownerDisplay = activeProfileOwnerName || (lang === "es" ? "este usuario" : "this user");
    const isViewer = currentRole === "viewer";

    return (
      <div 
        className={`${isViewer ? "bg-secondary" : "bg-accent"} border border-border rounded-lg p-4 mb-6 flex items-center gap-3`}
        role="alert"
        aria-live="polite"
      >
        {isViewer ? (
          <Eye className="h-5 w-5 text-primary flex-shrink-0" />
        ) : (
          <Edit2 className="h-5 w-5 text-accent-foreground flex-shrink-0" />
        )}
        <div className="flex-1">
          <p className="text-sm text-foreground">
            {isViewer
              ? lang === "es"
                ? `Estás viendo el perfil de salud de ${ownerDisplay}. La edición está deshabilitada.`
                : `You are viewing ${ownerDisplay}'s health profile. Editing is disabled.`
              : lang === "es"
              ? `Estás ayudando a gestionar el perfil de salud de ${ownerDisplay}. Algunas acciones están restringidas.`
              : `You are helping manage ${ownerDisplay}'s health profile. Some actions are restricted.`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Role: {currentRole}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
