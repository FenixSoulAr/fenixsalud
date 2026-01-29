import { useState, useRef, useEffect, useId } from "react";
import { Upload, X, FileText, Image, AlertTriangle, Loader2, ExternalLink, Camera, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getLanguage } from "@/i18n";

interface StagedFile {
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

interface MobileFileUploaderWithCameraProps {
  onUpload: (file: File) => Promise<{ success: boolean; error?: string }>;
  uploading: boolean;
  disabled?: boolean;
}

// Detect in-app browsers (Instagram, Facebook, TikTok, WhatsApp, etc.)
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

function getMimeType(file: File): string {
  let mimeType = file.type?.toLowerCase() || "";
  
  // Fallback to extension if MIME type is empty or generic
  if (!mimeType || mimeType === "application/octet-stream") {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") mimeType = "application/pdf";
    else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
    else if (ext === "png") mimeType = "image/png";
  }
  
  return mimeType;
}

export function MobileFileUploaderWithCamera({ onUpload, uploading, disabled }: MobileFileUploaderWithCameraProps) {
  const lang = getLanguage();
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inAppBrowser, setInAppBrowser] = useState<{ isInApp: boolean; browserName: string | null }>({ isInApp: false, browserName: null });
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const fileInputId = useId();
  const cameraInputId = useId();

  useEffect(() => {
    setInAppBrowser(detectInAppBrowser());
  }, []);

  const processFile = (file: File): StagedFile | null => {
    const mimeType = getMimeType(file);
    
    // Validate type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(mimeType)) {
      setError(lang === "es" 
        ? "Tipo de archivo no soportado. Usá PDF, JPG o PNG."
        : "Unsupported file type. Please select a PDF, JPG, or PNG."
      );
      return null;
    }

    // Validate size (20MB)
    if (file.size > 20 * 1024 * 1024) {
      setError(lang === "es" 
        ? "El archivo es muy grande. Máximo 20MB."
        : "File is too large. Maximum size is 20MB."
      );
      return null;
    }

    return {
      file,
      name: file.name,
      size: file.size,
      type: mimeType,
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newStagedFiles: StagedFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const staged = processFile(files[i]);
      if (staged) {
        // Create preview for images
        if (staged.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (loadEvent) => {
            staged.preview = loadEvent.target?.result as string;
            setStagedFiles(prev => [...prev]);
          };
          reader.readAsDataURL(staged.file);
        }
        newStagedFiles.push(staged);
      }
    }
    
    setStagedFiles(prev => [...prev, ...newStagedFiles]);
    
    // Reset input
    if (e.target) e.target.value = "";
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const staged = processFile(file);
    
