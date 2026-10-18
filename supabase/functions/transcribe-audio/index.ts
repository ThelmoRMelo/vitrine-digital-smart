// Edge Function: transcribe-audio
// Recebe áudio (multipart/form-data), valida e devolve { text }
// A chave da API nunca sai do servidor.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { geminiApiKey, geminiJson, geminiText, generateGeminiContent } from '../_shared/gemini.ts';

const MAX_BYTES = 8 * 1024 * 1024; // ~8MB (60s de voz cabe folgado)
const ALLOWED = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/mpga',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/aac',
  'audio/x-m4a',
  'audio/m4a',
  'video/mp4', // alguns navegadores rotulam gravação mp4 assim
  'video/webm',
];

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
    console.error('[transcribe-audio] GEMINI_API_KEY ausente');
    return json({ error: 'Serviço de transcrição não configurado.' }, 500);
  }

  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return json({ error: 'Envie o áudio como multipart/form-data.' }, 400);
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const raw = form.get('file');
    if (raw instanceof File) file = raw;
  } catch (err) {
    console.error('[transcribe-audio] formData error:', err);
    return json({ error: 'Não foi possível ler o áudio enviado.' }, 400);
  }

  if (!file) return json({ error: 'Nenhum áudio recebido.' }, 400);
  if (file.size < 1024) return json({ error: 'Gravação muito curta ou vazia.' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'Áudio muito grande. Grave até 60 segundos.' }, 400);

  // Não confiar apenas no MIME do cliente: normalizar e validar
  const clientMime = (file.type || '').split(';')[0].toLowerCase();
  if (clientMime && !ALLOWED.includes(clientMime)) {
    return json({ error: 'Formato de áudio não suportado.' }, 400);
  }

  // Sniff básico do conteúdo para checar que é mesmo áudio conhecido
  const bytes = new Uint8Array(await file.arrayBuffer());
  const head = bytes.subarray(0, 16);
  const ascii = (i: number, n: number) =>
    Array.from(head.subarray(i, i + n)).map((b) => String.fromCharCode(b)).join('');
  let sniffed: string | null = null;
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) sniffed = 'webm';
  else if (ascii(0, 4) === 'OggS') sniffed = 'ogg';
  else if (ascii(4, 4) === 'ftyp') sniffed = 'mp4';
  else if (ascii(0, 4) === 'RIFF') sniffed = 'wav';
  else if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) sniffed = 'mp3';
  else if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) sniffed = 'mp3';

  if (!sniffed) {
    return json({ error: 'Arquivo de áudio inválido ou corrompido.' }, 400);
  }

  const mimeByFormat: Record<string, string> = {
    webm: 'audio/webm', ogg: 'audio/ogg', mp4: 'audio/mp4',
    wav: 'audio/wav', mp3: 'audio/mpeg',
  };
  const mimeType = mimeByFormat[sniffed];
  let uploadedFileName: string | null = null;
  try {
    const baseUrl = 'https://generativelanguage.googleapis.com';
    const start = await fetch(`${baseUrl}/upload/v1beta/files`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: 'ania-audio-transcription' } }),
      signal: AbortSignal.timeout(30_000),
    });
    const uploadUrl = start.headers.get('x-goog-upload-url');
    if (!start.ok || !uploadUrl || !uploadUrl.startsWith(`${baseUrl}/`)) {
      console.error('[transcribe-audio] Gemini upload initialization failed:', start.status);
      if (start.status === 429) {
        return json({ error: 'Muitas gravações em sequência. Aguarde alguns segundos.' }, 429);
      }
      if (start.status === 401 || start.status === 403) {
        return json({ error: 'Transcrição indisponível no momento.' }, 503);
      }
      return json({ error: 'Não consegui transcrever esse áudio. Tente novamente.' }, 502);
    }

    const upload = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
        'Content-Type': mimeType,
      },
      body: bytes,
      signal: AbortSignal.timeout(45_000),
    });
    const uploaded = await geminiJson(upload) as { file?: { name?: string; uri?: string; mimeType?: string } } | null;
    const fileUri = uploaded?.file?.uri;
    uploadedFileName = uploaded?.file?.name || null;
    if (!upload.ok || !fileUri || !uploadedFileName || !/^files\/[A-Za-z0-9_-]+$/.test(uploadedFileName)) {
      console.error('[transcribe-audio] Gemini upload finalization failed:', upload.status);
      if (upload.status === 429) return json({ error: 'Muitas gravações em sequência. Aguarde alguns segundos.' }, 429);
      return json({ error: 'Não consegui transcrever esse áudio. Tente novamente.' }, 502);
    }

    const res = await generateGeminiContent(apiKey, 'gemini-3.5-transcribe', {
      contents: [{ parts: [{ fileData: { fileUri, mimeType: uploaded.file?.mimeType || mimeType } }] }],
      generationConfig: { audioTranscriptionConfig: { languageCodes: ['pt-BR'] } },
    });
    if (!res.ok) {
      console.error('[transcribe-audio] Gemini transcription failed:', res.status);
      if (res.status === 429) return json({ error: 'Muitas gravações em sequência. Aguarde alguns segundos.' }, 429);
      if (res.status === 401 || res.status === 403) return json({ error: 'Transcrição indisponível no momento.' }, 503);
      return json({ error: 'Não consegui transcrever esse áudio. Tente novamente.' }, 502);
    }

    const text = geminiText(await geminiJson(res));

    if (!text) {
      return json({ error: 'Nenhuma fala foi identificada.' }, 422);
    }

    return json({ text });
  } catch (err) {
    console.error('[transcribe-audio] Gemini request failed');
    return json({ error: 'Não consegui transcrever esse áudio. Tente novamente.' }, 500);
  } finally {
    if (uploadedFileName) {
      try {
        const cleanup = await fetch(`https://generativelanguage.googleapis.com/v1beta/${uploadedFileName}`, {
          method: 'DELETE',
          headers: { 'x-goog-api-key': apiKey },
          signal: AbortSignal.timeout(10_000),
        });
        if (!cleanup.ok) console.warn('[transcribe-audio] Uploaded file cleanup failed:', cleanup.status);
      } catch {
        console.warn('[transcribe-audio] Uploaded file cleanup request failed');
      }
    }
  }
});
