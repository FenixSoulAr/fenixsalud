import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[DELETE-ATTACHMENT] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const { attachment_id, profile_id } = await req.json();

    if (!attachment_id || !profile_id) {
      return new Response(JSON.stringify({ error: "attachment_id and profile_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Delete requested", { attachment_id, profile_id, userId });

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Verify profile ownership: user must own this profile
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, owner_user_id")
      .eq("id", profile_id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.owner_user_id !== userId) {
      // Check if user is contributor via profile_shares
      const { data: share } = await serviceClient
        .from("profile_shares")
        .select("role")
        .eq("profile_id", profile_id)
        .eq("shared_with_user_id", userId)
        .eq("status", "active")
        .single();

      // Only owner can delete attachments (per existing RLS)
      if (!share || share.role !== "contributor") {
        return new Response(JSON.stringify({ error: "You don't have permission to delete attachments for this profile" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch the attachment record
    const { data: attachment, error: attError } = await serviceClient
      .from("file_attachments")
      .select("id, file_url, profile_id, file_name")
      .eq("id", attachment_id)
      .single();

    if (attError || !attachment) {
      return new Response(JSON.stringify({ error: "Attachment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify attachment belongs to the specified profile
    if (attachment.profile_id !== profile_id) {
      return new Response(JSON.stringify({ error: "Attachment does not belong to this profile" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const storagePath = attachment.file_url;

    // Step 1: Delete file from Storage
    if (storagePath) {
      const { error: storageError } = await serviceClient.storage
        .from("health-files")
        .remove([storagePath]);

      if (storageError) {
        logStep("Storage delete warning (continuing)", { storagePath, error: storageError.message });
        // Continue anyway - the DB record should still be removed
      } else {
        logStep("Storage file deleted", { storagePath });
      }
    }

    // Step 2: Delete DB record
    const { error: dbError } = await serviceClient
      .from("file_attachments")
      .delete()
      .eq("id", attachment_id);

    if (dbError) {
      logStep("DB delete failed", { error: dbError.message });
      return new Response(JSON.stringify({ error: "Failed to delete attachment record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Attachment fully deleted", { attachment_id, storagePath });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logStep("Unexpected error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
