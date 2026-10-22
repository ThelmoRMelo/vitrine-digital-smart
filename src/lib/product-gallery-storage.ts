import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { getAdminToken } from '@/lib/adminAuth';
import { normalizeProductMediaType, type ProductMediaType } from '@/lib/product-media';

type GeneratedProductImageRow = Database['public']['Tables']['product_images']['Row'];
type GeneratedProductImageInsert = Database['public']['Tables']['product_images']['Insert'];

export type ProductMediaRow = GeneratedProductImageRow & {
  media_type?: string | null;
};

export interface ProductMediaInsert extends GeneratedProductImageInsert {
  media_type: ProductMediaType;
}

function isMissingMediaTypeColumn(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && /media_type/i.test(error.message ?? '') && /column|schema cache|could not find|does not exist|not found/i.test(error.message ?? ''));
}

function normalizeRows(rows: ProductMediaRow[] | null): ProductMediaRow[] | null {
  return rows?.map(row => ({
    ...row,
    media_type: normalizeProductMediaType(row.media_type, row.image_url),
  })) ?? null;
}

/**
 * The checked-in Supabase types predate the media_type migration. Keep that
 * generated file untouched and confine the schema bridge to this adapter.
 */
export async function fetchProductGalleryRows(productId: string) {
  const result = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('display_order', { ascending: true });

  return {
    data: normalizeRows(result.data as ProductMediaRow[] | null),
    error: result.error,
  };
}

export async function fetchProductGalleryRowsForReplacement(productId: string) {
  const result = await supabase
    .from('product_images')
    .select('id, image_url, media_type, display_order, created_at, product_id')
    .eq('product_id', productId);

  if (isMissingMediaTypeColumn(result.error)) {
    const legacy = await supabase.from('product_images').select('*').eq('product_id', productId);
    return {
      data: normalizeRows(legacy.data as ProductMediaRow[] | null),
      error: legacy.error,
      supportsMediaType: false,
    };
  }

  return {
    data: normalizeRows(result.data as ProductMediaRow[] | null),
    error: result.error,
    supportsMediaType: true,
  };
}

export async function insertProductGalleryRows(rows: ProductMediaInsert[]) {
  const result = await supabase
    .from('product_images')
    .insert(rows as unknown as GeneratedProductImageInsert[])
    .select('id');
  if (!isMissingMediaTypeColumn(result.error) || rows.some(row => row.media_type === 'video_upload')) return result;

  const legacyRows = rows.map(({ media_type: _mediaType, ...row }) => row);
  return supabase
    .from('product_images')
    .insert(legacyRows as GeneratedProductImageInsert[])
    .select('id');
}

export async function removeProductVideoObject(publicUrl: string): Promise<boolean> {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!projectUrl) return false;
  try {
    const base = new URL(projectUrl);
    const url = new URL(publicUrl);
    const pathPrefix = `${base.pathname.replace(/\/$/, '')}/storage/v1/object/public/product-videos/`;
    if (url.origin !== base.origin || !url.pathname.startsWith(pathPrefix)) return false;
    const objectPath = decodeURIComponent(url.pathname.slice(pathPrefix.length));
    if (!objectPath) return false;
    const adminToken = getAdminToken();
    if (!adminToken) return false;
    const { data, error } = await supabase.functions.invoke<{ success?: boolean }>('admin-auth', {
      body: { action: 'delete-product-video', token: adminToken, path: objectPath },
    });
    return !error && data?.success === true;
  } catch {
    return false;
  }
}
