// useProductGallery.ts - Hook para gerenciar galeria de imagens do produto
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizeProductMediaType, type ProductGalleryMedia } from '@/lib/product-media';
import { fetchProductGalleryRows, fetchProductGalleryRowsForReplacement, insertProductGalleryRows, removeProductVideoObject, type ProductMediaRow } from '@/lib/product-gallery-storage';

export interface ProductImage extends ProductGalleryMedia {
  id: string;
  productId: string;
  displayOrder: number;
  createdAt: string;
}

type SupabaseProductImage = ProductMediaRow;

function toUIImage(img: SupabaseProductImage): ProductImage {
  return {
    id: img.id,
    productId: img.product_id,
    url: img.image_url,
    mediaType: normalizeProductMediaType(img.media_type),
    displayOrder: img.display_order,
    createdAt: img.created_at,
  };
}

export function useProductGallery(productId: string | null) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchRequestId = useRef(0);

  // Buscar imagens da galeria
  const fetchImages = useCallback(async () => {
    const requestId = ++fetchRequestId.current;
    if (!productId) {
      setImages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setImages([]);
      const { data, error } = await fetchProductGalleryRows(productId);

      if (error) {
        console.error('[useProductGallery] Erro ao buscar:', error);
        return;
      }

      if (requestId === fetchRequestId.current) setImages((data || []).map(toUIImage));
    } catch (err) {
      console.error('[useProductGallery] Erro inesperado:', err);
    } finally {
      if (requestId === fetchRequestId.current) setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Adicionar imagem à galeria
  const addImage = async (imageUrl: string, displayOrder?: number) => {
    return addMedia({ url: imageUrl, mediaType: 'image' }, displayOrder);
  };

  const addMedia = async (media: ProductGalleryMedia, displayOrder?: number) => {
    if (!productId) return null;

    try {
      const order = displayOrder ?? images.length;
      
      const { data, error } = await insertProductGalleryRows([{
          product_id: productId,
          image_url: media.url,
          media_type: media.mediaType,
          display_order: order,
        }]);

      if (error) {
        console.error('[useProductGallery] Erro ao adicionar:', error);
        toast.error('Erro ao adicionar imagem');
        return null;
      }

      const newImage: ProductImage = {
        id: data?.[0]?.id ?? crypto.randomUUID(),
        productId,
        url: media.url,
        mediaType: media.mediaType,
        displayOrder: order,
        createdAt: new Date().toISOString(),
      };
      setImages(prev => [...prev, newImage].sort((a, b) => a.displayOrder - b.displayOrder));
      
      // Atualizar flag has_gallery no produto
      await updateHasGalleryFlag(true);
      
      return newImage;
    } catch (err) {
      console.error('[useProductGallery] Erro inesperado:', err);
      toast.error('Erro ao adicionar imagem');
      return null;
    }
  };

  // Remover imagem da galeria
  const removeImage = async (imageId: string) => {
    try {
      const { error } = await supabase
        .from('product_images')
        .delete()
        .eq('id', imageId);

      if (error) {
        console.error('[useProductGallery] Erro ao remover:', error);
        toast.error('Erro ao remover imagem');
        return false;
      }

      setImages(prev => {
        const newImages = prev.filter(img => img.id !== imageId);
        // Atualizar flag se não houver mais imagens
        if (newImages.length === 0) {
          updateHasGalleryFlag(false);
        }
        return newImages;
      });

      return true;
    } catch (err) {
      console.error('[useProductGallery] Erro inesperado:', err);
      toast.error('Erro ao remover imagem');
      return false;
    }
  };

  // Reordenar imagens
  const reorderImages = async (newOrder: ProductImage[]) => {
    try {
      const updates = newOrder.map((img, index) => ({
        id: img.id,
        display_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from('product_images')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
      }

      setImages(newOrder.map((img, index) => ({ ...img, displayOrder: index })));
      return true;
    } catch (err) {
      console.error('[useProductGallery] Erro ao reordenar:', err);
      return false;
    }
  };

  // Atualizar flag has_gallery no produto
  const updateHasGalleryFlag = async (hasGallery: boolean) => {
    if (!productId) return;
    
    await supabase
      .from('products')
      .update({ has_gallery: hasGallery })
      .eq('id', productId);
  };

  // Salvar múltiplas imagens de uma vez (para formulário)
  const saveGallery = async (mediaItems: ProductGalleryMedia[]) => {
    if (!productId) return false;

    try {
      const { data: existingRows, error: readError, supportsMediaType } = await fetchProductGalleryRowsForReplacement(productId);
      if (readError) {
        console.error('[useProductGallery] Erro ao verificar galeria existente:', readError);
        toast.error('Não foi possível verificar a galeria atual.');
        return false;
      }
      if (!supportsMediaType && mediaItems.some(media => media.mediaType !== 'image')) {
        toast.error('A migração da galeria multimídia precisa ser aplicada antes de salvar vídeos.');
        return false;
      }

      let insertedIds: string[] = [];
      if (mediaItems.length > 0) {
        const inserts = mediaItems.map((media, index) => ({
          product_id: productId,
          image_url: media.url,
          media_type: media.mediaType,
          display_order: index,
        }));

        const { data: insertedRows, error } = await insertProductGalleryRows(inserts);

        if (error) {
          console.error('[useProductGallery] Erro ao salvar galeria:', error);
          toast.error('Erro ao salvar galeria');
          return false;
        }
        insertedIds = (insertedRows || []).map(row => row.id);
      }

      const existingIds = (existingRows || []).map(row => row.id);
      if (existingIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('product_images')
          .delete()
          .in('id', existingIds);
        if (deleteError) {
          console.error('[useProductGallery] Erro ao substituir galeria:', deleteError);
          if (insertedIds.length > 0) {
            await supabase.from('product_images').delete().in('id', insertedIds);
          }
          toast.error('Não foi possível substituir a galeria atual.');
          return false;
        }
      }

      // Atualizar flag
      await updateHasGalleryFlag(mediaItems.length > 0);

      const retainedUrls = new Set(mediaItems.map(media => media.url));
      for (const oldMedia of existingRows || []) {
        if ((oldMedia.media_type === 'video' || oldMedia.media_type === 'video_upload') && !retainedUrls.has(oldMedia.image_url)) {
          const removed = await removeProductVideoObject(oldMedia.image_url);
          if (!removed) console.warn('[useProductGallery] O registro foi removido, mas o arquivo de vídeo não pôde ser excluído do Storage.');
        }
      }

      // Recarregar
      await fetchImages();
      return true;
    } catch (err) {
      console.error('[useProductGallery] Erro inesperado:', err);
      return false;
    }
  };

  return {
    images,
    loading,
    addImage,
    addMedia,
    removeImage,
    reorderImages,
    saveGallery,
    fetchImages,
  };
}
