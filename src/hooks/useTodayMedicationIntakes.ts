import { useMemo } from "react";
import { useTimezone } from "@/hooks/useTimezone";

export interface MedicationIntake {
  id: string;
  medicationId: string;
  medicationName: string;
  doseText: string;
  time: string; // HH:mm format
  timeMinutes: number; // minutes since midnight for sorting
  status: "pending" | "done";
}

export interface GroupedIntakes {
  missedIntakes: MedicationIntake[]; // Past pending intakes (not taken, oldest first)
  nextTime: string | null; // HH:mm of the next group, or null if none
  nextIntakes: MedicationIntake[]; // All pending intakes at nextTime
  upcomingIntakes: MedicationIntake[]; // Pending intakes after nextTime (ascending)
  doneIntakes: MedicationIntake[]; // Already taken intakes
}

/**
 * Generates today's medication intake schedule from active medications.
 * Uses the profile timezone for accurate "today" calculation.
 * Groups intakes: next (same earliest time), later pending, done.
 */
export function useTodayMedicationIntakes(
  medications: any[],
  medicationLogs: any[]
): GroupedIntakes {
  const { timezone } = useTimezone();

  return useMemo(() => {
    // Get today's date in user's timezone
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD
    
    // Current time in minutes since midnight
    const nowTimeStr = now.toLocaleTimeString("en-US", { 
      hour12: false, 
      hour: "2-digit", 
      minute: "2-digit",
      timeZone: timezone 
    });
    const [nowHours, nowMinutes] = nowTimeStr.split(":").map(Number);
    const nowTotalMinutes = nowHours * 60 + nowMinutes;

    // Build a set of taken intakes for today (medication_id + time)
    // Key insight: scheduled_at is stored in UTC but was created from local time string
    // e.g., user schedules "19:00" local → stored as "2026-01-26T19:00:00" → Postgres interprets as UTC
    // So we must parse it the SAME WAY: extract the raw time portion without timezone conversion
    const takenSet = new Set<string>();
    medicationLogs.forEach((log) => {
      if (log.status === "Taken" && log.scheduled_at) {
        // Extract date and time directly from the ISO string WITHOUT timezone conversion
        // This matches how we INSERT: we insert "YYYY-MM-DDTHH:MM:00" as a naive datetime
        const isoString = log.scheduled_at;
        // Handle both formats: "2026-01-26T19:00:00+00" and "2026-01-26 19:00:00+00"
        const match = isoString.match(/(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
        if (match) {
          const [, logDateStr, logTime] = match;
          if (logDateStr === todayStr) {
            takenSet.add(`${log.medication_id}:${logTime}`);
          }
        }
      }
    });

    // Generate intake entries from active medications
    const allIntakes: MedicationIntake[] = [];

    medications
      .filter((med) => med.status === "Active")
      .forEach((med) => {
        const timesArray: string[] = Array.isArray(med.times) ? med.times : [];
        const allTimeStrings: string[] = timesArray.flatMap(entry => splitMultipleTimes(entry));
        
        allTimeStrings.forEach((timeStr: string) => {
          const normalizedTime = normalizeTimeString(timeStr);
          if (!normalizedTime) return;
          
          const [hours, minutes] = normalizedTime.split(":").map(Number);
          const timeMinutes = hours * 60 + minutes;
          
          const intakeKey = `${med.id}:${normalizedTime}`;
          const isDone = takenSet.has(intakeKey);
          
          allIntakes.push({
            id: `${med.id}-${normalizedTime}`,
            medicationId: med.id,
            medicationName: med.name,
            doseText: med.dose_text || "",
            time: normalizedTime,
            timeMinutes,
            status: isDone ? "done" : "pending",
          });
        });
      });

    // Sort all intakes by time ascending
    allIntakes.sort((a, b) => a.timeMinutes - b.timeMinutes);

    // Separate done and pending
    const doneIntakes = allIntakes.filter(i => i.status === "done");
    const pendingIntakes = allIntakes.filter(i => i.status === "pending");

    // Split pending into past (missed) and future
    const missedIntakes = pendingIntakes
      .filter(i => i.timeMinutes < nowTotalMinutes)
      .sort((a, b) => a.timeMinutes - b.timeMinutes); // oldest first

    const futurePending = pendingIntakes
      .filter(i => i.timeMinutes >= nowTotalMinutes)
      .sort((a, b) => a.timeMinutes - b.timeMinutes); // ascending

    // Find the next scheduled time (first future pending)
    let nextTime: string | null = null;
    let nextIntakes: MedicationIntake[] = [];
    let upcomingIntakes: MedicationIntake[] = [];

    if (futurePending.length > 0) {
      // The earliest upcoming time
      const earliestMinutes = futurePending[0].timeMinutes;
      nextTime = futurePending[0].time;
      
      // Group all intakes at that same time
      nextIntakes = futurePending.filter(i => i.timeMinutes === earliestMinutes);
      upcomingIntakes = futurePending.filter(i => i.timeMinutes > earliestMinutes);
    }

    return {
      missedIntakes,
      nextTime,
      nextIntakes,
      upcomingIntakes,
      doneIntakes,
    };
  }, [medications, medicationLogs, timezone]);
}

/**
 * Normalizes various time string formats to HH:mm (24-hour)
 * Handles formats like:
 * - "8:00", "08:00" (standard)
 * - "8:00 AM", "8:00 PM" (12-hour)
 * - "8 hs", "8hs", "8 hs." (Spanish)
 * - "8.00" (dot separator)
 * - "10" (hour only)
 * - "8 hs y 22 hs" (multiple times - returns first, caller should split)
 */
function normalizeTimeString(timeStr: string): string | null {
  if (!timeStr) return null;
  
  const cleaned = timeStr.trim().toLowerCase();
  
  // Handle "HH:mm" or "H:mm" format (24-hour)
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    }
  }
  
  // Handle "HH:mm AM/PM" format
  const match12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const period = match12[3];
    
    if (period === "pm" && h !== 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    }
  }
  
  // Handle "H.mm" or "HH.mm" format (dot separator, e.g., "8.00", "12.30")
  const matchDot = cleaned.match(/^(\d{1,2})\.(\d{2})$/);
  if (matchDot) {
    const h = parseInt(matchDot[1], 10);
    const m = parseInt(matchDot[2], 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    }
  }
  
  // Handle Spanish formats: "8 hs", "8hs", "8 hs.", "22 hs."
  const matchSpanish = cleaned.match(/^(\d{1,2})\s*hs?\.?$/);
  if (matchSpanish) {
    const h = parseInt(matchSpanish[1], 10);
    if (h >= 0 && h < 24) {
      return `${h.toString().padStart(2, "0")}:00`;
    }
  }
  
  // Handle hour-only format: "10", "22"
  const matchHourOnly = cleaned.match(/^(\d{1,2})$/);
  if (matchHourOnly) {
    const h = parseInt(matchHourOnly[1], 10);
    if (h >= 0 && h < 24) {
      return `${h.toString().padStart(2, "0")}:00`;
    }
  }
  
  return null;
}

/**
 * Splits a times entry that may contain multiple times
 * Handles: "8 hs y 22 hs", "8:00, 12:00", "8 y 20 hs"
 */
function splitMultipleTimes(timeEntry: string): string[] {
  if (!timeEntry) return [];
  
  // Split by common delimiters: " y ", ", ", " - ", "/"
  // Handle "8 hs y 22 hs" → ["8 hs", "22 hs"]
  const parts = timeEntry
    .split(/\s+y\s+|,\s*|\s+-\s+|\//)
    .map(part => part.trim())
    .filter(part => part.length > 0);
  
  return parts;
}
