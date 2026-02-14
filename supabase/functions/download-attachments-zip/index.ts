import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore - JSZip works in Deno
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { profileId, language = "es" } = body;

    if (!profileId) {
      return new Response(JSON.stringify({ error: "profileId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify access
    const { data: canAccess } = await serviceClient.rpc("can_access_profile_by_id", {
      _profile_id: profileId,
      _user_id: user.id,
    });

    if (!canAccess) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[download-attachments-zip] Starting for profile ${profileId}, user ${user.id}`);

    // Fetch all attachments for TestStudy and Procedure entity types
    const { data: attachments, error: attError } = await serviceClient
      .from("file_attachments")
      .select("id, entity_id, entity_type, file_name, file_url, mime_type")
      .eq("profile_id", profileId)
      .in("entity_type", ["TestStudy", "Procedure"]);

    if (attError) {
      console.error("[download-attachments-zip] Error fetching attachments:", attError);
      return new Response(JSON.stringify({ error: "Failed to fetch attachments" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!attachments || attachments.length === 0) {
      return new Response(JSON.stringify({ 
        error: language === "es" ? "No hay adjuntos para descargar." : "No attachments to download." 
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch entity details for folder naming
    const testIds = [...new Set(attachments.filter(a => a.entity_type === "TestStudy").map(a => a.entity_id))];
    const procIds = [...new Set(attachments.filter(a => a.entity_type === "Procedure").map(a => a.entity_id))];

    const [testsRes, procsRes] = await Promise.all([
      testIds.length > 0
        ? serviceClient.from("tests").select("id, date, type").in("id", testIds)
        : Promise.resolve({ data: [] }),
      procIds.length > 0
        ? serviceClient.from("procedures").select("id, date, title, type").in("id", procIds)
        : Promise.resolve({ data: [] }),
    ]);

    const testsMap = new Map((testsRes.data || []).map((t: any) => [t.id, t]));
    const procsMap = new Map((procsRes.data || []).map((p: any) => [p.id, p]));

    const labels = language === "es"
      ? { tests: "Estudios", procedures: "Procedimientos", errors: "ERRORES" }
      : { tests: "Tests", procedures: "Procedures", errors: "ERRORS" };

    const zip = new JSZip();
    const adjuntosFolder = zip.folder("Adjuntos")!;
    const errorsLog: string[] = [];
    let successCount = 0;

    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ._\- ]/g, "_").trim();

    for (const attachment of attachments) {
      try {
        // Determine folder path
        let folderName: string;
        let subFolderName: string;

        if (attachment.entity_type === "TestStudy") {
          folderName = labels.tests;
          const test = testsMap.get(attachment.entity_id);
          subFolderName = test
            ? `${test.date}_${sanitize(test.type)}`
            : attachment.entity_id;
        } else {
          folderName = labels.procedures;
          const proc = procsMap.get(attachment.entity_id);
          subFolderName = proc
            ? `${proc.date}_${sanitize(proc.title)}`
            : attachment.entity_id;
        }

        // Extract storage path
        let storagePath = attachment.file_url;
        if (storagePath.startsWith("http")) {
          const match = storagePath.match(/\/storage\/v1\/object\/(?:public|authenticated)\/health-files\/(.+)/);
          if (match) storagePath = match[1];
        }

        const { data: fileData, error: dlError } = await serviceClient.storage
          .from("health-files")
          .download(storagePath);

        if (dlError || !fileData) {
          console.warn(`[download-attachments-zip] Failed to download: ${attachment.file_name}`, dlError);
          errorsLog.push(`${attachment.file_name} - Download failed: ${dlError?.message || "unknown"}`);
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const filePath = `${folderName}/${subFolderName}/${attachment.file_name}`;
        adjuntosFolder.file(filePath, arrayBuffer);
        successCount++;
        console.log(`[download-attachments-zip] Added: ${filePath}`);
      } catch (err) {
        console.error(`[download-attachments-zip] Error processing ${attachment.file_name}:`, err);
        errorsLog.push(`${attachment.file_name} - ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    // Add ERRORS.txt if there were failures
    if (errorsLog.length > 0) {
      const errContent = `${labels.errors}\n${"=".repeat(40)}\n\n${errorsLog.map((e, i) => `${i + 1}. ${e}`).join("\n")}\n`;
      adjuntosFolder.file(`${labels.errors}.txt`, errContent);
    }

    // Generate ZIP
    const zipBytes = await zip.generateAsync({ type: "uint8array" });
    console.log(`[download-attachments-zip] ZIP generated: ${zipBytes.length} bytes, ${successCount} files, ${errorsLog.length} errors`);

    // Upload to exports bucket
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const zipFileName = `attachments_${timestamp}.zip`;
    const zipPath = `${user.id}/${zipFileName}`;

    const { error: uploadError } = await serviceClient.storage
      .from("exports")
      .upload(zipPath, zipBytes, {
        contentType: "application/zip",
        upsert: false,
      });

    if (uploadError) {
      console.error("[download-attachments-zip] Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload ZIP" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signedData, error: signedError } = await serviceClient.storage
      .from("exports")
      .createSignedUrl(zipPath, 86400);

    if (signedError || !signedData?.signedUrl) {
      console.error("[download-attachments-zip] Signed URL error:", signedError);
      return new Response(JSON.stringify({ error: "Failed to generate download URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[download-attachments-zip] Complete. URL generated.`);

    return new Response(JSON.stringify({
      success: true,
      downloadUrl: signedData.signedUrl,
      fileName: zipFileName,
      totalFiles: attachments.length,
      successCount,
      errorCount: errorsLog.length,
      hasErrors: errorsLog.length > 0,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[download-attachments-zip] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
