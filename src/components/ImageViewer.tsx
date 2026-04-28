import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/i18n";
import { toast } from "sonner";
import type { ViewerImage } from "@/hooks/useImageViewer";

interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  images: ViewerImage[];
  currentIndex: number;
  hasMultiple: boolean;
  onNext: () => void;
  onPrev: () => void;
}

export const ImageViewer = ({
  isOpen,
  onClose,
  images,
  currentIndex,
  hasMultiple,
  onNext,
  onPrev,
}: ImageViewerProps) => {
  const t = useTranslations();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistRef = useRef<number | null>(null);
  const lastTapRef = useRef(0);
  const [downloading, setDownloading] = useState(false);

  const currentImage = images[currentIndex];

  // Reset zoom/pan when image changes or viewer closes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex, isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && hasMultiple) onNext();
      if (e.key === "ArrowLeft" && hasMultiple) onPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, hasMultiple, onNext, onPrev, onClose]);

  const handleDownload = async () => {
    if (!currentImage || downloading) return;
    setDownloading(true);
    const url = currentImage.downloadUrl ?? currentImage.url;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = currentImage.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch (err) {
      console.error("Download failed", err);
      try {
        window.open(url, "_blank");
      } catch {
        toast.error(t.imageViewer.downloadError);
      }
    } finally {
      setDownloading(false);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoom > 1) {
      setIsPanning(true);
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    }
    // Double tap / double click to toggle zoom
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setZoom((z) => (z === 1 ? 2 : 1));
      setPan({ x: 0, y: 0 });
    }
    lastTapRef.current = now;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning || !lastPointerRef.current) return;
    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    lastPointerRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(1, Math.min(4, z + delta)));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / lastPinchDistRef.current;
      setZoom((z) => Math.max(1, Math.min(4, z * scale)));
      lastPinchDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    lastPinchDistRef.current = null;
  };

  if (!currentImage) return null;

  const counterText = t.imageViewer.counter
    .replace("{current}", String(currentIndex + 1))
    .replace("{total}", String(images.length));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[100vw] w-screen h-[100dvh] sm:max-w-[95vw] sm:h-[95vh] p-0 gap-0 border-0 bg-background/95 backdrop-blur-sm overflow-hidden [&>button]:hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-background/70 backdrop-blur-sm border-b">
          <div className="min-w-0 flex-1 mr-2">
            <p className="text-sm font-medium truncate">{currentImage.filename}</p>
            {hasMultiple && (
              <p className="text-xs text-muted-foreground">{counterText}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              disabled={downloading}
              aria-label={t.imageViewer.download}
              title={t.imageViewer.download}
            >
              <Download className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t.imageViewer.close}
              title={t.imageViewer.close}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Image area */}
        <div
          className="w-full h-full flex items-center justify-center overflow-hidden touch-none select-none"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={currentImage.url}
            alt={currentImage.filename}
            className="max-w-full max-h-full object-contain transition-transform"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default",
              transitionDuration: isPanning ? "0ms" : "200ms",
            }}
            draggable={false}
          />
        </div>

        {/* Navigation buttons */}
        {hasMultiple && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onPrev();
              }}
              aria-label={t.imageViewer.prev}
              style={{ touchAction: "manipulation" }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-14 w-14 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-md border border-white/40 text-white shadow-lg transition-all"
            >
              <ChevronLeft className="h-7 w-7" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onNext();
              }}
              aria-label={t.imageViewer.next}
              style={{ touchAction: "manipulation" }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-14 w-14 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-md border border-white/40 text-white shadow-lg transition-all"
            >
              <ChevronRight className="h-7 w-7" />
            </Button>

            {/* Dots indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 bg-black/40 rounded-full px-3 py-1.5 pointer-events-none">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    i === currentIndex ? "bg-white w-6" : "bg-white/50 w-2"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
