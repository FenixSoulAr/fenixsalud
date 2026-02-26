import { format } from "date-fns";
import { groupMedicationsByDiagnosis } from "@/hooks/useMedicationsByDiagnosis";

interface ClinicalSummaryPrintableProps {
  profile: any;
  medications: any[];
  diagnoses: any[];
  tests: any[];
  testAttachments: Record<string, string[]>;
  procedures: any[];
  procedureAttachments: Record<string, string[]>;
  appointments: any[];
  includeVisits: boolean;
  totalAttachmentCount: number;
  lang: "en" | "es";
  userEmail?: string;
  isViewingOwnProfile?: boolean;
}

export function ClinicalSummaryPrintable({
  profile,
  medications,
  diagnoses,
  tests,
  testAttachments,
  procedures,
  procedureAttachments,
  appointments,
  includeVisits,
  totalAttachmentCount,
  lang,
  userEmail,
  isViewingOwnProfile,
}: ClinicalSummaryPrintableProps) {
  const fullName =
    profile?.full_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    (lang === "es" ? "Paciente" : "Patient");
  
  const todayLong = lang === "es"
    ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date())
    : new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date());

  const surgeries = procedures.filter((p) => p.type === "Surgery");
  const hospitalizations = procedures.filter((p) => p.type === "Hospitalization");
  const vaccines = procedures.filter((p) => p.type === "Vaccine");
  const medicationGroups = groupMedicationsByDiagnosis(medications, diagnoses);

  const formatProfessional = (record: any): string | null => {
    if (record.professional_status !== "assigned" || !record.doctors?.full_name) return null;
    const name = record.doctors.full_name;
    const spec = record.doctors.specialty;
    return spec ? `${name} (${spec})` : name;
  };

  const formatSecondaryLine = (record: any): string | null => {
    const parts: string[] = [];
    if (record.institutions?.name) parts.push(record.institutions.name);
    const prof = formatProfessional(record);
    if (prof) parts.push(prof);
    return parts.length > 0 ? parts.join(" · ") : null;
  };

  const labels = lang === "es"
    ? {
        title: "Resumen Clínico",
        generatedOn: "Generado el",
        nationalId: "DNI",
        phone: "Teléfono",
        email: "Email",
        insurance: "Obra social",
        allergies: "Alergias",
        notes: "Notas",
        currentMedications: "Medicación actual",
        noActiveMedications: "Sin medicación activa.",
        medication: "Medicamento",
        dose: "Dosis",
        schedule: "Frecuencia",
        tests: "Estudios (últimos 12 meses)",
        noTests: "Sin estudios en los últimos 12 meses.",
        surgeriesFullHistory: "Cirugías (historial completo)",
        hospitalizationsLast: "Internaciones (últimos 24 meses)",
        vaccinesLast: "Vacunas (últimos 12 meses)",
        noProcedures: "Sin procedimientos registrados.",
        visits: "Consultas (últimos 12 meses)",
        noVisits: "Sin consultas en los últimos 12 meses.",
        availableAttachments: "Adjuntos disponibles",
        procedures: "Procedimientos",
        unlinked: "Sin diagnóstico asociado",
        resolved: "resuelta",
        daily: "Diario",
        weekly: "Semanal",
        asNeeded: "Según necesidad",
      }
    : {
        title: "Clinical Summary",
        generatedOn: "Generated on",
        nationalId: "National ID",
        phone: "Phone",
        email: "Email",
        insurance: "Insurance",
        allergies: "Allergies",
        notes: "Notes",
        currentMedications: "Current Medications",
        noActiveMedications: "No active medications.",
        medication: "Medication",
        dose: "Dose",
        schedule: "Schedule",
        tests: "Tests (last 12 months)",
        noTests: "No tests in the last 12 months.",
        surgeriesFullHistory: "Surgeries (full history)",
        hospitalizationsLast: "Hospitalizations (last 24 months)",
        vaccinesLast: "Vaccines (last 12 months)",
        noProcedures: "No procedures registered.",
        visits: "Visits (last 12 months)",
        noVisits: "No visits in the last 12 months.",
        availableAttachments: "Available attachments",
        procedures: "Procedures",
        unlinked: "No linked diagnosis",
        resolved: "resolved",
        daily: "Daily",
        weekly: "Weekly",
        asNeeded: "As needed",
      };

  return (
    <div style={{ fontFamily: "Helvetica, Arial, sans-serif", fontSize: 13, color: "#111", lineHeight: 1.5 }}>
      {/* Header */}
      <div style={{ borderBottom: "2px solid #e5e5e5", paddingBottom: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{labels.title}</h1>
        <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0" }}>
          {labels.generatedOn} {todayLong}
        </p>
      </div>

      {/* Patient info */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>{fullName}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12 }}>
          {profile?.national_id && (
            <div><strong>{labels.nationalId}:</strong> {profile.national_id}</div>
          )}
          {profile?.phone && (
            <div><strong>{labels.phone}:</strong> {profile.phone}</div>
          )}
          {isViewingOwnProfile && userEmail && (
            <div><strong>{labels.email}:</strong> {userEmail}</div>
          )}
          {profile?.insurance_provider && (
            <div>
              <strong>{labels.insurance}:</strong> {profile.insurance_provider}
              {profile.insurance_plan && ` - ${profile.insurance_plan}`}
              {profile.insurance_member_id && ` (ID: ${profile.insurance_member_id})`}
            </div>
          )}
        </div>
        {profile?.allergies && (
          <div style={{ marginTop: 8, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12 }}>
            <strong style={{ color: "#dc2626" }}>{labels.allergies}:</strong>{" "}
            <span style={{ color: "#b91c1c" }}>{profile.allergies}</span>
          </div>
        )}
        {profile?.notes && (
          <p style={{ marginTop: 8, fontSize: 12 }}>
            <strong>{labels.notes}:</strong> {profile.notes}
          </p>
        )}
      </div>

      {/* Medications */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, borderBottom: "1px solid #e5e5e5", paddingBottom: 6, marginBottom: 8 }}>
          💊 {labels.currentMedications}
        </h3>
        {medications.length === 0 ? (
          <p style={{ fontSize: 12, color: "#888" }}>{labels.noActiveMedications}</p>
        ) : (
          medicationGroups.map((group) => (
            <div key={group.diagnosis?.id || "unlinked"} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                {group.diagnosis
                  ? `${group.diagnosis.condition}${group.diagnosis.status === "resolved" ? ` (${labels.resolved})` : ""}`
                  : labels.unlinked}
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e5e5", background: "#f9fafb" }}>
                    <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 500 }}>{labels.medication}</th>
                    <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 500 }}>{labels.dose}</th>
                    <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 500 }}>{labels.schedule}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.medications.map((m) => (
                    <tr key={m.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "4px 8px" }}>{m.name}</td>
                      <td style={{ padding: "4px 8px" }}>{m.dose_text}</td>
                      <td style={{ padding: "4px 8px" }}>
                        {m.schedule_type === "Daily" ? labels.daily : m.schedule_type === "Weekly" ? labels.weekly : labels.asNeeded}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {/* Tests */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, borderBottom: "1px solid #e5e5e5", paddingBottom: 6, marginBottom: 8 }}>
          🧪 {labels.tests}
        </h3>
        {tests.length === 0 ? (
          <p style={{ fontSize: 12, color: "#888" }}>{labels.noTests}</p>
        ) : (
          tests.map((test) => {
            const secondary = formatSecondaryLine(test);
            return (
              <div key={test.id} style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: 4, marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <strong>{test.type}</strong>
                  <span style={{ color: "#888" }}>{format(new Date(test.date), "dd/MM/yyyy")}</span>
                </div>
                {secondary && <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0" }}>{secondary}</p>}
                {testAttachments[test.id]?.length > 0 && (
                  <p style={{ fontSize: 10, color: "#888", margin: "2px 0 0" }}>📎 {testAttachments[test.id].join(", ")}</p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Procedures */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, borderBottom: "1px solid #e5e5e5", paddingBottom: 6, marginBottom: 8 }}>
          💉 {labels.procedures}
        </h3>

        {surgeries.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#888", marginBottom: 4 }}>{labels.surgeriesFullHistory}</p>
            {surgeries.map((p) => {
              const secondary = formatSecondaryLine(p);
              return (
                <div key={p.id} style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: 4, marginBottom: 4, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{p.title}</strong>
                    <span style={{ color: "#888" }}>{format(new Date(p.date), "dd/MM/yyyy")}</span>
                  </div>
                  {secondary && <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0" }}>{secondary}</p>}
                </div>
              );
            })}
          </div>
        )}

        {hospitalizations.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#888", marginBottom: 4 }}>{labels.hospitalizationsLast}</p>
            {hospitalizations.map((p) => {
              const secondary = formatSecondaryLine(p);
              return (
                <div key={p.id} style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: 4, marginBottom: 4, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{p.title}</strong>
                    <span style={{ color: "#888" }}>{format(new Date(p.date), "dd/MM/yyyy")}</span>
                  </div>
                  {secondary && <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0" }}>{secondary}</p>}
                </div>
              );
            })}
          </div>
        )}

        {vaccines.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#888", marginBottom: 4 }}>{labels.vaccinesLast}</p>
            {vaccines.map((p) => {
              const secondary = formatSecondaryLine(p);
              return (
                <div key={p.id} style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: 4, marginBottom: 4, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{p.title}</strong>
                    <span style={{ color: "#888" }}>{format(new Date(p.date), "dd/MM/yyyy")}</span>
                  </div>
                  {secondary && <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0" }}>{secondary}</p>}
                </div>
              );
            })}
          </div>
        )}

        {surgeries.length === 0 && hospitalizations.length === 0 && vaccines.length === 0 && (
          <p style={{ fontSize: 12, color: "#888" }}>{labels.noProcedures}</p>
        )}
      </div>

      {/* Visits */}
      {includeVisits && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, borderBottom: "1px solid #e5e5e5", paddingBottom: 6, marginBottom: 8 }}>
            📅 {labels.visits}
          </h3>
          {appointments.length === 0 ? (
            <p style={{ fontSize: 12, color: "#888" }}>{labels.noVisits}</p>
          ) : (
            appointments.map((a) => {
              const secondary = formatSecondaryLine(a);
              return (
                <div key={a.id} style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: 4, marginBottom: 4, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{a.reason || "—"}</strong>
                    <span style={{ color: "#888" }}>{format(new Date(a.datetime_start), "dd/MM/yyyy")}</span>
                  </div>
                  {secondary && <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0" }}>{secondary}</p>}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Available Attachments */}
      {totalAttachmentCount > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, borderBottom: "1px solid #e5e5e5", paddingBottom: 6, marginBottom: 8 }}>
            📎 {labels.availableAttachments} ({totalAttachmentCount})
          </h3>

          {tests.some((t) => testAttachments[t.id]?.length > 0) && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "#888", marginBottom: 4 }}>{labels.tests}</p>
              {tests
                .filter((t) => testAttachments[t.id]?.length > 0)
                .map((test) => (
                  <div key={test.id} style={{ fontSize: 11, marginBottom: 4 }}>
                    <strong>{format(new Date(test.date), "dd/MM/yyyy")} — {test.type}</strong>
                    <ul style={{ margin: "2px 0 0 16px", padding: 0, listStyleType: "none" }}>
                      {testAttachments[test.id].map((fname, i) => (
                        <li key={i} style={{ color: "#888", fontSize: 10 }}>→ {fname}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}

          {procedures.some((p) => procedureAttachments[p.id]?.length > 0) && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: "#888", marginBottom: 4 }}>{labels.procedures}</p>
              {procedures
                .filter((p) => procedureAttachments[p.id]?.length > 0)
                .map((p) => (
                  <div key={p.id} style={{ fontSize: 11, marginBottom: 4 }}>
                    <strong>{format(new Date(p.date), "dd/MM/yyyy")} — {p.title}</strong>
                    <ul style={{ margin: "2px 0 0 16px", padding: 0, listStyleType: "none" }}>
                      {procedureAttachments[p.id].map((fname, i) => (
                        <li key={i} style={{ color: "#888", fontSize: 10 }}>→ {fname}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
