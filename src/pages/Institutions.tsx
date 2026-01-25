import { useState, useEffect } from "react";
import { Plus, Building2, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveFormModal } from "@/components/ui/responsive-form-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MobileSelect } from "@/components/ui/mobile-select";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

const INSTITUTION_TYPE_OPTIONS = [
  { value: "Clinic", label: "Clinic" },
  { value: "Lab", label: "Lab" },
  { value: "Hospital", label: "Hospital" },
  { value: "Other", label: "Other" },
];

export default function Institutions() {
  const { dataProfileId, activeProfileId, currentUserId, canEdit, canDelete } = useActiveProfile();
  const [loading, setLoading] = useState(true);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "Clinic", address: "", phone: "", notes: "" });

  useEffect(() => { if (activeProfileId) fetchData(); }, [activeProfileId]);

  async function fetchData() {
    if (!activeProfileId) return;
    setLoading(true);
    const { data } = await supabase.from("institutions").select("*").eq("profile_id", activeProfileId).order("name");
    setInstitutions(data || []);
    setLoading(false);
  }

  function openEdit(institution: any) {
    setEditingId(institution.id);
    setForm({
      name: institution.name || "",
      type: institution.type || "Clinic",
      address: institution.address || "",
      phone: institution.phone || "",
      notes: institution.notes || "",
    });
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ name: "", type: "Clinic", address: "", phone: "", notes: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) { toast.error("You have view-only access to this profile."); return; }
    if (!form.name) { toast.error("Institution name is required."); return; }
    
    const payload = {
      name: form.name,
      type: form.type as any,
      address: form.address || null,
      phone: form.phone || null,
      notes: form.notes || null,
    };

    if (editingId) {
      const { error } = await supabase.from("institutions").update(payload).eq("id", editingId);
      if (error) { toast.error("Something went wrong. Please try again."); return; }
      toast.success("Changes updated.");
    } else {
      if (!dataProfileId || !currentUserId) { toast.error("No active profile or user"); return; }
      const { error } = await supabase.from("institutions").insert({ profile_id: dataProfileId, user_id: currentUserId, ...payload });
      if (error) { console.error("Insert error:", error); toast.error("Something went wrong. Please try again."); return; }
      toast.success("Saved successfully.");
    }

    setDialogOpen(false);
    resetForm();
    fetchData();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("institutions").delete().eq("id", deleteId);
    if (error) { toast.error("Something went wrong. Please try again."); return; }
    toast.success("Deleted successfully.");
    setDeleteId(null);
    setViewDialog(null);
    fetchData();
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader variant="gradient" title="Institutions" description="Clinics, labs, and hospitals"
        actions={
          canEdit ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Add institution
            </Button>
          ) : undefined
        }
      />

      <ResponsiveFormModal
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}
        title={editingId ? "Edit Institution" : "Add Institution"}
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" form="institution-form">{editingId ? "Save Changes" : "Add Institution"}</Button>
          </div>
        }
      >
        <form id="institution-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="form-field"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="form-field">
            <Label>Type</Label>
            <MobileSelect
              value={form.type}
              onValueChange={(v) => setForm({ ...form, type: v })}
              options={INSTITUTION_TYPE_OPTIONS}
              placeholder="Select type"
              label="Institution type"
            />
          </div>
          <div className="form-field"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="form-field"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
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
      <Dialog open={!!viewDialog} onOpenChange={(open) => !open && setViewDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{viewDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {viewDialog?.type && <div><Label className="text-muted-foreground text-xs">Type</Label><p>{viewDialog.type}</p></div>}
            {viewDialog?.address && <div><Label className="text-muted-foreground text-xs">Address</Label><p>{viewDialog.address}</p></div>}
            {viewDialog?.phone && <div><Label className="text-muted-foreground text-xs">Phone</Label><p>{viewDialog.phone}</p></div>}
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

      {institutions.length === 0 ? (
        <EmptyState icon={Building2} title="No institutions yet" description="Add clinics, labs, or hospitals you visit." action={canEdit ? { label: "Add institution", onClick: () => setDialogOpen(true) } : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {institutions.map((i) => (
            <div key={i.id} className="health-card relative">
              <div className="absolute top-3 right-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setViewDialog(i)}>
                      <Eye className="h-4 w-4 mr-2" />View
                    </DropdownMenuItem>
                    {canEdit && (
                      <DropdownMenuItem onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4 mr-2" />Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(i.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-start justify-between pr-10">
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
