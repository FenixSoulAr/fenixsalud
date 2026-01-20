import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Calendar, FlaskConical, Pill, Bell, Clock, ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, normalizeStatus } from "@/components/ui/status-badge";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { format } from "date-fns";
import { useTranslations } from "@/i18n";

export default function Dashboard() {
  const { canEdit, activeProfileOwnerId } = useActiveProfile();
  const navigate = useNavigate();
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  
  // Detail view states
  const [selectedMedication, setSelectedMedication] = useState<any | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<any | null>(null);

  useEffect(() => {
    if (activeProfileOwnerId) fetchData();
  }, [activeProfileOwnerId]);

  async function fetchData() {
    setLoading(true);
    const today = new Date().toISOString();

    const [apptRes, remRes, medRes, testRes] = await Promise.all([
      supabase.from("appointments").select("*, doctors(full_name), institutions(name)").gte("datetime_start", today).eq("status", "Upcoming").order("datetime_start").limit(5),
      supabase.from("reminders").select("*").gte("due_date_time", today).eq("is_completed", false).order("due_date_time").limit(5),
      supabase.from("medications").select("*").eq("status", "Active").limit(5),
      supabase.from("tests").select("*, institutions(name)").gte("date", today.split("T")[0]).order("date").limit(5),
    ]);

    setAppointments(apptRes.data || []);
    setReminders(remRes.data || []);
    setMedications(medRes.data || []);
    setTests(testRes.data || []);
    setLoading(false);
  }

  const hasData = appointments.length > 0 || reminders.length > 0 || medications.length > 0 || tests.length > 0;

  if (loading) return <LoadingPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t.dashboard.title}
        description={t.dashboard.description}
        actions={
          canEdit ? (
            <div className="flex gap-2 flex-wrap">
              <Button asChild><Link to="/appointments?new=true"><Plus className="h-4 w-4 mr-2" />{t.dashboard.addAppointment}</Link></Button>
              <Button variant="outline" asChild><Link to="/tests?new=true">{t.dashboard.addTest}</Link></Button>
              <Button variant="outline" asChild><Link to="/medications?new=true">{t.dashboard.addMedication}</Link></Button>
              <Button variant="outline" asChild><Link to="/clinical-summary"><FileText className="h-4 w-4 mr-2" />{t.nav.clinicalSummary}</Link></Button>
            </div>
          ) : (
            <Button variant="outline" asChild><Link to="/clinical-summary"><FileText className="h-4 w-4 mr-2" />{t.nav.clinicalSummary}</Link></Button>
          )
        }
      />

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

            {/* Medications */}
            {medications.length > 0 && (
              <section className="health-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><Pill className="h-5 w-5 text-primary" />{t.dashboard.activeMedications}</h2>
                  <Link to="/medications" className="text-sm text-primary hover:underline flex items-center gap-1">{t.dashboard.viewAll} <ArrowRight className="h-3 w-3" /></Link>
                </div>
                <div className="space-y-3">
                  {medications.map((med) => (
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
                {[...appointments, ...tests].sort((a, b) => new Date(a.datetime_start || a.date).getTime() - new Date(b.datetime_start || b.date).getTime()).slice(0, 10).map((item, i) => (
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
      
      {/* Medication Detail Dialog */}
      <Dialog open={!!selectedMedication} onOpenChange={(open) => !open && setSelectedMedication(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedMedication?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-muted-foreground text-xs">{t.medications.dose}</Label><p>{selectedMedication?.dose_text}</p></div>
            <div><Label className="text-muted-foreground text-xs">{t.medications.schedule}</Label><p>{selectedMedication?.schedule_type}</p></div>
            {selectedMedication?.times && selectedMedication.times.length > 0 && (
              <div><Label className="text-muted-foreground text-xs">{t.medications.times}</Label><p>{selectedMedication.times.join(", ")}</p></div>
            )}
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
