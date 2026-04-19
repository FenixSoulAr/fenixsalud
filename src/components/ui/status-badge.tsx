import { cn } from "@/lib/utils";
import { getLanguage, t } from "@/i18n";

type StatusType = 
  | "upcoming" 
  | "past"
  | "completed" 
  | "cancelled" 
  | "active" 
  | "paused" 
  | "scheduled" 
  | "done" 
  | "result_received"
  | "taken"
  | "skipped";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

function getStatusConfig(): Record<StatusType, { label: string; className: string }> {
  const translations = t();
  return {
    // Appointments: Upcoming → green, Past → gray, Completed → gray, Cancelled → gray
    upcoming: { label: translations.appointments.upcoming, className: "status-upcoming" },
    past: { label: translations.appointments.past, className: "status-past" },
    completed: { label: translations.appointments.completed, className: "status-completed" },
    cancelled: { label: translations.appointments.cancelled, className: "status-cancelled" },
    
    // Medications: Active → green, Paused → gray, Completed → gray
    active: { label: translations.medications.active, className: "status-active" },
    paused: { label: translations.medications.paused, className: "status-paused" },
    
    // Tests: Scheduled → amber, Done → gray, Result received → green
    scheduled: { label: translations.tests.scheduled, className: "status-scheduled" },
    done: { label: translations.tests.done, className: "status-done" },
    result_received: { label: translations.tests.resultReceived, className: "status-result-received" },
    
    // Medication logs
    taken: { label: translations.dashboard.taken, className: "status-taken" },
    skipped: { label: translations.dashboard.missed, className: "status-skipped" },
  };
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = getStatusConfig()[status] || { label: status, className: "status-scheduled" };
  
  return (
    <span className={cn("status-badge", config.className, className)}>
      {config.label}
    </span>
  );
}

// Helper to convert database status to component status
export function normalizeStatus(dbStatus: string): StatusType {
  const normalized = dbStatus.toLowerCase().replace(/\s+/g, "_");
  const statusConfig = getStatusConfig();
  if (normalized in statusConfig) {
    return normalized as StatusType;
  }
  return "scheduled";
}
