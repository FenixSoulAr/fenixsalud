import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ensureSubscriptionRow } from "@/lib/subscriptions";
import { supabase as supabaseClient } from "@/integrations/supabase/client";

interface EntitlementValues {
  maxProfiles: number;
  maxAttachments: number;
  canExportPdf: boolean;
  canShareProfiles: boolean;
  canUseRoles: boolean;
  canUseProcedures: boolean;
  canExportBackup: boolean;
  maxSharedGrantees: number; // 0 = disabled, 1 = Plus, 99 = Pro (unlimited)
}

interface UseEntitlementsReturn extends EntitlementValues {
  loading: boolean;
  error: string | null;
  planCode: string | null;
  planName: string | null;
  isPlus: boolean;
  isPro: boolean;
  isAdmin: boolean;
  hasPromoOverride: boolean;
  promoExpiresAt: string | null;
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

// Admin entitlements - full access
const ADMIN_ENTITLEMENTS: EntitlementValues = {
  maxProfiles: 99,
  maxAttachments: 9999,
  canExportPdf: true,
  canShareProfiles: true,
  canUseRoles: true,
  canUseProcedures: true,
  canExportBackup: true,
  maxSharedGrantees: 99,
};

// In-memory cache
const entitlementCache = new Map<string, {
  entitlements: EntitlementValues;
  planCode: string;
  planName: string;
  isAdmin: boolean;
  hasPromoOverride: boolean;
  promoExpiresAt: string | null;
  timestamp: number;
}>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function useEntitlements(): UseEntitlementsReturn {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planCode, setPlanCode] = useState<string | null>("free");
  const [planName, setPlanName] = useState<string | null>("Free");
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasPromoOverride, setHasPromoOverride] = useState(false);
  const [promoExpiresAt, setPromoExpiresAt] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementValues>(FREE_DEFAULTS);
  const fetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const fetchEntitlements = useCallback(async (forceRefresh = false) => {
    if (!user) return;

    // Check if user is admin via server-side admin_roles table
    let userIsAdmin = false;
    try {
      const { data: roleData } = await supabaseClient.functions.invoke("get-my-role");
      userIsAdmin = roleData?.role === "admin";
    } catch {
      // If check fails, proceed as non-admin
    }
    if (userIsAdmin) {
      setIsAdmin(true);
      setPlanCode(null);
      setPlanName(null);
      setHasPromoOverride(false);
      setPromoExpiresAt(null);
      setEntitlements(ADMIN_ENTITLEMENTS);
      setError(null);
      entitlementCache.set(user.id, {
        entitlements: ADMIN_ENTITLEMENTS,
        planCode: "admin",
        planName: "Admin",
        isAdmin: true,
        hasPromoOverride: false,
        promoExpiresAt: null,
        timestamp: Date.now(),
      });
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = entitlementCache.get(user.id);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setEntitlements(cached.entitlements);
        setPlanCode(cached.planCode);
        setPlanName(cached.planName);
        setIsAdmin(cached.isAdmin);
        setHasPromoOverride(cached.hasPromoOverride);
        setPromoExpiresAt(cached.promoExpiresAt);
        setError(null);
        return;
      }
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (hasFetchedRef.current) {
      setLoading(true);
    }
    setError(null);
    setIsAdmin(false);

    try {
      // Ensure subscription row exists
      const subscriptionPromise = ensureSubscriptionRow();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Subscription check timeout")), 3000)
      );
      try {
        await Promise.race([subscriptionPromise, timeoutPromise]);
      } catch (e) {
        console.warn("Subscription row check skipped:", e);
      }

      console.log("[useEntitlements] Fetching subscription for user_id:", user.id);

      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("plan_id, status, plans(id, code, name)")
        .eq("user_id", user.id)
        .in("status", ["active", "trialing"])
        .maybeSingle();

      if (subError) {
        console.error("Error fetching subscription:", subError);
        throw new Error("Failed to load subscription");
      }

      // Check for active plan override
      let overrideExpiresAt: string | null = null;
      const { data: overrideData, error: overrideError } = await supabase
        .from("plan_overrides")
        .select("expires_at")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .maybeSingle();

      const hasActiveOverride = overrideData && (
        !overrideData.expires_at || new Date(overrideData.expires_at) > new Date()
      );

      if (hasActiveOverride && overrideData) {
        overrideExpiresAt = overrideData.expires_at;
      }

      let currentPlanId: string | null = null;
      let currentPlanCode = "free";
      let currentPlanName = "Free";
      let currentHasPromoOverride = false;
      let currentPromoExpiresAt: string | null = null;

      if (hasActiveOverride) {
        currentHasPromoOverride = true;
        currentPromoExpiresAt = overrideExpiresAt;
        const { data: plusPlan } = await supabase
          .from("plans")
          .select("id, code, name")
          .eq("code", "plus_monthly")
          .single();
        if (plusPlan) {
          currentPlanId = plusPlan.id;
          currentPlanCode = plusPlan.code;
          currentPlanName = "Plus (Promo)";
        }
      } else if (subscription?.plans) {
        const plan = subscription.plans as { id: string; code: string; name: string };
        currentPlanId = plan.id;
        currentPlanCode = plan.code;
        currentPlanName = plan.name;
      } else {
        const { data: freePlan, error: freePlanError } = await supabase
          .from("plans")
          .select("id")
          .eq("code", "free")
          .single();
        if (freePlanError) throw new Error("Failed to load plan configuration");
        if (freePlan) currentPlanId = freePlan.id;
      }

      console.log("[useEntitlements] Final plan resolution:", {
        planCode: currentPlanCode,
        planName: currentPlanName,
        hasPromoOverride: currentHasPromoOverride,
        userId: user.id,
      });

      setPlanCode(currentPlanCode);
      setPlanName(currentPlanName);
      setHasPromoOverride(currentHasPromoOverride);
      setPromoExpiresAt(currentPromoExpiresAt);

      // Get entitlements for the plan
      let resolvedEntitlements = FREE_DEFAULTS;

      if (currentPlanId) {
        const { data: entitlementRows, error: entError } = await supabase
          .from("entitlements")
          .select("key, value")
          .eq("plan_id", currentPlanId);

        if (entError) throw new Error("Failed to load entitlements");

        if (entitlementRows && entitlementRows.length > 0) {
          const entMap: Record<string, any> = {};
          entitlementRows.forEach((e) => { entMap[e.key] = e.value; });

          resolvedEntitlements = {
            maxProfiles:        entMap["profiles.max"]?.limit          ?? FREE_DEFAULTS.maxProfiles,
            maxAttachments:     entMap["attachments.max"]?.limit       ?? FREE_DEFAULTS.maxAttachments,
            canExportPdf:       entMap["pdf_export.enabled"]?.enabled  ?? FREE_DEFAULTS.canExportPdf,
            canShareProfiles:   entMap["sharing.enabled"]?.enabled     ?? FREE_DEFAULTS.canShareProfiles,
            canUseRoles:        entMap["sharing.roles"]?.enabled       ?? FREE_DEFAULTS.canUseRoles,
            canUseProcedures:   entMap["procedures.enabled"]?.enabled  ?? FREE_DEFAULTS.canUseProcedures,
            canExportBackup:    entMap["export_backup.enabled"]?.enabled ?? FREE_DEFAULTS.canExportBackup,
            maxSharedGrantees:  entMap["sharing.max_grantees"]?.limit  ?? FREE_DEFAULTS.maxSharedGrantees,
          };
        }
      }

      setEntitlements(resolvedEntitlements);

      entitlementCache.set(user.id, {
        entitlements: resolvedEntitlements,
        planCode: currentPlanCode,
        planName: currentPlanName,
        isAdmin: false,
        hasPromoOverride: currentHasPromoOverride,
        promoExpiresAt: currentPromoExpiresAt,
        timestamp: Date.now(),
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error loading entitlements";
      console.error("Error in fetchEntitlements:", err);
      setError(errorMessage);
      setEntitlements(FREE_DEFAULTS);
      setPlanCode("free");
      setPlanName("Free");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    fetchEntitlements().finally(() => { hasFetchedRef.current = true; });
  }, [fetchEntitlements, authLoading]);

  useEffect(() => {
    if (!user) entitlementCache.clear();
  }, [user]);

  const isPlus = planCode === "plus_monthly" || planCode === "plus_yearly" || isAdmin;
  const isPro = planCode === "pro_monthly" || planCode === "pro_yearly" || isAdmin;

  return {
    loading,
    error,
    planCode,
    planName,
    isPlus,
    isPro,
    isAdmin,
    hasPromoOverride,
    promoExpiresAt,
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
