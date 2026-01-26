import { useState } from "react";
import { Clock, Check, AlertTriangle, ChevronDown, ChevronRight, Filter } from "lucide-react";
import { useMedicationHistory, GroupedHistory, MedicationLog } from "@/hooks/useMedicationHistory";
import { useTranslations } from "@/i18n";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export function MedicationHistory() {
  const t = useTranslations();
  const [medicationFilter, setMedicationFilter] = useState("all");
  const [dateRange, setDateRange] = useState<"today" | "week" | "all">("week");

  const { loading, groupedHistory, medications } = useMedicationHistory({
    medicationFilter,
    dateRange,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={medicationFilter} onValueChange={setMedicationFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t.medicationHistory.allMedications} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.medicationHistory.allMedications}</SelectItem>
              {medications.map((med) => (
                <SelectItem key={med.id} value={med.id}>
                  {med.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t.medicationHistory.filterToday}</SelectItem>
            <SelectItem value="week">{t.medicationHistory.filterWeek}</SelectItem>
            <SelectItem value="all">{t.medicationHistory.filterAll}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* History List */}
      {groupedHistory.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t.medicationHistory.noHistory}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedHistory.map((group, index) => (
            <DateGroup key={group.dateKey} group={group} defaultOpen={index === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

interface DateGroupProps {
  group: GroupedHistory;
  defaultOpen?: boolean;
}

function DateGroup({ group, defaultOpen = false }: DateGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const t = useTranslations();

  // Translate label
  const displayLabel =
    group.label === "today"
      ? t.medicationHistory.today
      : group.label === "yesterday"
        ? t.medicationHistory.yesterday
        : group.label;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium">{displayLabel}</span>
            <span className="text-sm text-muted-foreground">
              ({group.logs.length} {group.logs.length === 1 ? t.medicationHistory.intake : t.medicationHistory.intakes})
            </span>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 mt-2 pl-6">
          {group.logs.map((log) => (
            <HistoryItem key={log.id} log={log} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface HistoryItemProps {
  log: MedicationLog;
}

function HistoryItem({ log }: HistoryItemProps) {
  const t = useTranslations();

  const takenTime = log.takenAt.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            log.status === "on_time"
              ? "bg-accent text-accent-foreground"
              : "bg-warning/20 text-warning-foreground"
          )}
        >
          {log.status === "on_time" ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
        </div>
        <div>
          <p className="font-medium">{log.medicationName}</p>
          <p className="text-sm text-muted-foreground">
            {t.medicationHistory.scheduledFor} {log.scheduledTime} · {t.medicationHistory.takenAt} {takenTime}
          </p>
        </div>
      </div>

      <span
        className={cn(
          "text-xs font-medium px-2 py-0.5 rounded",
          log.status === "on_time"
            ? "bg-accent text-accent-foreground"
            : "bg-warning/20 text-warning-foreground"
        )}
      >
        {log.status === "on_time" ? t.medicationHistory.onTime : t.medicationHistory.takenLate}
      </span>
    </div>
  );
}
