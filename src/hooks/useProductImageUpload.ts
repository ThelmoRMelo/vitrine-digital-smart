// useProductImageUpload.ts - Upload de imagens para Supabase Storage
import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MAX_VIDEO_FILE_BYTES, validateVideoFile } from '@/lib/product-media';

const BUCKET_NAME = 'product-images';
const VIDEO_BUCKET_NAME = 'product-videos';

interface AuthSessionReader {
  getSession: () => Promise<{
    data: { session: { user: { id: string } } | null };
    error: unknown;
  }>;
}

export function useProductImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const uploadLock = useRef(false);

  const uploadFile = async (file: File, mediaType: 'image' | 'video'): Promise<string | null> => {
    if (uploadLock.current) return null;
    uploadLock.current = true;
    setUploading(true);
    setProgress(0);
    try {
      const allowedTypes = mediaType === 'image'
        ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        : ['video/mp4', 'video/webm', 'application/octet-stream'];
      if (mediaType === 'image' && !allowedTypes.includes(file.type)) {
        toast.error('Formato inválido. Use JPG, PNG, GIF ou WebP.');
        return null;
      }
      if (mediaType === 'video') {
        if (file.size > MAX_VIDEO_FILE_BYTES) {
          toast.error('Vídeo muito grande. O limite é 50 MB por arquivo.');
          return null;
        }
        if ((file.type && !allowedTypes.includes(file.type)) || !(await validateVideoFile(file))) {
          toast.error('Vídeo inválido. Envie um arquivo MP4 ou WebM compatível.');
          return null;
        }
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() || (mediaType === 'video' ? 'mp4' : 'jpg');
      const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
      let bucketName = BUCKET_NAME;
      let objectPath = fileName;
      if (mediaType === 'video') {
        const authSessionReader = supabase.auth as unknown as AuthSessionReader;
        const { data: sessionData, error: sessionError } = await authSessionReader.getSession();
        const userId = sessionData.session?.user.id;
        if (sessionError || !userId) {
          toast.error('Entre novamente na conta administrativa para enviar vídeos.');
          return null;
        }
        bucketName = VIDEO_BUCKET_NAME;
        objectPath = `${userId}/${fileName}`;
      }
      setProgress(30);
      const contentType = mediaType === 'video' ? `video/${fileExt}` : file.type;
      const { data, error } = await supabase.storage.from(bucketName).upload(objectPath, file, {
        cacheControl: '3600',
        upsert: false,
        ...(contentType ? { contentType } : {}),
      });
      if (error) {
        console.error('[useProductImageUpload] Erro no upload:', error);
        toast.error(`Erro ao enviar ${mediaType === 'video' ? 'o vídeo' : 'a imagem'}. Verifique a configuração do armazenamento.`);
        return null;
      }
      setProgress(70);
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(data.path);
      setProgress(100);
      return urlData.publicUrl;
    } catch (err) {
      console.error('[useProductImageUpload] Erro inesperado:', err);
      toast.error(`Não foi possível enviar ${mediaType === 'video' ? 'o vídeo' : 'a imagem'}.`);
      return null;
    } finally {
      uploadLock.current = false;
      setUploading(false);
      setProgress(0);
    }
  };

  /**
   * Faz upload de um arquivo para o Supabase Storage
   * @param file Arquivo de imagem
   * @returns URL pública da imagem ou null em caso de erro
   */
  const uploadImage = async (file: File): Promise<string | null> => {
    const maxImageSize = 5 * 1024 * 1024;
    if (file.size > maxImageSize) {
      toast.error('Imagem muito grande. Máximo: 5MB');
      return null;
    }
    return uploadFile(file, 'image');
  };

  const uploadVideo = (file: File): Promise<string | null> => uploadFile(file, 'video');

  /**
   * Deleta uma imagem do Storage
   * @param imageUrl URL pública da imagem
   */
  const deleteImage = async (imageUrl: string): Promise<boolean> => {
    try {
      // Extrair o nome do arquivo da URL
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];

      if (!fileName) {
        console.warn('[useProductImageUpload] Nome do arquivo não encontrado');
        return false;
      }

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([fileName]);

      if (error) {
        console.error('[useProductImageUpload] Erro ao deletar:', error);
        return false;
      }

      console.log('[useProductImageUpload] Imagem deletada:', fileName);
      return true;
    } catch (err) {
      console.error('[useProductImageUpload] Erro inesperado:', err);
      return false;
    }
  };

  return {
    uploadImage,
    uploadVideo,
    deleteImage,
    uploading,
    progress
  };
}
