// Edge Function: text-to-speech
// Recebe { text } e devolve { audio: base64 mp3, mimeType }
// A chave da API nunca sai do servidor.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { geminiApiKey, geminiInlineAudio, geminiJson, generateGeminiContent } from '../_shared/gemini.ts';

// ---- 🎙️ CONFIGURAÇÃO DE VOZ PADRÃO DA ANIA ----
const TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const DEFAULT_VOICE = 'coral'; // Voz feminina, calorosa e suave
const DEFAULT_INSTRUCTIONS =
  'Fale em português do Brasil com uma voz feminina, suave, calorosa e acolhedora. Tom jovem-adulto, sereno e expressivo. Fale de forma natural, conversacional, com ritmo calmo e agradável, como uma assistente amigável conversando de verdade. Use entonação leve, pausas naturais e variação de tom. Não soe robótica, nem muito rápida, nem infantil. Seja clara, simpática e atenciosa em cada frase.';
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
const MAX_INSTRUCTIONS_CHARS = 1500;
// ------------------------------------------------

const MAX_CHARS = 1200;


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
    return json({ error: 'Serviço de voz não configurado.' }, 500);
  }

  let text = '';
  let voice = DEFAULT_VOICE;
  let instructions = DEFAULT_INSTRUCTIONS;
  let speed = DEFAULT_SPEED;

  try {
    const body = await req.json();
    text = typeof body?.text === 'string' ? body.text.trim() : '';

    // Parâmetros opcionais — chamadas antigas (somente { text }) continuam válidas
    if (typeof body?.voice === 'string') {
      const v = body.voice.trim().toLowerCase();
      if (!ALLOWED_VOICES.has(v)) {
        return json({ error: 'Voz não suportada.' }, 400);
      }
      voice = v;
    }

    if (typeof body?.instructions === 'string' && body.instructions.trim()) {
      instructions = body.instructions.trim().slice(0, MAX_INSTRUCTIONS_CHARS);
    }

    if (body?.speed !== undefined && body?.speed !== null) {
      const s = Number(body.speed);
      if (!Number.isFinite(s)) {
        return json({ error: 'Velocidade inválida.' }, 400);
      }
      speed = Math.min(SPEED_MAX, Math.max(SPEED_MIN, s));
    }
  } catch {
    return json({ error: 'Corpo da requisição inválido.' }, 400);
  }

  if (!text) return json({ error: 'Nenhum texto para falar.' }, 400);
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);

  try {
    const pace = speed < 0.9 ? 'Fale um pouco mais devagar.' : speed > 1.1 ? 'Fale um pouco mais rápido.' : 'Use ritmo natural.';
    const res = await generateGeminiContent(apiKey, TTS_MODEL, {
      contents: [{
        role: 'user',
        parts: [{
          text,
          speech_metadata: { style: `${instructions} ${pace}`.slice(0, MAX_INSTRUCTIONS_CHARS + 100) },
        }],
      }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { voice: GEMINI_VOICES[voice] } },
      },
    });


    if (!res.ok) {
      console.error('[text-to-speech] Gemini returned HTTP', res.status);
      if (res.status === 429) {
        return json({ error: 'Muitos áudios em sequência. Aguarde alguns segundos.' }, 429);
      }
      if (res.status === 401 || res.status === 403) {
        return json({ error: 'Áudio indisponível no momento.' }, 503);
      }
      return json({ error: 'Não consegui gerar o áudio. Tente novamente.' }, 502);
    }

    const audio = geminiInlineAudio(await geminiJson(res));
    if (!audio) {
      return json({ error: 'Não consegui gerar o áudio. Tente novamente.' }, 502);
    }

    return json({ audio, mimeType: 'audio/wav' });
  } catch (err) {
    console.error('[text-to-speech] Gemini request failed');
    return json({ error: 'Não consegui gerar o áudio. Tente novamente.' }, 500);
  }
});
