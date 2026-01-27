import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ExportResult {
  signedUrl: string;
  filePath: string;
  expiresAt: string;
  countsByTable: Record<string, number>;
}

export function useAccountActions() {
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function exportUserData(): Promise<{ success: boolean; error?: string }> {
    setExporting(true);
    setExportResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setExporting(false);
        return { success: false, error: "Not authenticated" };
      }

      const response = await supabase.functions.invoke("export-user-data", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        console.error("[useAccountActions] Export error:", response.error);
        setExporting(false);
        return { success: false, error: response.error.message || "Export failed" };
      }

      const data = response.data as ExportResult;
      setExportResult(data);
      setExporting(false);
      
      // Store export timestamp in localStorage
      localStorage.setItem("lastExportAt", new Date().toISOString());
      
      return { success: true };
    } catch (err) {
      console.error("[useAccountActions] Export exception:", err);
      setExporting(false);
      return { success: false, error: "Export failed" };
    }
  }

  async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
    setDeleting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setDeleting(false);
        return { success: false, error: "Not authenticated" };
      }

      const response = await supabase.functions.invoke("delete-user-account", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        console.error("[useAccountActions] Delete error:", response.error);
        setDeleting(false);
        return { success: false, error: response.error.message || "Deletion failed" };
      }

      // Clear local storage
      localStorage.removeItem("lastExportAt");
      
      setDeleting(false);
      return { success: true };
    } catch (err) {
      console.error("[useAccountActions] Delete exception:", err);
      setDeleting(false);
      return { success: false, error: "Deletion failed" };
    }
  }

  function hasRecentExport(): boolean {
    const lastExport = localStorage.getItem("lastExportAt");
    if (!lastExport) return false;
    
    const exportDate = new Date(lastExport);
    const now = new Date();
    const hoursSinceExport = (now.getTime() - exportDate.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceExport < 24;
  }

  function getTotalRecords(): number {
    if (!exportResult?.countsByTable) return 0;
    return Object.values(exportResult.countsByTable).reduce((sum, count) => sum + count, 0);
  }

  return {
    exporting,
    exportResult,
    deleting,
    exportUserData,
    deleteAccount,
    hasRecentExport,
    getTotalRecords,
  };
}
