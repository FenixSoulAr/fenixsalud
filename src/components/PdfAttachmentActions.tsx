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
  const [loading, setLoading] = useState(false);

  // Get the proxy URL for this attachment
  function getProxyUrl(download: boolean = false): string {
    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/attachment-proxy/${attachmentId}`;
    return download ? `${baseUrl}?download=1` : baseUrl;
  }

  // Handle opening PDF in new tab via proxy
  async function handleOpen() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in to view files.");
        return;
      }

      // Fetch the file through the proxy with auth
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
        throw new Error("Failed to fetch file");
      }

      // Create blob URL and open in new tab
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      
      // Clean up blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (error) {
      console.error("Error opening PDF:", error);
      toast.error("Ocurrió un error inesperado. Por favor, intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  // Handle downloading PDF via proxy
  async function handleDownload() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in to download files.");
        return;
      }

      // Fetch the file through the proxy with auth
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
        throw new Error("Failed to fetch file");
      }

      // Create blob and download
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(blobUrl);
      toast.success("Download started.");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Ocurrió un error inesperado. Por favor, intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          title="Download PDF"
        >
          <Download className="h-4 w-4 mr-1" />
          Download
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleOpen}
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
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
      >
        <Download className="h-4 w-4 mr-1" />
        Download PDF
      </Button>
      
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpen}
      >
        <ExternalLink className="h-4 w-4 mr-1" />
        Open PDF
      </Button>
    </div>
  );
}
