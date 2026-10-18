import { expect, test } from 'bun:test';
import { geminiInlineAudio, geminiText, generateGeminiContent } from './gemini';

test('extrai texto estruturado do formato Gemini e rejeita conteúdo vazio', () => {
  expect(geminiText({ candidates: [{ content: { parts: [{ text: 'Olá' }, { text: ' cliente' }] } }] })).toBe('Olá cliente');
  expect(geminiText({ candidates: [] })).toBeNull();
  expect(geminiText({ candidates: [{ content: { parts: [{ text: '  ' }] } }] })).toBeNull();
});

test('extrai áudio inline sem mudar o contrato esperado pelo backend', () => {
  expect(geminiInlineAudio({ candidates: [{ content: { parts: [{ text: 'metadados' }, { inlineData: { data: 'AQID' } }] } }] })).toBe('AQID');
  expect(geminiInlineAudio({ candidates: [{ content: { parts: [] } }] })).toBeNull();
});

test('envia chave somente no header e nunca na URL ou corpo', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const fakeFetch: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response('{}', { status: 200 });
  };
  const key = 'test-secret-key';

  await generateGeminiContent(key, 'gemini-3.5-flash-lite', { contents: [] }, fakeFetch);

  expect(requestUrl).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  expect(requestUrl).not.toContain(key);
  expect(new Headers(requestInit?.headers).get('x-goog-api-key')).toBe(key);
  expect(String(requestInit?.body)).not.toContain(key);
});
