import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[create-checkout] Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("[create-checkout] Invalid token:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const userEmail = user.email ?? "";
    console.log("[create-checkout] Authenticated user:", userId, userEmail);

    // Parse request body
    const { planCode, successUrl, cancelUrl } = await req.json();
    console.log("[create-checkout] Request params:", { planCode, successUrl, cancelUrl });

    if (!planCode) {
      return new Response(
        JSON.stringify({ error: "planCode is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch plan from database to get stripe_price_id
    const { data: plan, error: planError } = await supabaseClient
      .from("plans")
      .select("id, stripe_price_id, code, name")
      .eq("code", planCode)
      .eq("is_active", true)
      .maybeSingle();

    if (planError) {
      console.error("[create-checkout] Error fetching plan:", planError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch plan" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!plan) {
      console.error("[create-checkout] Plan not found:", planCode);
      return new Response(
        JSON.stringify({ error: "Plan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!plan.stripe_price_id) {
      console.error("[create-checkout] Plan has no stripe_price_id:", planCode);
      return new Response(
        JSON.stringify({ error: "Plan is not configured for payments" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[create-checkout] Found plan:", plan.name, "price_id:", plan.stripe_price_id);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check if customer already exists
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    let customerId: string | undefined;
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
      console.log("[create-checkout] Found existing Stripe customer:", customerId);
    } else {
      console.log("[create-checkout] No existing customer, will create new one during checkout");
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: plan.stripe_price_id,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${req.headers.get("origin")}/settings?upgrade=success`,
      cancel_url: cancelUrl || `${req.headers.get("origin")}/pricing`,
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      client_reference_id: userId,
      metadata: {
        user_id: userId,
        plan_code: planCode,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          plan_code: planCode,
        },
      },
    });

    console.log("[create-checkout] Created checkout session:", session.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[create-checkout] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
