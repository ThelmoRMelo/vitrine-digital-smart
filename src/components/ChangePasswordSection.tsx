import { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { adminChangePassword, setAdminToken } from '@/lib/adminAuth';
import { toast } from 'sonner';

function PasswordField({ id, label, value, onChange, autoComplete }: {
  id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={show ? 'text' : 'password'} value={value} autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)} className="pr-10" />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export function ChangePasswordSection() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setError(''); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !next || !confirm) return setError('Preencha todos os campos.');
    if (next.length < 8) return setError('A nova senha deve ter pelo menos 8 caracteres.');
    if (next !== confirm) return setError('A nova senha e a confirmação não coincidem.');
    if (next === current) return setError('A nova senha deve ser diferente da atual.');
    setSaving(true); setError('');
    const r = await adminChangePassword(current, next);
    setSaving(false);
    if (r.success && r.token) {
      setAdminToken(r.token);
      toast.success('Senha do aplicativo alterada com sucesso!');
      reset(); setOpen(false);
    } else setError(r.error || 'Não foi possível alterar a senha.');
  };

  return (
    <>
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Segurança do aplicativo</h3>
            <p className="text-sm text-muted-foreground">Gerencie a senha de acesso ao aplicativo Vitrine Digital.</p>
          </div>
        </div>
        <Button variant="gradient" className="w-full" onClick={() => setOpen(true)}>
          <Lock className="w-4 h-4" />
          Alterar senha de acesso
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Alterar senha do aplicativo</DialogTitle>
            <DialogDescription>A nova senha passa a valer imediatamente.</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <PasswordField id="pw-current" label="Senha atual" value={current} onChange={setCurrent} autoComplete="current-password" />
            <PasswordField id="pw-new" label="Nova senha" value={next} onChange={setNext} autoComplete="new-password" />
            <PasswordField id="pw-confirm" label="Confirmar nova senha" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" variant="gradient" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar nova senha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
