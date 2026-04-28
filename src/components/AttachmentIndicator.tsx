import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFileAttachments } from "@/hooks/useFileAttachments";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { AttachmentItem } from "@/components/AttachmentItem";
import { ImageViewer } from "@/components/ImageViewer";
import { useImageViewer, type ViewerImage } from "@/hooks/useImageViewer";
import { isImageAttachment } from "@/utils/attachmentHelpers";
import type { Database } from "@/integrations/supabase/types";

type EntityType = Database["public"]["Enums"]["entity_type"];

interface AttachmentIndicatorProps {
  entityType: EntityType;
  entityId: string;
  count: number;
}

export function AttachmentIndicator({ entityType, entityId, count }: AttachmentIndicatorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { attachments, loading, deleteFile, getSignedUrl } = useFileAttachments(entityType, dialogOpen ? entityId : null);
  const { canDelete } = useActiveProfile();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const viewer = useImageViewer();

  if (count === 0) return null;

  async function handleDelete() {
    if (!deleteId) return;
    await deleteFile(deleteId);
    setDeleteId(null);
  }

  const imageAttachments = (attachments || []).filter((a) =>
    isImageAttachment(a.file_name, a.mime_type)
  );

  async function handleImageClick(att: { id: string; file_name: string; file_url: string; mime_type: string | null }) {
    // Resolve signed URLs for all images in this entity for navigation
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
          ) : !attachments || attachments.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">No attachments found.</div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {attachments.map((attachment) => (
                <AttachmentItem
                  key={attachment.id}
                  attachment={attachment}
                  getSignedUrl={getSignedUrl}
                  canDelete={canDelete}
                  onDelete={setDeleteId}
                  onImageClick={handleImageClick}
                />
              ))}
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

      <ImageViewer
        isOpen={viewer.isOpen}
        onClose={viewer.closeViewer}
        images={viewer.images}
        currentIndex={viewer.currentIndex}
        hasMultiple={viewer.hasMultiple}
        onNext={viewer.goNext}
        onPrev={viewer.goPrev}
      />
    </>
  );
}
