import { useState } from "react";
import { Users, Gift, Loader2, Check, X, Clock, CreditCard, Shield, Zap, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  is_admin_role?: boolean;
}

interface UsersSectionProps {
  users: AdminUser[];
  loading: boolean;
  onRefresh: () => void;
}

type GrantPlanType = "plus" | "pro";

export function UsersSection({ users, loading, onRefresh }: UsersSectionProps) {
  const lang = getLanguage();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Grant override dialog
  const [grantDialog, setGrantDialog] = useState<{ open: boolean; user: AdminUser | null; planType: GrantPlanType }>({
    open: false,
    user: null,
    planType: "plus",
  });
  const [grantDuration, setGrantDuration] = useState<string>("30");
  const [grantNotes, setGrantNotes] = useState("");

  // Revoke dialog
  const [revokeDialog, setRevokeDialog] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  });

  const openGrantDialog = (user: AdminUser, planType: GrantPlanType) => {
    setGrantDialog({ open: true, user, planType });
    setGrantDuration("30");
    setGrantNotes("");
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
          planCode: grantDialog.planType,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const planLabel = grantDialog.planType === "pro" ? "Pro" : "Plus";
      toast.success(lang === "es" ? `Override ${planLabel} otorgado` : `${planLabel} override granted`);
      setGrantDialog({ open: false, user: null, planType: "plus" });
      setGrantNotes("");
      setGrantDuration("30");
      onRefresh();
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
      onRefresh();
    } catch (err) {
      console.error("Failed to revoke override:", err);
      toast.error(lang === "es" ? "Error al revocar override" : "Failed to revoke override");
    } finally {
      setActionLoading(null);
    }
  };

  const getEffectivePlanBadge = (user: AdminUser) => {
    if (user.is_admin_role) {
      return (
        <Badge variant="outline" className="border-primary text-primary">
          <Shield className="h-3 w-3 mr-1" /> Admin
        </Badge>
      );
    }

    switch (user.effective_plan) {
      case "override_pro":
        return (
          <Badge className="bg-violet-600 hover:bg-violet-600/90 text-white">
            <Zap className="h-3 w-3 mr-1" /> Pro (Override)
          </Badge>
        );
      case "stripe_pro":
        return (
          <Badge className="bg-violet-600 hover:bg-violet-600/90 text-white">
            <CreditCard className="h-3 w-3 mr-1" /> Pro (Stripe)
          </Badge>
        );
      case "override_plus":
        return (
          <Badge className="bg-primary hover:bg-primary/90">
            <Gift className="h-3 w-3 mr-1" /> Plus (Override)
          </Badge>
        );
      case "stripe_plus":
        return (
          <Badge className="bg-accent hover:bg-accent/90">
            <CreditCard className="h-3 w-3 mr-1" /> Plus (Stripe)
          </Badge>
        );
      case "paypal_pro":
        return (
          <Badge className="bg-violet-600 hover:bg-violet-600/90 text-white">
            <CreditCard className="h-3 w-3 mr-1" />
            Pro (PayPal)
          </Badge>
        );
      case "paypal_plus":
        return (
          <Badge className="bg-accent hover:bg-accent/90">
            <CreditCard className="h-3 w-3 mr-1" />
            Plus (PayPal)
          </Badge>
        );
      case "google_play_pro":
        return (
          <Badge className="bg-violet-600 hover:bg-violet-600/90 text-white">
            <CreditCard className="h-3 w-3 mr-1" />
            Pro (Google Play)
          </Badge>
        );
      case "google_play_plus":
        return (
          <Badge className="bg-accent hover:bg-accent/90">
            <CreditCard className="h-3 w-3 mr-1" />
            Plus (Google Play)
          </Badge>
        );
      default:
        return <Badge variant="secondary">Free</Badge>;
    }
  };

  const renderActions = (user: AdminUser) => {
    if (user.is_admin_role) {
      return (
        <span className="text-xs text-muted-foreground">
          {lang === "es" ? "Acceso Admin" : "Admin Access"}
        </span>
      );
    }

    const isLoading = actionLoading === user.user_id;

    // User has an active override
    if (user.override_id) {
      const isCurrentlyPlus = user.effective_plan === "override_plus";
      return (
        <div className="flex items-center justify-end gap-2">
          {/* Upgrade to Pro if currently Plus */}
          {isCurrentlyPlus && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openGrantDialog(user, "pro")}
              disabled={isLoading}
              className="text-violet-600 hover:text-violet-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-1" />
                  {lang === "es" ? "Upgrade a Pro" : "Upgrade to Pro"}
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevokeDialog({ open: true, user })}
            disabled={isLoading}
            className="text-destructive hover:text-destructive"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <X className="h-4 w-4 mr-1" />
                {lang === "es" ? "Revocar" : "Revoke"}
              </>
            )}
          </Button>
        </div>
      );
    }

    // User has active subscription — no override actions for Pro
    if (["stripe_plus", "stripe_pro", "paypal_plus", "paypal_pro", "google_play_plus", "google_play_pro"].includes(user.effective_plan)) {
      return (
        <span className="text-xs text-muted-foreground">
          {lang === "es" ? "Suscripción activa" : "Active subscription"}
        </span>
      );
    }

    // Free user — show dropdown to grant Plus or Pro
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Gift className="h-4 w-4 mr-1" />
                {lang === "es" ? "Otorgar Plan" : "Grant Plan"}
                <ChevronDown className="h-3 w-3 ml-1" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openGrantDialog(user, "plus")}>
            <Gift className="h-4 w-4 mr-2" />
            {lang === "es" ? "Otorgar Plus" : "Grant Plus"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openGrantDialog(user, "pro")}>
            <Zap className="h-4 w-4 mr-2" />
            {lang === "es" ? "Otorgar Pro" : "Grant Pro"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const filteredUsers = users.filter((user) =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const grantPlanLabel = grantDialog.planType === "pro" ? "Pro" : "Plus";
  const isUpgrade = grantDialog.user?.effective_plan === "override_plus" && grantDialog.planType === "pro";

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {lang === "es" ? "Usuarios" : "Users"}
              </CardTitle>
              <CardDescription>
                {lang === "es" ? `${users.length} usuarios registrados` : `${users.length} registered users`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder={lang === "es" ? "Buscar por email..." : "Search by email..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : lang === "es" ? (
                  "Actualizar"
                ) : (
                  "Refresh"
                )}
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
                        <TableCell>{getEffectivePlanBadge(user)}</TableCell>
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
                                <div className="text-muted-foreground">
                                  {lang === "es" ? "Indefinido" : "Indefinite"}
                                </div>
                              )}
                              <div
                                className="text-muted-foreground truncate max-w-32"
                                title={user.override_granted_by || ""}
                              >
                                {lang === "es" ? "Por:" : "By:"} {user.override_granted_by?.split("@")[0]}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {renderActions(user)}
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
      <AlertDialog
        open={grantDialog.open}
        onOpenChange={(open) => setGrantDialog({ open, user: open ? grantDialog.user : null, planType: grantDialog.planType })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isUpgrade
                ? (lang === "es" ? "Upgrade a Pro" : "Upgrade to Pro")
                : (lang === "es" ? `Otorgar ${grantPlanLabel} Override` : `Grant ${grantPlanLabel} Override`)}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  {isUpgrade
                    ? (lang === "es"
                        ? `Se otorgará acceso Pro a ${grantDialog.user?.email} de forma inmediata mediante un override administrativo.`
                        : `This will upgrade ${grantDialog.user?.email} to Pro access via an administrative override.`)
                    : (lang === "es"
                        ? `Se otorgará acceso ${grantPlanLabel} a ${grantDialog.user?.email} de forma inmediata mediante un override administrativo.`
                        : `This will grant ${grantPlanLabel} access to ${grantDialog.user?.email} via an administrative override.`)}
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
                      <SelectItem value="indefinite">
                        {lang === "es" ? "Indefinido" : "Indefinite"}
                      </SelectItem>
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
              {isUpgrade
                ? (lang === "es" ? "Sí, upgrade a Pro" : "Yes, upgrade to Pro")
                : (lang === "es" ? `Sí, otorgar ${grantPlanLabel}` : `Yes, grant ${grantPlanLabel}`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Override Dialog */}
      <AlertDialog
        open={revokeDialog.open}
        onOpenChange={(open) => setRevokeDialog({ open, user: open ? revokeDialog.user : null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{lang === "es" ? "Revocar Override" : "Revoke Override"}</AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "es"
                ? `Esto revocará el acceso de ${revokeDialog.user?.email}. El usuario volverá al plan Free.`
                : `This will revoke access from ${revokeDialog.user?.email}. The user will return to the Free plan.`}
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
    </>
  );
}
