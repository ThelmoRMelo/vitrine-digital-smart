-- A mídia antiga continua sendo uma imagem; não modifica URLs nem a ordem atual.
ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image';

UPDATE public.product_images
SET media_type = 'image'
WHERE media_type IS NULL;

ALTER TABLE public.product_images
  DROP CONSTRAINT IF EXISTS product_images_media_type_check;

ALTER TABLE public.product_images
  ADD CONSTRAINT product_images_media_type_check
  CHECK (media_type IN ('image', 'video'));

-- Bucket separado: o limite de 20 MB vale somente para vídeos e não amplia o
-- limite de upload de imagens do bucket product-images.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-videos',
  'product-videos',
  true,
  20971520,
  ARRAY['video/mp4', 'video/webm']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY['video/mp4', 'video/webm']::text[];

-- Escrita restrita à pasta da conta autenticada. Vídeos enviados sem sessão
-- Supabase autenticada serão recusados pelo próprio Storage.
DROP POLICY IF EXISTS "Restrict product video objects to owner" ON storage.objects;
CREATE POLICY "Restrict product video objects to owner"
  ON storage.objects AS RESTRICTIVE FOR ALL TO public
  USING (
    bucket_id <> 'product-videos'
    OR (
      auth.uid() IS NOT NULL
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
  WITH CHECK (
    bucket_id <> 'product-videos'
    OR (
      auth.uid() IS NOT NULL
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Tenants can upload own product videos" ON storage.objects;
CREATE POLICY "Tenants can upload own product videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Tenants can update own product videos" ON storage.objects;
CREATE POLICY "Tenants can update own product videos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'product-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Tenants can delete own product videos" ON storage.objects;
CREATE POLICY "Tenants can delete own product videos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
