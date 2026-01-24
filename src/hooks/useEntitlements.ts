import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface EntitlementValues {
  maxProfiles: number;
  maxAttachments: number;
  canShare: boolean;
  canUseRoles: boolean;
  canExportPdf: boolean;
  canExportBackup: boolean;
  canUseProcedures: boolean;
}

interface UseEntitlementsReturn extends EntitlementValues {
  loading: boolean;
  planCode: string | null;
  planName: string | null;
  isPlusPlan: boolean;
  refetch: () => Promise<void>;
}

const FREE_DEFAULTS: EntitlementValues = {
  maxProfiles: 1,
  maxAttachments: 9,
  canShare: false,
  canUseRoles: false,
  canExportPdf: false,
  canExportBackup: false,
  canUseProcedures: false,
};

export function useEntitlements(): UseEntitlementsReturn {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementValues>(FREE_DEFAULTS);

  const fetchEntitlements = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setEntitlements(FREE_DEFAULTS);
      setPlanCode(null);
      setPlanName(null);
      return;
    }

    setLoading(true);

    try {
      // Get user's subscription and plan
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("plan_id, status, plans(id, code, name)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (subError) {
        console.error("Error fetching subscription:", subError);
      }

      // If no active subscription, use free plan
      let currentPlanId: string | null = null;
      let currentPlanCode = "free";
      let currentPlanName = "Free";

      if (subscription?.plans) {
        const plan = subscription.plans as { id: string; code: string; name: string };
        currentPlanId = plan.id;
        currentPlanCode = plan.code;
        currentPlanName = plan.name;
      } else {
        // Get free plan ID
        const { data: freePlan } = await supabase
          .from("plans")
          .select("id")
          .eq("code", "free")
          .single();
        
        if (freePlan) {
          currentPlanId = freePlan.id;
        }
      }

      setPlanCode(currentPlanCode);
      setPlanName(currentPlanName);

      // Get entitlements for the plan
      if (currentPlanId) {
        const { data: entitlementRows, error: entError } = await supabase
          .from("entitlements")
          .select("key, value")
          .eq("plan_id", currentPlanId);

        if (entError) {
          console.error("Error fetching entitlements:", entError);
        }

        if (entitlementRows && entitlementRows.length > 0) {
          const entMap: Record<string, any> = {};
          entitlementRows.forEach((e) => {
            entMap[e.key] = e.value;
          });

          setEntitlements({
            maxProfiles: entMap["profiles.max"]?.limit ?? FREE_DEFAULTS.maxProfiles,
            maxAttachments: entMap["attachments.max"]?.limit ?? FREE_DEFAULTS.maxAttachments,
            canShare: entMap["sharing.enabled"]?.enabled ?? FREE_DEFAULTS.canShare,
            canUseRoles: entMap["sharing.roles"]?.enabled ?? FREE_DEFAULTS.canUseRoles,
            canExportPdf: entMap["pdf_export.enabled"]?.enabled ?? FREE_DEFAULTS.canExportPdf,
            canExportBackup: entMap["export_backup.enabled"]?.enabled ?? FREE_DEFAULTS.canExportBackup,
            canUseProcedures: entMap["procedures.enabled"]?.enabled ?? FREE_DEFAULTS.canUseProcedures,
          });
        } else {
          setEntitlements(FREE_DEFAULTS);
        }
      } else {
        setEntitlements(FREE_DEFAULTS);
      }
    } catch (error) {
      console.error("Error in fetchEntitlements:", error);
      setEntitlements(FREE_DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  const isPlusPlan = planCode === "plus_monthly" || planCode === "plus_yearly";

  return {
    loading,
    planCode,
    planName,
    isPlusPlan,
    ...entitlements,
    refetch: fetchEntitlements,
  };
}
