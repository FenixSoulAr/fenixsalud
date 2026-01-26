import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Pill, Pencil, Trash2, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveFormModal } from "@/components/ui/responsive-form-modal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, normalizeStatus } from "@/components/ui/status-badge";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import { useTranslations } from "@/i18n";

export default function Medications() {
  const { dataProfileId, activeProfileId, currentUserId, canEdit, canDelete } = useActiveProfile();
  const t = useTranslations();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<any[]>([]);
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("new") === "true");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", dose_text: "", schedule_type: "Daily", times: "", notes: "", status: "Active", diagnosis_id: "" });

  useEffect(() => { if (activeProfileId) fetchData(); }, [activeProfileId]);
  
  // Handle URL params for auto-editing
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && medications.length > 0) {
      const med = medications.find(m => m.id === editId);
      if (med) openEdit(med);
    }
  }, [searchParams, medications]);

  async function fetchData() {
    if (!activeProfileId) return;
    setLoading(true);
    
    // Fetch medications and diagnoses in parallel
    const [medsResult, diagsResult] = await Promise.all([
      supabase.from("medications").select("*").eq("profile_id", activeProfileId).order("name", { ascending: true }),
      supabase.from("diagnoses").select("*").eq("profile_id", activeProfileId).eq("status", "active").order("condition", { ascending: true })
    ]);
    
    setMedications(medsResult.data || []);
    setDiagnoses(diagsResult.data || []);
    setLoading(false);
  }

  function openEdit(med: any) {
    setEditingId(med.id);
    setForm({
      name: med.name || "",
      dose_text: med.dose_text || "",
      schedule_type: med.schedule_type || "Daily",
      times: med.times ? med.times.join(", ") : "",
      notes: med.notes || "",
      status: med.status || "Active",
      diagnosis_id: med.diagnosis_id || "",
    });
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ name: "", dose_text: "", schedule_type: "Daily", times: "", notes: "", status: "Active", diagnosis_id: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) { toast.error("You have view-only access to this profile."); return; }
    if (!form.name) { toast.error(t.medications.nameRequired); return; }
    if (!form.dose_text) { toast.error(t.medications.doseRequired); return; }
    if (form.schedule_type === "Daily" && !form.times) { toast.error(t.medications.timesRequired); return; }
    
    const payload = {
      name: form.name,
      dose_text: form.dose_text,
      schedule_type: form.schedule_type as any,
      times: form.times ? form.times.split(",").map(t => t.trim()) : [],
      notes: form.notes || null,
      status: form.status as any,
      diagnosis_id: form.diagnosis_id || null,
    };

    if (editingId) {
      const { error } = await supabase.from("medications").update(payload).eq("id", editingId);
      if (error) { 
        console.error("Update error:", { code: error.code, message: error.message, details: error.details, hint: error.hint });
        toast.error(error.code === "42501" ? "No tenés permisos para editar." : t.toast.error); 
        return; 
      }
      toast.success(t.toast.changesUpdated);
    } else {
      if (!dataProfileId || !currentUserId) { 
        console.error("Missing IDs:", { dataProfileId, currentUserId });
        toast.error("Falta el perfil activo o usuario."); 
        return; 
      }
      console.log("Inserting medication:", { profile_id: dataProfileId, user_id: currentUserId, ...payload });
      const { error } = await supabase.from("medications").insert({ ...payload, profile_id: dataProfileId, user_id: currentUserId });
      if (error) { 
        console.error("Insert error:", { code: error.code, message: error.message, details: error.details, hint: error.hint });
        const msg = error.code === "42501" ? "No tenés permisos para crear." : 
                    error.code === "23503" ? "Error de referencia: verificá el perfil." : t.toast.error;
        toast.error(msg); 
        return; 
      }
      toast.success(t.toast.savedSuccess);
    }
    
    setDialogOpen(false);
    resetForm();
    fetchData();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("medications").delete().eq("id", deleteId);
    if (error) { toast.error(t.toast.error); return; }
    toast.success(t.toast.deletedSuccess);
    setDeleteId(null);
    fetchData();
  }

  const active = medications.filter(m => m.status === "Active");
  const paused = medications.filter(m => m.status === "Paused");
  const completed = medications.filter(m => m.status === "Completed");

  if (loading) return <LoadingPage />;

  // Helper to get diagnosis name by ID
  const getDiagnosisName = (diagnosisId: string | null) => {
    if (!diagnosisId) return null;
    const diag = diagnoses.find(d => d.id === diagnosisId);
    return diag?.condition || null;
  };

  const MedList = ({ meds }: { meds: any[] }) => meds.length === 0 ? <p className="text-muted-foreground text-center py-8">{t.medications.noMedicationsTab}</p> : (
    <div className="space-y-3">{meds.map((m) => {
      const diagName = getDiagnosisName(m.diagnosis_id);
      return (
        <div key={m.id} className="health-card flex items-center justify-between">
          <div>
            <p className="font-medium">{m.name}</p>
            <p className="text-sm text-muted-foreground">{m.dose_text} • {m.schedule_type === "Daily" ? t.medications.daily : m.schedule_type === "Weekly" ? t.medications.weekly : t.medications.asNeeded}</p>
            {m.times && m.times.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{t.medications.times}: {m.times.join(", ")}</p>
            )}
            {diagName && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <HeartPulse className="h-3 w-3" />
                {diagName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={normalizeStatus(m.status)} />
            <div className="flex items-center gap-1">
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => openEdit(m)} aria-label={t.actions.edit}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {canDelete && (
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(m.id)} aria-label={t.actions.delete}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    })}</div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader variant="gradient" title={t.medications.title} description={t.medications.description}
        actions={
          canEdit ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />{t.medications.addMedication}
            </Button>
          ) : undefined
        }
      />

      <ResponsiveFormModal
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}
        title={editingId ? t.medications.editMedication : t.medications.newMedication}
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>{t.actions.cancel}</Button>
            <Button type="submit" form="medication-form">{editingId ? t.actions.saveChanges : t.medications.addMedication}</Button>
          </div>
        }
      >
        <form id="medication-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="form-field"><Label>{t.medications.name} *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t.medications.namePlaceholder} required /></div>
          <div className="form-field"><Label>{t.medications.dose} *</Label><Input value={form.dose_text} onChange={(e) => setForm({ ...form, dose_text: e.target.value })} placeholder={t.medications.dosePlaceholder} required /></div>
          <div className="form-field">
            <Label>{t.medications.schedule}</Label>
            <Select value={form.schedule_type} onValueChange={(v) => setForm({ ...form, schedule_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Daily">{t.medications.daily}</SelectItem>
                <SelectItem value="Weekly">{t.medications.weekly}</SelectItem>
                <SelectItem value="As needed">{t.medications.asNeeded}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.schedule_type === "Daily" && <div className="form-field"><Label>{t.medications.times}</Label><Input value={form.times} onChange={(e) => setForm({ ...form, times: e.target.value })} placeholder={t.medications.timesPlaceholder} /></div>}
          {editingId && (
            <div className="form-field">
              <Label>{t.medications.status}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">{t.medications.active}</SelectItem>
                  <SelectItem value="Paused">{t.medications.paused}</SelectItem>
                  <SelectItem value="Completed">{t.medications.completed}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="form-field">
            <Label>{t.medications.diagnosis}</Label>
            <Select 
              value={form.diagnosis_id || "none"} 
              onValueChange={(v) => setForm({ ...form, diagnosis_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue>
                  {form.diagnosis_id 
                    ? diagnoses.find(d => d.id === form.diagnosis_id)?.condition || "—"
                    : t.medications.selectDiagnosis
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent position="popper" className="z-[200]">
                <SelectItem value="none">—</SelectItem>
                {diagnoses.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.condition}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{t.medications.diagnosisHelper}</p>
          </div>
          <div className="form-field"><Label>{t.medications.notes}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </form>
      </ResponsiveFormModal>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.medications.deleteMedication}</AlertDialogTitle>
            <AlertDialogDescription>{t.medications.deleteMedicationDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t.actions.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {medications.length === 0 ? (
        <EmptyState icon={Pill} title={t.medications.noMedications} description={t.medications.noMedicationsDescription} action={canEdit ? { label: t.medications.addMedication, onClick: () => setDialogOpen(true) } : undefined} />
      ) : (
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList>
            <TabsTrigger value="active">{t.medications.active} ({active.length})</TabsTrigger>
            <TabsTrigger value="paused">{t.medications.paused} ({paused.length})</TabsTrigger>
            <TabsTrigger value="completed">{t.medications.completed} ({completed.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active"><MedList meds={active} /></TabsContent>
          <TabsContent value="paused"><MedList meds={paused} /></TabsContent>
          <TabsContent value="completed"><MedList meds={completed} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
