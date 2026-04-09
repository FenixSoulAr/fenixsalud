import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useEntitlementGate } from "@/hooks/useEntitlementGate";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type EntityType = Database["public"]["Enums"]["entity_type"];

interface FileAttachment {
  id: string;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  uploaded_at: string | null;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per upload

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function useFileAttachments(entityType: EntityType, entityId: string | null) {
  const { dataProfileId, activeProfileId, currentUserId } = useActiveProfile();
  const { checkAttachmentLimit } = useEntitlementGate();
  const { maxAttachments } = useEntitlementsContext();
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userAttachmentCount, setUserAttachmentCount] = useState(0);

  const fetchUserAttachmentCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("file_attachments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    setUserAttachmentCount(count || 0);
  }, [user]);

  const fetchAttachments = useCallback(async () => {
    if (!entityId || !activeProfileId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("file_attachments")
      .select("id, file_name, file_url, mime_type, uploaded_at")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Error fetching attachments:", error);
    } else {
      setAttachments(data || []);
    }
    setLoading(false);
  }, [entityId, entityType, activeProfileId]);

  useEffect(() => {
    fetchAttachments();
    fetchUserAttachmentCount();
  }, [fetchAttachments, fetchUserAttachmentCount]);

  const uploadFile = async (file: File): Promise<{ success: boolean; error?: string }> => {
    if (!dataProfileId || !entityId || !currentUserId) {
      return { success: false, error: "Not authenticated or missing entity ID." };
    }

    // Server-side validation of file limit (backend-enforced)
    try {
      const { data: serverCheck, error: checkError } = await supabase.functions.invoke("validate-file-upload");
      if (checkError) {
        console.error("Server-side file validation error:", checkError);
        // Fall back to client-side check if server call fails
        const canUpload = await checkAttachmentLimit();
        if (!canUpload) {
          return { success: false, error: "attachment_limit_reached" };
        }
      } else if (serverCheck && !serverCheck.allowed) {
        return { success: false, error: "attachment_limit_reached" };
      }
    } catch (e) {
      console.error("Error calling validate-file-upload, falling back to client check:", e);
      const canUpload = await checkAttachmentLimit();
      if (!canUpload) {
        return { success: false, error: "attachment_limit_reached" };
      }
    }

    // Normalize MIME type
    let mimeType = file.type?.toLowerCase() || "";
    if (!mimeType || mimeType === "application/octet-stream") {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (EXT_TO_MIME[ext]) mimeType = EXT_TO_MIME[ext];
    }

    if (!ALLOWED_TYPES.includes(mimeType)) {
      return { success: false, error: "Unsupported file type. Please upload a PDF, JPG, or PNG." };
    }

    // 10MB limit
    if (file.size > MAX_SIZE_BYTES) {
      return { success: false, error: "File is too large. Maximum size is 10MB." };
    }

    setUploading(true);

    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `${dataProfileId}/${entityType}/${entityId}/${timestamp}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("health-files")
        .upload(filePath, file, {
          contentType: mimeType,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        const errorMessage = uploadError.message?.toLowerCase() || "";
        if (errorMessage.includes("policy") || errorMessage.includes("permission") || errorMessage.includes("403") || errorMessage.includes("unauthorized")) {
          return { success: false, error: "You don't have permission to upload files." };
        }
        return { success: false, error: `Upload failed: ${uploadError.message}` };
      }

      const { error: dbError } = await supabase
        .from("file_attachments")
        .insert({
          profile_id: dataProfileId,
          user_id: currentUserId,
          entity_type: entityType,
          entity_id: entityId,
          file_name: file.name,
          file_url: filePath,
          mime_type: mimeType,
        });

      if (dbError) {
        console.error("DB insert error:", dbError);
        try {
          await supabase.storage.from("health-files").remove([filePath]);
        } catch (cleanupErr) {
          console.error("Failed to cleanup orphaned file:", cleanupErr);
        }
        const errorMessage = dbError.message?.toLowerCase() || "";
        if (errorMessage.includes("policy") || errorMessage.includes("permission") || dbError.code === "42501") {
          return { success: false, error: "You don't have permission to upload files." };
        }
        return { success: false, error: "Error saving file record. Please try again." };
      }

      await fetchAttachments();
      await fetchUserAttachmentCount();
      toast.success("Archivo subido correctamente.");
      return { success: true };

    } catch (error: unknown) {
      console.error("Unexpected upload error:", error);
      return { success: false, error: "Unexpected error. Please try again." };
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (attachmentId: string): Promise<boolean> => {
    if (!dataProfileId) {
      toast.error("No se pudo determinar el perfil activo.");
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke("delete-attachment", {
        body: { attachment_id: attachmentId, profile_id: dataProfileId },
      });

      if (error) {
        console.error("Delete attachment error:", error);
        toast.error("No se pudo eliminar el archivo. Intentá nuevamente.");
        return false;
      }

      if (data?.error) {
        console.error("Delete attachment server error:", data.error);
        toast.error(data.error);
        return false;
      }

      await fetchAttachments();
      await fetchUserAttachmentCount();
      toast.success("Archivo eliminado.");
      return true;
    } catch (error) {
      console.error("Unexpected delete error:", error);
      toast.error("No se pudo eliminar el archivo. Intentá nuevamente.");
      return false;
    }
  };

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("health-files")
      .createSignedUrl(filePath, 60 * 5);

    if (error) {
      console.error("Signed URL error:", error);
      return null;
    }

    return data.signedUrl;
  };

  return {
    attachments,
    loading,
    uploading,
    uploadFile,
    deleteFile,
    getSignedUrl,
    refetch: fetchAttachments,
    userAttachmentCount,
    maxAttachments,
  };
}
