import { useState, useEffect } from "react";
import { Plus, Syringe, Pencil, Trash2, Eye, ArrowLeft, Filter, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveFormModal } from "@/components/ui/responsive-form-modal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { FileAttachments } from "@/components/FileAttachments";
import { AttachmentIndicator } from "@/components/AttachmentIndicator";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useEntitlementGate } from "@/hooks/useEntitlementGate";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslations, getLanguage } from "@/i18n";
import { useNavigate } from "react-router-dom";

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
  const { canUseProcedures, gateFeature, loading: entitlementsLoading } = useEntitlementGate();
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
  const [form, setForm] = useState({ 
    type: "Surgery" as ProcedureType, 
    title: "", 
    date: "", 
    notes: "", 
    institution_id: "", 
    doctor_id: "" 
  });
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  useEffect(() => { if (activeProfileId) fetchData(); }, [activeProfileId]);

  // Helper to get translated procedure type
  function getTranslatedType(type: ProcedureType) {
    switch (type) {
      case "Surgery": return t.procedures.surgery;
      case "Hospitalization": return t.procedures.hospitalization;
      case "Vaccine": return t.procedures.vaccine;
      default: return type;
    }
  }

  async function fetchData() {
    if (!activeProfileId) return;
    setLoading(true);
    const [procRes, instRes, docRes] = await Promise.all([
      supabase.from("procedures").select("*, institutions(name), doctors(full_name)").eq("profile_id", activeProfileId).order("date", { ascending: false }),
      supabase.from("institutions").select("id, name").eq("profile_id", activeProfileId),
      supabase.from("doctors").select("id, full_name").eq("profile_id", activeProfileId),
    ]);
    const proceduresData = procRes.data || [];
    setProcedures(proceduresData);
    setInstitutions(instRes.data || []);
    setDoctors(docRes.data || []);
    
    // Fetch attachment counts
    if (proceduresData.length > 0) {
      const { data: attachments } = await supabase
        .from("file_attachments")
        .select("entity_id")
        .eq("entity_type", "Procedure")
        .in("entity_id", proceduresData.map(p => p.id));
      
      const counts: Record<string, number> = {};
      (attachments || []).forEach(att => {
        counts[att.entity_id] = (counts[att.entity_id] || 0) + 1;
      });
      setAttachmentCounts(counts);
    }
    
    setLoading(false);
  }

  function openEdit(procedure: any) {
    setEditingId(procedure.id);
    setForm({
      type: procedure.type || "Surgery",
      title: procedure.title || "",
      date: procedure.date || "",
      notes: procedure.notes || "",
      institution_id: procedure.institution_id || "",
      doctor_id: procedure.doctor_id || "",
    });
    setViewingProcedure(null);
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ type: "Surgery", title: "", date: "", notes: "", institution_id: "", doctor_id: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) { toast.error("You have view-only access to this profile."); return; }
    if (!form.title) { toast.error(t.procedures.titleRequired); return; }
    if (!form.date) { toast.error(t.procedures.dateRequired); return; }
    
    const payload = {
      type: form.type,
      title: form.title,
      date: form.date,
      notes: form.notes || null,
      institution_id: form.institution_id || null,
      doctor_id: form.doctor_id || null,
    };

    if (editingId) {
      const { error } = await supabase.from("procedures").update(payload).eq("id", editingId);
      if (error) { toast.error(t.toast.error); return; }
      toast.success(t.toast.changesUpdated);
    } else {
      if (!dataProfileId || !currentUserId) { toast.error("No active profile or user"); return; }
      const { error } = await supabase.from("procedures").insert({ ...payload, profile_id: dataProfileId, user_id: currentUserId });
      if (error) { console.error("Insert error:", error); toast.error(t.toast.error); return; }
      toast.success(t.toast.savedSuccess);
    }
    
    setDialogOpen(false);
    resetForm();
    fetchData();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("procedures").delete().eq("id", deleteId);
    if (error) { toast.error(t.toast.error); return; }
    toast.success(t.toast.deletedSuccess);
    setDeleteId(null);
    setViewingProcedure(null);
    fetchData();
  }

  const filteredProcedures = filterType === "all" 
    ? procedures 
    : procedures.filter(p => p.type === filterType);

  if (loading || entitlementsLoading) return <LoadingPage />;

  // Check if procedures feature is gated
  if (!canUseProcedures) {
    return (
      <div className="animate-fade-in">
        <PageHeader variant="gradient" title={t.procedures.title} description={t.procedures.description} />
        <div className="max-w-lg mx-auto text-center py-12">
          <Crown className="h-16 w-16 mx-auto mb-4 text-amber-500" />
          <h2 className="text-xl font-semibold mb-2">
            {lang === "es" ? "Esta función está disponible en Plus" : "This feature is available in Plus"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {lang === "es" 
              ? "Free es para organizar tu propia salud. Plus te permite compartir, exportar y cuidar a otros."
              : "Free is for organizing your own health. Plus lets you share, export, and care for others."}
          </p>
          <Button onClick={() => navigate("/pricing")}>
            {lang === "es" ? "Ver planes" : "View Plans"}
          </Button>
        </div>
      </div>
    );
  }

  // Detail View
  if (viewingProcedure) {
    return (
      <div className="animate-fade-in">
        <Button variant="ghost" onClick={() => setViewingProcedure(null)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />{t.procedures.backToProcedures}
        </Button>
        
        <div className="max-w-2xl space-y-6">
          <div className="health-card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">{viewingProcedure.title}</h1>
                <p className="text-muted-foreground">{format(new Date(viewingProcedure.date), "MMMM d, yyyy")}</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getProcedureStatusStyle(viewingProcedure.type)}`}>
                {getTranslatedType(viewingProcedure.type)}
              </span>
            </div>
            
            <div className="space-y-3 text-sm">
              {viewingProcedure.institutions?.name && (
                <div><span className="font-medium">{t.procedures.institution}:</span> {viewingProcedure.institutions.name}</div>
              )}
              {viewingProcedure.doctors?.full_name && (
                <div><span className="font-medium">{t.procedures.doctor}:</span> {viewingProcedure.doctors.full_name}</div>
              )}
              {viewingProcedure.notes && <div><span className="font-medium">{t.procedures.notes}:</span> {viewingProcedure.notes}</div>}
            </div>
            
            {(canEdit || canDelete) && (
              <div className="flex gap-2 mt-6 pt-4 border-t">
                {canEdit && (
                  <Button onClick={() => openEdit(viewingProcedure)}>
                    <Pencil className="h-4 w-4 mr-2" />{t.actions.edit}
                  </Button>
                )}
                {canDelete && (
                  <Button variant="destructive" onClick={() => setDeleteId(viewingProcedure.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />{t.actions.delete}
                  </Button>
                )}
              </div>
            )}
          </div>
          
          <div className="health-card">
            <FileAttachments entityType="Procedure" entityId={viewingProcedure.id} />
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
      <PageHeader variant="gradient" title={t.procedures.title} description={t.procedures.description}
        actions={
          canEdit ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />{t.procedures.addProcedure}
            </Button>
          ) : undefined
        }
      />

      <ResponsiveFormModal
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}
        title={editingId ? t.procedures.editProcedure : t.procedures.newProcedure}
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>{t.actions.cancel}</Button>
            <Button type="submit" form="procedure-form">{editingId ? t.actions.saveChanges : t.procedures.createProcedure}</Button>
          </div>
        }
      >
        <form id="procedure-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="form-field">
            <Label>{t.procedures.type} *</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ProcedureType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROCEDURE_TYPES.map(type => <SelectItem key={type} value={type}>{getTranslatedType(type)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="form-field"><Label>{t.procedures.title_field} *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t.procedures.titlePlaceholder} required /></div>
          <div className="form-field"><Label>{t.procedures.date} *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
          <div className="form-field">
            <Label>{t.procedures.institution}</Label>
            <Select value={form.institution_id} onValueChange={(v) => setForm({ ...form, institution_id: v })}>
              <SelectTrigger><SelectValue placeholder={t.procedures.selectInstitution} /></SelectTrigger>
              <SelectContent>{institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="form-field">
            <Label>{t.procedures.doctor}</Label>
            <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
              <SelectTrigger><SelectValue placeholder={t.procedures.selectDoctor} /></SelectTrigger>
              <SelectContent>{doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="form-field"><Label>{t.procedures.notes}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </form>
      </ResponsiveFormModal>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.procedures.allTypes}</SelectItem>
            {PROCEDURE_TYPES.map(type => <SelectItem key={type} value={type}>{getTranslatedType(type)}</SelectItem>)}
          </SelectContent>
        </Select>
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

      {filteredProcedures.length === 0 ? (
        <EmptyState icon={Syringe} title={t.procedures.noProcedures} description={t.procedures.noProceduresDescription} action={canEdit ? { label: t.procedures.addProcedure, onClick: () => setDialogOpen(true) } : undefined} />
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {filteredProcedures.map((p) => {
              const attachCount = attachmentCounts[p.id] || 0;
              return (
                <div key={p.id} className="health-card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.title}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(p.date), "MMM d, yyyy")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {attachCount > 0 && (
                        <AttachmentIndicator entityType="Procedure" entityId={p.id} count={attachCount} />
                      )}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getProcedureStatusStyle(p.type)}`}>
                        {getTranslatedType(p.type)}
                      </span>
                    </div>
                  </div>
                  {(p.institutions?.name || p.doctors?.full_name) && (
                    <p className="text-sm text-muted-foreground">
                      {p.institutions?.name}{p.institutions?.name && p.doctors?.full_name && " • "}{p.doctors?.full_name}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <Button variant="ghost" size="sm" onClick={() => setViewingProcedure(p)}>
                      <Eye className="h-4 w-4 mr-1" />{t.actions.view}
                    </Button>
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4 mr-1" />{t.actions.edit}
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(p.id)}>
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
              <thead><tr className="border-b bg-muted/50"><th className="text-left p-4 font-medium">{t.procedures.title_field}</th><th className="text-left p-4 font-medium">{t.procedures.type}</th><th className="text-left p-4 font-medium">{t.procedures.date}</th><th className="text-left p-4 font-medium">{t.procedures.institution}</th><th className="text-left p-4 font-medium">{t.procedures.doctor}</th><th className="text-right p-4 font-medium">{t.actions.view}</th></tr></thead>
              <tbody>
                {filteredProcedures.map((p) => {
                  const attachCount = attachmentCounts[p.id] || 0;
                  return (
                    <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span>{p.title}</span>
                          {attachCount > 0 && (
                            <AttachmentIndicator entityType="Procedure" entityId={p.id} count={attachCount} />
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getProcedureStatusStyle(p.type)}`}>
                          {getTranslatedType(p.type)}
                        </span>
                      </td>
                      <td className="p-4">{format(new Date(p.date), "MMM d, yyyy")}</td>
                      <td className="p-4">{p.institutions?.name || "—"}</td>
                      <td className="p-4">{p.doctors?.full_name || "—"}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setViewingProcedure(p)} aria-label={t.actions.view}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEdit && (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label={t.actions.edit}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} aria-label={t.actions.delete}>
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
      )}
    </div>
  );
}
