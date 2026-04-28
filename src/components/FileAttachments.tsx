import { useState, useCallback } from "react";
import { Paperclip, FileText, Image, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { useFileAttachments } from "@/hooks/useFileAttachments";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { AttachmentDownloadButton } from "@/components/AttachmentDownloadButton";
import { MobileFileUploader } from "@/components/MobileFileUploader";
import { ImageViewer } from "@/components/ImageViewer";
import { useImageViewer, type ViewerImage } from "@/hooks/useImageViewer";
import { isImageAttachment } from "@/utils/attachmentHelpers";
import { format } from "date-fns";
import { getLanguage } from "@/i18n";
import { useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

type EntityType = Database["public"]["Enums"]["entity_type"];

interface FileAttachment {
  id: string;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  uploaded_at: string | null;
}

interface FileAttachmentsProps {
  entityType: EntityType;
  entityId: string | null;
}

interface AttachmentRowProps {
  attachment: FileAttachment;
  canDelete: boolean;
  onDelete: () => void;
  getSignedUrl: (filePath: string) => Promise<string | null>;
  onImageClick?: (attachment: FileAttachment) => void;
}

function getFileIcon(mimeType: string | null) {
  if (mimeType?.startsWith("image/")) return Image;
  return FileText;
}

function getFileTypeLabel(mimeType: string | null) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "image/jpeg") return "JPG";
  if (mimeType === "image/png") return "PNG";
  return "File";
}

function isPdf(mimeType: string | null, fileName: string | null): boolean {
  if (mimeType === "application/pdf") return true;
  if (fileName?.toLowerCase().endsWith(".pdf")) return true;
  return false;
}

function AttachmentRow({ attachment, canDelete, onDelete, getSignedUrl, onImageClick }: AttachmentRowProps) {
  const FileIcon = getFileIcon(attachment.mime_type);
  const fileIsPdf = isPdf(attachment.mime_type, attachment.file_name);
  const isImage = isImageAttachment(attachment.file_name, attachment.mime_type);
  const clickable = isImage && !!onImageClick;

  const handleGetSignedUrl = useCallback(
    () => getSignedUrl(attachment.file_url),
    [getSignedUrl, attachment.file_url]
  );

  const InfoBlock = (
    <>
      <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
        <p className="text-xs text-muted-foreground">
          {getFileTypeLabel(attachment.mime_type)}
          {attachment.uploaded_at && (
            <> • {format(new Date(attachment.uploaded_at), "MMM d, yyyy")}</>
          )}
        </p>
      </div>
    </>
  );

  return (
    <div
      className={`p-3 rounded-lg border bg-muted/30 space-y-2 min-h-14 ${
        clickable ? "cursor-zoom-in hover:bg-accent/50 transition-colors" : ""
      }`}
      onClick={clickable ? () => onImageClick!(attachment) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onImageClick!(attachment);
              }
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">{InfoBlock}</div>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Delete file"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
      <div className="pl-8" onClick={(e) => e.stopPropagation()}>
        <AttachmentDownloadButton
          attachmentId={fileIsPdf ? attachment.id : undefined}
          getSignedUrl={!fileIsPdf ? handleGetSignedUrl : undefined}
          fileName={attachment.file_name}
          mimeType={attachment.mime_type}
          attachment={attachment}
          onImageClick={onImageClick}
        />
      </div>
    </div>
  );
}

