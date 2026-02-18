import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveUserEntitlements, countUserProfiles } from "../_shared/planEntitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function: validate-profile-creation
 *
 * Validates that a user is allowed to create a new profile based on their plan.
 * Must be called BEFORE inserting a profile on the client side.
 *
 * Returns { allowed: true } or { allowed: false, reason: "profile_limit", planCode, maxProfiles, currentProfiles }
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

    const [entitlements, currentProfiles] = await Promise.all([
      resolveUserEntitlements(user.id, supabaseUrl, supabaseServiceKey),
      countUserProfiles(user.id, adminClient),
    ]);

    const allowed = currentProfiles < entitlements.maxProfiles;

    console.log(`[validate-profile-creation] User ${user.id}: plan=${entitlements.planCode}, profiles=${currentProfiles}/${entitlements.maxProfiles}, allowed=${allowed}`);

    if (!allowed) {
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: "profile_limit",
          planCode: entitlements.planCode,
          planName: entitlements.planName,
          maxProfiles: entitlements.maxProfiles,
          currentProfiles,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ allowed: true, planCode: entitlements.planCode, maxProfiles: entitlements.maxProfiles }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[validate-profile-creation] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
