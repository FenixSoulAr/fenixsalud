import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SummaryOptions {
  profileId: string;
  includeVisits?: boolean;
  includeTestAttachments?: boolean;
  includeProcedureAttachments?: boolean;
  language?: "en" | "es";
}

interface NotIncludedFile {
  fileName: string;
  mimeType: string;
  reason: string;
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

    // Create user client to verify auth
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

    // Parse request body
    const body = await req.json() as SummaryOptions;
    const { profileId, includeVisits, includeTestAttachments, includeProcedureAttachments, language = "es" } = body;

    if (!profileId) {
      return new Response(JSON.stringify({ error: "profileId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating PDF for profile ${profileId}, user ${user.id}`);

    // Create service client for privileged operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user has access to profile
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

    // Filter procedures
    const procedures = allProcedures.filter((p: any) => {
      if (p.type === "Surgery") return true;
      return new Date(p.date) >= twelveMonthsAgo;
    });

    const surgeries = procedures.filter((p: any) => p.type === "Surgery");
    const hospitalizations = procedures.filter((p: any) => p.type === "Hospitalization");
    const vaccines = procedures.filter((p: any) => p.type === "Vaccine");

    // Labels
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
      medication: "Medicación",
      dose: "Dosis",
      schedule: "Frecuencia",
      tests: "Estudios (últimos 12 meses)",
      noTests: "Sin estudios en los últimos 12 meses.",
      date: "Fecha",
      type: "Tipo",
      institution: "Institución",
      surgeries: "Cirugías (historial completo)",
      hospitalizations: "Internaciones (últimos 12 meses)",
      vaccines: "Vacunas (últimos 12 meses)",
      visits: "Consultas (últimos 12 meses)",
      noVisits: "Sin consultas en los últimos 12 meses.",
      doctor: "Médico",
      professional: "Profesional",
      reason: "Motivo",
      attachments: "Adjuntos",
      filesNotIncluded: "Archivos no incluidos en este PDF",
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
      medication: "Medication",
      dose: "Dose",
      schedule: "Schedule",
      tests: "Tests (last 12 months)",
      noTests: "No tests in the last 12 months.",
      date: "Date",
      type: "Type",
      institution: "Institution",
      surgeries: "Surgeries (full history)",
      hospitalizations: "Hospitalizations (last 12 months)",
      vaccines: "Vaccines (last 12 months)",
      visits: "Visits (last 12 months)",
      noVisits: "No visits in the last 12 months.",
      doctor: "Doctor",
      professional: "Professional",
      reason: "Reason",
      attachments: "Attachments",
      filesNotIncluded: "Files not included in this PDF",
    };

    // Helper: format professional string from a record
    const formatProfessional = (record: any): string | null => {
      if (record.professional_status !== "assigned" || !record.doctors?.full_name) return null;
      const name = record.doctors.full_name;
      const spec = record.doctors.specialty;
      return spec ? `${name} (${spec})` : name;
    };

    // Create base PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const pageWidth = 595.28; // A4
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
      if (currentY - needed < margin) {
        addNewPage();
      }
    };

    const drawText = (text: string, options: { bold?: boolean; size?: number; color?: any } = {}) => {
      const size = options.size || 10;
      const usedFont = options.bold ? boldFont : font;
      const color = options.color || rgb(0, 0, 0);
      
      checkSpace(lineHeight);
      page.drawText(text, { x: margin, y: currentY, size, font: usedFont, color });
      currentY -= lineHeight;
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
      year: "numeric", month: "long", day: "numeric" 
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

    // Medications section
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

    // Tests section
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

    // Track files not included
    const notIncludedFiles: NotIncludedFile[] = [];

    // Process attachments
    if (includeTestAttachments || includeProcedureAttachments) {
      const entityIds: string[] = [];
      const entityTypes: string[] = [];
      
      if (includeTestAttachments && tests.length > 0) {
        entityIds.push(...tests.map((t: any) => t.id));
        entityTypes.push("TestStudy");
      }
      if (includeProcedureAttachments && procedures.length > 0) {
        entityIds.push(...procedures.map((p: any) => p.id));
        entityTypes.push("Procedure");
      }

      if (entityIds.length > 0) {
        // Fetch attachments owned by this user
        const { data: attachments } = await serviceClient
          .from("file_attachments")
          .select("id, entity_id, entity_type, file_name, file_url, mime_type, user_id")
          .in("entity_id", entityIds)
          .in("entity_type", entityTypes);

        const validAttachments = (attachments || []).filter((a: any) => a.user_id === user.id);
        console.log(`Found ${validAttachments.length} attachments to process`);

        for (const attachment of validAttachments) {
          try {
            // Extract storage path
            let storagePath = attachment.file_url;
            if (storagePath.startsWith("http")) {
              const match = storagePath.match(/\/storage\/v1\/object\/(?:public|authenticated)\/health-files\/(.+)/);
              if (match) storagePath = match[1];
            }

            console.log(`Fetching attachment: ${attachment.file_name} from ${storagePath}`);

            // Download file
            const { data: fileData, error: storageError } = await serviceClient.storage
              .from("health-files")
              .download(storagePath);

            if (storageError || !fileData) {
              console.error(`Failed to download ${attachment.file_name}:`, storageError);
              notIncludedFiles.push({
                fileName: attachment.file_name,
                mimeType: attachment.mime_type || "unknown",
                reason: "Download failed",
              });
              continue;
            }

            const bytes = new Uint8Array(await fileData.arrayBuffer());
            const mimeType = attachment.mime_type || "";

            if (mimeType === "application/pdf") {
              // Merge PDF
              try {
                const attachmentPdf = await PDFDocument.load(bytes);
                const copiedPages = await pdfDoc.copyPages(attachmentPdf, attachmentPdf.getPageIndices());
                for (const copiedPage of copiedPages) {
                  pdfDoc.addPage(copiedPage);
                }
                console.log(`Merged PDF: ${attachment.file_name}`);
              } catch (pdfError) {
                console.error(`Failed to merge PDF ${attachment.file_name}:`, pdfError);
                notIncludedFiles.push({
                  fileName: attachment.file_name,
                  mimeType,
                  reason: "Invalid PDF format",
                });
              }
            } else if (mimeType.startsWith("image/")) {
              // Embed image as a page
              try {
                let image;
                if (mimeType === "image/png") {
                  image = await pdfDoc.embedPng(bytes);
                } else if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
                  image = await pdfDoc.embedJpg(bytes);
                } else {
                  // Unsupported image format
                  notIncludedFiles.push({
                    fileName: attachment.file_name,
                    mimeType,
                    reason: "Unsupported image format",
                  });
                  continue;
                }

                // Scale to fit A4
                const imgWidth = image.width;
                const imgHeight = image.height;
                const maxWidth = pageWidth - margin * 2;
                const maxHeight = pageHeight - margin * 2;
                
                let scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1);
                const scaledWidth = imgWidth * scale;
                const scaledHeight = imgHeight * scale;

                const imagePage = pdfDoc.addPage([pageWidth, pageHeight]);
                const x = (pageWidth - scaledWidth) / 2;
                const y = (pageHeight - scaledHeight) / 2;

                imagePage.drawImage(image, {
                  x,
                  y,
                  width: scaledWidth,
                  height: scaledHeight,
                });

                // Add filename caption
                imagePage.drawText(attachment.file_name, {
                  x: margin,
                  y: margin - 15,
                  size: 8,
                  font,
                  color: rgb(0.5, 0.5, 0.5),
                });

                console.log(`Embedded image: ${attachment.file_name}`);
              } catch (imgError) {
                console.error(`Failed to embed image ${attachment.file_name}:`, imgError);
                notIncludedFiles.push({
                  fileName: attachment.file_name,
                  mimeType,
                  reason: "Image processing failed",
                });
              }
            } else {
              // Unsupported file type
              notIncludedFiles.push({
                fileName: attachment.file_name,
                mimeType,
                reason: "Unsupported format",
              });
            }
          } catch (error) {
            console.error(`Error processing ${attachment.file_name}:`, error);
            notIncludedFiles.push({
              fileName: attachment.file_name,
              mimeType: attachment.mime_type || "unknown",
              reason: "Processing error",
            });
          }
        }
      }
    }

    // Add "Files not included" page if needed
    if (notIncludedFiles.length > 0) {
      const notIncludedPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;

      notIncludedPage.drawText(labels.filesNotIncluded, {
        x: margin,
        y,
        size: 14,
        font: boldFont,
        color: rgb(0.6, 0.4, 0),
      });
      y -= 25;

      for (const file of notIncludedFiles) {
        notIncludedPage.drawText(`• ${file.fileName} (${file.mimeType}) - ${file.reason}`, {
          x: margin,
          y,
          size: 10,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        y -= lineHeight;
        if (y < margin) break; // Prevent overflow
      }
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    console.log(`PDF generated: ${pdfBytes.length} bytes`);

    // Upload to exports bucket
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

    // Generate signed URL (24 hours)
    const { data: signedData, error: signedError } = await serviceClient.storage
      .from("exports")
      .createSignedUrl(filePath, 86400); // 24 hours

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
      notIncludedFiles: notIncludedFiles.length > 0 ? notIncludedFiles : undefined,
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
