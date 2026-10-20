import { useRef, useState } from 'react';
import { X, Upload, Loader2, Plus, Image as ImageIcon, Film, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProductImageUpload } from '@/hooks/useProductImageUpload';
import { validateVideoUrl, type ProductGalleryMedia, type ProductMediaType } from '@/lib/product-media';
import { removeProductVideoObject } from '@/lib/product-gallery-storage';
import { toast } from 'sonner';

interface ProductGalleryUploadProps {
  media: ProductGalleryMedia[];
  onMediaChange: (media: ProductGalleryMedia[]) => void;
  maxItems?: number;
}

function videoUrlError(reason: 'invalid' | 'insecure' | 'streaming' | 'unsupported' | 'unverified'): string {
  switch (reason) {
    case 'invalid': return 'Informe uma URL válida.';
    case 'insecure': return 'Use uma URL HTTPS. HTTP só é aceito em localhost durante o desenvolvimento.';
    case 'streaming': return 'Links do YouTube/Vimeo não são arquivos de vídeo e não são incorporados nesta galeria.';
    case 'unsupported': return 'Não foi possível confirmar o formato. Use um link direto para arquivo .mp4 ou .webm.';
    case 'unverified': return 'O servidor não permitiu confirmar o formato do vídeo. Envie o arquivo MP4/WebM diretamente ou use uma URL que responda à verificação.';
  }
}

export function ProductGalleryUpload({ media, onMediaChange, maxItems = 5 }: ProductGalleryUploadProps) {
  const { uploadImage, uploadVideo, uploading } = useProductImageUpload();
  const [urlInput, setUrlInput] = useState('');
  const [urlMediaType, setUrlMediaType] = useState<ProductMediaType>('image');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [checkingUrl, setCheckingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canAddMore = media.length < maxItems;

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const remaining = maxItems - media.length;
    if (files.length > remaining) {
      toast.warning(`Limite de ${maxItems} mídias. ${files.length - remaining} arquivo(s) ignorado(s).`);
    }

    const added: ProductGalleryMedia[] = [];
    for (const file of files.slice(0, remaining)) {
      const type: ProductMediaType = file.type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name) ? 'video' : 'image';
      const url = type === 'video' ? await uploadVideo(file) : await uploadImage(file);
      if (url) added.push({ url, mediaType: type, ...(type === 'video' ? { temporaryUpload: true } : {}) });
    }
    if (added.length) onMediaChange([...media, ...added]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;
    if (media.length >= maxItems) {
      toast.error(`Máximo de ${maxItems} mídias`);
      return;
    }

    if (urlMediaType === 'video') {
      setCheckingUrl(true);
      const validation = await validateVideoUrl(urlInput, import.meta.env.DEV);
      setCheckingUrl(false);
      if (validation.valid === false) {
        toast.error(videoUrlError(validation.reason));
        return;
      }
      onMediaChange([...media, { url: validation.url, mediaType: 'video' }]);
    } else {
      try {
        const parsed = new URL(urlInput.trim());
        if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || parsed.username || parsed.password) {
          toast.error('Use uma URL HTTP ou HTTPS válida para adicionar imagens.');
          return;
        }
        onMediaChange([...media, { url: parsed.href, mediaType: 'image' }]);
      } catch {
        toast.error('Informe uma URL válida.');
        return;
      }
    }

    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleRemove = (index: number) => {
    const removed = media[index];
    if (removed?.mediaType === 'video' && removed.temporaryUpload) {
      void removeProductVideoObject(removed.url).then(ok => {
        if (!ok) console.warn('[ProductGalleryUpload] O vídeo saiu da lista, mas o arquivo temporário não foi removido do Storage.');
      });
    }
    onMediaChange(media.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm text-muted-foreground">Galeria de imagens e vídeos ({media.length}/{maxItems})</label>
        {canAddMore && !showUrlInput && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { setUrlMediaType('image'); setShowUrlInput(true); }}>
              <Link2 className="mr-1 h-3 w-3" /> URL de imagem
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setUrlMediaType('video'); setShowUrlInput(true); }}>
              <Link2 className="mr-1 h-3 w-3" /> URL de vídeo
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
              Enviar mídia
            </Button>
          </div>
        )}
      </div>

      {showUrlInput && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={urlInput} onChange={event => setUrlInput(event.target.value)} placeholder={urlMediaType === 'video' ? 'URL HTTPS direta para vídeo MP4/WebM' : 'Cole a URL HTTPS da imagem'} className="flex-1" disabled={checkingUrl} />
            <Button type="button" size="sm" onClick={handleAddUrl} disabled={checkingUrl}>{checkingUrl ? 'Verificando…' : 'Adicionar'}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setShowUrlInput(false); setUrlInput(''); }}><X className="h-4 w-4" /></Button>
          </div>
          {urlMediaType === 'video' && <p className="text-xs text-muted-foreground">A URL será verificada por uma solicitação HEAD para confirmar Content-Type de vídeo MP4 ou WebM. Parâmetros são aceitos; links sem extensão também funcionam se o servidor informar o tipo correto.</p>}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,.mp4,.webm" multiple onChange={handleFileSelect} className="hidden" />

      {uploading && <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status"><Loader2 className="h-3.5 w-3.5 animate-spin" />Enviando arquivo…</div>}

      {media.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {media.map((item, index) => (
              <div key={item.id ?? `${item.url}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg border-2 border-transparent bg-muted transition-colors hover:border-primary/50">
              {item.mediaType === 'video' ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground"><Film className="h-9 w-9" /><span className="text-xs">Vídeo</span></div>
              ) : (
                <img src={item.url} alt={`Galeria ${index + 1}`} className="h-full w-full object-cover" onError={event => { event.currentTarget.src = '/placeholder.svg'; }} />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => handleRemove(index)} aria-label={`Remover ${item.mediaType === 'video' ? 'vídeo' : 'imagem'} ${index + 1}`} className="rounded-full bg-destructive p-1.5 text-white hover:bg-destructive/80"><X className="h-4 w-4" /></button>
              </div>
              <div className="absolute left-1 top-1 flex h-5 min-w-5 items-center justify-center gap-1 rounded-full bg-black/70 px-1.5 text-xs font-medium text-white">{item.mediaType === 'video' && <Film className="h-3 w-3" />}{index + 1}</div>
            </div>
          ))}
          {canAddMore && <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"><Plus className="h-6 w-6" /><span className="text-xs">Adicionar</span></button>}
        </div>
      ) : (
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
          {uploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <><ImageIcon className="h-8 w-8 opacity-50" /><span className="text-xs">Clique para adicionar imagens ou vídeos</span></>}
        </button>
      )}

      <p className="text-xs text-muted-foreground">Imagens e vídeos demonstrativos. Vídeos enviados têm limite de 20 MB por arquivo; a capa do produto continua sendo uma imagem.</p>
    </div>
  );
}
