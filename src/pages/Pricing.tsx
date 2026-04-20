import { useEffect, useState } from "react";
import { Check, X, Crown, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { getLanguage } from "@/i18n";
import { usePayPalCheckout } from "@/hooks/usePayPalCheckout";
import { useDowngradePlan } from "@/hooks/useDowngradePlan";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useGooglePlayCheckout } from "@/hooks/useGooglePlayCheckout";
import { isAndroidNative, getIsAndroidNative } from "@/utils/platform";
import { BillingIntervalToggle, type BillingInterval } from "@/components/billing/BillingIntervalToggle";
import { useSearchParams } from "react-router-dom";

function SectionRow({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={4} className="pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-t border-border/40">{label}</td>
    </tr>
  );
}

function FeatureRow({ label, free, plus, pro, plusHighlight, proHighlight }: {
  label: string;
  free?: boolean | string;
  plus?: boolean | string;
  pro?: boolean | string;
  plusHighlight?: boolean;
  proHighlight?: boolean;
}) {
  const Cell = ({ val, highlight }: { val?: boolean | string; highlight?: boolean }) => (
    <td className="px-2 py-2.5 text-center border-b border-border/30 align-middle border-l border-r border-border/20">
      {val === undefined || val === false ? (
        <span className="text-muted-foreground/40 text-sm">—</span>
      ) : val === true ? (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10">
          <Check className="h-3 w-3 text-primary" />
        </span>
      ) : (
        <span className={`text-xs font-medium ${highlight ? "text-primary" : "text-foreground"}`}>{val}</span>
      )}
    </td>
  );
  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="py-2.5 pr-3 text-sm text-foreground border-b border-border/30">{label}</td>
      <Cell val={free} />
      <Cell val={plus} highlight={plusHighlight} />
      <Cell val={pro} highlight={proHighlight} />
    </tr>
  );
}

