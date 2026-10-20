import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getVideoAuthorizationErrorMessage, getVideoStorageErrorMessage } from './video-upload-errors.ts';

test('reports session expiry only for an invalid administrative token', () => {
  assert.match(getVideoAuthorizationErrorMessage(401, 'admin_session_invalid'), /sessão administrativa expirou/i);
  assert.doesNotMatch(getVideoAuthorizationErrorMessage(200, null), /entre novamente/i);
});

test('distinguishes permission, size, and connectivity failures', () => {
  assert.match(getVideoAuthorizationErrorMessage(403, 'video_upload_forbidden'), /permissões do bucket/i);
  assert.match(getVideoAuthorizationErrorMessage(413, 'video_too_large'), /20 MB/i);
  assert.match(getVideoAuthorizationErrorMessage(0, null), /conexão/i);
  assert.match(getVideoStorageErrorMessage('403', 'Forbidden'), /continua ativa/i);
  assert.match(getVideoStorageErrorMessage('413', 'Payload too large'), /20 MB/i);
  assert.match(getVideoStorageErrorMessage(undefined, undefined), /conexão/i);
});
