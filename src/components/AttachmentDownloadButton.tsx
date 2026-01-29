import { useState } from "react";
import { Download, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Detect if running in Capacitor native environment
function isCapacitorNative(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

// Get Capacitor Browser plugin if available
function getCapacitorBrowser() {
  try {
    const capacitor = (window as any).Capacitor;
    return capacitor?.Plugins?.Browser || null;
  } catch {
    return null;
  }
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
 * Unified download/share button for all attachment types (PDF, images)
 * Uses Web Share API on mobile for save/share functionality
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

  // Fetch file as blob
  async function fetchFileBlob(url: string, authToken?: string): Promise<Blob | null> {
    try {
      const headers: HeadersInit = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.error("Fetch failed:", response.status, response.statusText);
        return null;
      }

      return await response.blob();
    } catch (error) {
      console.error("Fetch error:", error);
      return null;
    }
  }

  // Download via anchor click (desktop only)
  function downloadViaAnchor(blob: Blob, filename: string): boolean {
    try {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL after delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      
      return true;
    } catch (error) {
      console.error("Download via anchor failed:", error);
      return false;
    }
  }

  // Open URL in external browser using Capacitor Browser plugin
  async function openInExternalBrowser(url: string): Promise<boolean> {
    const Browser = getCapacitorBrowser();
    
    if (Browser?.open) {
      try {
        await Browser.open({ url });
        return true;
      } catch (error) {
        console.error("Capacitor Browser.open failed:", error);
      }
    }
    
    // Hard fallback: direct navigation
    try {
      window.location.href = url;
      return true;
    } catch (error) {
      console.error("Direct navigation failed:", error);
      return false;
    }
  }

  async function handleAction() {
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
        // For PDFs: use proxy URL (this is already HTTPS)
        downloadUrl = getProxyUrl();
      } else if (getSignedUrl) {
        // For images: get signed URL (this is already HTTPS)
        const signedUrl = await getSignedUrl();
        if (!signedUrl) {
          toast.error("No se pudo obtener el archivo. Intentá nuevamente.");
          return;
        }
        downloadUrl = signedUrl;
      } else {
        toast.error("No hay URL descargable.");
        return;
      }

      // Validate URL is HTTPS
      if (!downloadUrl.startsWith("http://") && !downloadUrl.startsWith("https://")) {
        console.error("Invalid URL (not HTTP/HTTPS):", downloadUrl);
        toast.error("No hay URL descargable.");
        return;
      }

      console.log("Download URL:", downloadUrl);

      const finalFilename = ensureExtension(fileName, mimeType);

      // MOBILE: Open in external browser/app
      if (isNative) {
        toast.info("Abriendo...");
        const success = await openInExternalBrowser(downloadUrl);
        if (!success) {
          toast.error("No se pudo guardar. Probá nuevamente.");
        }
        return;
      }

      // DESKTOP: Traditional download via fetch + blob + anchor
      const blob = await fetchFileBlob(
        downloadUrl,
        attachmentId ? session.access_token : undefined
      );

      if (!blob) {
        toast.error("No se pudo descargar. Probá nuevamente.");
        return;
      }

      const downloadSuccess = downloadViaAnchor(blob, finalFilename);
      if (downloadSuccess) {
        toast.success("Descarga iniciada.");
      } else {
        toast.error("No se pudo descargar. Probá nuevamente.");
      }
    } catch (error) {
      console.error("Action error:", error);
      toast.error("No se pudo guardar. Probá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  // Button label and icon based on platform
  const buttonLabel = isNative ? "Guardar" : "Descargar";
  const ButtonIcon = isNative ? ExternalLink : Download;

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleAction}
        disabled={loading}
        title={buttonLabel}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <ButtonIcon className="h-4 w-4 mr-1" />
        )}
        {buttonLabel}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      onClick={handleAction}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <ButtonIcon className="h-4 w-4 mr-1" />
      )}
      {buttonLabel}
    </Button>
  );
}