import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SharingProvider } from "@/contexts/SharingContext";
import { useSharing } from "@/contexts/SharingContext";
import { EntitlementsProvider } from "@/contexts/EntitlementsContext";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AlertTriangle, RefreshCw } from "lucide-react";

// Pages
import Dashboard from "./pages/Dashboard";
import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Appointments from "./pages/Appointments";
import Tests from "./pages/Tests";
import Procedures from "./pages/Procedures";
import Medications from "./pages/Medications";
import Diagnoses from "./pages/Diagnoses";
import Doctors from "./pages/Doctors";
import Institutions from "./pages/Institutions";
import Reminders from "./pages/Reminders";
import Settings from "./pages/Settings";
import ClinicalSummary from "./pages/ClinicalSummary";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Admin from "./pages/Admin";
import RedeemPromo from "./pages/RedeemPromo";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/**
 * 2-Phase Boot:
 * Phase 1 (Auth): useAuth resolves session. If no user → /login. If user → authReady.
 * Phase 2 (Data): SharingContext loads profiles. If fails → show data error (NOT session error).
 */

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { initialized: dataReady, dataError, retryDataLoad, activeProfileId } = useSharing();

  // ── Phase 1: Auth ──
  // Still resolving auth? Show splash.
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Auth resolved, no user → login
  if (!user) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  // ── Phase 2: Data ──
  // Auth is ready, but data failed → show data error (NOT session error)
  if (dataError && !dataReady) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <AlertTriangle className="h-10 w-10 text-warning mx-auto" />
          <h2 className="text-lg font-semibold">No se pudieron cargar tus datos</h2>
          <p className="text-sm text-muted-foreground">
            Tu sesión está activa, pero hubo un problema al cargar tus perfiles. Podés reintentar.
          </p>
          <button 
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground inline-flex items-center justify-center gap-2"
            onClick={retryDataLoad}
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Data still loading (no error yet) → show profile loader
  if (!dataReady) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-muted-foreground">Cargando tus perfiles…</p>
      </div>
    );
  }

  // ── Both phases complete ──
  return (
    <AppShell>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppShell>
  );
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [forceRender, setForceRender] = useState(false);
  
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      console.warn("[AuthRoute] Watchdog triggered - forcing render");
      setForceRender(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);
  
  if (loading && !forceRender) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  if (user) return <Navigate to="/" replace />;
  
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/auth/sign-in" element={<AuthRoute><SignIn /></AuthRoute>} />
      <Route path="/auth/sign-up" element={<AuthRoute><SignUp /></AuthRoute>} />
      <Route path="/auth/forgot-password" element={<AuthRoute><ForgotPassword /></AuthRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
      <Route path="/appointments/:id" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
      <Route path="/tests" element={<ProtectedRoute><Tests /></ProtectedRoute>} />
      <Route path="/tests/:id" element={<ProtectedRoute><Tests /></ProtectedRoute>} />
      <Route path="/procedures" element={<ProtectedRoute><Procedures /></ProtectedRoute>} />
      <Route path="/procedures/:id" element={<ProtectedRoute><Procedures /></ProtectedRoute>} />
      <Route path="/medications" element={<ProtectedRoute><Medications /></ProtectedRoute>} />
      <Route path="/medications/:id" element={<ProtectedRoute><Medications /></ProtectedRoute>} />
      <Route path="/diagnoses" element={<ProtectedRoute><Diagnoses /></ProtectedRoute>} />
      <Route path="/diagnoses/:id" element={<ProtectedRoute><Diagnoses /></ProtectedRoute>} />
      <Route path="/doctors" element={<ProtectedRoute><Doctors /></ProtectedRoute>} />
      <Route path="/institutions" element={<ProtectedRoute><Institutions /></ProtectedRoute>} />
      <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/clinical-summary" element={<ProtectedRoute><ClinicalSummary /></ProtectedRoute>} />
      <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
      <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />
      <Route path="/contact" element={<ProtectedRoute><Contact /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      <Route path="/redeem" element={<ProtectedRoute><RedeemPromo /></ProtectedRoute>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  // Global safety net for unhandled promise rejections
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("[App] Unhandled rejection:", event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <EntitlementsProvider>
              <SharingProvider>
                <AppRoutes />
              </SharingProvider>
            </EntitlementsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
