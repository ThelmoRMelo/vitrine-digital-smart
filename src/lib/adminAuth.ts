import { supabase } from '@/integrations/supabase/client';

// Guarda apenas o token de sessão assinado pelo servidor — nunca a senha.
const TOKEN_KEY = 'vitrine_admin_session';

export const getAdminToken = () => localStorage.getItem(TOKEN_KEY);
export const setAdminToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearAdminToken = () => localStorage.removeItem(TOKEN_KEY);

type Result = { token?: string; valid?: boolean; success?: boolean; error?: string };

async function call(body: Record<string, unknown>): Promise<Result> {
  const { data, error } = await supabase.functions.invoke('admin-auth', { body });
  if (data) return data as Result;
  // Respostas 4xx trazem a mensagem amigável no corpo
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try { return (await ctx.json()) as Result; } catch { /* ignore */ }
  }
  return { error: 'Não foi possível conectar. Tente novamente.' };
}

export const adminLogin = (password: string) => call({ action: 'login', password });
export const adminVerify = (token: string) => call({ action: 'verify', token });
export const adminChangePassword = (currentPassword: string, newPassword: string) =>
  call({ action: 'change', token: getAdminToken(), currentPassword, newPassword });
