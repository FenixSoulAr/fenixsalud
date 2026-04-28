import { useState, useCallback } from "react";

export interface ViewerImage {
  /** Public or signed URL used to display the image */
  url: string;
  /** Original filename, shown in the header and used for downloads */
  filename: string;
  /** Optional explicit URL for the download action (defaults to `url`) */
  downloadUrl?: string;
}

export const useImageViewer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [images, setImages] = useState<ViewerImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openViewer = useCallback((imgs: ViewerImage[], startIndex = 0) => {
    if (imgs.length === 0) return;
    setImages(imgs);
    setCurrentIndex(Math.max(0, Math.min(startIndex, imgs.length - 1)));
    setIsOpen(true);
  }, []);

  const closeViewer = useCallback(() => {
    setIsOpen(false);
    // Reset state on close to prevent stale data on next open
    setTimeout(() => {
      setImages([]);
      setCurrentIndex(0);
    }, 200);
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (images.length === 0 ? 0 : (i + 1) % images.length));
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) =>
      images.length === 0 ? 0 : (i - 1 + images.length) % images.length,
    );
  }, [images.length]);

  return {
    isOpen,
    images,
    currentIndex,
    currentImage: images[currentIndex] ?? null,
    hasMultiple: images.length > 1,
    openViewer,
    closeViewer,
    goNext,
    goPrev,
  };
};