export default function Pricing() {
  const { isPlus, isPro } = useEntitlementsContext();
  const { startCheckout, loading: stripeLoading } = usePayPalCheckout();
  const { startGooglePlayPurchase, loading: gplayLoading } = useGooglePlayCheckout();
  const checkoutLoading = stripeLoading || gplayLoading;
  const { schedulePlanChange, loading: downgradeLoading } = useDowngradePlan();
  const lang = getLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isAndroidNative, setIsAndroidNative] = useState(false);
  useEffect(() => {
    setIsAndroidNative(getIsAndroidNative());
  }, []);

  // DEBUG: platform detection — remove after confirming
  useEffect(() => {
    console.log("[Pricing] Platform detection:", {
      isAndroidNative,
      capacitorPlatform: (window as any).Capacitor?.getPlatform?.() ?? "N/A",
      capacitorIsNative: (window as any).Capacitor?.isNativePlatform?.() ?? false,
    });
  }, [isAndroidNative]);

  // Persist toggle via URL param ?billing=monthly|yearly
  const billingParam = searchParams.get("billing");
  const [interval, setInterval] = useState<BillingInterval>(
    billingParam === "yearly" ? "yearly" : "monthly"
  );

  // Context-aware plan highlight: ?highlight=plus|pro
  const highlight = searchParams.get("highlight") as "plus" | "pro" | null;

  // Sync interval changes into URL so it survives Stripe redirect
  function handleIntervalChange(val: BillingInterval) {
    setInterval(val);
    const next = new URLSearchParams(searchParams);
    next.set("billing", val);
    setSearchParams(next, { replace: true });
  }

  // On mount, if returning from Stripe (upgrade=success), keep billing param
  useEffect(() => {
    if (billingParam === "yearly" || billingParam === "monthly") {
      setInterval(billingParam);
    }
  }, [billingParam]);

  const isYearly = interval === "yearly";

  const t = {
    currentPlan:    lang === "es" ? "Plan actual"          : "Current plan",
    youreOnThisPlan:lang === "es" ? "Estás en este plan"   : "You're on this plan",
    upgradeToPlus:  lang === "es" ? "Elegir Plus"          : "Get Plus",
    upgradeToPro:   lang === "es" ? "Elegir Pro"           : "Get Pro",
    perMonth:       lang === "es" ? "/mes"                 : "/month",
    perYear:        lang === "es" ? "/año"                 : "/year",
    forever:        lang === "es" ? "/siempre"             : "/forever",
    popular:        lang === "es" ? "Más popular"          : "Most popular",
    saveLabel:      lang === "es" ? "Ahorrá 2 meses"       : "Save 2 months",
    recommended:    lang === "es" ? "Recomendado"          : "Recommended",
    scheduleDowngrade: lang === "es" ? "Cambiar a este plan" : "Switch to this plan",
    downgradeToFree: lang === "es" ? "Bajar a Gratis" : "Downgrade to Free",
    confirmTitle: lang === "es" ? "¿Confirmar cambio de plan?" : "Confirm plan change?",
    confirmDesc: (planName: string) => lang === "es"
      ? `Tu plan actual continuará activo hasta su vencimiento. Luego cambiará automáticamente a ${planName}.`
      : `Your current plan stays active until it expires. Then it will automatically switch to ${planName}.`,
    confirmBtn: lang === "es" ? "Confirmar" : "Confirm",
    cancelBtn: lang === "es" ? "Cancelar" : "Cancel",
    plans: {
      free: {
        name:        lang === "es" ? "Gratis" : "Free",
        price:       "$0",
        description: lang === "es"
          ? "Para organizar tu propia salud personal"
          : "Organize your own personal health",
        features: [
          { text: lang === "es" ? "1 perfil personal"                                    : "1 personal profile",                         ok: true  },
          { text: lang === "es" ? "Hasta 10 archivos adjuntos"                           : "Up to 10 attachments",                       ok: true  },
          { text: lang === "es" ? "Citas, medicamentos, estudios, diagnósticos"          : "Appointments, medications, tests, diagnoses", ok: true  },
          { text: lang === "es" ? "Profesionales e instituciones"                        : "Professionals & institutions",               ok: true  },
          { text: lang === "es" ? "Recordatorios ilimitados"                             : "Unlimited reminders",                        ok: true  },
          { text: lang === "es" ? "Cirugías, hospitalizaciones, vacunas"                 : "Surgeries, hospitalizations, vaccines",       ok: false },
          { text: lang === "es" ? "Exportar resumen clínico PDF"                         : "Export clinical summary PDF",                ok: false },
          { text: lang === "es" ? "Compartir con familia/cuidadores"                     : "Share with family/caregivers",               ok: false },
          { text: lang === "es" ? "Backup completo"                                      : "Full data backup",                           ok: false },
        ],
      },
      plus: {
        name:        "Plus",
        monthlyPrice:"$7",
        yearlyPrice: "$70",
        description: lang === "es"
          ? "Compart\u00ED tu salud con quienes necesit\u00E1s"
          : "Share your health with those you need",
        features: [
          { text: lang === "es" ? "1 perfil personal"                    : "1 personal profile",              ok: true  },
          { text: lang === "es" ? "Hasta 100 archivos adjuntos"          : "Up to 100 attachments",           ok: true  },
          { text: lang === "es" ? "Todo lo del plan Gratis"              : "Everything in Free",              ok: true  },
          { text: lang === "es" ? "Cirugías, hospitalizaciones, vacunas" : "Surgeries, hospitalizations, vaccines", ok: true },
          { text: lang === "es" ? "Exportar resumen clínico PDF"         : "Export clinical summary PDF",     ok: true  },
          { text: lang === "es" ? "Compartir con 1 persona"              : "Share with 1 person",             ok: true  },
          { text: lang === "es" ? "Roles (solo lectura, colaborador)"    : "Roles (viewer, contributor)",     ok: true  },
          { text: lang === "es" ? "Múltiples perfiles"                   : "Multiple profiles",               ok: false },
          { text: lang === "es" ? "Backup completo"                      : "Full data backup",                ok: false },
        ],
      },
      pro: {
        name:        "Pro",
        monthlyPrice:"$12",
        yearlyPrice: "$120",
        description: lang === "es"
          ? "Gestion\u00E1 la salud de toda tu familia"
          : "Manage your whole family's health",
        features: [
          { text: lang === "es" ? "Hasta 5 perfiles"                    : "Up to 5 profiles",                ok: true },
          { text: lang === "es" ? "Hasta 200 archivos adjuntos"         : "Up to 200 attachments",           ok: true },
          { text: lang === "es" ? "Todo lo del plan Plus"               : "Everything in Plus",              ok: true },
          { text: lang === "es" ? "Compartir con múltiples personas"    : "Share with multiple people",      ok: true },
          { text: lang === "es" ? "Backup completo de datos"            : "Full data backup",                ok: true },
        ],
      },
    },
  };

  const isFree = !isPlus && !isPro;

  // Price IDs — always the source of truth for checkout
  const plusPlanCode = isYearly ? "plus_yearly" : "plus_monthly";
  const proPlanCode  = isYearly ? "pro_yearly"  : "pro_monthly";

  const plusPrice = isYearly ? t.plans.plus.yearlyPrice : t.plans.plus.monthlyPrice;
  const proPrice  = isYearly ? t.plans.pro.yearlyPrice  : t.plans.pro.monthlyPrice;
  const periodSuffix = isYearly ? t.perYear : t.perMonth;

  // Context-aware highlight ring
  const plusHighlighted = highlight === "plus";
  const proHighlighted  = highlight === "pro";

  return (
    <div className="animate-fade-in">
      <PageHeader variant="gradient"
        title={lang === "es" ? "Planes y Precios" : "Plans & Pricing"}
        description={lang === "es" ? "Elegí el plan que mejor se adapte a tus necesidades" : "Choose the plan that best fits your needs"}
      />

      {/* Toggle mensual/anual */}
      <div className="flex justify-center mb-8">
        <BillingIntervalToggle value={interval} onChange={handleIntervalChange} />
      </div>

      {/* Tabla comparativa */}
      <div className="overflow-x-auto max-w-4xl">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "36%" }} />
            <col style={{ width: "21.3%" }} />
            <col style={{ width: "21.3%" }} />
            <col style={{ width: "21.3%" }} />
          </colgroup>

          {/* Cabecera de planes */}
          <thead>
            <tr>
              <th />
              {/* FREE */}
              <th className="pb-4 px-2 align-bottom">
                <div className="rounded-t-xl border border-b-0 border-border/60 bg-card p-2 text-center">
                  <p className="text-sm font-semibold text-foreground mb-1">Free</p>
                  <p className="text-lg font-bold text-foreground">$0</p>
                  <p className="text-xs text-muted-foreground">{lang === "es" ? "para siempre" : "forever"}</p>
                  <p className="hidden sm:block text-[11px] leading-snug text-muted-foreground mt-2 px-1 break-words">
                    {lang === "es" ? "Para empezar a organizarte" : "Start organizing"}
                  </p>
                </div>
              </th>
              {/* PLUS */}
              <th className="pb-4 px-2 align-bottom relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 whitespace-nowrap">
                    {lang === "es" ? "Más popular" : "Most popular"}
                  </Badge>
                </div>
                <div className="rounded-t-xl border-2 border-b-0 border-primary bg-card p-2 text-center">
                  <p className="text-sm font-semibold text-foreground mb-1">Plus</p>
                  <p className="text-lg font-bold text-foreground">{plusPrice}</p>
                  <p className="text-xs text-muted-foreground">{periodSuffix}</p>
                  {isYearly && <p className="text-xs font-medium text-primary mt-0.5">{t.saveLabel}</p>}
                  {isAndroidNative && isFree && !isYearly && (
                    <p className="text-xs font-medium text-primary mt-0.5">50% off · primeros 2 meses</p>
                  )}
                  <p className="hidden sm:block text-[11px] leading-snug text-muted-foreground mt-2 px-1 break-words">
                    {lang === "es" ? "Tu salud, compartida" : "Your health, shared"}
                  </p>
                </div>
              </th>
              {/* PRO */}
              <th className="pb-4 px-2 align-bottom">
                <div className="rounded-t-xl border border-b-0 border-border/60 bg-card p-2 text-center">
                  <p className="text-sm font-semibold text-foreground mb-1">Pro</p>
                  <p className="text-lg font-bold text-foreground">{proPrice}</p>
                  <p className="text-xs text-muted-foreground">{periodSuffix}</p>
                  <p className="hidden sm:block text-xs font-semibold text-primary mt-2 px-1">
                    {lang === "es" ? "Para toda la familia" : "For the whole family"}
                  </p>
                  <p className="hidden sm:block text-[11px] leading-snug text-muted-foreground mt-1 px-1 break-words">
                    {lang === "es" ? "Gestión familiar completa" : "Complete family management"}
                  </p>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {/* Tu información de salud */}
            <SectionRow label={lang === "es" ? "Tu información de salud" : "Your health information"} />
            <FeatureRow label={lang === "es" ? "Citas, medicación, estudios, diagnósticos" : "Appointments, medications, tests, diagnoses"} free plus pro />
            <FeatureRow label={lang === "es" ? "Médicos e instituciones" : "Doctors & institutions"} free plus pro />
            <FeatureRow label={lang === "es" ? "Cirugías, hospitalizaciones, vacunas" : "Surgeries, hospitalizations, vaccines"} plus pro />
            <FeatureRow label={lang === "es" ? "Archivos adjuntos" : "Attachments"} free="10" plus="100" pro="200" plusHighlight proHighlight />
            <FeatureRow label={lang === "es" ? "Exportar resumen clínico PDF" : "Export clinical summary PDF"} plus pro />

            {/* Compartir mi perfil */}
            <SectionRow label={lang === "es" ? "Compartir mi perfil" : "Share my profile"} />
            <FeatureRow label={lang === "es" ? "Compartir mi perfil con otros" : "Share my profile with others"} plus={lang === "es" ? "Hasta 2 personas" : "Up to 2 people"} pro={lang === "es" ? "Hasta 2 personas" : "Up to 2 people"} plusHighlight proHighlight />
            <FeatureRow label={lang === "es" ? "Nivel de acceso (solo lectura / colaborador)" : "Access level (read-only / collaborator)"} plus pro />

            {/* Gestionar perfiles de familiares */}
            <SectionRow label={lang === "es" ? "Gestionar perfiles de familiares" : "Manage family profiles"} />
            <FeatureRow label={lang === "es" ? "Perfiles adicionales de familiares" : "Additional family profiles"} pro={lang === "es" ? "Hasta 4 adicionales" : "Up to 4 additional"} proHighlight />
            <FeatureRow label={lang === "es" ? "Backup completo de datos" : "Full data backup"} pro />
            <FeatureRow label={lang === "es" ? "Alertas y recordatorios" : "Alerts & reminders"} pro={lang === "es" ? "Próximamente" : "Coming soon"} proHighlight />
            <FeatureRow label={lang === "es" ? "Integración con calendario" : "Calendar integration"} pro={lang === "es" ? "Próximamente" : "Coming soon"} proHighlight />

            {/* ── FILA CTAs ── */}
            <tr>
              <td className="pt-4 pb-2" />
              {/* FREE CTA */}
              <td className="px-2 pt-4 pb-2 align-top">
                <div className="rounded-b-xl border border-t-0 border-border/60 bg-card p-3 text-center">
                  {(isPlus || isPro) ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full text-xs" disabled={downgradeLoading}>{lang === "es" ? "Bajar a Free" : "Downgrade"}</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle><AlertDialogDescription>{t.confirmDesc("Free")}</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>{t.cancelBtn}</AlertDialogCancel><AlertDialogAction onClick={() => schedulePlanChange("free")}>{t.confirmBtn}</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full text-xs" disabled>{isFree ? t.youreOnThisPlan : "Free"}</Button>
                  )}
                </div>
              </td>
              {/* PLUS CTA */}
              <td className="px-2 pt-4 pb-2 align-top">
                <div className="rounded-b-xl border-2 border-t-0 border-primary bg-card p-3 text-center">
                  {isPlus && !isPro ? (
                    <Button variant="outline" size="sm" className="w-full text-xs" disabled>{t.youreOnThisPlan}</Button>
                  ) : isPro ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full text-xs" disabled={downgradeLoading}>{lang === "es" ? "Cambiar" : "Switch"}</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle><AlertDialogDescription>{t.confirmDesc("Plus")}</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>{t.cancelBtn}</AlertDialogCancel><AlertDialogAction onClick={() => schedulePlanChange(plusPlanCode)}>{t.confirmBtn}</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button size="sm" className="w-full text-xs" onClick={() => { isAndroidNative ? startGooglePlayPurchase(plusPlanCode, (!isYearly && isFree) ? "plus-50off-3meses" : undefined) : startCheckout(plusPlanCode); }} disabled={checkoutLoading}>
                      {checkoutLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}{t.upgradeToPlus}
                    </Button>
                  )}
                </div>
              </td>
              {/* PRO CTA */}
              <td className="px-2 pt-4 pb-2 align-top">
                <div className="rounded-b-xl border border-t-0 border-border/60 bg-card p-3 text-center">
                  {isPro ? (
                    <Button variant="outline" size="sm" className="w-full text-xs" disabled>{t.youreOnThisPlan}</Button>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { isAndroidNative ? startGooglePlayPurchase(proPlanCode) : startCheckout(proPlanCode); }} disabled={checkoutLoading}>
                      {checkoutLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}{t.upgradeToPro}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-6 p-4 bg-muted/40 rounded-lg max-w-4xl">
        <p className="text-sm text-muted-foreground text-center">
          {isAndroidNative
            ? (lang === "es" ? "🛒 Compra segura a través de Google Play. Cancelá en cualquier momento." : "🛒 Secure purchase via Google Play. Cancel anytime.")
            : (lang === "es" ? "💳 Pagos seguros con PayPal. Cancelá en cualquier momento." : "💳 Secure payments via PayPal. Cancel anytime.")}
        </p>
      </div>
    </div>
  );
}
