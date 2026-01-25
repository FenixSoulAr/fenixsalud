import { cn } from "@/lib/utils";
import { getLanguage } from "@/i18n";

export type BillingInterval = "monthly" | "yearly";

interface BillingIntervalToggleProps {
  value: BillingInterval;
  onChange: (value: BillingInterval) => void;
  className?: string;
}

export function BillingIntervalToggle({ value, onChange, className }: BillingIntervalToggleProps) {
  const lang = getLanguage();
  
  const labels = {
    monthly: lang === "es" ? "Mensual" : "Monthly",
    yearly: lang === "es" ? "Anual" : "Yearly",
    savings: lang === "es" ? "Ahorrá 2 meses" : "Save 2 months",
  };

  return (
    <div className={cn("inline-flex items-center rounded-lg bg-muted p-1", className)}>
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={cn(
          "relative px-4 py-2 text-sm font-medium rounded-md transition-all",
          value === "monthly"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {labels.monthly}
      </button>
      <button
        type="button"
        onClick={() => onChange("yearly")}
        className={cn(
          "relative px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
          value === "yearly"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {labels.yearly}
        <span className="text-xs font-normal text-primary bg-primary/10 px-1.5 py-0.5 rounded">
          {labels.savings}
        </span>
      </button>
    </div>
  );
}
