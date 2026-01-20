import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Bell, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Reminders() {
  const { dataOwnerId, activeProfileOwnerId, canEdit, canDelete } = useActiveProfile();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("new") === "true");
  const [viewDialog, setViewDialog] = useState<any | null>(null);
  const [pastWarning, setPastWarning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", type: "Custom", due_date: "", due_time: "", repeat_rule: "None", notes: "" });

  useEffect(() => { if (activeProfileOwnerId) fetchData(); }, [activeProfileOwnerId]);
  
  // Handle URL params for auto-editing
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && reminders.length > 0) {
      const rem = reminders.find(r => r.id === editId);
      if (rem) openEdit(rem);
    }
  }, [searchParams, reminders]);

  async function fetchData() {
    if (!activeProfileOwnerId) return;
    setLoading(true);
    const { data } = await supabase.from("reminders").select("*").eq("user_id", activeProfileOwnerId).order("due_date_time");
    setReminders(data || []);
    setLoading(false);
  }

  function openEdit(reminder: any) {
    setEditingId(reminder.id);
    const dt = reminder.due_date_time ? new Date(reminder.due_date_time) : null;
    setForm({
      title: reminder.title || "",
      type: reminder.type || "Custom",
      due_date: dt ? format(dt, "yyyy-MM-dd") : "",
      due_time: dt ? format(dt, "HH:mm") : "",
      repeat_rule: reminder.repeat_rule || "None",
      notes: reminder.notes || "",
    });
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ title: "", type: "Custom", due_date: "", due_time: "", repeat_rule: "None", notes: "" });
  }

  function buildDateTime() {
    if (!form.due_date) return "";
    const time = form.due_time || "00:00";
    return `${form.due_date}T${time}`;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canEdit) { toast.error("You have view-only access to this profile."); return; }
    if (!form.title) { toast.error("Title is required."); return; }
    if (!form.due_date) { toast.error("Date is required."); return; }
    
    const due_date_time = buildDateTime();
    
    if (new Date(due_date_time) < new Date() && !pastWarning) {
      setPastWarning(true);
      return;
    }
    
    const payload = {
      title: form.title,
      type: form.type as any,
      due_date_time,
      repeat_rule: form.repeat_rule as any,
      notes: form.notes || null,
    };

    if (editingId) {
      const { error } = await supabase.from("reminders").update(payload).eq("id", editingId);
      if (error) { toast.error("Something went wrong. Please try again."); return; }
      toast.success("Changes updated.");
    } else {
      if (!dataOwnerId) { toast.error("No active profile"); return; }
      const { error } = await supabase.from("reminders").insert({ user_id: dataOwnerId, ...payload });
      if (error) { toast.error("Something went wrong. Please try again."); return; }
      toast.success("Saved successfully.");
    }

    setDialogOpen(false);
    setPastWarning(false);
    resetForm();
    fetchData();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("reminders").delete().eq("id", deleteId);
    if (error) { toast.error("Something went wrong. Please try again."); return; }
    toast.success("Deleted successfully.");
    setDeleteId(null);
    setViewDialog(null);
    fetchData();
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Reminders" description="Never miss an important health task"
        actions={
          canEdit ? (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { resetForm(); setPastWarning(false); } }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add reminder</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Edit Reminder" : "New Reminder"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-field"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-field"><Label>Date *</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required /></div>
                  <div className="form-field"><Label>Time</Label><Input type="time" value={form.due_time} onChange={(e) => setForm({ ...form, due_time: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-field">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Checkup">Checkup</SelectItem><SelectItem value="Appointment follow-up">Appointment follow-up</SelectItem><SelectItem value="Test follow-up">Test follow-up</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="form-field">
                    <Label>Repeat</Label>
                    <Select value={form.repeat_rule} onValueChange={(v) => setForm({ ...form, repeat_rule: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Daily">Daily</SelectItem>
                        <SelectItem value="Weekly">Weekly</SelectItem>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="Yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="form-field"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button type="submit" className="w-full">{editingId ? "Save Changes" : "Create Reminder"}</Button>
              </form>
            </DialogContent>
          </Dialog>
          ) : undefined
        }
      />

      {/* Past Date Warning */}
      <AlertDialog open={pastWarning} onOpenChange={setPastWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This reminder is in the past</AlertDialogTitle>
            <AlertDialogDescription>Save anyway?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSubmit()}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Detail Dialog */}
      <Dialog open={!!viewDialog} onOpenChange={(open) => !open && setViewDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{viewDialog?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {viewDialog?.type && <div><Label className="text-muted-foreground text-xs">Type</Label><p>{viewDialog.type}</p></div>}
            {viewDialog?.due_date_time && <div><Label className="text-muted-foreground text-xs">Due</Label><p>{format(new Date(viewDialog.due_date_time), "MMM d, yyyy h:mm a")}</p></div>}
            {viewDialog?.repeat_rule && <div><Label className="text-muted-foreground text-xs">Repeat</Label><p>{viewDialog.repeat_rule === "None" ? "One-time" : viewDialog.repeat_rule}</p></div>}
            {viewDialog?.notes && <div><Label className="text-muted-foreground text-xs">Notes</Label><p>{viewDialog.notes}</p></div>}
          </div>
          {(canEdit || canDelete) && (
            <div className="flex gap-2 mt-4">
              {canEdit && (
                <Button onClick={() => { openEdit(viewDialog); setViewDialog(null); }}>
                  <Pencil className="h-4 w-4 mr-2" />Edit
                </Button>
              )}
              {canDelete && (
                <Button variant="destructive" onClick={() => setDeleteId(viewDialog?.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />Delete
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {reminders.length === 0 ? (
        <EmptyState icon={Bell} title="No reminders yet" description="Create reminders to stay on top of your health tasks." action={canEdit ? { label: "Add reminder", onClick: () => setDialogOpen(true) } : undefined} />
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => (
            <div key={r.id} className="health-card flex items-center justify-between">
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.type} • {r.repeat_rule !== "None" ? `Repeats ${r.repeat_rule.toLowerCase()}` : "One-time"}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-2">
                  <p className="text-sm font-medium">{format(new Date(r.due_date_time), "MMM d, yyyy")}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(r.due_date_time), "h:mm a")}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setViewDialog(r)}>
                      <Eye className="h-4 w-4 mr-2" />View
                    </DropdownMenuItem>
                    {canEdit && (
                      <DropdownMenuItem onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4 mr-2" />Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(r.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
