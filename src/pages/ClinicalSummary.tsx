import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Download, Printer, FileText, Pill, FlaskConical, Syringe, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { format, subMonths, isAfter } from "date-fns";
import { toast } from "sonner";

export default function ClinicalSummary() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  
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
    if (user) fetchAllData();
  }, [user]);

  async function fetchAllData() {
    setLoading(true);
    
    const [profileRes, medsRes, testsRes, proceduresRes, appointmentsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle(),
      supabase.from("medications").select("*").eq("status", "Active").order("name"),
      supabase.from("tests").select("*, institutions(name)").order("date", { ascending: false }),
      supabase.from("procedures").select("*, institutions(name), doctors(full_name)").order("date", { ascending: false }),
      supabase.from("appointments").select("*, doctors(full_name), institutions(name)").order("datetime_start", { ascending: false }),
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

  async function handleDownloadPDF() {
    toast.info("Preparing PDF for download...");
    
    // Use browser print to PDF functionality
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Could not open print window. Please allow popups.");
      return;
    }
    
    const content = printRef.current?.innerHTML || '';
    const styles = `
      <style>
        * { font-family: system-ui, -apple-system, sans-serif; }
        body { padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
        h3 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        p, li { font-size: 13px; line-height: 1.5; }
        .text-muted { color: #6b7280; }
        .section { margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb; }
        th { font-weight: 600; background: #f9fafb; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 500; }
        .badge-green { background: #dcfce7; color: #166534; }
        .badge-amber { background: #fef3c7; color: #92400e; }
        .badge-red { background: #fee2e2; color: #991b1b; }
        @media print { body { padding: 20px; } }
      </style>
    `;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>Clinical Summary - ${profile?.full_name || 'Patient'}</title>${styles}</head>
        <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    
    // Wait for content to load then trigger print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }

  if (loading) return <LoadingPage />;

  const today = format(new Date(), "MMMM d, yyyy");
  const fullName = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Patient";

  // Group procedures by type for display
  const surgeries = procedures.filter(p => p.type === "Surgery");
  const hospitalizations = procedures.filter(p => p.type === "Hospitalization");
  const vaccines = procedures.filter(p => p.type === "Vaccine");

  return (
    <div className="animate-fade-in">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 print:hidden">
        <ArrowLeft className="h-4 w-4 mr-2" />Back
      </Button>

      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Clinical Summary</h1>
          <p className="text-muted-foreground">Generated on {today}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />Print
          </Button>
          <Button onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-2" />Download PDF
          </Button>
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
          Include visits from the last 12 months
        </Label>
      </div>

      {/* Printable Content */}
      <div ref={printRef} className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="health-card print:shadow-none print:border">
          <h1 className="text-2xl font-bold mb-1">{fullName}</h1>
          <p className="text-sm text-muted-foreground mb-4">Generated on: {today}</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {profile?.national_id && (
              <div><span className="font-medium">National ID:</span> {profile.national_id}</div>
            )}
            {profile?.phone && (
              <div><span className="font-medium">Phone:</span> {profile.phone}</div>
            )}
            {user?.email && (
              <div><span className="font-medium">Email:</span> {user.email}</div>
            )}
            {profile?.insurance_provider && (
              <div>
                <span className="font-medium">Insurance:</span> {profile.insurance_provider}
                {profile.insurance_plan && ` - ${profile.insurance_plan}`}
                {profile.insurance_member_id && ` (ID: ${profile.insurance_member_id})`}
              </div>
            )}
          </div>
          
          {profile?.allergies && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
              <span className="font-medium text-red-800 dark:text-red-300">Allergies:</span>
              <span className="ml-2 text-red-700 dark:text-red-400">{profile.allergies}</span>
            </div>
          )}
          
          {profile?.notes && (
            <div className="mt-3 text-sm">
              <span className="font-medium">Notes:</span> {profile.notes}
            </div>
          )}
        </div>

        {/* Current Medications */}
        <div className="section">
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
            <Pill className="h-5 w-5" />Current Medications
          </h2>
          {medications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active medications.</p>
          ) : (
            <div className="health-card print:shadow-none print:border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Medication</th>
                    <th className="text-left py-2 font-medium">Dose</th>
                    <th className="text-left py-2 font-medium">Schedule</th>
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
            <FlaskConical className="h-5 w-5" />Tests <span className="text-sm font-normal text-muted-foreground">(last 12 months)</span>
          </h2>
          {tests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tests in the last 12 months.</p>
          ) : (
            <div className="health-card print:shadow-none print:border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-left py-2 font-medium">Type</th>
                    <th className="text-left py-2 font-medium">Institution</th>
                    <th className="text-left py-2 font-medium">Files</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map(t => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-2">{format(new Date(t.date), "MMM d, yyyy")}</td>
                      <td className="py-2">{t.type}</td>
                      <td className="py-2">{t.institutions?.name || "—"}</td>
                      <td className="py-2">
                        {testAttachments[t.id]?.length ? (
                          <span className="text-xs text-muted-foreground">
                            {testAttachments[t.id].join(", ")}
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
            <Syringe className="h-5 w-5" />Procedures
          </h2>
          
          {/* Surgeries - Full History */}
          {surgeries.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">Surgeries (full history)</h3>
              <div className="health-card print:shadow-none print:border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Date</th>
                      <th className="text-left py-2 font-medium">Procedure</th>
                      <th className="text-left py-2 font-medium">Institution</th>
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
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">Hospitalizations (last 12 months)</h3>
              <div className="health-card print:shadow-none print:border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Date</th>
                      <th className="text-left py-2 font-medium">Reason</th>
                      <th className="text-left py-2 font-medium">Institution</th>
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
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">Vaccines (last 12 months)</h3>
              <div className="health-card print:shadow-none print:border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Date</th>
                      <th className="text-left py-2 font-medium">Vaccine</th>
                      <th className="text-left py-2 font-medium">Institution</th>
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
            <p className="text-sm text-muted-foreground">No procedures recorded.</p>
          )}
        </div>

        {/* Visits (Optional) */}
        {includeVisits && (
          <div className="section">
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
              <Calendar className="h-5 w-5" />Visits <span className="text-sm font-normal text-muted-foreground">(last 12 months)</span>
            </h2>
            {appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visits in the last 12 months.</p>
            ) : (
              <div className="health-card print:shadow-none print:border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Date</th>
                      <th className="text-left py-2 font-medium">Reason</th>
                      <th className="text-left py-2 font-medium">Doctor</th>
                      <th className="text-left py-2 font-medium">Institution</th>
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
