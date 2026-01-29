import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Detect if running in Capacitor native environment
function isCapacitorNative(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

interface AttachmentDownloadButtonProps {
  /** For PDFs: attachment ID to fetch via proxy */
  attachmentId?: string;
  /** For images: function to get signed URL */
  getSignedUrl?: () => Promise<string | null>;
  /** Original filename (used for download) */
  fileName: string;
  /** MIME type to determine file extension if needed */
  mimeType?: string | null;
  /** Compact mode for inline display */
  compact?: boolean;
}

/**
 * Unified download button for all attachment types (PDF, images)
 * Works on both web and Android/Capacitor
 */
export function AttachmentDownloadButton({
  attachmentId,
  getSignedUrl,
  fileName,
  mimeType,
  compact = false,
}: AttachmentDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const isNative = isCapacitorNative();

  // Ensure filename has correct extension
  function ensureExtension(name: string, mime: string | null | undefined): string {
    const hasExtension = /\.\w{2,4}$/.test(name);
    if (hasExtension) return name;

    // Add extension based on MIME type
    if (mime === "application/pdf") return `${name}.pdf`;
    if (mime === "image/jpeg") return `${name}.jpg`;
    if (mime === "image/png") return `${name}.png`;
    if (mime === "image/webp") return `${name}.webp`;
    if (mime?.startsWith("image/")) return `${name}.jpg`; // Default for images
    return name;
  }

  // Get the proxy URL for PDF attachments
  function getProxyUrl(): string {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/attachment-proxy/${attachmentId}?download=1`;
  }

  // Download via fetch + blob + anchor click
  async function downloadViaFetch(url: string, authToken?: string): Promise<boolean> {
    try {
      const headers: HeadersInit = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.error("Download fetch failed:", response.status, response.statusText);
        return false;
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Create anchor and trigger download
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = ensureExtension(fileName, mimeType);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up blob URL
      URL.revokeObjectURL(blobUrl);

      return true;
    } catch (error) {
      console.error("Download via fetch failed:", error);
      return false;
    }
  }

  // Fallback: open URL externally (for Capacitor when fetch fails)
  function downloadViaExternalBrowser(url: string): boolean {
    try {
      // Use _system to trigger external browser/download manager
      const opened = window.open(url, "_system");
      return opened !== null;
    } catch (error) {
      console.error("External browser fallback failed:", error);
      return false;
    }
  }

  async function handleDownload() {
    setLoading(true);

    try {
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Iniciá sesión para descargar archivos.");
        return;
      }

      let downloadUrl: string;

      // Determine URL based on attachment type
      if (attachmentId) {
        // PDF: use proxy URL
        downloadUrl = getProxyUrl();
      } else if (getSignedUrl) {
        // Image: get signed URL
        const signedUrl = await getSignedUrl();
        if (!signedUrl) {
          toast.error("No se pudo obtener el archivo. Intentá nuevamente.");
          return;
        }
        downloadUrl = signedUrl;
      } else {
        toast.error("No se pudo descargar. Intentá nuevamente.");
        return;
      }

      // Attempt 1: Download via fetch + blob
      const fetchSuccess = await downloadViaFetch(
        downloadUrl,
        attachmentId ? session.access_token : undefined // Only send auth for proxy
      );

      if (fetchSuccess) {
        toast.success("Descarga iniciada.");
        return;
      }

      // Attempt 2: Fallback for native - open externally
      if (isNative) {
        const externalSuccess = downloadViaExternalBrowser(downloadUrl);
        if (externalSuccess) {
          toast.success("Descarga iniciada.");
          return;
        }
      }

      // Both attempts failed
      toast.error("No se pudo descargar. Intentá nuevamente.");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("No se pudo descargar. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        disabled={loading}
        title="Descargar"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-1" />
        )}
        Descargar
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      onClick={handleDownload}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-1" />
      )}
      Descargar
    </Button>
  );
}
