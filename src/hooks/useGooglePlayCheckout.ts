import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { isAndroidNative } from "@/utils/platform";
import { invalidateEntitlementsCache } from "./useEntitlements";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Google Play Billing integration via cordova-plugin-purchase.
 *
 * On Android native, initializes the billing store and handles
 * subscription purchases end-to-end:
 *   1. Register products with Google Play
 *   2. User initiates purchase → Google Play dialog
 *   3. On approval → send purchaseToken to billing-google-verify edge function
 *   4. On verification → refresh entitlements
 *
 * On web/PWA this hook is inert (store never initializes).
 */

// Product IDs matching Google Play Console configuration
const PRODUCT_IDS = [
  "plus_monthly",
  "plus_yearly",
  "pro_monthly",
  "pro_yearly",
];

// Google Play License Key (Base64 RSA public key) for local receipt signature verification.
// Only used by cordova-plugin-purchase on Android native — never exposed in web UI.
const GOOGLE_PLAY_LICENSE_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw/BK/s7NZlCjlIk7TrfvJ4GWxJQz3y5IND8eCWfvXEN3lvqsEUWNzXQjLWUtxaJFBqhoqH2/GEwgaEN4dFn9egeEUnZoUvdGd/fq38PqzsyGddzM3qMgwM3LW97x03sUtlwO21tV7HTwxgOrkPnIceHRVp1/TwqgeXh89znW6KGlmLBxo6yxy2hWZMfB38/FCNSv3/Yu29Z8ilGZZgplhVOyQWq514n9oFg3CeITvbYeqoAGhsgItPLhu+jlS1hSHyErHs9KnHH49eu7+ggc7LR4FatRlBQjD4tE3+scjGPXOdEo/VsuehaI78JU0ZyA2gYLKepVNwlh1EWVlvlHXwIDAQAB";

// Access CdvPurchase from the global scope (injected by cordova-plugin-purchase)
function getStore(): any | null {
  return (window as any).CdvPurchase?.store ?? null;
}

function getCdvPurchase(): any | null {
  return (window as any).CdvPurchase ?? null;
}

export function useGooglePlayCheckout() {
  const [loading, setLoading] = useState(false);
  const lang = getLanguage();
  const storeReady = useRef(false);
  const initStarted = useRef(false);
  const { user } = useAuth();

  /** Verify a purchase token with our backend */
  const verifyGooglePurchase = useCallback(
    async (purchaseToken: string, productId: string) => {
      console.log("[GooglePlay] Verifying purchase:", { productId });
      const { data, error } = await supabase.functions.invoke(
        "billing-google-verify",
        { body: { purchaseToken, productId } }
      );

      if (error) {
        console.error("[GooglePlay] Verification error:", error);
        throw error;
      }

      if (data?.verified) {
        // Invalidate entitlements cache so the UI updates immediately
        invalidateEntitlementsCache(user?.id);
        toast.success(
          lang === "es" ? "¡Plan Plus activado!" : "Plus plan activated!"
        );
      } else {
        console.warn("[GooglePlay] Verification returned unverified:", data);
        toast.error(
          lang === "es"
            ? "No se pudo verificar la compra."
            : "Could not verify purchase."
        );
      }

      return data;
    },
    [user?.id, lang]
  );

  /** Initialize the CdvPurchase store (Android only, runs once) */
  useEffect(() => {
    if (!isAndroidNative || initStarted.current) return;
    initStarted.current = true;

    const CdvPurchase = getCdvPurchase();
    const store = getStore();

    if (!store || !CdvPurchase) {
      console.warn(
        "[GooglePlay] cordova-plugin-purchase not available — running in dev/web?"
      );
      return;
    }

    // Enable verbose logging in dev
    store.verbosity = CdvPurchase.LogLevel.DEBUG;

    // Register all subscription products
    store.register(
      PRODUCT_IDS.map((id) => ({
        id,
        type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
        platform: CdvPurchase.Platform.GOOGLE_PLAY,
      }))
    );

    // Listen for approved transactions → verify with backend
    store.when().approved(async (transaction: any) => {
      try {
        const nativePurchase = transaction.nativePurchase;
        const purchaseToken =
          nativePurchase?.purchaseToken ?? nativePurchase?.receipt;
        const productId =
          nativePurchase?.productId ??
          transaction.products?.[0]?.id ??
          "unknown";

        if (purchaseToken) {
          await verifyGooglePurchase(purchaseToken, productId);
        } else {
          console.error(
            "[GooglePlay] No purchaseToken found in transaction",
            transaction
          );
        }

        // Acknowledge the purchase so Google doesn't refund it
        transaction.finish();
      } catch (err) {
        console.error("[GooglePlay] Error processing transaction:", err);
        transaction.finish(); // still finish to avoid stuck purchases
      }
    });

    store
      .initialize([
        {
          platform: CdvPurchase.Platform.GOOGLE_PLAY,
          options: { google: { license: GOOGLE_PLAY_LICENSE_KEY } },
        },
      ])
      .then(() => {
        storeReady.current = true;
        console.log("[GooglePlay] Store initialized successfully");
      })
      .catch((err: any) => {
        console.error("[GooglePlay] Store initialization failed:", err);
      });
  }, [verifyGooglePurchase]);

  /** Start a subscription purchase */
  async function startGooglePlayPurchase(planCode: string = "plus_monthly") {
    setLoading(true);
    try {
      const CdvPurchase = getCdvPurchase();
      const store = getStore();

      // ── Mock fallback for dev/emulator without Play Store ──
      if (!store || !storeReady.current || !CdvPurchase) {
        console.warn("[GooglePlay] Store not available — mock fallback");
        toast.info(
          lang === "es"
            ? "Google Play Store no disponible en este entorno."
            : "Google Play Store not available in this environment."
        );
        return;
      }

      // ── Find the product and its offer ──
      const product = store.get(planCode, CdvPurchase.Platform.GOOGLE_PLAY);
      if (!product) {
        throw new Error(
          lang === "es"
            ? `Producto "${planCode}" no encontrado en Google Play.`
            : `Product "${planCode}" not found on Google Play.`
        );
      }

      const offer = product.getOffer();
      if (!offer) {
        throw new Error(
          lang === "es"
            ? `No hay oferta disponible para "${planCode}".`
            : `No offer available for "${planCode}".`
        );
      }

      console.log("[GooglePlay] Ordering offer for:", planCode);
      const orderResult = await store.order(offer);

      // order() returns an error object if the purchase failed/was cancelled
      if (orderResult?.isError) {
        if (orderResult.code === CdvPurchase.ErrorCode.PAYMENT_CANCELLED) {
          toast.info(
            lang === "es" ? "Compra cancelada." : "Purchase cancelled."
          );
        } else {
          throw new Error(orderResult.message ?? "Order failed");
        }
      }
    } catch (error: any) {
      console.error("[GooglePlay] Purchase error:", error);
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
