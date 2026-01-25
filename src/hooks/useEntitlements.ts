import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ensureSubscriptionRow } from "@/lib/subscriptions";

interface EntitlementValues {
  maxProfiles: number;
  maxAttachments: number;
  canExportPdf: boolean;
  canShareProfiles: boolean;
  canUseRoles: boolean;
  canUseProcedures: boolean;
  canExportBackup: boolean;
}

interface UseEntitlementsReturn extends EntitlementValues {
  loading: boolean;
  error: string | null;
  planCode: string | null;
  planName: string | null;
  isPlus: boolean;
  refetch: () => Promise<void>;
}

const FREE_DEFAULTS: EntitlementValues = {
  maxProfiles: 1,
  maxAttachments: 9,
  canExportPdf: false,
  canShareProfiles: false,
  canUseRoles: false,
  canUseProcedures: false,
  canExportBackup: false,
};

// In-memory cache for entitlements per user
const entitlementCache = new Map<string, {
  entitlements: EntitlementValues;
  planCode: string;
  planName: string;
  timestamp: number;
}>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function useEntitlements(): UseEntitlementsReturn {
  const { user, loading: authLoading } = useAuth();
  // Start with loading: false and safe defaults to prevent UI blocking
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planCode, setPlanCode] = useState<string | null>("free");
  const [planName, setPlanName] = useState<string | null>("Free");
  const [entitlements, setEntitlements] = useState<EntitlementValues>(FREE_DEFAULTS);
  const fetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const fetchEntitlements = useCallback(async (forceRefresh = false) => {
    if (!user) {
      // Keep defaults, don't block
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = entitlementCache.get(user.id);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setEntitlements(cached.entitlements);
        setPlanCode(cached.planCode);
        setPlanName(cached.planName);
        setError(null);
        return;
      }
    }

    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    // Only show loading on subsequent fetches, not initial
    if (hasFetchedRef.current) {
      setLoading(true);
    }
    setError(null);

    try {
      // Ensure subscription row exists (fire and forget with timeout)
      const subscriptionPromise = ensureSubscriptionRow();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Subscription check timeout")), 3000)
      );
      
      try {
        await Promise.race([subscriptionPromise, timeoutPromise]);
      } catch (e) {
        // Don't block on subscription row creation - continue with fetch
        console.warn("Subscription row check skipped:", e);
      }
      
      // Get user's subscription and plan
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

      // Check for active plan override using the RPC function
      const { data: hasOverride } = await supabase
        .rpc("has_active_override", { _user_id: user.id });

      // Determine current plan
      let currentPlanId: string | null = null;
      let currentPlanCode = "free";
      let currentPlanName = "Free";

      // If user has an override, treat them as Plus
      if (hasOverride) {
        // Get plus_monthly plan for entitlements (both plus plans have same entitlements)
        const { data: plusPlan } = await supabase
          .from("plans")
          .select("id, code, name")
          .eq("code", "plus_monthly")
          .single();
        
        if (plusPlan) {
          currentPlanId = plusPlan.id;
          currentPlanCode = plusPlan.code;
          currentPlanName = "Plus (Override)";
        }
      } else if (subscription?.plans) {
        const plan = subscription.plans as { id: string; code: string; name: string };
        currentPlanId = plan.id;
        currentPlanCode = plan.code;
        currentPlanName = plan.name;
      } else {
        // Get free plan ID
        const { data: freePlan, error: freePlanError } = await supabase
          .from("plans")
          .select("id")
          .eq("code", "free")
          .single();
        
        if (freePlanError) {
          console.error("Error fetching free plan:", freePlanError);
          throw new Error("Failed to load plan configuration");
        }
        
        if (freePlan) {
          currentPlanId = freePlan.id;
        }
      }

      setPlanCode(currentPlanCode);
      setPlanName(currentPlanName);

      // Get entitlements for the plan
      let resolvedEntitlements = FREE_DEFAULTS;

      if (currentPlanId) {
        const { data: entitlementRows, error: entError } = await supabase
          .from("entitlements")
          .select("key, value")
          .eq("plan_id", currentPlanId);

        if (entError) {
          console.error("Error fetching entitlements:", entError);
          throw new Error("Failed to load entitlements");
        }

        if (entitlementRows && entitlementRows.length > 0) {
          const entMap: Record<string, any> = {};
          entitlementRows.forEach((e) => {
            entMap[e.key] = e.value;
          });

          resolvedEntitlements = {
            maxProfiles: entMap["profiles.max"]?.limit ?? FREE_DEFAULTS.maxProfiles,
            maxAttachments: entMap["attachments.max"]?.limit ?? FREE_DEFAULTS.maxAttachments,
            canExportPdf: entMap["pdf_export.enabled"]?.enabled ?? FREE_DEFAULTS.canExportPdf,
            canShareProfiles: entMap["sharing.enabled"]?.enabled ?? FREE_DEFAULTS.canShareProfiles,
            canUseRoles: entMap["sharing.roles"]?.enabled ?? FREE_DEFAULTS.canUseRoles,
            canUseProcedures: entMap["procedures.enabled"]?.enabled ?? FREE_DEFAULTS.canUseProcedures,
            canExportBackup: entMap["export_backup.enabled"]?.enabled ?? FREE_DEFAULTS.canExportBackup,
          };
        }
      }

      setEntitlements(resolvedEntitlements);

      // Update cache
      entitlementCache.set(user.id, {
        entitlements: resolvedEntitlements,
        planCode: currentPlanCode,
        planName: currentPlanName,
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
    // Don't fetch while auth is still loading
    if (authLoading) return;
    
    fetchEntitlements().finally(() => {
      hasFetchedRef.current = true;
    });
  }, [fetchEntitlements, authLoading]);

  // Clear cache on sign out
  useEffect(() => {
    if (!user) {
      entitlementCache.clear();
    }
  }, [user]);

  const isPlus = planCode === "plus_monthly" || planCode === "plus_yearly";

  return {
    loading,
    error,
    planCode,
    planName,
    isPlus,
    ...entitlements,
    refetch: () => fetchEntitlements(true),
  };
}

// Utility to invalidate cache (useful after subscription changes)
export function invalidateEntitlementsCache(userId?: string) {
  if (userId) {
    entitlementCache.delete(userId);
  } else {
    entitlementCache.clear();
  }
}
