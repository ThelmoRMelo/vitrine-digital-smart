-- Mantém o limite local de uploads de vídeo em 20 MB, sem alterar políticas RLS.
UPDATE storage.buckets
SET file_size_limit = 20971520
WHERE id = 'product-videos';
