// ProductGalleryUpload.tsx - Componente para upload de galeria de imagens
import { useState, useRef } from 'react';
import { X, Upload, Loader2, GripVertical, Plus, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProductImageUpload } from '@/hooks/useProductImageUpload';
import { toast } from 'sonner';

interface ProductGalleryUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export function ProductGalleryUpload({ 
  images, 
  onImagesChange, 
  maxImages = 5 
}: ProductGalleryUploadProps) {
  const { uploadImage, uploading } = useProductImageUpload();
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = maxImages - images.length;
    const toUpload = files.slice(0, remaining);

    if (files.length > remaining) {
      toast.warning(`Limite de ${maxImages} imagens. ${files.length - remaining} imagem(ns) ignorada(s).`);
    }

    for (const file of toUpload) {
      const url = await uploadImage(file);
      if (url) {
        onImagesChange([...images, url]);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    
    if (images.length >= maxImages) {
      toast.error(`Máximo de ${maxImages} imagens`);
      return;
    }

    onImagesChange([...images, urlInput.trim()]);
    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleRemove = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const newImages = [...images];
    const [removed] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, removed);
    onImagesChange(newImages);
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm text-muted-foreground">
          Galeria de imagens ({images.length}/{maxImages})
        </label>
        {canAddMore && !showUrlInput && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowUrlInput(true)}
            >
              <Plus className="w-3 h-3 mr-1" />
              URL
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Upload className="w-3 h-3 mr-1" />
              )}
              Upload
            </Button>
          </div>
        )}
      </div>

      {/* URL Input */}
      {showUrlInput && (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Cole a URL da imagem"
            className="flex-1"
          />
          <Button type="button" size="sm" onClick={handleAddUrl}>
            Adicionar
          </Button>
          <Button 
            type="button" 
            size="sm" 
            variant="ghost" 
            onClick={() => {
              setShowUrlInput(false);
              setUrlInput('');
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Images Grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="relative group aspect-square rounded-lg overflow-hidden bg-muted border-2 border-transparent hover:border-primary/50 transition-colors"
            >
              <img
                src={url}
                alt={`Galeria ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
              
              {/* Overlay com ações */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="p-1.5 bg-destructive rounded-full text-white hover:bg-destructive/80"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Número da ordem */}
              <div className="absolute top-1 left-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center text-xs text-white font-medium">
                {index + 1}
              </div>
            </div>
          ))}

          {/* Add more placeholder */}
          {canAddMore && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Plus className="w-6 h-6" />
                  <span className="text-xs">Adicionar</span>
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <>
              <ImageIcon className="w-8 h-8 opacity-50" />
              <span className="text-xs">Clique para adicionar imagens à galeria</span>
            </>
          )}
        </button>
      )}

      <p className="text-xs text-muted-foreground">
        📸 Imagens adicionais do produto. A imagem de capa é usada na vitrine e compartilhamento.
      </p>
    </div>
  );
}
