// useProducts.ts - Hook para CRUD de produtos no Supabase
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';

// Tipo do produto no Supabase (snake_case)
export interface SupabaseProduct {
  id: string;
  name: string;
  price: number;
  category: string | null;
  niche_id: string | null;
  short_description: string | null;
  long_description: string | null;
  technical_details: string | null;
  min_price_allowed: number | null;
  payment_methods: string[] | null;
  delivery_info: string | null;
  image_url: string | null;
  payment_link: string | null;
  active: boolean;
  has_gallery: boolean;
  is_featured: boolean;
  is_hero: boolean;
  show_on_products: boolean;
  source_platform: string | null;
  external_product_id: string | null;
  source_url: string | null;
  affiliate_url: string | null;
  imported_at: string | null;
  tenant_id: string | null;
  last_synced_at?: string | null;
  created_at: string;
  updated_at: string;
}

// Tipo do produto na UI (camelCase - mantém compatibilidade)
export interface Product {
  id: string;
  nome: string;
  preco: number;
  categoria: string;
  nicheId: string | null;
  descricaoCurta: string;
  descricaoDetalhada: string;
  informacoesTecnicas: string;
  importReport: import('./useProductImport').ImportReport | null;
  precoMinimoPermitido: number | null;
  formasPagamento: string[];
  infoEntrega: string;
  imagemUrl: string;
  linkPagamento: string;
  ativo: boolean;
  hasGallery: boolean;
  isFeatured: boolean;
  isHero: boolean;
  showOnProducts: boolean;
  sourcePlatform?: string | null;
  externalProductId?: string | null;
  sourceUrl?: string | null;
  affiliateUrl?: string | null;
  importedAt?: string | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  // Legado (compatibilidade)
  palavrasChave?: string[];
  descricao?: string;
}

// Converter de Supabase para UI
function toUIProduct(p: SupabaseProduct): Product {
  return {
    id: p.id,
    nome: p.name,
    preco: Number(p.price),
    categoria: p.category || 'Produtos',
    nicheId: p.niche_id ?? null,
    descricaoCurta: p.short_description || '',
    descricaoDetalhada: p.long_description || '',
    informacoesTecnicas: p.technical_details || '',
    importReport: null,
    precoMinimoPermitido: p.min_price_allowed,
    formasPagamento: p.payment_methods || [],
    infoEntrega: p.delivery_info || '',
    imagemUrl: p.image_url || '',
    linkPagamento: p.payment_link || '',
    ativo: p.active,
    hasGallery: p.has_gallery || false,
    isFeatured: p.is_featured ?? false,
    isHero: p.is_hero ?? false,
    showOnProducts: p.show_on_products ?? true,
    sourcePlatform: p.source_platform ?? null,
    externalProductId: p.external_product_id ?? null,
    sourceUrl: p.source_url ?? null,
    affiliateUrl: p.affiliate_url ?? null,
    importedAt: p.imported_at ?? null,
    lastSyncedAt: p.last_synced_at ?? null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    // Legado
    palavrasChave: [],
    descricao: p.short_description || '',
  };
}

// Converter de UI para Supabase (insert/update)
function toSupabaseProduct(p: Partial<Product>): Partial<SupabaseProduct> {
  const result: Partial<SupabaseProduct> = {};
  
  if (p.nome !== undefined) result.name = p.nome;
  if (p.preco !== undefined) result.price = Number(p.preco);
  if (p.categoria !== undefined) result.category = p.categoria;
  if (p.nicheId !== undefined) result.niche_id = p.nicheId || null;
  if (p.descricaoCurta !== undefined) result.short_description = p.descricaoCurta;
  if (p.descricaoDetalhada !== undefined) result.long_description = p.descricaoDetalhada;
  if (p.informacoesTecnicas !== undefined) result.technical_details = p.informacoesTecnicas;
  if (p.precoMinimoPermitido !== undefined) result.min_price_allowed = p.precoMinimoPermitido;
  if (p.formasPagamento !== undefined) result.payment_methods = p.formasPagamento;
  if (p.infoEntrega !== undefined) result.delivery_info = p.infoEntrega;
  if (p.imagemUrl !== undefined) result.image_url = p.imagemUrl;
  if (p.linkPagamento !== undefined) result.payment_link = p.linkPagamento;
  if (p.ativo !== undefined) result.active = p.ativo;
  if (p.hasGallery !== undefined) result.has_gallery = p.hasGallery;
  if (p.isFeatured !== undefined) result.is_featured = p.isFeatured;
  if (p.isHero !== undefined) result.is_hero = p.isHero;
  if (p.showOnProducts !== undefined) result.show_on_products = p.showOnProducts;
  if (p.sourcePlatform !== undefined) result.source_platform = p.sourcePlatform;
  if (p.externalProductId !== undefined) result.external_product_id = p.externalProductId;
  if (p.sourceUrl !== undefined) result.source_url = p.sourceUrl;
  if (p.affiliateUrl !== undefined) result.affiliate_url = p.affiliateUrl;
  if (p.importedAt !== undefined) result.imported_at = p.importedAt;

  return result;
}

