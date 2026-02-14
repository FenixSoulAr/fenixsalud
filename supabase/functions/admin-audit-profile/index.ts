import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function isAdmin(sc: any, userId: string): Promise<boolean> {
  const { data } = await sc
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

const log = (step: string, details?: Record<string, unknown>) => {
  console.log(`[ADMIN-AUDIT-PROFILE] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey);
    const sc = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!(await isAdmin(sc, userData.user.id))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, profile_id, query } = await req.json();
    log("Request", { action, profile_id });

    // --- Action: search_profiles ---
    if (action === "search_profiles") {
      if (!query || typeof query !== "string" || query.trim().length < 2) {
        return new Response(JSON.stringify({ error: "Query must be at least 2 characters" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const q = query.trim().toLowerCase();

      // Search users by email
      const { data: allUsers } = await sc.auth.admin.listUsers({ perPage: 1000 });
      const matchedUsers = (allUsers?.users || []).filter(u =>
        u.email?.toLowerCase().includes(q)
      ).slice(0, 20);

      // Get profiles for matched users
      const userIds = matchedUsers.map(u => u.id);
      let profiles: any[] = [];

      if (userIds.length > 0) {
        const { data: ownerProfiles } = await sc
          .from("profiles")
          .select("id, full_name, first_name, last_name, owner_user_id, user_id")
          .in("owner_user_id", userIds);
        profiles = ownerProfiles || [];
      }

      // Also search profiles by name
      const { data: nameProfiles } = await sc
        .from("profiles")
        .select("id, full_name, first_name, last_name, owner_user_id, user_id")
        .or(`full_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`);

      // Also search by profile_id directly (if it looks like a UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(q)) {
        const { data: idProfile } = await sc
          .from("profiles")
          .select("id, full_name, first_name, last_name, owner_user_id, user_id")
          .eq("id", q);
        if (idProfile) profiles = [...profiles, ...idProfile];
      }

      // Merge and dedupe
      const allProfiles = [...profiles, ...(nameProfiles || [])];
      const seen = new Set<string>();
      const deduped = allProfiles.filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      // Enrich with owner email
      const ownerIds = [...new Set(deduped.map(p => p.owner_user_id))];
      const ownerEmailMap: Record<string, string> = {};
      for (const uid of ownerIds) {
        const found = matchedUsers.find(u => u.id === uid);
        if (found) {
          ownerEmailMap[uid] = found.email || "";
        } else {
          const { data: u } = await sc.auth.admin.getUserById(uid);
          if (u?.user?.email) ownerEmailMap[uid] = u.user.email;
        }
      }

      const results = deduped.map(p => ({
        profile_id: p.id,
        full_name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "(sin nombre)",
        owner_email: ownerEmailMap[p.owner_user_id] || "",
        is_primary: p.user_id !== null,
      }));

      return new Response(JSON.stringify({ profiles: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Action: run_audit ---
    if (action === "run_audit") {
      if (!profile_id) {
        return new Response(JSON.stringify({ error: "profile_id is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify profile exists
      const { data: profile } = await sc.from("profiles").select("id, owner_user_id, full_name").eq("id", profile_id).single();
      if (!profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      log("Running audit for profile", { profile_id, name: profile.full_name });

      // --- Professionals ---
      const { data: allDoctors } = await sc.from("doctors").select("id, full_name, is_active, profile_id, specialty").eq("profile_id", profile_id);
      const doctors = allDoctors || [];
      const activeDoctors = doctors.filter(d => d.is_active);
      const inactiveDoctors = doctors.filter(d => !d.is_active);
      const inactiveDoctorIds = new Set(inactiveDoctors.map(d => d.id));

      const normalizeName = (name: string) =>
        name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

      const nameMap: Record<string, any[]> = {};
      for (const d of doctors) {
        const key = normalizeName(d.full_name);
        if (!nameMap[key]) nameMap[key] = [];
        nameMap[key].push({ id: d.id, full_name: d.full_name, is_active: d.is_active, specialty: d.specialty || null });
      }

      // Links
      const [apptLinks, testLinks, procLinks] = await Promise.all([
        sc.from("appointments").select("id, doctor_id").not("doctor_id", "is", null).eq("profile_id", profile_id),
        sc.from("tests").select("id, doctor_id").not("doctor_id", "is", null).eq("profile_id", profile_id),
        sc.from("procedures").select("id, doctor_id").not("doctor_id", "is", null).eq("profile_id", profile_id),
      ]);
      const allLinks = [...(apptLinks.data || []), ...(testLinks.data || []), ...(procLinks.data || [])];
      const linkCountByDoctor: Record<string, number> = {};
      for (const link of allLinks) {
        linkCountByDoctor[link.doctor_id] = (linkCountByDoctor[link.doctor_id] || 0) + 1;
      }

      const duplicateProfessionals = Object.values(nameMap)
        .filter(arr => arr.length > 1)
        .map(group => group.map((d: any) => ({ ...d, linkCount: linkCountByDoctor[d.id] || 0 })));

      const inactiveWithLinks = inactiveDoctors
        .filter(d => (linkCountByDoctor[d.id] || 0) > 0)
        .map(d => ({ id: d.id, full_name: d.full_name, linkCount: linkCountByDoctor[d.id] }));

      const activeNoLinks = activeDoctors
        .filter(d => (linkCountByDoctor[d.id] || 0) === 0)
        .map(d => ({ id: d.id, full_name: d.full_name }));

      // --- Consistency ---
      const [apptAll, testAll, procAll] = await Promise.all([
        sc.from("appointments").select("id, doctor_id, professional_status, institution_id").eq("profile_id", profile_id),
        sc.from("tests").select("id, doctor_id, professional_status, institution_id").eq("profile_id", profile_id),
        sc.from("procedures").select("id, doctor_id, professional_status, institution_id").eq("profile_id", profile_id),
      ]);

      const inconsistencies: any[] = [];
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
      const { data: allInstitutions } = await sc.from("institutions").select("id, name, is_active").eq("profile_id", profile_id);
      const institutions = allInstitutions || [];
      const inactiveInstitutionIds = new Set(institutions.filter(i => !i.is_active).map(i => i.id));

      const allRecordsWithInst = [...(apptAll.data || []), ...(testAll.data || []), ...(procAll.data || [])];
      const instUsage: Record<string, number> = {};
      for (const r of allRecordsWithInst) {
        if (r.institution_id) instUsage[r.institution_id] = (instUsage[r.institution_id] || 0) + 1;
      }

      const institutionsNoUse = institutions
        .filter(i => i.is_active && !instUsage[i.id])
        .map(i => ({ id: i.id, name: i.name }));

      const recsPointingInactiveInst = allRecordsWithInst
        .filter(r => r.institution_id && inactiveInstitutionIds.has(r.institution_id))
        .map(r => ({ id: r.id, institution_id: r.institution_id }));

      // --- Orphan attachments ---
      const { data: allAttachments } = await sc.from("file_attachments").select("id, entity_id, entity_type, file_name, file_url").eq("profile_id", profile_id);
      const attachments = allAttachments || [];
      const testIds = new Set((testAll.data || []).map(t => t.id));
      const procIds = new Set((procAll.data || []).map(p => p.id));
      const apptIds = new Set((apptAll.data || []).map(a => a.id));

      const orphanAttachments = attachments.filter(att => {
        if (att.entity_type === "TestStudy") return !testIds.has(att.entity_id);
        if (att.entity_type === "Procedure") return !procIds.has(att.entity_id);
        if (att.entity_type === "Appointment") return !apptIds.has(att.entity_id);
        return true;
      }).map(att => ({ id: att.id, entity_id: att.entity_id, entity_type: att.entity_type, file_name: att.file_name }));

      // --- Medications & Diagnoses summary ---
      const [medsRes, diagRes, remindersRes] = await Promise.all([
        sc.from("medications").select("id, status").eq("profile_id", profile_id),
        sc.from("diagnoses").select("id, status").eq("profile_id", profile_id),
        sc.from("reminders").select("id, is_completed").eq("profile_id", profile_id),
      ]);

      const meds = medsRes.data || [];
      const diags = diagRes.data || [];
      const reminders = remindersRes.data || [];

      const audit = {
        profile: {
          id: profile.id,
          full_name: profile.full_name,
        },
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
        summary: {
          appointments: (apptAll.data || []).length,
          tests: (testAll.data || []).length,
          procedures: (procAll.data || []).length,
          medications: meds.length,
          medications_active: meds.filter(m => m.status === "Active").length,
          diagnoses: diags.length,
          diagnoses_active: diags.filter(d => d.status === "active").length,
          reminders: reminders.length,
          reminders_pending: reminders.filter(r => !r.is_completed).length,
          attachments: attachments.length,
        },
      };

      // Totals for persistence
      const totals = {
        issues: inconsistencies.length + orphanAttachments.length + inactiveWithLinks.length + recsPointingInactiveInst.length,
        duplicates: duplicateProfessionals.length,
        orphans: orphanAttachments.length,
        inconsistencies: inconsistencies.length,
      };

      // Persist audit run
      await sc.from("audit_runs").insert({
        admin_user_id: userData.user.id,
        profile_id,
        totals_json: totals,
        details_json: audit,
      });

      log("Audit complete", totals);

      return new Response(JSON.stringify({ audit }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Action: list_audit_runs ---
    if (action === "list_audit_runs") {
      const filter = profile_id
        ? sc.from("audit_runs").select("*").eq("profile_id", profile_id).order("created_at", { ascending: false }).limit(20)
        : sc.from("audit_runs").select("*").order("created_at", { ascending: false }).limit(50);

      const { data, error } = await filter;
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ runs: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    log("Error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
