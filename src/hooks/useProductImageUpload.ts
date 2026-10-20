// useProductImageUpload.ts - Upload de imagens para Supabase Storage
import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getAdminToken } from '@/lib/adminAuth';
import { MAX_VIDEO_FILE_BYTES, validateVideoFile } from '@/lib/product-media';
import { getVideoAuthorizationErrorMessage, getVideoStorageErrorMessage, type VideoUploadDiagnostic } from '@/lib/video-upload-errors';

const BUCKET_NAME = 'product-images';
const VIDEO_BUCKET_NAME = 'product-videos';

interface SignedVideoUpload {
  path?: string;
  token?: string;
  error?: string;
}

async function readFunctionFailure(error: unknown): Promise<{ status: number; code: string | null; diagnostic?: VideoUploadDiagnostic }> {
  if (!error || typeof error !== 'object') return { status: 0, code: null };
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return { status: 0, code: null };
  const payload: unknown = await context.clone().json().catch(() => null);
  if (!payload || typeof payload !== 'object') return { status: context.status, code: null };
  const body = payload as Record<string, unknown>;
  return {
    status: context.status,
    code: typeof body.error === 'string' ? body.error : null,
    diagnostic: {
      storageStatus: typeof body.storageStatus === 'number' ? body.storageStatus : null,
      storageCode: typeof body.storageCode === 'string' ? body.storageCode : null,
      storageMessage: typeof body.storageMessage === 'string' ? body.storageMessage : null,
    },
  };
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
          toast.error('Vídeo muito grande. O limite é 20 MB por arquivo.');
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
      const contentType = mediaType === 'video' ? `video/${fileExt}` : file.type;
      let adminToken: string | null = null;

      if (mediaType === 'video') {
        adminToken = getAdminToken();
        if (!adminToken) {
          toast.error('A sessão administrativa não está disponível. Entre no painel e tente enviar o vídeo novamente.');
          return null;
        }
        bucketName = VIDEO_BUCKET_NAME;
      }
      setProgress(30);

      let storedPath: string;
      if (mediaType === 'video') {
        const { data: signedUpload, error: authorizationError } = await supabase.functions.invoke<SignedVideoUpload>('admin-auth', {
          body: { action: 'create-video-upload-url', token: adminToken, fileSize: file.size, contentType },
        });
        if (authorizationError) {
          const failure = await readFunctionFailure(authorizationError);
          toast.error(getVideoAuthorizationErrorMessage(failure.status, failure.code, failure.diagnostic));
          return null;
        }
        if (signedUpload?.error === 'admin_session_invalid') {
          toast.error('Sua sessão administrativa expirou. Entre novamente no painel para continuar.');
          return null;
        }
        if (signedUpload?.error === 'video_too_large') {
          toast.error('Vídeo muito grande. O limite é 20 MB por arquivo.');
          return null;
        }
        if (!signedUpload?.path || !signedUpload.token) {
          toast.error('O serviço não autorizou o envio do vídeo. Tente novamente.');
          return null;
        }

        const { data, error } = await supabase.storage.from(VIDEO_BUCKET_NAME).uploadToSignedUrl(
          signedUpload.path,
          signedUpload.token,
          file,
          { cacheControl: '3600', contentType },
        );
        if (error) {
          toast.error(getVideoStorageErrorMessage(error.statusCode, error.message, error.error));
          console.error('[useProductImageUpload] Storage rejected a signed video upload.', {
            statusCode: error.statusCode,
          });
          return null;
        }
        storedPath = data.path;
      } else {
        const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(objectPath, file, {
          cacheControl: '3600',
          upsert: false,
          ...(contentType ? { contentType } : {}),
        });
        if (error) {
          console.error('[useProductImageUpload] Erro no upload:', error);
          toast.error('Erro ao enviar a imagem. Verifique a configuração do armazenamento.');
          return null;
        }
        storedPath = data.path;
      }

      setProgress(70);
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storedPath);
      setProgress(100);
      return urlData.publicUrl;
    } catch (err) {
      if (mediaType === 'video') {
        console.error('[useProductImageUpload] Unexpected video upload failure.');
        toast.error('Não foi possível concluir o envio do vídeo. Verifique sua conexão e tente novamente.');
      } else {
        console.error('[useProductImageUpload] Erro inesperado:', err);
        toast.error('Não foi possível enviar a imagem.');
      }
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
