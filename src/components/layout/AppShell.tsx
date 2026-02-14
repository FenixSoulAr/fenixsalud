import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  FlaskConical,
  Syringe,
  Pill,
  HeartPulse,
  Stethoscope,
  Building2,
  Bell,
  Settings,
  Menu,
  X,
  LogOut,
  Heart,
  FileText,
  Info,
  Mail,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n";
import { SharingBanner } from "@/components/sharing/SharingBanner";
import { ActiveProfileBanner } from "@/components/sharing/ActiveProfileBanner";
import { ActiveProfileIndicator } from "@/components/sharing/ActiveProfileIndicator";
import { Separator } from "@/components/ui/separator";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const t = useTranslations();

  const primaryNavigation = [
    { name: t.nav.dashboard, href: "/", icon: LayoutDashboard },
    { name: t.nav.appointments, href: "/appointments", icon: Calendar },
    { name: t.nav.tests, href: "/tests", icon: FlaskConical },
    { name: t.nav.medications, href: "/medications", icon: Pill },
    { name: t.nav.diagnoses, href: "/diagnoses", icon: HeartPulse },
    { name: t.nav.procedures, href: "/procedures", icon: Syringe },
    { name: t.nav.doctors, href: "/doctors", icon: Stethoscope },
    { name: t.nav.institutions, href: "/institutions", icon: Building2 },
    { name: t.nav.clinicalSummary, href: "/clinical-summary", icon: FileText },
    { name: t.nav.settings, href: "/settings", icon: Settings },
  ];

  const secondaryNavigation = [
    { name: t.nav.about, href: "/about", icon: Info },
    { name: t.nav.contact, href: "/contact", icon: Mail },
    // Admin item - only shown for admins
    ...(isAdmin && !adminLoading ? [{ name: "Admin", href: "/admin", icon: Shield }] : []),
  ];

  return (
    <div className="app-shell min-h-[100dvh] bg-background lg:pt-0 lg:pb-0 box-border">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 transform bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-5 border-b border-sidebar-border">
            <Link to="/" className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Mi Salud" 
                className="h-10 w-10 rounded-xl object-contain"
              />
              <span className="text-xl font-semibold text-sidebar-foreground tracking-tight">
                {t.appName}
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Active Profile Indicator - Always visible */}
          <div className="px-4 py-3 border-b border-sidebar-border bg-sidebar-accent/30">
            <ActiveProfileIndicator />
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {/* Primary navigation - Health features */}
            {primaryNavigation.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== "/" && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "nav-item",
                    isActive && "active"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {item.name}
                </Link>
              );
            })}

            {/* Separator */}
            <Separator className="my-3" />

            {/* Secondary navigation - About & Contact */}
            {secondaryNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "nav-item",
                    isActive && "active"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {user?.email?.[0].toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.email || "User"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t.nav.signOut}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="Mi Salud" 
              className="h-9 w-9 rounded-xl object-contain"
            />
            <span className="text-lg font-semibold tracking-tight">{t.appName}</span>
          </Link>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100dvh-4rem)] lg:min-h-[100dvh]">
          <div className="container py-6 lg:py-8 max-w-7xl px-4 lg:px-8">
            <div className="print:hidden">
              <ActiveProfileBanner />
              <SharingBanner />
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
