// useNiches.ts - Nichos de produtos (tabela public.niches)
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Niche {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  display_order: number;
  show_on_landing: boolean;
}

export function useNiches() {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNiches = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('niches')
      .select('id, slug, name, icon, color, display_order, show_on_landing')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[useNiches] Erro ao buscar nichos:', error);
    }
    setNiches((data as Niche[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNiches();
  }, [fetchNiches]);

  // Liga/desliga a exibição do nicho na Landing (atualização otimista)
  const setShowOnLanding = useCallback(async (id: string, value: boolean) => {
    setNiches(prev => prev.map(n => (n.id === id ? { ...n, show_on_landing: value } : n)));
    const { error } = await supabase.from('niches').update({ show_on_landing: value }).eq('id', id);
    if (error) {
      console.error('[useNiches] Erro ao atualizar nicho:', error);
      setNiches(prev => prev.map(n => (n.id === id ? { ...n, show_on_landing: !value } : n)));
      toast.error('Não foi possível atualizar o nicho');
      return false;
    }
    toast.success(value ? 'Nicho exibido na vitrine' : 'Nicho ocultado da vitrine');
    return true;
  }, []);

  return { niches, loading, fetchNiches, setShowOnLanding };
}
