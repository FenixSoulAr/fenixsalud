import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Plus, Calendar, FlaskConical, Pill, Bell, Clock, ArrowRight, FileText, HeartPulse, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, normalizeStatus } from "@/components/ui/status-badge";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { OrientationBanner } from "@/components/onboarding/OrientationBanner";
import { useOnboarding } from "@/hooks/useOnboarding";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { groupMedicationsByDiagnosis, DiagnosisGroup } from "@/hooks/useMedicationsByDiagnosis";
import { format } from "date-fns";
import { parseDateOnly } from "@/lib/dateUtils";
import { useTranslations } from "@/i18n";

const DATA_FETCH_TIMEOUT_MS = 10_000;

export default function Dashboard() {
  const { canEdit, activeProfileId, loading: profileLoading } = useActiveProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useTranslations();
  const { showOnboarding, completeOnboarding } = useOnboarding();

  // Separate loading states
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  
  // Detail view states
  const [selectedMedication, setSelectedMedication] = useState<any | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<any | null>(null);

  // Track if we've ever loaded data successfully
  const hasLoadedOnce = useRef(false);

  const fetchData = useCallback(async () => {
    if (!activeProfileId) return;

    const start = performance.now();
    console.log("[Dashboard] step=data_fetch_start profileId=", activeProfileId);
    setLoadingData(true);
    setDataError(null);

    try {
      const today = new Date().toISOString();
      const todayDateStr = today.split("T")[0];
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split("T")[0];

      // Race data fetch against timeout
      const dataPromise = Promise.all([
        supabase.from("appointments").select("*, doctors(full_name), institutions(name)").eq("profile_id", activeProfileId).gte("datetime_start", today).eq("status", "Upcoming").order("datetime_start").limit(5),
        supabase.from("reminders").select("*").eq("profile_id", activeProfileId).gte("due_date_time", today).eq("is_completed", false).order("due_date_time").limit(5),
        supabase.from("medications").select("*").eq("profile_id", activeProfileId).eq("status", "Active"),
        supabase.from("diagnoses").select("*").eq("profile_id", activeProfileId),
        supabase.from("tests").select("*, institutions(name)").eq("profile_id", activeProfileId).gte("date", ninetyDaysAgoStr).order("date", { ascending: false }).limit(5),
      ]);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), DATA_FETCH_TIMEOUT_MS)
      );

      const [apptRes, remRes, medRes, diagRes, testRes] = await Promise.race([dataPromise, timeoutPromise]);

      // Check for query-level errors
      const errors = [apptRes.error, remRes.error, medRes.error, diagRes.error, testRes.error].filter(Boolean);
      if (errors.length > 0) {
        console.warn("[Dashboard] step=data_fetch_partial_errors", errors.map(e => ({ code: e?.code, message: e?.message })));
      }

      setAppointments(apptRes.data || []);
      setReminders(remRes.data || []);
      setMedications(medRes.data || []);
      setDiagnoses(diagRes.data || []);
      setTests(testRes.data || []);
      hasLoadedOnce.current = true;

      console.log("[Dashboard] step=data_fetch_ok duration=", Math.round(performance.now() - start), "ms");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("[Dashboard] step=data_fetch_error", { error: errorMessage, duration: Math.round(performance.now() - start) });
      
      if (errorMessage === "TIMEOUT") {
        setDataError("timeout");
      } else {
        setDataError(errorMessage);
      }
      // Don't clear existing data on error if we loaded once — show stale data
    } finally {
      setLoadingData(false);
    }
  }, [activeProfileId]);

  // Fetch data when profile is ready or when navigating back
  useEffect(() => {
    if (activeProfileId) {
      fetchData();
    }
  }, [activeProfileId, fetchData, location.key]);

  const hasData = appointments.length > 0 || reminders.length > 0 || medications.length > 0 || tests.length > 0;
  
  // Group medications by diagnosis
  const medicationGroups = groupMedicationsByDiagnosis(medications, diagnoses);

  // LOADING LOGIC:
  // Show full-page spinner ONLY while profile is loading AND we haven't loaded data yet
  if (profileLoading && !hasLoadedOnce.current) return <LoadingPage />;

  // Show onboarding on first visit
  if (showOnboarding) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }

  // If profile resolved but no activeProfileId (edge case), show empty state
  if (!profileLoading && !activeProfileId) {
    return (
      <div className="animate-fade-in">
        <PageHeader variant="gradient" title={t.dashboard.title} description={t.dashboard.description} />
        <EmptyState
          icon={Calendar}
          title={t.dashboard.noHealthItems}
          description={t.dashboard.noHealthItemsDescription}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        variant="gradient"
        title={t.dashboard.title}
        description={t.dashboard.description}
        actions={
          canEdit ? (
            <div className="flex gap-2 flex-wrap">
              <Button asChild><Link to="/appointments?new=true"><Plus className="h-4 w-4 mr-2" />{t.dashboard.addAppointment}</Link></Button>
              <Button variant="outline" asChild><Link to="/tests?new=true">{t.dashboard.addTest}</Link></Button>
              <Button variant="outline" asChild><Link to="/medications?new=true">{t.dashboard.addMedication}</Link></Button>
              <Button variant="outline" asChild><Link to="/clinical-summary"><FileText className="h-4 w-4 mr-2" /><span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full mr-1.5">Plus</span>{t.nav.clinicalSummary}</Link></Button>
            </div>
          ) : (
            <Button variant="outline" asChild><Link to="/clinical-summary"><FileText className="h-4 w-4 mr-2" /><span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full mr-1.5">Plus</span>{t.nav.clinicalSummary}</Link></Button>
          )
        }
      />

      {/* Orientation banner for new users */}
      {canEdit && <OrientationBanner hasAppointments={appointments.length > 0} />}

      {/* PWA install prompt — auto-hides if conditions aren't met */}
      <PWAInstallPrompt />

      {/* Error state with retry */}
      {dataError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6 flex items-center justify-between gap-4">
          <p className="text-sm text-destructive">
            {dataError === "timeout"
              ? "Loading took too long. Please try again."
              : "We couldn't load your dashboard data."}
          </p>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loadingData}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingData ? "animate-spin" : ""}`} />
            Retry
          </Button>
        </div>
      )}

      {/* Loading indicator for data (non-blocking — shows inline, not full-page) */}
      {loadingData && !hasLoadedOnce.current && !dataError && (
        <div className="flex justify-center py-12">
          <LoadingPage />
        </div>
      )}

      {/* Main content — render even if loadingData, using stale data */}
      {(!loadingData || hasLoadedOnce.current) && (
        <>
          {!hasData ? (
            <EmptyState
              icon={Calendar}
              title={t.dashboard.noHealthItems}
              description={t.dashboard.noHealthItemsDescription}
              action={{ label: t.dashboard.addAppointment, onClick: () => window.location.href = "/appointments?new=true" }}
            />
          ) : (
            <Tabs defaultValue="upcoming" className="space-y-6">
              <TabsList>
                <TabsTrigger value="upcoming">{t.dashboard.upcoming}</TabsTrigger>
                <TabsTrigger value="timeline">{t.dashboard.timeline}</TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming" className="space-y-6">
                {/* Appointments */}
                {appointments.length > 0 && (
                  <section className="health-card">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" />{t.dashboard.upcomingAppointments}</h2>
                      <Link to="/appointments" className="text-sm text-primary hover:underline flex items-center gap-1">{t.dashboard.viewAll} <ArrowRight className="h-3 w-3" /></Link>
                    </div>
                    <div className="space-y-3">
                      {appointments.map((apt) => (
                        <button 
                          key={apt.id} 
                          onClick={() => navigate(`/appointments?view=${apt.id}&from=dashboard`)}
                          className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left min-h-[56px]"
                        >
                          <div>
                            <p className="font-medium">{apt.reason || t.misc.appointment}</p>
                            <p className="text-sm text-muted-foreground">{apt.doctors?.full_name || apt.institutions?.name || t.misc.noLocation}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{format(new Date(apt.datetime_start), "MMM d, yyyy")}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(apt.datetime_start), "h:mm a")}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Active Medications */}
                {medications.length > 0 && (
                  <section className="health-card">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2"><Pill className="h-5 w-5 text-primary" />{t.dashboard.activeMedications}</h2>
                      <Link to="/medications" className="text-sm text-primary hover:underline flex items-center gap-1">{t.dashboard.viewAll} <ArrowRight className="h-3 w-3" /></Link>
                    </div>
                    <div className="space-y-4">
                      {medicationGroups.map((group) => (
                        <div key={group.diagnosis?.id || "unlinked"}>
                          <div className="flex items-center gap-2 mb-2">
                            <HeartPulse className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">
                              {group.diagnosis 
                                ? `${group.diagnosis.condition}${group.diagnosis.status === "resolved" ? ` (${t.diagnoses.resolved})` : ""}`
                                : t.dashboard.unlinkedNoDiagnosis
                              }
                            </span>
                          </div>
                          <div className="space-y-2 pl-6">
                            {group.medications.map((med) => (
                              <button 
                                key={med.id} 
                                onClick={() => setSelectedMedication(med)}
                                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left min-h-[56px]"
                              >
                                <div>
                                  <p className="font-medium">{med.name}</p>
                                  <p className="text-sm text-muted-foreground">{med.dose_text}</p>
                                </div>
                                <StatusBadge status={normalizeStatus(med.status)} />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Recent Tests */}
                {tests.length > 0 && (
                  <section className="health-card">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2"><FlaskConical className="h-5 w-5 text-primary" />Estudios recientes</h2>
                      <Link to="/tests" className="text-sm text-primary hover:underline flex items-center gap-1">{t.dashboard.viewAll} <ArrowRight className="h-3 w-3" /></Link>
                    </div>
                    <div className="space-y-3">
                      {tests.map((test) => (
                        <button 
                          key={test.id} 
                          onClick={() => navigate(`/tests?view=${test.id}`)}
                          className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left min-h-[56px]"
                        >
                          <div>
                            <p className="font-medium">{test.type}</p>
                            <p className="text-sm text-muted-foreground">{test.institutions?.name || ""}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{format(parseDateOnly(test.date), "MMM d, yyyy")}</p>
                            <StatusBadge status={normalizeStatus(test.status)} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Reminders */}
                {reminders.length > 0 && (
                  <section className="health-card">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />{t.nav.reminders}</h2>
                      <Link to="/reminders" className="text-sm text-primary hover:underline flex items-center gap-1">{t.dashboard.viewAll} <ArrowRight className="h-3 w-3" /></Link>
                    </div>
                    <div className="space-y-3">
                      {reminders.map((rem) => (
                        <button 
                          key={rem.id} 
                          onClick={() => setSelectedReminder(rem)}
                          className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left min-h-[56px]"
                        >
                          <div>
                            <p className="font-medium">{rem.title}</p>
                            <p className="text-sm text-muted-foreground">{rem.type}</p>
                          </div>
                          <p className="text-sm">{format(new Date(rem.due_date_time), "MMM d, h:mm a")}</p>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </TabsContent>

              <TabsContent value="timeline">
                <div className="health-card">
                  <div className="space-y-0">
                    {[...appointments, ...tests].sort((a, b) => new Date(a.datetime_start || a.date).getTime() - new Date(b.datetime_start || b.date).getTime()).slice(0, 10).map((item) => (
                      <div key={item.id} className="timeline-item">
                        <div className="timeline-dot"><Clock className="h-3 w-3 text-primary" /></div>
                        <div>
                          <p className="font-medium">{item.reason || item.type}</p>
                          <p className="text-sm text-muted-foreground">{format(new Date(item.datetime_start || item.date), "MMM d, yyyy")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
      
      {/* Medication Detail Dialog */}
      <Dialog open={!!selectedMedication} onOpenChange={(open) => !open && setSelectedMedication(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedMedication?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-muted-foreground text-xs">{t.medications.dose}</Label><p>{selectedMedication?.dose_text}</p></div>
            <div><Label className="text-muted-foreground text-xs">{t.medications.frequency}</Label><p>{selectedMedication?.schedule_type === "Daily" ? t.medications.daily : selectedMedication?.schedule_type === "Weekly" ? t.medications.weekly : t.medications.asNeeded}</p></div>
            {selectedMedication?.status && (
              <div><Label className="text-muted-foreground text-xs">{t.medications.status}</Label><StatusBadge status={normalizeStatus(selectedMedication.status)} /></div>
            )}
            {selectedMedication?.notes && <div><Label className="text-muted-foreground text-xs">{t.medications.notes}</Label><p>{selectedMedication.notes}</p></div>}
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => { setSelectedMedication(null); navigate(`/medications?edit=${selectedMedication?.id}`); }}>
              {t.dashboard.editInMedications}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Reminder Detail Dialog */}
      <Dialog open={!!selectedReminder} onOpenChange={(open) => !open && setSelectedReminder(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedReminder?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-muted-foreground text-xs">{t.reminders.type}</Label><p>{selectedReminder?.type}</p></div>
            <div><Label className="text-muted-foreground text-xs">{t.reminders.date}</Label><p>{selectedReminder?.due_date_time ? format(new Date(selectedReminder.due_date_time), "MMM d, yyyy h:mm a") : "-"}</p></div>
            <div><Label className="text-muted-foreground text-xs">{t.reminders.repeat}</Label><p>{selectedReminder?.repeat_rule === "None" ? t.reminders.oneTime : selectedReminder?.repeat_rule}</p></div>
            {selectedReminder?.notes && <div><Label className="text-muted-foreground text-xs">{t.reminders.notes}</Label><p>{selectedReminder.notes}</p></div>}
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => { setSelectedReminder(null); navigate(`/reminders?edit=${selectedReminder?.id}`); }}>
              {t.dashboard.editInReminders}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
