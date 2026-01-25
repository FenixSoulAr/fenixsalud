import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Gift, Loader2, Check, X, Clock, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";
import { format } from "date-fns";
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

interface AdminUser {
  user_id: string;
  email: string;
  user_created_at: string;
  subscription_status: string | null;
  plan_code: string | null;
  plan_name: string | null;
  stripe_subscription_id: string | null;
  override_id: string | null;
  override_expires_at: string | null;
  override_granted_by: string | null;
  override_created_at: string | null;
  effective_plan: string;
}

export default function Admin() {
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const lang = getLanguage();
  
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Grant override dialog
  const [grantDialog, setGrantDialog] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  });
  const [grantDuration, setGrantDuration] = useState<string>("30");
  const [grantNotes, setGrantNotes] = useState("");
  
  // Revoke dialog
  const [revokeDialog, setRevokeDialog] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  });

  // Check admin access and redirect if not
  useEffect(() => {
    if (!isAdmin) {
      navigate("/", { replace: true });
    }
  }, [isAdmin, navigate]);

  // Fetch users
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "list_users" },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setUsers(data.users || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      toast.error(lang === "es" ? "Error al cargar usuarios" : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleGrantOverride = async () => {
    if (!grantDialog.user) return;
    
    setActionLoading(grantDialog.user.user_id);
    try {
      const expiresInDays = grantDuration === "indefinite" ? null : parseInt(grantDuration);
      
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: {
          action: "grant_override",
          userId: grantDialog.user.user_id,
          expiresInDays,
          notes: grantNotes || undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(lang === "es" ? "Override Plus otorgado" : "Plus override granted");
      setGrantDialog({ open: false, user: null });
      setGrantNotes("");
      setGrantDuration("30");
      fetchUsers();
    } catch (err) {
      console.error("Failed to grant override:", err);
      toast.error(lang === "es" ? "Error al otorgar override" : "Failed to grant override");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeOverride = async () => {
    if (!revokeDialog.user) return;
    
    setActionLoading(revokeDialog.user.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: {
          action: "revoke_override",
          userId: revokeDialog.user.user_id,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(lang === "es" ? "Override revocado" : "Override revoked");
      setRevokeDialog({ open: false, user: null });
      fetchUsers();
    } catch (err) {
      console.error("Failed to revoke override:", err);
      toast.error(lang === "es" ? "Error al revocar override" : "Failed to revoke override");
    } finally {
      setActionLoading(null);
    }
  };

  const getEffectivePlanBadge = (plan: string) => {
    switch (plan) {
      case "override_plus":
        return <Badge className="bg-primary hover:bg-primary/90"><Gift className="h-3 w-3 mr-1" /> Plus (Override)</Badge>;
      case "stripe_plus":
        return <Badge className="bg-accent hover:bg-accent/90"><CreditCard className="h-3 w-3 mr-1" /> Plus (Stripe)</Badge>;
      default:
        return <Badge variant="secondary">Free</Badge>;
    }
  };

  const filteredUsers = users.filter((user) =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={lang === "es" ? "Administración" : "Administration"}
        description={lang === "es" ? "Gestión de usuarios y planes" : "User and plan management"}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {lang === "es" ? "Usuarios" : "Users"}
              </CardTitle>
              <CardDescription>
                {lang === "es" 
                  ? `${users.length} usuarios registrados` 
                  : `${users.length} registered users`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder={lang === "es" ? "Buscar por email..." : "Search by email..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (lang === "es" ? "Actualizar" : "Refresh")}
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
                    <TableHead>{lang === "es" ? "Registrado" : "Registered"}</TableHead>
                    <TableHead>{lang === "es" ? "Plan Efectivo" : "Effective Plan"}</TableHead>
                    <TableHead>{lang === "es" ? "Override" : "Override"}</TableHead>
                    <TableHead className="text-right">{lang === "es" ? "Acciones" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        {lang === "es" ? "No se encontraron usuarios" : "No users found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.user_id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.user_created_at 
                            ? format(new Date(user.user_created_at), "dd/MM/yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>{getEffectivePlanBadge(user.effective_plan)}</TableCell>
                        <TableCell>
                          {user.override_id ? (
                            <div className="text-xs space-y-1">
                              <div className="flex items-center gap-1 text-primary">
                                <Check className="h-3 w-3" />
                                {lang === "es" ? "Activo" : "Active"}
                              </div>
                              {user.override_expires_at ? (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(user.override_expires_at), "dd/MM/yyyy")}
                                </div>
                              ) : (
                                <div className="text-muted-foreground">{lang === "es" ? "Indefinido" : "Indefinite"}</div>
                              )}
                              <div className="text-muted-foreground truncate max-w-32" title={user.override_granted_by || ""}>
                                {lang === "es" ? "Por:" : "By:"} {user.override_granted_by?.split("@")[0]}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {user.override_id ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRevokeDialog({ open: true, user })}
                                disabled={actionLoading === user.user_id}
                                className="text-destructive hover:text-destructive"
                              >
                                {actionLoading === user.user_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <><X className="h-4 w-4 mr-1" /> {lang === "es" ? "Revocar" : "Revoke"}</>
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setGrantDialog({ open: true, user })}
                                disabled={actionLoading === user.user_id || user.effective_plan === "stripe_plus"}
                              >
                                {actionLoading === user.user_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <><Gift className="h-4 w-4 mr-1" /> {lang === "es" ? "Otorgar Plus" : "Grant Plus"}</>
                                )}
                              </Button>
                            )}
                          </div>
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

      {/* Grant Override Dialog */}
      <AlertDialog open={grantDialog.open} onOpenChange={(open) => setGrantDialog({ open, user: open ? grantDialog.user : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lang === "es" ? "Otorgar Plus Override" : "Grant Plus Override"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  {lang === "es" 
                    ? `Esto otorgará acceso Plus a ${grantDialog.user?.email}.`
                    : `This will grant Plus access to ${grantDialog.user?.email}.`}
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {lang === "es" ? "Duración" : "Duration"}
                  </label>
                  <Select value={grantDuration} onValueChange={setGrantDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">{lang === "es" ? "30 días" : "30 days"}</SelectItem>
                      <SelectItem value="90">{lang === "es" ? "90 días" : "90 days"}</SelectItem>
                      <SelectItem value="365">{lang === "es" ? "1 año" : "1 year"}</SelectItem>
                      <SelectItem value="indefinite">{lang === "es" ? "Indefinido" : "Indefinite"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {lang === "es" ? "Notas (opcional)" : "Notes (optional)"}
                  </label>
                  <Input
                    placeholder={lang === "es" ? "Motivo del override..." : "Reason for override..."}
                    value={grantNotes}
                    onChange={(e) => setGrantNotes(e.target.value)}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === "es" ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleGrantOverride}>
              {lang === "es" ? "Otorgar" : "Grant"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Override Dialog */}
      <AlertDialog open={revokeDialog.open} onOpenChange={(open) => setRevokeDialog({ open, user: open ? revokeDialog.user : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lang === "es" ? "Revocar Override" : "Revoke Override"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "es" 
                ? `Esto revocará el acceso Plus de ${revokeDialog.user?.email}. El usuario volverá al plan Free.`
                : `This will revoke Plus access from ${revokeDialog.user?.email}. The user will return to the Free plan.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === "es" ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeOverride} className="bg-destructive hover:bg-destructive/90">
              {lang === "es" ? "Revocar" : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
