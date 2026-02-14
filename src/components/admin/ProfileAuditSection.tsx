import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2, Search, RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Users, Building2, Paperclip, ClipboardList, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";

// Types
interface ProfileResult {
  profile_id: string;
  full_name: string;
  owner_email: string;
  is_primary: boolean;
}

interface DuplicateDoctor {
  id: string;
  full_name: string;
  is_active: boolean;
  specialty?: string | null;
  linkCount?: number;
}

interface AuditResult {
  profile: { id: string; full_name: string };
  professionals: {
    total: number;
    active: number;
    inactive: number;
    duplicates: DuplicateDoctor[][];
    inactiveWithLinks: Array<{ id: string; full_name: string; linkCount: number }>;
    activeNoLinks: Array<{ id: string; full_name: string }>;
  };
  inconsistencies: Array<{ id: string; table: string; issue: string; doctor_id?: string; professional_status?: string }>;
  institutions: {
    total: number;
    noUse: Array<{ id: string; name: string }>;
    recsPointingInactive: Array<{ id: string; institution_id: string }>;
  };
  orphanAttachments: Array<{ id: string; entity_id: string; entity_type: string; file_name: string }>;
  summary: {
    appointments: number;
    tests: number;
    procedures: number;
    medications: number;
    medications_active: number;
    diagnoses: number;
    diagnoses_active: number;
    reminders: number;
    reminders_pending: number;
    attachments: number;
  };
}

