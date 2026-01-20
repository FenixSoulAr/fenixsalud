import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Pill, Pencil, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useTranslations } from "@/i18n";

export default function Medications() {
  const { user } = useAuth();
  const t = useTranslations();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("new") === "true");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", dose_text: "", schedule_type: "Daily", times: "", notes: "", status: "Active" });

  useEffect(() => { if (user) fetchData(); }, [user]);
  
  // Handle URL params for auto-editing
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && medications.length > 0) {
      const med = medications.find(m => m.id === editId);
      if (med) openEdit(med);
    }
  }, [searchParams, medications]);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from("medications").select("*").order("name", { ascending: true });
    setMedications(data || []);
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
    });
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ name: "", dose_text: "", schedule_type: "Daily", times: "", notes: "", status: "Active" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    };

    if (editingId) {
      const { error } = await supabase.from("medications").update(payload).eq("id", editingId);
      if (error) { toast.error(t.toast.error); return; }
      toast.success(t.toast.changesUpdated);
    } else {
      const { error } = await supabase.from("medications").insert({ ...payload, user_id: user!.id });
      if (error) { toast.error(t.toast.error); return; }
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

  const MedList = ({ meds }: { meds: any[] }) => meds.length === 0 ? <p className="text-muted-foreground text-center py-8">{t.medications.noMedicationsTab}</p> : (
    <div className="space-y-3">{meds.map((m) => (
      <div key={m.id} className="health-card flex items-center justify-between">
        <div>
          <p className="font-medium">{m.name}</p>
          <p className="text-sm text-muted-foreground">{m.dose_text} • {m.schedule_type === "Daily" ? t.medications.daily : m.schedule_type === "Weekly" ? t.medications.weekly : t.medications.asNeeded}</p>
          {m.times && m.times.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{t.medications.times}: {m.times.join(", ")}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={normalizeStatus(m.status)} />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => openEdit(m)} aria-label={t.actions.edit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDeleteId(m.id)} aria-label={t.actions.delete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
    ))}</div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader title={t.medications.title} description={t.medications.description}
        actions={
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />{t.medications.addMedication}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? t.medications.editMedication : t.medications.newMedication}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                <div className="form-field"><Label>{t.medications.notes}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button type="submit" className="w-full">{editingId ? t.actions.saveChanges : t.medications.addMedication}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

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
        <EmptyState icon={Pill} title={t.medications.noMedications} description={t.medications.noMedicationsDescription} action={{ label: t.medications.addMedication, onClick: () => setDialogOpen(true) }} />
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
