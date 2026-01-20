import { useState } from "react";
import { Users, Mail, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useSharing } from "@/contexts/SharingContext";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";

export function SharingSection() {
  const { myShares, inviteUser, revokeAccess, updateRole, canManageSharing } = useSharing();
  const lang = getLanguage();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "contributor">("viewer");
  const [inviting, setInviting] = useState(false);

  if (!canManageSharing) {
    return null;
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error(lang === "es" ? "El email es obligatorio" : "Email is required");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error(lang === "es" ? "Email inválido" : "Invalid email");
      return;
    }

    setInviting(true);
    const { error } = await inviteUser(email.trim(), role);
    setInviting(false);

    if (error) {
      const errorMessages: Record<string, string> = {
        "Maximum 2 shared people allowed": lang === "es" 
          ? "Máximo 2 personas compartidas permitidas" 
          : "Maximum 2 shared people allowed",
        "Already shared with this email": lang === "es"
          ? "Ya compartido con este email"
          : "Already shared with this email",
        "Cannot share with yourself": lang === "es"
          ? "No podés compartir contigo mismo"
          : "Cannot share with yourself",
      };
      toast.error(errorMessages[error] || error);
      return;
    }

    toast.success(lang === "es" ? "Invitación enviada" : "Invitation sent");
    setEmail("");
    setRole("viewer");
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

  return (
    <section className="health-card">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Users className="h-5 w-5" />
        {lang === "es" ? "Compartir perfil" : "Profile Sharing"}
      </h2>
      
      <p className="text-sm text-muted-foreground mb-4">
        {lang === "es"
          ? "Compartí tu información de salud con familiares o cuidadores de confianza. Máximo 2 personas."
          : "Share your health information with trusted family members or caregivers. Maximum 2 people."}
      </p>

      {/* Current shares */}
      {myShares.length > 0 && (
        <div className="space-y-3 mb-6">
          <Label>{lang === "es" ? "Personas con acceso" : "People with access"}</Label>
          {myShares.map((share) => (
            <div
              key={share.id}
              className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{share.shared_with_email}</p>
                  <p className="text-xs text-muted-foreground">
                    {share.shared_with_user_id 
                      ? (lang === "es" ? "Cuenta vinculada" : "Account linked")
                      : (lang === "es" ? "Pendiente de registro" : "Pending registration")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={share.role}
                  onValueChange={(value: "viewer" | "contributor") => handleRoleChange(share.id, value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">{getRoleLabel("viewer")}</SelectItem>
                    <SelectItem value="contributor">{getRoleLabel("contributor")}</SelectItem>
                  </SelectContent>
                </Select>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {lang === "es" ? "¿Revocar acceso?" : "Revoke access?"}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {lang === "es"
                          ? `${share.shared_with_email} ya no podrá ver tu información de salud.`
                          : `${share.shared_with_email} will no longer be able to view your health information.`}
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
          ))}
        </div>
      )}

      {/* Invite form */}
      {myShares.length < 2 && (
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
          </div>
          <Button type="submit" disabled={inviting}>
            <UserPlus className="h-4 w-4 mr-2" />
            {inviting 
              ? (lang === "es" ? "Invitando..." : "Inviting...") 
              : (lang === "es" ? "Invitar" : "Invite")}
          </Button>
        </form>
      )}

      {myShares.length >= 2 && (
        <p className="text-sm text-muted-foreground">
          {lang === "es"
            ? "Has alcanzado el límite de 2 personas compartidas. Revocá el acceso a alguien para invitar a otra persona."
            : "You've reached the limit of 2 shared people. Revoke someone's access to invite another person."}
        </p>
      )}
    </section>
  );
}
