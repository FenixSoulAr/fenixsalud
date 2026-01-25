import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    logStep("ERROR: Missing environment variables");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  // Service role client bypasses RLS for admin operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      logStep("ERROR: Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logStep("ERROR: Invalid signature", { error: message });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Handle supported events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(stripe, supabase, session);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(supabase, invoice);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(supabase, invoice);
        break;
      }
      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR: Webhook processing failed", { error: message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// deno-lint-ignore no-explicit-any
async function handleCheckoutCompleted(stripe: Stripe, supabase: any, session: Stripe.Checkout.Session) {
  logStep("Processing checkout.session.completed", { sessionId: session.id });

  if (session.mode !== "subscription" || !session.subscription) {
    logStep("Not a subscription checkout, skipping");
    return;
  }

  // Get user_id from client_reference_id or session metadata
  const userId = session.client_reference_id || session.metadata?.user_id;
  if (!userId) {
    logStep("ERROR: No user_id in client_reference_id or metadata");
    return;
  }

  // Get plan_code from session metadata
  const planCode = session.metadata?.plan_code;
  if (!planCode) {
    logStep("ERROR: No plan_code in session metadata");
    return;
  }

  logStep("Found user and plan from session", { userId, planCode });

  // Check if subscription already exists and is active (idempotency)
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id, status, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingSub?.stripe_subscription_id === session.subscription && existingSub?.status === "active") {
    logStep("Subscription already active, skipping (idempotent)", { 
      userId, 
      stripeSubId: session.subscription 
    });
    return;
  }

  // Find plan by code
  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, code")
    .eq("code", planCode)
    .eq("is_active", true)
    .maybeSingle();

  if (planError || !plan) {
    logStep("ERROR: Plan not found for code", { planCode, error: planError?.message });
    return;
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

  // Update or insert subscription
  const subscriptionData = {
    user_id: userId,
    plan_id: plan.id,
    status: mapStripeStatus(subscription.status),
    provider: "stripe",
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: subscription.id,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from("subscriptions")
    .upsert(subscriptionData, { onConflict: "user_id" });

  if (upsertError) {
    logStep("ERROR: Failed to upsert subscription", { error: upsertError.message });
  } else {
    logStep("Subscription created/updated", { userId, planCode: plan.code, status: subscriptionData.status });
  }
}

// deno-lint-ignore no-explicit-any
async function handleSubscriptionUpdated(supabase: any, subscription: Stripe.Subscription) {
  logStep("Processing customer.subscription.updated", { subscriptionId: subscription.id });

  const { data: existingSub, error: findError } = await supabase
    .from("subscriptions")
    .select("id, user_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (findError || !existingSub) {
    logStep("Subscription not found in database", { stripeSubId: subscription.id });
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const { data: plan } = await supabase
    .from("plans")
    .select("id")
    .eq("stripe_price_id", priceId)
    .maybeSingle();

  // deno-lint-ignore no-explicit-any
  const updateData: Record<string, any> = {
    status: mapStripeStatus(subscription.status),
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };

  if (plan) {
    updateData.plan_id = plan.id;
  }

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update(updateData)
    .eq("id", existingSub.id);

  if (updateError) {
    logStep("ERROR: Failed to update subscription", { error: updateError.message });
  } else {
    logStep("Subscription updated", { userId: existingSub.user_id, status: subscription.status });
  }
}

// deno-lint-ignore no-explicit-any
async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  logStep("Processing customer.subscription.deleted", { subscriptionId: subscription.id });

  // Find the free plan to downgrade to
  const { data: freePlan } = await supabase
    .from("plans")
    .select("id")
    .eq("code", "free")
    .maybeSingle();

  if (!freePlan) {
    logStep("ERROR: Free plan not found");
    return;
  }

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      plan_id: freePlan.id,
      stripe_subscription_id: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (updateError) {
    logStep("ERROR: Failed to cancel subscription", { error: updateError.message });
  } else {
    logStep("Subscription canceled and downgraded to free");
  }
}

// deno-lint-ignore no-explicit-any
async function handleInvoicePaymentSucceeded(supabase: any, invoice: Stripe.Invoice) {
  logStep("Processing invoice.payment_succeeded", { invoiceId: invoice.id });

  if (!invoice.subscription) return;

  // Find subscription by stripe_subscription_id
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, user_id")
    .eq("stripe_subscription_id", invoice.subscription as string)
    .maybeSingle();

  if (!sub) return;

  // Record invoice
  const { error } = await supabase.from("invoices").upsert(
    {
      stripe_invoice_id: invoice.id,
      user_id: sub.user_id,
      subscription_id: sub.id,
      status: "paid",
      amount_paid_cents: invoice.amount_paid,
      currency: invoice.currency,
      period_start: invoice.period_start
        ? new Date(invoice.period_start * 1000).toISOString()
        : null,
      period_end: invoice.period_end
        ? new Date(invoice.period_end * 1000).toISOString()
        : null,
      paid_at: new Date().toISOString(),
    },
    { onConflict: "stripe_invoice_id" }
  );

  if (error) {
    logStep("ERROR: Failed to record invoice", { error: error.message });
  } else {
    logStep("Invoice recorded", { invoiceId: invoice.id });
  }
}

// deno-lint-ignore no-explicit-any
async function handleInvoicePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  logStep("Processing invoice.payment_failed", { invoiceId: invoice.id });

  if (!invoice.subscription) return;

  // Update subscription status to past_due
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", invoice.subscription as string);

  if (error) {
    logStep("ERROR: Failed to update subscription to past_due", { error: error.message });
  } else {
    logStep("Subscription marked as past_due");
  }
}

function mapStripeStatus(stripeStatus: string): string {
  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "past_due",
    incomplete: "incomplete",
    incomplete_expired: "canceled",
    trialing: "trialing",
    paused: "paused",
  };
  return statusMap[stripeStatus] || "active";
}
