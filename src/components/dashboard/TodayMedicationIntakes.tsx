import { Clock, Pill, Check } from "lucide-react";
import { MedicationIntake } from "@/hooks/useTodayMedicationIntakes";
import { useTranslations } from "@/i18n";
import { cn } from "@/lib/utils";

interface TodayMedicationIntakesProps {
  intakes: MedicationIntake[];
}

export function TodayMedicationIntakes({ intakes }: TodayMedicationIntakesProps) {
  const t = useTranslations();

  if (intakes.length === 0) {
    return (
      <section className="health-card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{t.dashboard.remember}</h2>
          <span className="text-sm text-muted-foreground">— {t.dashboard.today}</span>
        </div>
        <p className="text-sm text-muted-foreground">{t.dashboard.noRemindersToday}</p>
      </section>
    );
  }

  return (
    <section className="health-card mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">{t.dashboard.remember}</h2>
        <span className="text-sm text-muted-foreground">— {t.dashboard.today}</span>
      </div>
      
      <div className="space-y-2">
        {intakes.map((intake) => (
          <div
            key={intake.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border transition-colors",
              intake.isNext && "ring-2 ring-primary/50 bg-primary/5",
              intake.status === "done" && "bg-muted/50 opacity-70"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                intake.status === "done" 
                  ? "bg-accent text-accent-foreground" 
                  : intake.isNext 
                    ? "bg-primary/20 text-primary" 
                    : "bg-muted text-muted-foreground"
              )}>
                {intake.status === "done" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Pill className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className={cn(
                  "font-medium",
                  intake.status === "done" && "line-through text-muted-foreground"
                )}>
                  {intake.medicationName}
                </p>
                {intake.doseText && (
                  <p className="text-sm text-muted-foreground">{intake.doseText}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-sm font-medium",
                intake.isNext ? "text-primary" : "text-muted-foreground"
              )}>
                {intake.time}
              </span>
              {intake.isNext && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  {t.dashboard.next}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
