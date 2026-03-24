import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function: handle-google-play-billing
 *
 * Receives Google Play Real-time Developer Notifications (RTDN)
 * via Cloud Pub/Sub push subscription and updates the subscriptions
 * table accordingly.
 *
 * Pub/Sub endpoint configured at:
 *   https://pwwadvtoabvqvnjkcvjr.supabase.co/functions/v1/handle-google-play-billing
 *
 * Always responds HTTP 200 to prevent Pub/Sub retry loops.
 */

const PACKAGE_NAME = "com.fenixsoular.myhealthhub";

// ── notificationType → status mapping ──
const NOTIFICATION_TYPE_MAP: Record<
  number,
  { status: string; cancel_at_period_end: boolean }
> = {
  1:  { status: "active",   cancel_at_period_end: false }, // RECOVERED
  2:  { status: "active",   cancel_at_period_end: false }, // RENEWED
  3:  { status: "canceled", cancel_at_period_end: true  }, // CANCELED
  4:  { status: "active",   cancel_at_period_end: false }, // PURCHASED
  5:  { status: "past_due", cancel_at_period_end: false }, // ON_HOLD
  6:  { status: "past_due", cancel_at_period_end: false }, // IN_GRACE_PERIOD
  7:  { status: "active",   cancel_at_period_end: false }, // RESTARTED
  12: { status: "canceled", cancel_at_period_end: false }, // REVOKED
  13: { status: "expired",  cancel_at_period_end: false }, // EXPIRED
};

// ── subscriptionId → plan_code mapping ──
const SUBSCRIPTION_TO_PLAN: Record<string, string> = {
  plus_mensual: "plus_monthly",
  plus_anual:   "plus_yearly",
  pro_mensual:  "pro_monthly",
  pro_anual:    "pro_yearly",
};

function ok(body?: unknown) {
  return new Response(
    JSON.stringify(body ?? { ok: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // ── 1. Extract and decode Pub/Sub message ──
    const base64Data = body?.message?.data;
    if (!base64Data) {
      console.log("[RTDN] No message.data in payload — possibly a validation ping");
      return ok();
    }

    let decoded: any;
    try {
      const jsonStr = atob(base64Data);
      decoded = JSON.parse(jsonStr);
    } catch (e) {
      console.error("[RTDN] Failed to decode base64 message.data:", e);
      return ok({ error: "decode_failed" });
    }

    console.log("[RTDN] Decoded notification:", JSON.stringify(decoded));

    // ── 2. Validate it's a subscription notification ──
    if (!decoded.subscriptionNotification) {
      // Could be testNotification, oneTimeProductNotification, etc.
      console.log("[RTDN] Not a subscriptionNotification — ignoring");
      return ok();
    }

    // Validate package name
    if (decoded.packageName && decoded.packageName !== PACKAGE_NAME) {
      console.warn("[RTDN] Unknown packageName:", decoded.packageName);
      return ok();
    }

    const { notificationType, purchaseToken, subscriptionId } =
      decoded.subscriptionNotification;

    if (!purchaseToken) {
      console.error("[RTDN] Missing purchaseToken");
      return ok({ error: "missing_purchase_token" });
    }

    // ── 3. Map notificationType → status ──
    const mapping = NOTIFICATION_TYPE_MAP[notificationType];
    if (!mapping) {
      console.warn(
        `[RTDN] Unknown notificationType: ${notificationType} — ignoring`
      );
      return ok();
    }

    // ── 4. Map subscriptionId → plan_code ──
    const planCode = SUBSCRIPTION_TO_PLAN[subscriptionId];
    if (!planCode) {
      console.warn(
        `[RTDN] Unknown subscriptionId: ${subscriptionId} — ignoring`
      );
      return ok();
    }

    console.log(
      `[RTDN] Processing: type=${notificationType} sub=${subscriptionId} → status=${mapping.status} plan=${planCode}`
    );

    // ── 5. Look up plan_id from plans table ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: plan } = await adminClient
      .from("plans")
      .select("id")
      .eq("code", planCode)
      .single();

    if (!plan) {
      console.error(`[RTDN] Plan not found for code: ${planCode}`);
      return ok({ error: "plan_not_found" });
    }

    // ── 6. Find existing subscription by purchaseToken ──
    // billing-google-verify stores purchaseToken in stripe_subscription_id
    // We also check the new provider_subscription_id column
    const { data: existingSub } = await adminClient
      .from("subscriptions")
      .select("id, user_id")
      .eq("provider", "google_play")
      .or(
        `stripe_subscription_id.eq.${purchaseToken},provider_subscription_id.eq.${purchaseToken}`
      )
      .limit(1)
      .maybeSingle();

    if (!existingSub) {
      console.warn(
        `[RTDN] No subscription found for purchaseToken — may not have been verified yet`
      );
      return ok({ error: "subscription_not_found" });
    }

    // ── 7. Update the subscription ──
    const now = new Date().toISOString();

    const { error: updateError } = await adminClient
      .from("subscriptions")
      .update({
        status: mapping.status,
        cancel_at_period_end: mapping.cancel_at_period_end,
        plan_id: plan.id,
        provider_subscription_id: purchaseToken,
        provider_product_id: subscriptionId,
        last_verified_at: now,
        updated_at: now,
      })
      .eq("id", existingSub.id);

    if (updateError) {
      console.error("[RTDN] Update error:", updateError);
      return ok({ error: "update_failed" });
    }

    console.log(
      `[RTDN] ✓ Updated subscription ${existingSub.id} for user ${existingSub.user_id}: status=${mapping.status}`
    );

    return ok({ updated: true, subscriptionId: existingSub.id });
  } catch (error) {
    console.error("[RTDN] Unexpected error:", error);
    // Always return 200 to prevent Pub/Sub retry loops
    return ok({ error: "internal_error" });
  }
});
