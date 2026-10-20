export function getVideoAuthorizationErrorMessage(status: number, code: string | null): string {
  if (status === 401 || code === 'admin_session_invalid') {
    return 'Sua sessão administrativa expirou. Entre novamente no painel para continuar.';
  }
  if (status === 413 || code === 'video_too_large') {
    return 'Vídeo muito grande. O limite é 20 MB por arquivo.';
  }
  if (status === 403 || code === 'video_upload_forbidden') {
    return 'O acesso ao armazenamento de vídeos foi recusado. A sessão continua ativa; verifique as permissões do bucket.';
  }
  if (code === 'unsupported_video_type' || status === 415) {
    return 'Formato de vídeo não suportado. Envie um arquivo MP4 ou WebM.';
  }
  if (!status) {
    return 'Não foi possível conectar ao serviço de upload. Verifique sua conexão e tente novamente.';
  }
  return 'Não foi possível preparar o upload. Tente novamente ou verifique a configuração do Storage.';
}

export function getVideoStorageErrorMessage(statusCode: string | undefined, message: string | undefined): string {
  const status = Number(statusCode);
  const normalizedMessage = message?.toLowerCase() ?? '';
  if (status === 413 || /file size|too large|exceed.*limit/.test(normalizedMessage)) {
    return 'O Storage recusou o vídeo por exceder o limite de 20 MB.';
  }
  if (status === 401) {
    return 'A autorização temporária do upload expirou. Tente enviar o vídeo novamente.';
  }
  if (status === 403) {
    return 'O Storage recusou o upload por falta de permissão. A sessão administrativa continua ativa; verifique o acesso ao bucket de vídeos.';
  }
  if (!status) {
    return 'Não foi possível conectar ao Storage. Verifique sua conexão e tente novamente.';
  }
  return 'O Storage não conseguiu receber o vídeo. Verifique a configuração do bucket e tente novamente.';
}
