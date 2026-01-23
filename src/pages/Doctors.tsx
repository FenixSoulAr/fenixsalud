import { useState, useEffect } from "react";
import { Plus, Stethoscope, MoreHorizontal, Pencil, Trash2, Eye, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveFormModal } from "@/components/ui/responsive-form-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export default function Doctors() {
  const { dataOwnerId, activeProfileOwnerId, canEdit, canDelete } = useActiveProfile();
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState<any | null>(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", specialty: "", phone: "", email: "", notes: "" });

  useEffect(() => { if (activeProfileOwnerId) fetchData(); }, [activeProfileOwnerId]);

  async function fetchData() {
    if (!activeProfileOwnerId) return;
    setLoading(true);
    const { data } = await supabase.from("doctors").select("*").eq("user_id", activeProfileOwnerId).order("full_name");
    setDoctors(data || []);
    setLoading(false);
  }

  function openEdit(doctor: any) {
    setEditingId(doctor.id);
    setForm({
      full_name: doctor.full_name || "",
      specialty: doctor.specialty || "",
      phone: doctor.phone || "",
      email: doctor.email || "",
      notes: doctor.notes || "",
    });
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ full_name: "", specialty: "", phone: "", email: "", notes: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) { toast.error("You have view-only access to this profile."); return; }
    if (!form.full_name) { toast.error("Doctor name is required."); return; }
    
    const payload = {
      full_name: form.full_name,
      specialty: form.specialty || null,
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,
    };

    if (editingId) {
      const { error } = await supabase.from("doctors").update(payload).eq("id", editingId);
      if (error) { toast.error("Something went wrong. Please try again."); return; }
      toast.success("Changes updated.");
    } else {
      if (!dataOwnerId) { toast.error("No active profile"); return; }
      const { error } = await supabase.from("doctors").insert({ user_id: dataOwnerId, ...payload });
      if (error) { toast.error("Something went wrong. Please try again."); return; }
      toast.success("Saved successfully.");
    }

    setDialogOpen(false);
    resetForm();
    fetchData();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("doctors").delete().eq("id", deleteId);
    if (error) { toast.error("Something went wrong. Please try again."); return; }
    toast.success("Deleted successfully.");
    setDeleteId(null);
    setViewDialog(null);
    fetchData();
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader variant="gradient" title="Doctors" description="Your healthcare providers"
        actions={
          canEdit ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Add doctor
            </Button>
          ) : undefined
        }
      />

      <ResponsiveFormModal
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}
        title={editingId ? "Edit Doctor" : "Add Doctor"}
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" form="doctor-form">{editingId ? "Save Changes" : "Add Doctor"}</Button>
          </div>
        }
      >
        <form id="doctor-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="form-field"><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
          <div className="form-field"><Label>Specialty</Label><Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="e.g., Cardiology" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-field"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="form-field"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="form-field"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </form>
      </ResponsiveFormModal>

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
      <Dialog open={!!viewDialog} onOpenChange={(open) => { if (!open) { setViewDialog(null); setShowContactInfo(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{viewDialog?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {viewDialog?.specialty && <div><Label className="text-muted-foreground text-xs">Specialty</Label><p>{viewDialog.specialty}</p></div>}
            
            {/* Contact info gated behind button */}
            {(viewDialog?.phone || viewDialog?.email) && !showContactInfo && (
              <Button variant="outline" size="sm" onClick={() => setShowContactInfo(true)} className="min-h-[44px]">
                <Phone className="h-4 w-4 mr-2" />Reveal contact information
              </Button>
            )}
            
            {showContactInfo && (
              <>
                {viewDialog?.phone && <div><Label className="text-muted-foreground text-xs">Phone</Label><p>{viewDialog.phone}</p></div>}
                {viewDialog?.email && <div><Label className="text-muted-foreground text-xs">Email</Label><p>{viewDialog.email}</p></div>}
              </>
            )}
            
            {viewDialog?.notes && <div><Label className="text-muted-foreground text-xs">Notes</Label><p>{viewDialog.notes}</p></div>}
          </div>
          {(canEdit || canDelete) && (
            <div className="flex gap-2 mt-4">
              {canEdit && (
                <Button onClick={() => { openEdit(viewDialog); setViewDialog(null); setShowContactInfo(false); }}>
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

      {doctors.length === 0 ? (
        <EmptyState icon={Stethoscope} title="No doctors yet" description="Add your healthcare providers to link them to appointments." action={canEdit ? { label: "Add doctor", onClick: () => setDialogOpen(true) } : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d) => (
            <div key={d.id} className="health-card relative">
              <div className="absolute top-3 right-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setViewDialog(d)}>
                      <Eye className="h-4 w-4 mr-2" />View
                    </DropdownMenuItem>
                    {canEdit && (
                      <DropdownMenuItem onClick={() => openEdit(d)}>
                        <Pencil className="h-4 w-4 mr-2" />Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(d.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <h3 className="font-semibold pr-10">{d.full_name}</h3>
              {d.specialty && <p className="text-sm text-primary">{d.specialty}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
