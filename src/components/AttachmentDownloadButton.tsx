import { useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Detect if running in Capacitor native environment
function isCapacitorNative(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

// Check if Web Share API with files is supported
function canShareFiles(): boolean {
  if (!navigator.share || !navigator.canShare) return false;
  // Test with a dummy file to see if file sharing is supported
  try {
    const testFile = new File(["test"], "test.txt", { type: "text/plain" });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
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
  const supportsFileShare = canShareFiles();

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

  // Share file using Web Share API (mobile)
  async function shareFile(blob: Blob, filename: string, mime: string): Promise<boolean> {
    try {
      const file = new File([blob], filename, { type: mime || "application/octet-stream" });
      
      if (!navigator.canShare({ files: [file] })) {
        console.log("Cannot share this file type");
        return false;
      }

      await navigator.share({
        files: [file],
        title: filename,
      });

      return true;
    } catch (error: any) {
      // User cancelled share is not an error
      if (error.name === "AbortError") {
        return true; // User cancelled, but share sheet was shown
      }
      console.error("Share failed:", error);
      return false;
    }
  }

  // Download via anchor click (desktop)
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

  // Fallback: open URL externally (for mobile when share fails)
  function openExternal(url: string): boolean {
    try {
      const opened = window.open(url, "_system");
      return opened !== null;
    } catch (error) {
      console.error("External open failed:", error);
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
        downloadUrl = getProxyUrl();
      } else if (getSignedUrl) {
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

      const finalFilename = ensureExtension(fileName, mimeType);
      const finalMime = mimeType || "application/octet-stream";

      // Fetch the file blob
      const blob = await fetchFileBlob(
        downloadUrl,
        attachmentId ? session.access_token : undefined
      );

      if (!blob) {
        // Fetch failed - try external fallback on mobile
        if (isNative) {
          const externalSuccess = openExternal(downloadUrl);
          if (externalSuccess) {
            toast.success("Abriendo en navegador externo...");
            return;
          }
        }
        toast.error("No se pudo guardar. Probá nuevamente.");
        return;
      }

      // MOBILE: Use Web Share API with files
      if (isNative && supportsFileShare) {
        const shareSuccess = await shareFile(blob, finalFilename, finalMime);
        if (shareSuccess) {
          toast.success("Elegí dónde guardar o compartir");
          return;
        }
        
        // Share failed - try external fallback
        const blobUrl = URL.createObjectURL(blob);
        const externalSuccess = openExternal(blobUrl);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        
        if (externalSuccess) {
          toast.success("Abriendo en navegador externo...");
          return;
        }
        
        toast.error("No se pudo guardar. Probá nuevamente.");
        return;
      }

      // MOBILE without Web Share: try external browser
      if (isNative) {
        const blobUrl = URL.createObjectURL(blob);
        const externalSuccess = openExternal(blobUrl);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        
        if (externalSuccess) {
          toast.success("Abriendo en navegador externo...");
          return;
        }
        
        toast.error("No se pudo guardar. Probá nuevamente.");
        return;
      }

      // DESKTOP: Traditional download via anchor
      const downloadSuccess = downloadViaAnchor(blob, finalFilename);
      if (downloadSuccess) {
        toast.success("Descarga iniciada.");
        return;
      }

      toast.error("No se pudo guardar. Probá nuevamente.");
    } catch (error) {
      console.error("Action error:", error);
      toast.error("No se pudo guardar. Probá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  // Button label and icon based on platform
  const buttonLabel = isNative && supportsFileShare ? "Guardar" : "Descargar";
  const ButtonIcon = isNative && supportsFileShare ? Share2 : Download;

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