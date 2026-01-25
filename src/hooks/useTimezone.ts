import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

/**
 * Hook that provides timezone-aware date/time utilities.
 * 
 * Priority:
 * 1. Profile timezone (if set)
 * 2. Browser/device timezone (fallback)
 */
export function useTimezone() {
  const { activeProfileId } = useActiveProfile();
  const [profileTimezone, setProfileTimezone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get browser timezone as fallback
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Effective timezone: profile > browser
  const timezone = profileTimezone || browserTimezone;

  useEffect(() => {
    async function fetchProfileTimezone() {
      if (!activeProfileId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", activeProfileId)
        .maybeSingle();

      setProfileTimezone(data?.timezone || null);
      setLoading(false);
    }

    fetchProfileTimezone();
  }, [activeProfileId]);

  /**
   * Convert a local date + time string to an ISO string with timezone offset.
   * This ensures the datetime is stored correctly in PostgreSQL timestamptz.
   * 
   * @param date - Date string in YYYY-MM-DD format
   * @param time - Time string in HH:mm format (optional, defaults to 00:00)
   * @returns ISO string with timezone that PostgreSQL will store correctly
   */
  function localToISO(date: string, time?: string): string {
    if (!date) return "";
    
    const timeStr = time || "00:00";
    // Create a date in the local timezone
    const localDateTime = new Date(`${date}T${timeStr}:00`);
    
    // Return ISO string - JavaScript Date automatically handles timezone
    return localDateTime.toISOString();
  }

  /**
   * Parse a timestamptz from the database and return local date/time parts.
   * 
   * @param isoString - ISO string from database (timestamptz)
   * @returns Object with date (YYYY-MM-DD) and time (HH:mm) in local timezone
   */
  function isoToLocal(isoString: string): { date: string; time: string; hasTime: boolean } {
    if (!isoString) return { date: "", time: "", hasTime: false };
    
    const dt = new Date(isoString);
    
    // Format in local timezone
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    const hours = String(dt.getHours()).padStart(2, "0");
    const minutes = String(dt.getMinutes()).padStart(2, "0");
    
    // Check if time is meaningful (not midnight)
    const hasTime = dt.getHours() !== 0 || dt.getMinutes() !== 0;
    
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`,
      hasTime,
    };
  }

  /**
   * Format a timestamptz for display in the user's timezone.
   * 
   * @param isoString - ISO string from database
   * @param options - Intl.DateTimeFormat options
   * @returns Formatted string
   */
  function formatDateTime(isoString: string, options?: Intl.DateTimeFormatOptions): string {
    if (!isoString) return "";
    
    const dt = new Date(isoString);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
      ...options,
    };
    
    return new Intl.DateTimeFormat(undefined, defaultOptions).format(dt);
  }

  /**
   * Format time portion only.
   */
  function formatTime(isoString: string): string {
    if (!isoString) return "";
    
    const dt = new Date(isoString);
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(dt);
  }

  return {
    timezone,
    profileTimezone,
    browserTimezone,
    loading,
    localToISO,
    isoToLocal,
    formatDateTime,
    formatTime,
  };
}
