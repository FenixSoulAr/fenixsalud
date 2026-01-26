import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useTimezone } from "@/hooks/useTimezone";

export interface MedicationLog {
  id: string;
  medicationId: string;
  medicationName: string;
  scheduledAt: Date;
  scheduledDateStr: string; // dd/MM format
  scheduledTimeStr: string; // HH:mm format
  takenAt: Date;
  takenDateStr: string; // dd/MM format
  takenTimeStr: string; // HH:mm format
  status: "on_time" | "late";
  isToday: boolean; // Can be undone only if true
}

export interface GroupedHistory {
  label: string; // "Today", "Yesterday", "Jan 20, 2026"
  dateKey: string; // YYYY-MM-DD for sorting
  logs: MedicationLog[];
}

interface UseMedicationHistoryOptions {
  medicationFilter?: string; // medication_id or "all"
  dateRange?: "today" | "week" | "all";
}

const LATE_TOLERANCE_MINUTES = 30; // Consider "late" if taken > 30 min after scheduled

export function useMedicationHistory(options: UseMedicationHistoryOptions = {}) {
  const { activeProfileId } = useActiveProfile();
  const { timezone } = useTimezone();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);

  const { medicationFilter = "all", dateRange = "week" } = options;

  useEffect(() => {
    if (activeProfileId) {
      fetchData();
    }
  }, [activeProfileId, medicationFilter, dateRange]);

  async function fetchData() {
    if (!activeProfileId) return;
    setLoading(true);

    // Calculate date range
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: timezone });
    
    let startDate: string | null = null;
    if (dateRange === "today") {
      startDate = todayStr;
    } else if (dateRange === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toLocaleDateString("en-CA", { timeZone: timezone });
    }

    // Build query
    let query = supabase
      .from("medication_logs")
      .select("*, medications(name)")
      .eq("profile_id", activeProfileId)
      .order("scheduled_at", { ascending: false });

    if (startDate) {
      query = query.gte("scheduled_at", `${startDate}T00:00:00`);
    }

    if (medicationFilter && medicationFilter !== "all") {
      query = query.eq("medication_id", medicationFilter);
    }

    const [logsResult, medsResult] = await Promise.all([
      query,
      supabase
        .from("medications")
        .select("id, name")
        .eq("profile_id", activeProfileId)
        .order("name", { ascending: true }),
    ]);

    setLogs(logsResult.data || []);
    setMedications(medsResult.data || []);
    setLoading(false);
  }

  // Process and group logs by date
  const groupedHistory = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: timezone });
    
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toLocaleDateString("en-CA", { timeZone: timezone });

    // Group logs by date
    const groups: Record<string, MedicationLog[]> = {};

    logs.forEach((log) => {
      if (!log.scheduled_at || !log.taken_at) return;

      // CRITICAL: Extract date/time from scheduled_at as stored (naive datetime treated as UTC by Postgres)
      // The scheduled_at is stored as "YYYY-MM-DDTHH:MM:00" - we extract the raw values
      const scheduledIso = log.scheduled_at as string;
      const scheduledMatch = scheduledIso.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
      
      if (!scheduledMatch) return;
      
      const [, sYear, sMonth, sDay, sHour, sMin] = scheduledMatch;
      const dateKey = `${sYear}-${sMonth}-${sDay}`;
      const scheduledTimeStr = `${sHour}:${sMin}`;
      const scheduledDateStr = `${sDay}/${sMonth}`;
      
      // Create Date object for sorting (interpret as local time for the dateKey)
      const scheduledAt = new Date(`${dateKey}T${scheduledTimeStr}:00`);
      
      // For taken_at, parse properly in user's timezone for display
      const takenAt = new Date(log.taken_at);
      const takenTimeStr = takenAt.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      });
      const takenDateStr = takenAt.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: timezone,
      });

      // Determine if on time or late
      const diffMinutes = (takenAt.getTime() - scheduledAt.getTime()) / (1000 * 60);
      const status: "on_time" | "late" = diffMinutes <= LATE_TOLERANCE_MINUTES ? "on_time" : "late";

      const medicationName = log.medications?.name || "Unknown";
      const isToday = dateKey === todayStr;

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }

      groups[dateKey].push({
        id: log.id,
        medicationId: log.medication_id,
        medicationName,
        scheduledAt,
        scheduledDateStr,
        scheduledTimeStr,
        takenAt,
        takenDateStr,
        takenTimeStr,
        status,
        isToday,
      });
    });

    // Sort logs within each group by scheduled time (descending)
    Object.keys(groups).forEach((dateKey) => {
      groups[dateKey].sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
    });

    // Create sorted array of grouped history
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((dateKey): GroupedHistory => {
      let label: string;
      
      if (dateKey === todayStr) {
        label = "today";
      } else if (dateKey === yesterdayStr) {
        label = "yesterday";
      } else {
        // Format as readable date
        const [year, month, day] = dateKey.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        label = date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        });
      }

      return {
        label,
        dateKey,
        logs: groups[dateKey],
      };
    });
  }, [logs, timezone]);

  return {
    loading,
    groupedHistory,
    medications,
    refetch: fetchData,
  };
}
