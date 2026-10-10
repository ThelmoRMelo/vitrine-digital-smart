ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS technical_details text;

COMMENT ON COLUMN public.products.technical_details IS
  'Ficha técnica importada ou revisada pelo administrador; separada da descrição comercial.';

-- Relatórios contêm metadados de importação e ficam separados dos dados
-- públicos de produtos da Vitrine.
CREATE TABLE IF NOT EXISTS public.product_import_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT auth.uid(),
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_import_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX product_import_reports_tenant_id_idx ON public.product_import_reports (tenant_id);
REVOKE ALL ON TABLE public.product_import_reports FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_import_reports TO authenticated;
GRANT ALL ON TABLE public.product_import_reports TO service_role;
CREATE POLICY "Tenants can view own product import reports"
  ON public.product_import_reports FOR SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Tenants can create own product import reports"
  ON public.product_import_reports FOR INSERT
  WITH CHECK (
    tenant_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.tenant_id = auth.uid())
  );
CREATE POLICY "Tenants can update own product import reports"
  ON public.product_import_reports FOR UPDATE
  USING (tenant_id = auth.uid())
  WITH CHECK (
    tenant_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.tenant_id = auth.uid())
  );
CREATE POLICY "Tenants can delete own product import reports"
  ON public.product_import_reports FOR DELETE USING (tenant_id = auth.uid());

-- Remove as antigas políticas abertas de escrita. Produtos novos passam a
-- pertencer à conta autenticada; a leitura pública permanece para produtos
-- ativos, permitindo que a Vitrine funcione mesmo com sessão autenticada.
DROP POLICY IF EXISTS "Anyone can delete products" ON public.products;
DROP POLICY IF EXISTS "Anyone can insert products" ON public.products;
DROP POLICY IF EXISTS "Anyone can update products" ON public.products;
DROP POLICY IF EXISTS "Tenants can manage own products" ON public.products;
DROP POLICY IF EXISTS "Public can view active products with tenant" ON public.products;

DO $$
DECLARE
  storefront_tenants uuid[];
BEGIN
  SELECT array_agg(DISTINCT tenant_id) INTO storefront_tenants
  FROM public.storefronts
  WHERE tenant_id IS NOT NULL;

  -- Atribuição automática só é segura quando existe um único tenant.
  IF COALESCE(array_length(storefront_tenants, 1), 0) = 1 THEN
    UPDATE public.products
    SET tenant_id = storefront_tenants[1]
    WHERE tenant_id IS NULL;
  END IF;
END $$;

CREATE POLICY "Public can view active products"
  ON public.products FOR SELECT
  USING (active = true);
CREATE POLICY "Tenants can manage own products"
  ON public.products FOR ALL
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

-- A galeria herda o escopo do produto associado.
DROP POLICY IF EXISTS "Public can view product images" ON public.product_images;
DROP POLICY IF EXISTS "Anyone can insert product images" ON public.product_images;
DROP POLICY IF EXISTS "Anyone can update product images" ON public.product_images;
DROP POLICY IF EXISTS "Anyone can delete product images" ON public.product_images;
CREATE POLICY "Public can view active product images"
  ON public.product_images FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.active = true)
  );
CREATE POLICY "Tenants can manage own product images"
  ON public.product_images FOR ALL
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.tenant_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.tenant_id = auth.uid()));
