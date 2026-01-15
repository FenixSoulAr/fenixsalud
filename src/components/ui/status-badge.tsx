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
  upcoming: { label: "Upcoming", className: "status-upcoming" },
  completed: { label: "Completed", className: "status-completed" },
  cancelled: { label: "Cancelled", className: "status-cancelled" },
  active: { label: "Active", className: "status-active" },
  paused: { label: "Paused", className: "status-paused" },
  scheduled: { label: "Scheduled", className: "status-scheduled" },
  done: { label: "Done", className: "status-completed" },
  result_received: { label: "Result received", className: "status-active" },
  taken: { label: "Taken", className: "status-completed" },
  skipped: { label: "Skipped", className: "status-cancelled" },
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