// Plataformas com sincronização de preço implementada no backend
export const SYNCABLE_PLATFORMS = ['mercado_livre'];

export interface SyncSummary {
  analyzed: number;
  updated: { name: string; oldPrice: number; newPrice: number }[];
  unchanged: number;
  failed: { name: string; reason: string }[];
  notSyncable: number;
}

export const MAX_HERO_PRODUCTS = 105;

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar todos os produtos
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProducts([]);
        return;
      }
      
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[useProducts] Erro ao buscar:', fetchError);
        setError(fetchError.message);
        return;
      }

      const reportResult = data?.length
        ? await supabase.from('product_import_reports').select('product_id, report').in('product_id', data.map((product) => product.id))
        : { data: [], error: null };
      if (reportResult.error) console.error('[useProducts] Erro ao buscar relatórios:', reportResult.error);
      const reports = new Map((reportResult.data ?? []).map((row) => [row.product_id, row.report as unknown as import('./useProductImport').ImportReport]));
      const uiProducts = (data || []).map((row) => ({ ...toUIProduct(row), importReport: reports.get(row.id) ?? null }));
      setProducts(uiProducts);
    } catch (err) {
      console.error('[useProducts] Erro inesperado:', err);
      setError('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar ao montar
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Realtime subscription
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      channel = supabase
        .channel(`products-realtime-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
          console.log('[useProducts] Realtime:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            const row = payload.new as SupabaseProduct;
            if (row.tenant_id === user.id) setProducts(prev => [toUIProduct(row), ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as SupabaseProduct;
            if (row.tenant_id !== user.id) {
              setProducts(prev => prev.filter(product => product.id !== row.id));
              return;
            }
            const updated = toUIProduct(row);
            setProducts(prev => prev.map(p => p.id === updated.id ? { ...updated, importReport: p.importReport } : p));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setProducts(prev => prev.filter(p => p.id !== deletedId));
          }
        })
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  // Adicionar produto
  const addProduct = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Entre na sua conta para salvar o produto.');
        return null;
      }
      const insertData = {
        name: product.nome,
        price: Number(product.preco),
        category: product.categoria || null,
        niche_id: product.nicheId || null,
        short_description: product.descricaoCurta || null,
        long_description: product.descricaoDetalhada || null,
        technical_details: product.informacoesTecnicas || null,
        min_price_allowed: product.precoMinimoPermitido || null,
        payment_methods: product.formasPagamento || null,
        delivery_info: product.infoEntrega || null,
        image_url: product.imagemUrl || null,
        payment_link: product.linkPagamento || null,
        active: product.ativo ?? true,
        is_featured: product.isFeatured ?? false,
        is_hero: product.isHero ?? false,
        show_on_products: product.showOnProducts ?? true,
        source_platform: product.sourcePlatform ?? null,
        external_product_id: product.externalProductId ?? null,
        source_url: product.sourceUrl ?? null,
        affiliate_url: product.affiliateUrl ?? null,
        imported_at: product.importedAt ?? null,
        tenant_id: user.id,
      };
      
      const { data, error: insertError } = await supabase
        .from('products')
        .insert([insertData])
        .select()
        .single();

      if (insertError) {
        console.error('[useProducts] Erro ao adicionar:', insertError);
        toast.error('Erro ao salvar produto');
        return null;
      }

      console.log('[useProducts] Produto adicionado:', data);
      return toUIProduct(data);
    } catch (err) {
      console.error('[useProducts] Erro inesperado:', err);
      toast.error('Erro ao salvar produto');
      return null;
    }
  };

  const saveImportReport = async (productId: string, report: import('./useProductImport').ImportReport) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error: saveError } = await supabase.from('product_import_reports').upsert({
      product_id: productId,
      tenant_id: user.id,
      report: JSON.parse(JSON.stringify(report)) as Json,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'product_id' });
    if (saveError) {
      console.error('[useProducts] Erro ao salvar relatório:', saveError);
      return false;
    }
    setProducts((prev) => prev.map((product) => product.id === productId ? { ...product, importReport: report } : product));
    return true;
  };

  // Atualizar produto
  const updateProduct = async (id: string, product: Partial<Product>) => {
    try {
      const supabaseData = toSupabaseProduct(product);
      
      const { data, error: updateError } = await supabase
        .from('products')
        .update(supabaseData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('[useProducts] Erro ao atualizar:', updateError);
        toast.error('Erro ao atualizar produto');
        return null;
      }

      console.log('[useProducts] Produto atualizado:', data);
      return toUIProduct(data);
    } catch (err) {
      console.error('[useProducts] Erro inesperado:', err);
      toast.error('Erro ao atualizar produto');
      return null;
    }
  };

  // Deletar produto
  const deleteProduct = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('[useProducts] Erro ao deletar:', deleteError);
        toast.error('Erro ao remover produto');
        return false;
      }

      console.log('[useProducts] Produto removido:', id);
      return true;
    } catch (err) {
      console.error('[useProducts] Erro inesperado:', err);
      toast.error('Erro ao remover produto');
      return false;
    }
  };

  // Fila por produto para evitar race conditions em cliques rápidos
  const queuesRef = useRef<Map<string, Promise<unknown>>>(new Map());
  const enqueue = useCallback((key: string, task: () => Promise<unknown>) => {
    const prev = queuesRef.current.get(key) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(task);
    queuesRef.current.set(key, next);
    return next;
  }, []);

  // Toggle otimista de flags (destaque / nossos produtos)
  const toggleProductFlags = useCallback(
    (id: string, patch: Partial<Product>) => {
      let snapshot: Product | undefined;
      setProducts((prev) => {
        snapshot = prev.find((p) => p.id === id);
        return prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      });

      return enqueue(id, async () => {
        const supabaseData = toSupabaseProduct(patch);
        const { error: updateError } = await supabase
          .from('products')
          .update(supabaseData)
          .eq('id', id);

        if (updateError) {
          console.error('[useProducts] Erro ao atualizar flag:', updateError);
          if (snapshot) {
            const restore = snapshot;
            setProducts((prev) => prev.map((p) => (p.id === id ? restore : p)));
          }
          toast.error('Não foi possível salvar a alteração');
        }
      });
    },
    [enqueue],
  );

  // Definir produto Hero (até MAX_HERO_PRODUCTS simultâneos)
  const setHeroProduct = async (id: string) => {
    const currentHeroes = products.filter((p) => p.isHero && p.id !== id);
    if (currentHeroes.length >= MAX_HERO_PRODUCTS) {
      toast.error(
        `Limite de ${MAX_HERO_PRODUCTS} produtos Hero atingido. Desative um deles para adicionar outro.`,
      );
      return false;
    }
    await toggleProductFlags(id, { isHero: true, isFeatured: true });
    return true;
  };

  const unsetHeroProduct = async (id: string) => {
    return await toggleProductFlags(id, { isHero: false });
  };


  // Sincronização de preços em lote (somente products.price no backend)
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const syncLockRef = useRef(false);

  const syncProducts = useCallback(async (): Promise<SyncSummary | null> => {
    if (syncLockRef.current) return null;
    syncLockRef.current = true;
    setSyncing(true);
    const summary: SyncSummary = { analyzed: products.length, updated: [], unchanged: 0, failed: [], notSyncable: 0 };
    try {
      const syncable = products.filter(p => p.sourcePlatform && SYNCABLE_PLATFORMS.includes(p.sourcePlatform) && p.externalProductId);
      summary.notSyncable = products.length - syncable.length;
      // Processamento sequencial controlado (evita dezenas de requisições simultâneas)
      for (let i = 0; i < syncable.length; i++) {
        setSyncProgress({ current: i + 1, total: syncable.length });
        const product = syncable[i];
        try {
          const { data, error } = await supabase.functions.invoke('sync-products', { body: { productId: product.id } });
          if (error) throw error;
          if (data?.status === 'updated') summary.updated.push({ name: product.nome, oldPrice: Number(data.oldPrice), newPrice: Number(data.newPrice) });
          else if (data?.status === 'unchanged') summary.unchanged++;
          else if (data?.status === 'skipped') summary.notSyncable++;
          else summary.failed.push({ name: product.nome, reason: data?.reason || 'Erro de consulta' });
        } catch (err) {
          console.error('[useProducts] Erro ao sincronizar', product.id, err);
          summary.failed.push({ name: product.nome, reason: 'Erro de consulta' });
        }
      }
      await fetchProducts();
      return summary;
    } finally {
      syncLockRef.current = false;
      setSyncing(false);
      setSyncProgress(null);
    }
  }, [products, fetchProducts]);

  // Apenas produtos ativos
  const activeProducts = products.filter(p => p.ativo);
  const inactiveProducts = products.filter(p => !p.ativo);

  return {
    products,
    activeProducts,
    inactiveProducts,
    loading,
    error,
    fetchProducts,
    addProduct,
    saveImportReport,
    updateProduct,
    deleteProduct,
    setHeroProduct,
    unsetHeroProduct,
    heroCount: products.filter((p) => p.isHero).length,
    toggleProductFlags,
    syncProducts,
    syncing,
    syncProgress,
  };
}
