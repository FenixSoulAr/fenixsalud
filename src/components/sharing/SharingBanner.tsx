import { useSharing } from "@/contexts/SharingContext";
import { Eye, Edit2 } from "lucide-react";
import { getLanguage } from "@/i18n";

export function SharingBanner() {
  const { currentRole, isViewingOwnProfile, activeProfileOwnerName, loading } = useSharing();
  const lang = getLanguage();

  // Don't show banner while loading or if viewing own profile
  if (loading || isViewingOwnProfile || currentRole === "owner" || !currentRole) {
    return null;
  }

  const ownerDisplay = activeProfileOwnerName || (lang === "es" ? "este usuario" : "this user");

  if (currentRole === "viewer") {
    return (
      <div className="bg-secondary border border-border rounded-lg p-4 mb-6 flex items-center gap-3">
        <Eye className="h-5 w-5 text-primary flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-foreground">
            {lang === "es"
              ? `Estás viendo el perfil de salud de ${ownerDisplay}. La edición está deshabilitada.`
              : `You are viewing ${ownerDisplay}'s health profile. Editing is disabled.`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Role: viewer</p>
        </div>
      </div>
    );
  }

  if (currentRole === "contributor") {
    return (
      <div className="bg-accent border border-border rounded-lg p-4 mb-6 flex items-center gap-3">
        <Edit2 className="h-5 w-5 text-accent-foreground flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-foreground">
            {lang === "es"
              ? `Estás ayudando a gestionar el perfil de salud de ${ownerDisplay}. Algunas acciones están restringidas.`
              : `You are helping manage ${ownerDisplay}'s health profile. Some actions are restricted.`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Role: contributor</p>
        </div>
      </div>
    );
  }

  return null;
}
