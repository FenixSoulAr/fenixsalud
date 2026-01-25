import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useEntitlementGate } from "@/hooks/useEntitlementGate";
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

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function useFileAttachments(entityType: EntityType, entityId: string | null) {
  const { dataProfileId, activeProfileId, currentUserId } = useActiveProfile();
  const { checkAttachmentLimit } = useEntitlementGate();
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

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
  }, [fetchAttachments]);

  const uploadFile = async (file: File): Promise<{ success: boolean; error?: string }> => {
    if (!dataProfileId || !entityId || !currentUserId) {
      return { success: false, error: "Not authenticated or missing entity ID." };
    }

    // Check entitlement limit before uploading
    const canUpload = await checkAttachmentLimit();
    if (!canUpload) {
      return { success: false, error: "Attachment limit reached. Upgrade to Plus for unlimited attachments." };
    }

    // Normalize MIME type for mobile compatibility (some devices report different types)
    let mimeType = file.type?.toLowerCase() || "";
    
    // Handle edge cases where mobile might report different MIME types or empty type
    if (!mimeType && file.name) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf") mimeType = "application/pdf";
      else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
      else if (ext === "png") mimeType = "image/png";
    }

    // Additional fallback: check for common mobile MIME variations
    if (mimeType === "application/octet-stream" && file.name) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf") mimeType = "application/pdf";
      else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
      else if (ext === "png") mimeType = "image/png";
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(mimeType)) {
      const errorMsg = "Unsupported file type. Please upload a PDF, JPG, or PNG.";
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Validate file size
    if (file.size > MAX_SIZE_BYTES) {
      const errorMsg = "File is too large. Maximum size is 20MB.";
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    setUploading(true);
    
    try {
      // Create unique file path: profile_id/entity_type/entity_id/timestamp_filename
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `${dataProfileId}/${entityType}/${entityId}/${timestamp}_${safeName}`;

      // Upload to storage with explicit content type for mobile compatibility
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("health-files")
        .upload(filePath, file, {
          contentType: mimeType,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        // Check if it's a permission error
        const errorMessage = uploadError.message?.toLowerCase() || "";
        if (errorMessage.includes("policy") || errorMessage.includes("permission") || errorMessage.includes("403") || errorMessage.includes("unauthorized")) {
          const errorMsg = "You don't have permission to upload files.";
          toast.error(errorMsg);
          return { success: false, error: errorMsg };
        }
        const errorMsg = `Upload failed: ${uploadError.message}`;
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Create file_attachments record with profile ID
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
        console.error("DB error:", dbError);
        // Try to clean up uploaded file
        await supabase.storage.from("health-files").remove([filePath]);
        // Check if it's a permission error
        const errorMessage = dbError.message?.toLowerCase() || "";
        if (errorMessage.includes("policy") || errorMessage.includes("permission") || dbError.code === "42501") {
          const errorMsg = "You don't have permission to upload files.";
          toast.error(errorMsg);
          return { success: false, error: errorMsg };
        }
        const errorMsg = `Failed to save file record: ${dbError.message}`;
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      await fetchAttachments();
      toast.success("File uploaded.");
      return { success: true };
    } catch (error: unknown) {
      console.error("Unexpected error:", error);
      // Handle cases where error might be a Response object or have non-JSON body
      let errorMsg = "Upload failed. Please check your connection and try again.";
      if (error instanceof Error) {
        // Check for permission-related errors
        const msg = error.message.toLowerCase();
        if (msg.includes("policy") || msg.includes("permission") || msg.includes("403") || msg.includes("unauthorized")) {
          errorMsg = "You don't have permission to upload files.";
        } else if (msg.includes("unexpected token") || msg.includes("not valid json")) {
          // Server returned HTML instead of JSON - usually means 403/401
          errorMsg = "Upload failed. You may not have permission to upload files.";
        } else {
          errorMsg = `Upload failed: ${error.message}`;
        }
      }
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (attachmentId: string): Promise<boolean> => {
    const attachment = attachments.find(a => a.id === attachmentId);
    if (!attachment) return false;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("health-files")
        .remove([attachment.file_url]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("file_attachments")
        .delete()
        .eq("id", attachmentId);

      if (dbError) {
        console.error("DB delete error:", dbError);
        toast.error("Failed to delete file. Please try again.");
        return false;
      }

      await fetchAttachments();
      toast.success("File deleted.");
      return true;
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("Failed to delete file. Please try again.");
      return false;
    }
  };

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("health-files")
      .createSignedUrl(filePath, 60 * 5); // 5 minute expiry

    if (error) {
      console.error("Signed URL error:", error);
      toast.error("Failed to open file. Please try again.");
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
  };
}
