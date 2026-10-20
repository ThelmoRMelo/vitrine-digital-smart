export interface VideoUploadDiagnostic {
  storageStatus?: number | null;
  storageCode?: string | null;
  storageMessage?: string | null;
}

function safeMessage(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redigido]')
    .replace(/\b(?:eyJ[A-Za-z0-9_-]*\.){2}[A-Za-z0-9_-]+\b/g, '[token redigido]')
    .replace(/((?:authorization|api[_-]?key|token)\s*[:=]\s*)[^\s,;]+/gi, '$1[redigido]')
    .slice(0, 240);
}

function diagnosticSuffix(diagnostic?: VideoUploadDiagnostic): string {
  if (!diagnostic) return '';
  const status = diagnostic.storageStatus ? `HTTP ${diagnostic.storageStatus}` : null;
  const code = diagnostic.storageCode ? `código ${diagnostic.storageCode}` : null;
  const message = safeMessage(diagnostic.storageMessage);
  const details = [status, code, message].filter(Boolean).join('; ');
  return details ? ` Detalhes seguros: ${details}.` : '';
}

export function getVideoAuthorizationErrorMessage(
  status: number,
  code: string | null,
  diagnostic?: VideoUploadDiagnostic,
): string {
  if (status === 401 || code === 'admin_session_invalid') {
    return 'Sua sessão administrativa expirou. Entre novamente no painel para continuar.';
  }
  if (status === 413 || code === 'video_too_large') {
    return 'Vídeo muito grande. O limite é 20 MB por arquivo.';
  }
  if (status === 403 || code === 'video_upload_forbidden') {
    return `O acesso ao armazenamento de vídeos foi recusado. A sessão continua ativa; verifique as permissões do bucket.${diagnosticSuffix(diagnostic)}`;
  }
  if (code === 'unsupported_video_type' || status === 415) {
    return 'Formato de vídeo não suportado. Envie um arquivo MP4 ou WebM.';
  }
  if (code === 'invalid_action') {
    return 'A função admin-auth publicada no Supabase ainda não reconhece a autorização de upload de vídeo. Atualize essa função e tente novamente.';
  }
  if (code === 'video_bucket_missing') {
    return `A função informou que o bucket product-videos não foi encontrado no projeto remoto. Confira Storage > Buckets.${diagnosticSuffix(diagnostic)}`;
  }
  if (code === 'video_upload_unavailable') {
    return `O servidor não conseguiu criar a autorização de upload no Storage.${diagnosticSuffix(diagnostic)} Confira o bucket product-videos e os logs da Edge Function admin-auth.`;
  }
  if (!status) {
    return 'Não foi possível conectar ao serviço de upload. Verifique sua conexão e tente novamente.';
  }
  return `O serviço de autorização do upload respondeu com HTTP ${status}${code ? ` (${code})` : ''}.${diagnosticSuffix(diagnostic)}`;
}

export function getVideoStorageErrorMessage(
  statusCode: string | undefined,
  message: string | undefined,
  errorCode?: string,
): string {
  const parsedStatus = Number(statusCode);
  const status = Number.isFinite(parsedStatus) ? parsedStatus : 0;
  const normalizedMessage = message?.toLowerCase() ?? '';
  if (status === 413 || /file size|too large|exceed.*limit/.test(normalizedMessage)) {
    return 'O Storage recusou o vídeo por exceder o limite de 20 MB.';
  }
  if (status === 401) {
    return 'A autorização temporária do upload expirou. Tente enviar o vídeo novamente.';
  }
  if (status === 403) {
    return `O Storage recusou o upload por falta de permissão. A sessão administrativa continua ativa; verifique o acesso ao bucket de vídeos.${diagnosticSuffix({ storageStatus: status, storageCode: errorCode ?? statusCode, storageMessage: message })}`;
  }
  if (!status) {
    return 'Não foi possível conectar ao Storage. Verifique sua conexão e tente novamente.';
  }
  return `O Storage recusou o upload com HTTP ${status}.${diagnosticSuffix({ storageStatus: status, storageCode: errorCode ?? statusCode, storageMessage: message })} Confira o bucket product-videos e as políticas de acesso.`;
}
