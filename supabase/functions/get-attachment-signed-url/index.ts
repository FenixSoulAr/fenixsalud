import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function: get-attachment-signed-url
 * 
 * Returns a signed URL for an attachment that can be opened directly
 * in external browsers without requiring Authorization headers.
 * 
 * Input: { attachmentId: string }
 * Output: { url: string, mimeType: string, fileName: string }
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only accept POST
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    let attachmentId: string | null = null;
    try {
      const body = await req.json();
      attachmentId = body.attachmentId || null;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!attachmentId) {
      return new Response(JSON.stringify({ error: "Missing attachmentId" }), {
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

    console.log(`User ${user.id} requesting signed URL for attachment: ${attachmentId}`);

    // Create service client for privileged operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch attachment metadata
    const { data: attachment, error: fetchError } = await serviceClient
      .from("file_attachments")
      .select("id, file_name, file_url, mime_type, user_id, profile_id")
      .eq("id", attachmentId)
      .maybeSingle();

    if (fetchError) {
      console.error("Attachment fetch error:", fetchError);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!attachment) {
      console.error(`Attachment not found: ${attachmentId}`);
      return new Response(JSON.stringify({ error: "Attachment not found" }), {
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

    console.log(`Generating signed URL for storage path: ${storagePath}`);

    // Generate signed URL (valid for 15 minutes)
    const { data: signedData, error: signedError } = await serviceClient.storage
      .from("health-files")
      .createSignedUrl(storagePath, 900); // 15 minutes in seconds

    if (signedError || !signedData?.signedUrl) {
      console.error("Signed URL generation error:", signedError);
      return new Response(JSON.stringify({ 
        error: "Failed to generate signed URL",
        details: signedError?.message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Signed URL generated successfully for: ${attachment.file_name}`);

    // Return signed URL with metadata
    return new Response(JSON.stringify({
      url: signedData.signedUrl,
      mimeType: attachment.mime_type || "application/octet-stream",
      fileName: attachment.file_name || "attachment",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
