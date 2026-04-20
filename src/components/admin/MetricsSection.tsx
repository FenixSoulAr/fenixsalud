import { Loader2, Users, UserCheck, Crown, Sparkles, TrendingUp, Gift, UserPlus, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getLanguage } from "@/i18n";

interface AdminUser {
  user_id: string;
  email: string;
  user_created_at: string;
  subscription_status: string | null;
  plan_code: string | null;
  plan_name: string | null;
  stripe_subscription_id: string | null;
  override_id: string | null;
  override_expires_at: string | null;
  override_granted_by: string | null;
  override_created_at: string | null;
  effective_plan: string;
  is_admin_role?: boolean;
}

interface MetricsSectionProps {
  users: AdminUser[];
  loading: boolean;
}

const t = {
  es: {
    metrics: "Métricas",
    overview: "Resumen general del sistema",
    totalUsers: "Total usuarios",
    freeUsers: "Usuarios Free",
    plusUsers: "Usuarios Plus",
    proUsers: "Usuarios Pro",
    ofTotal: "del total",
    conversion: "Conversión",
    conversionDesc: "Indicadores de monetización",
    payingUsers: "Usuarios de pago",
    payingUsersDesc: "Plus + Pro (excluyendo admins)",
    activeOverrides: "Overrides activos",
    activeOverridesDesc: "Planes otorgados manualmente",
    breakdown: "Desglose por plan",
    breakdownDesc: "Distribución de usuarios por plan efectivo",
    plan: "Plan",
    users: "Usuarios",
    percentage: "%",
    newUsers: "Nuevos usuarios",
    newUsersDesc: "Registros recientes",
    last7Days: "Últimos 7 días",
    last30Days: "Últimos 30 días",
    allTime: "Total histórico",
  },
  en: {
    metrics: "Metrics",
    overview: "System overview",
    totalUsers: "Total users",
    freeUsers: "Free users",
    plusUsers: "Plus users",
    proUsers: "Pro users",
    ofTotal: "of total",
    conversion: "Conversion",
    conversionDesc: "Monetization indicators",
    payingUsers: "Paying users",
    payingUsersDesc: "Plus + Pro (excluding admins)",
    activeOverrides: "Active overrides",
    activeOverridesDesc: "Manually granted plans",
    breakdown: "Breakdown by plan",
    breakdownDesc: "User distribution by effective plan",
    plan: "Plan",
    users: "Users",
    percentage: "%",
    newUsers: "New users",
    newUsersDesc: "Recent registrations",
    last7Days: "Last 7 days",
    last30Days: "Last 30 days",
    allTime: "All time",
  },
};

function pct(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function isPlus(plan: string): boolean {
  return plan.toLowerCase().includes("plus");
}

function isPro(plan: string): boolean {
  return plan.toLowerCase().includes("pro") && !plan.toLowerCase().includes("promo");
}

function isAdminPlan(plan: string): boolean {
  return plan.toLowerCase().includes("admin");
}

export function MetricsSection({ users, loading }: MetricsSectionProps) {
  const lang = getLanguage();
  const i = lang === "es" ? t.es : t.en;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const total = users.length;
  const adminUsers = users.filter((u) => u.is_admin_role || isAdminPlan(u.effective_plan));
  const plusUsers = users.filter((u) => isPlus(u.effective_plan));
  const proUsers = users.filter((u) => isPro(u.effective_plan));
  const freeUsers = users.filter(
    (u) =>
      !isPlus(u.effective_plan) &&
      !isPro(u.effective_plan) &&
      !isAdminPlan(u.effective_plan) &&
      !u.is_admin_role,
  );

  const nonAdminTotal = total - adminUsers.length;
  const payingUsers = plusUsers.length + proUsers.length;
  const activeOverrides = users.filter((u) => u.override_id != null).length;

  // Breakdown by effective_plan
  const planCounts = new Map<string, number>();
  users.forEach((u) => {
    const key = u.effective_plan || "free";
    planCounts.set(key, (planCounts.get(key) || 0) + 1);
  });
  const sortedPlans = Array.from(planCounts.entries()).sort((a, b) => b[1] - a[1]);

  // New users
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const last7 = users.filter((u) => now - new Date(u.user_created_at).getTime() <= 7 * day).length;
  const last30 = users.filter((u) => now - new Date(u.user_created_at).getTime() <= 30 * day).length;

  return (
    <div className="space-y-6">
      {/* Section 1: KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{i.totalUsers}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground mt-1">100% {i.ofTotal}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{i.freeUsers}</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{freeUsers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pct(freeUsers.length, total)} {i.ofTotal}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{i.plusUsers}</CardTitle>
            <Sparkles className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{plusUsers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pct(plusUsers.length, total)} {i.ofTotal}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{i.proUsers}</CardTitle>
            <Crown className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{proUsers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pct(proUsers.length, total)} {i.ofTotal}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Conversion */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {i.conversion}
          </CardTitle>
          <CardDescription>{i.conversionDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{i.payingUsers}</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {pct(payingUsers, nonAdminTotal)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {payingUsers} / {nonAdminTotal} — {i.payingUsersDesc}
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{i.activeOverrides}</span>
                <Gift className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{activeOverrides}</div>
              <p className="text-xs text-muted-foreground mt-1">{i.activeOverridesDesc}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Breakdown by plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {i.breakdown}
          </CardTitle>
          <CardDescription>{i.breakdownDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i.plan}</TableHead>
                <TableHead className="text-right">{i.users}</TableHead>
                <TableHead className="text-right">{i.percentage}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlans.map(([plan, count]) => (
                <TableRow key={plan}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {plan}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{count}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {pct(count, total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Section 4: New users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {i.newUsers}
          </CardTitle>
          <CardDescription>{i.newUsersDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{i.last7Days}</span>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{last7}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{i.last30Days}</span>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{last30}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{i.allTime}</span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{total}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
