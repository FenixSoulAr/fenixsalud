import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingPage } from "@/components/ui/loading-spinner";

// Pages
import Dashboard from "./pages/Dashboard";
import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";
import Appointments from "./pages/Appointments";
import Tests from "./pages/Tests";
import Procedures from "./pages/Procedures";
import Medications from "./pages/Medications";
import Doctors from "./pages/Doctors";
import Institutions from "./pages/Institutions";
import Reminders from "./pages/Reminders";
import Settings from "./pages/Settings";
import ClinicalSummary from "./pages/ClinicalSummary";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingPage />;
  if (!user) return <Navigate to="/auth/sign-in" replace />;
  
  return <AppShell>{children}</AppShell>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingPage />;
  if (user) return <Navigate to="/" replace />;
  
  return <>{children}</>;
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
      <Route path="/doctors" element={<ProtectedRoute><Doctors /></ProtectedRoute>} />
      <Route path="/institutions" element={<ProtectedRoute><Institutions /></ProtectedRoute>} />
      <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/clinical-summary" element={<ProtectedRoute><ClinicalSummary /></ProtectedRoute>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
