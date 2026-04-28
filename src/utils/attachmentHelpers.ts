// Attachment helpers — utilities to classify attachments by type.
// Image-only viewer scope: PDF/DOCX/XLSX continue using external open behavior.

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"] as const;

export const getFileExtension = (filename: string | null | undefined): string => {
  if (!filename) return "";
  return filename.split(".").pop()?.toLowerCase() ?? "";
};

export const isImageAttachment = (
  filename: string | null | undefined,
  mimeType?: string | null,
): boolean => {
  if (mimeType && mimeType.toLowerCase().startsWith("image/")) return true;
  const ext = getFileExtension(filename);
  return ext ? (IMAGE_EXTENSIONS as readonly string[]).includes(ext) : false;
};
