// Botão "Ouvir" — camada adicional de TTS sobre a resposta em texto da ANIA.
// Também permite preparar o áudio ANTES da mensagem aparecer no chat,
// para sincronizar texto + voz.
//
// Fluxo automático:
// 1. prepareMessageSpeech() gera/cacheia o áudio enquanto a ANIA "digita";
// 2. Chat.tsx adiciona a mensagem somente quando o áudio está pronto;
// 3. playPreparedMessageSpeech() inicia a reprodução imediatamente.
//
// O botão manual "Ouvir" continua funcionando normalmente.

import { useEffect, useRef, useState } from 'react';
import { Volume2, Loader2, Pause, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type State = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

interface SpeechConfig {
  voice?: string | null;
  instructions?: string | null;
  speed?: number | null;
}

// Somente uma reprodução ativa por vez em toda a página.
let currentAudio: HTMLAudioElement | null = null;

// Cache do áudio por mensagem durante a sessão.
const audioCache = new Map<string, string>();

// Mensagens que já tiveram reprodução automática iniciada.
// Evita que o useEffect do Chat.tsx toque a mesma mensagem novamente.
const playedMessageIds = new Set<string>();

// Promessas em andamento.
// Se duas partes da interface pedirem o mesmo áudio ao mesmo tempo,
// apenas uma requisição será feita.
const speechInFlight = new Map<string, Promise<string>>();

// Versão limpa do texto apenas para leitura em voz alta.
export function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'link disponível na conversa')
    .replace(/[*_~#>|]/g, ' ')
    .replace(/^\s*[-•]\s*/gm, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildCacheKey(messageId: string, cfg: SpeechConfig): string {
  return JSON.stringify([
    messageId,
    cfg.voice || 'coral',
    cfg.speed ?? 1,
    cfg.instructions || '',
  ]);
}

// Busca ou gera o src do áudio.
async function getSpeechSrc(
  messageId: string,
  text: string,
  cfg: SpeechConfig,
): Promise<string> {
  const cacheKey = buildCacheKey(messageId, cfg);

  const cached = audioCache.get(cacheKey);
  if (cached) return cached;

  const existingRequest = speechInFlight.get(cacheKey);
  if (existingRequest) return existingRequest;

  const spoken = cleanTextForSpeech(text);

  if (!spoken) {
    throw new Error('texto vazio após limpeza');
  }

  const request = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'text-to-speech',
        {
          body: {
            text: spoken,
            ...(cfg.voice ? { voice: cfg.voice } : {}),
            ...(cfg.instructions
              ? { instructions: cfg.instructions }
              : {}),
            ...(cfg.speed ? { speed: cfg.speed } : {}),
          },
        },
      );

      if (error) throw error;

      const base64 = (data as { audio?: string })?.audio;

      if (!base64) {
        throw new Error('sem áudio');
      }

      const src = `data:audio/mpeg;base64,${base64}`;

      audioCache.set(cacheKey, src);

      return src;
    } finally {
      speechInFlight.delete(cacheKey);
    }
  })();

  speechInFlight.set(cacheKey, request);

  return request;
}

/**
 * PREPARA o áudio antecipadamente.
 *
 * Esta função não toca o áudio.
 * Ela somente garante que o áudio esteja pronto/cacheado.
 */
export async function prepareMessageSpeech(
  messageId: string,
  text: string,
  cfg: SpeechConfig,
): Promise<void> {
  await getSpeechSrc(messageId, text, cfg);
}

/**
 * Verifica se uma mensagem já iniciou reprodução automática.
 */
export function hasMessageSpeechPlayed(messageId: string): boolean {
  return playedMessageIds.has(messageId);
}

function playExclusive(audio: HTMLAudioElement): Promise<void> {
  if (currentAudio && currentAudio !== audio) {
    currentAudio.pause();
  }

  currentAudio = audio;

  return audio.play();
}

/**
 * Reproduz um áudio que já foi preparado/cacheado.
 *
 * Essa é a função usada pelo novo fluxo sincronizado do Chat.tsx.
 */
export async function playPreparedMessageSpeech(
  messageId: string,
  text: string,
  cfg: SpeechConfig,
): Promise<void> {
  try {
    const src = await getSpeechSrc(messageId, text, cfg);

    const audio = new Audio(src);
    audio.preload = 'auto';

    audio.onended = () => {
      if (currentAudio === audio) {
        currentAudio = null;
      }
    };

    // Marca antes da reprodução para impedir duplicidade.
    playedMessageIds.add(messageId);

    await playExclusive(audio);
  } catch (err) {
    console.error(
      '[AutoSpeak] erro ao reproduzir resposta:',
      err,
    );
  }
}

/**
 * Reprodução automática tradicional.
 *
 * Mantida para mensagens existentes/históricas.
 */
export async function playMessageSpeech(
  messageId: string,
  text: string,
  cfg: SpeechConfig,
): Promise<void> {
  if (playedMessageIds.has(messageId)) return;

  await playPreparedMessageSpeech(messageId, text, cfg);
}

/**
 * Interrompe imediatamente qualquer áudio em reprodução.
 */
export function stopMessageSpeech(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

/**
 * Botão manual "Ouvir".
 */
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

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();

        if (currentAudio === audioRef.current) {
          currentAudio = null;
        }
      }
    };
  }, []);

  const attach = (audio: HTMLAudioElement) => {
    audio.onended = () => {
      setState('ended');

      if (currentAudio === audio) {
        currentAudio = null;
      }
    };

    audio.onpause = () => {
      setState((s) =>
        s === 'playing' ? 'paused' : s,
      );
    };

    audio.onplay = () => {
      setState('playing');
    };

    audio.onerror = () => {
      setState('error');
    };
  };

  const play = async (audio: HTMLAudioElement) => {
    try {
      await playExclusive(audio);
      setState('playing');
    } catch {
      setState('error');
    }
  };

  const handleClick = async () => {
    const existing = audioRef.current;

    if (state === 'playing' && existing) {
      existing.pause();
      setState('paused');
      return;
    }

    if (
      existing &&
      (state === 'paused' || state === 'ended')
    ) {
      if (state === 'ended') {
        existing.currentTime = 0;
      }

      await play(existing);
      return;
    }

    const spoken = cleanTextForSpeech(text);

    if (!spoken) return;

    setState('loading');

    try {
      const src = await getSpeechSrc(
        messageId,
        text,
        {
          voice,
          instructions,
          speed,
        },
      );

      const audio = new Audio(src);

      audio.preload = 'auto';
      audioRef.current = audio;

      attach(audio);

      await play(audio);
    } catch (err) {
      console.error(
        '[SpeakButton] TTS error:',
        err,
      );

      setState('error');
    }
  };

  const label =
    state === 'loading'
      ? 'Gerando áudio...'
      : state === 'playing'
        ? 'Pausar'
        : state === 'paused'
          ? 'Continuar'
          : state === 'ended'
            ? 'Ouvir novamente'
            : state === 'error'
              ? 'Tentar novamente'
              : 'Ouvir';

  const Icon =
    state === 'loading'
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
      disabled={state === 'loading'}
      aria-label={label}
      className="mt-1.5 inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-full text-[12px] font-medium text-muted-foreground bg-foreground/5 hover:bg-foreground/10 active:scale-[0.97] transition disabled:opacity-70"
    >
      <Icon
        className={`w-3.5 h-3.5 ${
          state === 'loading'
            ? 'animate-spin'
            : ''
        }`}
      />

      {label}
    </button>
  );
}
