import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Download, Package, Edit2, X, Image, Eye, EyeOff, Upload, Loader2, Share2, Images, Star, Crown, RefreshCw } from 'lucide-react';
import { ProductReviewsDialog } from '@/components/reviews/ProductReviewsDialog';
import { PageHeader } from '@/components/PageHeader';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useProducts, Product, type SyncSummary } from '@/hooks/useProducts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNiches } from '@/hooks/useNiches';
import { useProductImageUpload } from '@/hooks/useProductImageUpload';
import { useProductGallery } from '@/hooks/useProductGallery';
import { ProductGalleryUpload } from '@/components/ProductGalleryUpload';
import { ProductImportPanel } from '@/components/products/ProductImportPanel';
import type { ImportedProductData, ImportedReview } from '@/hooks/useProductImport';
import { toast } from 'sonner';

const categories = [
  'Produtos',
  'Serviços',
  'Combos',
  'Promoções',
  'Outros',
];

type FormMode = 'closed' | 'add' | 'edit';

interface ProductForm {
  nome: string;
  preco: string;
  categoria: string;
  nicheId: string | null;
  descricaoCurta: string;
  descricaoDetalhada: string;
  precoMinimoPermitido: string;
  formasPagamento: string;
  infoEntrega: string;
  imagemUrl: string;
  linkPagamento: string;
  ativo: boolean;
  galleryImages: string[];
  sourcePlatform: string | null;
  externalProductId: string | null;
  sourceUrl: string | null;
  affiliateUrl: string | null;
  importedAt: string | null;
}

const emptyForm: ProductForm = {
  nome: '',
  preco: '',
  categoria: 'Produtos',
  nicheId: null,
  descricaoCurta: '',
  descricaoDetalhada: '',
  precoMinimoPermitido: '',
  formasPagamento: '',
  infoEntrega: '',
  imagemUrl: '',
  linkPagamento: '',
  ativo: true,
  galleryImages: [],
  sourcePlatform: null,
  externalProductId: null,
  sourceUrl: null,
  affiliateUrl: null,
  importedAt: null,
};

type AddMode = 'manual' | 'link';

