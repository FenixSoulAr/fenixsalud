import { useMemo } from "react";

export interface DiagnosisGroup {
  diagnosis: {
    id: string;
    condition: string;
    status: "active" | "resolved";
  } | null;
  medications: any[];
}

/**
 * Groups medications by their linked diagnosis.
 * Order: Active diagnoses first, Resolved diagnoses next, Unlinked last.
 * Within each group, medications are sorted alphabetically by name.
 */
export function useMedicationsByDiagnosis(
  medications: any[],
  diagnoses: any[]
): DiagnosisGroup[] {
  return useMemo(() => {
    // Create a map of diagnosis_id -> diagnosis for quick lookup
    const diagnosisMap = new Map<string, any>();
    diagnoses.forEach((d) => diagnosisMap.set(d.id, d));

    // Group medications by diagnosis_id
    const groupMap = new Map<string | null, any[]>();
    
    medications.forEach((med) => {
      const key = med.diagnosis_id || null;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(med);
    });

    // Sort medications within each group alphabetically
    groupMap.forEach((meds) => {
      meds.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    });

    // Build result groups
    const groups: DiagnosisGroup[] = [];

    // 1. Active diagnoses (sorted by condition name)
    const activeDiagnoses = diagnoses
      .filter((d) => d.status === "active" && groupMap.has(d.id))
      .sort((a, b) => (a.condition || "").localeCompare(b.condition || ""));

    activeDiagnoses.forEach((d) => {
      groups.push({
        diagnosis: { id: d.id, condition: d.condition, status: "active" },
        medications: groupMap.get(d.id) || [],
      });
    });

    // 2. Resolved diagnoses (sorted by condition name)
    const resolvedDiagnoses = diagnoses
      .filter((d) => d.status === "resolved" && groupMap.has(d.id))
      .sort((a, b) => (a.condition || "").localeCompare(b.condition || ""));

    resolvedDiagnoses.forEach((d) => {
      groups.push({
        diagnosis: { id: d.id, condition: d.condition, status: "resolved" },
        medications: groupMap.get(d.id) || [],
      });
    });

    // 3. Unlinked medications
    if (groupMap.has(null) && groupMap.get(null)!.length > 0) {
      groups.push({
        diagnosis: null,
        medications: groupMap.get(null) || [],
      });
    }

    return groups;
  }, [medications, diagnoses]);
}

/**
 * Same logic but as a pure function (for non-hook contexts)
 */
export function groupMedicationsByDiagnosis(
  medications: any[],
  diagnoses: any[]
): DiagnosisGroup[] {
  const diagnosisMap = new Map<string, any>();
  diagnoses.forEach((d) => diagnosisMap.set(d.id, d));

  const groupMap = new Map<string | null, any[]>();
  
  medications.forEach((med) => {
    const key = med.diagnosis_id || null;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(med);
  });

  groupMap.forEach((meds) => {
    meds.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  });

  const groups: DiagnosisGroup[] = [];

  const activeDiagnoses = diagnoses
    .filter((d) => d.status === "active" && groupMap.has(d.id))
    .sort((a, b) => (a.condition || "").localeCompare(b.condition || ""));

  activeDiagnoses.forEach((d) => {
    groups.push({
      diagnosis: { id: d.id, condition: d.condition, status: "active" },
      medications: groupMap.get(d.id) || [],
    });
  });

  const resolvedDiagnoses = diagnoses
    .filter((d) => d.status === "resolved" && groupMap.has(d.id))
    .sort((a, b) => (a.condition || "").localeCompare(b.condition || ""));

  resolvedDiagnoses.forEach((d) => {
    groups.push({
      diagnosis: { id: d.id, condition: d.condition, status: "resolved" },
      medications: groupMap.get(d.id) || [],
    });
  });

  if (groupMap.has(null) && groupMap.get(null)!.length > 0) {
    groups.push({
      diagnosis: null,
      medications: groupMap.get(null) || [],
    });
  }

  return groups;
}
