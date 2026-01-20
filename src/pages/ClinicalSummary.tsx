import { useState, useEffect, useRef } from "react";
import { ArrowLeft, FileDown, Printer, Pill, FlaskConical, Syringe, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { format, subMonths, isAfter } from "date-fns";
import { useTranslations } from "@/i18n";

export default function ClinicalSummary() {
  const { activeProfileOwnerId, isViewingOwnProfile } = useActiveProfile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const t = useTranslations();
  
  const [loading, setLoading] = useState(true);
  const [includeVisits, setIncludeVisits] = useState(false);
  
  // Data states
  const [profile, setProfile] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [testAttachments, setTestAttachments] = useState<Record<string, string[]>>({});
  const [procedures, setProcedures] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  const twelveMonthsAgo = subMonths(new Date(), 12);

  useEffect(() => {
    if (activeProfileOwnerId) fetchAllData();
  }, [activeProfileOwnerId]);

  async function fetchAllData() {
    if (!activeProfileOwnerId) return;
    setLoading(true);
    
    const [profileRes, medsRes, testsRes, proceduresRes, appointmentsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", activeProfileOwnerId).maybeSingle(),
      supabase.from("medications").select("*").eq("user_id", activeProfileOwnerId).eq("status", "Active").order("name"),
      supabase.from("tests").select("*, institutions(name)").eq("user_id", activeProfileOwnerId).order("date", { ascending: false }),
      supabase.from("procedures").select("*, institutions(name), doctors(full_name)").eq("user_id", activeProfileOwnerId).order("date", { ascending: false }),
      supabase.from("appointments").select("*, doctors(full_name), institutions(name)").eq("user_id", activeProfileOwnerId).order("datetime_start", { ascending: false }),
    ]);

    setProfile(profileRes.data);
    setMedications(medsRes.data || []);
    
    // Filter tests to last 12 months
    const allTests = testsRes.data || [];
    const recentTests = allTests.filter(t => isAfter(new Date(t.date), twelveMonthsAgo));
    setTests(recentTests);
    
    // Fetch test attachments
    if (recentTests.length > 0) {
      const { data: attachments } = await supabase
        .from("file_attachments")
        .select("entity_id, file_name")
        .eq("entity_type", "TestStudy")
        .in("entity_id", recentTests.map(t => t.id));
      
      const attachMap: Record<string, string[]> = {};
      (attachments || []).forEach(att => {
        if (!attachMap[att.entity_id]) attachMap[att.entity_id] = [];
        attachMap[att.entity_id].push(att.file_name);
      });
      setTestAttachments(attachMap);
    }
    
    // Filter procedures based on type rules
    const allProcedures = proceduresRes.data || [];
    const filteredProcedures = allProcedures.filter(p => {
      if (p.type === "Surgery") return true; // Full history
      // Hospitalizations and Vaccines: last 12 months only
      return isAfter(new Date(p.date), twelveMonthsAgo);
    });
    setProcedures(filteredProcedures);
    
    // Filter appointments to last 12 months
    const allAppointments = appointmentsRes.data || [];
    const recentAppointments = allAppointments.filter(a => 
      isAfter(new Date(a.datetime_start), twelveMonthsAgo)
    );
    setAppointments(recentAppointments);
    
    setLoading(false);
  }

  function handlePrint() {
    window.print();
  }

  function handleSaveAsPDF() {
    window.print();
  }

  if (loading) return <LoadingPage />;

  const today = format(new Date(), "MMMM d, yyyy");
  const fullName = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || t.misc.patient;

  // Group procedures by type for display
  const surgeries = procedures.filter(p => p.type === "Surgery");
  const hospitalizations = procedures.filter(p => p.type === "Hospitalization");
  const vaccines = procedures.filter(p => p.type === "Vaccine");

  return (
    <div className="animate-fade-in">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 print:hidden">
        <ArrowLeft className="h-4 w-4 mr-2" />{t.actions.back}
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">{t.clinicalSummary.title}</h1>
          <p className="text-muted-foreground">{t.clinicalSummary.generatedOn} {today}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />{t.actions.print}
            </Button>
            <Button onClick={handleSaveAsPDF}>
              <FileDown className="h-4 w-4 mr-2" />{t.actions.saveAsPDF}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.clinicalSummary.saveAsPDFHelper}
          </p>
        </div>
      </div>

      {/* Visits toggle */}
      <div className="flex items-center gap-2 mb-6 print:hidden">
        <Checkbox 
          id="include-visits" 
          checked={includeVisits} 
          onCheckedChange={(checked) => setIncludeVisits(checked === true)} 
        />
        <Label htmlFor="include-visits" className="text-sm cursor-pointer">
          {t.clinicalSummary.includeVisits}
        </Label>
      </div>

      {/* Printable Content */}
      <div ref={printRef} className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="health-card print:shadow-none print:border">
          <h1 className="text-2xl font-bold mb-1">{fullName}</h1>
          <p className="text-sm text-muted-foreground mb-4">{t.clinicalSummary.generatedOn}: {today}</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
              <span className="font-medium text-red-800 dark:text-red-300">{t.clinicalSummary.allergies}:</span>
              <span className="ml-2 text-red-700 dark:text-red-400">{profile.allergies}</span>
            </div>
          )}
          
          {profile?.notes && (
            <div className="mt-3 text-sm">
              <span className="font-medium">{t.clinicalSummary.notes}:</span> {profile.notes}
            </div>
          )}
        </div>

        {/* Current Medications */}
        <div className="section">
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
            <Pill className="h-5 w-5" />{t.clinicalSummary.currentMedications}
          </h2>
          {medications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.clinicalSummary.noActiveMedications}</p>
          ) : (
            <div className="health-card print:shadow-none print:border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">{t.clinicalSummary.medication}</th>
                    <th className="text-left py-2 font-medium">{t.clinicalSummary.dose}</th>
                    <th className="text-left py-2 font-medium">{t.clinicalSummary.schedule}</th>
                  </tr>
                </thead>
                <tbody>
                  {medications.map(m => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2">{m.name}</td>
                      <td className="py-2">{m.dose_text}</td>
                      <td className="py-2">{m.schedule_type}{m.times?.length ? ` (${m.times.join(", ")})` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tests (Last 12 months) */}
        <div className="section">
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
            <FlaskConical className="h-5 w-5" />{t.clinicalSummary.testsLast12} <span className="text-sm font-normal text-muted-foreground">{t.clinicalSummary.last12months}</span>
          </h2>
          {tests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.clinicalSummary.noTestsLast12}</p>
          ) : (
            <div className="health-card print:shadow-none print:border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">{t.clinicalSummary.date}</th>
                    <th className="text-left py-2 font-medium">{t.clinicalSummary.type}</th>
                    <th className="text-left py-2 font-medium">{t.clinicalSummary.institution}</th>
                    <th className="text-left py-2 font-medium">{t.clinicalSummary.files}</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map(test => (
                    <tr key={test.id} className="border-b last:border-0">
                      <td className="py-2">{format(new Date(test.date), "MMM d, yyyy")}</td>
                      <td className="py-2">{test.type}</td>
                      <td className="py-2">{test.institutions?.name || "—"}</td>
                      <td className="py-2">
                        {testAttachments[test.id]?.length ? (
                          <span className="text-xs text-muted-foreground">
                            {testAttachments[test.id].join(", ")}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Procedures */}
        <div className="section">
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
            <Syringe className="h-5 w-5" />{t.nav.procedures}
          </h2>
          
          {/* Surgeries - Full History */}
          {surgeries.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">{t.clinicalSummary.surgeriesFullHistory}</h3>
              <div className="health-card print:shadow-none print:border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">{t.clinicalSummary.date}</th>
                      <th className="text-left py-2 font-medium">{t.clinicalSummary.procedure}</th>
                      <th className="text-left py-2 font-medium">{t.clinicalSummary.institution}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surgeries.map(p => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2">{format(new Date(p.date), "MMM d, yyyy")}</td>
                        <td className="py-2">{p.title}</td>
                        <td className="py-2">{p.institutions?.name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Hospitalizations - Last 12 months */}
          {hospitalizations.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">{t.clinicalSummary.hospitalizationsLast12}</h3>
              <div className="health-card print:shadow-none print:border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">{t.clinicalSummary.date}</th>
                      <th className="text-left py-2 font-medium">{t.clinicalSummary.reason}</th>
                      <th className="text-left py-2 font-medium">{t.clinicalSummary.institution}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hospitalizations.map(p => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2">{format(new Date(p.date), "MMM d, yyyy")}</td>
                        <td className="py-2">{p.title}</td>
                        <td className="py-2">{p.institutions?.name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Vaccines - Last 12 months */}
          {vaccines.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">{t.clinicalSummary.vaccinesLast12}</h3>
              <div className="health-card print:shadow-none print:border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">{t.clinicalSummary.date}</th>
                      <th className="text-left py-2 font-medium">{t.procedures.vaccine}</th>
                      <th className="text-left py-2 font-medium">{t.clinicalSummary.institution}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vaccines.map(p => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2">{format(new Date(p.date), "MMM d, yyyy")}</td>
                        <td className="py-2">{p.title}</td>
                        <td className="py-2">{p.institutions?.name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {surgeries.length === 0 && hospitalizations.length === 0 && vaccines.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.clinicalSummary.noProcedures}</p>
          )}
        </div>

        {/* Visits (Optional) */}
        {includeVisits && (
          <div className="section">
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
              <Calendar className="h-5 w-5" />{t.clinicalSummary.visitsLast12} <span className="text-sm font-normal text-muted-foreground">{t.clinicalSummary.last12months}</span>
            </h2>
            {appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.clinicalSummary.noVisitsLast12}</p>
            ) : (
              <div className="health-card print:shadow-none print:border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">{t.clinicalSummary.date}</th>
                      <th className="text-left py-2 font-medium">{t.clinicalSummary.reason}</th>
                      <th className="text-left py-2 font-medium">{t.clinicalSummary.doctor}</th>
                      <th className="text-left py-2 font-medium">{t.clinicalSummary.institution}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map(a => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="py-2">{format(new Date(a.datetime_start), "MMM d, yyyy")}</td>
                        <td className="py-2">{a.reason || "—"}</td>
                        <td className="py-2">{a.doctors?.full_name || "—"}</td>
                        <td className="py-2">{a.institutions?.name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
