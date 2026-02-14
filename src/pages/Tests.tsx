import { useState, useEffect } from "react";
import { Plus, FlaskConical, Pencil, Trash2, Eye, ArrowLeft, Building2, Stethoscope } from "lucide-react";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslations, getLanguage } from "@/i18n";

export default function Tests() {
  const { dataProfileId, activeProfileId, currentUserId, canEdit, canDelete } = useActiveProfile();
  const t = useTranslations();
  const lang = getLanguage();
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewingTest, setViewingTest] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ type: "", date: "", notes: "", institution_id: "", status: "Scheduled", doctor_id: "", professional_status: "assigned" });
  
  useEffect(() => { if (activeProfileId) fetchData(); }, [activeProfileId]);

  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  async function fetchInstitutions() {
    const { data } = await supabase
      .from("institutions")
      .select("id, name")
      .eq("profile_id", activeProfileId)
      .eq("is_active", true)
      .order("name");
    setInstitutions(data || []);
  }

  async function fetchData() {
    if (!activeProfileId) return;
    setLoading(true);
    const [testRes, instRes, docRes] = await Promise.all([
      supabase.from("tests").select("*, institutions(name), doctors(full_name)").eq("profile_id", activeProfileId).order("date", { ascending: false }),
      supabase.from("institutions").select("id, name").eq("profile_id", activeProfileId).eq("is_active", true),
      supabase.from("doctors").select("id, full_name").eq("profile_id", activeProfileId).eq("is_active", true),
    ]);
    const testsData = testRes.data || [];
    setTests(testsData);
    setInstitutions(instRes.data || []);
    setDoctors(docRes.data || []);
    
    // Fetch attachment counts for all tests
    if (testsData.length > 0) {
      const { data: attachments } = await supabase
        .from("file_attachments")
        .select("entity_id")
        .eq("entity_type", "TestStudy")
        .in("entity_id", testsData.map(t => t.id));
      
      const counts: Record<string, number> = {};
      (attachments || []).forEach(att => {
        counts[att.entity_id] = (counts[att.entity_id] || 0) + 1;
      });
      setAttachmentCounts(counts);
    }
    
    setLoading(false);
  }

  function openEdit(test: any) {
    setEditingId(test.id);
    setForm({
      type: test.type || "",
      date: test.date || "",
      notes: test.notes || "",
      institution_id: test.institution_id || "",
      status: test.status || "Scheduled",
      doctor_id: test.doctor_id || "",
      professional_status: test.professional_status || "assigned",
    });
    setViewingTest(null);
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ type: "", date: "", notes: "", institution_id: "", status: "Scheduled", doctor_id: "", professional_status: "assigned" });
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) { toast.error("You have view-only access to this profile."); return; }
    if (!form.type || !form.date) { toast.error(t.tests.typeRequired + " " + t.tests.dateRequired); return; }
    
    setIsSaving(true);
    
    const professionalStatus = form.doctor_id ? "assigned" : form.professional_status;
    const payload = {
      type: form.type,
      date: form.date,
      notes: form.notes || null,
      institution_id: form.institution_id || null,
      status: form.status as any,
      doctor_id: form.doctor_id || null,
      professional_status: professionalStatus as any,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("tests").update(payload).eq("id", editingId);
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
        console.log("Inserting test:", { profile_id: dataProfileId, user_id: currentUserId, ...payload });
        const { error } = await supabase.from("tests").insert({ ...payload, profile_id: dataProfileId, user_id: currentUserId });
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
      toast.success(editingId ? t.toast.changesUpdated : t.toast.testCreated);
      fetchData();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("tests").delete().eq("id", deleteId);
    if (error) { toast.error(t.toast.error); return; }
    toast.success(t.toast.deletedSuccess);
    setDeleteId(null);
    setViewingTest(null);
    fetchData();
  }

  async function handleCreateInstitution(values: Record<string, string>): Promise<string | null> {
    if (!dataProfileId || !currentUserId) return null;
    const { data, error } = await supabase
      .from("institutions")
      .insert({ name: values.name.trim(), profile_id: dataProfileId, user_id: currentUserId })
      .select("id")
      .single();
    if (error) { 
      console.error("Institution insert error:", error);
      toast.error(t.toast.error);
      return null;
    }
    const { data: updated } = await supabase
      .from("institutions")
      .select("id, name")
      .eq("profile_id", dataProfileId)
      .eq("is_active", true);
    setInstitutions(updated || []);
    toast.success(t.toast.institutionAdded);
    return data?.id || null;
  }

  async function handleCreateDoctor(values: Record<string, string>): Promise<string | null> {
    if (!dataProfileId || !currentUserId) return null;
    const { data, error } = await supabase
      .from("doctors")
      .insert({ full_name: values.full_name.trim(), specialty: values.specialty?.trim() || null, profile_id: dataProfileId, user_id: currentUserId })
      .select("id")
      .single();
    if (error) { toast.error(t.toast.error); return null; }
    const { data: updated } = await supabase
      .from("doctors")
      .select("id, full_name")
      .eq("profile_id", dataProfileId)
      .eq("is_active", true);
    setDoctors(updated || []);
    toast.success(t.toast.doctorAdded);
    return data?.id || null;
  }

  function getProfessionalStatusLabel(status: string) {
    switch (status) {
      case "assigned": return t.doctors.assigned;
      case "unassigned": return t.doctors.unassigned;
      case "unknown": return t.doctors.unknown;
      case "not_recorded": return t.doctors.notRecorded;
      default: return "—";
    }
  }

  if (loading) return <LoadingPage />;

  // Detail View
  if (viewingTest) {
    return (
      <div className="animate-fade-in">
        <Button variant="ghost" onClick={() => setViewingTest(null)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />{t.tests.backToTests}
        </Button>
        
        <div className="max-w-2xl space-y-6">
          <div className="health-card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">{viewingTest.type}</h1>
                <p className="text-muted-foreground">{format(new Date(viewingTest.date), "MMMM d, yyyy")}</p>
              </div>
              <StatusBadge status={normalizeStatus(viewingTest.status)} />
            </div>
            
            <div className="space-y-3 text-sm">
              <div><span className="font-medium">{t.tests.institution}:</span> {viewingTest.institutions?.name || "—"}</div>
              <div><span className="font-medium">{t.doctors.professionalStatus}:</span> {viewingTest.doctors?.full_name || getProfessionalStatusLabel(viewingTest.professional_status)}</div>
              {viewingTest.notes && <div><span className="font-medium">{t.tests.notes}:</span> {viewingTest.notes}</div>}
            </div>
            
            {(canEdit || canDelete) && (
              <div className="flex gap-2 mt-6 pt-4 border-t">
                {canEdit && (
                  <Button onClick={() => openEdit(viewingTest)}>
                    <Pencil className="h-4 w-4 mr-2" />{t.actions.edit}
                  </Button>
                )}
                {canDelete && (
                  <Button variant="destructive" onClick={() => setDeleteId(viewingTest.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />{t.actions.delete}
                  </Button>
                )}
              </div>
            )}
          </div>
          
          <div className="health-card">
            <FileAttachments entityType="TestStudy" entityId={viewingTest.id} />
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
      <PageHeader variant="gradient" title={t.tests.title} description={t.tests.description}
        actions={
          canEdit ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />{t.tests.addTest}
            </Button>
          ) : undefined
        }
      />

      <ResponsiveFormModal
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}
        title={editingId ? t.tests.editTest : t.tests.newTest}
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)} disabled={isSaving}>{t.actions.cancel}</Button>
            <Button type="submit" form="test-form" disabled={isSaving}>
              {isSaving ? t.actions.saving : (editingId ? t.actions.saveChanges : t.tests.createTest)}
            </Button>
          </div>
        }
      >
        <form id="test-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="form-field"><Label>{t.tests.type} *</Label><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder={t.tests.typePlaceholder} required /></div>
          <div className="form-field"><Label>{t.tests.date} *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
          <div className="form-field">
            <Label>{t.tests.institution}</Label>
            <RelatedEntityPicker
              value={form.institution_id}
              onValueChange={(v) => setForm({ ...form, institution_id: v })}
              options={institutions.map((i) => ({ id: i.id, label: i.name }))}
              placeholder={t.tests.selectInstitution}
              searchPlaceholder={lang === "es" ? "Buscar institución..." : "Search institution..."}
              emptyText={lang === "es" ? "Sin resultados." : "No results."}
              addNewLabel={t.institutions.addNewInstitution}
              modalTitle={t.institutions.newInstitution}
              modalIcon={<Building2 className="h-5 w-5" />}
              fields={[
                { key: "name", label: t.institutions.name, placeholder: t.tests.institutionNamePlaceholder, required: true }
              ]}
              onCreate={handleCreateInstitution}
            />
          </div>
          {/* Professional picker or status */}
          <div className="form-field">
            <Label>{t.doctors.professionalStatus}</Label>
            {form.doctor_id ? (
              <RelatedEntityPicker
                value={form.doctor_id}
                onValueChange={(v) => setForm({ ...form, doctor_id: v, professional_status: v ? "assigned" : form.professional_status })}
                options={doctors.map((d) => ({ id: d.id, label: d.full_name }))}
                placeholder={lang === "es" ? "Seleccionar profesional..." : "Select professional..."}
                searchPlaceholder={lang === "es" ? "Buscar..." : "Search..."}
                emptyText={lang === "es" ? "Sin resultados." : "No results."}
                addNewLabel={t.doctors.addDoctor}
                modalTitle={t.doctors.newDoctor}
                modalIcon={<Stethoscope className="h-5 w-5" />}
                fields={[{ key: "full_name", label: t.doctors.fullName, required: true }, { key: "specialty", label: t.doctors.specialty, placeholder: t.doctors.specialtyPlaceholder }]}
                onCreate={handleCreateDoctor}
              />
            ) : (
              <div className="space-y-2">
                <Select value={form.professional_status} onValueChange={(v) => {
                  if (v === "select_professional") {
                    // Switch to professional picker mode - keep it empty to trigger picker
                    setForm({ ...form, professional_status: "assigned", doctor_id: "" });
                  } else {
                    setForm({ ...form, professional_status: v, doctor_id: "" });
                  }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select_professional">{lang === "es" ? "Seleccionar profesional..." : "Select professional..."}</SelectItem>
                    <SelectItem value="unassigned">{t.doctors.unassigned}</SelectItem>
                    <SelectItem value="unknown">{t.doctors.unknown}</SelectItem>
                    <SelectItem value="not_recorded">{t.doctors.notRecorded}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.professional_status === "assigned" && !form.doctor_id && (
              <RelatedEntityPicker
                value={form.doctor_id}
                onValueChange={(v) => setForm({ ...form, doctor_id: v, professional_status: v ? "assigned" : "unassigned" })}
                options={doctors.map((d) => ({ id: d.id, label: d.full_name }))}
                placeholder={lang === "es" ? "Seleccionar profesional..." : "Select professional..."}
                searchPlaceholder={lang === "es" ? "Buscar..." : "Search..."}
                emptyText={lang === "es" ? "Sin resultados." : "No results."}
                addNewLabel={t.doctors.addDoctor}
                modalTitle={t.doctors.newDoctor}
                modalIcon={<Stethoscope className="h-5 w-5" />}
                fields={[{ key: "full_name", label: t.doctors.fullName, required: true }, { key: "specialty", label: t.doctors.specialty, placeholder: t.doctors.specialtyPlaceholder }]}
                onCreate={handleCreateDoctor}
              />
            )}
          </div>
          <div className="form-field">
            <Label>{t.tests.status}</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Scheduled">{t.tests.scheduled}</SelectItem>
                <SelectItem value="Done">{t.tests.done}</SelectItem>
                <SelectItem value="Result received">{t.tests.resultReceived}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="form-field"><Label>{t.tests.notes}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </form>
      </ResponsiveFormModal>

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


      {tests.length === 0 ? (
        <EmptyState icon={FlaskConical} title={t.tests.noTests} description={t.tests.noTestsDescription} action={canEdit ? { label: t.tests.addTest, onClick: () => setDialogOpen(true) } : undefined} />
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {tests.map((test) => {
              const attachCount = attachmentCounts[test.id] || 0;
              return (
                <div key={test.id} className="health-card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{test.type}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(test.date), "MMM d, yyyy")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {attachCount > 0 && (
                        <AttachmentIndicator entityType="TestStudy" entityId={test.id} count={attachCount} />
                      )}
                      <StatusBadge status={normalizeStatus(test.status)} />
                    </div>
                  </div>
                  {test.institutions?.name && (
                    <p className="text-sm text-muted-foreground">{t.tests.institution}: {test.institutions.name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <Button variant="ghost" size="sm" onClick={() => setViewingTest(test)}>
                      <Eye className="h-4 w-4 mr-1" />{t.actions.view}
                    </Button>
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(test)}>
                        <Pencil className="h-4 w-4 mr-1" />{t.actions.edit}
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(test.id)}>
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
              <thead><tr className="border-b bg-muted/50"><th className="text-left p-4 font-medium">{t.tests.type}</th><th className="text-left p-4 font-medium">{t.tests.date}</th><th className="text-left p-4 font-medium">{t.tests.institution}</th><th className="text-left p-4 font-medium">{t.tests.status}</th><th className="text-right p-4 font-medium">{t.actions.view}</th></tr></thead>
              <tbody>
                {tests.map((test) => {
                  const attachCount = attachmentCounts[test.id] || 0;
                  return (
                    <tr key={test.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span>{test.type}</span>
                          {attachCount > 0 && (
                            <AttachmentIndicator entityType="TestStudy" entityId={test.id} count={attachCount} />
                          )}
                        </div>
                      </td>
                      <td className="p-4">{format(new Date(test.date), "MMM d, yyyy")}</td>
                      <td className="p-4">{test.institutions?.name || "—"}</td>
                      <td className="p-4"><StatusBadge status={normalizeStatus(test.status)} /></td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setViewingTest(test)} aria-label={t.actions.view}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEdit && (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(test)} aria-label={t.actions.edit}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(test.id)} aria-label={t.actions.delete}>
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
