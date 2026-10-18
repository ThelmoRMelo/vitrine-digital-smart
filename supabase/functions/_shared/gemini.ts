const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function geminiApiKey(): string | null {
  const key = Deno.env.get('GEMINI_API_KEY')?.trim();
  return key || null;
}

export async function generateGeminiContent(
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
  requestSignal?: AbortSignal,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(45_000);
  const signal = requestSignal
    ? AbortSignal.any([timeoutSignal, requestSignal])
    : timeoutSignal;

  return fetchImpl(`${API_BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });
}

export function geminiText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }).candidates;
  const text = candidates?.[0]?.content?.parts
    ?.map((part) => typeof part.text === 'string' ? part.text : '')
    .join('')
    .trim();
  return text || null;
}

export function geminiInlineAudio(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: unknown } }> } }> }).candidates;
  const data = candidates?.[0]?.content?.parts
    ?.map((part) => part.inlineData?.data)
    .find((value): value is string => typeof value === 'string' && value.length > 0);
  return data || null;
}

export async function geminiJson(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
