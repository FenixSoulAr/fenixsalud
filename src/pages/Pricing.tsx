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
import { isAndroidNative } from "@/utils/platform";
import { BillingIntervalToggle, type BillingInterval } from "@/components/billing/BillingIntervalToggle";
import { useSearchParams } from "react-router-dom";

export default function Pricing() {
  const { isPlus, isPro } = useEntitlementsContext();
  const { startCheckout, loading: stripeLoading } = usePayPalCheckout();
  const { startGooglePlayPurchase, loading: gplayLoading } = useGooglePlayCheckout();
  const checkoutLoading = stripeLoading || gplayLoading;
  const { schedulePlanChange, loading: downgradeLoading } = useDowngradePlan();
  const lang = getLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  // DEBUG: platform detection — remove after confirming
  useEffect(() => {
    console.log("[Pricing] Platform detection:", {
      isAndroidNative,
      capacitorPlatform: (window as any).Capacitor?.getPlatform?.() ?? "N/A",
      capacitorIsNative: (window as any).Capacitor?.isNativePlatform?.() ?? false,
    });
  }, []);

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
          ? "Para quienes necesitan compartir y exportar"
          : "Share records and export summaries",
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
          ? "Para cuidar la salud de toda tu familia"
          : "Full family health management",
        features: [
          { text: lang === "es" ? "Hasta 5 perfiles"                    : "Up to 5 profiles",                ok: true },
          { text: lang === "es" ? "Hasta 200 archivos adjuntos"         : "Up to 200 attachments",           ok: true },
          { text: lang === "es" ? "Todo lo del plan Plus"               : "Everything in Plus",              ok: true },
          { text: lang === "es" ? "Compartir con múltiples personas"    : "Share with multiple people",      ok: true },
          { text: lang === "es" ? "Backup completo de datos"            : "Full data backup",                ok: true },
          { text: lang === "es" ? "Soporte prioritario"                 : "Priority support",                ok: true },
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
      <PageHeader
        variant="gradient"
        title={lang === "es" ? "Planes y Precios" : "Plans & Pricing"}
        description={
          lang === "es"
            ? "Elegí el plan que mejor se adapte a tus necesidades"
            : "Choose the plan that best fits your needs"
        }
      />

      {/* Billing interval toggle — always visible */}
      <div className="flex justify-center mb-6">
        <BillingIntervalToggle value={interval} onChange={handleIntervalChange} />
      </div>

      <div className="grid md:grid-cols-3 gap-5 max-w-5xl">
        {/* FREE */}
        <div className={`health-card relative flex flex-col ${isFree ? "ring-2 ring-primary" : ""}`}>
          {isFree && (
            <Badge className="absolute -top-3 left-4 bg-primary">{t.currentPlan}</Badge>
          )}
          <div className="flex items-center gap-2 mb-2">
            <img src="/favicon-48x48.png" alt="My Health Hub" className="h-5 w-5 object-contain" />
            <h2 className="text-xl font-bold">{t.plans.free.name}</h2>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-3xl font-bold">{t.plans.free.price}</span>
            <span className="text-muted-foreground text-sm">{t.forever}</span>
          </div>
          <p className="text-muted-foreground text-sm mb-5">{t.plans.free.description}</p>
          <ul className="space-y-2.5 mb-6 flex-1">
            {t.plans.free.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                {f.ok
                  ? <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  : <X className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />}
                <span className={`text-sm ${f.ok ? "" : "text-muted-foreground"}`}>{f.text}</span>
              </li>
            ))}
          </ul>
          {(isPlus || isPro) ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full mt-auto" disabled={downgradeLoading}>
                  {t.downgradeToFree}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
                  <AlertDialogDescription>{t.confirmDesc("Free")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t.cancelBtn}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => schedulePlanChange("free")}>{t.confirmBtn}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button variant="outline" disabled className="w-full mt-auto">
              {isFree ? t.youreOnThisPlan : t.plans.free.name}
            </Button>
          )}
        </div>

        {/* PLUS */}
        <div className={`health-card relative flex flex-col border-2 ${
          isPlus && !isPro
            ? "ring-2 ring-primary border-primary/40"
            : plusHighlighted
              ? "ring-2 ring-primary/60 border-primary/40"
              : "border-primary/40"
        }`}>
          {isPlus && !isPro && (
            <Badge className="absolute -top-3 left-4 bg-primary">{t.currentPlan}</Badge>
          )}
          {plusHighlighted && !isPlus && (
            <Badge className="absolute -top-3 left-4 bg-primary/80">{t.recommended}</Badge>
          )}
          <Badge className="absolute -top-3 right-4 bg-primary/10 text-primary border border-primary/30">
            {t.popular}
          </Badge>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t.plans.plus.name}</h2>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-3xl font-bold">{plusPrice}</span>
            <span className="text-muted-foreground text-sm">{periodSuffix}</span>
          </div>
          {isYearly && (
            <p className="text-xs text-primary font-medium mb-1">{t.saveLabel}</p>
          )}
          <p className="text-muted-foreground text-sm mb-5">{t.plans.plus.description}</p>
          <ul className="space-y-2.5 mb-6 flex-1">
            {t.plans.plus.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                {f.ok
                  ? <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  : <X className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />}
                <span className={`text-sm ${f.ok ? "" : "text-muted-foreground"}`}>{f.text}</span>
              </li>
            ))}
          </ul>
          {isPlus && !isPro ? (
            <Button variant="outline" disabled className="w-full mt-auto">{t.youreOnThisPlan}</Button>
          ) : isPro ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full mt-auto" disabled={downgradeLoading}>
                  {t.scheduleDowngrade}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
                  <AlertDialogDescription>{t.confirmDesc("Plus")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t.cancelBtn}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => schedulePlanChange(plusPlanCode)}>{t.confirmBtn}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button className="w-full mt-auto" onClick={() => {
              isAndroidNative ? startGooglePlayPurchase(plusPlanCode) : startCheckout(plusPlanCode);
            }} disabled={checkoutLoading}>
              {checkoutLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t.upgradeToPlus}
            </Button>
          )}
        </div>

        {/* PRO */}
        <div className={`health-card relative flex flex-col ${
          isPro
            ? "ring-2 ring-primary"
            : proHighlighted
              ? "ring-2 ring-primary/60"
              : ""
        }`}>
          {isPro && (
            <Badge className="absolute -top-3 left-4 bg-primary">{t.currentPlan}</Badge>
          )}
          {proHighlighted && !isPro && (
            <Badge className="absolute -top-3 left-4 bg-primary/80">{t.recommended}</Badge>
          )}
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t.plans.pro.name}</h2>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-3xl font-bold">{proPrice}</span>
            <span className="text-muted-foreground text-sm">{periodSuffix}</span>
          </div>
          {isYearly && (
            <p className="text-xs text-primary font-medium mb-1">{t.saveLabel}</p>
          )}
          <p className="text-muted-foreground text-sm mb-5">{t.plans.pro.description}</p>
          <ul className="space-y-2.5 mb-6 flex-1">
            {t.plans.pro.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-sm">{f.text}</span>
              </li>
            ))}
          </ul>
          {isPro ? (
            <Button variant="outline" disabled className="w-full mt-auto">{t.youreOnThisPlan}</Button>
          ) : (
            <Button
              className="w-full mt-auto"
              variant="outline"
              onClick={() => {
                console.log("[Pricing] Pro button clicked:", { isAndroidNative, planCode: proPlanCode, fn: isAndroidNative ? "startGooglePlayPurchase" : "startCheckout" });
                isAndroidNative ? startGooglePlayPurchase(proPlanCode) : startCheckout(proPlanCode);
              }}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t.upgradeToPro}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8 p-4 bg-muted/40 rounded-lg max-w-5xl">
        <p className="text-sm text-muted-foreground text-center">
          {isAndroidNative
            ? (lang === "es"
              ? "🛒 Compra segura a través de Google Play. Cancelá en cualquier momento."
              : "🛒 Secure purchase via Google Play. Cancel anytime.")
            : (lang === "es"
              ? "💳 Pagos seguros con PayPal. Cancelá en cualquier momento."
              : "💳 Secure payments via PayPal. Cancel anytime.")}
        </p>
      </div>
    </div>
  );
}
