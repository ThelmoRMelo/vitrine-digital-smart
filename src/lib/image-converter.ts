export interface ImageConversionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const DEFAULT_MAX_WIDTH = 1600;
const DEFAULT_MAX_HEIGHT = 1600;
const DEFAULT_QUALITY = 0.9;

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode image.'));
    image.src = source;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode image as JPEG.'));
    }, 'image/jpeg', quality);
  });
}

export async function convertImageToJpeg(
  file: File,
  options: ImageConversionOptions = {},
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  let objectUrl: string | null = null;
  try {
    const maxWidth = Math.max(1, options.maxWidth ?? DEFAULT_MAX_WIDTH);
    const maxHeight = Math.max(1, options.maxHeight ?? DEFAULT_MAX_HEIGHT);
    const quality = Math.min(1, Math.max(0, options.quality ?? DEFAULT_QUALITY));

    objectUrl = URL.createObjectURL(file);
    const image = await loadImage(objectUrl);
    if (image.naturalWidth < 1 || image.naturalHeight < 1) return file;

    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return file;

    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToJpeg(canvas, quality);
    const lastDot = file.name.lastIndexOf('.');
    const baseName = lastDot > 0 ? file.name.slice(0, lastDot) : file.name;
    return new File([blob], baseName + '.jpg', {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}