import { useCallback } from "react";
import { FileText, Image, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttachmentDownloadButton } from "@/components/AttachmentDownloadButton";
import { format } from "date-fns";

interface AttachmentItemProps {
  attachment: {
    id: string;
    file_name: string;
    file_url: string;
    mime_type: string | null;
    uploaded_at: string | null;
  };
  getSignedUrl: (fileUrl: string) => Promise<string | null>;
  canDelete: boolean;
  onDelete: (id: string) => void;
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

export function AttachmentItem({ attachment, getSignedUrl, canDelete, onDelete }: AttachmentItemProps) {
  const FileIcon = getFileIcon(attachment.mime_type);
  const fileIsPdf = isPdf(attachment.mime_type, attachment.file_name);

  // Get signed URL callback for images
  const getUrl = useCallback(
    () => getSignedUrl(attachment.file_url),
    [getSignedUrl, attachment.file_url]
  );

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
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
        {/* Unified download button for all file types */}
        <AttachmentDownloadButton
          attachmentId={fileIsPdf ? attachment.id : undefined}
          getSignedUrl={!fileIsPdf ? getUrl : undefined}
          fileName={attachment.file_name}
          mimeType={attachment.mime_type}
          compact
        />
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(attachment.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
