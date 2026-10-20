// ProductGalleryViewer.tsx - Galeria de imagens com swipe (mobile-first)
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, Film } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getYouTubeEmbedUrl, type ProductGalleryMedia } from '@/lib/product-media';

interface ProductGalleryViewerProps {
  coverImage: string | null;
  galleryMedia: ProductGalleryMedia[];
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIndex?: number;
}

export function ProductGalleryViewer({
  coverImage,
  galleryMedia,
  productName,
  open,
  onOpenChange,
  initialIndex = 0,
}: ProductGalleryViewerProps) {
  const allMedia: ProductGalleryMedia[] = [
    ...(coverImage ? [{ url: coverImage, mediaType: 'image' as const }] : []),
    ...galleryMedia,
  ];
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    setVideoError(false);
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, [currentIndex, open]);

  // Reset to initial index when opening
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  // Min swipe distance
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && currentIndex < allMedia.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < allMedia.length) {
      setCurrentIndex(index);
    }
  }, [allMedia.length]);

  const goNext = () => goTo(currentIndex + 1);
  const goPrev = () => goTo(currentIndex - 1);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'Escape') onOpenChange(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentIndex, goTo, onOpenChange]);

  if (allMedia.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-labelledby="product-gallery-dialog-title" className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
        <h2 id="product-gallery-dialog-title" className="sr-only">Galeria de imagens e vídeos - {productName}</h2>

        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Image counter */}
        <div className="absolute top-4 left-4 z-50 px-3 py-1.5 bg-black/50 rounded-full text-white text-sm font-medium">
          {currentIndex + 1} / {allMedia.length}
        </div>

        {/* Main image container */}
        <div
          ref={containerRef}
          className="relative w-full h-[80vh] flex items-center justify-center"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Navigation arrows - desktop */}
          {currentIndex > 0 && (
            <button
              onClick={goPrev}
              className="absolute left-4 z-40 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors hidden sm:block"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {currentIndex < allMedia.length - 1 && (
            <button
              onClick={goNext}
              className="absolute right-4 z-40 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors hidden sm:block"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          {allMedia[currentIndex]?.mediaType === 'youtube' ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4">
              {getYouTubeEmbedUrl(allMedia[currentIndex].url) ? (
                <iframe
                  src={getYouTubeEmbedUrl(allMedia[currentIndex].url) ?? undefined}
                  title={`${productName} - vídeo do YouTube ${currentIndex + 1}`}
                  className="aspect-video w-full max-w-5xl rounded-lg bg-black"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  loading="lazy"
                />
              ) : (
                <p className="max-w-md text-center text-sm text-white">Este link do YouTube não é válido.</p>
              )}
              <p className="max-w-2xl text-center text-xs text-white/70">O vídeo é reproduzido aqui na galeria. Se o YouTube informar que está indisponível, ele pode ter sido removido, estar privado ou não permitir incorporação.</p>
            </div>
          ) : allMedia[currentIndex]?.mediaType === 'video_upload' ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4">
              {videoError ? (
                <p className="max-w-md text-center text-sm text-white">Não foi possível reproduzir este vídeo. Verifique o formato e o endereço do arquivo.</p>
              ) : (
                <video
                  key={allMedia[currentIndex].url}
                  ref={videoRef}
                  src={allMedia[currentIndex].url}
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setVideoError(true)}
                  className="max-h-full max-w-full"
                  aria-label={`${productName} - vídeo demonstrativo ${currentIndex + 1}`}
                />
              )}
            </div>
          ) : (
            <img
              src={allMedia[currentIndex]?.url}
              alt={`${productName} - Imagem ${currentIndex + 1}`}
              className="max-h-full max-w-full select-none object-contain"
              draggable={false}
            />
          )}
        </div>

        {/* Thumbnails */}
        {allMedia.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/50 rounded-full">
            {allMedia.map((item, index) => (
              <button
                key={index}
                onClick={() => goTo(index)}
                className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                  index === currentIndex 
                    ? 'border-white scale-110' 
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                {item.mediaType !== 'image' ? (
                  <span className="flex h-full w-full items-center justify-center bg-muted text-white" aria-label={`${item.mediaType === 'youtube' ? 'YouTube' : 'Vídeo'} ${index + 1}`}><Film className="h-5 w-5" /></span>
                ) : (
                  <img src={item.url} alt={`Thumbnail ${index + 1}`} className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Swipe hint - mobile only */}
        {allMedia.length > 1 && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/50 text-xs sm:hidden">
            Deslize para navegar
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Mini gallery preview for product cards
interface ProductGalleryPreviewProps {
  coverImage: string | null;
  galleryMedia: ProductGalleryMedia[];
  productName: string;
  onOpenGallery: (index: number) => void;
}

export function ProductGalleryPreview({
  coverImage,
  galleryMedia,
  productName,
  onOpenGallery,
}: ProductGalleryPreviewProps) {
  const allMedia: ProductGalleryMedia[] = [
    ...(coverImage ? [{ url: coverImage, mediaType: 'image' as const }] : []),
    ...galleryMedia,
  ];
  const hasGallery = allMedia.length > 1;
  const primaryMedia = allMedia[0];

  if (!primaryMedia) return null;

  return (
    <div className="relative">
      {/* Main cover image */}
      <button
        onClick={() => onOpenGallery(0)}
        className="w-full aspect-video rounded-xl overflow-hidden bg-muted relative group"
      >
        {primaryMedia.mediaType !== 'image' ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground"><Film className="h-8 w-8" /><span className="text-xs">{primaryMedia.mediaType === 'youtube' ? 'Vídeo do YouTube' : 'Vídeo demonstrativo'}</span></div>
        ) : (
          <img src={primaryMedia.url} alt={productName} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        )}
        
        {/* Zoom hint */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-black/50 rounded-full">
            <ZoomIn className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Gallery indicator */}
        {hasGallery && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded-full text-white text-xs font-medium flex items-center gap-1">
            <ZoomIn className="w-3 h-3" />
            +{allMedia.length - 1}
          </div>
        )}
      </button>

      {/* Gallery thumbnails preview */}
      {hasGallery && (
        <div className="flex gap-1 mt-2">
          {allMedia.slice(1, 5).map((item, index) => (
            <button
              key={index}
              onClick={() => onOpenGallery(index + 1)}
              className="flex-1 aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-80 transition-opacity relative"
            >
                {item.mediaType !== 'image' ? (
                  <span className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground"><Film className="h-5 w-5" /></span>
                ) : (
                  <img src={item.url} alt={`${productName} - mídia ${index + 2}`} className="h-full w-full object-cover" />
                )}
              {index === 3 && allMedia.length > 5 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-medium">
                  +{allMedia.length - 5}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
