import { useState, useEffect } from "react";
import { Users, Mail, Trash2, UserPlus, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useSharing } from "@/contexts/SharingContext";
import { useEntitlementGate } from "@/hooks/useEntitlementGate";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export function SharingSection() {
  const { myShares, myProfiles, inviteUser, revokeAccess, updateRole, canManageSharing, refreshShares, loading } = useSharing();
  const { canShare } = useEntitlementGate();
  const navigate = useNavigate();
  const lang = getLanguage();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "contributor">("viewer");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [inviting, setInviting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Set default selected profile when profiles load
  useEffect(() => {
    if (myProfiles.length > 0 && !selectedProfileId) {
      const primaryProfile = myProfiles.find(p => p.is_primary);
      setSelectedProfileId(primaryProfile?.id || myProfiles[0].id);
    }
  }, [myProfiles, selectedProfileId]);

  // Force refresh shares on mount to ensure list is up-to-date
  useEffect(() => {
    let mounted = true;
    
    async function loadShares() {
      try {
        setFetchError(null);
        await refreshShares();
        if (mounted) {
          setHasLoaded(true);
        }
      } catch (err: any) {
        console.error("Failed to load shares:", err);
        if (mounted) {
          setFetchError(err?.message || "Failed to load shares");
          setHasLoaded(true);
        }
      }
    }
    
    loadShares();
    
    return () => {
      mounted = false;
    };
  }, []);

  if (!canManageSharing) {
    return null;
  }

  // Show upgrade prompt if sharing is not enabled
  if (!canShare) {
    return (
      <section className="health-card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          {lang === "es" ? "Compartir perfil" : "Profile Sharing"}
        </h2>
        <div className="text-center py-6">
          <Crown className="h-12 w-12 mx-auto mb-3 text-amber-500" />
          <h3 className="font-medium mb-2">
            {lang === "es" ? "Esta función está disponible en Plus" : "This feature is available in Plus"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {lang === "es"
              ? "Free es para organizar tu propia salud. Plus te permite compartir, exportar y cuidar a otros."
              : "Free is for organizing your own health. Plus lets you share, export, and care for others."}
          </p>
          <Button onClick={() => navigate("/pricing")} size="sm">
            {lang === "es" ? "Ver planes" : "View Plans"}
          </Button>
        </div>
      </section>
    );
  }

  // Get shares for selected profile
  const profileShares = myShares.filter(s => s.profile_id === selectedProfileId);
  const selectedProfile = myProfiles.find(p => p.id === selectedProfileId);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    
    if (!selectedProfileId) {
      const msg = lang === "es" ? "Seleccioná un perfil" : "Select a profile";
      setInlineError(msg);
      toast.error(msg);
      return;
    }
    
    if (!email.trim()) {
      const msg = lang === "es" ? "El email es obligatorio" : "Email is required";
      setInlineError(msg);
      toast.error(msg);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      const msg = lang === "es" ? "Email inválido" : "Invalid email";
      setInlineError(msg);
      toast.error(msg);
      return;
    }

    setInviting(true);
    const { error } = await inviteUser(selectedProfileId, email.trim(), role);
    setInviting(false);

    if (error) {
      const knownErrors: Record<string, string> = {
        "Maximum 2 shared people per profile": lang === "es" 
          ? "Máximo 2 personas compartidas por perfil" 
          : "Maximum 2 shared people per profile",
        "Already shared with this email": lang === "es"
          ? "Ya compartido con este email"
          : "Already shared with this email",
        "Cannot share with yourself": lang === "es"
          ? "No podés compartir contigo mismo"
          : "Cannot share with yourself",
        "Profile not found": lang === "es"
          ? "Perfil no encontrado"
          : "Profile not found",
      };
      
      const isDuplicateError = error.includes("duplicate key") || error.includes("unique constraint");
      
      let displayError: string;
      if (knownErrors[error]) {
        displayError = knownErrors[error];
      } else if (isDuplicateError) {
        displayError = lang === "es" 
          ? "Ya compartido con este email" 
          : "Already shared with this email";
      } else {
        displayError = error;
      }
      
      console.error("Invite failed:", error);
      setInlineError(displayError);
      toast.error(
        lang === "es" 
          ? `Invitación fallida: ${displayError}` 
          : `Invite failed: ${displayError}`
      );
      return;
    }

    toast.success(lang === "es" ? "Invitación enviada" : "Invitation sent");
    setEmail("");
    setRole("viewer");
    setInlineError(null);
  };

  const handleRevoke = async (shareId: string) => {
    const { error } = await revokeAccess(shareId);
    if (error) {
      toast.error(lang === "es" ? "No se pudo revocar el acceso" : "Failed to revoke access");
      return;
    }
    toast.success(lang === "es" ? "Acceso revocado" : "Access revoked");
  };

  const handleRoleChange = async (shareId: string, newRole: "viewer" | "contributor") => {
    const { error } = await updateRole(shareId, newRole);
    if (error) {
      toast.error(lang === "es" ? "No se pudo actualizar el rol" : "Failed to update role");
      return;
    }
    toast.success(lang === "es" ? "Rol actualizado" : "Role updated");
  };

  const getRoleLabel = (role: "viewer" | "contributor") => {
    if (role === "viewer") {
      return lang === "es" ? "Solo lectura" : "Viewer";
    }
    return lang === "es" ? "Colaborador" : "Contributor";
  };

  const getStatusLabel = (status: "pending" | "active") => {
    if (status === "pending") {
      return lang === "es" ? "Pendiente" : "Pending";
    }
    return lang === "es" ? "Activo" : "Active";
  };

  return (
    <section className="health-card">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Users className="h-5 w-5" />
        {lang === "es" ? "Compartir perfil" : "Profile Sharing"}
      </h2>
      
      <p className="text-sm text-muted-foreground mb-4">
        {lang === "es"
          ? "Compartí tu información de salud con familiares o cuidadores de confianza. Máximo 2 personas por perfil."
          : "Share your health information with trusted family members or caregivers. Maximum 2 people per profile."}
      </p>

      {/* Profile selector (if multiple profiles) */}
      {myProfiles.length > 1 && (
        <div className="mb-4">
          <Label className="mb-2 block">{lang === "es" ? "Perfil a compartir" : "Profile to share"}</Label>
          <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={lang === "es" ? "Seleccionar perfil" : "Select profile"} />
            </SelectTrigger>
            <SelectContent>
              {myProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.full_name || (profile.is_primary 
                    ? (lang === "es" ? "Mi perfil" : "My profile")
                    : (lang === "es" ? "Sin nombre" : "Unnamed"))}
                  {profile.is_primary && ` (${lang === "es" ? "Principal" : "Primary"})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Fetch error display */}
      {fetchError && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg mb-4">
          <p className="text-sm text-destructive font-medium">
            {lang === "es" ? "Error al cargar la lista:" : "Error loading list:"} {fetchError}
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && !hasLoaded && (
        <div className="p-3 bg-muted/50 rounded-lg mb-4">
          <p className="text-sm text-muted-foreground">
            {lang === "es" ? "Cargando..." : "Loading..."}
          </p>
        </div>
      )}

      {/* Current shares for selected profile */}
      {profileShares.length > 0 && (
        <div className="space-y-3 mb-6">
          <Label>
            {lang === "es" ? "Personas con acceso a" : "People with access to"}{" "}
            <span className="font-medium">{selectedProfile?.full_name || (lang === "es" ? "este perfil" : "this profile")}</span>{" "}
            ({profileShares.length})
          </Label>
          {profileShares.map((share) => {
            const displayName = share.shared_with_name || share.shared_with_email;
            const showEmailSeparately = share.shared_with_name && share.shared_with_name !== share.shared_with_email;
            
            return (
              <div
                key={share.id}
                className="p-3 bg-muted/50 rounded-lg space-y-3"
              >
                {/* Top row: Name/Email and badges */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium text-sm break-all">{displayName}</span>
                    </div>
                    {showEmailSeparately && (
                      <p className="text-xs text-muted-foreground mt-1 break-all pl-6">
                        {share.shared_with_email}
                      </p>
                    )}
                  </div>
                  
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 pl-6 sm:pl-0">
                    <Badge 
                      variant={share.role === "contributor" ? "default" : "secondary"}
                      className="text-xs shrink-0"
                    >
                      {getRoleLabel(share.role)}
                    </Badge>
                    <Badge 
                      variant={share.status === "active" ? "outline" : "secondary"}
                      className="text-xs shrink-0"
                    >
                      {getStatusLabel(share.status)}
                    </Badge>
                  </div>
                </div>
                
                {/* Status description */}
                <p className="text-xs text-muted-foreground pl-6 sm:pl-0">
                  {share.status === "active"
                    ? (lang === "es" ? "Cuenta vinculada" : "Account linked")
                    : (lang === "es" ? "Pendiente de registro" : "Pending registration")}
                </p>
                
                {/* Actions row */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                  <Select
                    value={share.role}
                    onValueChange={(value: "viewer" | "contributor") => handleRoleChange(share.id, value)}
                  >
                    <SelectTrigger className="w-full sm:w-32 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">{getRoleLabel("viewer")}</SelectItem>
                      <SelectItem value="contributor">{getRoleLabel("contributor")}</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive flex-1 sm:flex-none">
                        <Trash2 className="h-4 w-4 mr-2 sm:mr-0" />
                        <span className="sm:hidden">{lang === "es" ? "Revocar" : "Revoke"}</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {lang === "es" ? "¿Revocar acceso?" : "Revoke access?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {lang === "es"
                            ? `${displayName} ya no podrá ver tu información de salud.`
                            : `${displayName} will no longer be able to view your health information.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{lang === "es" ? "Cancelar" : "Cancel"}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRevoke(share.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {lang === "es" ? "Revocar" : "Revoke"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite form */}
      {profileShares.length < 2 && selectedProfileId && (
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="form-field">
            <Label>{lang === "es" ? "Invitar persona" : "Invite person"}</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={lang === "es" ? "email@ejemplo.com" : "email@example.com"}
                className="flex-1"
              />
              <Select value={role} onValueChange={(v: "viewer" | "contributor") => setRole(v)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">{getRoleLabel("viewer")}</SelectItem>
                  <SelectItem value="contributor">{getRoleLabel("contributor")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {role === "viewer" 
                ? (lang === "es" 
                    ? "Solo lectura: puede ver la información, no puede editar ni eliminar."
                    : "Viewer: can view information, cannot edit or delete.")
                : (lang === "es"
                    ? "Colaborador: puede ver, agregar y editar, no puede eliminar ni gestionar accesos."
                    : "Contributor: can view, add, and edit, cannot delete or manage sharing.")}
            </p>
            {inlineError && (
              <p className="text-xs text-destructive mt-2 font-medium">
                {inlineError}
              </p>
            )}
          </div>
          <Button type="submit" disabled={inviting}>
            <UserPlus className="h-4 w-4 mr-2" />
            {inviting 
              ? (lang === "es" ? "Invitando..." : "Inviting...") 
              : (lang === "es" ? "Invitar" : "Invite")}
          </Button>
        </form>
      )}

      {profileShares.length >= 2 && (
        <p className="text-sm text-muted-foreground">
          {lang === "es"
            ? "Has alcanzado el límite de 2 personas compartidas para este perfil. Revocá el acceso a alguien para invitar a otra persona."
            : "You've reached the limit of 2 shared people for this profile. Revoke someone's access to invite another person."}
        </p>
      )}
    </section>
  );
}
