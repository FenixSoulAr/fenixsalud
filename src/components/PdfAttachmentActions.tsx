import { useState } from "react";
import { ExternalLink, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PdfAttachmentActionsProps {
  attachmentId: string;
  fileName: string;
  compact?: boolean;
}

export function PdfAttachmentActions({ attachmentId, fileName, compact = false }: PdfAttachmentActionsProps) {
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [loadingDownload, setLoadingDownload] = useState(false);

  // Get the proxy URL for this attachment
  function getProxyUrl(download: boolean = false): string {
    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/attachment-proxy/${attachmentId}`;
    return download ? `${baseUrl}?download=1` : baseUrl;
  }

  // Handle opening PDF in new tab via proxy
  async function handleOpen() {
    setLoadingOpen(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in to view files.");
        return;
      }

      const response = await fetch(getProxyUrl(false), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.status === 403) {
        toast.error("You don't have permission to view this file.");
        return;
      }

      if (!response.ok) {
        // Log internally but show user-friendly message
        console.error("PDF fetch failed:", response.status, response.statusText);
        toast.error("No se pudo abrir el archivo. Intentá nuevamente.");
        return;
      }

      // Success - create blob and open
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      
      // Clean up blob URL after a delay (no toast needed for success here)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (error) {
      // Only log, show single error to user
      console.error("Error opening PDF:", error);
      toast.error("No se pudo abrir el archivo. Intentá nuevamente.");
    } finally {
      setLoadingOpen(false);
    }
  }

  // Handle downloading PDF via proxy
  async function handleDownload() {
    setLoadingDownload(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in to download files.");
        return;
      }

      const response = await fetch(getProxyUrl(true), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.status === 403) {
        toast.error("You don't have permission to download this file.");
        return;
      }

      if (!response.ok) {
        console.error("PDF download failed:", response.status, response.statusText);
        toast.error("No se pudo descargar el archivo. Intentá nuevamente.");
        return;
      }

      // Success - create blob and download
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(blobUrl);
      // Success toast for download
      toast.success("Descarga iniciada.");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("No se pudo descargar el archivo. Intentá nuevamente.");
    } finally {
      setLoadingDownload(false);
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={loadingDownload || loadingOpen}
          title="Download PDF"
        >
          {loadingDownload ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1" />
          )}
          Download
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleOpen}
          disabled={loadingOpen || loadingDownload}
          title="Open in new tab"
        >
          {loadingOpen ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        type="button"
        variant="default"
        size="sm"
        onClick={handleDownload}
        disabled={loadingDownload || loadingOpen}
      >
        {loadingDownload ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-1" />
        )}
        Download PDF
      </Button>
      
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={loadingOpen || loadingDownload}
      >
        {loadingOpen ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <ExternalLink className="h-4 w-4 mr-1" />
        )}
        Open PDF
      </Button>
    </div>
  );
}
