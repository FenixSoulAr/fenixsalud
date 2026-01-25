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
  const { user, loading } = useAuth();
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  const [forceRender, setForceRender] = useState(false);
  
  // Watchdog: after 5 seconds of loading, force render with warning banner
  useEffect(() => {
    if (!loading) {
      setShowSyncBanner(false);
      setForceRender(false);
      return;
    }
    
    const timer = setTimeout(() => {
      console.warn("[ProtectedRoute] Watchdog triggered - forcing render");
      setShowSyncBanner(true);
      setForceRender(true);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [loading]);
  
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
