import { cn } from "@/lib/utils";

type StatusType = 
  | "upcoming" 
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

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  // Appointments: Upcoming → green, Completed → gray, Cancelled → gray
  upcoming: { label: "Upcoming", className: "status-upcoming" },
  completed: { label: "Completed", className: "status-completed" },
  cancelled: { label: "Cancelled", className: "status-cancelled" },
  
  // Medications: Active → green, Paused → gray, Completed → gray
  active: { label: "Active", className: "status-active" },
  paused: { label: "Paused", className: "status-paused" },
  
  // Tests: Scheduled → amber, Done → gray, Result received → green
  scheduled: { label: "Scheduled", className: "status-scheduled" },
  done: { label: "Done", className: "status-done" },
  result_received: { label: "Result received", className: "status-result-received" },
  
  // Medication logs
  taken: { label: "Taken", className: "status-taken" },
  skipped: { label: "Skipped", className: "status-skipped" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: "status-scheduled" };
  
  return (
    <span className={cn("status-badge", config.className, className)}>
      {config.label}
    </span>
  );
}

// Helper to convert database status to component status
export function normalizeStatus(dbStatus: string): StatusType {
  const normalized = dbStatus.toLowerCase().replace(/\s+/g, "_");
  if (normalized in statusConfig) {
    return normalized as StatusType;
  }
  return "scheduled";
}
