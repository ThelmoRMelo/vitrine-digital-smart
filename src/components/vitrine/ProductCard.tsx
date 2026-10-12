import { Check, Share2, ArrowRight, Images, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ProductRatingSummary } from '@/components/reviews/ProductRatingSummary';
import { ReviewsSummaryModal } from '@/components/reviews/ReviewsSummaryModal';
import { trackProductClick } from '@/hooks/useProductClickMetrics';
import type { ThemeConfig } from '@/lib/themes';

interface Product {
  id: string;
  name: string;
  price: number;
  short_description: string | null;
  image_url: string | null;
  category: string | null;
  long_description?: string | null;
  has_gallery?: boolean;
  payment_link?: string | null;
  tenant_id?: string | null;
}

interface ProductCardProps {
  product: Product;
  theme: ThemeConfig;
  variant?: 'featured' | 'standard' | 'compact';
  onProductClick: (productId: string) => void;
  showBestSeller?: boolean;
  imageFit?: 'cover' | 'contain';
}

export function ProductCard({
  product,
  theme,
  variant = 'standard',
  onProductClick,
  showBestSeller = false,
  imageFit = 'cover',
}: ProductCardProps) {
  const formatPrice = (price: number) =>
    price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const hasPaymentLink = !!product.payment_link && product.payment_link.trim().length > 0;

  const handleSaberMais = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackProductClick(product.id, 'saber_mais', product.tenant_id ?? null);
    onProductClick(product.id);
  };

  const handleAdquirir = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.payment_link) return;
    trackProductClick(product.id, 'adquirir', product.tenant_id ?? null);
    window.open(product.payment_link, '_blank', 'noopener,noreferrer');
  };

  const handleCardClick = () => {
    trackProductClick(product.id, 'saber_mais', product.tenant_id ?? null);
    onProductClick(product.id);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Mesmo link de preview usado em "Meus Produtos" (Edge Function com Open Graph)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const shareUrl = `${supabaseUrl}/functions/v1/preview/${product.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: product.short_description || `Confira: ${product.name}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copiado!');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copiado!');
      }
    }
  };

  const benefits = product.short_description?.split('\n').filter((l) => l.trim()) || [];

  const ActionButtons = ({ size = 'default' as 'default' | 'lg' | 'sm' }) => (
    <div className="flex flex-col sm:flex-row gap-2 w-full">
      <Button
        size={size}
        variant={hasPaymentLink ? 'outline' : 'default'}
        className={
          hasPaymentLink
            ? 'flex-1 border-primary/40 hover:bg-primary/10 hover:border-primary'
            : 'flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold'
        }
        onClick={handleSaberMais}
      >
        Quero saber mais
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>

      {hasPaymentLink && (
        <Button
          size={size}
          className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-primary-foreground font-semibold shadow-glow"
          onClick={handleAdquirir}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Adquirir Agora
        </Button>
      )}
    </div>
  );

  if (variant === 'featured') {
    return (
      <div className="group relative glass-card rounded-3xl overflow-hidden transition-all duration-500 hover:shadow-glow">
        <div className="grid md:grid-cols-2 gap-0">

          {/* Content */}
          <div className="p-6 md:p-8 flex flex-col justify-center order-2 md:order-1">
            {showBestSeller && (
              <span className="inline-flex items-center w-fit bg-primary/20 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-4">
                Mais vendido
              </span>
            )}

            <h3
              className="text-2xl md:text-3xl font-bold mb-2 cursor-pointer hover:text-primary transition-colors"
              style={{ fontFamily: `'${theme.fonts.heading}', sans-serif` }}
              onClick={handleCardClick}
            >
              {product.name}
            </h3>

            <ProductRatingSummary productId={product.id} className="mb-4" />

            {product.long_description && (
              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                {product.long_description}
              </p>
            )}

            {/* Benefits */}
            {benefits.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-6">
                {benefits.slice(0, 6).map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span className="line-clamp-1">
                      {b.replace(/^[-•✓✨]/g, '').trim()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Avaliações compactas - acima dos botões */}
            <div className="mb-6">
              <ReviewsSummaryModal
                productId={product.id}
                tenantId={product.tenant_id ?? null}
              />
            </div>

            <div className="flex items-center gap-3 mt-auto">
              <div className="flex-1">
                <ActionButtons size="lg" />
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="text-muted-foreground hover:text-primary shrink-0"
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Image */}
          <div
            className="relative h-64 md:h-full min-h-[300px] order-1 md:order-2 cursor-pointer"
            onClick={handleCardClick}
          >
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <span className="text-4xl opacity-50">📦</span>
              </div>
            )}

            <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-full font-bold text-lg shadow-lg">
              {formatPrice(product.price)}
            </div>

            {product.has_gallery && (
              <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
                <Images className="w-3.5 h-3.5" />
                Ver galeria
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-card/80 via-transparent to-transparent md:block hidden" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className="group glass-card rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-glow"
        onClick={handleCardClick}
      >
        <div className="flex gap-4 p-4">
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <span className="text-xl opacity-50">📦</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4
              className="font-bold text-sm group-hover:text-primary transition-colors line-clamp-1"
              style={{ fontFamily: `'${theme.fonts.heading}', sans-serif` }}
            >
              {product.name}
            </h4>

            <ProductRatingSummary productId={product.id} className="mt-0.5" />

            <span className="text-sm font-bold text-primary block mt-1">
              {formatPrice(product.price)}
            </span>
          </div>

          <div className="flex flex-col items-end justify-between shrink-0 gap-1">
            {hasPaymentLink && (
              <Button
                size="sm"
                className="bg-gradient-to-r from-primary to-secondary text-primary-foreground text-xs h-8"
                onClick={handleAdquirir}
              >
                <ShoppingCart className="w-3 h-3 mr-1" />
                Adquirir
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7"
              onClick={handleShare}
            >
              <Share2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // standard
  return (
    <div className="group glass-card rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-glow flex flex-col">
      
      {/* Product Image */}
<div
  className={`relative aspect-[4/3] w-full overflow-hidden cursor-pointer ${
    imageFit === 'contain' ? 'bg-muted/40' : ''
  }`}
  onClick={handleCardClick}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className={`w-full h-full transition-transform duration-500 ${
              imageFit === 'contain'
                ? 'object-contain object-center p-0 scale-[1.05] group-hover:scale-[1.08]'
                : 'object-cover group-hover:scale-110'
            }`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <span className="text-4xl opacity-50">📦</span>
          </div>
        )}

        <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-3 py-1.5 rounded-full font-bold text-sm shadow-lg">
          {formatPrice(product.price)}
        </div>

        {product.has_gallery && (
          <div className="absolute bottom-3 right-3 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
            <Images className="w-3 h-3" />
            +fotos
          </div>
        )}

        <Button
          variant="secondary"
          size="icon"
          className="absolute top-3 left-3 w-8 h-8 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleShare}
        >
          <Share2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Product Information */}
      <div className="p-5 flex-1 flex flex-col">
        <h4
          className="font-bold text-lg mb-1 cursor-pointer hover:text-primary transition-colors line-clamp-2"
          style={{ fontFamily: `'${theme.fonts.heading}', sans-serif` }}
          onClick={handleCardClick}
        >
          {product.name}
        </h4>

        <ProductRatingSummary productId={product.id} className="mb-2" />

        {benefits.length > 0 && (
          <div className="space-y-1 mb-4">
            {benefits.slice(0, 3).map((b, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Check className="w-4 h-4 text-primary shrink-0" />
                <span className="line-clamp-1">
                  {b.replace(/^[-•✓✨]/g, '').trim()}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto">
          <ActionButtons />
        </div>
      </div>
    </div>
  );
}
