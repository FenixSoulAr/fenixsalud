import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Admin allowlist - case-insensitive email matching
const ADMIN_EMAILS = [
  "jorge.perez.ar@gmail.com",
  "leandro.perez.ar@gmail.com",
  "agustina.laterza@gmail.com",
];

function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.some(
    (adminEmail) => adminEmail.toLowerCase() === email.toLowerCase()
  );
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[ADMIN-ACTIONS] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth client to verify the calling user
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    
    // Service client for admin operations (bypasses RLS)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Verify the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      logStep("Auth failed", { error: authError?.message });
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = userData.user.email;
    logStep("User authenticated", { email: userEmail });

    // Verify admin access
    if (!isAdminEmail(userEmail)) {
      logStep("Access denied - not an admin", { email: userEmail });
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Admin verified", { email: userEmail });

    // Parse the request body
    const { action, ...params } = await req.json();
    logStep("Action requested", { action, params });

    switch (action) {
      case "check_admin": {
        // Simple check if current user is admin
        return new Response(
          JSON.stringify({ isAdmin: true, email: userEmail }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list_users": {
        // Fetch all users with their plan status using the security definer function
        const { data, error } = await serviceClient.rpc("get_admin_user_list");
        
        if (error) {
          logStep("Error fetching users", { error: error.message });
          return new Response(
            JSON.stringify({ error: "Failed to fetch users" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("Users fetched", { count: data?.length });
        return new Response(
          JSON.stringify({ users: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "grant_override": {
        const { userId, expiresInDays, notes } = params;
        
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "userId is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Calculate expiration date (null = indefinite)
        let expiresAt: string | null = null;
        if (expiresInDays && expiresInDays > 0) {
          const expDate = new Date();
          expDate.setDate(expDate.getDate() + expiresInDays);
          expiresAt = expDate.toISOString();
        }

        // Upsert the override (handles both new grants and updates)
        const { data, error } = await serviceClient
          .from("plan_overrides")
          .upsert({
            user_id: userId,
            granted_by_email: userEmail,
            expires_at: expiresAt,
            notes: notes || null,
            revoked_at: null, // Clear any previous revocation
          }, {
            onConflict: "user_id",
          })
          .select()
          .single();

        if (error) {
          logStep("Error granting override", { error: error.message });
          return new Response(
            JSON.stringify({ error: "Failed to grant override" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("Override granted", { userId, expiresAt, grantedBy: userEmail });
        return new Response(
          JSON.stringify({ success: true, override: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "revoke_override": {
        const { userId } = params;
        
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "userId is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await serviceClient
          .from("plan_overrides")
          .update({ revoked_at: new Date().toISOString() })
          .eq("user_id", userId)
          .is("revoked_at", null);

        if (error) {
          logStep("Error revoking override", { error: error.message });
          return new Response(
            JSON.stringify({ error: "Failed to revoke override" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("Override revoked", { userId, revokedBy: userEmail });
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list_promo_codes": {
        const { data, error } = await serviceClient.rpc("get_admin_promo_codes");
        
        if (error) {
          logStep("Error fetching promo codes", { error: error.message });
          return new Response(
            JSON.stringify({ error: "Failed to fetch promo codes" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("Promo codes fetched", { count: data?.length });
        return new Response(
          JSON.stringify({ promoCodes: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create_promo_code": {
        const { code, type, value, durationType, durationValue, maxRedemptions, expiresAt, stripeCouponId } = params;
        
        if (!code || !type) {
          return new Response(
            JSON.stringify({ error: "code and type are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if code already exists (case-insensitive)
        const { data: existing } = await serviceClient
          .from("discounts")
          .select("id")
          .ilike("code", code)
          .maybeSingle();

        if (existing) {
          return new Response(
            JSON.stringify({ error: "A promo code with this name already exists" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await serviceClient
          .from("discounts")
          .insert({
            code: code.toUpperCase(),
            type,
            value: type === "internal_override" ? 100 : (value || 10),
            duration_type: durationType || "once",
            duration_value: durationValue || null,
            max_redemptions: maxRedemptions || null,
            valid_to: expiresAt ? new Date(expiresAt).toISOString() : null,
            stripe_coupon_id: stripeCouponId || null,
            is_active: true,
            redeemed_count: 0,
          })
          .select()
          .single();

        if (error) {
          logStep("Error creating promo code", { error: error.message });
          return new Response(
            JSON.stringify({ error: "Failed to create promo code" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("Promo code created", { code, type, createdBy: userEmail });
        return new Response(
          JSON.stringify({ success: true, promoCode: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "deactivate_promo_code": {
        const { codeId } = params;
        
        if (!codeId) {
          return new Response(
            JSON.stringify({ error: "codeId is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await serviceClient
          .from("discounts")
          .update({ is_active: false })
          .eq("id", codeId);

        if (error) {
          logStep("Error deactivating promo code", { error: error.message });
          return new Response(
            JSON.stringify({ error: "Failed to deactivate promo code" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("Promo code deactivated", { codeId, deactivatedBy: userEmail });
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "redeem_promo_code": {
        // This action can be called by any authenticated user for themselves
        // But we're in the admin function, so this is for admin-granted redemptions
        const { userId, code } = params;
        
        if (!userId || !code) {
          return new Response(
            JSON.stringify({ error: "userId and code are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Validate the promo code
        const { data: validation, error: validationError } = await serviceClient
          .rpc("validate_promo_code", { _code: code, _user_id: userId });

        if (validationError || !validation || validation.length === 0) {
          logStep("Promo code validation failed", { error: validationError?.message });
          return new Response(
            JSON.stringify({ error: "Failed to validate promo code" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = validation[0];
        if (!result.valid) {
          return new Response(
            JSON.stringify({ error: result.error_message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Handle internal_override type - create plan_override
        let overrideId: string | null = null;
        if (result.discount_type === "internal_override") {
          // Calculate expiration based on duration
          let expiresAt: string | null = null;
          if (result.duration_type === "once") {
            // 30 days default for "once"
            const expDate = new Date();
            expDate.setDate(expDate.getDate() + 30);
            expiresAt = expDate.toISOString();
          } else if (result.duration_type === "repeating" && result.duration_value) {
            const expDate = new Date();
            expDate.setMonth(expDate.getMonth() + result.duration_value);
            expiresAt = expDate.toISOString();
          }
          // "forever" = null expires_at

          const { data: override, error: overrideError } = await serviceClient
            .from("plan_overrides")
            .upsert({
              user_id: userId,
              granted_by_email: userEmail,
              expires_at: expiresAt,
              notes: `Promo code: ${code}`,
              revoked_at: null,
            }, {
              onConflict: "user_id",
            })
            .select()
            .single();

          if (overrideError) {
            logStep("Error creating override from promo", { error: overrideError.message });
            return new Response(
              JSON.stringify({ error: "Failed to apply promo code" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          overrideId = override.id;
        }

        // Record the redemption
        const { error: redemptionError } = await serviceClient
          .from("promo_code_redemptions")
          .insert({
            discount_id: result.discount_id,
            user_id: userId,
            source: "admin_grant",
            override_id: overrideId,
          });

        if (redemptionError) {
          logStep("Error recording redemption", { error: redemptionError.message });
          // Don't fail - the override was created
        }

        // Update usage counters
        await serviceClient
          .from("discounts")
          .update({ 
            redeemed_count: (await serviceClient
              .from("promo_code_redemptions")
              .select("id", { count: "exact" })
              .eq("discount_id", result.discount_id)).count || 1,
            last_used_at: new Date().toISOString()
          })
          .eq("id", result.discount_id);

        logStep("Promo code redeemed", { code, userId, type: result.discount_type, overrideId });
        return new Response(
          JSON.stringify({ 
            success: true, 
            type: result.discount_type,
            overrideId,
            stripeCouponId: result.stripe_coupon_id
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    logStep("Unexpected error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});