import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const lang = getLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success(
        lang === "es"
          ? "Te enviamos un enlace de recuperación."
          : "We sent you a recovery link."
      );
    } catch (error: any) {
      console.error("[ForgotPassword] Error:", error);
      // Don't reveal if email exists or not for security
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-6">
            <Mail className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">
            {lang === "es" ? "Revisá tu correo" : "Check your email"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {lang === "es"
              ? "Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña."
              : "If an account exists with that email, we sent you a link to reset your password."}
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            <span className="font-medium text-foreground">{email}</span>
          </p>
          <Link to="/auth/sign-in">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {lang === "es" ? "Volver a iniciar sesión" : "Back to sign in"}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Heart className="h-6 w-6" />
            </div>
          </Link>
          <h1 className="text-2xl font-semibold">
            {lang === "es" ? "Recuperar contraseña" : "Reset password"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {lang === "es"
              ? "Ingresá tu correo y te enviaremos un enlace para restablecer tu contraseña."
              : "Enter your email and we'll send you a link to reset your password."}
          </p>
        </div>

        <div className="health-card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-field">
              <Label htmlFor="email">
                {lang === "es" ? "Correo electrónico" : "Email"}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={lang === "es" ? "tu@email.com" : "you@email.com"}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? (lang === "es" ? "Enviando..." : "Sending...")
                : (lang === "es" ? "Enviar enlace de recuperación" : "Send recovery link")}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link to="/auth/sign-in" className="text-primary hover:underline font-medium">
            <ArrowLeft className="inline h-3 w-3 mr-1" />
            {lang === "es" ? "Volver a iniciar sesión" : "Back to sign in"}
          </Link>
        </p>
      </div>
    </div>
  );
}
