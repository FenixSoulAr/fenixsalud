import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getLanguage } from "@/i18n";

const ORIENTATION_KEY = "misalud_orientation_dismissed";

const content = {
  es: {
    title: "Empezá creando tu primera cita médica.",
    description: "Registrar una cita es la forma más simple de empezar a organizar tu información de salud.",
    button: "Crear cita",
  },
  en: {
    title: "Start by creating your first medical appointment.",
    description: "Scheduling an appointment is the simplest way to start organizing your health information.",
    button: "Create appointment",
  },
};

interface OrientationBannerProps {
  hasAppointments?: boolean;
}

export function OrientationBanner({ hasAppointments = false }: OrientationBannerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(true); // Start hidden to prevent flash
  const lang = getLanguage() as "es" | "en";
  const t = content[lang] || content.en;

  useEffect(() => {
    if (!user) return;
    
    const userKey = `${ORIENTATION_KEY}_${user.id}`;
    const wasDismissed = localStorage.getItem(userKey) === "true";
    
    // Auto-dismiss if user already has appointments
    if (hasAppointments && !wasDismissed) {
      localStorage.setItem(userKey, "true");
      setDismissed(true);
      return;
    }
    
    setDismissed(wasDismissed);
  }, [user, hasAppointments]);

  const handleDismiss = () => {
    if (user) {
      const userKey = `${ORIENTATION_KEY}_${user.id}`;
      localStorage.setItem(userKey, "true");
    }
    setDismissed(true);
  };

  const handleCreateAppointment = () => {
    handleDismiss();
    navigate("/appointments?new=true");
  };

  if (dismissed) return null;

  return (
    <div className="relative mb-6 p-5 rounded-xl border bg-primary/5 border-primary/20">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pr-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Calendar className="h-6 w-6" />
        </div>
        
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-medium text-foreground">
            {t.title}
          </p>
          <p className="text-sm text-muted-foreground">
            {t.description}
          </p>
        </div>
        
        <Button onClick={handleCreateAppointment} className="shrink-0 w-full sm:w-auto">
          {t.button}
        </Button>
      </div>
    </div>
  );
}
