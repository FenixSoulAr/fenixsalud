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
  /** For PDFs: attachment ID to fetch via signed URL */
  attachmentId?: string;
  /** For images: function to get signed URL directly */
  getSignedUrl?: () => Promise<string | null>;
  /** Original filename (used for download) */
  fileName: string;
  /** MIME type to determine file extension if needed */
  mimeType?: string | null;
  /** Compact mode for inline display */
  compact?: boolean;
}

/**
 * Unified download/open button for all attachment types (PDF, images)
 * Uses signed URLs for mobile compatibility (no auth headers needed)
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

  // Open URL in external browser using Capacitor Browser plugin
  async function openInExternalBrowser(url: string): Promise<boolean> {
    const Browser = getCapacitorBrowser();
    
    if (Browser?.open) {
      try {
        console.log("Opening in Capacitor Browser:", url.substring(0, 100) + "...");
        await Browser.open({ url });
        return true;
      } catch (error) {
        console.error("Capacitor Browser.open failed:", error);
      }
    }
    
    // Hard fallback: direct navigation
    try {
      console.log("Fallback: window.location.href");
      window.location.href = url;
      return true;
    } catch (error) {
      console.error("Direct navigation failed:", error);
      return false;
    }
  }

  // Fetch file as blob for desktop download
  async function fetchFileBlob(url: string): Promise<Blob | null> {
    try {
      const response = await fetch(url);

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

  // Get signed URL for attachment via Edge Function
  async function getAttachmentSignedUrl(id: string): Promise<{ url: string; mimeType: string; fileName: string } | null> {
    try {
      console.log("Fetching signed URL for attachment:", id);
      
      const { data, error } = await supabase.functions.invoke("get-attachment-signed-url", {
        body: { attachmentId: id },
      });

      if (error) {
        console.error("Edge function error:", error);
        return null;
      }

      if (!data?.url) {
        console.error("No URL in response:", data);
        return null;
      }

      console.log("Signed URL obtained successfully");
      return {
        url: data.url,
        mimeType: data.mimeType || "application/octet-stream",
        fileName: data.fileName || "attachment",
      };
    } catch (error) {
      console.error("Failed to get signed URL:", error);
      return null;
    }
  }

  async function handleAction() {
    setLoading(true);

    try {
      let downloadUrl: string;
      let finalFilename = fileName;
      let finalMimeType = mimeType;

      // Get signed URL based on attachment type
      if (attachmentId) {
        // For PDFs/attachments: use Edge Function to get signed URL
        const result = await getAttachmentSignedUrl(attachmentId);
        if (!result) {
          toast.error("No se pudo obtener el archivo. Intentá nuevamente.");
          return;
        }
        downloadUrl = result.url;
        finalFilename = result.fileName;
        finalMimeType = result.mimeType;
      } else if (getSignedUrl) {
        // For images: get signed URL directly
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

      console.log("Download URL obtained:", downloadUrl.substring(0, 100) + "...");

      finalFilename = ensureExtension(finalFilename, finalMimeType);

      // MOBILE: Open in external browser/app
      if (isNative) {
        toast.info("Abriendo...");
        const success = await openInExternalBrowser(downloadUrl);
        if (!success) {
          toast.error("No se pudo abrir. Probá nuevamente.");
        }
        return;
      }

      // DESKTOP: Traditional download via fetch + blob + anchor
      const blob = await fetchFileBlob(downloadUrl);

      if (!blob) {
        // Fallback: open in new tab
        window.open(downloadUrl, "_blank");
        toast.success("Abierto en nueva pestaña.");
        return;
      }

      const downloadSuccess = downloadViaAnchor(blob, finalFilename);
      if (downloadSuccess) {
        toast.success("Descarga iniciada.");
      } else {
        // Fallback: open in new tab
        window.open(downloadUrl, "_blank");
        toast.success("Abierto en nueva pestaña.");
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
