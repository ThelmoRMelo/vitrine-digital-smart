// useProductImport.ts - Importação inteligente de produtos por link de afiliado
import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ImportedReview {
  customerName: string;
  comment: string;
  stars: number;
  sourceUrl: string | null;
  sourcePlatform: string | null;
}

export interface ImportedProductData {
  platform: string;
  platformLabel: string;
  externalId: string | null;
  sourceUrl: string;
  title: string | null;
  price: number | null;
  category: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  coverImage: string | null;
  galleryImages: string[];
  missingFields: string[];
  reviews: ImportedReview[];
}

export interface ImportResult {
  ok?: true;
  product?: ImportedProductData;
  duplicate?: {
  id: string;
  name: string;
  reason?: 'same_source_link' | 'same_external_product';
} | null;
  warnings?: string[];
  error?: string;
  code?: string;
  platforms?: { id: string; label: string }[];
}

export const IMPORT_PLATFORMS = [
  { id: 'mercado_livre', label: 'Mercado Livre' },
  { id: 'shopee', label: 'Shopee' },
  { id: 'hotmart', label: 'Hotmart' },
  { id: 'outro', label: 'Outra plataforma' },
];

const STEPS = [
  '🔍 Identificando plataforma...',
  '📦 Localizando produto...',
  '📝 Obtendo informações...',
  '🖼️ Obtendo imagens...',
  '⭐ Buscando avaliações...',
];

export function useProductImport() {
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<string>('');

  const importFromLink = useCallback(
    async (url: string, platform?: string | null): Promise<ImportResult> => {
      setImporting(true);
      let i = 0;
      setStep(STEPS[0]);
      const timer = setInterval(() => {
        i = Math.min(i + 1, STEPS.length - 1);
        setStep(STEPS[i]);
      }, 1600);

      try {
        const { data, error } = await supabase.functions.invoke('import-product', {
          body: { url, platform: platform ?? null },
        });

        if (error) {
          console.error('[useProductImport] erro:', error);
          return { error: 'Não foi possível obter as informações agora. Tente novamente.', code: 'connection' };
        }

        return (data ?? {}) as ImportResult;
      } catch (err) {
        console.error('[useProductImport] erro inesperado:', err);
        return { error: 'Não foi possível obter as informações agora. Tente novamente.', code: 'connection' };
      } finally {
        clearInterval(timer);
        setImporting(false);
        setStep('');
      }
    },
    [],
  );

  return { importFromLink, importing, step };
}
