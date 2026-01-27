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
    const url = new URL(req.url);
    let attachmentId: string | null = null;
    let fileUrl: string | null = null;

    // Support both GET with path param and POST with body
    if (req.method === "POST") {
      try {
        const body = await req.json();
        attachmentId = body.attachmentId || null;
        fileUrl = body.fileUrl || null;
      } catch {
        // Body parsing failed, continue to check path
      }
    }
    
    // Also check URL path for attachment ID (for GET requests or fallback)
    if (!attachmentId) {
      const pathParts = url.pathname.split("/");
      const lastPart = pathParts[pathParts.length - 1];
      // Check if last part looks like a UUID
      if (lastPart && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastPart)) {
        attachmentId = lastPart;
      }
    }
    
    const download = url.searchParams.get("download") === "1";

    // Must have either attachmentId or fileUrl
    if (!attachmentId && !fileUrl) {
      console.error("Missing both attachmentId and fileUrl");
      return new Response(JSON.stringify({ error: "Missing attachment identifier" }), {
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

    console.log(`User ${user.id} requesting attachment. ID: ${attachmentId}, fileUrl: ${fileUrl}`);

    // Create service client for privileged operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    let attachment: any = null;

    // If we have an attachmentId, fetch by ID
    if (attachmentId) {
      const { data, error: fetchError } = await serviceClient
        .from("file_attachments")
        .select("id, file_name, file_url, mime_type, user_id, profile_id")
        .eq("id", attachmentId)
        .maybeSingle();

      if (fetchError) {
        console.error("Attachment fetch error by ID:", fetchError);
      }
      attachment = data;
    }

    // If no attachment found by ID and we have a fileUrl, try to find by file_url
    if (!attachment && fileUrl) {
      // Normalize the fileUrl - extract just the path if it's a full URL
      let normalizedPath = fileUrl;
      
      // Check if fileUrl is a full Supabase storage URL
      if (fileUrl.includes("/storage/v1/object/")) {
        // Extract path after bucket name
        const match = fileUrl.match(/\/storage\/v1\/object\/(?:public|authenticated)\/([^/]+)\/(.+)/);
        if (match) {
          normalizedPath = match[2]; // The path after bucket name
          console.log(`Extracted path from full URL: ${normalizedPath}`);
        }
      }
      
      // Try to find attachment by file_url (exact match first)
      const { data: byUrl, error: urlError } = await serviceClient
        .from("file_attachments")
        .select("id, file_name, file_url, mime_type, user_id, profile_id")
        .eq("file_url", normalizedPath)
        .maybeSingle();

      if (urlError) {
        console.error("Attachment fetch error by URL:", urlError);
      }
      
      if (byUrl) {
        attachment = byUrl;
        console.log(`Found attachment by file_url: ${attachment.id}`);
      } else {
        // Try original fileUrl as-is
        const { data: byOriginal } = await serviceClient
          .from("file_attachments")
          .select("id, file_name, file_url, mime_type, user_id, profile_id")
          .eq("file_url", fileUrl)
          .maybeSingle();
        
        if (byOriginal) {
          attachment = byOriginal;
          console.log(`Found attachment by original fileUrl: ${attachment.id}`);
        }
      }
    }

    if (!attachment) {
      console.error(`Attachment not found. ID: ${attachmentId}, fileUrl: ${fileUrl}`);
      return new Response(JSON.stringify({ 
        error: "Attachment not found",
        details: { attachmentId, fileUrl }
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Attachment found: ${attachment.id}, user_id: ${attachment.user_id}, profile_id: ${attachment.profile_id}`);

    // Check access permission - try profile-based access first (newer model)
    let canAccess = false;
    
    if (attachment.profile_id) {
      const { data: profileAccess, error: profileAccessError } = await serviceClient.rpc(
        "can_access_profile_by_id",
        { _profile_id: attachment.profile_id, _user_id: user.id }
      );
      
      if (profileAccessError) {
        console.error("Profile access check error:", profileAccessError);
      } else {
        canAccess = !!profileAccess;
        console.log(`Profile-based access check: ${canAccess}`);
      }
    }
    
    // Fallback to user-based access check
    if (!canAccess && attachment.user_id) {
      const { data: userAccess, error: accessError } = await serviceClient.rpc(
        "can_access_profile",
        { _user_id: user.id, _profile_owner_id: attachment.user_id }
      );

      if (accessError) {
        console.error("User access check error:", accessError);
      } else {
        canAccess = !!userAccess;
        console.log(`User-based access check: ${canAccess}`);
      }
    }

    if (!canAccess) {
      console.log(`User ${user.id} denied access to attachment ${attachment.id}`);
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine storage path
    let storagePath = attachment.file_url;
    
    // If file_url is a full URL, extract just the path
    if (storagePath.startsWith("http")) {
      const match = storagePath.match(/\/storage\/v1\/object\/(?:public|authenticated)\/health-files\/(.+)/);
      if (match) {
        storagePath = match[1];
        console.log(`Extracted storage path: ${storagePath}`);
      }
    }

    console.log(`Fetching file from storage path: ${storagePath}`);

    // Fetch file from storage using service client
    const { data: fileData, error: storageError } = await serviceClient.storage
      .from("health-files")
      .download(storagePath);

    if (storageError || !fileData) {
      console.error("Storage download error:", storageError);
      return new Response(JSON.stringify({ 
        error: "Failed to fetch file from storage",
        storagePath
      }), {
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

    console.log(`Serving file: ${fileName}, type: ${contentType}`);

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
