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
