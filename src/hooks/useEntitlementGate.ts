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
    canShare,
    canUseRoles,
    canExportPdf,
    canExportBackup,
    canUseProcedures,
    maxProfiles,
    maxAttachments,
    loading,
  } = useEntitlementsContext();

  const lang = getLanguage();

  const messages: Record<GatedFeature, { en: string; es: string }> = {
    sharing: {
      en: "Sharing is a Plus feature. Upgrade to share your health data with family and caregivers.",
      es: "Compartir es una función Plus. Actualizá para compartir tus datos de salud con familia y cuidadores.",
    },
    roles: {
      en: "Assigning roles is a Plus feature. Upgrade to set viewer or contributor access.",
      es: "Asignar roles es una función Plus. Actualizá para configurar acceso de lectura o colaborador.",
    },
    pdf_export: {
      en: "PDF export is a Plus feature. Upgrade to export your clinical summary.",
      es: "Exportar PDF es una función Plus. Actualizá para exportar tu resumen clínico.",
    },
    export_backup: {
      en: "Full backup export is a Plus feature. Upgrade to export all your health data.",
      es: "Exportar backup es una función Plus. Actualizá para exportar todos tus datos de salud.",
    },
    procedures: {
      en: "Procedures (surgeries, hospitalizations, vaccines) are a Plus feature. Upgrade to track your procedures.",
      es: "Procedimientos (cirugías, hospitalizaciones, vacunas) son una función Plus. Actualizá para registrar tus procedimientos.",
    },
    profiles: {
      en: `You've reached the limit of ${maxProfiles} profile(s). Upgrade to Plus for up to 10 profiles.`,
      es: `Has alcanzado el límite de ${maxProfiles} perfil(es). Actualizá a Plus para hasta 10 perfiles.`,
    },
    attachments: {
      en: `You've reached the limit of ${maxAttachments} attachments. Upgrade to Plus for unlimited attachments.`,
      es: `Has alcanzado el límite de ${maxAttachments} archivos adjuntos. Actualizá a Plus para adjuntos ilimitados.`,
    },
  };

  const checkFeature = useCallback(
    (feature: GatedFeature): boolean => {
      if (loading) return true; // Don't block while loading

      switch (feature) {
        case "sharing":
          return canShare;
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
    [loading, canShare, canUseRoles, canExportPdf, canExportBackup, canUseProcedures]
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

    // Count current profiles (profile_shares where user is owner)
    // In this app, each user has 1 profile, so we check shared profiles
    // Actually, in this app "profiles" are just the user's own profile
    // The "profiles.max" likely refers to how many people's data they can manage
    
    // For now, we interpret this as: the user's own profile = 1
    // If they want to share with others (becoming the "owner" of shared access), that's still 1 profile
    // This may need refinement based on exact product requirements
    
    // For MVP: profiles.max = 1 means they can only manage their own profile
    // profiles.max = 10 means they can invite others to access theirs (but it's still 1 profile)
    
    // Since the current model doesn't support multiple profiles per user,
    // this check always passes for profile creation
    return true;
  }, [loading, user, maxProfiles]);

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

  return {
    loading,
    checkFeature,
    gateFeature,
    checkProfileLimit,
    checkAttachmentLimit,
    canShare,
    canUseRoles,
    canExportPdf,
    canExportBackup,
    canUseProcedures,
    maxProfiles,
    maxAttachments,
  };
}
