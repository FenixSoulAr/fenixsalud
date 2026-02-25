import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export interface PlanEntitlements {
  planCode: string;
  planName: string;
  maxProfiles: number;
  maxAttachments: number;
  canExportPdf: boolean;
  canExportBackup: boolean;
  canShareProfiles: boolean;
  canUseProcedures: boolean;
  maxSharedGrantees: number;
  isGracePeriod: boolean;    // payment failed but within 3-day grace
  gracePeriodEndsAt?: string;
}

const FREE_PLAN: PlanEntitlements = {
  planCode: "free",
  planName: "Free",
  maxProfiles: 1,
  maxAttachments: 10,
  canExportPdf: false,
  canExportBackup: false,
  canShareProfiles: false,
  canUseProcedures: false,
  maxSharedGrantees: 0,
  isGracePeriod: false,
};

const ADMIN_PLAN: PlanEntitlements = {
  planCode: "admin",
  planName: "Admin",
  maxProfiles: 99,
  maxAttachments: 9999,
  canExportPdf: true,
  canExportBackup: true,
  canShareProfiles: true,
  canUseProcedures: true,
  maxSharedGrantees: 99,
  isGracePeriod: false,
};

/**
 * Resolves the effective entitlements for a user.
 * Priority: Admin > Plan Override > Stripe Subscription > Free
 */
export async function resolveUserEntitlements(
  userId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<PlanEntitlements> {
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Check admin role
  const { data: adminRole } = await adminClient
    .from("admin_roles")
    .select("id")
    .eq("user_id", userId)
    .in("role", ["admin", "superadmin"])
    .maybeSingle();

  if (adminRole) {
    return ADMIN_PLAN;
  }

  // 2. Check plan override (promo)
  const { data: override } = await adminClient
    .from("plan_overrides")
    .select("id, expires_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  const hasActiveOverride =
    override &&
    (!override.expires_at || new Date(override.expires_at) > new Date());

  if (hasActiveOverride) {
    // Override grants Plus entitlements
    const { data: plusPlan } = await adminClient
      .from("plans")
      .select("id")
      .eq("code", "plus_monthly")
      .single();

    if (plusPlan) {
      return await buildEntitlementsFromPlanId(plusPlan.id, "plus_monthly", "Plus (Promo)", adminClient, false);
    }
  }

  // 3. Check active/trialing Stripe subscription (including past_due for grace period)
  const { data: subscription } = await adminClient
    .from("subscriptions")
    .select("status, plan_id, updated_at, plans(id, code, name)")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle();

  if (subscription) {
    const planRaw = subscription.plans as unknown;
    const plan = (Array.isArray(planRaw) ? planRaw[0] : planRaw) as { id: string; code: string; name: string } | null;

    // Handle grace period for past_due
    if (subscription.status === "past_due") {
      const gracePeriodMs = 3 * 24 * 60 * 60 * 1000; // 3 days
      const updatedAt = new Date(subscription.updated_at).getTime();
      const gracePeriodEndsAt = new Date(updatedAt + gracePeriodMs);
      const now = new Date();

      if (now < gracePeriodEndsAt) {
        // Still in grace period — give plan access
        if (plan) {
          const entitlements = await buildEntitlementsFromPlanId(
            plan.id,
            plan.code,
            `${plan.name} (Grace Period)`,
            adminClient,
            true
          );
          entitlements.gracePeriodEndsAt = gracePeriodEndsAt.toISOString();
          return entitlements;
        }
      }
      // Grace period expired — fall through to free
      return FREE_PLAN;
    }

    if (plan) {
      return await buildEntitlementsFromPlanId(plan.id, plan.code, plan.name, adminClient, false);
    }
  }

  // 4. Default: Free
  return FREE_PLAN;
}

async function buildEntitlementsFromPlanId(
  planId: string,
  planCode: string,
  planName: string,
  // deno-lint-ignore no-explicit-any
  adminClient: any,
  isGracePeriod: boolean
): Promise<PlanEntitlements> {
  const { data: entitlementRows } = await adminClient
    .from("entitlements")
    .select("key, value")
    .eq("plan_id", planId);

  if (!entitlementRows || entitlementRows.length === 0) {
    return { ...FREE_PLAN, planCode, planName, isGracePeriod };
  }

  const entMap: Record<string, any> = {};
  for (const row of entitlementRows) {
    entMap[row.key] = row.value;
  }

  return {
    planCode,
    planName,
    maxProfiles: entMap["profiles.max"]?.limit ?? FREE_PLAN.maxProfiles,
    maxAttachments: entMap["attachments.max"]?.limit ?? FREE_PLAN.maxAttachments,
    canExportPdf: entMap["pdf_export.enabled"]?.enabled ?? FREE_PLAN.canExportPdf,
    canExportBackup: entMap["export_backup.enabled"]?.enabled ?? FREE_PLAN.canExportBackup,
    canShareProfiles: entMap["sharing.enabled"]?.enabled ?? FREE_PLAN.canShareProfiles,
    canUseProcedures: entMap["procedures.enabled"]?.enabled ?? FREE_PLAN.canUseProcedures,
    maxSharedGrantees: entMap["sharing.max_grantees"]?.limit ?? FREE_PLAN.maxSharedGrantees,
    isGracePeriod,
  };
}

/**
 * Counts the total file attachments for a user across all profiles they own.
 */
export async function countUserAttachments(
  userId: string,
  // deno-lint-ignore no-explicit-any
  adminClient: any
): Promise<number> {
  const { count } = await adminClient
    .from("file_attachments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

/**
 * Counts the total profiles owned by a user.
 */
export async function countUserProfiles(
  userId: string,
  // deno-lint-ignore no-explicit-any
  adminClient: any
): Promise<number> {
  const { count } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", userId);
  return count ?? 0;
}
