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

// Exact list of tables to export (from requirements)
const TABLES_WITH_USER_ID = [
  "appointments",
  "tests",
  "diagnoses",
  "medications",
  "medication_logs",
  "reminders",
  "institutions",
  "doctors",
  "file_attachments",
  "subscriptions",
  "invoices",
  "plan_overrides",
  "referral_codes",
  "promo_code_redemptions",
];

const TABLES_WITH_OWNER_USER_ID = [
  "profiles",
  "profile_shares",
];

// Reference tables (read-only, no user filtering)
const REFERENCE_TABLES = [
  "plans",
  "entitlements",
  "discounts",
];

// Tables that need subscription-based lookup
const SUBSCRIPTION_BASED_TABLES = [
  "subscription_discounts",
];

// Tables with special handling
const REFERRALS_TABLE = "referrals";

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

    const countsByTable: Record<string, number> = {};
    const zip = new JSZip();

    // Get user's profile IDs for profile-based lookups
    const { data: userProfiles } = await adminClient
      .from("profiles")
      .select("id")
      .eq("owner_user_id", userId);
    
    const profileIds = (userProfiles || []).map((p: { id: string }) => p.id);

    // Get subscription IDs for subscription_discounts lookup
    const { data: subscriptions } = await adminClient
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId);
    const subscriptionIds = (subscriptions || []).map((s: { id: string }) => s.id);

    // Export tables with user_id
    for (const tableName of TABLES_WITH_USER_ID) {
      try {
        const { data: rows, error } = await adminClient
          .from(tableName)
          .select("*")
          .eq("user_id", userId);
        
        if (error) {
          console.warn(`[export-user-data] Error exporting ${tableName}:`, error);
          zip.file(`${tableName}.json`, JSON.stringify([], null, 2));
          countsByTable[tableName] = 0;
        } else {
          zip.file(`${tableName}.json`, JSON.stringify(rows || [], null, 2));
          countsByTable[tableName] = (rows || []).length;
          console.log(`[export-user-data] Exported ${(rows || []).length} rows from ${tableName}`);
        }
      } catch (err) {
        console.error(`[export-user-data] Exception exporting ${tableName}:`, err);
        zip.file(`${tableName}.json`, JSON.stringify([], null, 2));
        countsByTable[tableName] = 0;
      }
    }

    // Export tables with owner_user_id
    for (const tableName of TABLES_WITH_OWNER_USER_ID) {
      try {
        const { data: rows, error } = await adminClient
          .from(tableName)
          .select("*")
          .eq("owner_user_id", userId);
        
        if (error) {
          console.warn(`[export-user-data] Error exporting ${tableName}:`, error);
          zip.file(`${tableName}.json`, JSON.stringify([], null, 2));
          countsByTable[tableName] = 0;
        } else {
          zip.file(`${tableName}.json`, JSON.stringify(rows || [], null, 2));
          countsByTable[tableName] = (rows || []).length;
          console.log(`[export-user-data] Exported ${(rows || []).length} rows from ${tableName}`);
        }
      } catch (err) {
        console.error(`[export-user-data] Exception exporting ${tableName}:`, err);
        zip.file(`${tableName}.json`, JSON.stringify([], null, 2));
        countsByTable[tableName] = 0;
      }
    }

    // Export referrals (user is either referrer or referred)
    try {
      const { data: rows1 } = await adminClient
        .from(REFERRALS_TABLE)
        .select("*")
        .eq("referrer_user_id", userId);
      const { data: rows2 } = await adminClient
        .from(REFERRALS_TABLE)
        .select("*")
        .eq("referred_user_id", userId);
      
      // Dedupe by id
      const allRows = [...(rows1 || []), ...(rows2 || [])];
      const seen = new Set();
      const deduped = allRows.filter((row: { id: string }) => {
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      });
      
      zip.file(`${REFERRALS_TABLE}.json`, JSON.stringify(deduped, null, 2));
      countsByTable[REFERRALS_TABLE] = deduped.length;
      console.log(`[export-user-data] Exported ${deduped.length} rows from ${REFERRALS_TABLE}`);
    } catch (err) {
      console.error(`[export-user-data] Exception exporting ${REFERRALS_TABLE}:`, err);
      zip.file(`${REFERRALS_TABLE}.json`, JSON.stringify([], null, 2));
      countsByTable[REFERRALS_TABLE] = 0;
    }

    // Export subscription_discounts
    for (const tableName of SUBSCRIPTION_BASED_TABLES) {
      try {
        if (subscriptionIds.length > 0) {
          const { data: rows, error } = await adminClient
            .from(tableName)
            .select("*")
            .in("subscription_id", subscriptionIds);
          
          if (error) {
            console.warn(`[export-user-data] Error exporting ${tableName}:`, error);
            zip.file(`${tableName}.json`, JSON.stringify([], null, 2));
            countsByTable[tableName] = 0;
          } else {
            zip.file(`${tableName}.json`, JSON.stringify(rows || [], null, 2));
            countsByTable[tableName] = (rows || []).length;
            console.log(`[export-user-data] Exported ${(rows || []).length} rows from ${tableName}`);
          }
        } else {
          zip.file(`${tableName}.json`, JSON.stringify([], null, 2));
          countsByTable[tableName] = 0;
        }
      } catch (err) {
        console.error(`[export-user-data] Exception exporting ${tableName}:`, err);
        zip.file(`${tableName}.json`, JSON.stringify([], null, 2));
        countsByTable[tableName] = 0;
      }
    }

    // Export reference tables (all rows, no filtering)
    for (const tableName of REFERENCE_TABLES) {
      try {
        const { data: rows, error } = await adminClient.from(tableName).select("*");
        
        if (error) {
          console.warn(`[export-user-data] Error exporting ${tableName}:`, error);
          zip.file(`${tableName}.json`, JSON.stringify([], null, 2));
          countsByTable[tableName] = 0;
        } else {
          zip.file(`${tableName}.json`, JSON.stringify(rows || [], null, 2));
          countsByTable[tableName] = (rows || []).length;
          console.log(`[export-user-data] Exported ${(rows || []).length} rows from ${tableName} (reference)`);
        }
      } catch (err) {
        console.error(`[export-user-data] Exception exporting ${tableName}:`, err);
        zip.file(`${tableName}.json`, JSON.stringify([], null, 2));
        countsByTable[tableName] = 0;
      }
    }

    // Download and add attachments from health-files bucket
    const { data: attachments } = await adminClient
      .from("file_attachments")
      .select("id, file_url, file_name, entity_type, entity_id")
      .eq("user_id", userId);

    const attachmentsFolder = zip.folder("attachments");
    let attachmentCount = 0;

    if (attachments?.length) {
      for (const attachment of attachments) {
        try {
          // Extract path from file_url (format: .../health-files/path/to/file)
          const urlParts = attachment.file_url.split("/");
          const bucketIndex = urlParts.findIndex((p: string) => p === "health-files");
          if (bucketIndex === -1) {
            console.warn(`[export-user-data] Could not find health-files in URL: ${attachment.file_url}`);
            continue;
          }
          
          const filePath = urlParts.slice(bucketIndex + 1).join("/");
          
          const { data: fileData, error: downloadError } = await adminClient.storage
            .from("health-files")
            .download(filePath);
          
          if (downloadError || !fileData) {
            console.warn(`[export-user-data] Failed to download: ${filePath}`, downloadError);
            continue;
          }

          const arrayBuffer = await fileData.arrayBuffer();
          // Use safe filename with entity context
          const safeFileName = `${attachment.entity_type}_${attachment.entity_id}_${attachment.file_name}`;
          attachmentsFolder?.file(safeFileName, arrayBuffer);
          attachmentCount++;
          console.log(`[export-user-data] Added attachment: ${safeFileName}`);
        } catch (err) {
          console.error(`[export-user-data] Error processing attachment:`, err);
        }
      }
    }

    // Create manifest.json
    const exportDate = new Date().toISOString();
    const manifest = {
      exportDate,
      userId,
      version: "1.0",
      tables: Object.keys(countsByTable).sort(),
      countsByTable,
      totalRecords: Object.values(countsByTable).reduce((sum, count) => sum + count, 0),
      attachments: {
        count: attachmentCount,
        bucket: "health-files",
      },
      ownershipRules: {
        userIdTables: TABLES_WITH_USER_ID,
        ownerUserIdTables: TABLES_WITH_OWNER_USER_ID,
        referenceTables: REFERENCE_TABLES,
        subscriptionBasedTables: SUBSCRIPTION_BASED_TABLES,
        referralsTable: "referrer_user_id OR referred_user_id = user",
      },
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    // Create README.txt
    const readme = `My Health Hub - Data Export
============================
Export Date: ${exportDate}
User ID: ${userId}

Tables Included:
${Object.entries(countsByTable)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([table, count]) => `  - ${table}: ${count} records`)
  .join("\n")}

Total Records: ${manifest.totalRecords}
Attachments: ${attachmentCount} files

Ownership Rules Applied:
  - profiles, profile_shares: owner_user_id = user_id
  - appointments, tests, diagnoses, medications, etc.: user_id = user_id
  - referrals: referrer_user_id OR referred_user_id = user_id
  - subscription_discounts: via subscription_id lookup
  - plans, entitlements, discounts: reference data (all records)

Attachments:
  Files are stored in the /attachments/ folder with naming format:
  {entity_type}_{entity_id}_{original_filename}

This export complies with GDPR data portability requirements.
`;
    zip.file("README.txt", readme);

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
        totalRecords: manifest.totalRecords,
        attachmentCount,
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
