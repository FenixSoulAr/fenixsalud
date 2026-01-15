import { useState, useEffect } from "react";
import { Plus, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Doctors() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", specialty: "", phone: "", email: "", notes: "" });

  useEffect(() => { if (user) fetchData(); }, [user]);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from("doctors").select("*").order("full_name");
    setDoctors(data || []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name) { toast.error("Name is required"); return; }
    
    const { error } = await supabase.from("doctors").insert({ user_id: user!.id, ...form });
    if (error) { toast.error("Failed to add doctor"); return; }
    toast.success("Doctor added!");
    setDialogOpen(false);
    setForm({ full_name: "", specialty: "", phone: "", email: "", notes: "" });
    fetchData();
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Doctors" description="Your healthcare providers"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add doctor</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Doctor</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-field"><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
                <div className="form-field"><Label>Specialty</Label><Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="e.g., Cardiology" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-field"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div className="form-field"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                </div>
                <div className="form-field"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button type="submit" className="w-full">Add Doctor</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {doctors.length === 0 ? (
        <EmptyState icon={Stethoscope} title="No doctors yet" description="Add your healthcare providers to link them to appointments." action={{ label: "Add doctor", onClick: () => setDialogOpen(true) }} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d) => (
            <div key={d.id} className="health-card">
              <h3 className="font-semibold">{d.full_name}</h3>
              {d.specialty && <p className="text-sm text-primary">{d.specialty}</p>}
              {d.phone && <p className="text-sm text-muted-foreground mt-2">{d.phone}</p>}
              {d.email && <p className="text-sm text-muted-foreground">{d.email}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
