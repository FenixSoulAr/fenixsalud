import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useTranslations } from "@/i18n";
import { Paperclip, FileWarning } from "lucide-react";

interface AttachmentPageProps {
  attachment: {
    id: string;
    entity_id: string;
    entity_type: "TestStudy" | "Procedure";
    file_name: string;
    file_url: string;
    mime_type: string | null;
  };
  entityTitle: string;
  entityDate: string;
  type: "test" | "procedure";
}

export function AttachmentPage({ attachment, entityTitle, entityDate, type }: AttachmentPageProps) {
  const t = useTranslations();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  const isImage = attachment.mime_type?.startsWith("image/");
  const isPdf = attachment.mime_type === "application/pdf";
  const canEmbed = isImage; // PDFs can't be embedded in print view

  useEffect(() => {
    async function loadAttachment() {
      if (!canEmbed) {
        setLoading(false);
        return;
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        if (!accessToken) {
          setLoadError(true);
          setLoading(false);
          return;
        }

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const proxyUrl = `https://${projectId}.supabase.co/functions/v1/attachment-proxy`;

        const response = await fetch(proxyUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fileUrl: attachment.file_url }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch attachment");
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (error) {
        console.error("Error loading attachment:", error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }

    loadAttachment();

    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [attachment.file_url, canEmbed]);

  const typeLabel = type === "test" ? t.clinicalSummary.testAttachment : t.clinicalSummary.procedureAttachment;
  const formattedDate = format(new Date(entityDate), "MMM d, yyyy");

  return (
    <div className="attachment-page break-before-page print:break-before-page">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 border-b pb-3">
        <Paperclip className="h-5 w-5 text-muted-foreground" />
        <div>
          <h3 className="font-semibold">
            {typeLabel}: {entityTitle} – {formattedDate}
          </h3>
          <p className="text-sm text-muted-foreground">{attachment.file_name}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex items-center justify-center min-h-[400px]">
        {loading ? (
          <div className="text-muted-foreground text-sm">
            {t.clinicalSummary.loadingAttachments}
          </div>
        ) : loadError || !canEmbed ? (
          <div className="text-center p-8 bg-muted/50 rounded-lg max-w-md">
            <FileWarning className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t.clinicalSummary.attachmentNotEmbeddable}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {attachment.file_name}
              {isPdf && " (PDF)"}
            </p>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={attachment.file_name}
            className="max-w-full max-h-[700px] object-contain print:max-h-[800px]"
            onError={() => setLoadError(true)}
          />
        ) : null}
      </div>
    </div>
  );
}
