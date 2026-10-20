export type ProductMediaType = 'image' | 'video_upload' | 'youtube';

export interface ProductGalleryMedia {
  id?: string;
  url: string;
  mediaType: ProductMediaType;
  /** True only for a video just uploaded in the currently open product form. */
  temporaryUpload?: boolean;
}

export function normalizeProductMediaType(value: string | null | undefined): ProductMediaType {
  if (value === 'youtube') return 'youtube';
  if (value === 'video' || value === 'video_upload') return 'video_upload';
  return 'image';
}

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeVideoUrl(value: string): { videoId: string; canonicalUrl: string } | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const allowedHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be']);
  if (url.protocol !== 'https:' || !allowedHosts.has(host) || url.username || url.password) return null;

  let videoId: string | null = null;
  if (host.endsWith('youtu.be')) {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (url.pathname === '/watch') {
    const videoIds = url.searchParams.getAll('v');
    videoId = videoIds.length === 1 ? videoIds[0] : null;
  } else {
    const match = url.pathname.match(/^\/(?:embed|live|shorts)\/([^/?#]+)/);
    videoId = match?.[1] ?? null;
  }

  if (!videoId || !YOUTUBE_VIDEO_ID.test(videoId)) return null;
  return { videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}` };
}

export function getYouTubeEmbedUrl(value: string): string | null {
  const parsed = parseYouTubeVideoUrl(value);
  return parsed ? `https://www.youtube-nocookie.com/embed/${parsed.videoId}?rel=0&hl=pt-BR` : null;
}

export type VideoUrlValidation =
  | { valid: true; url: string }
  | { valid: false; reason: 'invalid' | 'insecure' | 'streaming' | 'unsupported' | 'unverified' };

export async function validateVideoUrl(value: string, allowLocalHttp = false): Promise<VideoUrlValidation> {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return { valid: false, reason: 'invalid' };
  }

  const hostname = url.hostname.toLowerCase();
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  if (url.protocol !== 'https:' && !(allowLocalHttp && isLocalHost && url.protocol === 'http:')) {
    return { valid: false, reason: 'insecure' };
  }
  if (url.username || url.password) return { valid: false, reason: 'invalid' };

  if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)vimeo\.com$/i.test(hostname)) {
    return { valid: false, reason: 'streaming' };
  }

  const extension = url.pathname.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase();
  if (extension && extension !== '.mp4' && extension !== '.webm') return { valid: false, reason: 'unsupported' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url.href, {
      method: 'HEAD',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (!response.ok) return { valid: false, reason: 'unverified' };
    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (contentType !== 'video/mp4' && contentType !== 'video/webm') return { valid: false, reason: 'unsupported' };
    if (extension && contentType !== `video/${extension.slice(1)}`) return { valid: false, reason: 'unsupported' };
  } catch {
    return { valid: false, reason: 'unverified' };
  } finally {
    clearTimeout(timeout);
  }
  return { valid: true, url: url.href };
}

export async function validateVideoFile(file: File): Promise<boolean> {
  if (file.size > MAX_VIDEO_FILE_BYTES) return false;
  const extension = file.name.match(/\.[^.]+$/)?.[0].toLowerCase();
  const declaredType = file.type.toLowerCase();
  if (extension !== '.mp4' && extension !== '.webm') return false;
  if (declaredType && declaredType !== 'application/octet-stream' && declaredType !== `video/${extension.slice(1)}`) {
    return false;
  }

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const isMp4 = extension === '.mp4' && bytes.length >= 8 && ascii(4, 8) === 'ftyp';
  const isWebm = extension === '.webm' && bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return isMp4 || isWebm;
}

export const MAX_VIDEO_FILE_BYTES = 50 * 1024 * 1024;
