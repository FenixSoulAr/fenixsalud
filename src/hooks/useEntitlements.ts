import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Entitlement values resolved from the server-side `check-plan` edge function.
 * This is the SINGLE SOURCE OF TRUTH for plan-based feature gating.
 *
 * Resolution priority (server-side):
 *   Admin/Superadmin > Plan Override (Promo) > Stripe Subscription > Free
 *
 * @see supabase/functions/check-plan/index.ts
 * @see supabase/functions/_shared/planEntitlements.ts
 */
interface EntitlementValues {
  maxProfiles: number;
  maxAttachments: number;
  canExportPdf: boolean;
  canShareProfiles: boolean;
  canUseRoles: boolean;
  canUseProcedures: boolean;
  canExportBackup: boolean;
  maxSharedGrantees: number;
}

export interface UseEntitlementsReturn extends EntitlementValues {
  /** true while the initial entitlement fetch is in progress */
  loading: boolean;
  error: string | null;
  planCode: string | null;
  planName: string | null;
  /** true if the user has any active Plus plan (stripe, promo, or admin) */
  isPlus: boolean;
  /** Alias for isPlus — preferred boolean for gating premium features */
  isPlusActive: boolean;
  isPro: boolean;
  isAdmin: boolean;
  hasPromoOverride: boolean;
  promoExpiresAt: string | null;
  /** Server-reported subscription status: active | grace | trialing | past_due | free */
  status: string;
  /** Refetch entitlements from the server (bypasses cache) */
  refetch: () => Promise<void>;
}

const FREE_DEFAULTS: EntitlementValues = {
  maxProfiles: 1,
  maxAttachments: 10,
  canExportPdf: false,
  canShareProfiles: false,
  canUseRoles: false,
  canUseProcedures: false,
  canExportBackup: false,
  maxSharedGrantees: 0,
};

// In-memory cache keyed by userId
const entitlementCache = new Map<string, {
  data: ServerEntitlementResponse;
  timestamp: number;
}>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Shape returned by the check-plan edge function */
interface ServerEntitlementResponse {
  planCode: string;
  planName: string;
  maxProfiles: number;
  maxAttachments: number;
  canExportPdf: boolean;
  canExportBackup: boolean;
  canShareProfiles: boolean;
  canUseProcedures: boolean;
  maxSharedGrantees: number;
  isGracePeriod: boolean;
  gracePeriodEndsAt?: string;
  hasPromoOverride: boolean;
  promoExpiresAt?: string | null;
  currentAttachments: number;
  currentProfiles: number;
}

/**
 * Central entitlement hook. Calls the `check-plan` edge function
 * which is the server-side source of truth.
 *
 * Usage:
 *   const { isPlusActive, canExportPdf, loading } = useEntitlements();
 */
export function useEntitlements(): UseEntitlementsReturn {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverData, setServerData] = useState<ServerEntitlementResponse | null>(null);
  const fetchingRef = useRef(false);

  const fetchEntitlements = useCallback(async (forceRefresh = false) => {
    if (!user) return;

    // Check cache first
    if (!forceRefresh) {
      const cached = entitlementCache.get(user.id);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setServerData(cached.data);
        setError(null);
        setLoading(false);
        return;
      }
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const { data, error: fnError } = await supabase.functions.invoke("check-plan");

      if (fnError) {
        console.error("[useEntitlements] check-plan error:", fnError);
        throw new Error("Failed to load entitlements");
      }

      const response = data as ServerEntitlementResponse;
      setServerData(response);
      setError(null);

      entitlementCache.set(user.id, {
        data: response,
        timestamp: Date.now(),
      });

      console.log("[useEntitlements] Resolved:", {
        planCode: response.planCode,
        planName: response.planName,
        userId: user.id,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error loading entitlements";
      console.error("[useEntitlements] Error:", err);
      setError(errorMessage);
      setServerData(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setServerData(null);
      return;
    }
    setLoading(true);
    fetchEntitlements();
  }, [fetchEntitlements, authLoading, user]);

  // Clear cache on logout
  useEffect(() => {
    if (!user) entitlementCache.clear();
  }, [user]);

  // Derive all values from server response
  const planCode = serverData?.planCode ?? "free";
  const planName = serverData?.planName ?? "Free";
  const isAdmin = planCode === "admin";
  const isPlus = planCode === "plus_monthly" || planCode === "plus_yearly" || isAdmin;
  const isPro = planCode === "pro_monthly" || planCode === "pro_yearly" || isAdmin;
  const isPlusActive = isPlus || isPro;

  // Promo override info from server
  const hasPromoOverride = serverData?.hasPromoOverride ?? false;
  const promoExpiresAt = serverData?.promoExpiresAt ?? null;

  // Derive status
  let status = "free";
  if (serverData) {
    if (serverData.isGracePeriod) {
      status = "grace";
    } else if (planCode !== "free") {
      status = "active";
    }
  }

  const entitlements: EntitlementValues = serverData
    ? {
        maxProfiles: serverData.maxProfiles,
        maxAttachments: serverData.maxAttachments,
        canExportPdf: serverData.canExportPdf,
        canShareProfiles: serverData.canShareProfiles,
        canUseRoles: serverData.canShareProfiles, // roles follow sharing entitlement
        canUseProcedures: serverData.canUseProcedures,
        canExportBackup: serverData.canExportBackup,
        maxSharedGrantees: serverData.maxSharedGrantees,
      }
    : FREE_DEFAULTS;

  return {
    loading,
    error,
    planCode,
    planName,
    isPlus,
    isPlusActive,
    isPro,
    isAdmin,
    hasPromoOverride,
    promoExpiresAt,
    status,
    ...entitlements,
    refetch: () => fetchEntitlements(true),
  };
}

export function invalidateEntitlementsCache(userId?: string) {
  if (userId) {
    entitlementCache.delete(userId);
  } else {
    entitlementCache.clear();
  }
}
