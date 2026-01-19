import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function useFileAttachments(entityType: EntityType, entityId: string | null) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchAttachments = useCallback(async () => {
    if (!entityId || !user) return;
    
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
  }, [entityId, entityType, user]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const uploadFile = async (file: File): Promise<boolean> => {
    if (!user || !entityId) return false;

    // Normalize MIME type for mobile compatibility (some devices report different types)
    let mimeType = file.type?.toLowerCase() || "";
    
    // Handle edge cases where mobile might report different MIME types
    if (!mimeType && file.name) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf") mimeType = "application/pdf";
      else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
      else if (ext === "png") mimeType = "image/png";
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(mimeType)) {
      toast.error("Unsupported file type. Please upload a PDF, JPG, or PNG.");
      return false;
    }

    // Validate file size
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("File is too large. Maximum size is 20MB.");
      return false;
    }

    setUploading(true);
    
    try {
      // Create unique file path: user_id/entity_type/entity_id/timestamp_filename
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `${user.id}/${entityType}/${entityId}/${timestamp}_${safeName}`;

      // Upload to storage with explicit content type for mobile compatibility
      const { error: uploadError } = await supabase.storage
        .from("health-files")
        .upload(filePath, file, {
          contentType: mimeType,
          cacheControl: "3600",
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("We couldn't upload this file. Please try again.");
        return false;
      }

      // Create file_attachments record
      const { error: dbError } = await supabase
        .from("file_attachments")
        .insert({
          user_id: user.id,
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
        toast.error("We couldn't upload this file. Please try again.");
        return false;
      }

      await fetchAttachments();
      toast.success("File uploaded.");
      return true;
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("We couldn't upload this file. Please try again.");
      return false;
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
