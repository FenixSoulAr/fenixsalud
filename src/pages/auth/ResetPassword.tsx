import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const lang = getLanguage();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from the auth redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    // Also check hash for type=recovery (fallback)
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 10) {
      toast.error(
        lang === "es"
          ? "La contraseña debe tener al menos 10 caracteres."
          : "Password must be at least 10 characters."
      );
      return;
    }

    const hasNumberOrSymbol = /[0-9\W]/.test(password);
    if (!hasNumberOrSymbol) {
      toast.error(
        lang === "es"
          ? "La contraseña debe incluir al menos un número o símbolo."
          : "Password must include at least one number or symbol."
      );
      return;
    }

    if (password !== confirmPassword) {
      toast.error(
        lang === "es"
          ? "Las contraseñas no coinciden."
          : "Passwords do not match."
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(
        lang === "es"
          ? "Contraseña actualizada correctamente."
          : "Password updated successfully."
      );
      await supabase.auth.signOut();
      navigate("/auth/sign-in", { replace: true });
    } catch (error: any) {
      console.error("[ResetPassword] Error:", error);
      const isSamePassword = error?.message?.toLowerCase().includes("same password") ||
        error?.message?.toLowerCase().includes("should be different");
      if (isSamePassword) {
        toast.error(
          lang === "es"
            ? "La nueva contraseña debe ser diferente a la anterior."
            : "New password must be different from the old password."
        );
      } else {
        toast.error(
          lang === "es"
            ? "No se pudo actualizar la contraseña. Intentá de nuevo."
            : "Failed to update password. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };



  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-6">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">
            {lang === "es" ? "Enlace inválido o expirado" : "Invalid or expired link"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {lang === "es"
              ? "Este enlace de recuperación no es válido. Solicitá uno nuevo."
              : "This recovery link is not valid. Request a new one."}
          </p>
          <Button variant="outline" onClick={() => navigate("/auth/sign-in")}>
            {lang === "es" ? "Volver a iniciar sesión" : "Back to sign in"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <img src="/favicon-96x96.png" alt="My Health Hub" className="h-12 w-12 rounded-xl object-contain" />
          </Link>
          <h1 className="text-2xl font-semibold">
            {lang === "es" ? "Nueva contraseña" : "New password"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {lang === "es"
              ? "Ingresá tu nueva contraseña."
              : "Enter your new password."}
          </p>
        </div>

        <div className="health-card">
          <form onSubmit={handleReset} className="space-y-4">
            <div className="form-field">
              <Label htmlFor="password">
                {lang === "es" ? "Nueva contraseña" : "New password"}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  required
                  minLength={10}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="form-field">
              <Label htmlFor="confirmPassword">
                {lang === "es" ? "Confirmar contraseña" : "Confirm password"}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  required
                  minLength={10}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {lang === "es"
                ? "La contraseña debe tener al menos 10 caracteres e incluir un número o símbolo."
                : "Password must be at least 10 characters and include a number or symbol."}
            </p>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? (lang === "es" ? "Actualizando..." : "Updating...")
                : (lang === "es" ? "Actualizar contraseña" : "Update password")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
