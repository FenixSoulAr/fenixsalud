import { useState, useEffect } from "react";
import { Plus, Syringe, Pencil, Trash2, Eye, ArrowLeft, Filter, Crown, Building2, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveFormModal } from "@/components/ui/responsive-form-modal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { FileAttachments } from "@/components/FileAttachments";
import { AttachmentIndicator } from "@/components/AttachmentIndicator";
import { RelatedEntityPicker } from "@/components/ui/related-entity-picker";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useEntitlementGate } from "@/hooks/useEntitlementGate";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslations, getLanguage } from "@/i18n";
import { useNavigate } from "react-router-dom";
import { sortByName } from "@/lib/utils";

type ProcedureType = "Surgery" | "Hospitalization" | "Vaccine";
const PROCEDURE_TYPES: ProcedureType[] = ["Surgery", "Hospitalization", "Vaccine"];

function getProcedureStatusStyle(type: ProcedureType) {
  switch (type) {
    case "Surgery": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "Hospitalization": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "Vaccine": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function Procedures() {
  const { dataProfileId, activeProfileId, currentUserId, canEdit, canDelete } = useActiveProfile();
  const { canUseProcedures, loading: entitlementsLoading } = useEntitlementGate();
  const navigate = useNavigate();
  const t = useTranslations();
  const lang = getLanguage();
  const [loading, setLoading] = useState(true);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewingProcedure, setViewingProcedure] = useState<any | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [isSaving, setIsSaving] = useState(false);
const UNASSIGNED_ID = "__unassigned__";
  const [form, setForm] = useState({ type: "Surgery" as ProcedureType, title: "", date: "", notes: "", institution_id: "", doctor_id: "" });
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  useEffect(() => { if (activeProfileId) fetchData(); }, [activeProfileId]);

  function getTranslatedType(type: ProcedureType) {
    switch (type) {
      case "Surgery": return t.procedures.surgery;
      case "Hospitalization": return t.procedures.hospitalization;
      case "Vaccine": return t.procedures.vaccine;
      default: return type;
    }
  }

  async function fetchInstitutions() {
    const { data } = await supabase
      .from("institutions")
      .select("id, name")
      .eq("profile_id", activeProfileId)
      .eq("is_active", true)
      .order("name");
    setInstitutions(data || []);
  }

  async function fetchDoctors() {
    const { data } = await supabase
      .from("doctors")
      .select("id, full_name")
      .eq("profile_id", activeProfileId)
      .eq("is_active", true)
      .order("full_name");
    setDoctors(data || []);
  }

  async function fetchData() {
    if (!activeProfileId) return;
    setLoading(true);
    const [procRes, instRes, docRes] = await Promise.all([
      supabase.from("procedures").select("*, institutions(name), doctors(full_name)").eq("profile_id", activeProfileId).order("date", { ascending: false }),
      supabase.from("institutions").select("id, name").eq("profile_id", activeProfileId).eq("is_active", true),
      supabase.from("doctors").select("id, full_name").eq("profile_id", activeProfileId).eq("is_active", true),
    ]);
    setProcedures(procRes.data || []);
    setInstitutions(instRes.data || []);
    setDoctors(docRes.data || []);
    
    if ((procRes.data || []).length > 0) {
      const { data: attachments } = await supabase.from("file_attachments").select("entity_id").eq("entity_type", "Procedure").in("entity_id", (procRes.data || []).map(p => p.id));
      const counts: Record<string, number> = {};
      (attachments || []).forEach(att => { counts[att.entity_id] = (counts[att.entity_id] || 0) + 1; });
      setAttachmentCounts(counts);
    }
    setLoading(false);
  }

  function openEdit(procedure: any) {
    setEditingId(procedure.id);
    setForm({ type: procedure.type || "Surgery", title: procedure.title || "", date: procedure.date || "", notes: procedure.notes || "", institution_id: procedure.institution_id || "", doctor_id: procedure.doctor_id || "" });
    setViewingProcedure(null);
    setDialogOpen(true);
  }

  function resetForm() { setEditingId(null); setForm({ type: "Surgery", title: "", date: "", notes: "", institution_id: "", doctor_id: "" }); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) { toast.error("You have view-only access."); return; }
    if (!form.title) { toast.error(t.procedures.titleRequired); return; }
    if (!form.date) { toast.error(t.procedures.dateRequired); return; }
    
    setIsSaving(true);
    const professionalStatus = form.doctor_id ? "assigned" : "unassigned";
    const payload = { type: form.type, title: form.title, date: form.date, notes: form.notes || null, institution_id: form.institution_id || null, doctor_id: form.doctor_id || null, professional_status: professionalStatus as any };

    try {
      if (editingId) {
        const { error } = await supabase.from("procedures").update(payload).eq("id", editingId);
        if (error) { toast.error(t.toast.error); return; }
      } else {
        if (!dataProfileId || !currentUserId) { toast.error("Missing profile."); return; }
        const { error } = await supabase.from("procedures").insert({ ...payload, profile_id: dataProfileId, user_id: currentUserId });
        if (error) { toast.error(t.toast.error); return; }
      }
      setDialogOpen(false); resetForm();
      toast.success(editingId ? t.toast.changesUpdated : t.toast.savedSuccess);
      fetchData();
    } finally { setIsSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("procedures").delete().eq("id", deleteId);
    if (error) { toast.error(t.toast.error); return; }
    toast.success(t.toast.deletedSuccess);
    setDeleteId(null); setViewingProcedure(null); fetchData();
  }

  async function handleCreateInstitution(values: Record<string, string>): Promise<string | null> {
    if (!dataProfileId || !currentUserId) return null;
    const { data, error } = await supabase.from("institutions").insert({ name: values.name.trim(), profile_id: dataProfileId, user_id: currentUserId }).select("id").single();
    if (error) { toast.error(t.toast.error); return null; }
    // Refresh institutions list (only active)
    const { data: updated } = await supabase.from("institutions").select("id, name").eq("profile_id", dataProfileId).eq("is_active", true);
    setInstitutions(updated || []);
    toast.success(t.toast.institutionAdded);
    return data?.id || null;
  }

  async function handleCreateDoctor(values: Record<string, string>): Promise<string | null> {
    if (!dataProfileId || !currentUserId) return null;
    const { data, error } = await supabase.from("doctors").insert({ full_name: values.full_name.trim(), specialty: values.specialty?.trim() || null, profile_id: dataProfileId, user_id: currentUserId }).select("id").single();
    if (error) {
      if (error.code === "23505") { toast.error(lang === "es" ? "Ya existe un profesional con ese nombre en este perfil." : "A professional with that name already exists."); return null; }
      toast.error(t.toast.error); return null;
    }
    const { data: updated } = await supabase.from("doctors").select("id, full_name").eq("profile_id", dataProfileId).eq("is_active", true);
    setDoctors(updated || []);
    toast.success(t.toast.doctorAdded);
    return data?.id || null;
  }

  const filteredProcedures = filterType === "all" ? procedures : procedures.filter(p => p.type === filterType);

  if (loading || entitlementsLoading) return <LoadingPage />;

  if (!canUseProcedures) {
    return (
      <div className="animate-fade-in">
        <PageHeader variant="gradient" title={t.procedures.title} description={t.procedures.description} />
        <div className="max-w-lg mx-auto text-center py-12">
          <Crown className="h-16 w-16 mx-auto mb-4 text-amber-500" />
          <h2 className="text-xl font-semibold mb-2">{lang === "es" ? "Esta función está disponible en Plus" : "This feature is available in Plus"}</h2>
          <Button onClick={() => navigate("/pricing?highlight=plus")}>{lang === "es" ? "Ver planes" : "See plans"}</Button>
        </div>
      </div>
    );
  }

  if (viewingProcedure) {
    return (
      <div className="animate-fade-in">
        <Button variant="ghost" onClick={() => setViewingProcedure(null)} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" />{t.procedures.backToProcedures}</Button>
        <div className="max-w-2xl space-y-6">
          <div className="health-card">
            <div className="flex items-start justify-between mb-4">
              <div><h1 className="text-2xl font-bold">{viewingProcedure.title}</h1><p className="text-muted-foreground">{format(new Date(viewingProcedure.date), "MMMM d, yyyy")}</p></div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getProcedureStatusStyle(viewingProcedure.type)}`}>{getTranslatedType(viewingProcedure.type)}</span>
            </div>
            <div className="space-y-3 text-sm">
              {viewingProcedure.institutions?.name && <div><span className="font-medium">{t.procedures.institution}:</span> {viewingProcedure.institutions.name}</div>}
              {viewingProcedure.doctors?.full_name && <div><span className="font-medium">{t.procedures.doctor}:</span> {viewingProcedure.doctors.full_name}</div>}
              {viewingProcedure.notes && <div><span className="font-medium">{t.procedures.notes}:</span> {viewingProcedure.notes}</div>}
            </div>
            {(canEdit || canDelete) && (
              <div className="flex gap-2 mt-6 pt-4 border-t">
                {canEdit && <Button onClick={() => openEdit(viewingProcedure)}><Pencil className="h-4 w-4 mr-2" />{t.actions.edit}</Button>}
                {canDelete && <Button variant="destructive" onClick={() => setDeleteId(viewingProcedure.id)}><Trash2 className="h-4 w-4 mr-2" />{t.actions.delete}</Button>}
              </div>
            )}
          </div>
          <div className="health-card"><FileAttachments entityType="Procedure" entityId={viewingProcedure.id} /></div>
        </div>
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t.dialogs.deleteItem}</AlertDialogTitle><AlertDialogDescription>{t.dialogs.deleteItemDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t.actions.delete}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader variant="gradient" title={t.procedures.title} description={t.procedures.description} actions={canEdit ? <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />{t.procedures.addProcedure}</Button> : undefined} />

      <ResponsiveFormModal open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }} title={editingId ? t.procedures.editProcedure : t.procedures.newProcedure} footer={<div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end"><Button variant="outline" type="button" onClick={() => setDialogOpen(false)} disabled={isSaving}>{t.actions.cancel}</Button><Button type="submit" form="procedure-form" disabled={isSaving}>{isSaving ? t.actions.saving : (editingId ? t.actions.saveChanges : t.procedures.createProcedure)}</Button></div>}>
        <form id="procedure-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="form-field"><Label>{t.procedures.type} *</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ProcedureType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROCEDURE_TYPES.map(type => <SelectItem key={type} value={type}>{getTranslatedType(type)}</SelectItem>)}</SelectContent></Select></div>
          <div className="form-field"><Label>{t.procedures.title_field} *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t.procedures.titlePlaceholder} required /></div>
          <div className="form-field"><Label>{t.procedures.date} *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
          <div className="form-field">
            <Label>{t.procedures.institution}</Label>
            <RelatedEntityPicker value={form.institution_id} onValueChange={(v) => setForm({ ...form, institution_id: v })} options={institutions.map((i) => ({ id: i.id, label: i.name }))} placeholder={t.procedures.selectInstitution} searchPlaceholder={lang === "es" ? "Buscar..." : "Search..."} emptyText={lang === "es" ? "Sin resultados." : "No results."} addNewLabel={t.institutions.addNewInstitution} modalTitle={t.institutions.newInstitution} modalIcon={<Building2 className="h-5 w-5" />} fields={[{ key: "name", label: t.institutions.name, required: true }]} onCreate={handleCreateInstitution} />
          </div>
          <div className="form-field">
            <Label>{t.procedures.doctor}</Label>
            <RelatedEntityPicker
              value={form.doctor_id}
              onValueChange={(v) => {
                if (v === UNASSIGNED_ID || v === "") {
                  setForm({ ...form, doctor_id: "" });
                } else {
                  setForm({ ...form, doctor_id: v });
                }
              }}
              options={[
                ...sortByName(doctors, "full_name").map((d) => ({ id: d.id, label: d.full_name })),
                { id: UNASSIGNED_ID, label: t.doctors.unassigned },
              ]}
              placeholder={lang === "es" ? "Seleccionar profesional..." : "Select professional..."}
              searchPlaceholder={lang === "es" ? "Buscar..." : "Search..."}
              emptyText={lang === "es" ? "Sin resultados." : "No results."}
              addNewLabel={t.doctors.addDoctor}
              modalTitle={t.doctors.newDoctor}
              modalIcon={<Stethoscope className="h-5 w-5" />}
              fields={[{ key: "full_name", label: t.doctors.fullName, required: true }, { key: "specialty", label: t.doctors.specialty, placeholder: t.doctors.specialtyPlaceholder }]}
              onCreate={handleCreateDoctor}
            />
          </div>
          <div className="form-field"><Label>{t.procedures.notes}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </form>
      </ResponsiveFormModal>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t.dialogs.deleteItem}</AlertDialogTitle><AlertDialogDescription>{t.dialogs.deleteItemDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t.actions.delete}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      {/* Filter */}
      {procedures.length > 0 && (
        <div className="mb-6 flex items-center gap-2"><Filter className="h-4 w-4 text-muted-foreground" /><Select value={filterType} onValueChange={setFilterType}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t.procedures.allTypes}</SelectItem>{PROCEDURE_TYPES.map(type => <SelectItem key={type} value={type}>{getTranslatedType(type)}</SelectItem>)}</SelectContent></Select></div>
      )}

      {filteredProcedures.length === 0 && procedures.length === 0 ? (
        <EmptyState icon={Syringe} title={t.procedures.noProcedures} description={t.procedures.noProceduresDescription} action={canEdit ? { label: t.procedures.addProcedure, onClick: () => setDialogOpen(true) } : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProcedures.map((p) => {
            const attachCount = attachmentCounts[p.id] || 0;
            return (
              <div key={p.id} className="health-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setViewingProcedure(p)}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{p.title}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getProcedureStatusStyle(p.type)}`}>{getTranslatedType(p.type)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{format(new Date(p.date), "MMM d, yyyy")}</p>
                {p.institutions?.name && <p className="text-sm text-muted-foreground">{p.institutions.name}</p>}
                {attachCount > 0 && <div className="mt-2"><AttachmentIndicator entityType="Procedure" entityId={p.id} count={attachCount} /></div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
