import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";
import { useAdmin } from "@/hooks/useAdmin";

export function usePayPalCheckout() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const lang = getLanguage();

  const messages = {
    notLoggedIn: lang === "es" ? "Debés iniciar sesión para continuar" : "You must be logged in to continue",
    checkoutError: lang === "es" ? "Ocurrió un error inesperado. Por favor, intentá nuevamente." : "An unexpected error occurred. Please try again.",
    redirecting: lang === "es" ? "Redirigiendo a PayPal..." : "Redirecting to PayPal...",
    adminNoCheckout: lang === "es" ? "Los administradores tienen acceso completo sin suscripción" : "Admins have full access without subscription",
  };

  async function startCheckout(planCode: string = "plus_monthly") {
    if (!user) {
      toast.error(messages.notLoggedIn);
      navigate("/auth");
      return;
    }
    if (isAdmin) {
      toast.info(messages.adminNoCheckout);
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(messages.notLoggedIn);
        navigate("/auth");
        return;
      }
      const response = await supabase.functions.invoke("create-paypal-order", {
        body: { planCode },
      });
      if (response.error) {
        console.error("[usePayPalCheckout] Error:", response.error);
        toast.error(messages.checkoutError);
        return;
      }
      const { approvalUrl } = response.data;
      if (approvalUrl) {
        toast.info(messages.redirecting);
        window.location.href = approvalUrl;
      } else {
        toast.error(messages.checkoutError);
      }
    } catch (error) {
      console.error("[usePayPalCheckout] Unexpected error:", error);
      toast.error(messages.checkoutError);
    } finally {
      setLoading(false);
    }
  }

  return { startCheckout, loading };
}
