import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Stethoscope, Pencil, Trash2, Eye, Phone, Mail, Search, Filter, ArrowLeft, Building2, ToggleLeft, ToggleRight, Calendar, FlaskConical, Syringe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveFormModal } from "@/components/ui/responsive-form-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { RelatedEntityPicker } from "@/components/ui/related-entity-picker";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import { useTranslations, getLanguage } from "@/i18n";
import { sortByName } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const SPECIALTY_KEYS = [
  "cardiology", "dermatology", "endocrinology", "gastroenterology",
  "generalPractice", "gynecology", "neurology", "ophthalmology",
  "orthopedics", "pediatrics", "psychiatry", "pulmonology", "urology", "other",
] as const;

export default function Doctors() {
  const { dataProfileId, activeProfileId, currentUserId, canEdit, canDelete } = useActiveProfile();
  const t = useTranslations();
  const lang = getLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState<any | null>(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Linked records
  const [linkedAppointments, setLinkedAppointments] = useState<any[]>([]);
  const [linkedProcedures, setLinkedProcedures] = useState<any[]>([]);
  const [linkedTests, setLinkedTests] = useState<any[]>([]);
  const [linkedLoading, setLinkedLoading] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("active");
  const [filterSpecialty, setFilterSpecialty] = useState<string>("all");
  
  const [form, setForm] = useState({
    full_name: "", specialty: "", phone: "", email: "", notes: "",
    license_number: "", address: "", institution_id: "",
  });

  useEffect(() => { if (activeProfileId) fetchData(); }, [activeProfileId]);

  async function fetchData() {
    if (!activeProfileId) return;
    setLoading(true);
    const [docRes, instRes] = await Promise.all([
      supabase.from("doctors").select("*, institutions(name)").eq("profile_id", activeProfileId).order("full_name"),
      supabase.from("institutions").select("id, name").eq("profile_id", activeProfileId).eq("is_active", true).order("name"),
    ]);
    setDoctors(docRes.data || []);
    setInstitutions(instRes.data || []);
    setLoading(false);
  }

  const fetchLinkedRecords = useCallback(async (doctorId: string) => {
    if (!activeProfileId) return;
    setLinkedLoading(true);
    const [apptRes, procRes, testRes] = await Promise.all([
      supabase.from("appointments").select("id, datetime_start, reason, status, institutions(name)")
        .eq("doctor_id", doctorId).eq("profile_id", activeProfileId)
        .order("datetime_start", { ascending: false }),
      supabase.from("procedures").select("id, date, title, type, institutions(name)")
        .eq("doctor_id", doctorId).eq("profile_id", activeProfileId)
        .order("date", { ascending: false }),
      supabase.from("tests").select("id, date, type, institutions(name)")
        .eq("doctor_id", doctorId).eq("profile_id", activeProfileId)
        .order("date", { ascending: false }),
    ]);
    setLinkedAppointments(apptRes.data || []);
    setLinkedProcedures(procRes.data || []);
    setLinkedTests(testRes.data || []);
    setLinkedLoading(false);
  }, [activeProfileId]);

  function openDetailView(doctor: any) {
    setViewDialog(doctor);
    setShowContactInfo(false);
    fetchLinkedRecords(doctor.id);
  }

  function openEdit(doctor: any) {
    setEditingId(doctor.id);
    setForm({
      full_name: doctor.full_name || "",
      specialty: doctor.specialty || "",
      phone: doctor.phone || "",
      email: doctor.email || "",
      notes: doctor.notes || "",
      license_number: doctor.license_number || "",
      address: doctor.address || "",
      institution_id: doctor.institution_id || "",
    });
    setViewDialog(null);
    setShowContactInfo(false);
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ full_name: "", specialty: "", phone: "", email: "", notes: "", license_number: "", address: "", institution_id: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) { toast.error(lang === "es" ? "Tenés acceso de solo lectura." : "You have view-only access."); return; }
    if (!form.full_name) { toast.error(t.doctors.nameRequired); return; }
    
    setIsSaving(true);
    const payload = {
      full_name: form.full_name,
      specialty: form.specialty || null,
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,
      license_number: form.license_number || null,
      address: form.address || null,
      institution_id: form.institution_id || null,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("doctors").update(payload).eq("id", editingId);
        if (error) {
          console.error("Update error:", error);
          toast.error(error.code === "42501" ? (lang === "es" ? "No tenés permisos para editar." : "No permission to edit.") : t.toast.error);
          return;
        }
      } else {
        if (!dataProfileId || !currentUserId) { toast.error(t.toast.error); return; }
        const { error } = await supabase.from("doctors").insert({ profile_id: dataProfileId, user_id: currentUserId, ...payload });
        if (error) {
          console.error("Insert error:", error);
          toast.error(t.toast.error);
          return;
        }
      }
      setDialogOpen(false);
      resetForm();
      toast.success(editingId ? t.toast.changesUpdated : t.toast.savedSuccess);
      fetchData();
    } finally { setIsSaving(false); }
  }

  async function handleDeactivate() {
    if (!deactivateId) return;
    const doctor = doctors.find(d => d.id === deactivateId);
    if (!doctor) return;
    
    const newStatus = !doctor.is_active;
    const { error } = await supabase.from("doctors").update({
      is_active: newStatus,
      deactivated_at: newStatus ? null : new Date().toISOString(),
    }).eq("id", deactivateId);
    
    if (error) { toast.error(t.toast.error); return; }
    toast.success(newStatus ? (lang === "es" ? "Profesional reactivado." : "Professional reactivated.") : (lang === "es" ? "Profesional desactivado." : "Professional deactivated."));
    setDeactivateId(null);
    setViewDialog(null);
    fetchData();
  }

  async function handleCreateInstitution(values: Record<string, string>): Promise<string | null> {
    if (!dataProfileId || !currentUserId) return null;
    const { data, error } = await supabase.from("institutions").insert({ name: values.name.trim(), profile_id: dataProfileId, user_id: currentUserId }).select("id").single();
    if (error) { toast.error(t.toast.error); return null; }
    const { data: updated } = await supabase.from("institutions").select("id, name").eq("profile_id", dataProfileId).eq("is_active", true);
    setInstitutions(updated || []);
    toast.success(t.toast.institutionAdded);
    return data?.id || null;
  }

  // Get unique specialties for filter
  const uniqueSpecialties = useMemo(() => {
    const specs = new Set(doctors.map(d => d.specialty).filter(Boolean));
    return Array.from(specs).sort();
  }, [doctors]);

  // Specialty options for combobox
  const specialtyOptions = useMemo(() => {
    return SPECIALTY_KEYS.map(key => ({
      value: t.doctors.specialtyOptions[key],
      label: t.doctors.specialtyOptions[key],
    }));
  }, [t]);

  // Filtered doctors
  const filteredDoctors = useMemo(() => {
    const filtered = doctors.filter(d => {
      if (filterStatus === "active" && !d.is_active) return false;
      if (filterStatus === "inactive" && d.is_active) return false;
      if (filterSpecialty !== "all" && d.specialty !== filterSpecialty) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return d.full_name.toLowerCase().includes(q) || (d.specialty?.toLowerCase().includes(q));
      }
      return true;
    });
    return sortByName(filtered, "full_name");
  }, [doctors, filterStatus, filterSpecialty, searchQuery]);

  if (loading) return <LoadingPage />;

  // Detail View
  if (viewDialog) {
    return (
      <div className="animate-fade-in">
        <Button variant="ghost" onClick={() => { setViewDialog(null); setShowContactInfo(false); }} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />{lang === "es" ? "Volver a Profesionales" : "Back to Professionals"}
        </Button>
        
        <div className="max-w-3xl space-y-6">
          {/* Section 1: Professional data */}
          <div className="health-card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">{viewDialog.full_name}</h1>
                {viewDialog.specialty && <p className="text-primary">{viewDialog.specialty}</p>}
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${viewDialog.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {viewDialog.is_active ? t.doctors.active : t.doctors.inactive}
              </span>
            </div>
            
            <div className="space-y-3 text-sm">
              {viewDialog.license_number && <div><span className="font-medium">{t.doctors.licenseNumber}:</span> {viewDialog.license_number}</div>}
              {viewDialog.institutions?.name && <div><span className="font-medium">{t.doctors.institution}:</span> {viewDialog.institutions.name}</div>}
              {viewDialog.address && <div><span className="font-medium">{t.doctors.address}:</span> {viewDialog.address}</div>}
              
              {(viewDialog.phone || viewDialog.email) && !showContactInfo && (
                <Button variant="outline" size="sm" onClick={() => setShowContactInfo(true)} className="min-h-[44px]">
                  <Phone className="h-4 w-4 mr-2" />{t.doctors.revealContact}
                </Button>
              )}
              {showContactInfo && (
                <>
                  {viewDialog.phone && <div><span className="font-medium">{t.doctors.phone}:</span> {viewDialog.phone}</div>}
                  {viewDialog.email && <div><span className="font-medium">{t.doctors.email}:</span> {viewDialog.email}</div>}
                </>
              )}
              
              {viewDialog.notes && <div><span className="font-medium">{t.doctors.notes}:</span> {viewDialog.notes}</div>}
            </div>
            
            {(canEdit || canDelete) && (
              <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t">
                {canEdit && (
                  <Button onClick={() => openEdit(viewDialog)}>
                    <Pencil className="h-4 w-4 mr-2" />{t.actions.edit}
                  </Button>
                )}
                {canEdit && (
                  <Button variant="outline" onClick={() => setDeactivateId(viewDialog.id)}>
                    {viewDialog.is_active ? <ToggleLeft className="h-4 w-4 mr-2" /> : <ToggleRight className="h-4 w-4 mr-2" />}
                    {viewDialog.is_active ? t.doctors.deactivate : t.doctors.reactivate}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Linked records */}
          {linkedLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <LoadingPage />
            </div>
          ) : (
            <>
              {/* A) Appointments */}
              <div className="health-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {t.doctors.linkedAppointments} ({linkedAppointments.length})
                </h2>
                {linkedAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.doctors.noLinkedRecords}</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {linkedAppointments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{a.reason || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(a.datetime_start), "dd/MM/yyyy")}
                            {a.institutions?.name && ` · ${a.institutions.name}`}
                            {a.status && ` · ${a.status}`}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => navigate("/appointments")}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* B) Procedures */}
              <div className="health-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Syringe className="h-5 w-5 text-primary" />
                  {t.doctors.linkedProcedures} ({linkedProcedures.length})
                </h2>
                {linkedProcedures.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.doctors.noLinkedRecords}</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {linkedProcedures.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{p.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(p.date), "dd/MM/yyyy")}
                            {p.institutions?.name && ` · ${p.institutions.name}`}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => navigate("/procedures")}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* C) Tests */}
              <div className="health-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  {t.doctors.linkedTests} ({linkedTests.length})
                </h2>
                {linkedTests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.doctors.noLinkedRecords}</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {linkedTests.map((te) => (
                      <div key={te.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{te.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(te.date), "dd/MM/yyyy")}
                            {te.institutions?.name && ` · ${te.institutions.name}`}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => navigate("/tests")}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        
        {/* Deactivate Confirmation */}
        <AlertDialog open={!!deactivateId} onOpenChange={(open) => !open && setDeactivateId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.doctors.deactivateConfirm}</AlertDialogTitle>
              <AlertDialogDescription>{t.doctors.deactivateDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeactivate}>{t.actions.confirm}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader variant="gradient" title={t.doctors.title} description={t.doctors.description}
        actions={
          canEdit ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />{t.doctors.addDoctor}
            </Button>
          ) : undefined
        }
      />

      {/* Search & Filters */}
      {doctors.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.doctors.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.doctors.allStatuses}</SelectItem>
              <SelectItem value="active">{t.doctors.active}</SelectItem>
              <SelectItem value="inactive">{t.doctors.inactive}</SelectItem>
            </SelectContent>
          </Select>
          {uniqueSpecialties.length > 1 && (
            <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.doctors.allSpecialties}</SelectItem>
                {uniqueSpecialties.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <ResponsiveFormModal
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}
        title={editingId ? t.doctors.editDoctor : t.doctors.newDoctor}
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)} disabled={isSaving}>{t.actions.cancel}</Button>
            <Button type="submit" form="doctor-form" disabled={isSaving}>
              {isSaving ? t.actions.saving : (editingId ? t.actions.saveChanges : t.doctors.addDoctor)}
            </Button>
          </div>
        }
      >
        <form id="doctor-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="form-field"><Label>{t.doctors.fullName} *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
          
          {/* Specialty - editable combobox via datalist */}
          <div className="form-field">
            <Label>{t.doctors.specialty}</Label>
            <Input
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              placeholder={t.doctors.specialtyPlaceholder}
              list="specialty-options"
            />
            <datalist id="specialty-options">
              {specialtyOptions.map(opt => <option key={opt.value} value={opt.value} />)}
            </datalist>
          </div>
          
          <div className="form-field"><Label>{t.doctors.licenseNumber}</Label><Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} placeholder={t.doctors.licenseNumberPlaceholder} /></div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="form-field"><Label>{t.doctors.phone}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="form-field"><Label>{t.doctors.email}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          
          <div className="form-field"><Label>{t.doctors.address}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t.doctors.addressPlaceholder} /></div>
          
          <div className="form-field">
            <Label>{t.doctors.institution}</Label>
            <RelatedEntityPicker
              value={form.institution_id}
              onValueChange={(v) => setForm({ ...form, institution_id: v })}
              options={institutions.map(i => ({ id: i.id, label: i.name }))}
              placeholder={t.doctors.selectInstitution}
              searchPlaceholder={lang === "es" ? "Buscar..." : "Search..."}
              emptyText={lang === "es" ? "Sin resultados." : "No results."}
              addNewLabel={t.institutions.addNewInstitution}
              modalTitle={t.institutions.newInstitution}
              modalIcon={<Building2 className="h-5 w-5" />}
              fields={[{ key: "name", label: t.institutions.name, required: true }]}
              onCreate={handleCreateInstitution}
            />
          </div>
          
          <div className="form-field"><Label>{t.doctors.notes}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </form>
      </ResponsiveFormModal>

      {/* Deactivate Confirmation */}
      <AlertDialog open={!!deactivateId} onOpenChange={(open) => !open && setDeactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.doctors.deactivateConfirm}</AlertDialogTitle>
            <AlertDialogDescription>{t.doctors.deactivateDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>{t.actions.confirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {filteredDoctors.length === 0 && doctors.length === 0 ? (
        <EmptyState icon={Stethoscope} title={t.doctors.noDoctors} description={t.doctors.noDoctorsDescription} action={canEdit ? { label: t.doctors.addDoctor, onClick: () => setDialogOpen(true) } : undefined} />
      ) : filteredDoctors.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">{lang === "es" ? "No se encontraron resultados." : "No results found."}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDoctors.map((d) => (
            <div key={d.id} className={`health-card cursor-pointer hover:shadow-md transition-shadow ${!d.is_active ? "opacity-60" : ""}`} onClick={() => openDetailView(d)}>
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{d.full_name}</h3>
                  {d.specialty && <p className="text-sm text-primary">{d.specialty}</p>}
                  {d.institutions?.name && <p className="text-sm text-muted-foreground">{d.institutions.name}</p>}
                </div>
                {!d.is_active && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground ml-2 shrink-0">{t.doctors.inactive}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
