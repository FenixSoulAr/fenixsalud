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

        // Check if target user is an admin - admins don't need overrides
        const { data: targetUser } = await serviceClient.auth.admin.getUserById(userId);
        if (targetUser?.user && isAdminEmail(targetUser.user.email)) {
          return new Response(
            JSON.stringify({ error: "Cannot grant override to admin users - they have full access by role" }),
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

      case "list_promo_codes": {
        const { data, error } = await serviceClient.rpc("get_admin_promo_codes");
        
        if (error) {
          logStep("Error fetching promo codes", { error: error.message });
          return new Response(
            JSON.stringify({ error: "Failed to fetch promo codes" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("Promo codes fetched", { count: data?.length });
        return new Response(
          JSON.stringify({ promoCodes: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create_promo_code": {
        const { code, type, value, durationType, durationValue, maxRedemptions, expiresAt, stripeCouponId } = params;
        
        if (!code || !type) {
          return new Response(
            JSON.stringify({ error: "code and type are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if code already exists (case-insensitive)
        const { data: existing } = await serviceClient
          .from("discounts")
          .select("id")
          .ilike("code", code)
          .maybeSingle();

        if (existing) {
          return new Response(
            JSON.stringify({ error: "A promo code with this name already exists" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await serviceClient
          .from("discounts")
          .insert({
            code: code.toUpperCase(),
            type,
            value: type === "internal_override" ? 100 : (value || 10),
            duration_type: durationType || "once",
            duration_value: durationValue || null,
            max_redemptions: maxRedemptions || null,
            valid_to: expiresAt ? new Date(expiresAt).toISOString() : null,
            stripe_coupon_id: stripeCouponId || null,
            is_active: true,
            redeemed_count: 0,
          })
          .select()
          .single();

        if (error) {
          logStep("Error creating promo code", { error: error.message });
          return new Response(
            JSON.stringify({ error: "Failed to create promo code" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("Promo code created", { code, type, createdBy: userEmail });
        return new Response(
          JSON.stringify({ success: true, promoCode: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update_promo_code": {
        const { codeId, durationType, durationValue, isActive, maxRedemptions } = params;
        
        if (!codeId) {
          return new Response(
            JSON.stringify({ error: "codeId is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updateData: Record<string, unknown> = {};
        
        if (durationType !== undefined) {
          updateData.duration_type = durationType;
          updateData.duration_value = durationType === "forever" ? null : (durationValue || null);
        }
        
        if (isActive !== undefined) {
          updateData.is_active = isActive;
        }
        
        if (maxRedemptions !== undefined) {
          updateData.max_redemptions = maxRedemptions || null;
        }

        const { error } = await serviceClient
          .from("discounts")
          .update(updateData)
          .eq("id", codeId);

        if (error) {
          logStep("Error updating promo code", { error: error.message });
          return new Response(
            JSON.stringify({ error: "Failed to update promo code" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("Promo code updated", { codeId, ...updateData, updatedBy: userEmail });
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete_promo_code": {
        const { codeId } = params;
        
        if (!codeId) {
          return new Response(
            JSON.stringify({ error: "codeId is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await serviceClient
          .from("discounts")
          .delete()
          .eq("id", codeId);

        if (error) {
          logStep("Error deleting promo code", { error: error.message });
          return new Response(
            JSON.stringify({ error: "Failed to delete promo code" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("Promo code deleted", { codeId, deletedBy: userEmail });
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "deactivate_promo_code": {
        const { codeId } = params;
        
        if (!codeId) {
          return new Response(
            JSON.stringify({ error: "codeId is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await serviceClient
          .from("discounts")
          .update({ is_active: false })
          .eq("id", codeId);

        if (error) {
          logStep("Error deactivating promo code", { error: error.message });
          return new Response(
            JSON.stringify({ error: "Failed to deactivate promo code" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("Promo code deactivated", { codeId, deactivatedBy: userEmail });
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "redeem_promo_code": {
        // This action can be called by any authenticated user for themselves
        // But we're in the admin function, so this is for admin-granted redemptions
        const { userId, code } = params;
        
        if (!userId || !code) {
          return new Response(
            JSON.stringify({ error: "userId and code are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Validate the promo code
        const { data: validation, error: validationError } = await serviceClient
          .rpc("validate_promo_code", { _code: code, _user_id: userId });

        if (validationError || !validation || validation.length === 0) {
          logStep("Promo code validation failed", { error: validationError?.message });
          return new Response(
            JSON.stringify({ error: "Failed to validate promo code" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = validation[0];
        if (!result.valid) {
          return new Response(
            JSON.stringify({ error: result.error_message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Handle internal_override type - create plan_override
        let overrideId: string | null = null;
        if (result.discount_type === "internal_override") {
          // Calculate expiration based on duration
          let expiresAt: string | null = null;
          if (result.duration_type === "days" && result.duration_value) {
            // Duration in days (e.g., TESTER30 = 30 days, PRENSA = 90 days)
            const expDate = new Date();
            expDate.setDate(expDate.getDate() + result.duration_value);
            expiresAt = expDate.toISOString();
          } else if (result.duration_type === "once") {
            // 30 days default for "once"
            const expDate = new Date();
            expDate.setDate(expDate.getDate() + 30);
            expiresAt = expDate.toISOString();
          } else if (result.duration_type === "repeating" && result.duration_value) {
            const expDate = new Date();
            expDate.setMonth(expDate.getMonth() + result.duration_value);
            expiresAt = expDate.toISOString();
          }
          // "forever" = null expires_at (e.g., FAMILIA)

          const { data: override, error: overrideError } = await serviceClient
            .from("plan_overrides")
            .upsert({
              user_id: userId,
              granted_by_email: userEmail,
              expires_at: expiresAt,
              notes: `Promo code: ${code}`,
              revoked_at: null,
            }, {
              onConflict: "user_id",
            })
            .select()
            .single();

          if (overrideError) {
            logStep("Error creating override from promo", { error: overrideError.message });
            return new Response(
              JSON.stringify({ error: "Failed to apply promo code" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          overrideId = override.id;
        }

        // Record the redemption
        const { error: redemptionError } = await serviceClient
          .from("promo_code_redemptions")
          .insert({
            discount_id: result.discount_id,
            user_id: userId,
            source: "admin_grant",
            override_id: overrideId,
          });

        if (redemptionError) {
          logStep("Error recording redemption", { error: redemptionError.message });
          // Don't fail - the override was created
        }

        // Update usage counters
        await serviceClient
          .from("discounts")
          .update({ 
            redeemed_count: (await serviceClient
              .from("promo_code_redemptions")
              .select("id", { count: "exact" })
              .eq("discount_id", result.discount_id)).count || 1,
            last_used_at: new Date().toISOString()
          })
          .eq("id", result.discount_id);

        logStep("Promo code redeemed", { code, userId, type: result.discount_type, overrideId });
        return new Response(
          JSON.stringify({ 
            success: true, 
            type: result.discount_type,
            overrideId,
            stripeCouponId: result.stripe_coupon_id
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "data_audit": {
        logStep("Running data audit");

        // --- Professionals ---
        const { data: allDoctors } = await serviceClient
          .from("doctors")
          .select("id, full_name, is_active, profile_id");
        const doctors = allDoctors || [];
        const activeDoctors = doctors.filter((d: any) => d.is_active);
        const inactiveDoctors = doctors.filter((d: any) => !d.is_active);
        const inactiveDoctorIds = new Set(inactiveDoctors.map((d: any) => d.id));
        const activeDoctorIds = new Set(activeDoctors.map((d: any) => d.id));

        // Duplicate detection (normalized name)
        const nameMap: Record<string, any[]> = {};
        for (const d of doctors) {
          const key = d.full_name.trim().toLowerCase().replace(/\s+/g, " ");
          if (!nameMap[key]) nameMap[key] = [];
          nameMap[key].push({ id: d.id, full_name: d.full_name, is_active: d.is_active });
        }
        const duplicateProfessionals = Object.values(nameMap).filter(arr => arr.length > 1);

        // Links per doctor
        const [apptLinks, testLinks, procLinks] = await Promise.all([
          serviceClient.from("appointments").select("id, doctor_id").not("doctor_id", "is", null),
          serviceClient.from("tests").select("id, doctor_id").not("doctor_id", "is", null),
          serviceClient.from("procedures").select("id, doctor_id").not("doctor_id", "is", null),
        ]);
        const allLinks = [
          ...(apptLinks.data || []),
          ...(testLinks.data || []),
          ...(procLinks.data || []),
        ];
        const linkCountByDoctor: Record<string, number> = {};
        for (const link of allLinks) {
          linkCountByDoctor[link.doctor_id] = (linkCountByDoctor[link.doctor_id] || 0) + 1;
        }

        const inactiveWithLinks = inactiveDoctors
          .filter((d: any) => (linkCountByDoctor[d.id] || 0) > 0)
          .map((d: any) => ({ id: d.id, full_name: d.full_name, linkCount: linkCountByDoctor[d.id] }));

        const activeNoLinks = activeDoctors
          .filter((d: any) => (linkCountByDoctor[d.id] || 0) === 0)
          .map((d: any) => ({ id: d.id, full_name: d.full_name }));

        // --- Consistency checks across appointments/tests/procedures ---
        const [apptAll, testAll, procAll] = await Promise.all([
          serviceClient.from("appointments").select("id, doctor_id, professional_status, institution_id"),
          serviceClient.from("tests").select("id, doctor_id, professional_status, institution_id"),
          serviceClient.from("procedures").select("id, doctor_id, professional_status, institution_id"),
        ]);

        interface InconsistencyRecord {
          id: string;
          table: string;
          issue: string;
          doctor_id?: string | null;
          professional_status?: string;
        }

        const inconsistencies: InconsistencyRecord[] = [];

        const checkRecords = (records: any[], tableName: string) => {
          for (const r of records) {
            // doctor_id set but pointing to inactive doctor
            if (r.doctor_id && inactiveDoctorIds.has(r.doctor_id)) {
              inconsistencies.push({ id: r.id, table: tableName, issue: "points_to_inactive_professional", doctor_id: r.doctor_id });
            }
            // doctor_id NULL but status = assigned
            if (!r.doctor_id && r.professional_status === "assigned") {
              inconsistencies.push({ id: r.id, table: tableName, issue: "null_id_but_assigned", professional_status: r.professional_status });
            }
            // doctor_id set but status != assigned
            if (r.doctor_id && r.professional_status !== "assigned") {
              inconsistencies.push({ id: r.id, table: tableName, issue: "has_id_but_not_assigned", doctor_id: r.doctor_id, professional_status: r.professional_status });
            }
          }
        };

        checkRecords(apptAll.data || [], "appointments");
        checkRecords(testAll.data || [], "tests");
        checkRecords(procAll.data || [], "procedures");

        // --- Institutions ---
        const { data: allInstitutions } = await serviceClient
          .from("institutions")
          .select("id, name, is_active");
        const institutions = allInstitutions || [];
        const activeInstitutionIds = new Set(institutions.filter((i: any) => i.is_active).map((i: any) => i.id));
        const inactiveInstitutionIds = new Set(institutions.filter((i: any) => !i.is_active).map((i: any) => i.id));

        // Institution usage
        const allRecordsWithInst = [
          ...(apptAll.data || []),
          ...(testAll.data || []),
          ...(procAll.data || []),
        ];
        const instUsage: Record<string, number> = {};
        for (const r of allRecordsWithInst) {
          if (r.institution_id) {
            instUsage[r.institution_id] = (instUsage[r.institution_id] || 0) + 1;
          }
        }

        const institutionsNoUse = institutions
          .filter((i: any) => i.is_active && !instUsage[i.id])
          .map((i: any) => ({ id: i.id, name: i.name }));

        const recsPointingInactiveInst = allRecordsWithInst
          .filter(r => r.institution_id && inactiveInstitutionIds.has(r.institution_id))
          .map(r => ({ id: r.id, institution_id: r.institution_id }));

        // --- Orphan attachments ---
        const { data: allAttachments } = await serviceClient
          .from("file_attachments")
          .select("id, entity_id, entity_type, file_name");

        const attachments = allAttachments || [];
        const testIds = new Set((testAll.data || []).map((t: any) => t.id));
        const procIds = new Set((procAll.data || []).map((p: any) => p.id));
        const apptIds = new Set((apptAll.data || []).map((a: any) => a.id));

        const orphanAttachments = attachments.filter((att: any) => {
          if (att.entity_type === "TestStudy") return !testIds.has(att.entity_id);
          if (att.entity_type === "Procedure") return !procIds.has(att.entity_id);
          if (att.entity_type === "Appointment") return !apptIds.has(att.entity_id);
          return true; // unknown type = orphan
        }).map((att: any) => ({ id: att.id, entity_id: att.entity_id, entity_type: att.entity_type, file_name: att.file_name }));

        const auditResult = {
          professionals: {
            total: doctors.length,
            active: activeDoctors.length,
            inactive: inactiveDoctors.length,
            duplicates: duplicateProfessionals,
            inactiveWithLinks,
            activeNoLinks,
          },
          inconsistencies,
          institutions: {
            total: institutions.length,
            noUse: institutionsNoUse,
            recsPointingInactive: recsPointingInactiveInst,
          },
          orphanAttachments,
        };

        logStep("Audit complete", { 
          inconsistencies: inconsistencies.length,
          orphans: orphanAttachments.length,
          inactiveWithLinks: inactiveWithLinks.length 
        });

        return new Response(
          JSON.stringify({ audit: auditResult }),
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