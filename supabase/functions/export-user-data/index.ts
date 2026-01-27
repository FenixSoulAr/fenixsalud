import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Hono } from "https://deno.land/x/hono@v4.3.9/mod.ts";
// @ts-ignore - JSZip works in Deno
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const app = new Hono();

// Handle CORS preflight requests
app.options("/*", (c) => new Response(null, { headers: corsHeaders }));

interface TableConfig {
  ownerColumn?: string;
  additionalColumn?: string;
  needsProfileLookup?: boolean;
  readOnly?: boolean;
}

// Tables and their ownership rules
const TABLES_CONFIG: Record<string, TableConfig> = {
  // Tables with direct user_id ownership
  appointments: { ownerColumn: "user_id" },
  diagnoses: { ownerColumn: "user_id" },
  doctors: { ownerColumn: "user_id" },
  file_attachments: { ownerColumn: "user_id" },
  institutions: { ownerColumn: "user_id" },
  medication_logs: { ownerColumn: "user_id" },
  medications: { ownerColumn: "user_id" },
  procedures: { ownerColumn: "user_id" },
  reminders: { ownerColumn: "user_id" },
  tests: { ownerColumn: "user_id" },
  
  // Tables with owner_user_id
  profiles: { ownerColumn: "owner_user_id" },
  profile_shares: { ownerColumn: "owner_id" },
  
  // Tables with user_id but special handling
  subscriptions: { ownerColumn: "user_id" },
  invoices: { ownerColumn: "user_id" },
  plan_overrides: { ownerColumn: "user_id" },
  referral_codes: { ownerColumn: "user_id" },
  
  // Tables where user is referrer or referred
  referrals: { ownerColumn: "referrer_user_id", additionalColumn: "referred_user_id" },
  
  // Tables that need profile-based lookup
  promo_code_redemptions: { ownerColumn: "user_id" },
  subscription_discounts: { needsProfileLookup: true },
  
  // Read-only reference tables (export but don't delete)
  plans: { readOnly: true },
  entitlements: { readOnly: true },
  discounts: { readOnly: true },
};

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
    console.log(`[export-user-data] Starting export for user: ${userId}`);

    // Use service role for data access
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const exportData: Record<string, unknown[]> = {};
    const countsByTable: Record<string, number> = {};

    // Get user's profile IDs for profile-based lookups
    const { data: userProfiles } = await adminClient
      .from("profiles")
      .select("id")
      .eq("owner_user_id", userId);
    
    const profileIds = (userProfiles || []).map((p: { id: string }) => p.id);

    // Export each table
    for (const [tableName, config] of Object.entries(TABLES_CONFIG)) {
      try {
        let data: unknown[] = [];

        if (config.readOnly) {
          // For read-only tables, export all (these are reference data)
          const { data: rows } = await adminClient.from(tableName).select("*");
          data = rows || [];
        } else if (config.needsProfileLookup && profileIds.length > 0) {
          // For tables needing profile lookup (subscription_discounts)
          const { data: subscriptions } = await adminClient
            .from("subscriptions")
            .select("id")
            .eq("user_id", userId);
          
          if (subscriptions?.length) {
            const subIds = subscriptions.map((s: { id: string }) => s.id);
            const { data: rows } = await adminClient
              .from(tableName)
              .select("*")
              .in("subscription_id", subIds);
            data = rows || [];
          }
        } else if (config.additionalColumn) {
          // For referrals - get both where user is referrer or referred
          const { data: rows1 } = await adminClient
            .from(tableName)
            .select("*")
            .eq(config.ownerColumn!, userId);
          const { data: rows2 } = await adminClient
            .from(tableName)
            .select("*")
            .eq(config.additionalColumn, userId);
          
          // Dedupe by id
          const allRows = [...(rows1 || []), ...(rows2 || [])];
          const seen = new Set();
          data = allRows.filter((row: { id: string }) => {
            if (seen.has(row.id)) return false;
            seen.add(row.id);
            return true;
          });
        } else if (config.ownerColumn) {
          const { data: rows } = await adminClient
            .from(tableName)
            .select("*")
            .eq(config.ownerColumn, userId);
          data = rows || [];
        }

        exportData[tableName] = data;
        countsByTable[tableName] = data.length;
        console.log(`[export-user-data] Exported ${data.length} rows from ${tableName}`);
      } catch (err) {
        console.error(`[export-user-data] Error exporting ${tableName}:`, err);
        exportData[tableName] = [];
        countsByTable[tableName] = 0;
      }
    }

    // Create ZIP file
    const zip = new JSZip();
    
    // Add data.json
    zip.file("data.json", JSON.stringify(exportData, null, 2));

    // Add README.txt
    const exportDate = new Date().toISOString();
    const readme = `Mi Salud - Data Export
======================
Export Date: ${exportDate}
User ID: ${userId}

Tables Included:
${Object.entries(countsByTable)
  .map(([table, count]) => `  - ${table}: ${count} records`)
  .join("\n")}

Ownership Rules Applied:
  - profiles: owner_user_id = user_id
  - appointments, tests, medications, etc.: user_id = user_id
  - profile_shares: owner_id = user_id
  - referrals: referrer_user_id OR referred_user_id = user_id
  - plans, entitlements, discounts: reference data (read-only)

Attachments:
  Files are stored in the /attachments/ folder with their original names.

This export complies with data portability requirements.
`;
    zip.file("README.txt", readme);

    // Download and add attachments
    const attachments = exportData.file_attachments as Array<{
      id: string;
      file_url: string;
      file_name: string;
      entity_type: string;
      entity_id: string;
    }>;

    if (attachments?.length) {
      const attachmentsFolder = zip.folder("attachments");
      
      for (const attachment of attachments) {
        try {
          // Extract path from file_url (format: bucket/path/to/file)
          const urlParts = attachment.file_url.split("/");
          const bucketIndex = urlParts.findIndex((p: string) => p === "health-files");
          if (bucketIndex === -1) continue;
          
          const filePath = urlParts.slice(bucketIndex + 1).join("/");
          
          const { data: fileData, error: downloadError } = await adminClient.storage
            .from("health-files")
            .download(filePath);
          
          if (downloadError || !fileData) {
            console.error(`[export-user-data] Failed to download: ${filePath}`, downloadError);
            continue;
          }

          const arrayBuffer = await fileData.arrayBuffer();
          const safeFileName = `${attachment.entity_type}_${attachment.entity_id}_${attachment.file_name}`;
          attachmentsFolder?.file(safeFileName, arrayBuffer);
          console.log(`[export-user-data] Added attachment: ${safeFileName}`);
        } catch (err) {
          console.error(`[export-user-data] Error processing attachment:`, err);
        }
      }
    }

    // Generate ZIP
    const zipContent = await zip.generateAsync({ type: "uint8array" });
    console.log(`[export-user-data] ZIP generated, size: ${zipContent.length} bytes`);

    // Upload to exports bucket
    const dateStr = new Date().toISOString().split("T")[0];
    const exportPath = `${userId}/export_${dateStr}.zip`;

    const { error: uploadError } = await adminClient.storage
      .from("exports")
      .upload(exportPath, zipContent, {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadError) {
      console.error("[export-user-data] Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload export" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get signed URL (24 hours)
    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from("exports")
      .createSignedUrl(exportPath, 60 * 60 * 24);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("[export-user-data] Signed URL error:", signedUrlError);
      return new Response(JSON.stringify({ error: "Failed to create download link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    console.log(`[export-user-data] Export complete for user: ${userId}`);

    return new Response(
      JSON.stringify({
        signedUrl: signedUrlData.signedUrl,
        filePath: exportPath,
        expiresAt,
        countsByTable,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[export-user-data] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Export failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

Deno.serve(app.fetch);
