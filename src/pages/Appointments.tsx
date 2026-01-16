import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Calendar, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
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

  function openEdit(apt: any) {
    setEditingId(apt.id);
    setForm({
      datetime_start: apt.datetime_start ? apt.datetime_start.slice(0, 16) : "",
      reason: apt.reason || "",
      notes: apt.notes || "",
      doctor_id: apt.doctor_id || "",
      institution_id: apt.institution_id || "",
      status: apt.status || "Upcoming",
    });
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ datetime_start: "", reason: "", notes: "", doctor_id: "", institution_id: "", status: "Upcoming" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.datetime_start) { toast.error("Date and time are required."); return; }
    
    const payload = {
      datetime_start: form.datetime_start,
      reason: form.reason || null,
      notes: form.notes || null,
      doctor_id: form.doctor_id || null,
      institution_id: form.institution_id || null,
      status: form.status as any,
    };

    if (editingId) {
      const { error } = await supabase.from("appointments").update(payload).eq("id", editingId);
      if (error) { toast.error("Something went wrong. Please try again."); return; }
      toast.success("Changes updated.");
    } else {
      const { error } = await supabase.from("appointments").insert({ ...payload, user_id: user!.id });
      if (error) { toast.error("Something went wrong. Please try again."); return; }
      toast.success("Saved successfully.");
    }
    
    setDialogOpen(false);
    resetForm();
    fetchData();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("appointments").delete().eq("id", deleteId);
    if (error) { toast.error("Something went wrong. Please try again."); return; }
    toast.success("Appointment deleted.");
    setDeleteId(null);
    fetchData();
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Appointments"
        description="Manage your medical appointments"
        actions={
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add appointment</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Edit Appointment" : "New Appointment"}</DialogTitle></DialogHeader>
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
                {editingId && (
                  <div className="form-field">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Upcoming">Upcoming</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="form-field">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button type="submit" className="w-full">{editingId ? "Save Changes" : "Create Appointment"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete appointment?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The appointment will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {appointments.length === 0 ? (
        <EmptyState icon={Calendar} title="No appointments yet" description="Schedule your first appointment to keep track of your visits." action={{ label: "Add appointment", onClick: () => setDialogOpen(true) }} />
      ) : (
        <div className="data-grid">
          <table className="w-full">
            <thead><tr className="border-b bg-muted/50"><th className="text-left p-4 font-medium">Date & Time</th><th className="text-left p-4 font-medium">Doctor</th><th className="text-left p-4 font-medium">Institution</th><th className="text-left p-4 font-medium">Reason</th><th className="text-left p-4 font-medium">Status</th><th className="text-right p-4 font-medium">Actions</th></tr></thead>
            <tbody>
              {appointments.map((apt) => (
                <tr key={apt.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-4">{format(new Date(apt.datetime_start), "MMM d, yyyy h:mm a")}</td>
                  <td className="p-4">{apt.doctors?.full_name || "—"}</td>
                  <td className="p-4">{apt.institutions?.name || "—"}</td>
                  <td className="p-4">{apt.reason || "—"}</td>
                  <td className="p-4"><StatusBadge status={normalizeStatus(apt.status)} /></td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(apt)} aria-label="Edit appointment">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(apt.id)} aria-label="Delete appointment">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}