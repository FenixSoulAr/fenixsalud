import { useState, useEffect } from "react";
import { Plus, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

export default function Medications() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", dose_text: "", schedule_type: "Daily", times: "", notes: "" });

  useEffect(() => { if (user) fetchData(); }, [user]);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from("medications").select("*").order("created_at", { ascending: false });
    setMedications(data || []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { toast.error("Medication name is required."); return; }
    if (!form.dose_text) { toast.error("Dose is required."); return; }
    if (form.schedule_type === "Daily" && !form.times) { toast.error("Add at least one time."); return; }
    
    const { error } = await supabase.from("medications").insert({
      user_id: user!.id, name: form.name, dose_text: form.dose_text,
      schedule_type: form.schedule_type as any,
      times: form.times ? form.times.split(",").map(t => t.trim()) : [],
      notes: form.notes || null, status: "Active",
    });
    
    if (error) { toast.error("Failed to create medication"); return; }
    toast.success("Medication added!");
    setDialogOpen(false);
    setForm({ name: "", dose_text: "", schedule_type: "Daily", times: "", notes: "" });
    fetchData();
  }

  const active = medications.filter(m => m.status === "Active");
  const paused = medications.filter(m => m.status === "Paused");
  const completed = medications.filter(m => m.status === "Completed");

  if (loading) return <LoadingPage />;

  const MedList = ({ meds }: { meds: any[] }) => meds.length === 0 ? <p className="text-muted-foreground text-center py-8">No medications</p> : (
    <div className="space-y-3">{meds.map((m) => (
      <div key={m.id} className="health-card flex items-center justify-between">
        <div><p className="font-medium">{m.name}</p><p className="text-sm text-muted-foreground">{m.dose_text} • {m.schedule_type}</p></div>
        <StatusBadge status={normalizeStatus(m.status)} />
      </div>
    ))}</div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader title="Medications" description="Track your medications and schedules"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add medication</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Medication</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-field"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Aspirin" required /></div>
                <div className="form-field"><Label>Dose *</Label><Input value={form.dose_text} onChange={(e) => setForm({ ...form, dose_text: e.target.value })} placeholder="e.g., 100mg" required /></div>
                <div className="form-field">
                  <Label>Schedule</Label>
                  <Select value={form.schedule_type} onValueChange={(v) => setForm({ ...form, schedule_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Weekly">Weekly</SelectItem><SelectItem value="As needed">As needed</SelectItem></SelectContent>
                  </Select>
                </div>
                {form.schedule_type === "Daily" && <div className="form-field"><Label>Times (comma-separated)</Label><Input value={form.times} onChange={(e) => setForm({ ...form, times: e.target.value })} placeholder="e.g., 8:00, 20:00" /></div>}
                <div className="form-field"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button type="submit" className="w-full">Add Medication</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {medications.length === 0 ? (
        <EmptyState icon={Pill} title="No medications yet" description="Add your first medication to track your schedule." action={{ label: "Add medication", onClick: () => setDialogOpen(true) }} />
      ) : (
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList><TabsTrigger value="active">Active ({active.length})</TabsTrigger><TabsTrigger value="paused">Paused ({paused.length})</TabsTrigger><TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger></TabsList>
          <TabsContent value="active"><MedList meds={active} /></TabsContent>
          <TabsContent value="paused"><MedList meds={paused} /></TabsContent>
          <TabsContent value="completed"><MedList meds={completed} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
