import { useState } from "react";
import { Clock, Pill, Check } from "lucide-react";
import { GroupedIntakes, MedicationIntake } from "@/hooks/useTodayMedicationIntakes";
import { useTranslations } from "@/i18n";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useTimezone } from "@/hooks/useTimezone";
import { toast } from "@/hooks/use-toast";

interface TodayMedicationIntakesProps {
  groupedIntakes: GroupedIntakes;
  onIntakeMarked?: () => void;
}

export function TodayMedicationIntakes({ groupedIntakes, onIntakeMarked }: TodayMedicationIntakesProps) {
  const t = useTranslations();
  const { nextTime, nextIntakes, laterIntakes, doneIntakes } = groupedIntakes;
  const { dataProfileId, currentUserId, canEdit } = useActiveProfile();
  const { timezone } = useTimezone();
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());

  const hasAnyIntakes = nextIntakes.length > 0 || laterIntakes.length > 0 || doneIntakes.length > 0;

  // Get today's date in user's timezone for scheduled_at
  const getTodayScheduledAt = (time: string) => {
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD
    return `${todayStr}T${time}:00`;
  };

  const markAsTaken = async (intake: MedicationIntake) => {
    if (!dataProfileId || !currentUserId || !canEdit) return;

    setMarkingIds(prev => new Set(prev).add(intake.id));

    try {
      const scheduledAt = getTodayScheduledAt(intake.time);
      const takenAt = new Date().toISOString();

      const { error } = await supabase.from("medication_logs").insert({
        profile_id: dataProfileId,
        user_id: currentUserId,
        medication_id: intake.medicationId,
        scheduled_at: scheduledAt,
        taken_at: takenAt,
        status: "Taken",
      });

      if (error) {
        console.error("Error marking intake as taken:", error);
        toast({
          title: t.misc.error,
          description: t.misc.unexpectedError,
          variant: "destructive",
        });
      } else {
        onIntakeMarked?.();
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setMarkingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(intake.id);
        return newSet;
      });
    }
  };

  const markAllNextAsTaken = async () => {
    if (!dataProfileId || !currentUserId || !canEdit || nextIntakes.length === 0) return;

    const intakeIds = nextIntakes.map(i => i.id);
    setMarkingIds(prev => {
      const newSet = new Set(prev);
      intakeIds.forEach(id => newSet.add(id));
      return newSet;
    });

    try {
      const takenAt = new Date().toISOString();
      const insertData = nextIntakes.map(intake => ({
        profile_id: dataProfileId,
        user_id: currentUserId,
        medication_id: intake.medicationId,
        scheduled_at: getTodayScheduledAt(intake.time),
        taken_at: takenAt,
        status: "Taken" as const,
      }));

      const { error } = await supabase.from("medication_logs").insert(insertData);

      if (error) {
        console.error("Error marking all intakes as taken:", error);
        toast({
          title: t.misc.error,
          description: t.misc.unexpectedError,
          variant: "destructive",
        });
      } else {
        onIntakeMarked?.();
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setMarkingIds(prev => {
        const newSet = new Set(prev);
        intakeIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

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
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-primary">
                {t.dashboard.next} ({nextTime})
              </span>
              {canEdit && nextIntakes.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllNextAsTaken}
                  disabled={markingIds.size > 0}
                  className="text-xs h-7"
                >
                  {t.dashboard.markAllAsTaken}
                </Button>
              )}
            </div>
            {nextIntakes.map((intake) => (
              <IntakeItem 
                key={intake.id} 
                intake={intake} 
                isNext 
                onMarkAsTaken={() => markAsTaken(intake)}
                isMarking={markingIds.has(intake.id)}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}

        {/* Later pending intakes */}
        {laterIntakes.length > 0 && (
          <div className="space-y-2">
            {laterIntakes.map((intake) => (
              <IntakeItem 
                key={intake.id} 
                intake={intake} 
                onMarkAsTaken={() => markAsTaken(intake)}
                isMarking={markingIds.has(intake.id)}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}

        {/* Done intakes */}
        {doneIntakes.length > 0 && (
          <div className="space-y-2">
            {doneIntakes.map((intake) => (
              <IntakeItem key={intake.id} intake={intake} isDone canEdit={canEdit} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

interface IntakeItemProps {
  intake: MedicationIntake;
  isNext?: boolean;
  isDone?: boolean;
  onMarkAsTaken?: () => void;
  isMarking?: boolean;
  canEdit: boolean;
}

function IntakeItem({ intake, isNext, isDone, onMarkAsTaken, isMarking, canEdit }: IntakeItemProps) {
  const t = useTranslations();
  
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-colors",
        isNext && "ring-2 ring-primary/50 bg-primary/5",
        isDone && "bg-muted/50 opacity-70"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox for pending items */}
        {!isDone && canEdit ? (
          <Checkbox
            checked={false}
            onCheckedChange={() => onMarkAsTaken?.()}
            disabled={isMarking}
            className="h-5 w-5"
          />
        ) : (
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
        )}
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
      
      <div className="flex items-center gap-2">
        {isDone && (
          <span className="text-xs font-medium text-accent-foreground bg-accent px-2 py-0.5 rounded">
            {t.dashboard.taken}
          </span>
        )}
        {!isDone && !isNext && (
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {t.dashboard.pending}
          </span>
        )}
        {!isNext && (
          <span className={cn(
            "text-sm font-medium",
            isDone ? "text-muted-foreground" : "text-muted-foreground"
          )}>
            {intake.time}
          </span>
        )}
      </div>
    </div>
  );
}
