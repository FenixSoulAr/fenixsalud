import { Clock, Pill, Check } from "lucide-react";
import { GroupedIntakes } from "@/hooks/useTodayMedicationIntakes";
import { useTranslations } from "@/i18n";
import { cn } from "@/lib/utils";

interface TodayMedicationIntakesProps {
  groupedIntakes: GroupedIntakes;
}

export function TodayMedicationIntakes({ groupedIntakes }: TodayMedicationIntakesProps) {
  const t = useTranslations();
  const { nextTime, nextIntakes, laterIntakes, doneIntakes } = groupedIntakes;

  const hasAnyIntakes = nextIntakes.length > 0 || laterIntakes.length > 0 || doneIntakes.length > 0;

  if (!hasAnyIntakes) {
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
      
      <div className="space-y-3">
        {/* Next group header + items */}
        {nextIntakes.length > 0 && nextTime && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-primary">
                {t.dashboard.next} ({nextTime})
              </span>
            </div>
            {nextIntakes.map((intake) => (
              <IntakeItem key={intake.id} intake={intake} isNext />
            ))}
          </div>
        )}

        {/* Later pending intakes */}
        {laterIntakes.length > 0 && (
          <div className="space-y-2">
            {laterIntakes.map((intake) => (
              <IntakeItem key={intake.id} intake={intake} />
            ))}
          </div>
        )}

        {/* Done intakes */}
        {doneIntakes.length > 0 && (
          <div className="space-y-2">
            {doneIntakes.map((intake) => (
              <IntakeItem key={intake.id} intake={intake} isDone />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

interface IntakeItemProps {
  intake: GroupedIntakes["nextIntakes"][0];
  isNext?: boolean;
  isDone?: boolean;
}

function IntakeItem({ intake, isNext, isDone }: IntakeItemProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-colors",
        isNext && "ring-2 ring-primary/50 bg-primary/5",
        isDone && "bg-muted/50 opacity-70"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center",
          isDone 
            ? "bg-accent text-accent-foreground" 
            : isNext 
              ? "bg-primary/20 text-primary" 
              : "bg-muted text-muted-foreground"
        )}>
          {isDone ? (
            <Check className="h-4 w-4" />
          ) : (
            <Pill className="h-4 w-4" />
          )}
        </div>
        <div>
          <p className={cn(
            "font-medium",
            isDone && "line-through text-muted-foreground"
          )}>
            {intake.medicationName}
          </p>
          {intake.doseText && (
            <p className="text-sm text-muted-foreground">{intake.doseText}</p>
          )}
        </div>
      </div>
      
      {!isNext && (
        <span className={cn(
          "text-sm font-medium",
          isDone ? "text-muted-foreground" : "text-muted-foreground"
        )}>
          {intake.time}
        </span>
      )}
    </div>
  );
}
