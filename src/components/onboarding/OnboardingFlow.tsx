import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Users, Sparkles } from "lucide-react";
import { getLanguage } from "@/i18n";

interface OnboardingFlowProps {
  onComplete: () => void;
}

const screens = {
  es: [
    {
      icon: null,
      title: "Tu información de salud, organizada.",
      text: "Registrá citas, estudios y medicación en un solo lugar, de forma clara y accesible cuando lo necesites.",
      button: "Continuar",
    },
    {
      icon: Users,
      title: "Trabajamos por perfiles.",
      text: "Cada perfil representa a una persona. Podés llevar tu propia información o la de un familiar.",
      button: "Continuar",
    },
    {
      icon: Sparkles,
      title: "Elegí cómo usar la app.",
      text: null, // Custom content for plans
      button: "Empezar",
    },
  ],
  en: [
    {
      icon: null,
      title: "Your health information, organized.",
      text: "Track appointments, tests, and medications in one place, clearly accessible when you need it.",
      button: "Continue",
    },
    {
      icon: Users,
      title: "We work with profiles.",
      text: "Each profile represents a person. You can manage your own information or a family member's.",
      button: "Continue",
    },
    {
      icon: Sparkles,
      title: "Choose how to use the app.",
      text: null, // Custom content for plans
      button: "Get Started",
    },
  ],
};

const planContent = {
  es: {
    free: {
      label: "Plan Free",
      description: "Organizá tu propia salud.",
    },
    plus: {
      label: "Plan Plus",
      description: "Compartí información, exportá datos y cuidá a otros.",
    },
  },
  en: {
    free: {
      label: "Free Plan",
      description: "Organize your own health.",
    },
    plus: {
      label: "Plus Plan",
      description: "Share information, export data, and care for others.",
    },
  },
};

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentScreen, setCurrentScreen] = useState(0);
  const lang = getLanguage() as "es" | "en";
  const content = screens[lang] || screens.en;
  const plans = planContent[lang] || planContent.en;

  const handleNext = () => {
    if (currentScreen < content.length - 1) {
      setCurrentScreen(currentScreen + 1);
    } else {
      onComplete();
    }
  };

  const screen = content[currentScreen];
  const Icon = screen.icon;
  const isLastScreen = currentScreen === content.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {content.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-2 rounded-full transition-colors ${
                index === currentScreen
                  ? "bg-primary"
                  : index < currentScreen
                  ? "bg-primary/50"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="text-center space-y-6 animate-fade-in" key={currentScreen}>
          {/* Icon */}
          <div className="flex justify-center">
            {Icon ? (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-10 w-10" />
              </div>
            ) : (
              <img src="/favicon-96x96.png" alt="My Health Hub" className="h-20 w-20 rounded-2xl object-contain" />
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-foreground">
            {screen.title}
          </h1>

          {/* Text or Plans */}
          {screen.text ? (
            <p className="text-muted-foreground text-base leading-relaxed">
              {screen.text}
            </p>
          ) : (
            <div className="space-y-4 text-left">
              {/* Free Plan */}
              <div className="p-4 rounded-xl border bg-card">
                <p className="font-medium text-foreground">{plans.free.label}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {plans.free.description}
                </p>
              </div>
              {/* Plus Plan */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5">
                <p className="font-medium text-foreground">{plans.plus.label}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {plans.plus.description}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Button */}
        <div className="mt-10">
          <Button
            onClick={handleNext}
            className="w-full"
            size="lg"
          >
            {screen.button}
          </Button>
        </div>

        {/* Skip option (subtle, only on first two screens) */}
        {!isLastScreen && (
          <button
            onClick={onComplete}
            className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {lang === "es" ? "Saltar" : "Skip"}
          </button>
        )}
      </div>
    </div>
  );
}
