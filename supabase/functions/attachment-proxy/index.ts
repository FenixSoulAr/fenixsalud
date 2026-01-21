import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get attachment ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const attachmentId = pathParts[pathParts.length - 1];
    const download = url.searchParams.get("download") === "1";

    if (!attachmentId) {
      return new Response(JSON.stringify({ error: "Missing attachment ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create user client to verify auth and get user ID
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`User ${user.id} requesting attachment ${attachmentId}`);

    // Create service client for privileged operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch attachment metadata
    const { data: attachment, error: fetchError } = await serviceClient
      .from("file_attachments")
      .select("id, file_name, file_url, mime_type, user_id")
      .eq("id", attachmentId)
      .single();

    if (fetchError || !attachment) {
      console.error("Attachment fetch error:", fetchError);
      return new Response(JSON.stringify({ error: "Attachment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Attachment belongs to user_id: ${attachment.user_id}`);

    // Check access permission using the can_access_profile function
    const { data: canAccess, error: accessError } = await serviceClient.rpc(
      "can_access_profile",
      { _user_id: user.id, _profile_owner_id: attachment.user_id }
    );

    if (accessError) {
      console.error("Access check error:", accessError);
      return new Response(JSON.stringify({ error: "Permission check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!canAccess) {
      console.log(`User ${user.id} denied access to attachment owned by ${attachment.user_id}`);
      return new Response(JSON.stringify({ error: "You don't have permission to view this file" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Access granted. Fetching file from storage: ${attachment.file_url}`);

    // Fetch file from storage using service client
    const { data: fileData, error: storageError } = await serviceClient.storage
      .from("health-files")
      .download(attachment.file_url);

    if (storageError || !fileData) {
      console.error("Storage download error:", storageError);
      return new Response(JSON.stringify({ error: "Failed to fetch file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine content type
    const contentType = attachment.mime_type || "application/octet-stream";
    const fileName = attachment.file_name || "attachment";

    // Set disposition based on download flag
    const disposition = download
      ? `attachment; filename="${fileName}"`
      : `inline; filename="${fileName}"`;

    console.log(`Serving file: ${fileName}, type: ${contentType}, disposition: ${disposition}`);

    // Stream the file back to client
    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
