import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";

export function useDowngradePlan() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const lang = getLanguage();

  async function schedulePlanChange(targetPlanCode: string): Promise<boolean> {
    if (!user) return false;
    setLoading(true);
    try {
      const response = await supabase.functions.invoke("downgrade-plan", {
        body: { targetPlanCode },
      });
      if (response.error) {
        console.error("[useDowngradePlan] Error:", response.error);
        toast.error(lang === "es" ? "Ocurrió un error. Intentá nuevamente." : "An error occurred. Please try again.");
        return false;
      }
      const effectiveDate = response.data?.effectiveDate
        ? new Date(response.data.effectiveDate).toLocaleDateString(lang === "es" ? "es-AR" : "en-US")
        : "";
      toast.success(
        lang === "es"
          ? `Cambio programado. Tu plan cambiará el ${effectiveDate}.`
          : `Change scheduled. Your plan will change on ${effectiveDate}.`
      );
      return true;
    } catch (error) {
      console.error("[useDowngradePlan] Unexpected error:", error);
      toast.error(lang === "es" ? "Error inesperado." : "Unexpected error.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { schedulePlanChange, loading };
}
