import { useState, useEffect } from "react";
import { Plus, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Reminders() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pastWarning, setPastWarning] = useState(false);
  const [form, setForm] = useState({ title: "", type: "Custom", due_date_time: "", repeat_rule: "None", notes: "" });

  useEffect(() => { if (user) fetchData(); }, [user]);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from("reminders").select("*").order("due_date_time");
    setReminders(data || []);
    setLoading(false);
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.title || !form.due_date_time) { toast.error("Title and due date are required"); return; }
    
    if (new Date(form.due_date_time) < new Date() && !pastWarning) {
      setPastWarning(true);
      return;
    }
    
    const { error } = await supabase.from("reminders").insert({ user_id: user!.id, title: form.title, type: form.type as any, due_date_time: form.due_date_time, repeat_rule: form.repeat_rule as any, notes: form.notes || null });
    if (error) { toast.error("Failed to create reminder"); return; }
    toast.success("Reminder created!");
    setDialogOpen(false);
    setPastWarning(false);
    setForm({ title: "", type: "Custom", due_date_time: "", repeat_rule: "None", notes: "" });
    fetchData();
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Reminders" description="Never miss an important health task"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add reminder</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Reminder</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-field"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
                <div className="form-field"><Label>Due Date & Time *</Label><Input type="datetime-local" value={form.due_date_time} onChange={(e) => setForm({ ...form, due_date_time: e.target.value })} required /></div>
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
                      <SelectContent><SelectItem value="None">None</SelectItem><SelectItem value="Weekly">Weekly</SelectItem><SelectItem value="Monthly">Monthly</SelectItem><SelectItem value="Yearly">Yearly</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="form-field"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button type="submit" className="w-full">Create Reminder</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

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

      {reminders.length === 0 ? (
        <EmptyState icon={Bell} title="No reminders yet" description="Create reminders to stay on top of your health tasks." action={{ label: "Add reminder", onClick: () => setDialogOpen(true) }} />
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => (
            <div key={r.id} className="health-card flex items-center justify-between">
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.type} • {r.repeat_rule !== "None" ? `Repeats ${r.repeat_rule.toLowerCase()}` : "One-time"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{format(new Date(r.due_date_time), "MMM d, yyyy")}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(r.due_date_time), "h:mm a")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
