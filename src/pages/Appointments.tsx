import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Calendar, Pencil, Trash2, Stethoscope, Building2, Eye, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, normalizeStatus } from "@/components/ui/status-badge";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { FileAttachments } from "@/components/FileAttachments";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

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
  const [viewingAppointment, setViewingAppointment] = useState<any | null>(null);
  const [form, setForm] = useState({ date: "", time: "", reason: "", notes: "", doctor_id: "", institution_id: "", status: "Upcoming" });
  
  // Quick add dialogs
  const [addDoctorOpen, setAddDoctorOpen] = useState(false);
  const [addInstitutionOpen, setAddInstitutionOpen] = useState(false);
  const [newDoctor, setNewDoctor] = useState({ full_name: "", specialty: "" });
  const [newInstitution, setNewInstitution] = useState({ name: "", type: "Clinic" });
  
  // Combobox open states
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [institutionOpen, setInstitutionOpen] = useState(false);

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
    const dt = apt.datetime_start ? new Date(apt.datetime_start) : null;
    const hasTime = dt && (dt.getHours() !== 0 || dt.getMinutes() !== 0);
    setForm({
      date: dt ? format(dt, "yyyy-MM-dd") : "",
      time: hasTime ? format(dt, "HH:mm") : "",
      reason: apt.reason || "",
      notes: apt.notes || "",
      doctor_id: apt.doctor_id || "",
      institution_id: apt.institution_id || "",
      status: apt.status || "Upcoming",
    });
    setViewingAppointment(null);
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ date: "", time: "", reason: "", notes: "", doctor_id: "", institution_id: "", status: "Upcoming" });
  }

  function buildDateTime() {
    if (!form.date) return "";
    const time = form.time || "00:00";
    return `${form.date}T${time}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date) { toast.error("Date is required."); return; }
    
    const payload = {
      datetime_start: buildDateTime(),
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
    toast.success("Deleted successfully.");
    setDeleteId(null);
    setViewingAppointment(null);
    fetchData();
  }

  async function handleAddDoctor(e: React.FormEvent) {
    e.preventDefault();
    if (!newDoctor.full_name) { toast.error("Doctor name is required."); return; }
    
    const { data, error } = await supabase.from("doctors").insert({ 
      user_id: user!.id, 
      full_name: newDoctor.full_name, 
      specialty: newDoctor.specialty || null 
    }).select().single();
    
    if (error) { toast.error("Failed to add doctor"); return; }
    
    toast.success("Doctor added!");
    setAddDoctorOpen(false);
    setNewDoctor({ full_name: "", specialty: "" });
    
    // Refresh doctors and auto-select
    const { data: docs } = await supabase.from("doctors").select("id, full_name");
    setDoctors(docs || []);
    setForm(f => ({ ...f, doctor_id: data.id }));
  }

  async function handleAddInstitution(e: React.FormEvent) {
    e.preventDefault();
    if (!newInstitution.name) { toast.error("Institution name is required."); return; }
    
    const { data, error } = await supabase.from("institutions").insert({ 
      user_id: user!.id, 
      name: newInstitution.name, 
      type: newInstitution.type as any
    }).select().single();
    
    if (error) { toast.error("Failed to add institution"); return; }
    
    toast.success("Institution added!");
    setAddInstitutionOpen(false);
    setNewInstitution({ name: "", type: "Clinic" });
    
    // Refresh institutions and auto-select
    const { data: insts } = await supabase.from("institutions").select("id, name");
    setInstitutions(insts || []);
    setForm(f => ({ ...f, institution_id: data.id }));
  }

  if (loading) return <LoadingPage />;

  // Detail View
  if (viewingAppointment) {
    const dt = new Date(viewingAppointment.datetime_start);
    const hasTime = dt.getHours() !== 0 || dt.getMinutes() !== 0;
    
    return (
      <div className="animate-fade-in">
        <Button variant="ghost" onClick={() => setViewingAppointment(null)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Appointments
        </Button>
        
        <div className="max-w-2xl space-y-6">
          <div className="health-card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">{viewingAppointment.reason || "Appointment"}</h1>
                <p className="text-muted-foreground">
                  {format(dt, "MMMM d, yyyy")}
                  {hasTime && ` at ${format(dt, "h:mm a")}`}
                </p>
              </div>
              <StatusBadge status={normalizeStatus(viewingAppointment.status)} />
            </div>
            
            <div className="space-y-3 text-sm">
              <div><span className="font-medium">Doctor:</span> {viewingAppointment.doctors?.full_name || "—"}</div>
              <div><span className="font-medium">Institution:</span> {viewingAppointment.institutions?.name || "—"}</div>
              {viewingAppointment.notes && <div><span className="font-medium">Notes:</span> {viewingAppointment.notes}</div>}
            </div>
            
            <div className="flex gap-2 mt-6 pt-4 border-t">
              <Button onClick={() => openEdit(viewingAppointment)}>
                <Pencil className="h-4 w-4 mr-2" />Edit
              </Button>
              <Button variant="destructive" onClick={() => setDeleteId(viewingAppointment.id)}>
                <Trash2 className="h-4 w-4 mr-2" />Delete
              </Button>
            </div>
          </div>
          
          <div className="health-card">
            <FileAttachments entityType="Appointment" entityId={viewingAppointment.id} />
          </div>
        </div>
        
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete item?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Appointments"
        description="Manage your medical appointments"
        actions={
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add appointment</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? "Edit Appointment" : "New Appointment"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-field">
                    <Label>Date *</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                  </div>
                  <div className="form-field">
                    <Label>Time</Label>
                    <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  </div>
                </div>
                <div className="form-field">
                  <Label>Reason</Label>
                  <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g., Annual checkup" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Doctor Combobox */}
                  <div className="form-field">
                    <Label>Doctor</Label>
                    <Popover open={doctorOpen} onOpenChange={setDoctorOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={doctorOpen} className="w-full justify-between font-normal">
                          {form.doctor_id ? doctors.find(d => d.id === form.doctor_id)?.full_name : "Select doctor..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput placeholder="Search doctor..." />
                          <CommandList>
                            <CommandEmpty>No doctor found.</CommandEmpty>
                            <CommandGroup>
                              {doctors.map((d) => (
                                <CommandItem
                                  key={d.id}
                                  value={d.full_name}
                                  onSelect={() => { setForm({ ...form, doctor_id: d.id }); setDoctorOpen(false); }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", form.doctor_id === d.id ? "opacity-100" : "opacity-0")} />
                                  {d.full_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                        <div className="border-t p-2">
                          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { setDoctorOpen(false); setAddDoctorOpen(true); }}>
                            <Plus className="h-4 w-4 mr-2" />Add new doctor
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {/* Institution Combobox */}
                  <div className="form-field">
                    <Label>Institution</Label>
                    <Popover open={institutionOpen} onOpenChange={setInstitutionOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={institutionOpen} className="w-full justify-between font-normal">
                          {form.institution_id ? institutions.find(i => i.id === form.institution_id)?.name : "Select institution..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput placeholder="Search institution..." />
                          <CommandList>
                            <CommandEmpty>No institution found.</CommandEmpty>
                            <CommandGroup>
                              {institutions.map((i) => (
                                <CommandItem
                                  key={i.id}
                                  value={i.name}
                                  onSelect={() => { setForm({ ...form, institution_id: i.id }); setInstitutionOpen(false); }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", form.institution_id === i.id ? "opacity-100" : "opacity-0")} />
                                  {i.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                        <div className="border-t p-2">
                          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { setInstitutionOpen(false); setAddInstitutionOpen(true); }}>
                            <Plus className="h-4 w-4 mr-2" />Add new institution
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Add Doctor Dialog */}
      <Dialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5" />Add New Doctor</DialogTitle></DialogHeader>
          <form onSubmit={handleAddDoctor} className="space-y-4">
            <div className="form-field"><Label>Full Name *</Label><Input value={newDoctor.full_name} onChange={(e) => setNewDoctor({ ...newDoctor, full_name: e.target.value })} required /></div>
            <div className="form-field"><Label>Specialty</Label><Input value={newDoctor.specialty} onChange={(e) => setNewDoctor({ ...newDoctor, specialty: e.target.value })} placeholder="e.g., Cardiology" /></div>
            <Button type="submit" className="w-full">Add Doctor</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Add Institution Dialog */}
      <Dialog open={addInstitutionOpen} onOpenChange={setAddInstitutionOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Add New Institution</DialogTitle></DialogHeader>
          <form onSubmit={handleAddInstitution} className="space-y-4">
            <div className="form-field"><Label>Name *</Label><Input value={newInstitution.name} onChange={(e) => setNewInstitution({ ...newInstitution, name: e.target.value })} required /></div>
            <div className="form-field">
              <Label>Type</Label>
              <Select value={newInstitution.type} onValueChange={(v) => setNewInstitution({ ...newInstitution, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Clinic">Clinic</SelectItem><SelectItem value="Lab">Lab</SelectItem><SelectItem value="Hospital">Hospital</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">Add Institution</Button>
          </form>
        </DialogContent>
      </Dialog>

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
                      <Button variant="ghost" size="icon" onClick={() => setViewingAppointment(apt)} aria-label="View appointment">
                        <Eye className="h-4 w-4" />
                      </Button>
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
