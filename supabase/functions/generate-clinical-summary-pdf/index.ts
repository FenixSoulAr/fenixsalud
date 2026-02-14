import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SummaryOptions {
  profileId: string;
  includeVisits?: boolean;
  language?: "en" | "es";
}

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

    const body = await req.json() as SummaryOptions;
    const { profileId, includeVisits, language = "es" } = body;

    if (!profileId) {
      return new Response(JSON.stringify({ error: "profileId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating PDF for profile ${profileId}, user ${user.id}`);

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: canAccess } = await serviceClient.rpc("can_access_profile_by_id", {
      _profile_id: profileId,
      _user_id: user.id,
    });

    if (!canAccess) {
      return new Response(JSON.stringify({ error: "Access denied to profile" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all data
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().split("T")[0];

    const [profileRes, medsRes, diagRes, testsRes, proceduresRes, appointmentsRes] = await Promise.all([
      serviceClient.from("profiles").select("*").eq("id", profileId).maybeSingle(),
      serviceClient.from("medications").select("*").eq("profile_id", profileId).eq("status", "Active").order("name"),
      serviceClient.from("diagnoses").select("*").eq("profile_id", profileId),
      serviceClient.from("tests").select("*, institutions(name), doctors(full_name, specialty)").eq("profile_id", profileId).gte("date", twelveMonthsAgoStr).order("date", { ascending: false }),
      serviceClient.from("procedures").select("*, institutions(name), doctors(full_name, specialty)").eq("profile_id", profileId).order("date", { ascending: false }),
      serviceClient.from("appointments").select("*, doctors(full_name, specialty), institutions(name)").eq("profile_id", profileId).gte("datetime_start", twelveMonthsAgo.toISOString()).order("datetime_start", { ascending: false }),
    ]);

    const profile = profileRes.data;
    const medications = medsRes.data || [];
    const diagnoses = diagRes.data || [];
    const tests = testsRes.data || [];
    const allProcedures = proceduresRes.data || [];
    const appointments = appointmentsRes.data || [];

    const procedures = allProcedures.filter((p: any) => {
      if (p.type === "Surgery") return true;
      return new Date(p.date) >= twelveMonthsAgo;
    });

    const surgeries = procedures.filter((p: any) => p.type === "Surgery");
    const hospitalizations = procedures.filter((p: any) => p.type === "Hospitalization");
    const vaccines = procedures.filter((p: any) => p.type === "Vaccine");

    // Fetch attachments for textual listing
    const entityIds = [
      ...tests.map((t: any) => t.id),
      ...procedures.map((p: any) => p.id),
    ];

    let attachmentsByEntity: Record<string, { file_name: string; mime_type: string | null }[]> = {};
    let totalAttachmentCount = 0;

    if (entityIds.length > 0) {
      const { data: attachments } = await serviceClient
        .from("file_attachments")
        .select("entity_id, entity_type, file_name, mime_type")
        .eq("profile_id", profileId)
        .in("entity_id", entityIds)
        .in("entity_type", ["TestStudy", "Procedure"]);

      if (attachments) {
        totalAttachmentCount = attachments.length;
        for (const att of attachments) {
          if (!attachmentsByEntity[att.entity_id]) attachmentsByEntity[att.entity_id] = [];
          attachmentsByEntity[att.entity_id].push({ file_name: att.file_name, mime_type: att.mime_type });
        }
      }
    }

    const labels = language === "es" ? {
      title: "Resumen Clínico",
      generatedOn: "Generado el",
      nationalId: "DNI",
      phone: "Teléfono",
      insurance: "Obra social",
      allergies: "Alergias",
      notes: "Notas",
      currentMedications: "Medicación Actual",
      noActiveMedications: "Sin medicación activa.",
      tests: "Estudios (últimos 12 meses)",
      noTests: "Sin estudios en los últimos 12 meses.",
      date: "Fecha",
      type: "Tipo",
      institution: "Institución",
      professional: "Profesional",
      surgeries: "Cirugías (historial completo)",
      hospitalizations: "Internaciones (últimos 12 meses)",
      vaccines: "Vacunas (últimos 12 meses)",
      visits: "Consultas (últimos 12 meses)",
      noVisits: "Sin consultas en los últimos 12 meses.",
      reason: "Motivo",
      availableAttachments: "Adjuntos disponibles",
      totalAttachments: "Total adjuntos",
      noAttachments: "Sin adjuntos.",
    } : {
      title: "Clinical Summary",
      generatedOn: "Generated on",
      nationalId: "National ID",
      phone: "Phone",
      insurance: "Insurance",
      allergies: "Allergies",
      notes: "Notes",
      currentMedications: "Current Medications",
      noActiveMedications: "No active medications.",
      tests: "Tests (last 12 months)",
      noTests: "No tests in the last 12 months.",
      date: "Date",
      type: "Type",
      institution: "Institution",
      professional: "Professional",
      surgeries: "Surgeries (full history)",
      hospitalizations: "Hospitalizations (last 12 months)",
      vaccines: "Vaccines (last 12 months)",
      visits: "Visits (last 12 months)",
      noVisits: "No visits in the last 12 months.",
      reason: "Reason",
      availableAttachments: "Available Attachments",
      totalAttachments: "Total attachments",
      noAttachments: "No attachments.",
    };

    const formatProfessional = (record: any): string | null => {
      if (record.professional_status !== "assigned" || !record.doctors?.full_name) return null;
      const name = record.doctors.full_name;
      const spec = record.doctors.specialty;
      return spec ? `${name} (${spec})` : name;
    };

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 50;
    const lineHeight = 14;
    let currentY = pageHeight - margin;
    let page = pdfDoc.addPage([pageWidth, pageHeight]);

    const addNewPage = () => {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - margin;
    };

    const checkSpace = (needed: number) => {
      if (currentY - needed < margin) addNewPage();
    };

    const drawText = (text: string, options: { bold?: boolean; size?: number; color?: any; indent?: number } = {}) => {
      const size = options.size || 10;
      const usedFont = options.bold ? boldFont : font;
      const color = options.color || rgb(0, 0, 0);
      const x = margin + (options.indent || 0);

      // Word wrap for long lines
      const maxWidth = pageWidth - x - margin;
      const words = text.split(" ");
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = usedFont.widthOfTextAtSize(testLine, size);
        if (testWidth > maxWidth && currentLine) {
          checkSpace(lineHeight);
          page.drawText(currentLine, { x, y: currentY, size, font: usedFont, color });
          currentY -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        checkSpace(lineHeight);
        page.drawText(currentLine, { x, y: currentY, size, font: usedFont, color });
        currentY -= lineHeight;
      }
    };

    const drawLine = () => {
      checkSpace(10);
      page.drawLine({
        start: { x: margin, y: currentY },
        end: { x: pageWidth - margin, y: currentY },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });
      currentY -= 10;
    };

    // Header
    const fullName = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Patient";
    const today = new Date().toLocaleDateString(language === "es" ? "es-AR" : "en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    drawText(labels.title, { bold: true, size: 18 });
    currentY -= 5;
    drawText(fullName, { bold: true, size: 14 });
    drawText(`${labels.generatedOn}: ${today}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
    currentY -= 10;
    drawLine();

    // Profile info
    if (profile?.national_id) drawText(`${labels.nationalId}: ${profile.national_id}`);
    if (profile?.phone) drawText(`${labels.phone}: ${profile.phone}`);
    if (profile?.insurance_provider) {
      let insurance = profile.insurance_provider;
      if (profile.insurance_plan) insurance += ` - ${profile.insurance_plan}`;
      if (profile.insurance_member_id) insurance += ` (ID: ${profile.insurance_member_id})`;
      drawText(`${labels.insurance}: ${insurance}`);
    }
    if (profile?.allergies) {
      currentY -= 5;
      drawText(`[!] ${labels.allergies}: ${profile.allergies}`, { color: rgb(0.8, 0, 0) });
    }
    if (profile?.notes) drawText(`${labels.notes}: ${profile.notes}`);
    currentY -= 15;

    // Medications
    drawText(labels.currentMedications, { bold: true, size: 12 });
    currentY -= 5;
    if (medications.length === 0) {
      drawText(labels.noActiveMedications, { color: rgb(0.5, 0.5, 0.5) });
    } else {
      for (const med of medications) {
        const schedule = med.times?.length ? ` (${med.times.join(", ")})` : "";
        drawText(`• ${med.name} - ${med.dose_text} - ${med.schedule_type}${schedule}`);
      }
    }
    currentY -= 15;

    // Tests
    drawText(labels.tests, { bold: true, size: 12 });
    currentY -= 5;
    if (tests.length === 0) {
      drawText(labels.noTests, { color: rgb(0.5, 0.5, 0.5) });
    } else {
      for (const test of tests) {
        const dateStr = new Date(test.date).toLocaleDateString(language === "es" ? "es-AR" : "en-US");
        const inst = test.institutions?.name || "—";
        const prof = formatProfessional(test);
        let line = `• ${dateStr} - ${test.type} - ${inst}`;
        if (prof) line += ` - ${labels.professional}: ${prof}`;
        drawText(line);
      }
    }
    currentY -= 15;

    // Surgeries
    if (surgeries.length > 0) {
      drawText(labels.surgeries, { bold: true, size: 12 });
      currentY -= 5;
      for (const p of surgeries) {
        const dateStr = new Date(p.date).toLocaleDateString(language === "es" ? "es-AR" : "en-US");
        const inst = p.institutions?.name || "—";
        const prof = formatProfessional(p);
        let line = `• ${dateStr} - ${p.title} - ${inst}`;
        if (prof) line += ` - ${labels.professional}: ${prof}`;
        drawText(line);
      }
      currentY -= 15;
    }

    // Hospitalizations
    if (hospitalizations.length > 0) {
      drawText(labels.hospitalizations, { bold: true, size: 12 });
      currentY -= 5;
      for (const p of hospitalizations) {
        const dateStr = new Date(p.date).toLocaleDateString(language === "es" ? "es-AR" : "en-US");
        const inst = p.institutions?.name || "—";
        const prof = formatProfessional(p);
        let line = `• ${dateStr} - ${p.title} - ${inst}`;
        if (prof) line += ` - ${labels.professional}: ${prof}`;
        drawText(line);
      }
      currentY -= 15;
    }

    // Vaccines
    if (vaccines.length > 0) {
      drawText(labels.vaccines, { bold: true, size: 12 });
      currentY -= 5;
      for (const p of vaccines) {
        const dateStr = new Date(p.date).toLocaleDateString(language === "es" ? "es-AR" : "en-US");
        const inst = p.institutions?.name || "—";
        const prof = formatProfessional(p);
        let line = `• ${dateStr} - ${p.title} - ${inst}`;
        if (prof) line += ` - ${labels.professional}: ${prof}`;
        drawText(line);
      }
      currentY -= 15;
    }

    // Visits (optional)
    if (includeVisits && appointments.length > 0) {
      drawText(labels.visits, { bold: true, size: 12 });
      currentY -= 5;
      for (const a of appointments) {
        const dateStr = new Date(a.datetime_start).toLocaleDateString(language === "es" ? "es-AR" : "en-US");
        const prof = formatProfessional(a);
        const reason = a.reason || "—";
        let line = `• ${dateStr} - ${reason}`;
        if (prof) line += ` - ${labels.professional}: ${prof}`;
        drawText(line);
      }
      currentY -= 15;
    }

    // Available Attachments section (textual listing only)
    if (totalAttachmentCount > 0) {
      drawLine();
      drawText(labels.availableAttachments, { bold: true, size: 12 });
      drawText(`${labels.totalAttachments}: ${totalAttachmentCount}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
      currentY -= 5;

      // List test attachments
      const testsWithAttachments = tests.filter((t: any) => attachmentsByEntity[t.id]);
      if (testsWithAttachments.length > 0) {
        drawText(language === "es" ? "Estudios:" : "Tests:", { bold: true, size: 10 });
        for (const test of testsWithAttachments) {
          const dateStr = new Date(test.date).toLocaleDateString(language === "es" ? "es-AR" : "en-US");
          drawText(`${dateStr} - ${test.type}`, { indent: 10, size: 9 });
          for (const att of attachmentsByEntity[test.id]) {
            const ext = att.mime_type ? ` (${att.mime_type.split("/").pop()})` : "";
            drawText(`→ ${att.file_name}${ext}`, { indent: 20, size: 8, color: rgb(0.3, 0.3, 0.3) });
          }
        }
        currentY -= 5;
      }

      // List procedure attachments
      const procsWithAttachments = procedures.filter((p: any) => attachmentsByEntity[p.id]);
      if (procsWithAttachments.length > 0) {
        drawText(language === "es" ? "Procedimientos:" : "Procedures:", { bold: true, size: 10 });
        for (const proc of procsWithAttachments) {
          const dateStr = new Date(proc.date).toLocaleDateString(language === "es" ? "es-AR" : "en-US");
          drawText(`${dateStr} - ${proc.title}`, { indent: 10, size: 9 });
          for (const att of attachmentsByEntity[proc.id]) {
            const ext = att.mime_type ? ` (${att.mime_type.split("/").pop()})` : "";
            drawText(`→ ${att.file_name}${ext}`, { indent: 20, size: 8, color: rgb(0.3, 0.3, 0.3) });
          }
        }
      }
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    console.log(`PDF generated: ${pdfBytes.length} bytes`);

    // Upload
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fileName = `clinical_summary_${timestamp}.pdf`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await serviceClient.storage
      .from("exports")
      .upload(filePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signedData, error: signedError } = await serviceClient.storage
      .from("exports")
      .createSignedUrl(filePath, 86400, { download: fileName });

    if (signedError || !signedData?.signedUrl) {
      console.error("Signed URL error:", signedError);
      return new Response(JSON.stringify({ error: "Failed to generate download URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`PDF uploaded to ${filePath}, signed URL generated`);

    return new Response(JSON.stringify({
      success: true,
      downloadUrl: signedData.signedUrl,
      fileName,
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
