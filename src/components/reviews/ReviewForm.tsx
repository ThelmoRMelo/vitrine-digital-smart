import { useState } from 'react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ReviewStars } from './ReviewStars';
import { toast } from 'sonner';
import { PenSquare, Loader2 } from 'lucide-react';
import { useProductReviews } from '@/hooks/useProductReviews';

const schema = z.object({
  customer_name: z.string().trim().min(2, 'Nome muito curto').max(80, 'Nome muito longo'),
  comment: z.string().trim().min(5, 'Comentário muito curto').max(1000, 'Comentário muito longo'),
  stars: z.number().int().min(1).max(5),
});

interface ReviewFormProps {
  productId: string;
  tenantId?: string | null;
  onSubmitted?: () => void;
  compact?: boolean;
}

export function ReviewForm({ productId, tenantId, onSubmitted, compact = false }: ReviewFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [stars, setStars] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const { submitReview } = useProductReviews({ productId, onlyApproved: true, enabled: false });

  const reset = () => {
    setName('');
    setComment('');
    setStars(0);
  };

  const handleSubmit = async () => {
    const parsed = schema.safeParse({ customer_name: name, comment, stars });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Dados inválidos');
      return;
    }
    // Rate-limit local: 1 envio por produto a cada 60s
    const key = `review_last_${productId}`;
    const last = Number(localStorage.getItem(key) || '0');
    if (Date.now() - last < 60_000) {
      toast.error('Aguarde um momento antes de enviar outra avaliação.');
      return;
    }

    setSubmitting(true);
    try {
      await submitReview({
        product_id: productId,
        customer_name: parsed.data.customer_name,
        comment: parsed.data.comment,
        stars: parsed.data.stars,
        tenant_id: tenantId ?? null,
      });
      localStorage.setItem(key, String(Date.now()));
      toast.success('Avaliação enviada!', {
        description: 'Será publicada após aprovação do administrador.',
      });
      reset();
      setOpen(false);
      onSubmitted?.();
    } catch (e: any) {
      toast.error('Erro ao enviar avaliação', { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="gradient"
          size="sm"
          className={compact ? 'gap-1 px-2' : 'gap-2'}
          aria-label={compact ? 'Deixar avaliação' : undefined}
        >
          <PenSquare className="w-4 h-4" />
          {compact ? 'Avaliar' : 'Deixar avaliação'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deixar avaliação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Seu nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Maria Silva" maxLength={80} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Sua nota</label>
            <ReviewStars value={stars} onChange={setStars} size={28} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Comentário</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Conte sua experiência com o produto..."
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-1">{comment.length}/1000</p>
          </div>
          <Button onClick={handleSubmit} disabled={submitting} variant="gradient" className="w-full">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar avaliação'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Sua avaliação passará por moderação antes de ser publicada.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
