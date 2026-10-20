import { useMemo, useState } from 'react';
import { Star, MessageSquareText, PenSquare, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ReviewStars } from './ReviewStars';
import { ReviewItem } from './ReviewItem';
import { ReviewForm } from './ReviewForm';
import { useProductReviews, useReviewStats } from '@/hooks/useProductReviews';
import { cn } from '@/lib/utils';

interface Props {
  productId: string;
  tenantId?: string | null;
  className?: string;
  compact?: boolean;
}

const PAGE_SIZE = 3;

export function ReviewsSummaryModal({ productId, tenantId, className, compact = false }: Props) {
  const stats = useReviewStats(productId);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [filter, setFilter] = useState<number | null>(null);

  // Lazy: only fetch the full list when the modal is opened
  const { reviews, loading, markHelpful, refetch } = useProductReviews({
    productId,
    onlyApproved: true,
    enabled: open,
  });

  const filtered = useMemo(
    () => (filter ? reviews.filter((r) => r.stars === filter) : reviews),
    [reviews, filter]
  );

  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  return (
    <div className={cn('w-full', className)}>
      {/* Compact summary */}
      <div className={`glass-card rounded-2xl ${compact ? 'p-2 flex flex-row flex-wrap items-center gap-x-2 gap-y-1' : 'p-4 flex flex-col sm:flex-row sm:items-center gap-4'}`}>
        <div className="flex items-center gap-3">
          <div className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold gradient-text leading-none`}>
            {stats.average ? stats.average.toFixed(1) : '—'}
          </div>
          <div className="flex flex-col">
            <ReviewStars value={stats.average} size={compact ? 14 : 16} />
            <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-muted-foreground mt-0.5`}>
              {stats.total} {stats.total === 1 ? 'avaliação' : 'avaliações'}
            </span>
          </div>
        </div>

        {stats.total > 0 && (
          <div className="flex-1 hidden sm:block space-y-1">
            {[5, 4, 3, 2, 1].map((s) => {
              const count = stats.distribution[s] || 0;
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={s} className="flex items-center gap-2 text-[11px]">
                  <span className="w-2 text-muted-foreground">{s}</span>
                  <Star className="w-2.5 h-2.5 fill-primary text-primary shrink-0" />
                  <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-secondary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-muted-foreground">{pct}%</span>
                </div>
              );
            })}
          </div>
        )}

        <div className={`flex gap-1.5 ${compact ? 'w-full sm:w-auto' : 'sm:flex-col sm:w-auto'}`}>
          <Button
            variant="outline"
            size="sm"
            className={`${compact ? 'gap-1 flex-1 px-2' : 'gap-2 flex-1 sm:flex-none'}`}
            aria-label={compact ? 'Ver avaliações' : undefined}
            onClick={() => setOpen(true)}
          >
            <MessageSquareText className="w-4 h-4" />
            {compact ? 'Avaliações' : 'Ver avaliações'}
          </Button>
          <ReviewForm productId={productId} tenantId={tenantId} onSubmitted={refetch} compact={compact} />
        </div>
      </div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 fill-primary text-primary" />
              Avaliações dos clientes
            </DialogTitle>
          </DialogHeader>

          {/* Header stats */}
          <div className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-4">
            <div>
              <div className="text-4xl font-bold gradient-text leading-none">
                {stats.average ? stats.average.toFixed(1) : '—'}
              </div>
              <ReviewStars value={stats.average} size={16} />
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total} {stats.total === 1 ? 'avaliação' : 'avaliações'}
              </p>
            </div>
            {stats.total > 0 && (
              <div className="flex-1 min-w-[180px] space-y-1">
                {[5, 4, 3, 2, 1].map((s) => {
                  const count = stats.distribution[s] || 0;
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        setFilter(filter === s ? null : s);
                        setVisible(PAGE_SIZE);
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 text-xs hover:opacity-80 transition',
                        filter === s && 'opacity-100',
                        filter && filter !== s && 'opacity-50'
                      )}
                    >
                      <span className="w-2 text-muted-foreground">{s}</span>
                      <Star className="w-3 h-3 fill-primary text-primary shrink-0" />
                      <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-secondary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-muted-foreground">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Filter chips */}
          {stats.total > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter(null)}
                className={cn(
                  'text-xs px-3 py-1 rounded-full border transition',
                  filter === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                )}
              >
                Todas
              </button>
              {[5, 4, 3, 2, 1].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setFilter(filter === s ? null : s);
                    setVisible(PAGE_SIZE);
                  }}
                  className={cn(
                    'text-xs px-3 py-1 rounded-full border transition inline-flex items-center gap-1',
                    filter === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {s} <Star className="w-3 h-3 fill-current" />
                </button>
              ))}
            </div>
          )}

          {/* Reviews list */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground">
                {filter
                  ? 'Nenhuma avaliação com essa nota ainda.'
                  : 'Ainda não há avaliações. Seja o primeiro a avaliar!'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {shown.map((r) => (
                <ReviewItem key={r.id} review={r} onHelpful={markHelpful} />
              ))}
              {hasMore && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                >
                  Carregar mais avaliações ({filtered.length - visible} restantes)
                </Button>
              )}
            </div>
          )}

          <div className="pt-2 flex justify-center border-t border-border/40">
            <ReviewForm productId={productId} tenantId={tenantId} onSubmitted={refetch} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
