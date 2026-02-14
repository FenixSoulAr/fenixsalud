import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Users, Building2, Paperclip, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";

interface AuditProfessionals {
  total: number;
  active: number;
  inactive: number;
  duplicates: Array<Array<{ id: string; full_name: string; is_active: boolean; specialty?: string | null; linkCount?: number }>>;
  inactiveWithLinks: Array<{ id: string; full_name: string; linkCount: number }>;
  activeNoLinks: Array<{ id: string; full_name: string }>;
}

interface Inconsistency {
  id: string;
  table: string;
  issue: string;
  doctor_id?: string | null;
  professional_status?: string;
}

interface AuditInstitutions {
  total: number;
  noUse: Array<{ id: string; name: string }>;
  recsPointingInactive: Array<{ id: string; institution_id: string }>;
}

interface OrphanAttachment {
  id: string;
  entity_id: string;
  entity_type: string;
  file_name: string;
  file_url?: string;
}

interface AuditResult {
  professionals: AuditProfessionals;
  inconsistencies: Inconsistency[];
  institutions: AuditInstitutions;
  orphanAttachments: OrphanAttachment[];
}

export function DataAuditSection() {
  const lang = getLanguage();
  const { activeProfileId } = useActiveProfile();
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<AuditResult | null>(null);

  // Cleanup state
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupConfirmChecked, setCleanupConfirmChecked] = useState(false);
  const [cleanupConfirmText, setCleanupConfirmText] = useState("");

  async function runAudit() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "data_audit", profile_id: activeProfileId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setAudit(data.audit);
      // Reset cleanup state
      setCleanupConfirmChecked(false);
      setCleanupConfirmText("");
      toast.success(lang === "es" ? "Auditoría completada" : "Audit completed");
    } catch (err) {
      console.error("Audit failed:", err);
      toast.error(lang === "es" ? "Error al ejecutar auditoría" : "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCleanupOrphans() {
    if (!activeProfileId) return;
    setCleanupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "cleanup_orphan_attachments", profile_id: activeProfileId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const msg = lang === "es"
        ? `Limpieza completada: ${data.deleted_count} eliminado(s)${data.failed_count > 0 ? `, ${data.failed_count} fallo(s)` : ""}`
        : `Cleanup complete: ${data.deleted_count} deleted${data.failed_count > 0 ? `, ${data.failed_count} failed` : ""}`;

      if (data.failed_count > 0) {
        toast.warning(msg);
      } else {
        toast.success(msg);
      }

      // Reset and re-run audit
      setCleanupConfirmChecked(false);
      setCleanupConfirmText("");
      await runAudit();
    } catch (err) {
      console.error("Cleanup failed:", err);
      toast.error(lang === "es" ? "Error en la limpieza" : "Cleanup failed");
    } finally {
      setCleanupLoading(false);
    }
  }

  const issueCount = audit
    ? audit.inconsistencies.length +
      audit.professionals.inactiveWithLinks.length +
      audit.orphanAttachments.length +
      audit.institutions.recsPointingInactive.length
    : 0;

  const StatusIcon = ({ ok }: { ok: boolean }) =>
    ok ? (
      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
    ) : (
      <XCircle className="h-4 w-4 text-destructive" />
    );

  const canCleanup = cleanupConfirmChecked && cleanupConfirmText === "ELIMINAR";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {lang === "es" ? "Auditoría de datos" : "Data Audit"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {lang === "es"
              ? "Diagnóstico de integridad y consistencia del modelo de datos (perfil activo)"
              : "Data model integrity and consistency diagnostics (active profile)"}
          </p>
        </div>
        <Button onClick={runAudit} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {lang === "es" ? "Ejecutar auditoría" : "Run Audit"}
        </Button>
      </div>

      {audit && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            {issueCount === 0 ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">
                  {lang === "es" ? "Sin problemas detectados" : "No issues detected"}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium">
                  {issueCount} {lang === "es" ? "problema(s) detectado(s)" : "issue(s) detected"}
                </span>
              </>
            )}
          </div>

          {/* Professionals */}
          <ProfessionalsCard audit={audit} lang={lang} StatusIcon={StatusIcon} />

          {/* Consistency Issues */}
          <ConsistencyCard audit={audit} lang={lang} />

          {/* Institutions */}
          <InstitutionsCard audit={audit} lang={lang} StatusIcon={StatusIcon} />

          {/* Orphan Attachments */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                <CardTitle className="text-base">
                  {lang === "es" ? "Adjuntos huérfanos" : "Orphan Attachments"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {audit.orphanAttachments.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {lang === "es" ? "Sin adjuntos huérfanos" : "No orphan attachments"}
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span>
                        <strong>{audit.orphanAttachments.length}</strong>{" "}
                        {lang === "es" ? "adjunto(s) sin registro padre" : "attachment(s) without parent record"}
                      </span>
                    </div>
                    <div className="ml-6 mt-1 space-y-0.5">
                      {audit.orphanAttachments.slice(0, 10).map((att) => (
                        <div key={att.id} className="text-xs text-muted-foreground">
                          {att.file_name} ({att.entity_type} → {att.entity_id.slice(0, 8)}…)
                        </div>
                      ))}
                      {audit.orphanAttachments.length > 10 && (
                        <div className="text-xs text-muted-foreground">
                          +{audit.orphanAttachments.length - 10} {lang === "es" ? "más" : "more"}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cleanup section */}
                  <div className="border-t pt-4 space-y-3">
                    <p className="text-sm font-medium text-destructive">
                      {lang === "es"
                        ? "⚠️ Se eliminarán archivos físicos del almacenamiento. Esta acción es irreversible."
                        : "⚠️ Physical files will be deleted from storage. This action is irreversible."}
                    </p>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="cleanup-confirm"
                        checked={cleanupConfirmChecked}
                        onCheckedChange={(checked) => setCleanupConfirmChecked(checked === true)}
                      />
                      <label htmlFor="cleanup-confirm" className="text-sm">
                        {lang === "es"
                          ? "Entiendo que es irreversible"
                          : "I understand this is irreversible"}
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={lang === "es" ? 'Escribí "ELIMINAR" para confirmar' : 'Type "ELIMINAR" to confirm'}
                        value={cleanupConfirmText}
                        onChange={(e) => setCleanupConfirmText(e.target.value)}
                        className="max-w-xs"
                      />
                    </div>

                    <Button
                      variant="destructive"
                      onClick={handleCleanupOrphans}
                      disabled={!canCleanup || cleanupLoading}
                    >
                      {cleanupLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      {lang === "es"
                        ? `Eliminar ${audit.orphanAttachments.length} adjunto(s) huérfano(s)`
                        : `Delete ${audit.orphanAttachments.length} orphan attachment(s)`}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function ProfessionalsCard({ audit, lang, StatusIcon }: { audit: AuditResult; lang: string; StatusIcon: React.FC<{ ok: boolean }> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <CardTitle className="text-base">
            {lang === "es" ? "Profesionales" : "Professionals"}
          </CardTitle>
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

        <div className="flex items-center gap-2 text-sm">
          <StatusIcon ok={audit.professionals.duplicates.length === 0} />
          <span>
            {lang === "es" ? "Duplicados probables" : "Probable duplicates"}:{" "}
            <strong>{audit.professionals.duplicates.length}</strong>
          </span>
        </div>
        {audit.professionals.duplicates.length > 0 && (
          <div className="ml-6 space-y-1">
            {audit.professionals.duplicates.map((group, i) => (
              <div key={i} className="text-xs text-muted-foreground space-y-0.5">
                <div className="font-medium">"{group[0].full_name}" × {group.length}</div>
                {group.map((d) => (
                  <div key={d.id} className="ml-2 flex items-center gap-1 flex-wrap">
                    <span className="font-mono text-[10px]">{d.id.slice(0, 8)}…</span>
                    {d.specialty && <span className="text-[10px]">({d.specialty})</span>}
                    <span className="text-[10px]">{d.linkCount ?? 0} {lang === "es" ? "vínculos" : "links"}</span>
                    <Badge variant={d.is_active ? "default" : "secondary"} className="ml-1 text-[10px]">
                      {d.is_active ? (lang === "es" ? "activo" : "active") : (lang === "es" ? "inactivo" : "inactive")}
                    </Badge>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          <StatusIcon ok={audit.professionals.inactiveWithLinks.length === 0} />
          <span>
            {lang === "es" ? "Inactivos con vínculos" : "Inactive with links"}:{" "}
            <strong>{audit.professionals.inactiveWithLinks.length}</strong>
          </span>
        </div>
        {audit.professionals.inactiveWithLinks.length > 0 && (
          <div className="ml-6 space-y-1">
            {audit.professionals.inactiveWithLinks.map((d) => (
              <div key={d.id} className="text-xs text-muted-foreground">
                {d.full_name} — {d.linkCount} {lang === "es" ? "vínculo(s)" : "link(s)"}
              </div>
            ))}
          </div>
        )}

        {audit.professionals.activeNoLinks.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <span>
              {lang === "es" ? "Activos sin uso" : "Active unused"}:{" "}
              {audit.professionals.activeNoLinks.length} ({lang === "es" ? "informativo" : "info"})
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConsistencyCard({ audit, lang }: { audit: AuditResult; lang: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <CardTitle className="text-base">
            {lang === "es" ? "Consistencia profesional/estado" : "Professional/Status Consistency"}
          </CardTitle>
        </div>
        <CardDescription>
          {lang === "es"
            ? "Inconsistencias entre professional_id y professional_status"
            : "Mismatches between professional_id and professional_status"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {audit.inconsistencies.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            {lang === "es" ? "Sin inconsistencias" : "No inconsistencies"}
          </div>
        ) : (
          <div className="space-y-2">
            {["points_to_inactive_professional", "null_id_but_assigned", "has_id_but_not_assigned"].map(
              (issueType) => {
                const items = audit.inconsistencies.filter((i) => i.issue === issueType);
                if (items.length === 0) return null;
                const issueLabels: Record<string, { es: string; en: string }> = {
                  points_to_inactive_professional: { es: "Apunta a profesional inactivo", en: "Points to inactive professional" },
                  null_id_but_assigned: { es: "Sin profesional pero estado = assigned", en: "No professional but status = assigned" },
                  has_id_but_not_assigned: { es: "Con profesional pero estado ≠ assigned", en: "Has professional but status ≠ assigned" },
                };
                return (
                  <div key={issueType}>
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span className="font-medium">
                        {issueLabels[issueType][lang === "es" ? "es" : "en"]}
                      </span>
                      <Badge variant="destructive" className="text-xs">{items.length}</Badge>
                    </div>
                    <div className="ml-6 mt-1 space-y-0.5">
                      {items.slice(0, 10).map((item) => (
                        <div key={item.id} className="text-xs text-muted-foreground">
                          {item.table}.{item.id.slice(0, 8)}…
                          {item.professional_status && ` (status: ${item.professional_status})`}
                        </div>
                      ))}
                      {items.length > 10 && (
                        <div className="text-xs text-muted-foreground">
                          +{items.length - 10} {lang === "es" ? "más" : "more"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InstitutionsCard({ audit, lang, StatusIcon }: { audit: AuditResult; lang: string; StatusIcon: React.FC<{ ok: boolean }> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <CardTitle className="text-base">
            {lang === "es" ? "Instituciones" : "Institutions"}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          Total: <strong>{audit.institutions.total}</strong>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <StatusIcon ok={audit.institutions.recsPointingInactive.length === 0} />
          <span>
            {lang === "es" ? "Registros apuntando a inst. inactivas" : "Records pointing to inactive institutions"}:{" "}
            <strong>{audit.institutions.recsPointingInactive.length}</strong>
          </span>
        </div>
        {audit.institutions.noUse.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <span>
              {lang === "es" ? "Sin uso" : "Unused"}:{" "}
              {audit.institutions.noUse.length} ({lang === "es" ? "informativo" : "info"})
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
