import { useState, useEffect } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { Plus, Calendar, Pencil, Trash2, Stethoscope, Building2, Eye, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveFormModal } from "@/components/ui/responsive-form-modal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, normalizeStatus } from "@/components/ui/status-badge";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { FileAttachments } from "@/components/FileAttachments";
import { AttachmentIndicator } from "@/components/AttachmentIndicator";
import { RelatedEntityPicker } from "@/components/ui/related-entity-picker";

import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useTimezone } from "@/hooks/useTimezone";
import { toast } from "sonner";
import { isPast } from "date-fns";
import { useTranslations, getLanguage } from "@/i18n";
import { sortByName } from "@/lib/utils";

const UNASSIGNED_ID = "__unassigned__";

// Helper to compute display status based on date
function getDisplayStatus(apt: any): "Upcoming" | "Past" | "Completed" | "Cancelled" {
  if (apt.status === "Cancelled") return "Cancelled";
  if (apt.status === "Completed") return "Completed";
  const dt = new Date(apt.datetime_start);
  return isPast(dt) ? "Past" : "Upcoming";
}

export default function Appointments() {
  const { dataProfileId, activeProfileId, currentUserId, canEdit, canDelete } = useActiveProfile();
  const { localToISO, isoToLocal, formatDateTime, formatTime } = useTimezone();
  const { id: routeId } = useParams<{ id: string }>();
  const t = useTranslations();
  const lang = getLanguage();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("new") === "true");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewingAppointment, setViewingAppointment] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ date: "", time: "", reason: "", notes: "", doctor_id: "", institution_id: "", status: "Upcoming" });
  
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  useEffect(() => { if (activeProfileId) fetchData(); }, [activeProfileId]);
  
  // Handle deep link via route param or query param
  useEffect(() => {
    const viewId = routeId || searchParams.get("view");
    if (viewId && appointments.length > 0) {
      const apt = appointments.find(a => a.id === viewId);
      if (apt) setViewingAppointment(apt);
    }
  }, [routeId, searchParams, appointments]);

  async function fetchData() {
    if (!activeProfileId) return;
    setLoading(true);
    const [apptRes, docRes, instRes] = await Promise.all([
      supabase.from("appointments").select("*, doctors(full_name), institutions(name)").eq("profile_id", activeProfileId).order("datetime_start", { ascending: true }),
      supabase.from("doctors").select("id, full_name").eq("profile_id", activeProfileId).eq("is_active", true),
      supabase.from("institutions").select("id, name").eq("profile_id", activeProfileId).eq("is_active", true),
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
    const { date, time, hasTime } = isoToLocal(apt.datetime_start);
    setForm({
      date,
      time: hasTime ? time : "",
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
    return localToISO(form.date, form.time || undefined);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) {
      toast.error("You have view-only access to this profile.");
      return;
    }
    if (!form.date) { toast.error(t.appointments.dateRequired); return; }
    
    setIsSaving(true);
    
    const professionalStatus = form.doctor_id ? "assigned" : "unassigned";
    const payload = {
      datetime_start: buildDateTime(),
      reason: form.reason || null,
      notes: form.notes || null,
      doctor_id: form.doctor_id || null,
      institution_id: form.institution_id || null,
      status: form.status as any,
      professional_status: professionalStatus as any,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("appointments").update(payload).eq("id", editingId);
        if (error) { 
          console.error("Update error:", { code: error.code, message: error.message, details: error.details, hint: error.hint });
          toast.error(error.code === "42501" ? "No tenés permisos para editar." : t.toast.error); 
          return; 
        }
      } else {
        if (!dataProfileId || !currentUserId) { 
          console.error("Missing IDs:", { dataProfileId, currentUserId });
          toast.error("Falta el perfil activo o usuario."); 
          return; 
        }
        const { error } = await supabase.from("appointments").insert({ ...payload, profile_id: dataProfileId, user_id: currentUserId });
        if (error) { 
          console.error("Insert error:", { code: error.code, message: error.message, details: error.details, hint: error.hint });
          const msg = error.code === "42501" ? "No tenés permisos para crear." : 
                      error.code === "23503" ? "Error de referencia: verificá el perfil." : t.toast.error;
          toast.error(msg); 
          return; 
        }
      }
      
      setDialogOpen(false);
      resetForm();
      toast.success(editingId ? t.toast.changesUpdated : t.toast.appointmentCreated);
      pwaTracking.markFirstAction();
      fetchData();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    if (!canDelete) {
      toast.error("You don't have permission to delete appointments.");
      setDeleteId(null);
      return;
    }
    const { error } = await supabase.from("appointments").delete().eq("id", deleteId);
    if (error) { 
      toast.error("You don't have permission to delete appointments."); 
      setDeleteId(null);
      return; 
    }
    toast.success(t.toast.deletedSuccess);
    setDeleteId(null);
    setViewingAppointment(null);
    fetchData();
  }

  async function handleCreateDoctor(values: Record<string, string>): Promise<string | null> {
    if (!dataProfileId || !currentUserId) return null;
    const { data, error } = await supabase
      .from("doctors")
      .insert({ full_name: values.full_name.trim(), specialty: values.specialty?.trim() || null, profile_id: dataProfileId, user_id: currentUserId })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") { toast.error(lang === "es" ? "Ya existe un profesional con ese nombre en este perfil." : "A professional with that name already exists."); return null; }
      toast.error(t.toast.error); return null;
    }
    const { data: updated } = await supabase.from("doctors").select("id, full_name").eq("profile_id", dataProfileId).eq("is_active", true);
    setDoctors(updated || []);
    toast.success(t.toast.doctorAdded);
    return data?.id || null;
  }

  async function handleCreateInstitution(values: Record<string, string>): Promise<string | null> {
    if (!dataProfileId || !currentUserId) return null;
    const { data, error } = await supabase
      .from("institutions")
      .insert({ name: values.name.trim(), profile_id: dataProfileId, user_id: currentUserId })
      .select("id")
      .single();
    if (error) { toast.error(t.toast.error); return null; }
    const { data: updated } = await supabase.from("institutions").select("id, name").eq("profile_id", dataProfileId).eq("is_active", true);
    setInstitutions(updated || []);
    toast.success(t.toast.institutionAdded);
    return data?.id || null;
  }

  /** Handles professional picker value: sentinel __unassigned__ or real doctor ID */
  function handleDoctorChange(value: string) {
    if (value === UNASSIGNED_ID || value === "") {
      setForm(f => ({ ...f, doctor_id: "" }));
    } else {
      setForm(f => ({ ...f, doctor_id: value }));
    }
  }

  /** Build options for professional picker: active doctors + "No asignado" */
  const doctorOptions = [
    ...sortByName(doctors, "full_name").map((d) => ({ id: d.id, label: d.full_name })),
    { id: UNASSIGNED_ID, label: t.doctors.unassigned },
  ];

  /** Current picker value: real doctor_id or empty string (shows placeholder) */
  const doctorPickerValue = form.doctor_id || "";

  if (loading) return <LoadingPage />;

  // Detail View
  if (viewingAppointment) {
    const { hasTime } = isoToLocal(viewingAppointment.datetime_start);
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
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />{fromDashboard ? t.appointments.backToDashboard : t.appointments.backToAppointments}
        </Button>
        
        <div className="max-w-2xl space-y-6">
          <div className="health-card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">{viewingAppointment.reason || t.misc.appointment}</h1>
                <p className="text-muted-foreground">
                  {formatDateTime(viewingAppointment.datetime_start)}
                  {hasTime && ` at ${formatTime(viewingAppointment.datetime_start)}`}
                </p>
              </div>
              <StatusBadge status={getDisplayStatus(viewingAppointment) === "Past" ? "past" : normalizeStatus(getDisplayStatus(viewingAppointment))} />
            </div>
            
            <div className="space-y-3 text-sm">
              <div><span className="font-medium">{t.appointments.doctor}:</span> {viewingAppointment.doctors?.full_name || t.doctors.unassigned}</div>
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
      <PageHeader
        variant="gradient"
        title={t.appointments.title}
        description={t.appointments.description}
        actions={
          canEdit ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />{t.appointments.addAppointment}
            </Button>
          ) : null
        }
      />

      <ResponsiveFormModal
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}
        title={editingId ? t.appointments.editAppointment : t.appointments.newAppointment}
        maxWidth="lg"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)} disabled={isSaving}>{t.actions.cancel}</Button>
            <Button type="submit" form="appointment-form" disabled={isSaving}>
              {isSaving ? t.actions.saving : (editingId ? t.actions.saveChanges : t.appointments.createAppointment)}
            </Button>
          </div>
        }
      >
        <form id="appointment-form" onSubmit={handleSubmit} className="space-y-4">
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
            {/* Professional picker */}
            <div className="form-field">
              <Label>{t.appointments.doctor}</Label>
              <RelatedEntityPicker
                value={doctorPickerValue}
                onValueChange={handleDoctorChange}
                options={doctorOptions}
                placeholder={lang === "es" ? "Seleccionar profesional..." : "Select professional..."}
                searchPlaceholder={lang === "es" ? "Buscar..." : "Search..."}
                emptyText={lang === "es" ? "Sin resultados." : "No results."}
                addNewLabel={t.doctors.addDoctor}
                modalTitle={t.doctors.newDoctor}
                modalIcon={<Stethoscope className="h-5 w-5" />}
                fields={[
                  { key: "full_name", label: t.doctors.fullName, required: true },
                  { key: "specialty", label: t.doctors.specialty, placeholder: t.doctors.specialtyPlaceholder },
                ]}
                onCreate={handleCreateDoctor}
              />
            </div>
            {/* Institution picker */}
            <div className="form-field">
              <Label>{t.appointments.institution}</Label>
              <RelatedEntityPicker
                value={form.institution_id}
                onValueChange={(v) => setForm({ ...form, institution_id: v })}
                options={institutions.map((i) => ({ id: i.id, label: i.name }))}
                placeholder={t.appointments.selectInstitution}
                searchPlaceholder={lang === "es" ? "Buscar institución..." : "Search institution..."}
                emptyText={lang === "es" ? "Sin resultados." : "No results."}
                addNewLabel={t.institutions.addNewInstitution}
                modalTitle={t.institutions.newInstitution}
                modalIcon={<Building2 className="h-5 w-5" />}
                fields={[
                  { key: "name", label: t.institutions.name, placeholder: lang === "es" ? "Nombre de la institución" : "Institution name", required: true },
                ]}
                onCreate={handleCreateInstitution}
              />
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
        </form>
      </ResponsiveFormModal>

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

      {appointments.length === 0 ? (
        <EmptyState icon={Calendar} title={t.appointments.noAppointments} description={t.appointments.noAppointmentsDescription} action={canEdit ? { label: t.appointments.addAppointment, onClick: () => setDialogOpen(true) } : undefined} />
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
                    const { hasTime } = isoToLocal(apt.datetime_start);
                    const attachCount = attachmentCounts[apt.id] || 0;
                    const displayStatus = getDisplayStatus(apt);
                    return (
                      <div key={apt.id} className="health-card">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">
                              {formatDateTime(apt.datetime_start, { month: "short", day: "numeric", year: "numeric" })}
                              {hasTime && ` at ${formatTime(apt.datetime_start)}`}
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
                          {canEdit && (
                            <Button variant="ghost" size="sm" onClick={() => openEdit(apt)}>
                              <Pencil className="h-4 w-4 mr-1" />{t.actions.edit}
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="sm" onClick={() => setDeleteId(apt.id)}>
                              <Trash2 className="h-4 w-4 mr-1 text-destructive" />{t.actions.delete}
                            </Button>
                          )}
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
                        const { hasTime } = isoToLocal(apt.datetime_start);
                        const dateDisplay = formatDateTime(apt.datetime_start, { month: "short", day: "numeric", year: "numeric" });
                        const timeDisplay = hasTime ? ` ${formatTime(apt.datetime_start)}` : "";
                        return (
                          <tr key={apt.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-4">{dateDisplay}{timeDisplay}</td>
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
                                {canEdit && (
                                  <Button variant="ghost" size="icon" onClick={() => openEdit(apt)} aria-label={t.actions.edit}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(apt.id)} aria-label={t.actions.delete}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
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
