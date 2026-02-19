import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SharingProvider } from "@/contexts/SharingContext";
import { EntitlementsProvider } from "@/contexts/EntitlementsContext";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AlertTriangle } from "lucide-react";

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

// Syncing banner shown when loading exceeds timeout
function SyncingBanner() {
  return (
    <div className="bg-warning/10 border-b border-warning/30 px-4 py-2 flex items-center gap-2 text-sm text-warning-foreground">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <span>Still syncing data…</span>
      <LoadingSpinner size="sm" className="ml-auto" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  const [forceRender, setForceRender] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  
  // Watchdog: after 5 seconds of loading, force render with warning banner
  useEffect(() => {
    if (!loading) {
      setShowSyncBanner(false);
      setForceRender(false);
      setShowRecovery(false);
      return;
    }
    
    const timer = setTimeout(() => {
      console.warn("[ProtectedRoute] Watchdog triggered - forcing render");
      setShowSyncBanner(true);
      setForceRender(true);
    }, 5000);

    // After 10s of loading, show recovery screen
    const recoveryTimer = setTimeout(() => {
      console.warn("[ProtectedRoute] Recovery screen triggered");
      setShowRecovery(true);
    }, 10000);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(recoveryTimer);
    };
  }, [loading]);

  // Recovery screen: user is stuck, offer escape routes
  if (showRecovery && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <AlertTriangle className="h-10 w-10 text-warning mx-auto" />
          <h2 className="text-lg font-semibold">No se pudo cargar la sesión</h2>
          <p className="text-sm text-muted-foreground">
            Hubo un problema al conectar. Podés reintentar o volver a iniciar sesión.
          </p>
          <div className="flex flex-col gap-2">
            <button 
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              Reintentar
            </button>
            <button 
              className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium"
              onClick={() => {
                signOut();
              }}
            >
              Ir a login
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Still loading but within timeout - show brief spinner
  if (loading && !forceRender) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  // Not authenticated - redirect to sign in
  if (!user && !loading) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  // Force render after timeout but no user - go to login
  if (!user && forceRender) {
    return <Navigate to="/auth/sign-in" replace />;
  }
  
  // Render the app shell (even if still loading after timeout)
  return (
    <AppShell>
      {showSyncBanner && <SyncingBanner />}
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppShell>
  );
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [forceRender, setForceRender] = useState(false);
  
  // Watchdog: after 5 seconds, stop blocking
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