    if (staged) {
      // Create preview for camera photos
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        staged.preview = loadEvent.target?.result as string;
        setStagedFiles(prev => [...prev, staged]);
      };
      reader.readAsDataURL(staged.file);
    }
    
    // Reset input
    if (e.target) e.target.value = "";
  };

  const removeStaged = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadSingle = async (index: number) => {
    const staged = stagedFiles[index];
    if (!staged) return;

    setUploadingIndex(index);
    setError(null);
    
    try {
      const result = await onUpload(staged.file);
      
      if (result.success) {
        setStagedFiles(prev => prev.filter((_, i) => i !== index));
      } else {
        setError(result.error || (lang === "es" ? "Error al subir. Intentá nuevamente." : "Upload failed. Please try again."));
      }
    } catch (err) {
      setError(lang === "es" ? "Error inesperado al subir." : "Unexpected upload error.");
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleUploadAll = async () => {
    for (let i = 0; i < stagedFiles.length; i++) {
      await handleUploadSingle(i);
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
    <div className="space-y-4">
      {/* In-app browser warning */}
      {inAppBrowser.isInApp && (
        <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-200 text-sm">
            {lang === "es" ? "La subida podría estar bloqueada" : "File upload may be blocked"}
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
            {inAppBrowser.browserName 
              ? (lang === "es" 
                  ? `El navegador de ${inAppBrowser.browserName} puede bloquear archivos.`
                  : `${inAppBrowser.browserName}'s browser may block file uploads.`)
              : (lang === "es"
                  ? "Los navegadores integrados pueden bloquear archivos."
                  : "In-app browsers may block file uploads.")
            }
            {" "}{lang === "es" ? "Abrí en Safari o Chrome." : "Open in Safari or Chrome."}
          </AlertDescription>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 h-7 text-xs border-amber-300 dark:border-amber-700"
            onClick={handleOpenInBrowser}
            type="button"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            {lang === "es" ? "Abrir en navegador" : "Open in Browser"}
          </Button>
        </Alert>
      )}

      {/* Action buttons - Select file and Camera */}
      <div className="flex gap-2">
        {/* Select file button */}
        <label 
          htmlFor={fileInputId}
          className={`
            flex-1 flex items-center justify-center gap-2 p-3 cursor-pointer
            border-2 border-dashed rounded-lg transition-colors
            ${isDisabled 
              ? "bg-muted/50 border-muted-foreground/20 opacity-50 cursor-not-allowed" 
              : "bg-muted/30 border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50 active:bg-muted/60"
            }
          `}
        >
          <Paperclip className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {lang === "es" ? "Adjuntar archivo" : "Attach file"}
          </span>
        </label>
        
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
          multiple
          onChange={handleFileChange}
          disabled={isDisabled}
          className="sr-only"
          aria-label={lang === "es" ? "Seleccionar archivo" : "Select file"}
        />

        {/* Camera button */}
        <label 
          htmlFor={cameraInputId}
          className={`
            flex-1 flex items-center justify-center gap-2 p-3 cursor-pointer
            border-2 border-dashed rounded-lg transition-colors
            ${isDisabled 
              ? "bg-muted/50 border-muted-foreground/20 opacity-50 cursor-not-allowed" 
              : "bg-primary/10 border-primary/30 hover:border-primary/50 hover:bg-primary/20 active:bg-primary/30"
            }
          `}
        >
          <Camera className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-primary">
            {lang === "es" ? "Tomar foto" : "Take photo"}
          </span>
        </label>
        
        <input
          ref={cameraInputRef}
          id={cameraInputId}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCameraCapture}
          disabled={isDisabled}
          className="sr-only"
          aria-label={lang === "es" ? "Tomar foto" : "Take photo"}
        />
      </div>

      <p className="text-xs text-muted-foreground text-center">
        PDF, JPG, PNG • {lang === "es" ? "Máx 20MB" : "Max 20MB"}
      </p>

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Staged files list */}
      {stagedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              {lang === "es" ? "Archivos seleccionados" : "Selected files"} ({stagedFiles.length})
            </h4>
            {stagedFiles.length > 1 && (
              <Button
                type="button"
                size="sm"
                onClick={handleUploadAll}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    {lang === "es" ? "Subiendo..." : "Uploading..."}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-1" />
                    {lang === "es" ? "Subir todos" : "Upload all"}
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {stagedFiles.map((staged, index) => {
              const FileIcon = getFileIcon(staged.type);
              const isUploadingThis = uploadingIndex === index;
              
              return (
                <div key={index} className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-start gap-3">
                    {/* Preview or icon */}
                    <div className="shrink-0">
                      {staged.preview ? (
                        <img 
                          src={staged.preview} 
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
                      <p className="text-sm font-medium truncate">{staged.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {staged.type.split("/")[1]?.toUpperCase() || "FILE"} • {formatFileSize(staged.size)}
                      </p>
                    </div>

                    {/* Remove button */}
                    {!isUploadingThis && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => removeStaged(index)}
                        aria-label={lang === "es" ? "Quitar archivo" : "Remove file"}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Individual upload button */}
                  <Button
                    type="button"
                    className="w-full mt-2"
                    size="sm"
                    onClick={() => handleUploadSingle(index)}
                    disabled={uploading}
                  >
                    {isUploadingThis ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {lang === "es" ? "Subiendo..." : "Uploading..."}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {lang === "es" ? "Subir" : "Upload"}
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
