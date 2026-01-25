import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[REDEEM-PROMO] ${step}`, details ? JSON.stringify(details) : "");
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
    
    // Service client for operations (bypasses RLS)
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

    const userId = userData.user.id;
    const userEmail = userData.user.email;
    logStep("User authenticated", { userId, email: userEmail });

    // Parse the request body
    const { code } = await req.json();
    
    if (!code || typeof code !== "string") {
      return new Response(
        JSON.stringify({ error: "Promo code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedCode = code.trim().toUpperCase();
    logStep("Validating promo code", { code: trimmedCode });

    // Check if user already has an active Plus subscription
    const { data: existingSubscription } = await serviceClient
      .from("subscriptions")
      .select("id, status, plans(code)")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (existingSubscription?.plans) {
      const planData = existingSubscription.plans as unknown as { code: string };
      if (planData.code === "plus_monthly" || planData.code === "plus_yearly") {
        return new Response(
          JSON.stringify({ error: "You already have an active Plus subscription" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if user already has an active override
    const { data: existingOverride } = await serviceClient
      .from("plan_overrides")
      .select("id, expires_at")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .maybeSingle();

    if (existingOverride) {
      const expiresAt = existingOverride.expires_at;
      if (!expiresAt || new Date(expiresAt) > new Date()) {
        return new Response(
          JSON.stringify({ error: "You already have an active Plus promo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate the promo code
    const { data: validation, error: validationError } = await serviceClient
      .rpc("validate_promo_code", { _code: trimmedCode, _user_id: userId });

    if (validationError || !validation || validation.length === 0) {
      logStep("Promo code validation failed", { error: validationError?.message });
      return new Response(
        JSON.stringify({ error: "Failed to validate promo code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = validation[0];
    if (!result.valid) {
      logStep("Promo code invalid", { message: result.error_message });
      return new Response(
        JSON.stringify({ error: result.error_message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow internal_override type for self-redemption
    if (result.discount_type !== "internal_override") {
      return new Response(
        JSON.stringify({ error: "This code can only be used at checkout" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Promo code validated", { 
      discountId: result.discount_id, 
      type: result.discount_type,
      durationType: result.duration_type,
      durationValue: result.duration_value
    });

    // Calculate expiration based on duration
    let expiresAt: string | null = null;
    if (result.duration_type === "days" && result.duration_value) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + result.duration_value);
      expiresAt = expDate.toISOString();
    } else if (result.duration_type === "once") {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + 30);
      expiresAt = expDate.toISOString();
    } else if (result.duration_type === "repeating" && result.duration_value) {
      const expDate = new Date();
      expDate.setMonth(expDate.getMonth() + result.duration_value);
      expiresAt = expDate.toISOString();
    }
    // "forever" = null expires_at

    // Create the plan override
    const { data: override, error: overrideError } = await serviceClient
      .from("plan_overrides")
      .upsert({
        user_id: userId,
        granted_by_email: `self:${userEmail}`,
        expires_at: expiresAt,
        notes: `Self-redeemed promo code: ${trimmedCode}`,
        revoked_at: null,
      }, {
        onConflict: "user_id",
      })
      .select()
      .single();

    if (overrideError) {
      logStep("Error creating override", { error: overrideError.message });
      return new Response(
        JSON.stringify({ error: "Failed to apply promo code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Override created", { overrideId: override.id, expiresAt });

    // Record the redemption
    const { error: redemptionError } = await serviceClient
      .from("promo_code_redemptions")
      .insert({
        discount_id: result.discount_id,
        user_id: userId,
        source: "self_redeem",
        override_id: override.id,
      });

    if (redemptionError) {
      logStep("Error recording redemption", { error: redemptionError.message });
      // Don't fail - the override was created successfully
    }

    // Update usage counters
    const { count } = await serviceClient
      .from("promo_code_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("discount_id", result.discount_id);

    await serviceClient
      .from("discounts")
      .update({ 
        redeemed_count: count || 1,
        last_used_at: new Date().toISOString()
      })
      .eq("id", result.discount_id);

    logStep("Promo code redeemed successfully", { 
      code: trimmedCode, 
      userId, 
      overrideId: override.id,
      expiresAt 
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        expiresAt,
        isForever: expiresAt === null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logStep("Unexpected error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
