import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getYouTubeEmbedUrl, MAX_VIDEO_FILE_BYTES, normalizeProductMediaType, parseYouTubeVideoUrl, validateVideoFile, validateVideoUrl } from './product-media.ts';

const originalFetch = globalThis.fetch;

test('accepts HTTPS video URLs confirmed by Content-Type, including query parameters', async () => {
  globalThis.fetch = async () => new Response(null, { status: 200, headers: { 'content-type': 'video/mp4' } });
  const result = await validateVideoUrl('https://cdn.example.test/demo.mp4?token=abc');
  assert.deepEqual(result, { valid: true, url: 'https://cdn.example.test/demo.mp4?token=abc' });
});

test('accepts extensionless URLs only when the server confirms WebM', async () => {
  globalThis.fetch = async () => new Response(null, { status: 200, headers: { 'content-type': 'video/webm' } });
  const result = await validateVideoUrl('https://cdn.example.test/video?id=42');
  assert.equal(result.valid, true);
});

test('rejects public HTTP, streaming services, incompatible formats, and unverified servers', async () => {
  assert.deepEqual(await validateVideoUrl('http://cdn.example.test/demo.mp4'), { valid: false, reason: 'insecure' });
  assert.deepEqual(await validateVideoUrl('https://youtube.com/watch?v=abc'), { valid: false, reason: 'streaming' });
  globalThis.fetch = async () => new Response(null, { status: 200, headers: { 'content-type': 'text/html' } });
  assert.deepEqual(await validateVideoUrl('https://cdn.example.test/demo.mp4'), { valid: false, reason: 'unsupported' });
  globalThis.fetch = async () => { throw new TypeError('CORS blocked'); };
  assert.deepEqual(await validateVideoUrl('https://cdn.example.test/demo.webm'), { valid: false, reason: 'unverified' });
});

test('validates common YouTube sharing links and builds a fixed privacy-enhanced embed URL', () => {
  const expected = { videoId: 'dQw4w9WgXcQ', canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };
  for (const url of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
    'https://youtu.be/dQw4w9WgXcQ?t=12',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ?si=share',
    'https://youtube.com/embed/dQw4w9WgXcQ',
  ]) assert.deepEqual(parseYouTubeVideoUrl(url), expected);

  assert.equal(getYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&hl=pt-BR');
  assert.equal(parseYouTubeVideoUrl('https://youtube.com.attacker.test/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(parseYouTubeVideoUrl('http://youtube.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(parseYouTubeVideoUrl('https://youtube.com/watch?v=short'), null);
  assert.equal(parseYouTubeVideoUrl('https://youtube.com/watch?v=dQw4w9WgXcQ&v=attacker'), null);
});

test('validates MP4 and WebM by file contents, not only by extension', async () => {
  const mp4Bytes = new Uint8Array(16);
  mp4Bytes.set([0x66, 0x74, 0x79, 0x70], 4);
  const webmBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00]);
  assert.equal(await validateVideoFile(new File([mp4Bytes], 'valid.mp4', { type: 'video/mp4' })), true);
  assert.equal(await validateVideoFile(new File([webmBytes], 'valid.webm', { type: 'video/webm' })), true);
  assert.equal(await validateVideoFile(new File([new Uint8Array(16)], 'fake.mp4', { type: 'video/mp4' })), false);
  assert.equal(await validateVideoFile(new File([mp4Bytes], 'mismatch.webm', { type: 'video/mp4' })), false);
  const atLimit = { name: 'limit.mp4', type: 'video/mp4', size: MAX_VIDEO_FILE_BYTES, slice: () => new Blob([mp4Bytes]) };
  const overLimit = { ...atLimit, size: MAX_VIDEO_FILE_BYTES + 1 };
  assert.equal(await validateVideoFile(atLimit), true);
  assert.equal(await validateVideoFile(overLimit), false);
  assert.equal(MAX_VIDEO_FILE_BYTES, 20 * 1024 * 1024);
});

test('derives YouTube media type from the URL when media_type is absent', () => {
  assert.equal(normalizeProductMediaType(undefined), 'image');
  assert.equal(normalizeProductMediaType(null), 'image');
  assert.equal(normalizeProductMediaType(undefined, 'https://youtu.be/dQw4w9WgXcQ'), 'youtube');
  assert.equal(normalizeProductMediaType(null, 'https://youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
  assert.equal(normalizeProductMediaType('image', 'https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'youtube');
  assert.equal(normalizeProductMediaType(undefined, 'https://attacker.test/watch?v=dQw4w9WgXcQ'), 'image');
  assert.equal(normalizeProductMediaType('video'), 'video_upload');
  assert.equal(normalizeProductMediaType('video_upload'), 'video_upload');
  assert.equal(normalizeProductMediaType('youtube'), 'youtube');
  assert.equal(normalizeProductMediaType('unexpected'), 'image');
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
