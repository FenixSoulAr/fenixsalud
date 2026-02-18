import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveUserEntitlements, countUserAttachments, countUserProfiles } from "../_shared/planEntitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function: check-plan
 *
 * Returns server-validated entitlements and current usage counts for the authenticated user.
 * Used by the frontend to gate features and display usage metrics — but also gated
 * server-side in action-specific edge functions.
 *
 * Output:
 *   { planCode, planName, maxProfiles, maxAttachments, canExportPdf, canExportBackup,
 *     canShareProfiles, canUseProcedures, maxSharedGrantees, isGracePeriod,
 *     gracePeriodEndsAt?, currentAttachments, currentProfiles }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Resolve entitlements and usage in parallel
    const [entitlements, currentAttachments, currentProfiles] = await Promise.all([
      resolveUserEntitlements(user.id, supabaseUrl, supabaseServiceKey),
      countUserAttachments(user.id, adminClient),
      countUserProfiles(user.id, adminClient),
    ]);

    console.log(`[check-plan] User ${user.id}: plan=${entitlements.planCode}, files=${currentAttachments}/${entitlements.maxAttachments}, profiles=${currentProfiles}/${entitlements.maxProfiles}`);

    return new Response(
      JSON.stringify({
        ...entitlements,
        currentAttachments,
        currentProfiles,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[check-plan] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
