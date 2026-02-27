import { useState } from "react";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";

/**
 * Placeholder hook for Google Play Billing integration.
 *
 * When the real integration is ready, replace the body of
 * `startGooglePlayPurchase` with the actual Capacitor billing
 * plugin call (e.g. @capawesome-team/capacitor-google-play-billing).
 */
export function useGooglePlayCheckout() {
  const [loading, setLoading] = useState(false);
  const lang = getLanguage();

  async function startGooglePlayPurchase(planCode: string = "plus_monthly") {
    setLoading(true);
    try {
      // TODO: Replace with real Google Play Billing integration
      // e.g. await GooglePlayBilling.purchaseSubscription({ productId: planCode });
      console.log("[GooglePlayCheckout] Purchase requested:", planCode);
      toast.info(
        lang === "es"
          ? "Google Play Billing aún no está integrado. Próximamente."
          : "Google Play Billing not yet integrated. Coming soon."
      );
    } catch (error) {
      console.error("[GooglePlayCheckout] Error:", error);
      toast.error(
        lang === "es"
          ? "Error al iniciar la compra. Intentá nuevamente."
          : "Failed to start purchase. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return { startGooglePlayPurchase, loading };
}
