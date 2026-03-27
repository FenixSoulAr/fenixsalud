import { useState, useRef, useEffect, useId } from "react";
import { Upload, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface MobileFileUploaderProps {
  onUpload: (file: File) => Promise<{ success: boolean; error?: string }>;
  uploading: boolean;
  disabled?: boolean;
}

function detectInAppBrowser(): { isInApp: boolean; browserName: string | null } {
  if (typeof navigator === "undefined") return { isInApp: false, browserName: null };
  const ua = navigator.userAgent || "";
  const inAppPatterns: { pattern: RegExp; name: string }[] = [
    { pattern: /FBAN|FBAV/i, name: "Facebook" },
    { pattern: /Instagram/i, name: "Instagram" },
    { pattern: /Twitter/i, name: "Twitter/X" },
    { pattern: /WhatsApp/i, name: "WhatsApp" },
    { pattern: /TikTok/i, name: "TikTok" },
    { pattern: /Snapchat/i, name: "Snapchat" },
    { pattern: /Line\//i, name: "Line" },
    { pattern: /Pinterest/i, name: "Pinterest" },
    { pattern: /LinkedIn/i, name: "LinkedIn" },
    { pattern: /Messenger/i, name: "Messenger" },
    { pattern: /GSA\//i, name: "Google App" },
  ];
  for (const { pattern, name } of inAppPatterns) {
    if (pattern.test(ua)) return { isInApp: true, browserName: name };
  }
  return { isInApp: false, browserName: null };
}

function getMimeType(file: File): string {
  let mimeType = file.type?.toLowerCase() || "";
  if (!mimeType || mimeType === "application/octet-stream") {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") mimeType = "application/pdf";
    else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
    else if (ext === "png") mimeType = "image/png";
  }
  return mimeType;
}

export function MobileFileUploader({ onUpload, uploading, disabled }: MobileFileUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [inAppBrowser, setInAppBrowser] = useState<{ isInApp: boolean; browserName: string | null }>({ isInApp: false, browserName: null });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useEffect(() => {
    setInAppBrowser(detectInAppBrowser());
  }, []);

  const resetInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    try {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const mimeType = getMimeType(file);

      const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
      if (!allowedTypes.includes(mimeType)) {
        setError("Unsupported file type. Please select a PDF, JPG, or PNG.");
        resetInput();
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError("File is too large. Maximum size is 20MB.");
        resetInput();
        return;
      }

      // Auto-upload immediately
      const result = await onUpload(file);
      if (!result.success) {
        setError(result.error || "Upload failed. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed unexpectedly.");
    } finally {
      resetInput();
    }
  };

  const handleOpenInBrowser = () => {
    const currentUrl = window.location.href;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      window.location.href = `x-safari-${currentUrl}`;
    } else {
      window.location.href = `intent://${currentUrl.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
    }
  };

  const isDisabled = disabled || uploading;

  return (
    <div className="space-y-3">
      {inAppBrowser.isInApp && (
        <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-200 text-sm">
            File upload may be blocked
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
            {inAppBrowser.browserName
              ? `${inAppBrowser.browserName}'s browser may block file uploads.`
              : "In-app browsers may block file uploads."
            }
            {" "}Open this page in Safari or Chrome.
          </AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-7 text-xs border-amber-300 dark:border-amber-700"
            onClick={handleOpenInBrowser}
            type="button"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Open in Browser
          </Button>
        </Alert>
      )}

      {/* File input: shows upload zone or inline loading */}
      {uploading ? (
        <div className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed rounded-lg bg-muted/30 border-primary/40">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <span className="text-sm font-medium text-muted-foreground">Uploading...</span>
        </div>
      ) : (
        <div className="space-y-2">
          <label
            htmlFor={inputId}
            className={`
              flex items-center justify-center gap-2 w-full p-4 cursor-pointer
              border-2 border-dashed rounded-lg transition-colors
              ${isDisabled
                ? "bg-muted/50 border-muted-foreground/20 opacity-50 cursor-not-allowed"
                : "bg-muted/30 border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50 active:bg-muted/60"
              }
            `}
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Tap to select file
            </span>
          </label>
          <input
            ref={fileInputRef}
            id={inputId}
            name={inputId}
            type="file"
            accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            disabled={isDisabled}
            className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0"
            style={{ clip: 'rect(0, 0, 0, 0)' }}
            aria-label="Select file to upload"
          />
          <p className="text-xs text-muted-foreground text-center">
            PDF, JPG, or PNG • Max 20MB
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}