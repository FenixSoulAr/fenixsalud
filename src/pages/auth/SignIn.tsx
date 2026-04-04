import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock, ArrowRight, User, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslations } from "@/i18n";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Sign up fields
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpFullName, setSignUpFullName] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const t = useTranslations();
  const defaultTab = searchParams.get("tab") === "sign-up" ? "sign-up" : "sign-in";

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      console.error("[SignIn] Error:", error);
      if (error?.message?.toLowerCase().includes("invalid login credentials") || error?.code === "invalid_credentials") {
        toast.error("No encontramos una cuenta con ese email o la contraseña es incorrecta. ¿Ya te registraste?");
      } else {
        toast.error(t.toast?.error || "Ocurrió un error inesperado. Por favor, intentá nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (pwd: string): boolean => {
    if (pwd.length < 10) return false;
    return /[\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword(signUpPassword)) {
      toast.error(t.auth.passwordRequirement);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: signUpFullName },
        },
      });
      if (error) throw error;
      toast.success("Account created successfully!");
      navigate("/");
    } catch (error: any) {
      console.error("[SignUp] Error:", error);
      toast.error(t.toast?.error || "Ocurrió un error inesperado. Por favor, intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-[420px]">
        {/* Container card */}
        <div className="rounded-xl border border-border/60 bg-card p-8" style={{ boxShadow: "var(--shadow-sm)" }}>
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <img
                src="/favicon-96x96.png"
                alt="MyHealthHub"
                className="h-10 w-10 rounded-lg object-contain"
              />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">MyHealthHub</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tu información de salud, organizada y siempre disponible
            </p>
          </div>

          {/* Welcome block */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-1">Bienvenido</h2>
            <p className="text-sm text-muted-foreground">
              Accedé a tu perfil de salud, gestioná medicación, estudios y citas en un solo lugar.
            </p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="sign-in" className="flex-1">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="sign-up" className="flex-1">Registrarse</TabsTrigger>
            </TabsList>

            {/* Sign In Tab */}
            <TabsContent value="sign-in">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">{t.auth.email}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder={t.auth.emailPlaceholder}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">{t.auth.password}</Label>
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
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t.auth.passwordPlaceholder}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
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

                <Button type="submit" className="w-full h-12 rounded-lg font-medium mt-4" disabled={loading}>
                  {loading ? t.auth.signingIn : t.auth.signInButton}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </TabsContent>

            {/* Sign Up Tab */}
            <TabsContent value="sign-up">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">{t.auth.fullName}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder={t.auth.fullNamePlaceholder}
                      value={signUpFullName}
                      onChange={(e) => setSignUpFullName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t.auth.email}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder={t.auth.emailPlaceholder}
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t.auth.password}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showSignUpPassword ? "text" : "password"}
                      placeholder={t.auth.passwordPlaceholder}
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      minLength={10}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.auth.passwordRequirement}
                  </p>
                </div>

                <Button type="submit" className="w-full h-12 rounded-lg font-medium mt-4" disabled={loading}>
                  {loading ? t.auth.signingUp : t.auth.signUpButton}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground/70 mt-6">
            MyHealthHub — Salud organizada, vida más simple
          </p>
        </div>
      </div>
    </div>
  );
}
