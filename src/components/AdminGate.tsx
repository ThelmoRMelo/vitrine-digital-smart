import { useEffect, useState, type ReactNode } from 'react';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminLogin, adminVerify, clearAdminToken, getAdminToken, setAdminToken } from '@/lib/adminAuth';

// Protege somente as telas do painel. Vitrine, links compartilhados e chat continuam públicos.
export function AdminGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'locked' | 'open'>(() => (getAdminToken() ? 'checking' : 'locked'));
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) return;
    adminVerify(token).then((r) => {
      if (r.valid) setStatus('open');
      else if (r.valid === false) { clearAdminToken(); setStatus('locked'); }
      else setStatus('open'); // falha de rede: mantém a sessão já validada antes
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError('Informe a senha.'); return; }
    setLoading(true); setError('');
    const r = await adminLogin(password);
    setLoading(false);
    if (r.token) { setAdminToken(r.token); setPassword(''); setStatus('open'); }
    else setError(r.error || 'Senha incorreta.');
  };

  if (status === 'open') return <>{children}</>;
  if (status === 'checking') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={submit} className="glass-card rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-lg font-semibold">Acesso ao painel</h1>
          <p className="text-sm text-muted-foreground">Digite a senha do aplicativo Vitrine Digital.</p>
        </div>
        <div className="relative">
          <Input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            autoComplete="current-password"
            aria-label="Senha"
            className="pr-10"
          />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
        </Button>
      </form>
    </div>
  );
}
