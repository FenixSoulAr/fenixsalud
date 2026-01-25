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

  // Standardized plan limitation messages
  const planLimitMessage = {
    en: "This action is limited by your current plan. You can upgrade to Plus to enable it.",
    es: "Esta acción está limitada por tu plan actual. Podés actualizar a Plus para habilitarla.",
  };

  // Specific limit messages (profiles and attachments have count-based limits)
  const profileLimitMessage = {
    en: "You've reached the profile limit for your plan.",
    es: "Alcanzaste el límite de perfiles permitidos por tu plan.",
  };

  const attachmentLimitMessage = {
    en: "You've reached the attachment limit for your plan.",
    es: "Alcanzaste el límite de adjuntos permitidos por tu plan.",
  };

  const messages: Record<GatedFeature, { en: string; es: string }> = {
    sharing: planLimitMessage,
    roles: planLimitMessage,
    pdf_export: planLimitMessage,
    export_backup: planLimitMessage,
    procedures: planLimitMessage,
    profiles: profileLimitMessage,
    attachments: attachmentLimitMessage,
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
    plusFeature: lang === "es" ? planLimitMessage.es : planLimitMessage.en,
    profiles: lang === "es" ? profileLimitMessage.es : profileLimitMessage.en,
    attachments: lang === "es" ? attachmentLimitMessage.es : attachmentLimitMessage.en,
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
