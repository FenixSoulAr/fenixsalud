import { Button } from "@/components/ui/button";
import { ShieldCheck, FileText, CalendarCheck, Share2 } from "lucide-react";

interface OnboardingFlowProps {
  onComplete: () => void;
}

const bullets = [
  { icon: FileText, text: "Guardá estudios, diagnósticos, medicación y citas." },
  { icon: CalendarCheck, text: "Tené todo ordenado y disponible cuando lo necesites." },
  { icon: Share2, text: "Exportá y compartí información fácilmente." },
];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-8">
        {/* Logo */}
        <img
          src="/favicon-96x96.png"
          alt="My Health Hub"
          className="h-20 w-20 rounded-2xl object-contain mx-auto"
        />

        {/* Title & subtitle */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">My Health Hub</h1>
          <p className="text-muted-foreground text-base">
            Mi centro de salud personal.
          </p>
        </div>

        {/* Bullets */}
        <div className="space-y-4 text-left">
          {bullets.map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="text-sm text-foreground leading-relaxed pt-1.5">{text}</p>
            </div>
          ))}
        </div>

        {/* Trust line */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Tus datos se guardan de forma segura y vos decidís qué compartir.</span>
        </div>

        {/* CTA */}
        <Button onClick={onComplete} className="w-full" size="lg">
          Comenzar
        </Button>
      </div>
    </div>
  );
}
