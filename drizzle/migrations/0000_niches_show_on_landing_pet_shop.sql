ALTER TABLE public.niches ADD COLUMN IF NOT EXISTS show_on_landing boolean NOT NULL DEFAULT true;
UPDATE public.niches SET show_on_landing = false WHERE slug = 'financas' AND tenant_id IS NULL;
INSERT INTO public.niches (slug, name, icon, color, display_order, is_active, show_on_landing)
SELECT 'pet-shop', 'Pet Shop', 'PawPrint', 'hsl(25, 90%, 55%)', 7, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.niches WHERE slug = 'pet-shop' AND tenant_id IS NULL);