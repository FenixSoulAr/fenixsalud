import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Hono } from "https://deno.land/x/hono@v4.3.9/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const app = new Hono();

// Handle CORS preflight requests
app.options("/*", (c) => new Response(null, { headers: corsHeaders }));

interface TableDeleteConfig {
  table: string;
  ownerColumn?: string;
  additionalColumn?: string;
  needsSubscriptionLookup?: boolean;
}

// Tables to delete and their ownership rules (ORDER MATTERS for foreign key constraints)
const TABLES_TO_DELETE: TableDeleteConfig[] = [
  // First delete dependent tables (children first)
  { table: "medication_logs", ownerColumn: "user_id" },
  { table: "file_attachments", ownerColumn: "user_id" },
  { table: "subscription_discounts", needsSubscriptionLookup: true },
  { table: "invoices", ownerColumn: "user_id" },
  { table: "promo_code_redemptions", ownerColumn: "user_id" },
  { table: "referrals", ownerColumn: "referrer_user_id", additionalColumn: "referred_user_id" },
  
  // Then delete main tables
  { table: "appointments", ownerColumn: "user_id" },
  { table: "diagnoses", ownerColumn: "user_id" },
  { table: "doctors", ownerColumn: "user_id" },
  { table: "institutions", ownerColumn: "user_id" },
  { table: "medications", ownerColumn: "user_id" },
  { table: "procedures", ownerColumn: "user_id" },
  { table: "reminders", ownerColumn: "user_id" },
  { table: "tests", ownerColumn: "user_id" },
  
  // Profile-related
  { table: "profile_shares", ownerColumn: "owner_id" },
  { table: "referral_codes", ownerColumn: "user_id" },
  
  // Subscription/billing
  { table: "plan_overrides", ownerColumn: "user_id" },
  { table: "subscriptions", ownerColumn: "user_id" },
  
  // Finally profiles (parent)
  { table: "profiles", ownerColumn: "owner_user_id" },
];

app.post("/*", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;
    console.log(`[delete-user-account] Starting deletion for user: ${userId}`);

    // Use service role for all operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Delete attachment files from storage
    console.log("[delete-user-account] Step 1: Deleting attachment files...");
    const { data: attachments } = await adminClient
      .from("file_attachments")
      .select("file_url")
      .eq("user_id", userId);

    if (attachments?.length) {
      for (const attachment of attachments) {
        try {
          const urlParts = attachment.file_url.split("/");
          const bucketIndex = urlParts.findIndex((p: string) => p === "health-files");
          if (bucketIndex === -1) continue;
          
          const filePath = urlParts.slice(bucketIndex + 1).join("/");
          const { error } = await adminClient.storage.from("health-files").remove([filePath]);
          if (error) {
            console.warn(`[delete-user-account] Failed to delete file: ${filePath}`, error);
          } else {
            console.log(`[delete-user-account] Deleted file: ${filePath}`);
          }
        } catch (err) {
          console.warn("[delete-user-account] Error deleting attachment file:", err);
        }
      }
    }

    // Step 2: Delete export ZIPs from storage
    console.log("[delete-user-account] Step 2: Deleting export files...");
    try {
      const { data: exportFiles } = await adminClient.storage
        .from("exports")
        .list(userId);
      
      if (exportFiles?.length) {
        const filesToDelete = exportFiles.map((f: { name: string }) => `${userId}/${f.name}`);
        await adminClient.storage.from("exports").remove(filesToDelete);
        console.log(`[delete-user-account] Deleted ${filesToDelete.length} export files`);
      }
    } catch (err) {
      console.warn("[delete-user-account] Error deleting exports:", err);
    }

    // Step 3: Delete DB rows in order
    console.log("[delete-user-account] Step 3: Deleting database records...");
    
    // Get subscription IDs for subscription_discounts lookup
    const { data: subscriptions } = await adminClient
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId);
    const subscriptionIds = (subscriptions || []).map((s: { id: string }) => s.id);

    for (const config of TABLES_TO_DELETE) {
      try {
        if (config.needsSubscriptionLookup && subscriptionIds.length > 0) {
          const { error } = await adminClient
            .from(config.table)
            .delete()
            .in("subscription_id", subscriptionIds);
          
          if (error) {
            console.warn(`[delete-user-account] Error deleting from ${config.table}:`, error);
          } else {
            console.log(`[delete-user-account] Deleted from ${config.table}`);
          }
        } else if (config.additionalColumn && config.ownerColumn) {
          // Delete where user is either column value (referrals)
          const { error: err1 } = await adminClient
            .from(config.table)
            .delete()
            .eq(config.ownerColumn, userId);
          
          const { error: err2 } = await adminClient
            .from(config.table)
            .delete()
            .eq(config.additionalColumn, userId);
          
          if (err1 || err2) {
            console.warn(`[delete-user-account] Error deleting from ${config.table}:`, err1 || err2);
          } else {
            console.log(`[delete-user-account] Deleted from ${config.table}`);
          }
        } else if (config.ownerColumn) {
          const { error } = await adminClient
            .from(config.table)
            .delete()
            .eq(config.ownerColumn, userId);
          
          if (error) {
            console.warn(`[delete-user-account] Error deleting from ${config.table}:`, error);
          } else {
            console.log(`[delete-user-account] Deleted from ${config.table}`);
          }
        }
      } catch (err) {
        console.error(`[delete-user-account] Exception deleting from ${config.table}:`, err);
      }
    }

    // Step 4: Delete auth user
    console.log("[delete-user-account] Step 4: Deleting auth user...");
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    
    if (deleteUserError) {
      console.error("[delete-user-account] Failed to delete auth user:", deleteUserError);
      return new Response(
        JSON.stringify({ error: "Failed to delete account. Please try again." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[delete-user-account] Successfully deleted user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[delete-user-account] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Account deletion failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

Deno.serve(app.fetch);
