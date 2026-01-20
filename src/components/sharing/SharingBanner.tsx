import { useSharing } from "@/contexts/SharingContext";
import { Eye, Edit2 } from "lucide-react";
import { getLanguage } from "@/i18n";

export function SharingBanner() {
  const { currentRole, isViewingOwnProfile } = useSharing();
  const lang = getLanguage();

  if (isViewingOwnProfile || currentRole === "owner") {
    return null;
  }

  if (currentRole === "viewer") {
    return (
      <div className="bg-secondary border border-border rounded-lg p-4 mb-6 flex items-center gap-3">
        <Eye className="h-5 w-5 text-primary flex-shrink-0" />
        <p className="text-sm text-foreground">
          {lang === "es"
            ? "Estás viendo este perfil como persona de confianza. La edición está deshabilitada."
            : "You are viewing this profile as a trusted person. Editing is disabled."}
        </p>
      </div>
    );
  }

  if (currentRole === "contributor") {
    return (
      <div className="bg-accent border border-border rounded-lg p-4 mb-6 flex items-center gap-3">
        <Edit2 className="h-5 w-5 text-accent-foreground flex-shrink-0" />
        <p className="text-sm text-foreground">
          {lang === "es"
            ? "Estás ayudando a gestionar este perfil de salud."
            : "You are helping manage this health profile."}
        </p>
      </div>
    );
  }

  return null;
}
