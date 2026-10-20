-- Amplia o limite de vídeos enviados para 50 MB, sem alterar políticas RLS.
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'product-videos';
