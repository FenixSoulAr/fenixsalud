import { useState } from "react";
import { Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmergencyInfo } from "@/hooks/useEmergencyInfo";
import { useTranslations } from "@/i18n";
import { cn } from "@/lib/utils";
import { EmergencyInfoModal } from "@/components/EmergencyInfoModal";

export function EmergencyButton() {
  const t = useTranslations();
  const { isFirstUse, isLoading } = useEmergencyInfo();
  const [open, setOpen] = useState(false);

  const shouldPulse = !isLoading && isFirstUse;
  const label = t.emergency.buttonLabel;

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className={cn(
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
          "rounded-full h-9 w-9 p-0 lg:w-auto lg:px-4 lg:gap-2",
          shouldPulse && "animate-[pulse_3s_ease-in-out_infinite]"
        )}
      >
        <Siren className="h-5 w-5" />
        <span className="hidden lg:inline font-semibold tracking-wide text-xs uppercase">
          {label}
        </span>
      </Button>
      <EmergencyInfoModal open={open} onOpenChange={setOpen} />
    </>
  );
}
