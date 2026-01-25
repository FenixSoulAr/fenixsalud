import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getLanguage } from "@/i18n";

const ORIENTATION_KEY = "misalud_orientation_dismissed";

const content = {
  es: {
    message: "Empezá creando tu primera cita médica",
    button: "Crear cita",
  },
  en: {
    message: "Start by creating your first medical appointment",
    button: "Create appointment",
  },
};

export function OrientationBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(true); // Start hidden to prevent flash
  const lang = getLanguage() as "es" | "en";
  const t = content[lang] || content.en;

  useEffect(() => {
    if (!user) return;
    
    const userKey = `${ORIENTATION_KEY}_${user.id}`;
    const wasDismissed = localStorage.getItem(userKey) === "true";
    setDismissed(wasDismissed);
  }, [user]);

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
    <div className="relative mb-6 p-4 rounded-xl border bg-primary/5 border-primary/20">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="flex items-center gap-4 pr-8">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Calendar className="h-5 w-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t.message}
          </p>
        </div>
        
        <Button size="sm" onClick={handleCreateAppointment}>
          {t.button}
        </Button>
      </div>
    </div>
  );
}
