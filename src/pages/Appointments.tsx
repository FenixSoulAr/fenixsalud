import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, normalizeStatus } from "@/components/ui/status-badge";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Appointments() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("new") === "true");
  const [form, setForm] = useState({ datetime_start: "", reason: "", notes: "", doctor_id: "", institution_id: "", status: "Upcoming" });

  useEffect(() => { if (user) fetchData(); }, [user]);

  async function fetchData() {
    setLoading(true);
    const [apptRes, docRes, instRes] = await Promise.all([
      supabase.from("appointments").select("*, doctors(full_name), institutions(name)").order("datetime_start", { ascending: false }),
      supabase.from("doctors").select("id, full_name"),
      supabase.from("institutions").select("id, name"),
    ]);
    setAppointments(apptRes.data || []);
    setDoctors(docRes.data || []);
    setInstitutions(instRes.data || []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.datetime_start) { toast.error("Date and time are required."); return; }
    
    const { error } = await supabase.from("appointments").insert({
      user_id: user!.id,
      datetime_start: form.datetime_start,
      reason: form.reason || null,
      notes: form.notes || null,
      doctor_id: form.doctor_id || null,
      institution_id: form.institution_id || null,
      status: form.status as any,
    });
    
    if (error) { toast.error("Failed to create appointment"); return; }
    toast.success("Appointment created!");
    setDialogOpen(false);
    setForm({ datetime_start: "", reason: "", notes: "", doctor_id: "", institution_id: "", status: "Upcoming" });
    fetchData();
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Appointments"
        description="Manage your medical appointments"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add appointment</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Appointment</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-field">
                  <Label>Date & Time *</Label>
                  <Input type="datetime-local" value={form.datetime_start} onChange={(e) => setForm({ ...form, datetime_start: e.target.value })} required />
                </div>
                <div className="form-field">
                  <Label>Reason</Label>
                  <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g., Annual checkup" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-field">
                    <Label>Doctor</Label>
                    <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                      <SelectContent>{doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="form-field">
                    <Label>Institution</Label>
                    <Select value={form.institution_id} onValueChange={(v) => setForm({ ...form, institution_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select institution" /></SelectTrigger>
                      <SelectContent>{institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="form-field">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button type="submit" className="w-full">Create Appointment</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {appointments.length === 0 ? (
        <EmptyState icon={Calendar} title="No appointments yet" description="Schedule your first appointment to keep track of your visits." action={{ label: "Add appointment", onClick: () => setDialogOpen(true) }} />
      ) : (
        <div className="data-grid">
          <table className="w-full">
            <thead><tr className="border-b bg-muted/50"><th className="text-left p-4 font-medium">Date & Time</th><th className="text-left p-4 font-medium">Doctor</th><th className="text-left p-4 font-medium">Institution</th><th className="text-left p-4 font-medium">Reason</th><th className="text-left p-4 font-medium">Status</th></tr></thead>
            <tbody>
              {appointments.map((apt) => (
                <tr key={apt.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-4">{format(new Date(apt.datetime_start), "MMM d, yyyy h:mm a")}</td>
                  <td className="p-4">{apt.doctors?.full_name || "—"}</td>
                  <td className="p-4">{apt.institutions?.name || "—"}</td>
                  <td className="p-4">{apt.reason || "—"}</td>
                  <td className="p-4"><StatusBadge status={normalizeStatus(apt.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
