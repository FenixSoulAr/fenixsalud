import { useState, useCallback } from "react";
import { Paperclip, FileText, Image, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFileAttachments } from "@/hooks/useFileAttachments";
import { MobileFileUploader } from "@/components/MobileFileUploader";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { PdfAttachmentActions } from "@/components/PdfAttachmentActions";
import { ImageAttachmentActions } from "@/components/ImageAttachmentActions";
import { format } from "date-fns";
import { getLanguage } from "@/i18n";
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

// Separate component to avoid hook rules violation
function AttachmentRow({ attachment, canDelete, onDelete, getSignedUrl }: AttachmentRowProps) {
  const FileIcon = getFileIcon(attachment.mime_type);
  const fileIsPdf = isPdf(attachment.mime_type, attachment.file_name);
  
  const handleGetSignedUrl = useCallback(
    () => getSignedUrl(attachment.file_url),
    [getSignedUrl, attachment.file_url]
  );

  return (
    <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{attachment.file_name}</p>
            <p className="text-xs text-muted-foreground">
              {getFileTypeLabel(attachment.mime_type)}
              {attachment.uploaded_at && (
                <> • {format(new Date(attachment.uploaded_at), "MMM d, yyyy")}</>
              )}
            </p>
          </div>
        </div>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label="Delete file"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
      
      {/* Actions row */}
      <div className="pl-8">
        {fileIsPdf ? (
          <PdfAttachmentActions
            attachmentId={attachment.id}
            fileName={attachment.file_name}
          />
        ) : (
          <ImageAttachmentActions
            getSignedUrl={handleGetSignedUrl}
          />
        )}
      </div>
    </div>
  );
}

export function FileAttachments({ entityType, entityId }: FileAttachmentsProps) {
  const { attachments, loading, uploading, uploadFile, deleteFile, getSignedUrl } = useFileAttachments(entityType, entityId);
  const { canEdit, canDelete } = useActiveProfile();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const lang = getLanguage();

  async function handleUpload(file: File): Promise<{ success: boolean; error?: string }> {
    console.log("[FileAttachments] handleUpload called with:", file.name, file.size, file.type);
    const result = await uploadFile(file);
    console.log("[FileAttachments] uploadFile result:", result);
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
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        <h3 className="text-sm font-medium">{lang === "es" ? "Adjuntos" : "Attachments"}</h3>
      </div>

      {/* Show upload controls only for users with edit permission */}
      {canEdit && (
        <MobileFileUploader 
          onUpload={handleUpload}
          uploading={uploading}
          disabled={!entityId}
        />
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading attachments...</div>
      ) : attachments.length === 0 ? (
        <div className="text-sm text-muted-foreground">No attachments yet.</div>
      ) : (
        <div className="space-y-3">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              canDelete={canDelete}
              onDelete={() => setDeleteId(attachment.id)}
              getSignedUrl={getSignedUrl}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>This file will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
