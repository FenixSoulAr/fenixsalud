import { useState } from "react";
import { Check, X, Crown, Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { getLanguage } from "@/i18n";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { BillingIntervalToggle, type BillingInterval } from "@/components/billing/BillingIntervalToggle";

export default function Pricing() {
  const { planCode, isPlus } = useEntitlementsContext();
  const { startCheckout, loading: checkoutLoading } = useStripeCheckout();
  const lang = getLanguage();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");

  const t = {
    title: lang === "es" ? "Planes y Precios" : "Plans & Pricing",
    subtitle: lang === "es" 
      ? "Organizá tu salud → Gratis. Compartí, exportá o cuidá a otros → Plus." 
      : "Organize your own health → Free. Share, export, or care for others → Plus.",
    currentPlan: lang === "es" ? "Plan actual" : "Current plan",
    free: {
      name: lang === "es" ? "Gratis" : "Free",
      price: "$0",
      period: lang === "es" ? "/siempre" : "/forever",
      description: lang === "es" 
        ? "Todo lo que necesitás para organizar tu salud personal" 
        : "Everything you need to organize your personal health",
      features: [
        { text: lang === "es" ? "1 perfil personal" : "1 personal profile", included: true },
        { text: lang === "es" ? "9 archivos adjuntos incluidos" : "9 attachments included", included: true },
        { text: lang === "es" ? "Citas, medicamentos, tests, diagnósticos" : "Appointments, medications, tests, diagnoses", included: true },
        { text: lang === "es" ? "Doctores e instituciones" : "Doctors & institutions", included: true },
        { text: lang === "es" ? "Recordatorios ilimitados" : "Unlimited reminders", included: true },
        { text: lang === "es" ? "Compartir con familia/cuidadores" : "Share with family/caregivers", included: false },
        { text: lang === "es" ? "Roles (solo lectura, colaborador)" : "Roles (viewer, contributor)", included: false },
        { text: lang === "es" ? "Exportar resumen clínico PDF" : "Export clinical summary PDF", included: false },
        { text: lang === "es" ? "Exportar backup completo" : "Export full backup", included: false },
        { text: lang === "es" ? "Cirugías, hospitalizaciones, vacunas" : "Surgeries, hospitalizations, vaccines", included: false },
      ],
    },
    plus: {
      name: "Plus",
      monthlyPrice: "$5",
      monthlyPeriod: lang === "es" ? "/mes" : "/month",
      yearlyPrice: "$50",
      yearlyPeriod: lang === "es" ? "/año" : "/year",
      yearlySavings: lang === "es" ? "2 meses gratis" : "2 months free",
      description: lang === "es" 
        ? "Compartí, exportá y cuidá la salud de tu familia" 
        : "Share, export, and care for your family's health",
      features: [
        { text: lang === "es" ? "Hasta 10 perfiles" : "Up to 10 profiles", included: true },
        { text: lang === "es" ? "Archivos adjuntos ilimitados" : "Unlimited attachments", included: true },
        { text: lang === "es" ? "Todo lo de Free" : "Everything in Free", included: true },
        { text: lang === "es" ? "Compartir con familia/cuidadores" : "Share with family/caregivers", included: true },
        { text: lang === "es" ? "Roles (solo lectura, colaborador)" : "Roles (viewer, contributor)", included: true },
        { text: lang === "es" ? "Exportar resumen clínico PDF" : "Export clinical summary PDF", included: true },
        { text: lang === "es" ? "Exportar backup completo" : "Export full backup", included: true },
        { text: lang === "es" ? "Cirugías, hospitalizaciones, vacunas" : "Surgeries, hospitalizations, vaccines", included: true },
      ],
    },
    upgradeToPlusMonthly: lang === "es" ? "Upgrade a Plus Mensual" : "Upgrade to Plus Monthly",
    upgradeToPlusYearly: lang === "es" ? "Upgrade a Plus Anual" : "Upgrade to Plus Yearly",
    upgradeToPlus: lang === "es" ? "Upgrade a Plus" : "Upgrade to Plus",
    youreOnThisPlan: lang === "es" ? "Estás en este plan" : "You're on this plan",
  };

  // Calculate displayed price based on billing interval
  const displayPrice = billingInterval === "monthly" ? t.plus.monthlyPrice : t.plus.yearlyPrice;
  const displayPeriod = billingInterval === "monthly" ? t.plus.monthlyPeriod : t.plus.yearlyPeriod;
  const planCodeToUse = billingInterval === "monthly" ? "plus_monthly" : "plus_yearly";

  return (
    <div className="animate-fade-in">
      <PageHeader 
        variant="gradient"
        title={t.title}
        description={t.subtitle}
      />

      {/* Billing Interval Toggle - shown only for non-Plus users */}
      {!isPlus && (
        <div className="flex justify-center mb-6">
          <BillingIntervalToggle 
            value={billingInterval} 
            onChange={setBillingInterval} 
          />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
        {/* Free Plan */}
        <div className={`health-card relative ${planCode === "free" ? "ring-2 ring-primary" : ""}`}>
          {planCode === "free" && (
            <Badge className="absolute -top-3 left-4 bg-primary">
              {t.currentPlan}
            </Badge>
          )}
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">{t.free.name}</h2>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-3xl font-bold">{t.free.price}</span>
            <span className="text-muted-foreground">{t.free.period}</span>
          </div>
          <p className="text-muted-foreground mb-6">{t.free.description}</p>
          
          <ul className="space-y-3 mb-6">
            {t.free.features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2">
                {feature.included ? (
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                ) : (
                  <X className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <span className={feature.included ? "" : "text-muted-foreground"}>
                  {feature.text}
                </span>
              </li>
            ))}
          </ul>

          {planCode === "free" && (
            <Button variant="outline" disabled className="w-full">
              {t.youreOnThisPlan}
            </Button>
          )}
        </div>

        {/* Plus Plan */}
        <div className={`health-card relative border-2 border-primary/50 ${isPlus ? "ring-2 ring-primary" : ""}`}>
          {isPlus && (
            <Badge className="absolute -top-3 left-4 bg-primary">
              {t.currentPlan}
            </Badge>
          )}
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">{t.plus.name}</h2>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-3xl font-bold">{displayPrice}</span>
            <span className="text-muted-foreground">{displayPeriod}</span>
          </div>
          {billingInterval === "yearly" && (
            <p className="text-xs text-primary font-medium mb-2">
              ✨ {t.plus.yearlySavings}
            </p>
          )}
          <p className="text-muted-foreground mb-6">{t.plus.description}</p>
          
          <ul className="space-y-3 mb-6">
            {t.plus.features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>{feature.text}</span>
              </li>
            ))}
          </ul>

          {isPlus ? (
            <Button variant="outline" disabled className="w-full">
              {t.youreOnThisPlan}
            </Button>
          ) : (
            <Button 
              className="w-full" 
              onClick={() => startCheckout(planCodeToUse)}
              disabled={checkoutLoading}
            >
              {checkoutLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.upgradeToPlus}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8 p-4 bg-muted/50 rounded-lg max-w-4xl">
        <p className="text-sm text-muted-foreground text-center">
          {lang === "es" 
            ? "💡 Regla de oro: \"Organizá tu salud → Gratis. Compartí, exportá o cuidá a otros → Plus.\""
            : "💡 Golden rule: \"Organize your own health → Free. Share, export, or care for others → Plus.\""}
        </p>
      </div>
    </div>
  );
}
