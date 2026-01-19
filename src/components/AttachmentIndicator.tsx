import { useState } from "react";
import { Paperclip, FileText, Image, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFileAttachments } from "@/hooks/useFileAttachments";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type EntityType = Database["public"]["Enums"]["entity_type"];

interface AttachmentIndicatorProps {
  entityType: EntityType;
  entityId: string;
  count: number;
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

export function AttachmentIndicator({ entityType, entityId, count }: AttachmentIndicatorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { attachments, loading, deleteFile, getSignedUrl } = useFileAttachments(entityType, dialogOpen ? entityId : null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  if (count === 0) return null;

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

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDialogOpen(true);
        }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-accent"
        aria-label={`View ${count} attachment${count > 1 ? 's' : ''}`}
      >
        <Paperclip className="h-3 w-3" />
        <span>{count}</span>
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Attachments
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="text-sm text-muted-foreground py-4">Loading attachments...</div>
          ) : attachments.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">No attachments found.</div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {attachments.map((attachment) => {
                const FileIcon = getFileIcon(attachment.mime_type);
                return (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <button
                      onClick={() => handleOpen(attachment.file_url, attachment.id)}
                      disabled={openingId === attachment.id}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                    >
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
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpen(attachment.file_url, attachment.id)}
                        disabled={openingId === attachment.id}
                      >
                        {openingId === attachment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Open
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(attachment.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
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
    </>
  );
}
