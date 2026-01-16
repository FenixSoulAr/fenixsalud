import { useState, useEffect } from "react";
import { Plus, FlaskConical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, normalizeStatus } from "@/components/ui/status-badge";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Tests() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "", date: "", notes: "", institution_id: "", status: "Scheduled" });

  useEffect(() => { if (user) fetchData(); }, [user]);

  async function fetchData() {
    setLoading(true);
    const [testRes, instRes] = await Promise.all([
      supabase.from("tests").select("*, institutions(name)").order("date", { ascending: false }),
      supabase.from("institutions").select("id, name"),
    ]);
    setTests(testRes.data || []);
    setInstitutions(instRes.data || []);
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
    });
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ type: "", date: "", notes: "", institution_id: "", status: "Scheduled" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.type || !form.date) { toast.error("Type and date are required."); return; }
    
    const payload = {
      type: form.type,
      date: form.date,
      notes: form.notes || null,
      institution_id: form.institution_id || null,
      status: form.status as any,
    };

    if (editingId) {
      const { error } = await supabase.from("tests").update(payload).eq("id", editingId);
      if (error) { toast.error("Something went wrong. Please try again."); return; }
      toast.success("Changes updated.");
    } else {
      const { error } = await supabase.from("tests").insert({ ...payload, user_id: user!.id });
      if (error) { toast.error("Something went wrong. Please try again."); return; }
      toast.success("Saved successfully.");
    }
    
    setDialogOpen(false);
    resetForm();
    fetchData();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("tests").delete().eq("id", deleteId);
    if (error) { toast.error("Something went wrong. Please try again."); return; }
    toast.success("Test deleted.");
    setDeleteId(null);
    fetchData();
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Tests" description="Track your medical tests and results"
        actions={
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add test</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Edit Test" : "New Test"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-field"><Label>Type *</Label><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="e.g., Blood test" required /></div>
                <div className="form-field"><Label>Date *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
                <div className="form-field">
                  <Label>Institution</Label>
                  <Select value={form.institution_id} onValueChange={(v) => setForm({ ...form, institution_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select institution" /></SelectTrigger>
                    <SelectContent>{institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="form-field">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="Done">Done</SelectItem>
                      <SelectItem value="Result received">Result received</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-field"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button type="submit" className="w-full">{editingId ? "Save Changes" : "Create Test"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete test?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The test record will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {tests.length === 0 ? (
        <EmptyState icon={FlaskConical} title="No tests yet" description="Add your first test to track results and history." action={{ label: "Add test", onClick: () => setDialogOpen(true) }} />
      ) : (
        <div className="data-grid">
          <table className="w-full">
            <thead><tr className="border-b bg-muted/50"><th className="text-left p-4 font-medium">Type</th><th className="text-left p-4 font-medium">Date</th><th className="text-left p-4 font-medium">Institution</th><th className="text-left p-4 font-medium">Status</th><th className="text-right p-4 font-medium">Actions</th></tr></thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-4">{t.type}</td>
                  <td className="p-4">{format(new Date(t.date), "MMM d, yyyy")}</td>
                  <td className="p-4">{t.institutions?.name || "—"}</td>
                  <td className="p-4"><StatusBadge status={normalizeStatus(t.status)} /></td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)} aria-label="Edit test">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id)} aria-label="Delete test">
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