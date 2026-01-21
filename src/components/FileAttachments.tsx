import { useState } from "react";
import { Paperclip, FileText, Image, Trash2, ExternalLink, Loader2, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFileAttachments } from "@/hooks/useFileAttachments";
import { MobileFileUploader } from "@/components/MobileFileUploader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type EntityType = Database["public"]["Enums"]["entity_type"];

interface FileAttachmentsProps {
  entityType: EntityType;
  entityId: string | null;
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

export function FileAttachments({ entityType, entityId }: FileAttachmentsProps) {
  const { attachments, loading, uploading, uploadFile, deleteFile, getSignedUrl } = useFileAttachments(entityType, entityId);
  const { canEdit, canDelete } = useActiveProfile();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  async function handleUpload(file: File): Promise<{ success: boolean; error?: string }> {
    console.log("[FileAttachments] handleUpload called with:", file.name, file.size, file.type);
    const result = await uploadFile(file);
    console.log("[FileAttachments] uploadFile result:", result);
    return result;
  }

  async function handleOpen(filePath: string, attachmentId: string) {
    setOpeningId(attachmentId);
    const url = await getSignedUrl(filePath);
    if (url) {
      window.open(url, "_blank");
    }
    setOpeningId(null);
  }

  async function handleDelete() {
    if (!deleteId) return;
    await deleteFile(deleteId);
    setDeleteId(null);
  }

  if (!entityId) {
    return (
      <div className="text-sm text-muted-foreground">
        Save the record first to add attachments.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        <h3 className="text-sm font-medium">Attachments</h3>
      </div>

      {/* Show upload controls only for users with edit permission */}
      {canEdit && (
        <>
          {isMobile ? (
            <Alert>
              <Monitor className="h-4 w-4" />
              <AlertTitle>File upload not available on mobile</AlertTitle>
              <AlertDescription>
                For now, documents can only be uploaded from a computer. You can still view existing files on your phone.
              </AlertDescription>
            </Alert>
          ) : (
            <MobileFileUploader 
              onUpload={handleUpload}
              uploading={uploading}
              disabled={!entityId}
            />
          )}
        </>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading attachments...</div>
      ) : attachments.length === 0 ? (
        <div className="text-sm text-muted-foreground">No attachments yet.</div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const FileIcon = getFileIcon(attachment.mime_type);
            return (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
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
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpen(attachment.file_url, attachment.id)}
                    disabled={openingId === attachment.id}
                    aria-label="Open file"
                  >
                    {openingId === attachment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                  </Button>
                  {canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(attachment.id)}
                      aria-label="Delete file"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
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
