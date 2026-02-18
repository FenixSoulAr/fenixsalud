import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";
import { useAdmin } from "@/hooks/useAdmin";

// Stripe Price IDs for each plan × billing interval
export const STRIPE_PRICE_IDS: Record<string, string> = {
  plus_monthly: "price_1T2JaPKDVbPJQ8VfJ4G2b7tw",
  plus_yearly:  "price_1T2Jt9KDVbPJQ8VfoRLPTzpm",
  pro_monthly:  "price_1T2J4sKDVbPJQ8Vfmqoh2aG9",
  pro_yearly:   "price_1T2JuBKDVbPJQ8VfeXc0fcrE",
};

export function useStripeCheckout() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const lang = getLanguage();

  const messages = {
    notLoggedIn: lang === "es" ? "Debes iniciar sesión para continuar" : "You must be logged in to continue",
    checkoutError: lang === "es" ? "Ocurrió un error inesperado. Por favor, intentá nuevamente." : "An unexpected error occurred. Please try again.",
    redirecting: lang === "es" ? "Redirigiendo a Stripe..." : "Redirecting to Stripe...",
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

      const origin = window.location.origin;

      const response = await supabase.functions.invoke("create-checkout", {
        body: {
          planCode,
          successUrl: `${origin}/settings?upgrade=success`,
          cancelUrl: `${origin}/pricing`,
        },
      });

      if (response.error) {
        console.error("[useStripeCheckout] Error:", response.error);
        toast.error(messages.checkoutError);
        return;
      }

      const { url } = response.data;
      if (url) {
        toast.info(messages.redirecting);
        window.location.href = url;
      } else {
        toast.error(messages.checkoutError);
      }
    } catch (error) {
      console.error("[useStripeCheckout] Unexpected error:", error);
      toast.error(messages.checkoutError);
    } finally {
      setLoading(false);
    }
  }

  return { startCheckout, loading };
}
