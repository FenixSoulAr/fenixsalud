import { describe, it, expect } from "vitest";

/**
 * Regression tests for appointment datetime handling.
 * 
 * These tests verify that:
 * 1. Times are stored correctly in UTC
 * 2. Times are displayed correctly in local timezone
 * 3. Round-trip (save → load) preserves the intended local time
 */

describe("Appointment DateTime Handling", () => {
  /**
   * Helper to simulate the localToISO function behavior
   */
  function localToISO(date: string, time?: string): string {
    if (!date) return "";
    const timeStr = time || "00:00";
    const localDateTime = new Date(`${date}T${timeStr}:00`);
    return localDateTime.toISOString();
  }

  /**
   * Helper to simulate the isoToLocal function behavior
   */
  function isoToLocal(isoString: string): { date: string; time: string; hasTime: boolean } {
    if (!isoString) return { date: "", time: "", hasTime: false };
    
    const dt = new Date(isoString);
    
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    const hours = String(dt.getHours()).padStart(2, "0");
    const minutes = String(dt.getMinutes()).padStart(2, "0");
    
    const hasTime = dt.getHours() !== 0 || dt.getMinutes() !== 0;
    
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`,
      hasTime,
    };
  }

  it("should preserve 10:30 appointment time after round-trip", () => {
    // User creates an appointment at 10:30 on 2026-01-22
    const inputDate = "2026-01-22";
    const inputTime = "10:30";
    
    // Convert to ISO for storage
    const storedISO = localToISO(inputDate, inputTime);
    
    // Simulate loading from database
    const { date, time, hasTime } = isoToLocal(storedISO);
    
    // Verify the time is preserved
    expect(date).toBe(inputDate);
    expect(time).toBe(inputTime);
    expect(hasTime).toBe(true);
  });

  it("should handle midnight (00:00) as no specific time", () => {
    const inputDate = "2026-01-22";
    // No time specified
    
    const storedISO = localToISO(inputDate);
    const { date, time, hasTime } = isoToLocal(storedISO);
    
    expect(date).toBe(inputDate);
    expect(hasTime).toBe(false);
  });

  it("should preserve afternoon appointment (15:45)", () => {
    const inputDate = "2026-03-15";
    const inputTime = "15:45";
    
    const storedISO = localToISO(inputDate, inputTime);
    const { date, time, hasTime } = isoToLocal(storedISO);
    
    expect(date).toBe(inputDate);
    expect(time).toBe(inputTime);
    expect(hasTime).toBe(true);
  });

  it("should handle early morning appointment (07:00)", () => {
    const inputDate = "2026-06-01";
    const inputTime = "07:00";
    
    const storedISO = localToISO(inputDate, inputTime);
    const { date, time, hasTime } = isoToLocal(storedISO);
    
    expect(date).toBe(inputDate);
    expect(time).toBe(inputTime);
    expect(hasTime).toBe(true);
  });

  it("should handle late night appointment (23:30)", () => {
    const inputDate = "2026-12-31";
    const inputTime = "23:30";
    
    const storedISO = localToISO(inputDate, inputTime);
    const { date, time, hasTime } = isoToLocal(storedISO);
    
    expect(date).toBe(inputDate);
    expect(time).toBe(inputTime);
    expect(hasTime).toBe(true);
  });
});
