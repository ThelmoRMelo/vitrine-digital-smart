import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ShoppingBag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { themes, getThemeForCategory, type ThemeConfig } from '@/lib/themes';
import { usePWABlocker } from '@/hooks/usePWABlocker';
import { useNiches } from '@/hooks/useNiches';

// Vitrine components
import { VitrineHeader } from '@/components/vitrine/VitrineHeader';
import { VitrineHero } from '@/components/vitrine/VitrineHero';
import { ProductSection } from '@/components/vitrine/ProductSection';
import { ThemeShowcase } from '@/components/vitrine/ThemeShowcase';
import { VitrineFooter } from '@/components/vitrine/VitrineFooter';

interface Product {
  id: string;
  name: string;
  price: number;
  short_description: string | null;
  long_description: string | null;
  image_url: string | null;
  category: string | null;
  payment_link: string | null;
  tenant_id: string | null;
  has_gallery: boolean;
  is_featured: boolean;
  is_hero: boolean;
  show_on_products: boolean;
  niche_id: string | null;
}


interface StorefrontData {
  id: string;
  slug: string;
  tenant_id: string;
}

interface BusinessConfig {
  business_name: string | null;
  business_category: string | null;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  footer_text?: string | null;
  hero_banner_url?: string | null;
  assistant_image_url?: string | null;
  hero_title_size?: number | null;
  hero_subtitle_size?: number | null;
  assistant_position_axis?: 'horizontal' | 'vertical' | null;
  assistant_position_value?: number | null;
  assistant_size?: number | null;
  show_assistant_bubble?: boolean | null;
  assistant_bubble_text?: string | null;
  hero_button_text?: string | null;
  hero_button_glow?: number | null;
  hero_button_radius?: number | null;
  primary_color?: string | null;
  title_color?: string | null;
  text_color?: string | null;
  button_color?: string | null;
  accent_color?: string | null;
}

