import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Check admin role via admin_roles table (service_role bypasses RLS)
async function checkAdminRole(sc: any, userId: string): Promise<boolean> {
  const { data } = await sc
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "superadmin"])
    .maybeSingle();
  return !!data;
}

// Check if user is superadmin
async function checkSuperadminRole(sc: any, userId: string): Promise<boolean> {
  const { data } = await sc
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "superadmin")
    .maybeSingle();
  return !!data;
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

    // Verify admin access via admin_roles table
    if (!(await checkAdminRole(serviceClient, userData.user.id))) {
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

        // Enrich with admin role info
        const { data: adminRoles } = await serviceClient.from("admin_roles").select("user_id");
        const adminUserIds = new Set((adminRoles || []).map((r: any) => r.user_id));
        const enrichedUsers = (data || []).map((u: any) => ({
          ...u,
          is_admin_role: adminUserIds.has(u.user_id),
        }));

        logStep("Users fetched", { count: enrichedUsers.length });
        return new Response(
          JSON.stringify({ users: enrichedUsers }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "grant_override": {
        const { userId, expiresInDays, notes, planCode: overridePlanCode } = params;

        if (!userId) {
          return new Response(
            JSON.stringify({ error: "userId is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if target user is an admin - admins don't need overrides
        const isTargetAdmin = await checkAdminRole(serviceClient, userId);
        if (isTargetAdmin) {
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

        // Validate plan code
        const effectivePlanCode = overridePlanCode === "pro" ? "pro" : "plus";

        // Upsert the override (handles both new grants and updates)
        const { data, error } = await serviceClient
          .from("plan_overrides")
          .upsert({
            user_id: userId,
            granted_by_email: userEmail,
            expires_at: expiresAt,
            notes: notes || null,
            revoked_at: null, // Clear any previous revocation
            plan_code: effectivePlanCode,
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
        const { code, type, value, durationType, durationValue, maxRedemptions, expiresAt, stripeCouponId, planCode } = params;
        
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
            plan_code: type === "internal_override"
              ? (planCode === "pro" ? "pro" : "plus")
              : "plus",
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
              plan_code: result.plan_code === "pro" ? "pro" : "plus",
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
        // Scope to profile_id if provided (owner-self mode)
        const { profile_id: auditProfileId } = params;
        logStep("Running data audit", { profile_id: auditProfileId || "all" });

        // Build profile filter
        const profileFilter = auditProfileId
          ? (q: any) => q.eq("profile_id", auditProfileId)
          : (q: any) => q;

        // --- Professionals ---
        let doctorQuery = serviceClient.from("doctors").select("id, full_name, is_active, profile_id, specialty");
        if (auditProfileId) doctorQuery = doctorQuery.eq("profile_id", auditProfileId);
        const { data: allDoctors } = await doctorQuery;
        const doctors = allDoctors || [];
        const activeDoctors = doctors.filter((d: any) => d.is_active);
        const inactiveDoctors = doctors.filter((d: any) => !d.is_active);
        const inactiveDoctorIds = new Set(inactiveDoctors.map((d: any) => d.id));

        // Duplicate detection (normalized name - accent & case insensitive)
        const normalizeName = (name: string) =>
          name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

        const nameMap: Record<string, any[]> = {};
        for (const d of doctors) {
          const key = normalizeName(d.full_name);
          if (!nameMap[key]) nameMap[key] = [];
          nameMap[key].push({ id: d.id, full_name: d.full_name, is_active: d.is_active, specialty: d.specialty || null });
        }
        // duplicates will be enriched with linkCount after links are computed

        // Links per doctor
        let apptLinksQ = serviceClient.from("appointments").select("id, doctor_id").not("doctor_id", "is", null);
        let testLinksQ = serviceClient.from("tests").select("id, doctor_id").not("doctor_id", "is", null);
        let procLinksQ = serviceClient.from("procedures").select("id, doctor_id").not("doctor_id", "is", null);
        if (auditProfileId) {
          apptLinksQ = apptLinksQ.eq("profile_id", auditProfileId);
          testLinksQ = testLinksQ.eq("profile_id", auditProfileId);
          procLinksQ = procLinksQ.eq("profile_id", auditProfileId);
        }
        const [apptLinks, testLinks, procLinks] = await Promise.all([apptLinksQ, testLinksQ, procLinksQ]);
        const allLinks = [
          ...(apptLinks.data || []),
          ...(testLinks.data || []),
          ...(procLinks.data || []),
        ];
        const linkCountByDoctor: Record<string, number> = {};
        for (const link of allLinks) {
          linkCountByDoctor[link.doctor_id] = (linkCountByDoctor[link.doctor_id] || 0) + 1;
        }

        // Enrich and compute duplicates with link counts + specialty
        const rawDuplicates = Object.values(nameMap).filter(arr => arr.length > 1);
        const duplicateProfessionals = rawDuplicates.map(group =>
          group.map((d: any) => ({ ...d, linkCount: linkCountByDoctor[d.id] || 0 }))
        );

        const inactiveWithLinks = inactiveDoctors
          .filter((d: any) => (linkCountByDoctor[d.id] || 0) > 0)
          .map((d: any) => ({ id: d.id, full_name: d.full_name, linkCount: linkCountByDoctor[d.id] }));

        const activeNoLinks = activeDoctors
          .filter((d: any) => (linkCountByDoctor[d.id] || 0) === 0)
          .map((d: any) => ({ id: d.id, full_name: d.full_name }));

        // --- Consistency checks ---
        let apptAllQ = serviceClient.from("appointments").select("id, doctor_id, professional_status, institution_id");
        let testAllQ = serviceClient.from("tests").select("id, doctor_id, professional_status, institution_id");
        let procAllQ = serviceClient.from("procedures").select("id, doctor_id, professional_status, institution_id");
        if (auditProfileId) {
          apptAllQ = apptAllQ.eq("profile_id", auditProfileId);
          testAllQ = testAllQ.eq("profile_id", auditProfileId);
          procAllQ = procAllQ.eq("profile_id", auditProfileId);
        }
        const [apptAll, testAll, procAll] = await Promise.all([apptAllQ, testAllQ, procAllQ]);

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
            if (r.doctor_id && inactiveDoctorIds.has(r.doctor_id)) {
              inconsistencies.push({ id: r.id, table: tableName, issue: "points_to_inactive_professional", doctor_id: r.doctor_id });
            }
            if (!r.doctor_id && r.professional_status === "assigned") {
              inconsistencies.push({ id: r.id, table: tableName, issue: "null_id_but_assigned", professional_status: r.professional_status });
            }
            if (r.doctor_id && r.professional_status !== "assigned") {
              inconsistencies.push({ id: r.id, table: tableName, issue: "has_id_but_not_assigned", doctor_id: r.doctor_id, professional_status: r.professional_status });
            }
          }
        };

        checkRecords(apptAll.data || [], "appointments");
        checkRecords(testAll.data || [], "tests");
        checkRecords(procAll.data || [], "procedures");

        // --- Institutions ---
        let instQuery = serviceClient.from("institutions").select("id, name, is_active");
        if (auditProfileId) instQuery = instQuery.eq("profile_id", auditProfileId);
        const { data: allInstitutions } = await instQuery;
        const institutions = allInstitutions || [];
        const inactiveInstitutionIds = new Set(institutions.filter((i: any) => !i.is_active).map((i: any) => i.id));

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
        let attQuery = serviceClient.from("file_attachments").select("id, entity_id, entity_type, file_name, file_url");
        if (auditProfileId) attQuery = attQuery.eq("profile_id", auditProfileId);
        const { data: allAttachments } = await attQuery;

        const attachments = allAttachments || [];
        const testIds = new Set((testAll.data || []).map((t: any) => t.id));
        const procIds = new Set((procAll.data || []).map((p: any) => p.id));
        const apptIds = new Set((apptAll.data || []).map((a: any) => a.id));

        const orphanAttachments = attachments.filter((att: any) => {
          if (att.entity_type === "TestStudy") return !testIds.has(att.entity_id);
          if (att.entity_type === "Procedure") return !procIds.has(att.entity_id);
          if (att.entity_type === "Appointment") return !apptIds.has(att.entity_id);
          return true;
        }).map((att: any) => ({ id: att.id, entity_id: att.entity_id, entity_type: att.entity_type, file_name: att.file_name, file_url: att.file_url }));

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

      case "resolve_professional_duplicates": {
        const { profile_id: resolveProfileId, groups } = params;
        // groups: Array<{ keep_id: string; remove_ids: string[] }>
        if (!resolveProfileId || !groups || !Array.isArray(groups) || groups.length === 0) {
          return new Response(JSON.stringify({ error: "profile_id and groups are required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verify ownership
        const { data: resolveOwnerProfile } = await serviceClient
          .from("profiles")
          .select("owner_user_id")
          .eq("id", resolveProfileId)
          .single();

        if (!resolveOwnerProfile || resolveOwnerProfile.owner_user_id !== userData.user.id) {
          return new Response(JSON.stringify({ error: "You can only resolve duplicates in your own profile" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        logStep("Resolving professional duplicates", { profile_id: resolveProfileId, groupCount: groups.length });

        let totalDeleted = 0;
        let totalReassigned = 0;
        let totalErrors = 0;
        const errors: string[] = [];

        for (const group of groups) {
          const { keep_id, remove_ids } = group;
          if (!keep_id || !remove_ids || remove_ids.length === 0) continue;

          // Validate all IDs belong to this profile
          const { data: groupDoctors } = await serviceClient
            .from("doctors")
            .select("id")
            .eq("profile_id", resolveProfileId)
            .in("id", [keep_id, ...remove_ids]);

          const validIds = new Set((groupDoctors || []).map((d: any) => d.id));
          if (!validIds.has(keep_id)) {
            totalErrors++;
            errors.push(`keep_id ${keep_id} not found in profile`);
            continue;
          }

          for (const removeId of remove_ids) {
            if (!validIds.has(removeId)) {
              totalErrors++;
              errors.push(`remove_id ${removeId} not found in profile`);
              continue;
            }

            try {
              // Reassign links from removeId to keepId
              const tables = ["appointments", "tests", "procedures"] as const;
              for (const table of tables) {
                const { data: linked } = await serviceClient
                  .from(table)
                  .select("id")
                  .eq("doctor_id", removeId)
                  .eq("profile_id", resolveProfileId);

                if (linked && linked.length > 0) {
                  const { error: updateErr } = await serviceClient
                    .from(table)
                    .update({ doctor_id: keep_id })
                    .eq("doctor_id", removeId)
                    .eq("profile_id", resolveProfileId);

                  if (updateErr) {
                    totalErrors++;
                    errors.push(`Failed to reassign ${table} from ${removeId}: ${updateErr.message}`);
                    continue;
                  }
                  totalReassigned += linked.length;
                }
              }

              // Delete the duplicate doctor
              const { error: deleteErr } = await serviceClient
                .from("doctors")
                .delete()
                .eq("id", removeId)
                .eq("profile_id", resolveProfileId);

              if (deleteErr) {
                totalErrors++;
                errors.push(`Failed to delete doctor ${removeId}: ${deleteErr.message}`);
              } else {
                totalDeleted++;
              }
            } catch (err) {
              totalErrors++;
              errors.push(`Error processing ${removeId}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }

        logStep("Duplicate resolution complete", { totalDeleted, totalReassigned, totalErrors });

        return new Response(
          JSON.stringify({ ok: true, deleted_count: totalDeleted, reassigned_count: totalReassigned, error_count: totalErrors, errors }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "cleanup_orphan_attachments": {
        const { profile_id: cleanupProfileId } = params;
        if (!cleanupProfileId) {
          return new Response(JSON.stringify({ error: "profile_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verify the calling user owns this profile
        const { data: ownerProfile } = await serviceClient
          .from("profiles")
          .select("owner_user_id")
          .eq("id", cleanupProfileId)
          .single();

        if (!ownerProfile || ownerProfile.owner_user_id !== userData.user.id) {
          return new Response(JSON.stringify({ error: "You can only clean up your own profile's orphan attachments" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        logStep("Cleanup orphan attachments", { profile_id: cleanupProfileId });

        // Recalculate orphans server-side for this profile
        const [cAppts, cTests, cProcs, cAtts] = await Promise.all([
          serviceClient.from("appointments").select("id").eq("profile_id", cleanupProfileId),
          serviceClient.from("tests").select("id").eq("profile_id", cleanupProfileId),
          serviceClient.from("procedures").select("id").eq("profile_id", cleanupProfileId),
          serviceClient.from("file_attachments").select("id, entity_id, entity_type, file_url, file_name").eq("profile_id", cleanupProfileId),
        ]);

        const cApptIds = new Set((cAppts.data || []).map((a: any) => a.id));
        const cTestIds = new Set((cTests.data || []).map((t: any) => t.id));
        const cProcIds = new Set((cProcs.data || []).map((p: any) => p.id));

        const orphans = (cAtts.data || []).filter((att: any) => {
          if (att.entity_type === "TestStudy") return !cTestIds.has(att.entity_id);
          if (att.entity_type === "Procedure") return !cProcIds.has(att.entity_id);
          if (att.entity_type === "Appointment") return !cApptIds.has(att.entity_id);
          return true;
        });

        let deletedCount = 0;
        let failedCount = 0;
        const failedItems: Array<{ id: string; file_url: string; error: string }> = [];

        for (const orphan of orphans) {
          try {
            // Delete from storage
            if (orphan.file_url) {
              const { error: storageErr } = await serviceClient.storage
                .from("health-files")
                .remove([orphan.file_url]);
              if (storageErr) {
                logStep("Storage delete warning for orphan", { id: orphan.id, error: storageErr.message });
                // Continue - still try to remove the DB record
              }
            }

            // Delete DB record
            const { error: dbErr } = await serviceClient
              .from("file_attachments")
              .delete()
              .eq("id", orphan.id);

            if (dbErr) {
              failedCount++;
              failedItems.push({ id: orphan.id, file_url: orphan.file_url, error: dbErr.message });
            } else {
              deletedCount++;
            }
          } catch (err) {
            failedCount++;
            failedItems.push({ id: orphan.id, file_url: orphan.file_url, error: err instanceof Error ? err.message : String(err) });
          }
        }

        logStep("Cleanup complete", { deletedCount, failedCount, total: orphans.length });

        return new Response(
          JSON.stringify({ ok: true, deleted_count: deletedCount, failed_count: failedCount, failed_items: failedItems }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list_admin_roles": {
        const { data: roles, error } = await serviceClient
          .from("admin_roles")
          .select("user_id, role, created_at, created_by")
          .order("created_at", { ascending: true });

        if (error) {
          return new Response(JSON.stringify({ error: "Failed to fetch roles" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Enrich with emails
        const userIds = (roles || []).map((r: any) => r.user_id);
        const { data: { users: authUsers } } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
        const emailMap: Record<string, string> = {};
        for (const u of (authUsers || [])) {
          emailMap[u.id] = u.email || "";
        }

        const enriched = (roles || []).map((r: any) => ({
          ...r,
          email: emailMap[r.user_id] || "unknown",
          created_by_email: r.created_by ? (emailMap[r.created_by] || r.created_by) : null,
        }));

        return new Response(JSON.stringify({ roles: enriched }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "set_user_role": {
        const { userId: targetUserId, role: targetRole } = params;

        if (!targetUserId || !targetRole || !["admin", "superadmin"].includes(targetRole)) {
          return new Response(JSON.stringify({ error: "userId and valid role required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Only superadmin can manage roles
        if (!(await checkSuperadminRole(serviceClient, userData.user.id))) {
          return new Response(JSON.stringify({ error: "Solo superadmins pueden gestionar roles" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verify target user exists
        const { data: targetUser } = await serviceClient.auth.admin.getUserById(targetUserId);
        if (!targetUser?.user) {
          return new Response(JSON.stringify({ error: "Usuario no encontrado" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Upsert role
        const { error: upsertErr } = await serviceClient
          .from("admin_roles")
          .upsert({
            user_id: targetUserId,
            role: targetRole,
            created_by: userData.user.id,
          }, { onConflict: "user_id" });

        if (upsertErr) {
          return new Response(JSON.stringify({ error: "Error al asignar rol" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        logStep("Role set", { targetUserId, role: targetRole, by: userEmail });
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "remove_user_role": {
        const { userId: removeUserId } = params;

        if (!removeUserId) {
          return new Response(JSON.stringify({ error: "userId is required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!(await checkSuperadminRole(serviceClient, userData.user.id))) {
          return new Response(JSON.stringify({ error: "Solo superadmins pueden gestionar roles" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check if target is a superadmin - can't remove superadmin directly
        const { data: targetRoleData } = await serviceClient
          .from("admin_roles")
          .select("role")
          .eq("user_id", removeUserId)
          .maybeSingle();

        if (targetRoleData?.role === "superadmin") {
          return new Response(JSON.stringify({ error: "No se puede quitar un superadmin directamente. Usá la transferencia de ownership." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: delErr } = await serviceClient
          .from("admin_roles")
          .delete()
          .eq("user_id", removeUserId);

        if (delErr) {
          return new Response(JSON.stringify({ error: "Error al quitar rol" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        logStep("Role removed", { removeUserId, by: userEmail });
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "transfer_superadmin": {
        const { toUserId } = params;

        if (!toUserId) {
          return new Response(JSON.stringify({ error: "toUserId is required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!(await checkSuperadminRole(serviceClient, userData.user.id))) {
          return new Response(JSON.stringify({ error: "Solo superadmins pueden transferir ownership" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (toUserId === userData.user.id) {
          return new Response(JSON.stringify({ error: "No podés transferir a vos mismo" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verify target user exists
        const { data: toUser } = await serviceClient.auth.admin.getUserById(toUserId);
        if (!toUser?.user) {
          return new Response(JSON.stringify({ error: "Usuario destino no encontrado" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Set target as superadmin
        await serviceClient
          .from("admin_roles")
          .upsert({
            user_id: toUserId,
            role: "superadmin",
            created_by: userData.user.id,
          }, { onConflict: "user_id" });

        // Demote caller to admin
        await serviceClient
          .from("admin_roles")
          .update({ role: "admin" })
          .eq("user_id", userData.user.id);

        logStep("Superadmin transferred", { from: userData.user.id, to: toUserId });
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "search_users_by_email": {
        const { query } = params;
        if (!query || query.length < 2) {
          return new Response(JSON.stringify({ users: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: { users: allUsers } } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
        const filtered = (allUsers || [])
          .filter((u: any) => u.email?.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 10)
          .map((u: any) => ({ user_id: u.id, email: u.email }));

        return new Response(JSON.stringify({ users: filtered }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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