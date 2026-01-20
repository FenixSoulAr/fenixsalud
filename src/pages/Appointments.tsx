import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Calendar, Pencil, Trash2, Stethoscope, Building2, Eye, ArrowLeft, Check, ChevronsUpDown } from "lucide-react";
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
import { AttachmentIndicator } from "@/components/AttachmentIndicator";
import { SharingBanner } from "@/components/sharing/SharingBanner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSharing } from "@/contexts/SharingContext";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n";

// Helper to compute display status based on date
function getDisplayStatus(apt: any): "Upcoming" | "Past" | "Completed" | "Cancelled" {
  if (apt.status === "Cancelled") return "Cancelled";
  if (apt.status === "Completed") return "Completed";
  const dt = new Date(apt.datetime_start);
  return isPast(dt) ? "Past" : "Upcoming";
}

export default function Appointments() {
  const { user } = useAuth();
  const { canEdit, canDelete } = useSharing();
  const t = useTranslations();
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
  
  // Handle URL params for opening view
  useEffect(() => {
    const viewId = searchParams.get("view");
    if (viewId && appointments.length > 0) {
      const apt = appointments.find(a => a.id === viewId);
      if (apt) setViewingAppointment(apt);
    }
  }, [searchParams, appointments]);

  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  async function fetchData() {
    setLoading(true);
    const [apptRes, docRes, instRes] = await Promise.all([
      supabase.from("appointments").select("*, doctors(full_name), institutions(name)").order("datetime_start", { ascending: true }),
      supabase.from("doctors").select("id, full_name"),
      supabase.from("institutions").select("id, name"),
    ]);
    const appts = apptRes.data || [];
    setAppointments(appts);
    setDoctors(docRes.data || []);
    setInstitutions(instRes.data || []);
    
    // Fetch attachment counts for all appointments
    if (appts.length > 0) {
      const { data: attachments } = await supabase
        .from("file_attachments")
        .select("entity_id")
        .eq("entity_type", "Appointment")
        .in("entity_id", appts.map(a => a.id));
      
      const counts: Record<string, number> = {};
      (attachments || []).forEach(att => {
        counts[att.entity_id] = (counts[att.entity_id] || 0) + 1;
      });
      setAttachmentCounts(counts);
    }
    
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
    if (!form.date) { toast.error(t.appointments.dateRequired); return; }
    
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
      if (error) { toast.error(t.toast.error); return; }
      toast.success(t.toast.changesUpdated);
    } else {
      const { error } = await supabase.from("appointments").insert({ ...payload, user_id: user!.id });
      if (error) { toast.error(t.toast.error); return; }
      toast.success(t.toast.savedSuccess);
    }
    
    setDialogOpen(false);
    resetForm();
    fetchData();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("appointments").delete().eq("id", deleteId);
    if (error) { toast.error(t.toast.error); return; }
    toast.success(t.toast.deletedSuccess);
    setDeleteId(null);
    setViewingAppointment(null);
    fetchData();
  }

  async function handleAddDoctor(e: React.FormEvent) {
    e.preventDefault();
    if (!newDoctor.full_name) { toast.error(t.doctors.nameRequired); return; }
    
    const { data, error } = await supabase.from("doctors").insert({ 
      user_id: user!.id, 
      full_name: newDoctor.full_name, 
      specialty: newDoctor.specialty || null 
    }).select().single();
    
    if (error) { toast.error(t.toast.failedAddDoctor); return; }
    
    toast.success(t.toast.doctorAdded);
    setAddDoctorOpen(false);
    setNewDoctor({ full_name: "", specialty: "" });
    
    // Refresh doctors and auto-select
    const { data: docs } = await supabase.from("doctors").select("id, full_name");
    setDoctors(docs || []);
    setForm(f => ({ ...f, doctor_id: data.id }));
  }

  async function handleAddInstitution(e: React.FormEvent) {
    e.preventDefault();
    if (!newInstitution.name) { toast.error(t.institutions.nameRequired); return; }
    
    const { data, error } = await supabase.from("institutions").insert({ 
      user_id: user!.id, 
      name: newInstitution.name, 
      type: newInstitution.type as any
    }).select().single();
    
    if (error) { toast.error(t.toast.failedAddInstitution); return; }
    
    toast.success(t.toast.institutionAdded);
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
    const fromDashboard = searchParams.get("from") === "dashboard";
    
    const handleBack = () => {
      if (fromDashboard) {
        window.location.href = "/";
      } else {
        setViewingAppointment(null);
      }
    };
    
    return (
      <div className="animate-fade-in">
        <SharingBanner />
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />{fromDashboard ? t.appointments.backToDashboard : t.appointments.backToAppointments}
        </Button>
        
        <div className="max-w-2xl space-y-6">
          <div className="health-card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">{viewingAppointment.reason || t.misc.appointment}</h1>
                <p className="text-muted-foreground">
                  {format(dt, "MMMM d, yyyy")}
                  {hasTime && ` at ${format(dt, "h:mm a")}`}
                </p>
              </div>
              <StatusBadge status={getDisplayStatus(viewingAppointment) === "Past" ? "past" : normalizeStatus(getDisplayStatus(viewingAppointment))} />
            </div>
            
            <div className="space-y-3 text-sm">
              <div><span className="font-medium">{t.appointments.doctor}:</span> {viewingAppointment.doctors?.full_name || "—"}</div>
              <div><span className="font-medium">{t.appointments.institution}:</span> {viewingAppointment.institutions?.name || "—"}</div>
              {viewingAppointment.notes && <div><span className="font-medium">{t.appointments.notes}:</span> {viewingAppointment.notes}</div>}
            </div>
            
            {(canEdit || canDelete) && (
              <div className="flex gap-2 mt-6 pt-4 border-t">
                {canEdit && (
                  <Button onClick={() => openEdit(viewingAppointment)}>
                    <Pencil className="h-4 w-4 mr-2" />{t.actions.edit}
                  </Button>
                )}
                {canDelete && (
                  <Button variant="destructive" onClick={() => setDeleteId(viewingAppointment.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />{t.actions.delete}
                  </Button>
                )}
              </div>
            )}
          </div>
          
          <div className="health-card">
            <FileAttachments entityType="Appointment" entityId={viewingAppointment.id} />
          </div>
        </div>
        
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.dialogs.deleteItem}</AlertDialogTitle>
              <AlertDialogDescription>{t.dialogs.deleteItemDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t.actions.delete}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <SharingBanner />
      <PageHeader
        title={t.appointments.title}
        description={t.appointments.description}
        actions={
          canEdit ? (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />{t.appointments.addAppointment}</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? t.appointments.editAppointment : t.appointments.newAppointment}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-field">
                    <Label>{t.appointments.date} *</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                  </div>
                  <div className="form-field">
                    <Label>{t.appointments.time}</Label>
                    <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  </div>
                </div>
                <div className="form-field">
                  <Label>{t.appointments.reason}</Label>
                  <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={t.appointments.reasonPlaceholder} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Doctor Combobox */}
                  <div className="form-field">
                    <Label>{t.appointments.doctor}</Label>
                    <Popover open={doctorOpen} onOpenChange={setDoctorOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={doctorOpen} className="w-full justify-between font-normal">
                          {form.doctor_id ? doctors.find(d => d.id === form.doctor_id)?.full_name : t.appointments.selectDoctor}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput placeholder={t.appointments.searchDoctor} />
                          <CommandList>
                            <CommandEmpty>{t.appointments.noDoctor}</CommandEmpty>
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
                            <Plus className="h-4 w-4 mr-2" />{t.appointments.addNewDoctor}
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {/* Institution Combobox */}
                  <div className="form-field">
                    <Label>{t.appointments.institution}</Label>
                    <Popover open={institutionOpen} onOpenChange={setInstitutionOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={institutionOpen} className="w-full justify-between font-normal">
                          {form.institution_id ? institutions.find(i => i.id === form.institution_id)?.name : t.appointments.selectInstitution}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput placeholder={t.appointments.searchInstitution} />
                          <CommandList>
                            <CommandEmpty>{t.appointments.noInstitution}</CommandEmpty>
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
                            <Plus className="h-4 w-4 mr-2" />{t.appointments.addNewInstitution}
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                {editingId && (
                  <div className="form-field">
                    <Label>{t.appointments.status}</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Upcoming">{t.appointments.upcoming}</SelectItem>
                        <SelectItem value="Completed">{t.appointments.completed}</SelectItem>
                        <SelectItem value="Cancelled">{t.appointments.cancelled}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="form-field">
                  <Label>{t.appointments.notes}</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button type="submit" className="w-full">{editingId ? t.actions.saveChanges : t.appointments.createAppointment}</Button>
              </form>
            </DialogContent>
          </Dialog>
          ) : null
        }
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.dialogs.deleteItem}</AlertDialogTitle>
            <AlertDialogDescription>{t.dialogs.deleteItemDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t.actions.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Add Doctor Dialog */}
      <Dialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5" />{t.doctors.newDoctor}</DialogTitle></DialogHeader>
          <form onSubmit={handleAddDoctor} className="space-y-4">
            <div className="form-field"><Label>{t.doctors.fullName} *</Label><Input value={newDoctor.full_name} onChange={(e) => setNewDoctor({ ...newDoctor, full_name: e.target.value })} required /></div>
            <div className="form-field"><Label>{t.doctors.specialty}</Label><Input value={newDoctor.specialty} onChange={(e) => setNewDoctor({ ...newDoctor, specialty: e.target.value })} placeholder={t.doctors.specialtyPlaceholder} /></div>
            <Button type="submit" className="w-full">{t.doctors.addDoctor}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Add Institution Dialog */}
      <Dialog open={addInstitutionOpen} onOpenChange={setAddInstitutionOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{t.institutions.addNewInstitution}</DialogTitle></DialogHeader>
          <form onSubmit={handleAddInstitution} className="space-y-4">
            <div className="form-field"><Label>{t.institutions.name} *</Label><Input value={newInstitution.name} onChange={(e) => setNewInstitution({ ...newInstitution, name: e.target.value })} required /></div>
            <div className="form-field">
              <Label>{t.institutions.type}</Label>
              <Select value={newInstitution.type} onValueChange={(v) => setNewInstitution({ ...newInstitution, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Clinic">{t.institutions.clinic}</SelectItem>
                  <SelectItem value="Lab">{t.institutions.lab}</SelectItem>
                  <SelectItem value="Hospital">{t.institutions.hospital}</SelectItem>
                  <SelectItem value="Other">{t.institutions.other}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">{t.institutions.addInstitution}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {appointments.length === 0 ? (
        <EmptyState icon={Calendar} title={t.appointments.noAppointments} description={t.appointments.noAppointmentsDescription} action={{ label: t.appointments.addAppointment, onClick: () => setDialogOpen(true) }} />
      ) : (
        <>
          {/* Sort: upcoming first (ascending), then past (descending) */}
          {(() => {
            const now = new Date();
            const upcoming = appointments.filter(apt => new Date(apt.datetime_start) >= now).sort((a, b) => new Date(a.datetime_start).getTime() - new Date(b.datetime_start).getTime());
            const past = appointments.filter(apt => new Date(apt.datetime_start) < now).sort((a, b) => new Date(b.datetime_start).getTime() - new Date(a.datetime_start).getTime());
            const sortedAppointments = [...upcoming, ...past];

            return (
              <>
                {/* Mobile Card Layout */}
                <div className="md:hidden space-y-3">
                  {sortedAppointments.map((apt) => {
                    const dt = new Date(apt.datetime_start);
                    const hasTime = dt.getHours() !== 0 || dt.getMinutes() !== 0;
                    const attachCount = attachmentCounts[apt.id] || 0;
                    const displayStatus = getDisplayStatus(apt);
                    return (
                      <div key={apt.id} className="health-card">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">
                              {format(dt, "MMM d, yyyy")}
                              {hasTime && ` at ${format(dt, "h:mm a")}`}
                            </p>
                            {apt.reason && <p className="text-foreground mt-1">{apt.reason}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            {attachCount > 0 && (
                              <AttachmentIndicator entityType="Appointment" entityId={apt.id} count={attachCount} />
                            )}
                            <StatusBadge status={displayStatus === "Past" ? "past" : normalizeStatus(displayStatus)} />
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {apt.doctors?.full_name && <p>{t.appointments.doctor}: {apt.doctors.full_name}</p>}
                          {apt.institutions?.name && <p>{t.appointments.institution}: {apt.institutions.name}</p>}
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                          <Button variant="ghost" size="sm" onClick={() => setViewingAppointment(apt)}>
                            <Eye className="h-4 w-4 mr-1" />{t.actions.view}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(apt)}>
                            <Pencil className="h-4 w-4 mr-1" />{t.actions.edit}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteId(apt.id)}>
                            <Trash2 className="h-4 w-4 mr-1 text-destructive" />{t.actions.delete}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden md:block data-grid overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b bg-muted/50"><th className="text-left p-4 font-medium">{t.appointments.date} & {t.appointments.time}</th><th className="text-left p-4 font-medium">{t.appointments.doctor}</th><th className="text-left p-4 font-medium">{t.appointments.institution}</th><th className="text-left p-4 font-medium">{t.appointments.reason}</th><th className="text-left p-4 font-medium">{t.appointments.status}</th><th className="text-right p-4 font-medium">{t.actions.view}</th></tr></thead>
                    <tbody>
                      {sortedAppointments.map((apt) => {
                        const attachCount = attachmentCounts[apt.id] || 0;
                        const displayStatus = getDisplayStatus(apt);
                        return (
                          <tr key={apt.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-4">{format(new Date(apt.datetime_start), "MMM d, yyyy h:mm a")}</td>
                            <td className="p-4">{apt.doctors?.full_name || "—"}</td>
                            <td className="p-4">{apt.institutions?.name || "—"}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span>{apt.reason || "—"}</span>
                                {attachCount > 0 && (
                                  <AttachmentIndicator entityType="Appointment" entityId={apt.id} count={attachCount} />
                                )}
                              </div>
                            </td>
                            <td className="p-4"><StatusBadge status={displayStatus === "Past" ? "past" : normalizeStatus(displayStatus)} /></td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => setViewingAppointment(apt)} aria-label={t.actions.view}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => openEdit(apt)} aria-label={t.actions.edit}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteId(apt.id)} aria-label={t.actions.delete}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
