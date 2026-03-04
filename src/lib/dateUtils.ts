/**
 * Utility for parsing date-only strings (YYYY-MM-DD) as LOCAL dates.
 * 
 * IMPORTANT: `new Date("2026-03-04")` parses as UTC midnight, which in
 * timezones behind UTC (e.g. Argentina UTC-3) becomes the PREVIOUS day
 * (March 3rd at 21:00). This causes the "date minus one day" bug.
 * 
 * This function splits the string and uses the Date constructor with
 * individual components, which creates a LOCAL date.
 */
export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a date-only string (YYYY-MM-DD) for display without timezone shift.
 * Uses parseDateOnly internally to avoid UTC interpretation.
 */
export function formatDateOnly(dateStr: string, formatStr?: string): string {
  if (!dateStr) return "";
  const dt = parseDateOnly(dateStr);
  // Default format: "Mar 4, 2026"
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(dt);
}
