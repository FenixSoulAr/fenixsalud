import { useState, useEffect } from "react";
import { Shield, UserPlus, Loader2, Trash2, ArrowRightLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface AdminRole {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
  created_by: string | null;
  created_by_email: string | null;
}

interface SearchUser {
  user_id: string;
  email: string;
}

export function RolesSection() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Add admin dialog
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [newRole, setNewRole] = useState<string>("admin");
  const [addConfirmed, setAddConfirmed] = useState(false);

  // Remove dialog
  const [removeDialog, setRemoveDialog] = useState<{ open: boolean; target: AdminRole | null }>({ open: false, target: null });

  // Transfer dialog
  const [transferDialog, setTransferDialog] = useState<{ open: boolean; target: AdminRole | null }>({ open: false, target: null });
  const [transferConfirmText, setTransferConfirmText] = useState("");
  const [transferChecked, setTransferChecked] = useState(false);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "list_admin_roles" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setRoles(data.roles || []);
    } catch (err) {
      console.error("Failed to fetch roles:", err);
      toast.error("Error al cargar roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleSearchUsers = async () => {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "search_users_by_email", query: searchQuery.trim() },
      });
      if (error) throw error;
      // Filter out users who already have roles
      const existingIds = new Set(roles.map(r => r.user_id));
      setSearchResults((data.users || []).filter((u: SearchUser) => !existingIds.has(u.user_id)));
    } catch {
      toast.error("Error en la búsqueda");
    } finally {
      setSearching(false);
    }
  };

  const handleSetRole = async () => {
    if (!selectedUser || !addConfirmed) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "set_user_role", userId: selectedUser.user_id, role: newRole },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success("Rol asignado correctamente");
      setAddOpen(false);
      resetAddForm();
      fetchRoles();
    } catch (err: any) {
      toast.error(err.message || "Error al asignar rol");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveRole = async () => {
    if (!removeDialog.target) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "remove_user_role", userId: removeDialog.target.user_id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success("Rol eliminado");
      setRemoveDialog({ open: false, target: null });
      fetchRoles();
    } catch (err: any) {
      toast.error(err.message || "Error al quitar rol");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferDialog.target || transferConfirmText !== "TRANSFERIR" || !transferChecked) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "transfer_superadmin", toUserId: transferDialog.target.user_id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success("Ownership transferida correctamente");
      setTransferDialog({ open: false, target: null });
      setTransferConfirmText("");
      setTransferChecked(false);
      fetchRoles();
    } catch (err: any) {
      toast.error(err.message || "Error al transferir ownership");
    } finally {
      setActionLoading(false);
    }
  };

  const resetAddForm = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedUser(null);
    setNewRole("admin");
    setAddConfirmed(false);
  };

  const superadminCount = roles.filter(r => r.role === "superadmin").length;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Administradores
              </CardTitle>
              <CardDescription>
                Gestión de roles de acceso al panel de administración
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchRoles} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Actualizar"}
              </Button>
              <Button size="sm" onClick={() => { resetAddForm(); setAddOpen(true); }}>
                <UserPlus className="h-4 w-4 mr-1" />
                Agregar admin
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Asignado</TableHead>
                    <TableHead>Por</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No hay administradores configurados
                      </TableCell>
                    </TableRow>
                  ) : (
                    roles.map((r) => (
                      <TableRow key={r.user_id}>
                        <TableCell className="font-medium">{r.email}</TableCell>
                        <TableCell>
                          {r.role === "superadmin" ? (
                            <Badge className="bg-primary">Superadmin</Badge>
                          ) : (
                            <Badge variant="secondary">Admin</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(r.created_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm truncate max-w-32">
                          {r.created_by_email ? r.created_by_email.split("@")[0] : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.user_id === user?.id ? (
                            <span className="text-xs text-muted-foreground">Vos</span>
                          ) : r.role === "admin" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRemoveDialog({ open: true, target: r })}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Quitar
                            </Button>
                          ) : r.role === "superadmin" ? (
                            <span className="text-xs text-muted-foreground">Superadmin</span>
                          ) : null}
                          {/* Transfer button for admins (transfer superadmin TO them) */}
                          {r.role === "admin" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-2"
                              onClick={() => {
                                setTransferDialog({ open: true, target: r });
                                setTransferConfirmText("");
                                setTransferChecked(false);
                              }}
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-1" />
                              Transferir ownership
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Admin Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetAddForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar administrador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Buscar usuario por email</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="email@ejemplo.com"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchUsers()}
                />
                <Button variant="outline" size="icon" onClick={handleSearchUsers} disabled={searching || searchQuery.length < 2}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {searchResults.map((u) => (
                  <div
                    key={u.user_id}
                    className={`p-2 rounded cursor-pointer text-sm transition-colors ${
                      selectedUser?.user_id === u.user_id
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-muted border border-transparent"
                    }`}
                    onClick={() => setSelectedUser(u)}
                  >
                    {u.email}
                  </div>
                ))}
              </div>
            )}

            {selectedUser && (
              <>
                <div className="p-3 rounded-lg bg-muted text-sm">
                  Usuario seleccionado: <strong>{selectedUser.email}</strong>
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="superadmin">Superadmin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="confirm-add"
                    checked={addConfirmed}
                    onCheckedChange={(c) => setAddConfirmed(c === true)}
                  />
                  <label htmlFor="confirm-add" className="text-sm">
                    Entiendo que esto cambia los permisos de este usuario
                  </label>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSetRole}
              disabled={!selectedUser || !addConfirmed || actionLoading}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Asignar rol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Role Dialog */}
      <AlertDialog
        open={removeDialog.open}
        onOpenChange={(open) => setRemoveDialog({ open, target: open ? removeDialog.target : null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar rol de admin</AlertDialogTitle>
            <AlertDialogDescription>
              Esto quitará el acceso de administrador a <strong>{removeDialog.target?.email}</strong>. 
              El usuario ya no podrá acceder al panel de administración.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveRole} className="bg-destructive hover:bg-destructive/90" disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Quitar rol
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Superadmin Dialog */}
      <AlertDialog
        open={transferDialog.open}
        onOpenChange={(open) => {
          setTransferDialog({ open, target: open ? transferDialog.target : null });
          if (!open) { setTransferConfirmText(""); setTransferChecked(false); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transferir ownership</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Esto transferirá el rol de <strong>superadmin</strong> a{" "}
                  <strong>{transferDialog.target?.email}</strong>.
                </p>
                <p className="text-destructive font-medium">
                  Tu rol pasará a "admin". Ya no podrás gestionar roles.
                </p>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="confirm-transfer"
                    checked={transferChecked}
                    onCheckedChange={(c) => setTransferChecked(c === true)}
                  />
                  <label htmlFor="confirm-transfer" className="text-sm">
                    Entiendo que perderé el control de ownership
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>Escribí TRANSFERIR para confirmar:</Label>
                  <Input
                    value={transferConfirmText}
                    onChange={(e) => setTransferConfirmText(e.target.value)}
                    placeholder="TRANSFERIR"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransfer}
              disabled={transferConfirmText !== "TRANSFERIR" || !transferChecked || actionLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Transferir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
