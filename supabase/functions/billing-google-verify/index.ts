import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Edge Function: billing-google-verify
 *
 * Verifies a Google Play subscription purchase and provisions
 * the corresponding plan in the database.
 *
 * Input (POST JSON):
 *   { purchaseToken: string, productId: string }
 *
 * Flow:
 *   1. Validate auth + input
 *   2. Get Google OAuth2 access token from service account
 *   3. Call Google Play Developer API to verify the purchase
 *   4. Upsert subscription record in the database
 *   5. Return { verified: true }
 */

const PACKAGE_NAME = "com.fenixsoular.myhealthhub";

/** Map Google Play product IDs to plan codes in our plans table */
const PRODUCT_TO_PLAN_CODE: Record<string, string> = {
  plus_mensual: "plus_monthly",
  plus_anual: "plus_yearly",
  pro_mensual: "pro_monthly",
  pro_anual: "pro_yearly",
};

// ─── Google OAuth2 via Service Account JWT ───

async function getGoogleAccessToken(
  serviceAccountKey: Record<string, string>
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountKey.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const unsignedToken = `${enc(header)}.${enc(payload)}`;

  // Import RSA private key
  const pemBody = serviceAccountKey.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${sig}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google OAuth token exchange failed: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// ─── Google Play Developer API ───

interface SubscriptionPurchaseV2 {
  kind: string;
  subscriptionState:
    | "SUBSCRIPTION_STATE_PENDING"
    | "SUBSCRIPTION_STATE_ACTIVE"
    | "SUBSCRIPTION_STATE_PAUSED"
    | "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"
    | "SUBSCRIPTION_STATE_ON_HOLD"
    | "SUBSCRIPTION_STATE_CANCELED"
    | "SUBSCRIPTION_STATE_EXPIRED"
    | "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED";
  latestOrderId?: string;
  lineItems?: Array<{
    productId: string;
    expiryTime?: string;
  }>;
  startTime?: string;
  expiryTime?: string;
}

async function verifyWithGooglePlay(
  purchaseToken: string,
  accessToken: string
): Promise<SubscriptionPurchaseV2> {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${purchaseToken}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Google Play API error (${res.status}): ${errText}`
    );
  }

  return await res.json();
}

// ─── Main Handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Auth
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

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse input
    const body = await req.json();
    const { purchaseToken, productId } = body;

    if (!purchaseToken || !productId) {
      return new Response(
        JSON.stringify({
          error: "Missing purchaseToken or productId",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const planCode = PRODUCT_TO_PLAN_CODE[productId];
    if (!planCode) {
      return new Response(
        JSON.stringify({ error: `Unknown productId: ${productId}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Get Google service account key
    const serviceAccountKeyRaw = Deno.env.get(
      "GOOGLE_PLAY_SERVICE_ACCOUNT_KEY"
    );
    if (!serviceAccountKeyRaw) {
      console.error(
        "[billing-google-verify] GOOGLE_PLAY_SERVICE_ACCOUNT_KEY not configured"
      );
      return new Response(
        JSON.stringify({
          error: "Google Play verification not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const serviceAccountKey = JSON.parse(serviceAccountKeyRaw);

    // 4. Get Google access token & verify purchase
    const accessToken = await getGoogleAccessToken(serviceAccountKey);
    const purchase = await verifyWithGooglePlay(purchaseToken, accessToken);

    console.log(
      `[billing-google-verify] User=${user.id} Product=${productId} State=${purchase.subscriptionState}`
    );

    // 5. Check subscription state
    const activeStates = [
      "SUBSCRIPTION_STATE_ACTIVE",
      "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    ];

    if (!activeStates.includes(purchase.subscriptionState)) {
      return new Response(
        JSON.stringify({
          verified: false,
          reason: `Subscription state: ${purchase.subscriptionState}`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 6. Upsert subscription in the database
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Look up the plan ID
    const { data: plan } = await adminClient
      .from("plans")
      .select("id")
      .eq("code", planCode)
      .single();

    if (!plan) {
      return new Response(
        JSON.stringify({ error: `Plan not found: ${planCode}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determine period from the purchase
    const lineItem = purchase.lineItems?.[0];
    const expiryTime = lineItem?.expiryTime ?? purchase.expiryTime;
    const startTime = purchase.startTime ?? new Date().toISOString();

    // Upsert: one subscription per user for google_play provider
    const { error: upsertError } = await adminClient
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan_id: plan.id,
          provider: "google_play",
          status:
            purchase.subscriptionState === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"
              ? "past_due"
              : "active",
          stripe_subscription_id: purchaseToken, // reuse column for the token
          current_period_start: startTime,
          current_period_end: expiryTime ?? null,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error(
        "[billing-google-verify] Upsert error:",
        upsertError
      );
      throw upsertError;
    }

    console.log(
      `[billing-google-verify] Subscription provisioned for user ${user.id} → ${planCode}`
    );

    return new Response(
      JSON.stringify({ verified: true, planCode }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[billing-google-verify] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
