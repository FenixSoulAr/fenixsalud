import { useState, useRef } from "react";
import { Paperclip, FileText, Image, Trash2, ExternalLink, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFileAttachments } from "@/hooks/useFileAttachments";
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Attachments
        </h3>
        <div className="relative">
          {/* Label-based file input for better mobile compatibility */}
          <label
            htmlFor={`file-upload-${entityId}`}
            className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span>Upload</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            id={`file-upload-${entityId}`}
            accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
            capture={false}
            multiple
            onChange={handleFileSelect}
            className="sr-only"
            aria-label="Upload file"
          />
        </div>
      </div>

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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(attachment.id)}
                    aria-label="Delete file"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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