export default function Vitrine() {
  // Block PWA install prompts on this public route
  usePWABlocker();
  
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { niches, loading: nichesLoading } = useNiches();
  const selectedNicheSlug = searchParams.get('nicho');
  
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [storefront, setStorefront] = useState<StorefrontData | null>(null);
  const [business, setBusiness] = useState<BusinessConfig | null>(null);
  const [theme, setTheme] = useState<ThemeConfig>(themes.default);

  useEffect(() => {
    loadStorefront();
  }, [slug]);

  const loadStorefront = async () => {
    setLoading(true);
    
    try {
      let currentTenantId: string | null = null;
      
      if (slug) {
        const { data: storefrontData, error: sfError } = await supabase
          .from('storefronts')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .single();
        
        if (sfError || !storefrontData) {
          console.error('Vitrine não encontrada');
          setLoading(false);
          return;
        }
        
        setStorefront(storefrontData);
        currentTenantId = storefrontData.tenant_id;
      }

      // Fetch business config
      if (currentTenantId) {
        const { data: configData } = await supabase
          .from('business_config')
          .select('*')
          .eq('tenant_id', currentTenantId)
          .single();
        if (configData) {
          setBusiness(configData as BusinessConfig);
          const themeId = getThemeForCategory(configData.business_category || '');
          setTheme(themes[themeId]);
        }
      } else {
        const { data: configData } = await supabase
          .from('business_config')
          .select('*')
          .limit(1)
          .single();
        if (configData) {
          setBusiness(configData as BusinessConfig);
          const themeId = getThemeForCategory(configData.business_category || '');
          setTheme(themes[themeId]);
        }
      }

      // Fetch active products
      let productsQuery = supabase
        .from('products')
        .select('id, name, price, short_description, long_description, image_url, category, payment_link, tenant_id, has_gallery, is_featured, is_hero, show_on_products, niche_id')
        .eq('active', true)
        .order('created_at', { ascending: false });
      
      if (currentTenantId) {
        productsQuery = productsQuery.eq('tenant_id', currentTenantId);
      }

      const { data: productsData } = await productsQuery;
      setProducts(productsData || []);
      
    } catch (error) {
      console.error('Erro ao carregar vitrine:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (productId: string) => {
    if (slug) {
      navigate(`/loja/${slug}/chat/${productId}`);
    } else {
      navigate(`/chat/${productId}`);
    }
  };

  const chatPath = slug ? `/loja/${slug}/chat` : '/chat';
  const businessName = business?.business_name || 'Minha Loja';

  // Group products by category
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    
    products.forEach(product => {
      const category = product.category || 'Outros';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(product);
    });
    
    return grouped;
  }, [products]);

  // Nicho selecionado via URL (?nicho=slug)
  const selectedNiche = useMemo(
    () => niches.find(n => n.slug === selectedNicheSlug && n.show_on_landing) ?? null,
    [niches, selectedNicheSlug]
  );

  const handleSelectNiche = (nicheSlug: string) => {
    const next = new URLSearchParams(searchParams);
    if (selectedNicheSlug === nicheSlug) {
      next.delete('nicho');
    } else {
      next.set('nicho', nicheSlug);
    }
    setSearchParams(next, { replace: false });
  };

  const clearNiche = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('nicho');
    setSearchParams(next, { replace: false });
  };

  // Produtos visíveis, já respeitando o nicho selecionado
  const visibleProducts = useMemo(() => {
    if (!selectedNiche) return products;
    return products.filter(p => p.niche_id === selectedNiche.id);
  }, [products, selectedNiche]);

  // Featured products (Destaques) — independent from "Nossos Produtos"
  // Hero product (is_hero) is placed first; fallback to first featured when none is set.
  const heroProducts = useMemo(
    () => visibleProducts.filter(p => p.is_hero && p.is_featured).slice(0, 105),
    [visibleProducts]
  );

  const featuredProducts = useMemo(
    () => visibleProducts.filter(p => p.is_featured && !heroProducts.some(h => h.id === p.id)),
    [visibleProducts, heroProducts]
  );

  // Nossos Produtos — controlled independently via show_on_products
  const showcaseProducts = useMemo(
    () => visibleProducts.filter(p => p.show_on_products),
    [visibleProducts]
  );



  // Apply theme dynamically
  useEffect(() => {
    if (theme.fonts.googleImport) {
      const link = document.createElement('link');
      link.href = theme.fonts.googleImport;
      link.rel = 'stylesheet';
      link.id = 'theme-font';
      
      const existingLink = document.getElementById('theme-font');
      if (existingLink) {
        existingLink.remove();
      }
      document.head.appendChild(link);
    }

    const root = document.documentElement;
    root.style.setProperty('--primary', theme.colors.primary);
    root.style.setProperty('--secondary', theme.colors.secondary);
    root.style.setProperty('--accent', theme.colors.accent);
    root.style.setProperty('--background', theme.colors.background);
    root.style.setProperty('--card', theme.colors.card);
    root.style.setProperty('--muted', theme.colors.muted);
    root.style.setProperty('--border', theme.colors.border);

    return () => {
      const defaultTheme = themes.default;
      root.style.setProperty('--primary', defaultTheme.colors.primary);
      root.style.setProperty('--secondary', defaultTheme.colors.secondary);
      root.style.setProperty('--accent', defaultTheme.colors.accent);
      root.style.setProperty('--background', defaultTheme.colors.background);
      root.style.setProperty('--card', defaultTheme.colors.card);
      root.style.setProperty('--muted', defaultTheme.colors.muted);
      root.style.setProperty('--border', defaultTheme.colors.border);
    };
  }, [theme]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `var(--gradient-primary)` }}>
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <VitrineHeader 
        businessName={businessName} 
        theme={theme} 
        chatPath={chatPath} 
      />

      <VitrineHero 
        businessName={businessName} 
        theme={theme} 
        chatPath={chatPath}
        heroTitle={business?.hero_title}
        heroSubtitle={business?.hero_subtitle}
        bannerUrl={business?.hero_banner_url}
        assistantImageUrl={business?.assistant_image_url}
        heroTitleSize={business?.hero_title_size}
        heroSubtitleSize={business?.hero_subtitle_size}
        assistantPositionAxis={business?.assistant_position_axis}
        assistantPositionValue={business?.assistant_position_value}
        assistantSize={business?.assistant_size}
        showAssistantBubble={business?.show_assistant_bubble}
        assistantBubbleText={business?.assistant_bubble_text}
        heroButtonText={business?.hero_button_text}
        heroButtonGlow={business?.hero_button_glow}
        heroButtonRadius={business?.hero_button_radius}
        primaryColor={business?.primary_color}
        titleColor={business?.title_color}
        textColor={business?.text_color}
        buttonColor={business?.button_color}
        accentColor={business?.accent_color}
      />

      <main className="max-w-7xl mx-auto px-4">
        {/* Indicador do nicho selecionado */}
        {selectedNiche && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-8">
            <div>
              <p className="text-sm text-muted-foreground">Nicho selecionado</p>
              <h2
                className="text-2xl md:text-3xl font-bold"
                style={{ fontFamily: `'${theme.fonts.heading}', sans-serif` }}
              >
                {selectedNiche.name}
              </h2>
            </div>
            <Button variant="outline" onClick={clearNiche} className="rounded-full">
              <X className="w-4 h-4 mr-1" />
              Ver todos os produtos
            </Button>
          </div>
        )}

        {visibleProducts.length === 0 ? (
          <div className="py-20 text-center">
            <div className="glass-card rounded-3xl p-12 max-w-md mx-auto">
              <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {selectedNiche
                  ? 'Ainda não temos produtos disponíveis neste nicho.'
                  : 'Nenhum produto disponível'}
              </h3>
              <p className="text-muted-foreground mb-4">Em breve teremos novidades!</p>
              {selectedNiche && (
                <Button variant="outline" onClick={clearNiche} className="rounded-full">
                  Ver todos os produtos
                </Button>
              )}
            </div>
          </div>
        ) : selectedNiche ? (
          /* Visão de nicho: todos os produtos do nicho, independente dos selos */
          <ProductSection
            title={selectedNiche.name}
            products={visibleProducts}
            theme={theme}
            onProductClick={handleProductClick}
            layout="grid"
            showViewAll={false}
          />
        ) : (
          <>
            {/* Destaques — controlado por is_featured */}
            {(featuredProducts.length > 0 || heroProducts.length > 0) && (
              <ProductSection
                title="Destaques"
                products={featuredProducts}
                heroProducts={heroProducts}
                theme={theme}
                onProductClick={handleProductClick}
                layout="featured"
              />
            )}

            {/* Nossos Produtos — controlado por show_on_products */}
            {showcaseProducts.length > 0 && (
              <ProductSection
                title="Nossos Produtos"
                products={showcaseProducts}
                theme={theme}
                onProductClick={handleProductClick}
                layout="grid"
              />
            )}
          </>
        )}


        {/* Theme showcase */}
        <ThemeShowcase
          theme={theme}
          chatPath={chatPath}
          niches={niches}
          nichesLoading={nichesLoading}
          onClearNiche={clearNiche}
          selectedNicheSlug={selectedNicheSlug}
          onSelectNiche={handleSelectNiche}
        />
      </main>

      <VitrineFooter footerText={business?.footer_text} />
    </div>
  );
}
