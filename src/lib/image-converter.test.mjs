import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertImageToJpeg } from './image-converter.ts';

test('converts images to resized JPEG and revokes the temporary object URL', async () => {
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const operations = [];
  let canvasWidth = 0;
  let canvasHeight = 0;
  let revokedUrl = '';

  class MockImage {
    naturalWidth = 3200;
    naturalHeight = 1000;
    onload = null;
    onerror = null;
    set src(value) {
      this.source = value;
      this.onload?.();
    }
  }

  const context = {
    fillStyle: '',
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    fillRect: (...args) => operations.push(['fillRect', ...args]),
    drawImage: (...args) => operations.push(['drawImage', ...args]),
  };
  const canvas = {
    get width() { return canvasWidth; },
    set width(value) { canvasWidth = value; },
    get height() { return canvasHeight; },
    set height(value) { canvasHeight = value; },
    getContext: () => context,
    toBlob: (callback, type, quality) => {
      assert.equal(type, 'image/jpeg');
      assert.equal(quality, 0.9);
      callback(new Blob(['jpeg-data'], { type }));
    },
  };

  globalThis.Image = MockImage;
  globalThis.document = { createElement: name => {
    assert.equal(name, 'canvas');
    return canvas;
  } };
  URL.createObjectURL = () => 'blob:test-image';
  URL.revokeObjectURL = value => { revokedUrl = value; };

  try {
    const input = new File(['original'], 'product.webp', { type: 'image/webp', lastModified: 123 });
    const output = await convertImageToJpeg(input);

    assert.equal(output.name, 'product.jpg');
    assert.equal(output.type, 'image/jpeg');
    assert.equal(output.lastModified, 123);
    assert.equal(canvasWidth, 1600);
    assert.equal(canvasHeight, 500);
    assert.equal(context.fillStyle, '#FFFFFF');
    assert.equal(context.imageSmoothingEnabled, true);
    assert.equal(context.imageSmoothingQuality, 'high');
    assert.deepEqual(operations.map(operation => operation[0]), ['fillRect', 'drawImage']);
    assert.equal(revokedUrl, 'blob:test-image');
  } finally {
    globalThis.Image = originalImage;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});

test('returns non-images unchanged and safely falls back when image rendering is unavailable', async () => {
  const originalImage = globalThis.Image;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let revoked = false;

  try {
    const video = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    assert.equal(await convertImageToJpeg(video), video);

    const image = new File(['image'], 'cover.png', { type: 'image/png' });
    globalThis.Image = undefined;
    URL.createObjectURL = () => 'blob:fallback';
    URL.revokeObjectURL = () => { revoked = true; };
    assert.equal(await convertImageToJpeg(image), image);
    assert.equal(revoked, true);
  } finally {
    globalThis.Image = originalImage;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});