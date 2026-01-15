import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Calendar, FlaskConical, Pill, Bell, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, normalizeStatus } from "@/components/ui/status-badge";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

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
        title="Dashboard"
        description="Your health at a glance"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button asChild><Link to="/appointments?new=true"><Plus className="h-4 w-4 mr-2" />Add appointment</Link></Button>
            <Button variant="outline" asChild><Link to="/tests?new=true">Add test</Link></Button>
            <Button variant="outline" asChild><Link to="/medications?new=true">Add medication</Link></Button>
          </div>
        }
      />

      {!hasData ? (
        <EmptyState
          icon={Calendar}
          title="No health items yet"
          description="Add your first appointment, test, or medication to get started."
          action={{ label: "Add appointment", onClick: () => window.location.href = "/appointments?new=true" }}
        />
      ) : (
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-6">
            {/* Appointments */}
            {appointments.length > 0 && (
              <section className="health-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" />Upcoming Appointments</h2>
                  <Link to="/appointments" className="text-sm text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
                </div>
                <div className="space-y-3">
                  {appointments.map((apt) => (
                    <Link key={apt.id} to={`/appointments/${apt.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div>
                        <p className="font-medium">{apt.reason || "Appointment"}</p>
                        <p className="text-sm text-muted-foreground">{apt.doctors?.full_name || apt.institutions?.name || "No location"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{format(new Date(apt.datetime_start), "MMM d, yyyy")}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(apt.datetime_start), "h:mm a")}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Medications */}
            {medications.length > 0 && (
              <section className="health-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><Pill className="h-5 w-5 text-primary" />Active Medications</h2>
                  <Link to="/medications" className="text-sm text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
                </div>
                <div className="space-y-3">
                  {medications.map((med) => (
                    <Link key={med.id} to={`/medications/${med.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div>
                        <p className="font-medium">{med.name}</p>
                        <p className="text-sm text-muted-foreground">{med.dose_text}</p>
                      </div>
                      <StatusBadge status={normalizeStatus(med.status)} />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Reminders */}
            {reminders.length > 0 && (
              <section className="health-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Reminders</h2>
                  <Link to="/reminders" className="text-sm text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
                </div>
                <div className="space-y-3">
                  {reminders.map((rem) => (
                    <div key={rem.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{rem.title}</p>
                        <p className="text-sm text-muted-foreground">{rem.type}</p>
                      </div>
                      <p className="text-sm">{format(new Date(rem.due_date_time), "MMM d, h:mm a")}</p>
                    </div>
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
    </div>
  );
}
