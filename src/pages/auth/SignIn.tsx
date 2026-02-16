import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslations } from "@/i18n";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const navigate = useNavigate();
  const t = useTranslations();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      console.error("[SignIn] Error:", error);
      toast.error(t.toast?.error || "Ocurrió un error inesperado. Por favor, intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;
      setMagicLinkSent(true);
      toast.success("Check your email for the magic link!");
    } catch (error: any) {
      console.error("[SignIn] Magic link error:", error);
      toast.error(t.toast?.error || "Ocurrió un error inesperado. Por favor, intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-6">
            <Mail className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">{t.auth.checkEmail}</h1>
          <p className="text-muted-foreground mb-6">
            {t.auth.magicLinkSent} <span className="font-medium text-foreground">{email}</span>
          </p>
          <Button
            variant="outline"
            onClick={() => setMagicLinkSent(false)}
          >
            {t.auth.backToSignIn}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Heart className="h-6 w-6" />
            </div>
          </Link>
          <h1 className="text-2xl font-semibold">{t.auth.welcomeBack}</h1>
          <p className="text-muted-foreground mt-1">{t.auth.signInSubtitle}</p>
        </div>

        {/* Form */}
        <div className="health-card">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="form-field">
              <Label htmlFor="email">{t.auth.email}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t.auth.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t.auth.password}</Label>
                <Link
                  to="/auth/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  {t.auth.forgotPassword}
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder={t.auth.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t.auth.signingIn : t.auth.signInButton}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleMagicLink}
            disabled={loading}
          >
            <Mail className="mr-2 h-4 w-4" />
            {t.auth.magicLink}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {t.auth.noAccount}{" "}
          <Link to="/auth/sign-up" className="text-primary hover:underline font-medium">
            {t.auth.signUp}
          </Link>
        </p>
      </div>
    </div>
  );
}
