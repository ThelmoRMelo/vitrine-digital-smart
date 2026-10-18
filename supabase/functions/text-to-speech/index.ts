// Edge Function: text-to-speech
// Recebe { text } e devolve { audio: base64 mp3, mimeType }
// A chave da API nunca sai do servidor.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { geminiApiKey, geminiInlineAudio, geminiJson, generateGeminiContent } from '../_shared/gemini.ts';

// ---- 🎙️ CONFIGURAÇÃO DE VOZ PADRÃO DA ANIA ----
const TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const DEFAULT_VOICE = 'coral'; // Voz feminina, calorosa e suave
const DEFAULT_INSTRUCTIONS = 'Fale em pt-BR com voz feminina jovem, suave e acolhedora. Use ritmo natural, pausas leves e tom simpático, claro e expressivo.';
const DEFAULT_SPEED = 1;

// Vozes realmente suportadas pelo modelo acima
const ALLOWED_VOICES = new Set([
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
]);

// Mantém os valores já salvos nas configurações e os associa às vozes Gemini.
const GEMINI_VOICES: Record<string, string> = {
  coral: 'Aoede', nova: 'Kore', shimmer: 'Zephyr', sage: 'Callirrhoe',
  alloy: 'Charon', ash: 'Fenrir', ballad: 'Sulafat', echo: 'Orus',
  fable: 'Schedar', onyx: 'Algenib', verse: 'Gacrux',
};

const SPEED_MIN = 0.5;
const SPEED_MAX = 2;
const MAX_INSTRUCTIONS_CHARS = 180;
// ------------------------------------------------

const MAX_CHARS = 600;

