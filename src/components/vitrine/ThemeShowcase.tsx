import { Link } from 'react-router-dom';
import {
  Heart,
  Briefcase,
  Smartphone,
  GraduationCap,
  MessageCircle,
  Stethoscope,
  Tag,
  PawPrint,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';
import type { ThemeConfig } from '@/lib/themes';
import type { Niche } from '@/hooks/useNiches';

interface ThemeShowcaseProps {
  theme: ThemeConfig;
  chatPath: string;
  niches?: Niche[];
  nichesLoading?: boolean;
  selectedNicheSlug?: string | null;
  onSelectNiche?: (slug: string) => void;
  onClearNiche?: () => void;
}

// Ícones disponíveis para os nichos (nome salvo no banco -> componente)
const iconMap: Record<string, LucideIcon> = {
  Stethoscope,
  Heart,
  Briefcase,
  Smartphone,
  GraduationCap,
  MessageCircle,
  Tag,
  PawPrint,
};

export function ThemeShowcase({
  theme,
  chatPath,
  niches,
  nichesLoading,
  selectedNicheSlug,
  onSelectNiche,
  onClearNiche,
}: ThemeShowcaseProps) {
  // Fonte única: tabela niches; somente os habilitados para a Landing
  const items = (niches ?? []).filter((n) => n.show_on_landing).map((n) => ({
    slug: n.slug,
    name: n.name,
    icon: iconMap[n.icon || 'Tag'] ?? Tag,
    color: n.color || 'hsl(190, 100%, 50%)',
  }));

  if (!nichesLoading && items.length === 0) return null;

  return (
    <section className="py-12 md:py-16">
      <div className="text-center mb-10">
        <h2
          className="text-2xl md:text-3xl font-bold mb-3"
          style={{ fontFamily: `'${theme.fonts.heading}', sans-serif` }}
        >
          Explore por Nicho
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Toque em um nicho para ver somente os produtos daquela área
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-6 md:gap-10">
        <button
          type="button"
          onClick={() => onClearNiche?.()}
          aria-pressed={!selectedNicheSlug}
          aria-label="Ver todos os produtos"
        >
          <div className="flex flex-col items-center gap-3 group cursor-pointer">
            <div
              className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center bg-primary/10 transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow ${
                !selectedNicheSlug ? 'ring-2 ring-primary scale-110 shadow-glow' : ''
              }`}
            >
              <LayoutGrid className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            </div>
            <span className={`text-sm font-medium ${!selectedNicheSlug ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
              Todos os produtos
            </span>
          </div>
        </button>
        {items.map((niche) => {
          const isSelected = selectedNicheSlug === niche.slug;

          const visual = (
            <div className="flex flex-col items-center gap-3 group cursor-pointer">
              <div
                className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow ${
                  isSelected ? 'ring-2 ring-primary scale-110 shadow-glow' : ''
                }`}
                style={{ backgroundColor: `${niche.color}20` }}
              >
                <niche.icon
                  className="w-8 h-8 md:w-10 md:h-10 transition-colors"
                  style={{ color: niche.color }}
                />
              </div>
              <span
                className={`text-sm font-medium transition-colors ${
                  isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                }`}
              >
                {niche.name}
              </span>
            </div>
          );

          // "Atendimento" continua levando ao chat da ANIA
          if (niche.slug === 'atendimento') {
            return (
              <Link key={niche.slug} to={chatPath} aria-label={`Falar com a ANIA (${niche.name})`}>
                {visual}
              </Link>
            );
          }

          return (
            <button
              key={niche.slug}
              type="button"
              onClick={() => onSelectNiche?.(niche.slug)}
              aria-pressed={isSelected}
              aria-label={`Filtrar produtos do nicho ${niche.name}`}
            >
              {visual}
            </button>
          );
        })}
      </div>
    </section>
  );
}