export default function Products() {
  const { 
    products, 
    activeProducts, 
    inactiveProducts, 
    loading,
    addProduct, 
    updateProduct, 
    deleteProduct,
    setHeroProduct,
    unsetHeroProduct,
    toggleProductFlags,
    syncProducts,
    syncing,
    syncProgress,
  } = useProducts();
  const [syncResult, setSyncResult] = useState<SyncSummary | null>(null);

  const handleSync = async () => {
    try {
      const result = await syncProducts();
      if (result) setSyncResult(result);
    } catch (err) {
      console.error('[Products] Erro na sincronização:', err);
      toast.error('Não foi possível concluir a sincronização');
    }
  };
  
  const { niches } = useNiches();
  const { uploadImage, uploading } = useProductImageUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('manual');
  const [reviewsProduct, setReviewsProduct] = useState<{ id: string; name: string } | null>(null);
  const [importedReviews, setImportedReviews] = useState<ImportedReview[]>([]);

  // Salva as avaliações importadas como PENDENTES, sem duplicar as já existentes
  const saveImportedReviews = async (productId: string): Promise<number> => {
    if (importedReviews.length === 0) return 0;
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: existing } = await supabase
        .from('product_reviews')
        .select('customer_name, comment')
        .eq('product_id', productId);

      const seen = new Set(
        (existing ?? []).map((r: { customer_name: string; comment: string }) =>
          `${r.customer_name.trim().toLowerCase()}|${r.comment.trim().toLowerCase().slice(0, 120)}`,
        ),
      );

      const rows = importedReviews
        .filter((r) => !seen.has(`${r.customerName.trim().toLowerCase()}|${r.comment.trim().toLowerCase().slice(0, 120)}`))
        .slice(0, 5)
        .map((r) => ({
          product_id: productId,
          customer_name: r.customerName.slice(0, 80),
          comment: r.comment.slice(0, 1000),
          stars: Math.max(1, Math.min(5, Math.round(r.stars))),
          status: 'pending',
          is_imported: true,
          source_platform: r.sourcePlatform,
          source_url: r.sourceUrl,
          imported_at: new Date().toISOString(),
        }));

      if (rows.length === 0) return 0;
      const { error } = await supabase.from('product_reviews').insert(rows);
      if (error) throw error;
      return rows.length;
    } catch (err) {
      console.error('Erro ao salvar avaliações importadas:', err);
      toast.error('Não foi possível salvar as avaliações importadas.');
      return 0;
    }
  };

  // Hook para galeria de imagens
  const { images: galleryImages, saveGallery, fetchImages } = useProductGallery(editingId);

  // Carregar imagens da galeria quando editar produto
  useEffect(() => {
    if (formMode === 'edit' && editingId && galleryImages.length > 0) {
      setForm(prev => ({
        ...prev,
        galleryImages: galleryImages.map(img => img.imageUrl),
      }));
    }
  }, [formMode, editingId, galleryImages]);

  const openAddForm = () => {
    setForm(emptyForm);
    setImagePreview('');
    setEditingId(null);
    setAddMode('manual');
    setImportedReviews([]);
    setFormMode('add');
  };

  const openEditForm = (product: Product) => {
    setForm({
      nome: product.nome,
      preco: product.preco.toString().replace('.', ','),
      categoria: product.categoria || 'Produtos',
      nicheId: product.nicheId ?? null,
      descricaoCurta: product.descricaoCurta || '',
      descricaoDetalhada: product.descricaoDetalhada || '',
      precoMinimoPermitido: product.precoMinimoPermitido?.toString().replace('.', ',') || '',
      formasPagamento: product.formasPagamento?.join(', ') || '',
      infoEntrega: product.infoEntrega || '',
      imagemUrl: product.imagemUrl || '',
      linkPagamento: product.linkPagamento || '',
      ativo: product.ativo,
      galleryImages: [], // Será carregado pelo useEffect
      sourcePlatform: product.sourcePlatform ?? null,
      externalProductId: product.externalProductId ?? null,
      sourceUrl: product.sourceUrl ?? null,
      affiliateUrl: product.affiliateUrl ?? null,
      importedAt: product.importedAt ?? null,
    });
    setImagePreview(product.imagemUrl || '');
    setEditingId(product.id);
    setFormMode('edit');
  };

  // Preenche o formulário atual com os dados importados (sem salvar)
  const handleImported = (data: ImportedProductData, affiliateUrl: string) => {
    const matchedCategory = categories.find(
      (c) => data.category && c.toLowerCase() === data.category.toLowerCase(),
    );
    setForm((prev) => ({
      ...prev,
      nome: data.title ?? prev.nome,
      preco: data.price != null ? data.price.toFixed(2).replace('.', ',') : prev.preco,
      categoria: matchedCategory ?? prev.categoria,
      descricaoCurta: data.shortDescription ?? prev.descricaoCurta,
      descricaoDetalhada: data.longDescription ?? prev.descricaoDetalhada,
      imagemUrl: data.coverImage ?? prev.imagemUrl,
      linkPagamento: affiliateUrl || prev.linkPagamento,
      galleryImages: data.galleryImages.length > 0 ? data.galleryImages.slice(0, 5) : prev.galleryImages,
      sourcePlatform: data.platform,
      externalProductId: data.externalId,
      sourceUrl: data.sourceUrl,
      affiliateUrl: affiliateUrl,
      importedAt: new Date().toISOString(),
    }));
    if (data.coverImage) setImagePreview(data.coverImage);
  };

  const closeForm = () => {
    setForm(emptyForm);
    setImagePreview('');
    setEditingId(null);
    setImportedReviews([]);
    setFormMode('closed');
  };

  const handleImageUrlChange = (url: string) => {
    setForm(prev => ({ ...prev, imagemUrl: url }));
    setImagePreview(url);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadImage(file);
    if (url) {
      handleImageUrlChange(url);
      toast.success('Imagem enviada com sucesso!');
    }
    
    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('Preencha o nome do produto');
      return;
    }

    if (!form.preco.trim()) {
      toast.error('Preencha o preço do produto');
      return;
    }

    setSaving(true);

    const precoValue = parseFloat(form.preco.replace(',', '.')) || 0;
    const precoMinimoValue = form.precoMinimoPermitido 
      ? parseFloat(form.precoMinimoPermitido.replace(',', '.')) 
      : null;
    const formasArray = form.formasPagamento.split(',').map(f => f.trim()).filter(f => f);

    const productData = {
      nome: form.nome.trim(),
      preco: precoValue,
      categoria: form.categoria,
      nicheId: form.nicheId,
      descricaoCurta: form.descricaoCurta.trim(),
      descricaoDetalhada: form.descricaoDetalhada.trim(),
      precoMinimoPermitido: precoMinimoValue,
      formasPagamento: formasArray,
      infoEntrega: form.infoEntrega.trim(),
      imagemUrl: form.imagemUrl.trim(),
      linkPagamento: form.linkPagamento.trim(),
      ativo: form.ativo,
      hasGallery: form.galleryImages.length > 0,
      isFeatured: editingId ? (products.find(p => p.id === editingId)?.isFeatured ?? false) : false,
      isHero: editingId ? (products.find(p => p.id === editingId)?.isHero ?? false) : false,
      showOnProducts: editingId ? (products.find(p => p.id === editingId)?.showOnProducts ?? true) : true,
      sourcePlatform: form.sourcePlatform,
      externalProductId: form.externalProductId,
      sourceUrl: form.sourceUrl,
      affiliateUrl: form.affiliateUrl,
      importedAt: form.importedAt,
    };

    try {
      let savedProductId: string | null = null;
      
      if (formMode === 'edit' && editingId) {
        await updateProduct(editingId, productData);
        savedProductId = editingId;
        
        // Salvar galeria de imagens
        if (savedProductId) {
          await saveGallery(form.galleryImages);
        }
        
        toast.success('Produto atualizado!');
      } else {
        const newProduct = await addProduct(productData);
        if (newProduct) {
          savedProductId = newProduct.id;
          
          // Salvar galeria para novo produto (precisamos atualizar o editingId temporariamente)
          if (form.galleryImages.length > 0) {
            // Para novo produto, salvamos direto no banco
            const { supabase } = await import('@/integrations/supabase/client');
            const inserts = form.galleryImages.map((url, index) => ({
              product_id: savedProductId,
              image_url: url,
              display_order: index,
            }));
            await supabase.from('product_images').insert(inserts);
            await supabase.from('products').update({ has_gallery: true }).eq('id', savedProductId);
          }
        }
        toast.success('Produto salvo com sucesso!');
      }

      // Avaliações importadas: salvas como PENDENTES (nunca publicadas automaticamente)
      if (savedProductId && importedReviews.length > 0) {
        const saved = await saveImportedReviews(savedProductId);
        if (saved > 0) {
          toast.success(
            `${saved} ${saved === 1 ? 'avaliação foi importada e está' : 'avaliações foram importadas e estão'} aguardando sua aprovação.`,
          );
        }
      }

      closeForm();
    } catch (err) {
      console.error('Erro ao salvar:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteProduct(id);
    if (success) {
      toast.success('Produto removido');
    }
  };

  const formatPrice = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-24">
        <PageHeader title="Meus Produtos" subtitle="Cadastre seus produtos à venda" />
        <main className="px-6 py-4 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Meus Produtos" subtitle="Cadastre seus produtos à venda" />

      <main className="px-6 py-4 space-y-4 max-w-lg mx-auto">
        {/* Add new product button */}
        {formMode === 'closed' && (
          <Button
            onClick={openAddForm}
            variant="gradient"
            className="w-full"
          >
            <Plus className="w-5 h-5" />
            Adicionar novo produto
          </Button>
        )}

        {/* Sincronizar preços dos produtos importados */}
        {formMode === 'closed' && (
          <Button onClick={handleSync} variant="outline" className="w-full" disabled={syncing}>
            {syncing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sincronizando...{syncProgress ? ` Produto ${syncProgress.current} de ${syncProgress.total}` : ''}
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Sincronizar produtos
              </>
            )}
          </Button>
        )}

        {/* Product Form (Add/Edit) */}
        {formMode !== 'closed' && (
          <div className="glass-card rounded-2xl p-5 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">
                {formMode === 'edit' ? 'Editar produto' : 'Novo produto'}
              </h3>
              <button onClick={closeForm} className="p-2 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Nome */}
            {formMode === 'add' && (
              <>
                <div className="flex gap-2 p-1 bg-muted/50 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAddMode('manual')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                      addMode === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    ✏️ Cadastro manual
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode('link')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                      addMode === 'link' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    🔗 Importar por link
                  </button>
                </div>

                {addMode === 'link' && (
                  <ProductImportPanel
                    onImported={handleImported}
                    onReviewsChange={setImportedReviews}
                    onViewDuplicate={(id) => {
                      const existing = products.find((p) => p.id === id);
                      if (existing) openEditForm(existing);
                    }}
                  />
                )}
              </>
            )}

            {/* Nome */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Nome do produto *
              </label>
              <Input
                value={form.nome}
                onChange={(e) => setForm(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Pizza Margherita"
              />
            </div>

            {/* Preço */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Preço *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                <Input
                  value={form.preco}
                  onChange={(e) => setForm(prev => ({ ...prev, preco: e.target.value }))}
                  placeholder="0,00"
                  className="pl-12"
                  type="text"
                  inputMode="decimal"
                />
              </div>
            </div>

            {/* Preço mínimo para desconto */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Preço mínimo permitido (desconto)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                <Input
                  value={form.precoMinimoPermitido}
                  onChange={(e) => setForm(prev => ({ ...prev, precoMinimoPermitido: e.target.value }))}
                  placeholder="Limite mínimo de desconto"
                  className="pl-12"
                  type="text"
                  inputMode="decimal"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                💰 A IA não oferecerá desconto abaixo desse valor
              </p>
            </div>

            {/* Categoria */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Categoria
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setForm(prev => ({ ...prev, categoria: cat }))}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      form.categoria === cat
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Nicho do produto */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Nicho do produto
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setForm(prev => ({ ...prev, nicheId: null }))}
                  className={`px-3 py-2 rounded-lg text-sm transition-all ${
                    !form.nicheId
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Sem nicho
                </button>
                {niches.map((niche) => (
                  <button
                    key={niche.id}
                    onClick={() => setForm(prev => ({ ...prev, nicheId: niche.id }))}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      form.nicheId === niche.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {niche.name}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                🎯 Usado para filtrar os produtos por nicho na vitrine
              </p>
            </div>

            {/* Descrição curta */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Descrição curta *
              </label>
              <Textarea
                value={form.descricaoCurta}
                onChange={(e) => setForm(prev => ({ ...prev, descricaoCurta: e.target.value }))}
                placeholder="Resumo rápido do produto"
                rows={2}
              />
              <p className="text-xs text-muted-foreground mt-1">
                💡 Resumo rápido do produto
              </p>
            </div>

            {/* Descrição detalhada */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Descrição detalhada (para IA)
              </label>
              <Textarea
                value={form.descricaoDetalhada}
                onChange={(e) => setForm(prev => ({ ...prev, descricaoDetalhada: e.target.value }))}
                placeholder="Explique para que serve o produto, como usar, onde usar e diferenciais..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                🤖 Este texto será usado pela IA para responder clientes
              </p>
            </div>

            {/* Formas de pagamento */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Formas de pagamento
              </label>
              <Input
                value={form.formasPagamento}
                onChange={(e) => setForm(prev => ({ ...prev, formasPagamento: e.target.value }))}
                placeholder="Ex: pix, cartão, boleto"
              />
              <p className="text-xs text-muted-foreground mt-1">Separe por vírgulas</p>
            </div>

            {/* Link de pagamento */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Link de pagamento do produto
              </label>
              <Input
                value={form.linkPagamento}
                onChange={(e) => setForm(prev => ({ ...prev, linkPagamento: e.target.value }))}
                placeholder="https://pagamento.seulink.com/..."
                type="url"
              />
              <p className="text-xs text-muted-foreground mt-1">
                💳 Link de Pix, Mercado Pago, Stripe ou qualquer meio de pagamento
              </p>
            </div>

            {/* Info de entrega */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Informações de entrega
              </label>
              <Textarea
                value={form.infoEntrega}
                onChange={(e) => setForm(prev => ({ ...prev, infoEntrega: e.target.value }))}
                placeholder="Prazos, meios de envio, etc."
                rows={2}
              />
            </div>

            {/* Imagem */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Imagem do produto
              </label>
              <div className="space-y-3">
                {/* Upload de arquivo */}
                <div className="flex gap-2">
                  <Input
                    value={form.imagemUrl}
                    onChange={(e) => handleImageUrlChange(e.target.value)}
                    placeholder="Cole a URL ou faça upload"
                    type="url"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                
                {imagePreview && (
                  <div className="relative rounded-lg overflow-hidden bg-muted/30">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-40 object-cover"
                      onError={() => setImagePreview('')}
                    />
                    <button 
                      onClick={() => handleImageUrlChange('')}
                      className="absolute top-2 right-2 p-1.5 bg-background/80 rounded-full hover:bg-background"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {!imagePreview && (
                  <div className="flex items-center justify-center h-24 rounded-lg border-2 border-dashed border-muted-foreground/30">
                    <div className="text-center text-muted-foreground">
                      <Image className="w-8 h-8 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">Pré-visualização da imagem</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Galeria de imagens adicionais */}
            <ProductGalleryUpload
              images={form.galleryImages}
              onImagesChange={(images) => setForm(prev => ({ ...prev, galleryImages: images }))}
              maxImages={5}
            />

            {/* Produto ativo */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="font-medium text-sm">Produto ativo</p>
                <p className="text-xs text-muted-foreground">
                  Produtos inativos não aparecem para clientes
                </p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, ativo: checked }))}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="glass" onClick={closeForm} className="flex-1" disabled={saving}>
                Cancelar
              </Button>
              <Button variant="gradient" onClick={handleSave} className="flex-1" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  formMode === 'edit' ? 'Atualizar' : 'Salvar produto'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {products.length === 0 && formMode === 'closed' && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum produto cadastrado</p>
            <p className="text-sm text-muted-foreground/70">Adicione produtos para a IA recomendar aos clientes</p>
          </div>
        )}

        {/* Active Products list */}
        {activeProducts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                Produtos ativos
              </h3>
              <span className="text-sm text-muted-foreground">{activeProducts.length} itens</span>
            </div>

            {activeProducts.map((product) => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onEdit={() => openEditForm(product)}
                onDelete={() => handleDelete(product.id)}
                onReviews={() => setReviewsProduct({ id: product.id, name: product.nome })}
                onToggleFeatured={() => toggleProductFlags(product.id, { isFeatured: !product.isFeatured, ...(product.isFeatured && product.isHero ? { isHero: false } : {}) })}
                onToggleShowOnProducts={() => toggleProductFlags(product.id, { showOnProducts: !product.showOnProducts })}
                onToggleHero={() => product.isHero ? unsetHeroProduct(product.id) : setHeroProduct(product.id)}
                formatPrice={formatPrice}
              />
            ))}
          </div>
        )}

        {/* Inactive Products list */}
        {inactiveProducts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2 text-muted-foreground">
                <EyeOff className="w-4 h-4" />
                Produtos inativos
              </h3>
              <span className="text-sm text-muted-foreground">{inactiveProducts.length} itens</span>
            </div>

            {inactiveProducts.map((product) => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onEdit={() => openEditForm(product)}
                onDelete={() => handleDelete(product.id)}
                onReviews={() => setReviewsProduct({ id: product.id, name: product.nome })}
                onToggleFeatured={() => toggleProductFlags(product.id, { isFeatured: !product.isFeatured, ...(product.isFeatured && product.isHero ? { isHero: false } : {}) })}
                onToggleShowOnProducts={() => toggleProductFlags(product.id, { showOnProducts: !product.showOnProducts })}
                onToggleHero={() => product.isHero ? unsetHeroProduct(product.id) : setHeroProduct(product.id)}
                formatPrice={formatPrice}
                inactive
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />

      <ProductReviewsDialog
        productId={reviewsProduct?.id ?? null}
        productName={reviewsProduct?.name}
        open={!!reviewsProduct}
        onOpenChange={(o) => !o && setReviewsProduct(null)}
      />

      <Dialog open={!!syncResult} onOpenChange={(o) => !o && setSyncResult(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>✅ Sincronização concluída!</DialogTitle>
          </DialogHeader>
          {syncResult && (
            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <p className="font-medium">{syncResult.analyzed} produtos analisados</p>
                <p>🟢 {syncResult.updated.length} preços atualizados</p>
                <p>⚪ {syncResult.unchanged} produtos já estavam atualizados</p>
                <p>⚠️ {syncResult.failed.length} produtos não puderam ser sincronizados</p>
                <p className="text-muted-foreground">➖ {syncResult.notSyncable} não sincronizáveis (manuais ou sem integração)</p>
              </div>
              {syncResult.updated.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold">Preço atualizado:</p>
                  {syncResult.updated.map((u, i) => (
                    <div key={i} className="rounded-lg bg-muted/40 p-2">
                      <p className="font-medium line-clamp-2">{u.name}</p>
                      <p className="text-muted-foreground">{formatPrice(u.oldPrice)} → <span className="text-primary font-semibold">{formatPrice(u.newPrice)}</span></p>
                    </div>
                  ))}
                </div>
              )}
              {syncResult.failed.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold">⚠️ Não foi possível sincronizar:</p>
                  {syncResult.failed.map((f, i) => (
                    <div key={i} className="rounded-lg bg-muted/40 p-2">
                      <p className="font-medium line-clamp-2">{f.name}</p>
                      <p className="text-xs text-muted-foreground">Motivo: {f.reason}</p>
                    </div>
                  ))}
                </div>
              )}
              <Button className="w-full" onClick={() => setSyncResult(null)}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Product Card Component
interface ProductCardProps {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onReviews: () => void;
  onToggleFeatured: () => void;
  onToggleShowOnProducts: () => void;
  onToggleHero: () => void;
  formatPrice: (value: number) => string;
  inactive?: boolean;
}

function ProductCard({ product, onEdit, onDelete, onReviews, onToggleFeatured, onToggleShowOnProducts, onToggleHero, formatPrice, inactive }: ProductCardProps) {
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Link de preview (necessário para o WhatsApp gerar o banner com Open Graph)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const shareUrl = `${supabaseUrl}/functions/v1/preview/${product.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copiado!', {
        description: 'Ao abrir, o cliente cai direto no chat deste produto'
      });
    } catch (err) {
      toast.error('Erro ao copiar link');
    }
  };

  return (
    <div className={`glass-card rounded-xl p-4 ${inactive ? 'opacity-60' : ''} ${product.isHero ? 'ring-2 ring-yellow-500/60' : ''}`}>
      <div className="flex gap-3">
        {/* Image */}
        {product.imagemUrl && (
          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
            <img 
              src={product.imagemUrl} 
              alt={product.nome}
              className="w-full h-full object-cover"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {product.isHero && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/25 text-yellow-300 font-bold flex items-center gap-1 uppercase tracking-wide">
                <Crown className="w-3 h-3 fill-current" />
                Hero
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
              {product.categoria || 'Produtos'}
            </span>
            {product.hasGallery && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/20 text-secondary-foreground font-medium flex items-center gap-1">
                <Images className="w-3 h-3" />
                Galeria
              </span>
            )}
            {inactive && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                Inativo
              </span>
            )}
          </div>
          <p className="font-semibold mt-1 truncate">{product.nome}</p>
          <p className="text-lg font-bold text-primary mt-0.5">
            {formatPrice(product.preco)}
          </p>
          {product.lastSyncedAt && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Última sincronização: {new Date(product.lastSyncedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {product.descricaoCurta && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {product.descricaoCurta}
            </p>
          )}

          {/* Visibility toggles */}
          <div className="flex flex-col gap-2 mt-3 p-2.5 rounded-lg bg-muted/30">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="flex items-center gap-2 text-xs font-medium">
                <Crown className={`w-3.5 h-3.5 ${product.isHero ? 'text-yellow-400 fill-current' : 'text-muted-foreground'}`} />
                Produto Hero
              </span>
              <Switch checked={product.isHero} onCheckedChange={onToggleHero} />
            </label>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="flex items-center gap-2 text-xs font-medium">
                <Star className={`w-3.5 h-3.5 ${product.isFeatured ? 'text-yellow-400 fill-current' : 'text-muted-foreground'}`} />
                Destaque
              </span>
              <Switch checked={product.isFeatured} onCheckedChange={onToggleFeatured} />
            </label>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="flex items-center gap-2 text-xs font-medium">
                <Package className={`w-3.5 h-3.5 ${product.showOnProducts ? 'text-primary' : 'text-muted-foreground'}`} />
                Nossos Produtos
              </span>
              <Switch checked={product.showOnProducts} onCheckedChange={onToggleShowOnProducts} />
            </label>
          </div>
        </div>



        {/* Actions */}
        <div className="flex flex-col gap-1">
          <button
            onClick={handleShare}
            className="p-2 rounded-lg hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
            title="Copiar link de compartilhamento"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={onReviews}
            className="p-2 rounded-lg hover:bg-yellow-500/20 text-muted-foreground hover:text-yellow-400 transition-colors"
            title="Ver avaliações do produto"
          >
            <Star className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
