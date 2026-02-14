import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ role: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await authClient.auth.getUser(token);

    if (error || !data.user) {
      return new Response(JSON.stringify({ role: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin_roles table using service_role (bypasses RLS)
    const sc = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: roleRow } = await sc
      .from("admin_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    const role = roleRow?.role ?? null;
    // Normalize: return 'superadmin', 'admin', or null
    return new Response(JSON.stringify({ role }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ role: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