export function FileAttachments({ entityType, entityId }: FileAttachmentsProps) {
  const { attachments, loading, uploading, uploadFile, deleteFile, getSignedUrl, userAttachmentCount, maxAttachments } = useFileAttachments(entityType, entityId);
  const { canEdit, canDelete } = useActiveProfile();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const navigate = useNavigate();
  const lang = getLanguage();
  const viewer = useImageViewer();

  const imageAttachments = attachments.filter((a) =>
    isImageAttachment(a.file_name, a.mime_type)
  );

  async function handleImageClick(att: FileAttachment) {
    const resolved: ViewerImage[] = await Promise.all(
      imageAttachments.map(async (img) => {
        const url = await getSignedUrl(img.file_url);
        return { url: url ?? "", filename: img.file_name };
      })
    );
    const usable = resolved.filter((r) => r.url);
    if (usable.length === 0) return;
    const startIndex = imageAttachments.findIndex((i) => i.id === att.id);
    viewer.openViewer(usable, startIndex >= 0 ? startIndex : 0);
  }

  const usagePercent = maxAttachments > 0 ? Math.min(100, (userAttachmentCount / maxAttachments) * 100) : 0;
  const nearLimit = usagePercent >= 80;
  const atLimit = userAttachmentCount >= maxAttachments;

  async function handleUpload(file: File): Promise<{ success: boolean; error?: string }> {
    if (atLimit) {
      navigate("/pricing");
      return { success: false, error: "limit_reached" };
    }
    const result = await uploadFile(file);
    if (result.error === "attachment_limit_reached") {
      navigate("/pricing");
    }
    return result;
  }

  async function handleDelete() {
    if (!deleteId) return;
    await deleteFile(deleteId);
    setDeleteId(null);
  }

  if (!entityId) {
    return (
      <div className="text-sm text-muted-foreground">
        {lang === "es" ? "Guardá el registro primero para agregar adjuntos." : "Save the record first to add attachments."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          <h3 className="text-sm font-medium">{lang === "es" ? "Adjuntos" : "Attachments"}</h3>
        </div>
        {/* File usage counter - global plan usage */}
        <span className={`text-xs font-medium ${nearLimit ? "text-amber-600" : "text-muted-foreground"}`}>
          {lang === "es" ? "Total:" : "Total:"} {userAttachmentCount} / {maxAttachments >= 9999 ? "∞" : maxAttachments}
        </span>
      </div>

      {/* Progress bar with 80% warning */}
      {maxAttachments < 9999 && (
        <div className="space-y-1">
          <Progress
            value={usagePercent}
            className={`h-1.5 ${nearLimit ? "[&>div]:bg-amber-500" : ""}`}
          />
          {nearLimit && !atLimit && (
            <p className="text-xs text-warning" style={{ color: "hsl(38, 92%, 40%)" }}>
              {lang === "es"
                ? `⚠️ Casi en el límite — ${maxAttachments - userAttachmentCount} archivos restantes.`
                : `⚠️ Approaching limit — ${maxAttachments - userAttachmentCount} files remaining.`}
            </p>
          )}
          {atLimit && (
            <p className="text-xs text-destructive">
              {lang === "es"
                ? "Límite alcanzado. "
                : "Storage limit reached. "}
              <button
                onClick={() => navigate("/pricing?highlight=plus")}
                className="underline font-medium"
              >
                {lang === "es" ? "Ver planes" : "See plans"}
              </button>
            </p>
          )}
        </div>
      )}

      {canEdit && !atLimit && (
        <MobileFileUploader
          onUpload={handleUpload}
          uploading={uploading}
          disabled={!entityId}
        />
      )}

      {canEdit && atLimit && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
          <p className="text-sm text-muted-foreground flex-1">
            {lang === "es"
              ? "Alcanzaste el límite de archivos de tu plan."
              : "You've reached your plan's file limit."}
          </p>
          <Button size="sm" variant="outline" onClick={() => navigate("/pricing?highlight=plus")}>
            {lang === "es" ? "Ver planes" : "See plans"}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">{lang === "es" ? "Cargando..." : "Loading attachments..."}</div>
      ) : attachments.length === 0 ? (
        <div className="text-sm text-muted-foreground">{lang === "es" ? "Sin adjuntos." : "No attachments yet."}</div>
      ) : (
        <div className="space-y-3">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              canDelete={canDelete}
              onDelete={() => setDeleteId(attachment.id)}
              getSignedUrl={getSignedUrl}
              onImageClick={handleImageClick}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{lang === "es" ? "¿Eliminar archivo?" : "Delete file?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "es" ? "El archivo se eliminará permanentemente." : "This file will be permanently removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === "es" ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {lang === "es" ? "Eliminar" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImageViewer
        isOpen={viewer.isOpen}
        onClose={viewer.closeViewer}
        images={viewer.images}
        currentIndex={viewer.currentIndex}
        hasMultiple={viewer.hasMultiple}
        onNext={viewer.goNext}
        onPrev={viewer.goPrev}
      />
    </div>
  );
}
