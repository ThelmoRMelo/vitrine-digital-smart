// TTS da ANIA: cache em memória/IndexedDB, deduplicação de chamadas e áudio exclusivo.
import { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { compactVoiceInstructions } from '@/lib/ania-voice';

type State = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

interface SpeechConfig {
  voice?: string | null;
  instructions?: string | null;
  speed?: number | null;
}

interface CachedSpeech {
  key: string;
  blob: Blob;
  createdAt: number;
}

interface PendingSpeech {
  controller: AbortController;
  promise: Promise<Blob>;
}

const CACHE_DB_NAME = 'ania-tts-cache';
const CACHE_STORE_NAME = 'audio';
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PERSISTED_ENTRIES = 20;
const MAX_PERSISTED_BLOB_BYTES = 1_500_000;
const MAX_MEMORY_ENTRIES = 12;

// Apenas blobs pequenos ficam em memória. A chave contém texto somente enquanto a página estiver aberta.
const memoryCache = new Map<string, Blob>();
const speechInFlight = new Map<string, PendingSpeech>();
const playedMessageIds = new Set<string>();
const audioObjectUrls = new WeakMap<HTMLAudioElement, string>();

let currentAudio: HTMLAudioElement | null = null;
let dbPromise: Promise<IDBDatabase | null> | null = null;

function compactSpeechText(raw: string): string {
  const moneyExpanded = raw.replace(
    /R\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{2}))?/gi,
    (_match, wholePart: string, centsPart?: string) => {
      const whole = Number(wholePart.replace(/\./g, ''));
      const cents = Number(centsPart || '0');
      const realLabel = whole === 1 ? 'real' : 'reais';
      if (!Number.isFinite(whole)) return `${wholePart} reais`;
      return cents > 0 ? `${whole} ${realLabel} e ${cents} centavos` : `${whole} ${realLabel}`;
    },
  );

  return moneyExpanded
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/__CATALOG_FILTERED__:[^\s]*/g, ' ')
    .replace(/__CATALOG__/g, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
    .replace(/https?:\/\/[^\s)]+/gi, ' ')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D\u{1F1E6}-\u{1F1FF}]/gu, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[*_~#>|]/g, ' ')
    .replace(/^\s*[-•]\s*/gm, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Versão limpa do texto apenas para leitura em voz alta.
export function cleanTextForSpeech(raw: string): string {
  return compactSpeechText(raw);
}

function buildCacheKey(text: string, cfg: SpeechConfig): string {
  return JSON.stringify([
    text,
    cfg.voice || 'coral',
    cfg.speed ?? 1,
    compactVoiceInstructions(cfg.instructions),
  ]);
}

async function persistentKeyFor(cacheKey: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cacheKey));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

function openSpeechDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(CACHE_DB_NAME, CACHE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(CACHE_STORE_NAME)) {
          database.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function readPersistedSpeech(cacheKey: string): Promise<Blob | null> {
  const key = await persistentKeyFor(cacheKey);
  if (!key) return null;
  const database = await openSpeechDatabase();
  if (!database) return null;

  return new Promise((resolve) => {
    try {
      const request = database
        .transaction(CACHE_STORE_NAME, 'readonly')
        .objectStore(CACHE_STORE_NAME)
        .get(key) as IDBRequest<CachedSpeech | undefined>;
      request.onsuccess = () => {
        const entry = request.result;
        if (!entry || Date.now() - entry.createdAt > CACHE_TTL_MS || !(entry.blob instanceof Blob)) {
          if (entry) void deletePersistedSpeech(key, database);
          resolve(null);
          return;
        }
        resolve(entry.blob);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function deletePersistedSpeech(key: string, database?: IDBDatabase): Promise<void> {
  const db = database || await openSpeechDatabase();
  if (!db) return;
  try {
    db.transaction(CACHE_STORE_NAME, 'readwrite').objectStore(CACHE_STORE_NAME).delete(key);
  } catch {
    // O cache persistente é opcional; falhas de quota ou armazenamento não afetam a reprodução.
  }
}

async function persistSpeech(cacheKey: string, blob: Blob): Promise<void> {
  if (blob.size > MAX_PERSISTED_BLOB_BYTES) return;
  const key = await persistentKeyFor(cacheKey);
  const database = await openSpeechDatabase();
  if (!key || !database) return;

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(CACHE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      store.put({ key, blob, createdAt: Date.now() } satisfies CachedSpeech);
      const allRequest = store.getAll() as IDBRequest<CachedSpeech[]>;
      allRequest.onsuccess = () => {
        const cutoff = Date.now() - CACHE_TTL_MS;
        const entries = allRequest.result.filter((entry) => entry.key !== key && entry.createdAt >= cutoff);
        entries.sort((a, b) => b.createdAt - a.createdAt);
        for (const entry of allRequest.result) {
          if (entry.createdAt < cutoff || (entry.key !== key && !entries.slice(0, MAX_PERSISTED_ENTRIES - 1).some((keep) => keep.key === entry.key))) {
            store.delete(entry.key);
          }
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

function rememberSpeech(cacheKey: string, blob: Blob): void {
  memoryCache.delete(cacheKey);
  memoryCache.set(cacheKey, blob);
  while (memoryCache.size > MAX_MEMORY_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey === undefined) break;
    memoryCache.delete(oldestKey);
  }
}

function truncateAtSentence(text: string, limit = 600): string {
  if (text.length <= limit) return text;
  const prefix = text.slice(0, limit);
  const sentenceEnds = [...prefix.matchAll(/[.!?](?:["'’”)}\]]*)?(?=\s|$)/gu)];
  const lastSentenceEnd = sentenceEnds[sentenceEnds.length - 1]?.index;
  if (lastSentenceEnd !== undefined && lastSentenceEnd > 0) {
    return `${prefix.slice(0, lastSentenceEnd).trimEnd()}…`;
  }
  const wordBoundary = prefix.lastIndexOf(' ', limit - 2);
  return `${prefix.slice(0, wordBoundary > 0 ? wordBoundary : limit - 1).trimEnd()}…`;
}

function decodeBase64Audio(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes.buffer], { type: mimeType });
}

function cancelSpeechRequest(cacheKey: string): void {
  const pending = speechInFlight.get(cacheKey);
  if (!pending) return;
  speechInFlight.delete(cacheKey);
  pending.controller.abort();
}

function cancelPendingSpeechRequests(exceptKey?: string): void {
  for (const [key, pending] of speechInFlight) {
    if (key === exceptKey) continue;
    speechInFlight.delete(key);
    pending.controller.abort();
  }
}

async function getSpeechBlob(
  text: string,
  cfg: SpeechConfig,
): Promise<Blob> {
  const spoken = truncateAtSentence(cleanTextForSpeech(text));
  if (!spoken) throw new Error('texto vazio após limpeza');

  const cacheKey = buildCacheKey(spoken, cfg);
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    // Atualiza a ordem de uso para manter as entradas recentes no cache LRU.
    rememberSpeech(cacheKey, cached);
    return cached;
  }

  const existingRequest = speechInFlight.get(cacheKey);
  if (existingRequest) return existingRequest.promise;

  const controller = new AbortController();
  const instructions = compactVoiceInstructions(cfg.instructions);
  const request = (async () => {
    try {
      const persisted = await readPersistedSpeech(cacheKey);
      if (controller.signal.aborted) throw new DOMException('Geração cancelada', 'AbortError');
      if (persisted) {
        rememberSpeech(cacheKey, persisted);
        return persisted;
      }

      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text: spoken,
          ...(cfg.voice ? { voice: cfg.voice } : {}),
          instructions,
          ...(cfg.speed ? { speed: cfg.speed } : {}),
        },
        signal: controller.signal,
      });

      if (error) throw error;
      const speech = data as { audio?: string; mimeType?: string } | null;
      if (!speech?.audio) throw new Error('sem áudio');

      const blob = decodeBase64Audio(speech.audio, speech.mimeType || 'audio/wav');
      rememberSpeech(cacheKey, blob);
      void persistSpeech(cacheKey, blob);
      return blob;
    } finally {
      if (speechInFlight.get(cacheKey)?.controller === controller) {
        speechInFlight.delete(cacheKey);
      }
    }
  })();

  speechInFlight.set(cacheKey, { controller, promise: request });
  try {
    return await request;
  } catch (error) {
    if (controller.signal.aborted) throw new DOMException('Geração cancelada', 'AbortError');
    throw error;
  }
}

function makeAudio(blob: Blob): HTMLAudioElement {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.preload = 'auto';
  audioObjectUrls.set(audio, url);
  return audio;
}

function releaseAudio(audio: HTMLAudioElement): void {
  const url = audioObjectUrls.get(audio);
  audioObjectUrls.delete(audio);
  audio.onended = null;
  audio.onerror = null;
  audio.onpause = null;
  audio.onplay = null;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  if (url) URL.revokeObjectURL(url);
}

function playExclusive(audio: HTMLAudioElement): Promise<void> {
  if (currentAudio && currentAudio !== audio) {
    const previousAudio = currentAudio;
    currentAudio = null;
    releaseAudio(previousAudio);
  }

  currentAudio = audio;
  return audio.play();
}

function stopPlaybackAndPending(exceptKey?: string): void {
  playbackGeneration += 1;
  cancelPendingSpeechRequests(exceptKey);
  if (currentAudio) {
    const audio = currentAudio;
    currentAudio = null;
    audio.currentTime = 0;
    releaseAudio(audio);
  }
}

function attachAutoPlayback(audio: HTMLAudioElement): void {
  audio.onended = () => {
    if (currentAudio === audio) currentAudio = null;
    releaseAudio(audio);
  };
  audio.onerror = () => {
    if (currentAudio === audio) currentAudio = null;
    releaseAudio(audio);
  };
}

/** Prepara o áudio sem reproduzi-lo. A assinatura pública permanece compatível. */
export async function prepareMessageSpeech(
  messageId: string,
  text: string,
  cfg: SpeechConfig,
): Promise<void> {
  void messageId;
  await getSpeechBlob(text, cfg);
}

export function hasMessageSpeechPlayed(messageId: string): boolean {
  return playedMessageIds.has(messageId);
}

/** Reproduz uma fala preparada ou a gera se ainda não estiver no cache. */
export async function playPreparedMessageSpeech(
  messageId: string,
  text: string,
  cfg: SpeechConfig,
): Promise<void> {
  const spoken = truncateAtSentence(cleanTextForSpeech(text));
  const cacheKey = buildCacheKey(spoken, cfg);
  stopPlaybackAndPending(cacheKey);
  const generation = playbackGeneration;
  let audio: HTMLAudioElement | null = null;
  try {
    const blob = await getSpeechBlob(text, cfg);
    if (generation !== playbackGeneration) return;

    audio = makeAudio(blob);
    attachAutoPlayback(audio);
    playedMessageIds.add(messageId);
    await playExclusive(audio);
  } catch (error) {
    if (audio) {
      if (currentAudio === audio) currentAudio = null;
      releaseAudio(audio);
    }
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      // Autoplay pode ser bloqueado pelo navegador móvel; não exibimos toast.
      console.info('[AutoSpeak] áudio indisponível para reprodução automática.');
    }
  }
}

export async function playMessageSpeech(
  messageId: string,
  text: string,
  cfg: SpeechConfig,
): Promise<void> {
  if (playedMessageIds.has(messageId)) return;
  await playPreparedMessageSpeech(messageId, text, cfg);
}

let playbackGeneration = 0;

/** Para o áudio atual e cancela chamadas TTS ainda em andamento. */
export function stopMessageSpeech(): void {
  stopPlaybackAndPending();
}

interface SpeakButtonProps {
  messageId: string;
  text: string;
  voice?: string | null;
  instructions?: string | null;
  speed?: number | null;
}

export function SpeakButton({
  messageId,
  text,
  voice,
  instructions,
  speed,
}: SpeakButtonProps) {
  const [state, setState] = useState<State>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestGenerationRef = useRef(0);
  const config: SpeechConfig = { voice, instructions, speed };
  const requestKey = buildCacheKey(truncateAtSentence(cleanTextForSpeech(text)), config);

  useEffect(() => {
    return () => {
      requestGenerationRef.current += 1;
      cancelSpeechRequest(requestKey);
      const audio = audioRef.current;
      if (audio && currentAudio === audio) {
        currentAudio = null;
        releaseAudio(audio);
      }
    };
  }, [requestKey]);

  const attach = (audio: HTMLAudioElement) => {
    audio.onended = () => {
      setState('ended');
      if (currentAudio === audio) currentAudio = null;
      if (audioRef.current === audio) audioRef.current = null;
      releaseAudio(audio);
    };
    audio.onpause = () => setState((current) => current === 'playing' ? 'paused' : current);
    audio.onplay = () => setState('playing');
    audio.onerror = () => {
      setState('error');
      if (currentAudio === audio) currentAudio = null;
      if (audioRef.current === audio) audioRef.current = null;
      releaseAudio(audio);
    };
  };

  const play = async (audio: HTMLAudioElement) => {
    try {
      await playExclusive(audio);
      setState('playing');
    } catch {
      if (currentAudio === audio) currentAudio = null;
      if (audioRef.current === audio) audioRef.current = null;
      releaseAudio(audio);
      setState('error');
    }
  };

  const handleClick = async () => {
    if (state === 'loading') {
      requestGenerationRef.current += 1;
      cancelSpeechRequest(requestKey);
      setState('idle');
      return;
    }

    const existing = audioRef.current;
    if (state === 'playing' && existing) {
      existing.pause();
      setState('paused');
      return;
    }

    if (existing && state === 'paused' && audioObjectUrls.has(existing)) {
      await play(existing);
      return;
    }

    const spoken = cleanTextForSpeech(text);
    if (!spoken) return;

    const requestGeneration = ++requestGenerationRef.current;
    stopPlaybackAndPending(requestKey);
    setState('loading');
    try {
      const blob = await getSpeechBlob(text, config);
      if (requestGeneration !== requestGenerationRef.current) return;

      const audio = makeAudio(blob);
      audioRef.current = audio;
      attach(audio);
      await play(audio);
    } catch (error) {
      if (requestGeneration === requestGenerationRef.current) {
        // Erros de autoplay ficam locais ao botão; nenhum toast é exibido.
        setState('error');
      }
    }
  };

  const label = state === 'loading'
    ? 'Cancelar'
    : state === 'playing'
      ? 'Pausar'
      : state === 'paused'
        ? 'Continuar'
        : state === 'ended'
          ? 'Ouvir novamente'
          : state === 'error'
            ? 'Tentar novamente'
            : 'Ouvir';

  const Icon = state === 'loading'
    ? Loader2
    : state === 'playing'
      ? Pause
      : state === 'paused'
        ? Play
        : Volume2;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className="mt-1.5 inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-full text-[12px] font-medium text-muted-foreground bg-foreground/5 hover:bg-foreground/10 active:scale-[0.97] transition disabled:opacity-70"
    >
      <Icon className={`w-3.5 h-3.5 ${state === 'loading' ? 'animate-spin' : ''}`} />
      {label}
    </button>
  );
}
