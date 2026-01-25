import { useState } from "react";
import { Tag, Plus, Loader2, Check, X, Percent, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface PromoCode {
  id: string;
  code: string;
  type: string;
  value: number;
  duration_type: string;
  duration_value: number | null;
  max_redemptions: number | null;
  redeemed_count: number;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  stripe_coupon_id: string | null;
  created_at: string;
  last_used_at: string | null;
}

interface PromoCodesSectionProps {
  promoCodes: PromoCode[];
  loading: boolean;
  onRefresh: () => void;
}

export function PromoCodesSection({ promoCodes, loading, onRefresh }: PromoCodesSectionProps) {
  const lang = getLanguage();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deactivateDialog, setDeactivateDialog] = useState<{ open: boolean; code: PromoCode | null }>({
    open: false,
    code: null,
  });

  // Form state
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState<"stripe_coupon" | "internal_override">("stripe_coupon");
  const [formValue, setFormValue] = useState("10");
  const [formDuration, setFormDuration] = useState<"once" | "3_months" | "forever">("once");
  const [formMaxRedemptions, setFormMaxRedemptions] = useState("");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formStripeCouponId, setFormStripeCouponId] = useState("");

  const resetForm = () => {
    setFormCode("");
    setFormType("stripe_coupon");
    setFormValue("10");
    setFormDuration("once");
    setFormMaxRedemptions("");
    setFormExpiresAt("");
    setFormStripeCouponId("");
  };

  const handleCreateCode = async () => {
    if (!formCode.trim()) {
      toast.error(lang === "es" ? "El código es requerido" : "Code is required");
      return;
    }

    setActionLoading("create");
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: {
          action: "create_promo_code",
          code: formCode.trim().toUpperCase(),
          type: formType,
          value: parseInt(formValue),
          durationValue: formDuration === "3_months" ? 3 : null,
          durationType: formDuration === "3_months" ? "repeating" : formDuration,
          maxRedemptions: formMaxRedemptions ? parseInt(formMaxRedemptions) : null,
          expiresAt: formExpiresAt || null,
          stripeCouponId: formType === "stripe_coupon" && formStripeCouponId ? formStripeCouponId : null,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(lang === "es" ? "Código creado" : "Code created");
      setCreateDialogOpen(false);
      resetForm();
      onRefresh();
    } catch (err) {
      console.error("Failed to create promo code:", err);
      toast.error(lang === "es" ? "Error al crear código" : "Failed to create code");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateDialog.code) return;

    setActionLoading(deactivateDialog.code.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: {
          action: "deactivate_promo_code",
          codeId: deactivateDialog.code.id,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(lang === "es" ? "Código desactivado" : "Code deactivated");
      setDeactivateDialog({ open: false, code: null });
      onRefresh();
    } catch (err) {
      console.error("Failed to deactivate promo code:", err);
      toast.error(lang === "es" ? "Error al desactivar código" : "Failed to deactivate code");
    } finally {
      setActionLoading(null);
    }
  };

  const getTypeBadge = (code: PromoCode) => {
    if (code.type === "internal_override") {
      return (
        <Badge className="bg-primary hover:bg-primary/90">
          <Gift className="h-3 w-3 mr-1" />
          {lang === "es" ? "Override" : "Override"}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Percent className="h-3 w-3 mr-1" />
        Stripe
      </Badge>
    );
  };

  const formatDuration = (code: PromoCode) => {
    if (code.duration_type === "forever") return lang === "es" ? "Siempre" : "Forever";
    if (code.duration_type === "once") return lang === "es" ? "Una vez" : "Once";
    if (code.duration_type === "repeating" && code.duration_value) {
      return `${code.duration_value} ${lang === "es" ? "meses" : "months"}`;
    }
    return "-";
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                {lang === "es" ? "Códigos Promocionales" : "Promo Codes"}
              </CardTitle>
              <CardDescription>
                {lang === "es"
                  ? `${promoCodes.length} códigos configurados`
                  : `${promoCodes.length} codes configured`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : lang === "es" ? (
                  "Actualizar"
                ) : (
                  "Refresh"
                )}
              </Button>
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                {lang === "es" ? "Crear Código" : "Create Code"}
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
                    <TableHead>{lang === "es" ? "Código" : "Code"}</TableHead>
                    <TableHead>{lang === "es" ? "Tipo" : "Type"}</TableHead>
                    <TableHead>{lang === "es" ? "Valor" : "Value"}</TableHead>
                    <TableHead>{lang === "es" ? "Duración" : "Duration"}</TableHead>
                    <TableHead>{lang === "es" ? "Usos" : "Uses"}</TableHead>
                    <TableHead>{lang === "es" ? "Estado" : "Status"}</TableHead>
                    <TableHead className="text-right">{lang === "es" ? "Acciones" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promoCodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {lang === "es" ? "No hay códigos promocionales" : "No promo codes"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    promoCodes.map((code) => (
                      <TableRow key={code.id}>
                        <TableCell className="font-mono font-medium">{code.code}</TableCell>
                        <TableCell>{getTypeBadge(code)}</TableCell>
                        <TableCell>
                          {code.type === "internal_override" ? (
                            <span className="text-primary font-medium">100% Plus</span>
                          ) : (
                            `${code.value}%`
                          )}
                        </TableCell>
                        <TableCell>{formatDuration(code)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-medium">{code.redeemed_count}</span>
                            {code.max_redemptions && (
                              <span className="text-muted-foreground">/{code.max_redemptions}</span>
                            )}
                          </div>
                          {code.last_used_at && (
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(code.last_used_at), "dd/MM/yyyy")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {code.is_active ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              {lang === "es" ? "Activo" : "Active"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <X className="h-3 w-3 mr-1" />
                              {lang === "es" ? "Inactivo" : "Inactive"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {code.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeactivateDialog({ open: true, code })}
                              disabled={actionLoading === code.id}
                              className="text-destructive hover:text-destructive"
                            >
                              {actionLoading === code.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>{lang === "es" ? "Desactivar" : "Deactivate"}</>
                              )}
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

      {/* Create Code Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{lang === "es" ? "Crear Código Promocional" : "Create Promo Code"}</DialogTitle>
            <DialogDescription>
              {lang === "es"
                ? "Los códigos de Stripe se aplican en checkout. Los overrides otorgan Plus directamente."
                : "Stripe codes apply at checkout. Overrides grant Plus directly."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{lang === "es" ? "Código" : "Code"}</Label>
              <Input
                placeholder="PROMO2025"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>{lang === "es" ? "Tipo" : "Type"}</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as typeof formType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe_coupon">
                    {lang === "es" ? "Cupón Stripe (descuento %)" : "Stripe Coupon (% discount)"}
                  </SelectItem>
                  <SelectItem value="internal_override">
                    {lang === "es" ? "Override Interno (100% Plus)" : "Internal Override (100% Plus)"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formType === "stripe_coupon" && (
              <>
                <div className="space-y-2">
                  <Label>{lang === "es" ? "Descuento (%)" : "Discount (%)"}</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{lang === "es" ? "ID Cupón Stripe (opcional)" : "Stripe Coupon ID (optional)"}</Label>
                  <Input
                    placeholder="promo_abc123"
                    value={formStripeCouponId}
                    onChange={(e) => setFormStripeCouponId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {lang === "es"
                      ? "Si ya existe en Stripe, ingresa el ID. Si no, crea uno en Stripe primero."
                      : "If it exists in Stripe, enter the ID. Otherwise, create it in Stripe first."}
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>{lang === "es" ? "Duración" : "Duration"}</Label>
              <Select value={formDuration} onValueChange={(v) => setFormDuration(v as typeof formDuration)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">{lang === "es" ? "Una vez" : "Once"}</SelectItem>
                  <SelectItem value="3_months">{lang === "es" ? "3 meses" : "3 months"}</SelectItem>
                  <SelectItem value="forever">{lang === "es" ? "Siempre" : "Forever"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{lang === "es" ? "Máximo usos" : "Max uses"}</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder={lang === "es" ? "Sin límite" : "Unlimited"}
                  value={formMaxRedemptions}
                  onChange={(e) => setFormMaxRedemptions(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{lang === "es" ? "Expira" : "Expires"}</Label>
                <Input
                  type="date"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {lang === "es" ? "Cancelar" : "Cancel"}
            </Button>
            <Button onClick={handleCreateCode} disabled={actionLoading === "create"}>
              {actionLoading === "create" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {lang === "es" ? "Crear" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <AlertDialog
        open={deactivateDialog.open}
        onOpenChange={(open) => setDeactivateDialog({ open, code: open ? deactivateDialog.code : null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{lang === "es" ? "Desactivar Código" : "Deactivate Code"}</AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "es"
                ? `¿Desactivar el código "${deactivateDialog.code?.code}"? Los usuarios no podrán usarlo más.`
                : `Deactivate code "${deactivateDialog.code?.code}"? Users won't be able to use it anymore.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === "es" ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-destructive hover:bg-destructive/90">
              {lang === "es" ? "Desactivar" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