function json(body: unknown, status = 200, cacheControl = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl,
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compactInstructions(value: string): string {
  const normalized = value.trim();
  if (!normalized) return DEFAULT_INSTRUCTIONS;

  // Compacta as instruções longas que já foram salvas pelas versões anteriores.
  if (/voz feminina, suave, calorosa e acolhedora/i.test(normalized)) {
    return DEFAULT_INSTRUCTIONS;
  }
  if (/como uma amiga conversando/i.test(normalized)) {
    return 'Fale em pt-BR com tom leve, animado e simpático, como uma amiga. Use ritmo natural e entonação variada, sem exageros.';
  }
  if (/atendente experiente/i.test(normalized)) {
    return 'Fale em pt-BR com tom claro, seguro e objetivo, como uma atendente experiente. Use boa dicção e cordialidade.';
  }
  if (/como quem cuida de quem/i.test(normalized)) {
    return 'Fale em pt-BR com tom calmo, gentil e empático. Use pausas suaves e transmita paciência e atenção.';
  }
  if (/persuasivo, com energia e confiança/i.test(normalized)) {
    return 'Fale em pt-BR com energia e confiança. Destaque benefícios sem pressionar nem soar artificial.';
  }

  if (normalized.length <= MAX_INSTRUCTIONS_CHARS) return normalized;
  const prefix = normalized.slice(0, MAX_INSTRUCTIONS_CHARS);
  const sentenceEnd = Math.max(prefix.lastIndexOf('. '), prefix.lastIndexOf('! '), prefix.lastIndexOf('? '));
  const boundary = sentenceEnd > 0 ? sentenceEnd + 1 : prefix.lastIndexOf(' ');
  return prefix.slice(0, boundary > 0 ? boundary : MAX_INSTRUCTIONS_CHARS).trimEnd();
}

function truncateAtSentence(text: string): string {
  if (text.length <= MAX_CHARS) return text;

  const prefix = text.slice(0, MAX_CHARS);
  const sentenceEnds = [...prefix.matchAll(/[.!?](?:["'’”)}\]]*)?(?=\s|$)/gu)];
  const lastSentenceEnd = sentenceEnds.at(-1)?.index;
  if (lastSentenceEnd !== undefined && lastSentenceEnd > 0) {
    return `${prefix.slice(0, lastSentenceEnd).trimEnd()}…`;
  }

  const wordBoundary = prefix.lastIndexOf(' ', MAX_CHARS - 2);
  return `${prefix.slice(0, wordBoundary > 0 ? wordBoundary : MAX_CHARS - 1).trimEnd()}…`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido' }, 405);
  }

  const apiKey = geminiApiKey();
  if (!apiKey) {
    console.error('[text-to-speech] GEMINI_API_KEY ausente');
    return json({ error: 'Serviço de voz não configurado.', code: 'service_not_configured' }, 503);
  }

  let text = '';
  let voice = DEFAULT_VOICE;
  let instructions = DEFAULT_INSTRUCTIONS;
  let speed = DEFAULT_SPEED;

  try {
    const parsed: unknown = await req.json();
    if (!isRecord(parsed)) return json({ error: 'Corpo da requisição inválido.', code: 'invalid_request' }, 400);
    const body = parsed;
    text = typeof body.text === 'string' ? body.text.trim() : '';

    // Parâmetros opcionais — chamadas antigas (somente { text }) continuam válidas
    if (typeof body.voice === 'string') {
      const v = body.voice.trim().toLowerCase();
      if (!ALLOWED_VOICES.has(v)) {
        return json({ error: 'Voz não suportada.', code: 'unsupported_voice' }, 400);
      }
      voice = v;
    }

    if (typeof body.instructions === 'string' && body.instructions.trim()) {
      instructions = compactInstructions(body.instructions);
    }

    if (body.speed !== undefined && body.speed !== null) {
      const s = Number(body.speed);
      if (!Number.isFinite(s)) {
        return json({ error: 'Velocidade inválida.', code: 'invalid_speed' }, 400);
      }
      speed = Math.min(SPEED_MAX, Math.max(SPEED_MIN, s));
    }
  } catch {
    return json({ error: 'Corpo da requisição inválido.', code: 'invalid_request' }, 400);
  }

  if (!text) return json({ error: 'Nenhum texto para falar.', code: 'empty_text' }, 400);
  text = truncateAtSentence(text);

  try {
    const pace = speed < 0.9 ? 'Fale um pouco mais devagar.' : speed > 1.1 ? 'Fale um pouco mais rápido.' : 'Use ritmo natural.';
    const res = await generateGeminiContent(apiKey, TTS_MODEL, {
      contents: [{
        role: 'user',
        parts: [{
          text,
          speech_metadata: { style: `${instructions} ${pace}`.slice(0, MAX_INSTRUCTIONS_CHARS + 40) },
        }],
      }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { voice: GEMINI_VOICES[voice] } },
      },
    }, fetch, req.signal);


    if (!res.ok) {
      console.error('[text-to-speech] Gemini returned HTTP', res.status);
      if (res.status === 429) {
        return json({ error: 'Muitos áudios em sequência. Aguarde alguns segundos.', code: 'rate_limited' }, 429);
      }
      if (res.status === 401 || res.status === 403) {
        return json({ error: 'Áudio indisponível no momento.', code: 'provider_unavailable' }, 503);
      }
      return json({ error: 'Não consegui gerar o áudio. Tente novamente.', code: 'provider_error' }, 502);
    }

    const audio = geminiInlineAudio(await geminiJson(res));
    if (!audio) {
      return json({ error: 'Não consegui gerar o áudio. Tente novamente.', code: 'invalid_provider_response' }, 502);
    }

    return json(
      { audio, mimeType: 'audio/wav' },
      200,
      'private, max-age=86400, stale-while-revalidate=3600',
    );
  } catch {
    if (req.signal.aborted) {
      return json({ error: 'Geração de áudio cancelada.', code: 'cancelled' }, 503);
    }
    console.error('[text-to-speech] Gemini request failed');
    return json({ error: 'Não consegui gerar o áudio. Tente novamente.', code: 'provider_unavailable' }, 503);
  }
});
