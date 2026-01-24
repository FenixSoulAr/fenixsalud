import { supabase } from "@/integrations/supabase/client";

/**
 * Ensures the current user has a subscription row.
 * If missing, creates one with the free plan.
 * Idempotent: will not create duplicates.
 */
export async function ensureSubscriptionRow(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return; // Not logged in, nothing to do
  }

  // Check if subscription already exists
  const { data: existing, error: checkError } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (checkError) {
    console.error("Error checking subscription:", checkError);
    return;
  }

  if (existing) {
    return; // Subscription already exists
  }

  // Get free plan ID
  const { data: freePlan, error: planError } = await supabase
    .from("plans")
    .select("id")
    .eq("code", "free")
    .single();

  if (planError || !freePlan) {
    console.error("Error fetching free plan:", planError);
    return;
  }

  // Insert free subscription
  const { error: insertError } = await supabase
    .from("subscriptions")
    .insert({
      user_id: user.id,
      plan_id: freePlan.id,
      status: "active",
      provider: "stripe",
    });

  if (insertError) {
    // Ignore duplicate key errors (race condition safety)
    if (!insertError.message?.includes("duplicate")) {
      console.error("Error creating subscription:", insertError);
    }
  }
}
