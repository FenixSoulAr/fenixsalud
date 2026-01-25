import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getLanguage } from "@/i18n";

type GatedFeature = 
  | "sharing" 
  | "roles" 
  | "pdf_export" 
  | "export_backup" 
  | "procedures" 
  | "profiles" 
  | "attachments";

export function useEntitlementGate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    canShareProfiles,
    canUseRoles,
    canExportPdf,
    canExportBackup,
    canUseProcedures,
    maxProfiles,
    maxAttachments,
    loading,
  } = useEntitlementsContext();

  const lang = getLanguage();

  // Primary message shown for gated features
  const primaryMessage = {
    en: "This feature is available in Plus",
    es: "Esta función está disponible en Plus",
  };
  
  // Secondary message explaining Free vs Plus
  const secondaryMessage = {
    en: "Free is for organizing your own health. Plus lets you share, export, and care for others.",
    es: "Free es para organizar tu propia salud. Plus te permite compartir, exportar y cuidar a otros.",
  };

  const messages: Record<GatedFeature, { en: string; es: string }> = {
    sharing: {
      en: `${primaryMessage.en}. ${secondaryMessage.en}`,
      es: `${primaryMessage.es}. ${secondaryMessage.es}`,
    },
    roles: {
      en: `${primaryMessage.en}. ${secondaryMessage.en}`,
      es: `${primaryMessage.es}. ${secondaryMessage.es}`,
    },
    pdf_export: {
      en: `${primaryMessage.en}. ${secondaryMessage.en}`,
      es: `${primaryMessage.es}. ${secondaryMessage.es}`,
    },
    export_backup: {
      en: `${primaryMessage.en}. ${secondaryMessage.en}`,
      es: `${primaryMessage.es}. ${secondaryMessage.es}`,
    },
    procedures: {
      en: `${primaryMessage.en}. ${secondaryMessage.en}`,
      es: `${primaryMessage.es}. ${secondaryMessage.es}`,
    },
    profiles: {
      en: "Free plan allows only 1 personal profile. Upgrade to Plus to manage family profiles.",
      es: "El plan Free permite solo 1 perfil personal. Actualizá a Plus para gestionar perfiles familiares.",
    },
    attachments: {
      en: `You reached the attachment limit for the Free plan. Unlimited attachments are available in Plus.`,
      es: `Alcanzaste el límite de adjuntos del plan Free. Adjuntos ilimitados disponibles en Plus.`,
    },
  };

  const checkFeature = useCallback(
    (feature: GatedFeature): boolean => {
      if (loading) return true; // Don't block while loading

      switch (feature) {
        case "sharing":
          return canShareProfiles;
        case "roles":
          return canUseRoles;
        case "pdf_export":
          return canExportPdf;
        case "export_backup":
          return canExportBackup;
        case "procedures":
          return canUseProcedures;
        default:
          return true;
      }
    },
    [loading, canShareProfiles, canUseRoles, canExportPdf, canExportBackup, canUseProcedures]
  );

  const gateFeature = useCallback(
    (feature: GatedFeature): boolean => {
      if (loading) return true; // Allow while loading

      const allowed = checkFeature(feature);
      if (!allowed) {
        const msg = lang === "es" ? messages[feature].es : messages[feature].en;
        toast.error(msg);
        navigate("/pricing");
        return false;
      }
      return true;
    },
    [loading, checkFeature, navigate, lang]
  );

  const checkProfileLimit = useCallback(async (): Promise<boolean> => {
    if (loading || !user) return true;

    // Count current profiles for this user
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (error) {
      console.error("Error checking profile count:", error);
      return true; // Allow on error
    }

    const currentCount = count || 0;
    if (currentCount >= maxProfiles) {
      const msg = lang === "es" ? messages.profiles.es : messages.profiles.en;
      toast.error(msg);
      navigate("/pricing");
      return false;
    }

    return true;
  }, [loading, user, maxProfiles, navigate, lang]);

  const checkAttachmentLimit = useCallback(async (): Promise<boolean> => {
    if (loading || !user) return true;

    // Count current attachments for this user
    const { count, error } = await supabase
      .from("file_attachments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (error) {
      console.error("Error checking attachment count:", error);
      return true; // Allow on error
    }

    const currentCount = count || 0;
    if (currentCount >= maxAttachments) {
      const msg = lang === "es" ? messages.attachments.es : messages.attachments.en;
      toast.error(msg);
      navigate("/pricing");
      return false;
    }

    return true;
  }, [loading, user, maxAttachments, navigate, lang]);

  // Exposed messages for UI display
  const gatedMessages = {
    plusFeature: {
      primary: lang === "es" ? primaryMessage.es : primaryMessage.en,
      secondary: lang === "es" ? secondaryMessage.es : secondaryMessage.en,
    },
    profiles: lang === "es" ? messages.profiles.es : messages.profiles.en,
    attachments: lang === "es" ? messages.attachments.es : messages.attachments.en,
  };

  return {
    loading,
    checkFeature,
    gateFeature,
    checkProfileLimit,
    checkAttachmentLimit,
    canShare: canShareProfiles,
    canUseRoles,
    canExportPdf,
    canExportBackup,
    canUseProcedures,
    maxProfiles,
    maxAttachments,
    gatedMessages,
  };
}
