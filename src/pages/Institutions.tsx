import { useState, useEffect } from "react";
import { Plus, Building2, MoreHorizontal, Pencil, Trash2, Eye, Search, ToggleLeft, ToggleRight } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import { useTranslations, getLanguage } from "@/i18n";

const INSTITUTION_TYPE_OPTIONS = [
  { value: "Clinic", label: "Clinic" },
  { value: "Lab", label: "Lab" },
  { value: "Hospital", label: "Hospital" },
  { value: "Other", label: "Other" },
];

export default function Institutions() {
  const { dataProfileId, activeProfileId, currentUserId, canEdit, canDelete } = useActiveProfile();
  const t = useTranslations();
  const lang = getLanguage();
  const [loading, setLoading] = useState(true);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ name: "", type: "Clinic", address: "", phone: "", notes: "" });
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"active" | "inactive">("active");

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
    if (!canEdit) { 
      toast.error(lang === "es" ? "Tenés acceso de solo lectura a este perfil." : "You have view-only access to this profile."); 
      return; 
    }
    if (!form.name) { toast.error(t.institutions.nameRequired); return; }
    
    setIsSaving(true);
    
    const payload = {
      name: form.name,
      type: form.type as any,
      address: form.address || null,
      phone: form.phone || null,
      notes: form.notes || null,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("institutions").update(payload).eq("id", editingId);
        if (error) { 
          console.error("Update error:", { code: error.code, message: error.message, details: error.details, hint: error.hint });
          toast.error(error.code === "42501" 
            ? (lang === "es" ? "No tenés permisos para editar." : "You don't have permission to edit.") 
            : t.toast.error); 
          return; 
        }
      } else {
        if (!dataProfileId || !currentUserId) { 
          console.error("Missing IDs:", { dataProfileId, currentUserId });
          toast.error(lang === "es" ? "Falta el perfil activo o usuario." : "Missing active profile or user."); 
          return; 
        }
        const { error } = await supabase.from("institutions").insert({ profile_id: dataProfileId, user_id: currentUserId, ...payload });
        if (error) { 
          console.error("Insert error:", { code: error.code, message: error.message, details: error.details, hint: error.hint });
          const msg = error.code === "42501" 
            ? (lang === "es" ? "No tenés permisos para crear." : "You don't have permission to create.") 
            : error.code === "23503" 
            ? (lang === "es" ? "Error de referencia: verificá el perfil." : "Reference error: check the profile.") 
            : t.toast.error;
          toast.error(msg); 
          return; 
        }
      }

      setDialogOpen(false);
      resetForm();
      toast.success(editingId ? t.toast.changesUpdated : t.toast.savedSuccess);
      fetchData();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("institutions").delete().eq("id", deleteId);
    if (error) { toast.error(t.toast.error); return; }
    toast.success(t.toast.deletedSuccess);
    setDeleteId(null);
    setViewDialog(null);
    fetchData();
  }

  async function handleToggleActive(institution: any) {
    if (!canEdit) {
      toast.error(lang === "es" ? "No tenés permisos para modificar." : "You don't have permission to modify.");
      return;
    }
    
    const newIsActive = !institution.is_active;
    const { error } = await supabase
      .from("institutions")
      .update({ 
        is_active: newIsActive,
        deactivated_at: newIsActive ? null : new Date().toISOString()
      })
      .eq("id", institution.id);
    
    if (error) {
      console.error("Toggle active error:", error);
      toast.error(t.toast.error);
      return;
    }
    
    toast.success(newIsActive 
      ? (lang === "es" ? "Institución reactivada" : "Institution reactivated")
      : (lang === "es" ? "Institución desactivada" : "Institution deactivated")
    );
    setViewDialog(null);
    fetchData();
  }

  // Filter by search and active status
  const filteredInstitutions = institutions.filter((inst) => {
    // Filter by active status
    const isActiveMatch = activeFilter === "active" ? inst.is_active !== false : inst.is_active === false;
    if (!isActiveMatch) return false;
    
    // Filter by search
    if (searchQuery === "") return true;
    return inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inst.address && inst.address.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  // Translate institution type
  function getTranslatedType(type: string) {
    switch (type) {
      case "Clinic": return t.institutions.clinic;
      case "Lab": return t.institutions.lab;
      case "Hospital": return t.institutions.hospital;
      case "Other": return t.institutions.other;
      default: return type;
    }
  }

  const typeOptions = INSTITUTION_TYPE_OPTIONS.map(opt => ({
    value: opt.value,
    label: getTranslatedType(opt.value)
  }));

  if (loading) return <LoadingPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader 
        variant="gradient" 
        title={t.institutions.title} 
        description={t.institutions.description}
        actions={
          canEdit ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />{t.institutions.addInstitution}
            </Button>
          ) : undefined
        }
      />

      {/* Filter Tabs and Search Bar */}
      {institutions.length > 0 && (
        <div className="mb-6 space-y-4">
          <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as "active" | "inactive")}>
            <TabsList>
              <TabsTrigger value="active">
                {lang === "es" ? "Activas" : "Active"}
              </TabsTrigger>
              <TabsTrigger value="inactive">
                {lang === "es" ? "Inactivas" : "Inactive"}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.actions.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      )}

      <ResponsiveFormModal
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}
        title={editingId ? t.institutions.editInstitution : t.institutions.newInstitution}
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)} disabled={isSaving}>{t.actions.cancel}</Button>
            <Button type="submit" form="institution-form" disabled={isSaving}>
              {isSaving ? t.actions.saving : (editingId ? t.actions.saveChanges : t.institutions.addInstitution)}
            </Button>
          </div>
        }
      >
        <form id="institution-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="form-field">
            <Label>{t.institutions.name} *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-field">
            <Label>{t.institutions.type}</Label>
            <MobileSelect
              value={form.type}
              onValueChange={(v) => setForm({ ...form, type: v })}
              options={typeOptions}
              placeholder={lang === "es" ? "Seleccionar tipo" : "Select type"}
              label={t.institutions.type}
            />
          </div>
          <div className="form-field">
            <Label>{t.institutions.address}</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={lang === "es" ? "ej., Av. Corrientes 1234" : "e.g., 123 Main St"} />
          </div>
          <div className="form-field">
            <Label>{t.institutions.phone}</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-field">
            <Label>{t.institutions.notes}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </form>
      </ResponsiveFormModal>

      {/* Delete Confirmation */}
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

      {/* View Detail Dialog */}
      <Dialog open={!!viewDialog} onOpenChange={(open) => !open && setViewDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{viewDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {viewDialog?.type && (
              <div>
                <Label className="text-muted-foreground text-xs">{t.institutions.type}</Label>
                <p>{getTranslatedType(viewDialog.type)}</p>
              </div>
            )}
            {viewDialog?.address && (
              <div>
                <Label className="text-muted-foreground text-xs">{t.institutions.address}</Label>
                <p>{viewDialog.address}</p>
              </div>
            )}
            {viewDialog?.phone && (
              <div>
                <Label className="text-muted-foreground text-xs">{t.institutions.phone}</Label>
                <p>{viewDialog.phone}</p>
              </div>
            )}
            {viewDialog?.notes && (
              <div>
                <Label className="text-muted-foreground text-xs">{t.institutions.notes}</Label>
                <p>{viewDialog.notes}</p>
              </div>
            )}
          </div>
          {(canEdit || canDelete) && (
            <div className="flex flex-wrap gap-2 mt-4">
              {canEdit && (
                <Button onClick={() => { openEdit(viewDialog); setViewDialog(null); }}>
                  <Pencil className="h-4 w-4 mr-2" />{t.actions.edit}
                </Button>
              )}
              {canEdit && (
                <Button 
                  variant="outline" 
                  onClick={() => handleToggleActive(viewDialog)}
                >
                  {viewDialog?.is_active !== false ? (
                    <>
                      <ToggleLeft className="h-4 w-4 mr-2" />
                      {lang === "es" ? "Desactivar" : "Deactivate"}
                    </>
                  ) : (
                    <>
                      <ToggleRight className="h-4 w-4 mr-2" />
                      {lang === "es" ? "Reactivar" : "Reactivate"}
                    </>
                  )}
                </Button>
              )}
              {canDelete && (
                <Button variant="destructive" onClick={() => setDeleteId(viewDialog?.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />{t.actions.delete}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {filteredInstitutions.length === 0 && institutions.length === 0 ? (
        <EmptyState 
          icon={Building2} 
          title={t.institutions.noInstitutions} 
          description={t.institutions.noInstitutionsDescription} 
          action={canEdit ? { label: t.institutions.addInstitution, onClick: () => setDialogOpen(true) } : undefined} 
        />
      ) : filteredInstitutions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{lang === "es" ? "Sin resultados" : "No results"}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredInstitutions.map((i) => (
            <div key={i.id} className={`health-card relative ${i.is_active === false ? 'opacity-60' : ''}`}>
              <div className="absolute top-3 right-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover">
                    <DropdownMenuItem onClick={() => setViewDialog(i)}>
                      <Eye className="h-4 w-4 mr-2" />{t.actions.view}
                    </DropdownMenuItem>
                    {canEdit && (
                      <DropdownMenuItem onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4 mr-2" />{t.actions.edit}
                      </DropdownMenuItem>
                    )}
                    {canEdit && (
                      <DropdownMenuItem onClick={() => handleToggleActive(i)}>
                        {i.is_active !== false ? (
                          <>
                            <ToggleLeft className="h-4 w-4 mr-2" />
                            {lang === "es" ? "Desactivar" : "Deactivate"}
                          </>
                        ) : (
                          <>
                            <ToggleRight className="h-4 w-4 mr-2" />
                            {lang === "es" ? "Reactivar" : "Reactivate"}
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(i.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />{t.actions.delete}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-start justify-between pr-10">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{i.name}</h3>
                  {i.is_active === false && (
                    <Badge variant="secondary" className="text-xs">
                      {lang === "es" ? "Inactiva" : "Inactive"}
                    </Badge>
                  )}
                </div>
                <span className="text-xs bg-secondary px-2 py-1 rounded">{getTranslatedType(i.type)}</span>
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
