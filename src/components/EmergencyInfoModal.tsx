import { useEffect, useState } from "react";
import { Info, Edit, Siren } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmergencyInfo, type EmergencyInfoData } from "@/hooks/useEmergencyInfo";
import { useTranslations } from "@/i18n";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const UNKNOWN_VALUE = "__unknown__";

function CriticalBadge({ label }: { label: string }) {
  return (
    <span
      className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded text-xs font-medium"
      title={label}
      aria-label={label}
    >
      ★
    </span>
  );
}

function ReadRow({ label, value, critical, t }: { label: string; value: string | null; critical?: boolean; t: ReturnType<typeof useTranslations> }) {
  const isEmpty = !value || value.trim() === "";
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground min-w-[40%]">
        {label}
        {critical && <CriticalBadge label={t.emergency.critical} />}
      </div>
      <div className={cn("text-sm text-right break-words", isEmpty && "text-muted-foreground/60")}>
        {isEmpty ? t.emergency.emptyValue : value}
      </div>
    </div>
  );
}

export function EmergencyInfoModal({ open, onOpenChange }: Props) {
  const t = useTranslations();
  const { data, isFirstUse, isLoading, save, isSaving, ownerDisplayName } = useEmergencyInfo();
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [form, setForm] = useState<EmergencyInfoData>(data);

  // Initialize mode and form when modal opens
  useEffect(() => {
    if (open) {
      setMode(isFirstUse ? "edit" : "read");
      setForm(data);
    }
  }, [open, isFirstUse, data]);

  const update = <K extends keyof EmergencyInfoData>(key: K, value: EmergencyInfoData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const appendAllergy = (term: string) => {
    const current = (form.allergies || "").trim();
    const next = current ? `${current}, ${term}` : term;
    update("allergies", next);
  };

  const handleSave = async () => {
    const ok = await save({
      blood_type: form.blood_type || null,
      emergency_phone: form.emergency_phone || null,
      allergies: form.allergies || null,
      insurance_provider: form.insurance_provider || null,
      insurance_plan: form.insurance_plan || null,
      insurance_member_id: form.insurance_member_id || null,
    });
    if (ok) {
      toast.success(t.emergency.saveSuccess);
      setMode("read");
    } else {
      toast.error(t.emergency.saveError);
    }
  };

  const bloodValue = form.blood_type
    ? form.blood_type === "Unknown" || form.blood_type === "No sé"
      ? UNKNOWN_VALUE
      : form.blood_type
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-destructive" />
            {t.emergency.modalTitle}
          </DialogTitle>
          {ownerDisplayName && (
            <p className="text-xs text-muted-foreground pt-0.5">
              {t.emergency.belongsTo} <span className="font-medium">{ownerDisplayName}</span>
            </p>
          )}
          <DialogDescription>{t.emergency.modalSubtitle}</DialogDescription>
        </DialogHeader>

        {mode === "edit" && isFirstUse && (
          <div className="flex gap-3 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3">
            <Info className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-900 dark:text-emerald-100">
              {t.emergency.onboardingMessage}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">…</div>
        ) : mode === "read" ? (
          <div className="flex flex-col">
            <ReadRow t={t} label={t.emergency.bloodType} value={data.blood_type} critical />
            <ReadRow t={t} label={t.emergency.emergencyPhone} value={data.emergency_phone} critical />
            <ReadRow t={t} label={t.emergency.allergies} value={data.allergies} critical />
            <ReadRow t={t} label={t.emergency.insuranceProvider} value={data.insurance_provider} />
            <ReadRow t={t} label={t.emergency.insurancePlan} value={data.insurance_plan} />
            <ReadRow t={t} label={t.emergency.insuranceMemberId} value={data.insurance_member_id} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Blood type */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                {t.emergency.bloodType}
                <CriticalBadge label={t.emergency.critical} />
              </Label>
              <Select
                value={bloodValue}
                onValueChange={(v) =>
                  update("blood_type", v === UNKNOWN_VALUE ? t.emergency.bloodTypeUnknown : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.emergency.selectBloodType} />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_TYPES.map((bt) => (
                    <SelectItem key={bt} value={bt}>
                      {bt}
                    </SelectItem>
                  ))}
                  <SelectItem value={UNKNOWN_VALUE}>{t.emergency.bloodTypeUnknown}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Emergency phone */}
            <div className="space-y-1.5">
              <Label htmlFor="emergency-phone" className="flex items-center gap-2">
                {t.emergency.emergencyPhone}
                <CriticalBadge label={t.emergency.critical} />
              </Label>
              <Input
                id="emergency-phone"
                type="tel"
                value={form.emergency_phone || ""}
                onChange={(e) => update("emergency_phone", e.target.value)}
                placeholder={t.emergency.emergencyPhonePlaceholder}
              />
            </div>

            {/* Allergies */}
            <div className="space-y-1.5">
              <Label htmlFor="allergies" className="flex items-center gap-2">
                {t.emergency.allergies}
                <CriticalBadge label={t.emergency.critical} />
              </Label>
              <Textarea
                id="allergies"
                rows={3}
                value={form.allergies || ""}
                onChange={(e) => update("allergies", e.target.value)}
                placeholder={t.emergency.allergiesPlaceholder}
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {t.emergency.allergiesSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => appendAllergy(s)}
                    className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground transition-colors"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Insurance */}
            <div className="space-y-1.5">
              <Label htmlFor="ins-provider">{t.emergency.insuranceProvider}</Label>
              <Input
                id="ins-provider"
                value={form.insurance_provider || ""}
                onChange={(e) => update("insurance_provider", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins-plan">{t.emergency.insurancePlan}</Label>
              <Input
                id="ins-plan"
                value={form.insurance_plan || ""}
                onChange={(e) => update("insurance_plan", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins-member">{t.emergency.insuranceMemberId}</Label>
              <Input
                id="ins-member"
                value={form.insurance_member_id || ""}
                onChange={(e) => update("insurance_member_id", e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {mode === "read" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t.emergency.close}
              </Button>
              <Button onClick={() => setMode("edit")}>
                <Edit className="h-4 w-4" />
                {t.emergency.edit}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                {isFirstUse ? t.emergency.dismissForNow : t.emergency.cancel}
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {t.emergency.save}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
