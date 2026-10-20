import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCard } from './ProductCard';
import type { ThemeConfig } from '@/lib/themes';

interface HeroProduct {
  id: string;
  name: string;
  price: number;
  short_description: string | null;
  long_description?: string | null;
  image_url: string | null;
  category: string | null;
  payment_link?: string | null;
  tenant_id?: string | null;
  has_gallery?: boolean;
}

interface HeroCarouselProps {
  products: HeroProduct[];
  theme: ThemeConfig;
  onProductClick: (productId: string) => void;
  autoPlayMs?: number;
}

export function HeroCarousel({
  products,
  theme,
  onProductClick,
  autoPlayMs = 4500,
}: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragDelta, setDragDelta] = useState(0);
  const startX = useRef<number | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = products.length;

  // Keep index valid when heroes are added/removed in real time
  useEffect(() => {
    if (index > total - 1) setIndex(0);
  }, [total, index]);

  const goTo = useCallback(
    (next: number) => {
      if (total === 0) return;
      setIndex(((next % total) + total) % total);
    },
    [total],
  );

  const pauseTemporarily = useCallback(() => {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), 6000);
  }, []);

  useEffect(() => {
    if (paused || total < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), autoPlayMs);
    return () => clearInterval(id);
  }, [paused, total, autoPlayMs, index]);

  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  if (total === 0) return null;

  const onPointerDown = (clientX: number) => {
    startX.current = clientX;
    pauseTemporarily();
  };
  const onPointerMove = (clientX: number) => {
    if (startX.current === null) return;
    setDragDelta(clientX - startX.current);
  };
  const onPointerUp = () => {
    if (startX.current === null) return;
    const delta = dragDelta;
    startX.current = null;
    setDragDelta(0);
    if (Math.abs(delta) > 50) {
      goTo(index + (delta < 0 ? 1 : -1));
    }
  };

  return (
    <div className="relative">
      <div
        className="overflow-hidden"
        onTouchStart={(e) => onPointerDown(e.touches[0].clientX)}
        onTouchMove={(e) => onPointerMove(e.touches[0].clientX)}
        onTouchEnd={onPointerUp}
        onMouseDown={(e) => onPointerDown(e.clientX)}
        onMouseMove={(e) => startX.current !== null && onPointerMove(e.clientX)}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
      >
        <div
          className="flex"
          style={{
            transform: `translateX(calc(-${index * 100}% + ${dragDelta}px))`,
            transition: startX.current === null ? 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          }}
        >
          {products.map((product, i) => (
            <div key={product.id} className="w-full shrink-0 px-0.5">
              <ProductCard
                product={product}
                theme={theme}
                variant="featured"
                onProductClick={onProductClick}
                showBestSeller={i === 0}
              />
            </div>
          ))}
        </div>
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Produto anterior"
            onClick={() => {
              pauseTemporarily();
              goTo(index - 1);
            }}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 items-center justify-center w-10 h-10 rounded-full bg-background/70 backdrop-blur border border-border text-foreground hover:bg-background transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Próximo produto"
            onClick={() => {
              pauseTemporarily();
              goTo(index + 1);
            }}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 items-center justify-center w-10 h-10 rounded-full bg-background/70 backdrop-blur border border-border text-foreground hover:bg-background transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="flex items-center justify-center gap-2 mt-3">
            {products.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={`Ir para o produto ${i + 1}`}
                onClick={() => {
                  pauseTemporarily();
                  goTo(i);
                }}
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: i === index ? 20 : 8,
                  backgroundColor: i === index ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.4)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
