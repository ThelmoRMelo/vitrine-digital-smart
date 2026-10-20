-- Alinha o limite do bucket de vídeos ao limite atual da aplicação: 20 MiB.
-- Esta migração é apenas local e não foi aplicada ao projeto remoto.
UPDATE storage.buckets
SET file_size_limit = 20971520
WHERE id = 'product-videos';