export function ProfileAuditSection() {
  const lang = getLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [profiles, setProfiles] = useState<ProfileResult[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileResult | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [audit, setAudit] = useState<AuditResult | null>(null);

  async function handleSearch() {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    setProfiles([]);
    setSelectedProfile(null);
    setAudit(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-audit-profile", {
        body: { action: "search_profiles", query: searchQuery.trim() },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setProfiles(data.profiles || []);
      if ((data.profiles || []).length === 0) {
        toast.info(lang === "es" ? "No se encontraron perfiles" : "No profiles found");
      }
    } catch (err) {
      console.error("Search failed:", err);
      toast.error(lang === "es" ? "Error en la búsqueda" : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleRunAudit(profile: ProfileResult) {
    setSelectedProfile(profile);
    setAuditing(true);
    setAudit(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-audit-profile", {
        body: { action: "run_audit", profile_id: profile.profile_id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setAudit(data.audit);
      toast.success(lang === "es" ? "Auditoría completada" : "Audit completed");
    } catch (err) {
      console.error("Audit failed:", err);
      toast.error(lang === "es" ? "Error al ejecutar auditoría" : "Audit failed");
    } finally {
      setAuditing(false);
    }
  }

  function handleExportJSON() {
    if (!audit) return;
    const blob = new Blob([JSON.stringify(audit, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${audit.profile.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const issueCount = audit
    ? audit.inconsistencies.length +
      audit.professionals.inactiveWithLinks.length +
      audit.orphanAttachments.length +
      audit.institutions.recsPointingInactive.length
    : 0;

  const StatusIcon = ({ ok }: { ok: boolean }) =>
    ok ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" /> : <XCircle className="h-4 w-4 text-destructive" />;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">
          {lang === "es" ? "Auditoría por perfil" : "Profile Audit"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {lang === "es"
            ? "Buscar un usuario y ejecutar auditoría de datos para un perfil específico"
            : "Search a user and run data audit for a specific profile"}
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder={lang === "es" ? "Buscar por email, nombre o profile_id…" : "Search by email, name or profile_id…"}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          className="max-w-md"
        />
        <Button onClick={handleSearch} disabled={searching || searchQuery.trim().length < 2}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2">{lang === "es" ? "Buscar" : "Search"}</span>
        </Button>
      </div>

      {/* Search results */}
      {profiles.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {lang === "es" ? "Perfiles encontrados" : "Profiles found"} ({profiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {profiles.map(p => (
                <div
                  key={p.profile_id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedProfile?.profile_id === p.profile_id ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setSelectedProfile(p)}
                >
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {p.full_name}
                      {p.is_primary ? (
                        <Badge variant="default" className="text-[10px]">
                          {lang === "es" ? "Principal" : "Primary"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          {lang === "es" ? "Familiar" : "Family"}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.owner_email}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{p.profile_id}</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={e => { e.stopPropagation(); handleRunAudit(p); }}
                    disabled={auditing}
                  >
                    {auditing && selectedProfile?.profile_id === p.profile_id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <ClipboardList className="h-4 w-4 mr-1" />
                    )}
                    {lang === "es" ? "Auditar" : "Audit"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit results */}
      {audit && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h4 className="text-base font-semibold">
                {lang === "es" ? "Resultado:" : "Result:"} {audit.profile.full_name}
              </h4>
              {issueCount === 0 ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {lang === "es" ? "Sin problemas" : "No issues"}
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {issueCount} {lang === "es" ? "problema(s)" : "issue(s)"}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportJSON}>
                <Download className="h-4 w-4 mr-1" />
                JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => selectedProfile && handleRunAudit(selectedProfile)} disabled={auditing}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {lang === "es" ? "Re-ejecutar" : "Re-run"}
              </Button>
            </div>
          </div>

          {/* Data summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {lang === "es" ? "Resumen de datos" : "Data Summary"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {[
                  { label: lang === "es" ? "Turnos" : "Appointments", value: audit.summary.appointments },
                  { label: lang === "es" ? "Estudios" : "Tests", value: audit.summary.tests },
                  { label: lang === "es" ? "Procedimientos" : "Procedures", value: audit.summary.procedures },
                  { label: lang === "es" ? "Medicamentos" : "Medications", value: `${audit.summary.medications_active}/${audit.summary.medications}` },
                  { label: lang === "es" ? "Diagnósticos" : "Diagnoses", value: `${audit.summary.diagnoses_active}/${audit.summary.diagnoses}` },
                  { label: lang === "es" ? "Recordatorios" : "Reminders", value: `${audit.summary.reminders_pending}p/${audit.summary.reminders}` },
                  { label: lang === "es" ? "Adjuntos" : "Attachments", value: audit.summary.attachments },
                ].map(item => (
                  <div key={item.label} className="text-center p-2 rounded bg-muted/50">
                    <div className="text-lg font-bold">{item.value}</div>
                    <div className="text-muted-foreground text-xs">{item.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Professionals */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <CardTitle className="text-base">{lang === "es" ? "Profesionales" : "Professionals"}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center p-2 rounded bg-muted/50">
                  <div className="text-lg font-bold">{audit.professionals.total}</div>
                  <div className="text-muted-foreground text-xs">Total</div>
                </div>
                <div className="text-center p-2 rounded bg-muted/50">
                  <div className="text-lg font-bold text-green-600">{audit.professionals.active}</div>
                  <div className="text-muted-foreground text-xs">{lang === "es" ? "Activos" : "Active"}</div>
                </div>
                <div className="text-center p-2 rounded bg-muted/50">
                  <div className="text-lg font-bold text-muted-foreground">{audit.professionals.inactive}</div>
                  <div className="text-muted-foreground text-xs">{lang === "es" ? "Inactivos" : "Inactive"}</div>
                </div>
              </div>

              <AuditLine icon={<StatusIcon ok={audit.professionals.duplicates.length === 0} />} label={lang === "es" ? "Duplicados probables" : "Probable duplicates"} count={audit.professionals.duplicates.length} severity={audit.professionals.duplicates.length > 0 ? "warning" : "ok"}>
                {audit.professionals.duplicates.map((group, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    "{group[0].full_name}" × {group.length} — {group.map(d => `${d.linkCount ?? 0} links`).join(", ")}
                  </div>
                ))}
              </AuditLine>

              <AuditLine icon={<StatusIcon ok={audit.professionals.inactiveWithLinks.length === 0} />} label={lang === "es" ? "Inactivos con vínculos" : "Inactive with links"} count={audit.professionals.inactiveWithLinks.length} severity={audit.professionals.inactiveWithLinks.length > 0 ? "error" : "ok"}>
                {audit.professionals.inactiveWithLinks.map(d => (
                  <div key={d.id} className="text-xs text-muted-foreground">
                    {d.full_name} — {d.linkCount} {lang === "es" ? "vínculo(s)" : "link(s)"}
                  </div>
                ))}
              </AuditLine>

              {audit.professionals.activeNoLinks.length > 0 && (
                <AuditLine icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />} label={lang === "es" ? "Activos sin uso" : "Active unused"} count={audit.professionals.activeNoLinks.length} severity="info" />
              )}
            </CardContent>
          </Card>

          {/* Consistency */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <CardTitle className="text-base">{lang === "es" ? "Consistencia" : "Consistency"}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {audit.inconsistencies.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {lang === "es" ? "Sin inconsistencias" : "No inconsistencies"}
                </div>
              ) : (
                <div className="space-y-2">
                  {["points_to_inactive_professional", "null_id_but_assigned", "has_id_but_not_assigned"].map(issueType => {
                    const items = audit.inconsistencies.filter(i => i.issue === issueType);
                    if (items.length === 0) return null;
                    const labels: Record<string, { es: string; en: string }> = {
                      points_to_inactive_professional: { es: "Apunta a profesional inactivo", en: "Points to inactive professional" },
                      null_id_but_assigned: { es: "Sin profesional pero estado = assigned", en: "No professional but status = assigned" },
                      has_id_but_not_assigned: { es: "Con profesional pero estado ≠ assigned", en: "Has professional but status ≠ assigned" },
                    };
                    return (
                      <div key={issueType}>
                        <div className="flex items-center gap-2 text-sm">
                          <XCircle className="h-4 w-4 text-destructive" />
                          <span className="font-medium">{labels[issueType][lang === "es" ? "es" : "en"]}</span>
                          <Badge variant="destructive" className="text-xs">{items.length}</Badge>
                        </div>
                        <div className="ml-6 mt-1 space-y-0.5">
                          {items.slice(0, 5).map(item => (
                            <div key={item.id} className="text-xs text-muted-foreground">
                              {item.table}.{item.id.slice(0, 8)}…
                            </div>
                          ))}
                          {items.length > 5 && <div className="text-xs text-muted-foreground">+{items.length - 5} {lang === "es" ? "más" : "more"}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Institutions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <CardTitle className="text-base">{lang === "es" ? "Instituciones" : "Institutions"}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">Total: <strong>{audit.institutions.total}</strong></div>
              <AuditLine icon={<StatusIcon ok={audit.institutions.recsPointingInactive.length === 0} />} label={lang === "es" ? "Registros → inst. inactivas" : "Records → inactive institutions"} count={audit.institutions.recsPointingInactive.length} severity={audit.institutions.recsPointingInactive.length > 0 ? "error" : "ok"} />
              {audit.institutions.noUse.length > 0 && (
                <AuditLine icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />} label={lang === "es" ? "Sin uso" : "Unused"} count={audit.institutions.noUse.length} severity="info" />
              )}
            </CardContent>
          </Card>

          {/* Orphan attachments */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                <CardTitle className="text-base">{lang === "es" ? "Adjuntos huérfanos" : "Orphan Attachments"}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {audit.orphanAttachments.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {lang === "es" ? "Sin adjuntos huérfanos" : "No orphan attachments"}
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <strong>{audit.orphanAttachments.length}</strong> {lang === "es" ? "adjunto(s) sin registro padre" : "orphan attachment(s)"}
                  </div>
                  <div className="ml-6 mt-1 space-y-0.5">
                    {audit.orphanAttachments.slice(0, 10).map(att => (
                      <div key={att.id} className="text-xs text-muted-foreground">
                        {att.file_name} ({att.entity_type} → {att.entity_id.slice(0, 8)}…)
                      </div>
                    ))}
                    {audit.orphanAttachments.length > 10 && (
                      <div className="text-xs text-muted-foreground">+{audit.orphanAttachments.length - 10} {lang === "es" ? "más" : "more"}</div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Helper component for audit lines
function AuditLine({
  icon, label, count, severity, children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  severity: "ok" | "warning" | "error" | "info";
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span className={severity === "info" ? "text-muted-foreground" : ""}>
          {label}: <strong>{count}</strong>
        </span>
        {severity === "warning" && <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">warning</Badge>}
        {severity === "error" && <Badge variant="destructive" className="text-xs">error</Badge>}
        {severity === "info" && <Badge variant="outline" className="text-xs">info</Badge>}
      </div>
      {children && <div className="ml-6 mt-1 space-y-0.5">{children}</div>}
    </div>
  );
}
