import { useState, useEffect } from "react";
import { Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

export default function Institutions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "Clinic", address: "", phone: "", notes: "" });

  useEffect(() => { if (user) fetchData(); }, [user]);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from("institutions").select("*").order("name");
    setInstitutions(data || []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { toast.error("Name is required"); return; }
    
    const { error } = await supabase.from("institutions").insert({ user_id: user!.id, ...form, type: form.type as any });
    if (error) { toast.error("Failed to add institution"); return; }
    toast.success("Institution added!");
    setDialogOpen(false);
    setForm({ name: "", type: "Clinic", address: "", phone: "", notes: "" });
    fetchData();
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Institutions" description="Clinics, labs, and hospitals"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add institution</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Institution</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-field"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="form-field">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Clinic">Clinic</SelectItem><SelectItem value="Lab">Lab</SelectItem><SelectItem value="Hospital">Hospital</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="form-field"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="form-field"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="form-field"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button type="submit" className="w-full">Add Institution</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {institutions.length === 0 ? (
        <EmptyState icon={Building2} title="No institutions yet" description="Add clinics, labs, or hospitals you visit." action={{ label: "Add institution", onClick: () => setDialogOpen(true) }} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {institutions.map((i) => (
            <div key={i.id} className="health-card">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{i.name}</h3>
                <span className="text-xs bg-secondary px-2 py-1 rounded">{i.type}</span>
              </div>
              {i.address && <p className="text-sm text-muted-foreground mt-2">{i.address}</p>}
              {i.phone && <p className="text-sm text-muted-foreground">{i.phone}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
