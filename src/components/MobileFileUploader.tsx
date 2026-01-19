import { useState, useRef, useEffect } from "react";
import { Upload, X, FileText, Image, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface StagedFile {
  file: File;
  name: string;
  type: string;
  preview?: string;
}

interface MobileFileUploaderProps {
  onUpload: (file: File) => Promise<boolean>;
  uploading: boolean;
  disabled?: boolean;
}

// Detect in-app browsers (Instagram, Facebook, TikTok, WhatsApp, etc.)
function detectInAppBrowser(): { isInApp: boolean; browserName: string | null } {
  const ua = navigator.userAgent || navigator.vendor || "";
  
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
    { pattern: /GSA\//i, name: "Google App" }, // Google Search App
  ];

  for (const { pattern, name } of inAppPatterns) {
    if (pattern.test(ua)) {
      return { isInApp: true, browserName: name };
    }
  }

  return { isInApp: false, browserName: null };
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  return FileText;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MobileFileUploader({ onUpload, uploading, disabled }: MobileFileUploaderProps) {
  const [stagedFile, setStagedFile] = useState<StagedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inAppBrowser, setInAppBrowser] = useState<{ isInApp: boolean; browserName: string | null }>({ isInApp: false, browserName: null });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useRef(`file-upload-${Math.random().toString(36).substr(2, 9)}`).current;

  useEffect(() => {
    setInAppBrowser(detectInAppBrowser());
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Determine MIME type with fallback
    let mimeType = file.type?.toLowerCase() || "";
    if (!mimeType && file.name) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf") mimeType = "application/pdf";
      else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
      else if (ext === "png") mimeType = "image/png";
    }

    // Validate type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(mimeType)) {
      setError("Unsupported file type. Please select a PDF, JPG, or PNG.");
      resetInput();
      return;
    }

    // Validate size (20MB)
    if (file.size > 20 * 1024 * 1024) {
      setError("File is too large. Maximum size is 20MB.");
      resetInput();
      return;
    }

    // Stage the file
    const staged: StagedFile = {
      file,
      name: file.name,
      type: mimeType,
    };

    // Create preview for images
    if (mimeType.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        staged.preview = e.target?.result as string;
        setStagedFile({ ...staged });
      };
      reader.readAsDataURL(file);
    } else {
      setStagedFile(staged);
    }
  };

  const resetInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClearStaged = () => {
    setStagedFile(null);
    setError(null);
    resetInput();
  };

  const handleUpload = async () => {
    if (!stagedFile) return;

    setError(null);
    const success = await onUpload(stagedFile.file);
    
    if (success) {
      setStagedFile(null);
      resetInput();
    } else {
      setError("Upload failed. Please check your connection and try again.");
    }
  };

  const handleOpenInBrowser = () => {
    // Attempt to open in default browser
    const currentUrl = window.location.href;
    
    // For iOS, use a custom scheme to try Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // Try x-safari scheme
      window.location.href = `x-safari-${currentUrl}`;
    } else {
      // For Android, use intent
      window.location.href = `intent://${currentUrl.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
    }
  };

  const FileIcon = stagedFile ? getFileIcon(stagedFile.type) : FileText;

  return (
    <div className="space-y-3">
      {/* In-app browser warning */}
      {inAppBrowser.isInApp && (
        <Alert variant="destructive" className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-200 text-sm">
            File upload may be blocked
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
            {inAppBrowser.browserName 
              ? `${inAppBrowser.browserName}'s browser may block file uploads.`
              : "In-app browsers may block file uploads."
            }
            {" "}Open this page in Safari or Chrome to upload files.
          </AlertDescription>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 h-7 text-xs border-amber-300 dark:border-amber-700"
            onClick={handleOpenInBrowser}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Try Open in Browser
          </Button>
        </Alert>
      )}

      {/* File input - native, directly tappable label */}
      {!stagedFile && (
        <div className="relative">
          <label
            htmlFor={inputId}
            className={`
              flex items-center justify-center gap-2 w-full p-4
              border-2 border-dashed rounded-lg cursor-pointer
              transition-colors
              ${disabled || uploading 
                ? "bg-muted/50 border-muted-foreground/20 cursor-not-allowed opacity-50" 
                : "bg-muted/30 border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50 active:bg-muted"
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
            type="file"
            accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            disabled={disabled || uploading}
            className="sr-only"
            aria-label="Select file to upload"
          />
          <p className="text-xs text-muted-foreground mt-1 text-center">
            PDF, JPG, or PNG • Max 20MB
          </p>
        </div>
      )}

      {/* Staged file preview */}
      {stagedFile && (
        <div className="border rounded-lg p-3 bg-muted/30">
          <div className="flex items-start gap-3">
            {/* Preview or icon */}
            <div className="shrink-0">
              {stagedFile.preview ? (
                <img 
                  src={stagedFile.preview} 
                  alt="Preview" 
                  className="w-12 h-12 rounded object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                  <FileIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{stagedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(stagedFile.file.size)}
              </p>
            </div>

            {/* Clear button */}
            {!uploading && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8"
                onClick={handleClearStaged}
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Upload button */}
          <Button
            type="button"
            className="w-full mt-3"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </>
            )}
          </Button>
        </div>
      )}

      {/* Inline error display */}
      {error && (
        <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
