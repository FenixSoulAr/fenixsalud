import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, HeartPulse, Pencil, Trash2, Pill } from "lucide-react";
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
import { pwaTracking } from "@/utils/pwaTracking";
import { useTranslations } from "@/i18n";
import { format } from "date-fns";
import { parseDateOnly } from "@/lib/dateUtils";

export default function Diagnoses() {
  const { dataProfileId, activeProfileId, currentUserId, canEdit, canDelete } = useActiveProfile();
  const t = useTranslations();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
  const [linkedMeds, setLinkedMeds] = useState<Record<string, any[]>>({});
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("new") === "true");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ condition: "", notes: "", diagnosed_date: "", status: "active" });

  useEffect(() => { if (activeProfileId) fetchData(); }, [activeProfileId]);
  
  // Handle URL params for auto-editing or viewing
  useEffect(() => {
    const editId = searchParams.get("edit");
    const viewId = searchParams.get("view");
    if (editId && diagnoses.length > 0) {
      const diag = diagnoses.find(d => d.id === editId);
      if (diag) openEdit(diag);
    }
    if (viewId && diagnoses.length > 0) {
      setDetailId(viewId);
    }
  }, [searchParams, diagnoses]);

  async function fetchData() {
    if (!activeProfileId) return;
    setLoading(true);
    
    // Fetch diagnoses
    const { data: diagData } = await supabase
      .from("diagnoses")
      .select("*")
      .eq("profile_id", activeProfileId)
      .order("status", { ascending: true })
      .order("created_at", { ascending: false });
    
    setDiagnoses(diagData || []);

    // Fetch medications linked to diagnoses
    if (diagData && diagData.length > 0) {
      const { data: medsData } = await supabase
        .from("medications")
        .select("*")
        .eq("profile_id", activeProfileId)
        .not("diagnosis_id", "is", null);
      
      // Group medications by diagnosis_id
      const grouped: Record<string, any[]> = {};
      (medsData || []).forEach(med => {
        if (med.diagnosis_id) {
          if (!grouped[med.diagnosis_id]) grouped[med.diagnosis_id] = [];
          grouped[med.diagnosis_id].push(med);
        }
      });
      setLinkedMeds(grouped);
    }
    
    setLoading(false);
  }

  function openEdit(diag: any) {
    setEditingId(diag.id);
    setForm({
      condition: diag.condition || "",
      notes: diag.notes || "",
      diagnosed_date: diag.diagnosed_date || "",
      status: diag.status || "active",
    });
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ condition: "", notes: "", diagnosed_date: "", status: "active" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) { toast.error(t.diagnoses.viewOnlyAccess); return; }
    if (!form.condition.trim()) { toast.error(t.diagnoses.conditionRequired); return; }
    
    setIsSaving(true);
    
    const payload = {
      condition: form.condition.trim(),
      notes: form.notes || null,
      diagnosed_date: form.diagnosed_date || null,
      status: form.status as "active" | "resolved",
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("diagnoses").update(payload).eq("id", editingId);
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
        console.log("Inserting diagnosis:", { profile_id: dataProfileId, user_id: currentUserId, ...payload });
        const { error } = await supabase.from("diagnoses").insert({ ...payload, profile_id: dataProfileId, user_id: currentUserId });
        if (error) { 
          console.error("Insert error:", { code: error.code, message: error.message, details: error.details, hint: error.hint });
          const msg = error.code === "42501" ? "No tenés permisos para crear." : 
                      error.code === "23503" ? "Error de referencia: verificá el perfil." : t.toast.error;
          toast.error(msg); 
          return; 
        }
      }
      
      // Success: close modal immediately, then show toast
      setDialogOpen(false);
      resetForm();
      toast.success(editingId ? t.toast.changesUpdated : t.toast.savedSuccess);
      pwaTracking.markFirstAction();
      fetchData();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("diagnoses").delete().eq("id", deleteId);
    if (error) { toast.error(t.toast.error); return; }
    toast.success(t.toast.deletedSuccess);
    setDeleteId(null);
    // If we're viewing the deleted diagnosis, go back to list
    if (detailId === deleteId) {
      setDetailId(null);
    }
    fetchData();
  }

  const active = diagnoses.filter(d => d.status === "active");
  const resolved = diagnoses.filter(d => d.status === "resolved");

  if (loading) return <LoadingPage />;

  // Get detail diagnosis if viewing
  const detailDiag = detailId ? diagnoses.find(d => d.id === detailId) : null;
  const relatedMeds = detailDiag ? (linkedMeds[detailDiag.id] || []) : [];

  const DiagnosisList = ({ items }: { items: any[] }) => items.length === 0 ? (
    <p className="text-muted-foreground text-center py-8">{t.diagnoses.noDiagnosesTab}</p>
  ) : (
    <div className="space-y-3">
      {items.map((d) => (
        <div key={d.id} className="health-card flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setDetailId(d.id)}>
          <div>
            <p className="font-medium">{d.condition}</p>
            {d.diagnosed_date && (
              <p className="text-sm text-muted-foreground">
                {t.diagnoses.diagnosed}: {format(parseDateOnly(d.diagnosed_date), "PP")}
              </p>
            )}
            {linkedMeds[d.id] && linkedMeds[d.id].length > 0 && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Pill className="h-3 w-3" />
                {linkedMeds[d.id].length} {t.diagnoses.linkedMedications}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={d.status === "active" ? "active" : "completed"} />
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => openEdit(d)} aria-label={t.actions.edit}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {canDelete && (
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(d.id)} aria-label={t.actions.delete}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="animate-fade-in">
      {/* Detail View */}
      {detailDiag ? (
        <>
          <PageHeader 
            title={detailDiag.condition} 
            description={t.diagnoses.title}
            actions={
              <Button variant="outline" onClick={() => setDetailId(null)}>
                {t.actions.back}
              </Button>
            }
          />
          <div className="space-y-6">
            <div className="health-card">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">{t.diagnoses.status}</p>
                  <StatusBadge status={detailDiag.status === "active" ? "active" : "completed"} />
                </div>
                {detailDiag.diagnosed_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t.diagnoses.diagnosedDate}</p>
                    <p className="font-medium">{format(parseDateOnly(detailDiag.diagnosed_date), "PP")}</p>
                  </div>
                )}
              </div>
              {detailDiag.notes && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">{t.diagnoses.notes}</p>
                  <p className="whitespace-pre-wrap">{detailDiag.notes}</p>
                </div>
              )}
            </div>

            {/* Related Medications */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Pill className="h-5 w-5 text-primary" />
                {t.diagnoses.relatedMedications}
              </h3>
              {relatedMeds.length === 0 ? (
                <p className="text-muted-foreground">{t.diagnoses.noRelatedMedications}</p>
              ) : (
                <div className="space-y-2">
                  {relatedMeds.map(med => (
                    <div key={med.id} className="health-card flex items-center justify-between">
                      <div>
                        <p className="font-medium">{med.name}</p>
                        <p className="text-sm text-muted-foreground">{med.dose_text}</p>
                      </div>
                      <StatusBadge status={normalizeStatus(med.status)} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {canEdit && (
                <Button variant="outline" onClick={() => { openEdit(detailDiag); setDetailId(null); }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {t.actions.edit}
                </Button>
              )}
              {canDelete && (
                <Button variant="destructive" onClick={() => setDeleteId(detailDiag.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t.actions.delete}
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        /* List View */
        <>
          <PageHeader variant="gradient" title={t.diagnoses.title} description={t.diagnoses.description}
            actions={
              canEdit ? (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />{t.diagnoses.addDiagnosis}
                </Button>
              ) : undefined
            }
          />

          {diagnoses.length === 0 ? (
            <EmptyState 
              icon={HeartPulse} 
              title={t.diagnoses.noDiagnoses} 
              description={t.diagnoses.noDiagnosesDescription} 
              action={canEdit ? { label: t.diagnoses.addDiagnosis, onClick: () => setDialogOpen(true) } : undefined} 
            />
          ) : (
            <Tabs defaultValue="active" className="space-y-6">
              <TabsList>
                <TabsTrigger value="active">{t.diagnoses.active} ({active.length})</TabsTrigger>
                <TabsTrigger value="resolved">{t.diagnoses.resolved} ({resolved.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="active"><DiagnosisList items={active} /></TabsContent>
              <TabsContent value="resolved"><DiagnosisList items={resolved} /></TabsContent>
            </Tabs>
          )}
        </>
      )}

      {/* Shared Modal - always rendered once */}
      <ResponsiveFormModal
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}
        title={editingId ? t.diagnoses.editDiagnosis : t.diagnoses.newDiagnosis}
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)} disabled={isSaving}>{t.actions.cancel}</Button>
            <Button type="submit" form="diagnosis-form" disabled={isSaving}>
              {isSaving ? t.actions.saving : (editingId ? t.actions.saveChanges : t.diagnoses.addDiagnosis)}
            </Button>
          </div>
        }
      >
        <form id="diagnosis-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="form-field">
            <Label>{t.diagnoses.condition} *</Label>
            <Input 
              value={form.condition} 
              onChange={(e) => setForm({ ...form, condition: e.target.value })} 
              placeholder={t.diagnoses.conditionPlaceholder} 
              required 
            />
          </div>
          <div className="form-field">
            <Label>{t.diagnoses.diagnosedDate}</Label>
            <Input 
              type="date" 
              value={form.diagnosed_date} 
              onChange={(e) => setForm({ ...form, diagnosed_date: e.target.value })} 
            />
          </div>
          <div className="form-field">
            <Label>{t.diagnoses.status}</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t.diagnoses.active}</SelectItem>
                <SelectItem value="resolved">{t.diagnoses.resolved}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="form-field">
            <Label>{t.diagnoses.notes}</Label>
            <Textarea 
              value={form.notes} 
              onChange={(e) => setForm({ ...form, notes: e.target.value })} 
              placeholder={t.diagnoses.notesPlaceholder}
            />
          </div>
        </form>
      </ResponsiveFormModal>

      {/* Shared AlertDialog - always rendered once at the end */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.diagnoses.deleteDiagnosis}</AlertDialogTitle>
            <AlertDialogDescription>{t.diagnoses.deleteDiagnosisDesc}</AlertDialogDescription>
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
