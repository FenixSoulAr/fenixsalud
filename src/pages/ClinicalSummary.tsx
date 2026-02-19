import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowLeft, FileDown, Printer, Pill, FlaskConical, Syringe, Calendar, HeartPulse, Crown, Lock, Loader2, Download, CheckCircle2, Archive, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useEntitlementGate } from "@/hooks/useEntitlementGate";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { format, subMonths, isAfter } from "date-fns";
import { useTranslations, getLanguage } from "@/i18n";
import { groupMedicationsByDiagnosis } from "@/hooks/useMedicationsByDiagnosis";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { toast } from "sonner";

// Detect if running inside Capacitor (native mobile app)
function isCapacitorNative(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

export default function ClinicalSummary() {
  const { activeProfileId, isViewingOwnProfile } = useActiveProfile();
  const { canExportPdf, loading: entitlementsLoading } = useEntitlementGate();
  const { isPlus } = useEntitlementsContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const t = useTranslations();
  const lang = getLanguage();
  
  const [loading, setLoading] = useState(true);
  const [includeVisits, setIncludeVisits] = useState(false);
  
  // PDF generation states
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState<string | null>(null);
  
  // ZIP generation states
  const [generatingZip, setGeneratingZip] = useState(false);
  const [zipDownloadUrl, setZipDownloadUrl] = useState<string | null>(null);
  const [zipHasErrors, setZipHasErrors] = useState(false);
  
  // Data states
  const [profile, setProfile] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [testAttachments, setTestAttachments] = useState<Record<string, string[]>>({});
  const [procedures, setProcedures] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [procedureAttachments, setProcedureAttachments] = useState<Record<string, string[]>>({});
  const [totalAttachmentCount, setTotalAttachmentCount] = useState(0);

  const twelveMonthsAgo = subMonths(new Date(), 12);
  const twentyFourMonthsAgo = subMonths(new Date(), 24);

  useEffect(() => {
    if (activeProfileId) fetchAllData();
  }, [activeProfileId]);

  // Reset download URL when options change
  useEffect(() => {
    setDownloadUrl(null);
    setDownloadFileName(null);
  }, [includeVisits]);

  async function fetchAllData() {
    if (!activeProfileId) return;
    setLoading(true);
    
    const [profileRpcRes, medsRes, diagRes, testsRes, proceduresRes, appointmentsRes] = await Promise.all([
      supabase.rpc("get_profile_for_role", { _profile_id: activeProfileId }),
      supabase.from("medications").select("*").eq("profile_id", activeProfileId).eq("status", "Active").order("name"),
      supabase.from("diagnoses").select("*").eq("profile_id", activeProfileId),
      supabase.from("tests").select("*, institutions(name), doctors(full_name, specialty)").eq("profile_id", activeProfileId).order("date", { ascending: false }),
      supabase.from("procedures").select("*, institutions(name), doctors(full_name, specialty)").eq("profile_id", activeProfileId).order("date", { ascending: false }),
      supabase.from("appointments").select("*, doctors(full_name, specialty), institutions(name)").eq("profile_id", activeProfileId).order("datetime_start", { ascending: false }),
    ]);
    const profileRes = { data: profileRpcRes.data, error: profileRpcRes.error };

    setProfile(profileRes.data);
    setMedications(medsRes.data || []);
    setDiagnoses(diagRes.data || []);
    
    const allTests = testsRes.data || [];
    const recentTests = allTests.filter(t => isAfter(new Date(t.date), twelveMonthsAgo));
    setTests(recentTests);
    
    const allProcedures = proceduresRes.data || [];
    // Surgeries: full history. Hospitalizations: last 24 months. Vaccines: last 12 months.
    const filteredProcedures = allProcedures.filter(p => {
      if (p.type === "Surgery") return true;
      if (p.type === "Hospitalization") return isAfter(new Date(p.date), twentyFourMonthsAgo);
      return isAfter(new Date(p.date), twelveMonthsAgo);
    });
    setProcedures(filteredProcedures);
    
    // Fetch all attachments for tests and procedures
    const entityIds = [
      ...recentTests.map(t => t.id),
      ...filteredProcedures.map(p => p.id),
    ];
    
    if (entityIds.length > 0) {
      const { data: attachments } = await supabase
        .from("file_attachments")
        .select("id, entity_id, entity_type, file_name")
        .in("entity_type", ["TestStudy", "Procedure"])
        .in("entity_id", entityIds);
      
      const testAttMap: Record<string, string[]> = {};
      const procAttMap: Record<string, string[]> = {};
      let count = 0;
      (attachments || []).forEach(att => {
        count++;
        if (att.entity_type === "TestStudy") {
          if (!testAttMap[att.entity_id]) testAttMap[att.entity_id] = [];
          testAttMap[att.entity_id].push(att.file_name);
        } else {
          if (!procAttMap[att.entity_id]) procAttMap[att.entity_id] = [];
          procAttMap[att.entity_id].push(att.file_name);
        }
      });
      setTestAttachments(testAttMap);
      setProcedureAttachments(procAttMap);
      setTotalAttachmentCount(count);
    } else {
      setTestAttachments({});
      setProcedureAttachments({});
      setTotalAttachmentCount(0);
    }
    
    const allAppointments = appointmentsRes.data || [];
    const recentAppointments = allAppointments.filter(a => 
      isAfter(new Date(a.datetime_start), twelveMonthsAgo)
    );
    setAppointments(recentAppointments);
    
    setLoading(false);
  }

  const isNativeMobile = useMemo(() => isCapacitorNative(), []);

  function handlePrint() {
    if (isNativeMobile) {
      handleGenerateFullPdf();
    } else {
      window.print();
    }
  }

  function handleSaveAsPDF() {
    if (isNativeMobile) {
      handleGenerateFullPdf();
    } else {
      window.print();
    }
  }

  async function handleGenerateFullPdf() {
    if (!activeProfileId) return;
    
    setGeneratingPdf(true);
    setDownloadUrl(null);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        toast.error(lang === "es" ? "Sesión no disponible" : "Session not available");
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const functionUrl = `https://${projectId}.supabase.co/functions/v1/generate-clinical-summary-pdf`;

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: activeProfileId,
          includeVisits,
          language: lang,
        }),
      });

      if (!response.ok) {
        let errorMsg = lang === "es" ? "Error al generar el PDF" : "Failed to generate PDF";
        try {
          const errJson = await response.json();
          if (errJson.error) errorMsg = errJson.error;
        } catch { /* ignore */ }
        toast.error(errorMsg);
        return;
      }

      const result = await response.json();
      
      if (result.success && result.downloadUrl) {
        if (isNativeMobile) {
          // Force direct download via location assign (same as ZIP)
          window.location.assign(result.downloadUrl);
          toast.success(lang === "es" ? "PDF descargado" : "PDF downloaded");
        } else {
          setDownloadUrl(result.downloadUrl);
          setDownloadFileName(result.fileName);
          toast.success(lang === "es" ? "PDF generado correctamente" : "PDF generated successfully");
        }
      } else {
        toast.error(lang === "es" ? "Error al generar el PDF" : "Failed to generate PDF");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(lang === "es" ? "Error al generar el PDF" : "Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleDownloadAttachmentsZip() {
    if (!activeProfileId) return;
    
    setGeneratingZip(true);
    setZipDownloadUrl(null);
    setZipHasErrors(false);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        toast.error(lang === "es" ? "Sesión no disponible" : "Session not available");
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const functionUrl = `https://${projectId}.supabase.co/functions/v1/download-attachments-zip`;

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: activeProfileId,
          language: lang,
        }),
      });

      if (!response.ok) {
        let errorMsg = lang === "es" ? "Error al generar el ZIP" : "Failed to generate ZIP";
        try {
          const errJson = await response.json();
          if (errJson.error) errorMsg = errJson.error;
        } catch { /* ignore */ }
        toast.error(errorMsg);
        return;
      }

      const result = await response.json();
      
      if (result.success && result.downloadUrl) {
        setZipDownloadUrl(result.downloadUrl);
        setZipHasErrors(result.hasErrors || false);
        
        if (result.hasErrors) {
          toast.warning(
            lang === "es" 
              ? "ZIP generado. Algunos adjuntos no pudieron incluirse (ver ERRORES.txt dentro del ZIP)."
              : "ZIP generated. Some attachments could not be included (see ERRORS.txt inside the ZIP)."
          );
        } else {
          toast.success(
            lang === "es" 
              ? `ZIP generado con ${result.successCount} archivo(s)` 
              : `ZIP generated with ${result.successCount} file(s)`
          );
        }
      } else {
        toast.error(lang === "es" ? "Error al generar el ZIP" : "Failed to generate ZIP");
      }
    } catch (error) {
      console.error("Error generating ZIP:", error);
      toast.error(lang === "es" ? "Error al generar el ZIP" : "Failed to generate ZIP");
    } finally {
      setGeneratingZip(false);
    }
  }

  if (loading || entitlementsLoading) return <LoadingPage />;

  if (!canExportPdf) {
    return (
      <div className="animate-fade-in">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />{t.actions.back}
        </Button>
        <div className="max-w-lg mx-auto text-center py-12">
          <Crown className="h-16 w-16 mx-auto mb-4 text-amber-500" />
          <h2 className="text-xl font-semibold mb-2">
            {lang === "es" ? "Esta función está disponible en Plus" : "This feature is available in Plus"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {lang === "es" 
              ? "Free es para organizar tu propia salud. Plus te permite compartir, exportar y cuidar a otros."
              : "Free is for organizing your own health. Plus lets you share, export, and care for others."}
          </p>
          <Button onClick={() => navigate("/pricing?highlight=plus")}>
            {lang === "es" ? "Ver planes" : "See plans"}
          </Button>
        </div>
      </div>
    );
  }

  const todayFormatted = format(new Date(), "dd/MM/yyyy");
  const todayLong = format(new Date(), "MMMM d, yyyy");
  const fullName = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || t.misc.patient;

  /** Returns professional string or null if unassigned */
  const formatProfessional = (record: any): string | null => {
    if (record.professional_status !== "assigned" || !record.doctors?.full_name) return null;
    const name = record.doctors.full_name;
    const spec = record.doctors.specialty;
    return spec ? `${name} (${spec})` : name;
  };

  /** Returns institution · professional secondary line, or null */
  const formatSecondaryLine = (record: any): string | null => {
    const parts: string[] = [];
    if (record.institutions?.name) parts.push(record.institutions.name);
    const prof = formatProfessional(record);
    if (prof) parts.push(prof);
    return parts.length > 0 ? parts.join(" · ") : null;
  };

  const surgeries = procedures.filter(p => p.type === "Surgery");
  const hospitalizations = procedures.filter(p => p.type === "Hospitalization");
  const vaccines = procedures.filter(p => p.type === "Vaccine");
  const medicationGroups = groupMedicationsByDiagnosis(medications, diagnoses);

  return (
    <div className="animate-fade-in">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 print:hidden">
        <ArrowLeft className="h-4 w-4 mr-2" />{t.actions.back}
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">{t.clinicalSummary.title}</h1>
          <p className="text-muted-foreground">{t.clinicalSummary.generatedOn} {todayLong}</p>
          {isNativeMobile && (
            <p className="text-sm text-muted-foreground mt-1">
              {lang === "es"
                ? "En la app Android: usá el botón PDF (arriba a la derecha) para guardar el resumen."
                : "On the Android app: use the PDF button (top right) to save the summary."}
            </p>
          )}
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-3">
          {/* PDF export action – hidden on Android APK */}
          {!isNativeMobile && (
            <div className="flex flex-col gap-1">
              <Button onClick={handleSaveAsPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                {t.clinicalSummary.exportPdf}
              </Button>
              <p className="text-xs text-muted-foreground text-right">
                {t.clinicalSummary.saveAsPDFHelper}
              </p>
            </div>
          )}

          {/* ZIP attachments action */}
          {totalAttachmentCount > 0 && (
            <div className="flex flex-col gap-1">
              {zipDownloadUrl ? (
                <Button 
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    if (zipDownloadUrl?.startsWith("https://")) window.location.assign(zipDownloadUrl);
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {lang === "es" ? "Descargar ZIP" : "Download ZIP"}
                </Button>
              ) : (
                <Button variant="outline" onClick={handleDownloadAttachmentsZip} disabled={generatingZip}>
                  {generatingZip ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {lang === "es" ? "Preparando ZIP…" : "Preparing ZIP…"}
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 mr-2" />
                      {t.clinicalSummary.downloadAttachmentsZip} ({totalAttachmentCount})
                    </>
                  )}
                </Button>
              )}
              <p className="text-xs text-muted-foreground text-right">
                {t.clinicalSummary.downloadAttachmentsZipHelper}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Options toggles */}
      <div className="flex flex-col gap-3 mb-6 print:hidden">
        <div className="flex items-center gap-2">
          <Checkbox 
            id="include-visits" 
            checked={includeVisits} 
            onCheckedChange={(checked) => setIncludeVisits(checked === true)} 
          />
          <Label htmlFor="include-visits" className="text-sm cursor-pointer">
            {t.clinicalSummary.includeVisits}
          </Label>
        </div>
      </div>

      {/* Success states */}
      {downloadUrl && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              {lang === "es" ? "PDF listo para descargar" : "PDF ready for download"}
            </p>
          </div>
          <p className="text-xs text-green-700 dark:text-green-400 mt-1">
            {lang === "es" ? "El link expira en 24 horas" : "Link expires in 24 hours"}
          </p>
        </div>
      )}

      {zipDownloadUrl && (
        <div className={`mb-4 p-4 rounded-lg print:hidden border ${
          zipHasErrors 
            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" 
            : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
        }`}>
          <div className="flex items-center gap-2">
            {zipHasErrors ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            )}
            <p className={`text-sm font-medium ${
              zipHasErrors 
                ? "text-amber-800 dark:text-amber-300" 
                : "text-green-800 dark:text-green-300"
            }`}>
              {zipHasErrors 
                ? (lang === "es" ? "ZIP generado con advertencias" : "ZIP generated with warnings")
                : (lang === "es" ? "ZIP listo para descargar" : "ZIP ready for download")
              }
            </p>
          </div>
          {zipHasErrors && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              {lang === "es" 
                ? "Algunos adjuntos no pudieron incluirse. Revisa ERRORES.txt dentro del ZIP."
                : "Some attachments could not be included. Check ERRORS.txt inside the ZIP."}
            </p>
          )}
        </div>
      )}

      {/* Printable Content */}
      <div ref={printRef} className="clinical-print-area max-w-3xl">
        {/* Repeating print header on all pages */}
        <table className="clinical-print-table w-full">
          <thead className="clinical-repeating-header">
            <tr>
              <th className="font-normal text-left p-0">
                <div className="clinical-print-header-row flex items-center justify-between pb-2 mb-3 border-b border-muted-foreground/30">
                  <div className="flex items-center gap-2">
                    <img src="/favicon-48x48.png" alt="Mi Salud" className="h-5 w-5 rounded object-contain" />
                    <span className="text-xs font-medium">Mi Salud — {t.clinicalSummary.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{fullName} · {todayFormatted}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="p-0">

        <div className="space-y-6">

        {/* Patient Info */}
        <div className="clinical-section">
          <h1 className="text-2xl font-bold mb-1">{fullName}</h1>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mt-3">
            {profile?.national_id && (
              <div><span className="font-medium">{t.clinicalSummary.nationalId}:</span> {profile.national_id}</div>
            )}
            {profile?.phone && (
              <div><span className="font-medium">{t.clinicalSummary.phone}:</span> {profile.phone}</div>
            )}
            {isViewingOwnProfile && user?.email && (
              <div><span className="font-medium">{t.clinicalSummary.email}:</span> {user.email}</div>
            )}
            {profile?.insurance_provider && (
              <div>
                <span className="font-medium">{t.clinicalSummary.insurance}:</span> {profile.insurance_provider}
                {profile.insurance_plan && ` - ${profile.insurance_plan}`}
                {profile.insurance_member_id && ` (ID: ${profile.insurance_member_id})`}
              </div>
            )}
          </div>
          
          {profile?.allergies && (
            <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <span className="font-medium text-destructive">{t.clinicalSummary.allergies}:</span>
              <span className="ml-2 text-destructive/80">{profile.allergies}</span>
            </div>
          )}
          
          {profile?.notes && (
            <div className="mt-3 text-sm">
              <span className="font-medium">{t.clinicalSummary.notes}:</span> {profile.notes}
            </div>
          )}
        </div>

        {/* Current Medications - Grouped by Diagnosis */}
        <div className="clinical-section">
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3 border-b border-border pb-2">
            <Pill className="h-5 w-5" />{t.clinicalSummary.currentMedications}
          </h2>
          {medications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.clinicalSummary.noActiveMedications}</p>
          ) : (
            <div className="space-y-4">
              {medicationGroups.map((group) => (
                <div key={group.diagnosis?.id || "unlinked"} className="clinical-item">
                  <div className="flex items-center gap-2 mb-2">
                    <HeartPulse className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {group.diagnosis 
                        ? `${group.diagnosis.condition}${group.diagnosis.status === "resolved" ? ` (${t.diagnoses.resolved})` : ""}`
                        : t.dashboard.unlinkedNoDiagnosis
                      }
                    </span>
                  </div>
                  <div className="border rounded-lg overflow-hidden print:shadow-none">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-2 px-3 font-medium">{t.clinicalSummary.medication}</th>
                          <th className="text-left py-2 px-3 font-medium">{t.clinicalSummary.dose}</th>
                          <th className="text-left py-2 px-3 font-medium">{t.clinicalSummary.schedule}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.medications.map(m => (
                          <tr key={m.id} className="border-b last:border-0">
                            <td className="py-2 px-3">{m.name}</td>
                            <td className="py-2 px-3">{m.dose_text}</td>
                            <td className="py-2 px-3">{m.schedule_type === "Daily" ? t.medications.daily : m.schedule_type === "Weekly" ? t.medications.weekly : t.medications.asNeeded}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tests (Last 12 months) */}
        <div className="clinical-section">
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3 border-b border-border pb-2">
            <FlaskConical className="h-5 w-5" />{t.clinicalSummary.testsLast12}
            <span className="text-sm font-normal text-muted-foreground">({t.clinicalSummary.last12months})</span>
          </h2>
          {tests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.clinicalSummary.noTestsLast12}</p>
          ) : (
            <div className="space-y-2">
              {tests.map(test => {
                const secondary = formatSecondaryLine(test);
                return (
                  <div key={test.id} className="clinical-item border-b border-border/50 pb-2 last:border-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-sm">{test.type}</span>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(test.date), "dd/MM/yyyy")}</span>
                    </div>
                    {secondary && (
                      <p className="text-xs text-muted-foreground mt-0.5">{secondary}</p>
                    )}
                    {testAttachments[test.id]?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        📎 {testAttachments[test.id].join(", ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Procedures */}
        <div className="clinical-section">
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3 border-b border-border pb-2">
            <Syringe className="h-5 w-5" />{t.nav.procedures}
          </h2>
          
          {surgeries.length > 0 && (
            <div className="mb-4 clinical-item">
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">{t.clinicalSummary.surgeriesFullHistory}</h3>
              <div className="space-y-2">
                {surgeries.map(p => {
                  const secondary = formatSecondaryLine(p);
                  return (
                    <div key={p.id} className="clinical-item border-b border-border/50 pb-2 last:border-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-sm">{p.title}</span>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(p.date), "dd/MM/yyyy")}</span>
                      </div>
                      {secondary && (
                        <p className="text-xs text-muted-foreground mt-0.5">{secondary}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {hospitalizations.length > 0 && (
            <div className="mb-4 clinical-item">
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">
                {t.clinicalSummary.hospitalizationsLast12}
                <span className="text-xs ml-1">({lang === "es" ? "últimos 24 meses" : "last 24 months"})</span>
              </h3>
              <div className="space-y-2">
                {hospitalizations.map(p => {
                  const secondary = formatSecondaryLine(p);
                  return (
                    <div key={p.id} className="clinical-item border-b border-border/50 pb-2 last:border-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-sm">{p.title}</span>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(p.date), "dd/MM/yyyy")}</span>
                      </div>
                      {secondary && (
                        <p className="text-xs text-muted-foreground mt-0.5">{secondary}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {vaccines.length > 0 && (
            <div className="mb-4 clinical-item">
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">{t.clinicalSummary.vaccinesLast12}</h3>
              <div className="space-y-2">
                {vaccines.map(p => {
                  const secondary = formatSecondaryLine(p);
                  return (
                    <div key={p.id} className="clinical-item border-b border-border/50 pb-2 last:border-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-sm">{p.title}</span>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(p.date), "dd/MM/yyyy")}</span>
                      </div>
                      {secondary && (
                        <p className="text-xs text-muted-foreground mt-0.5">{secondary}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {surgeries.length === 0 && hospitalizations.length === 0 && vaccines.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.clinicalSummary.noProcedures}</p>
          )}
        </div>

        {/* Visits (Optional) */}
        {includeVisits && (
          <div className="clinical-section">
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3 border-b border-border pb-2">
              <Calendar className="h-5 w-5" />{t.clinicalSummary.visitsLast12}
              <span className="text-sm font-normal text-muted-foreground">({t.clinicalSummary.last12months})</span>
            </h2>
            {appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.clinicalSummary.noVisitsLast12}</p>
            ) : (
              <div className="space-y-2">
                {appointments.map(a => {
                  const secondary = formatSecondaryLine(a);
                  return (
                    <div key={a.id} className="clinical-item border-b border-border/50 pb-2 last:border-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-sm">{a.reason || "—"}</span>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(a.datetime_start), "dd/MM/yyyy")}</span>
                      </div>
                      {secondary && (
                        <p className="text-xs text-muted-foreground mt-0.5">{secondary}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Available Attachments listing (print-visible) */}
        {totalAttachmentCount > 0 && (
          <div className="clinical-section">
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3 border-b border-border pb-2">
              <Archive className="h-5 w-5" />{t.clinicalSummary.availableAttachments}
              <span className="text-sm font-normal text-muted-foreground">({totalAttachmentCount})</span>
            </h2>
            
            {/* Tests with attachments */}
            {tests.some(test => testAttachments[test.id]?.length > 0) && (
              <div className="mb-3 clinical-item">
                <h3 className="text-sm font-medium mb-1 text-muted-foreground">{t.clinicalSummary.testsLast12}</h3>
                <div className="space-y-1 text-sm">
                  {tests.filter(test => testAttachments[test.id]?.length > 0).map(test => (
                    <div key={test.id}>
                      <span className="font-medium">{format(new Date(test.date), "dd/MM/yyyy")} — {test.type}</span>
                      <ul className="ml-4 text-xs text-muted-foreground">
                        {testAttachments[test.id].map((fname, i) => (
                          <li key={i}>→ {fname}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Procedures with attachments */}
            {procedures.some(p => procedureAttachments[p.id]?.length > 0) && (
              <div className="mb-3 clinical-item">
                <h3 className="text-sm font-medium mb-1 text-muted-foreground">{t.nav.procedures}</h3>
                <div className="space-y-1 text-sm">
                  {procedures.filter(p => procedureAttachments[p.id]?.length > 0).map(p => (
                    <div key={p.id}>
                      <span className="font-medium">{format(new Date(p.date), "dd/MM/yyyy")} — {p.title}</span>
                      <ul className="ml-4 text-xs text-muted-foreground">
                        {procedureAttachments[p.id].map((fname, i) => (
                          <li key={i}>→ {fname}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
        {/* Close space-y-6 wrapper */}

            </td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
