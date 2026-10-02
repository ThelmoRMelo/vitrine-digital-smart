import { useEffect, useRef, useState } from 'react';
import {
  Building2, MapPin, Phone, FileText, Image as ImageIcon, Type, Save, Eye, Upload, Loader2,
  Palette, Sparkles, MessageSquare, MousePointer, Smartphone, Layout,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useApp } from '@/contexts/AppContext';
import { useBusinessConfig } from '@/hooks/useBusinessConfig';
import { useProductImageUpload } from '@/hooks/useProductImageUpload';
import { VitrineHero } from '@/components/vitrine/VitrineHero';
import { themes, getThemeForCategory } from '@/lib/themes';
import { stripAssetVersion, versionAssetUrl } from '@/lib/versioned-assets';
import { toast } from 'sonner';
import { useNiches } from '@/hooks/useNiches';

const categories = [
  'Loja de Roupas', 'Restaurante', 'Salão de Beleza', 'Pet Shop',
  'Academia', 'Consultório', 'Loja Virtual', 'Serviços Gerais', 'Outro',
];

export default function Business() {
  const { niches, loading: nichesLoading, setShowOnLanding } = useNiches();
  const { business, updateBusiness } = useApp();
  const { config, updateConfig } = useBusinessConfig();
  const { deleteImage } = useProductImageUpload();

  // Texts
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [footerText, setFooterText] = useState('');

  // Images
  const [heroBannerUrl, setHeroBannerUrl] = useState('');
  const [assistantImageUrl, setAssistantImageUrl] = useState('');

  // Sizes
  const [heroTitleSize, setHeroTitleSize] = useState(36);
  const [heroSubtitleSize, setHeroSubtitleSize] = useState(18);

  // Assistant
  const [assistantPositionAxis, setAssistantPositionAxis] = useState<'horizontal' | 'vertical'>('vertical');
  const [assistantPositionValue, setAssistantPositionValue] = useState(0);
  const [assistantSize, setAssistantSize] = useState(100);
  const [showAssistantBubble, setShowAssistantBubble] = useState(true);
  const [assistantBubbleText, setAssistantBubbleText] = useState('Olá! Precisa de ajuda?');

  // Button
  const [heroButtonText, setHeroButtonText] = useState('Falar com a ANIA');
  const [heroButtonGlow, setHeroButtonGlow] = useState(50);
  const [heroButtonRadius, setHeroButtonRadius] = useState(12);

  // Colors
  const [primaryColor, setPrimaryColor] = useState('#7c3aed');
  const [titleColor, setTitleColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#cbd5e1');
  const [buttonColor, setButtonColor] = useState('#7c3aed');
  const [accentColor, setAccentColor] = useState('#06b6d4');

  // Ícone Oficial (favicon + splash + PWA)
  const [officialIconUrl, setOfficialIconUrl] = useState('');

  // Splash screen
  const [splashEnabled, setSplashEnabled] = useState(true);
  const [splashImageUrl, setSplashImageUrl] = useState('');
  const [splashBgType, setSplashBgType] = useState<'solid' | 'gradient'>('solid');
  const [splashBgColor, setSplashBgColor] = useState('#0F172A');
  const [splashBgFrom, setSplashBgFrom] = useState('#7c3aed');
  const [splashBgTo, setSplashBgTo] = useState('#06b6d4');
  const [splashDurationMs, setSplashDurationMs] = useState(2000);
  const [splashAnimation, setSplashAnimation] = useState(true);

  // Chat appearance
  const [chatWallpaperUrl, setChatWallpaperUrl] = useState('');
  const [chatWallpaperOpacity, setChatWallpaperOpacity] = useState(100);
  const [chatWallpaperBlur, setChatWallpaperBlur] = useState<'none' | 'light' | 'medium' | 'strong'>('none');
  const [chatWallpaperDim, setChatWallpaperDim] = useState(false);
  const [chatWallpaperFit, setChatWallpaperFit] = useState<'cover' | 'contain' | 'center' | 'repeat'>('cover');
  const [chatHeaderColor, setChatHeaderColor] = useState('#0b141a');
  const [chatInputBgColor, setChatInputBgColor] = useState('#1f2c33');
  const [chatSendButtonColor, setChatSendButtonColor] = useState('#7c3aed');
  const [chatAniaBubbleColor, setChatAniaBubbleColor] = useState('#ffffff');
  const [chatUserBubbleColor, setChatUserBubbleColor] = useState('#005c4b');
  const [chatLinkColor, setChatLinkColor] = useState('#53bdeb');
  const [chatIconColor, setChatIconColor] = useState('#8696a0');
  const [chatCatalogCardColor, setChatCatalogCardColor] = useState('#111b21');

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!config) return;
    const c: any = config;
    setHeroTitle(c.hero_title || '');
    setHeroSubtitle(c.hero_subtitle || '');
    setFooterText(c.footer_text || '');
    setHeroBannerUrl(c.hero_banner_url || '');
    setAssistantImageUrl(c.assistant_image_url || '');
    setHeroTitleSize(c.hero_title_size ?? 36);
    setHeroSubtitleSize(c.hero_subtitle_size ?? 18);
    setAssistantPositionAxis((c.assistant_position_axis as any) ?? 'vertical');
    setAssistantPositionValue(c.assistant_position_value ?? 0);
    setAssistantSize(c.assistant_size ?? 100);
    setShowAssistantBubble(c.show_assistant_bubble ?? true);
    setAssistantBubbleText(c.assistant_bubble_text || 'Olá! Precisa de ajuda?');
    setHeroButtonText(c.hero_button_text || 'Falar com a ANIA');
    setHeroButtonGlow(c.hero_button_glow ?? 50);
    setHeroButtonRadius(c.hero_button_radius ?? 12);
    if (c.primary_color) setPrimaryColor(c.primary_color);
    if (c.title_color) setTitleColor(c.title_color);
    if (c.text_color) setTextColor(c.text_color);
    if (c.button_color) setButtonColor(c.button_color);
    if (c.accent_color) setAccentColor(c.accent_color);
    setOfficialIconUrl(c.official_icon_url || '');
    // splash
    setSplashEnabled(c.splash_enabled ?? true);
    setSplashImageUrl(c.splash_image_url || '');
    setSplashBgType((c.splash_bg_type as any) || 'solid');
    if (c.splash_bg_color) setSplashBgColor(c.splash_bg_color);
    if (c.splash_bg_gradient_from) setSplashBgFrom(c.splash_bg_gradient_from);
    if (c.splash_bg_gradient_to) setSplashBgTo(c.splash_bg_gradient_to);
    setSplashDurationMs(c.splash_duration_ms ?? 2000);
    setSplashAnimation(c.splash_animation ?? true);
    // chat
    setChatWallpaperUrl(c.chat_wallpaper_url || '');
    setChatWallpaperOpacity(c.chat_wallpaper_opacity ?? 100);
    setChatWallpaperBlur((c.chat_wallpaper_blur as any) || 'none');
    setChatWallpaperDim(c.chat_wallpaper_dim ?? false);
    setChatWallpaperFit((c.chat_wallpaper_fit as any) || 'cover');
    if (c.chat_header_color) setChatHeaderColor(c.chat_header_color);
    if (c.chat_input_bg_color) setChatInputBgColor(c.chat_input_bg_color);
    if (c.chat_send_button_color) setChatSendButtonColor(c.chat_send_button_color);
    if (c.chat_ania_bubble_color) setChatAniaBubbleColor(c.chat_ania_bubble_color);
    if (c.chat_user_bubble_color) setChatUserBubbleColor(c.chat_user_bubble_color);
    if (c.chat_link_color) setChatLinkColor(c.chat_link_color);
    if (c.chat_icon_color) setChatIconColor(c.chat_icon_color);
    if (c.chat_catalog_card_color) setChatCatalogCardColor(c.chat_catalog_card_color);
  }, [config]);

  const handleSaveLocal = () => toast.success('Dados locais salvos!');

  const refreshSplashRuntime = async (previousSplashUrl?: string) => {
    const urlsToForget = [previousSplashUrl, previousSplashUrl ? versionAssetUrl(previousSplashUrl, Date.now()) : '']
      .filter(Boolean) as string[];

    if ('caches' in window && urlsToForget.length > 0) {
      try {
        const cacheNames = await caches.keys();
        await Promise.allSettled(
          cacheNames.flatMap((cacheName) =>
            urlsToForget.map(async (url) => {
              const cache = await caches.open(cacheName);
              await cache.delete(url);
            }),
          ),
        );
      } catch {
        // Cache API pode estar indisponível em alguns navegadores/modos privados.
      }
    }

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration('/');
        await registration?.update();
      } catch {
        // A atualização do SW é apenas uma otimização; o cache busting já garante a nova imagem.
      }
    }
  };

  const handleSaveLanding = async () => {
    const saveVersion = Date.now();
    const versionedOfficialIconUrl = officialIconUrl ? versionAssetUrl(officialIconUrl, saveVersion) : '';
    const versionedSplashImageUrl = splashImageUrl ? versionAssetUrl(splashImageUrl, saveVersion) : '';
    const r = await updateConfig({
      hero_title: heroTitle,
      hero_subtitle: heroSubtitle,
      footer_text: footerText,
      hero_banner_url: heroBannerUrl,
      assistant_image_url: assistantImageUrl,
      hero_title_size: heroTitleSize,
      hero_subtitle_size: heroSubtitleSize,
      assistant_position_axis: assistantPositionAxis,
      assistant_position_value: assistantPositionValue,
      assistant_size: assistantSize,
      show_assistant_bubble: showAssistantBubble,
      assistant_bubble_text: assistantBubbleText,
      hero_button_text: heroButtonText,
      hero_button_glow: heroButtonGlow,
      hero_button_radius: heroButtonRadius,
      primary_color: primaryColor,
      title_color: titleColor,
      text_color: textColor,
      button_color: buttonColor,
      accent_color: accentColor,
      official_icon_url: versionedOfficialIconUrl,
      splash_enabled: splashEnabled,
      splash_image_url: versionedSplashImageUrl,
      splash_bg_type: splashBgType,
      splash_bg_color: splashBgColor,
      splash_bg_gradient_from: splashBgFrom,
      splash_bg_gradient_to: splashBgTo,
      splash_duration_ms: splashDurationMs,
      splash_animation: splashAnimation,
      chat_wallpaper_url: chatWallpaperUrl,
      chat_wallpaper_opacity: chatWallpaperOpacity,
      chat_wallpaper_blur: chatWallpaperBlur,
      chat_wallpaper_dim: chatWallpaperDim,
      chat_wallpaper_fit: chatWallpaperFit,
      chat_header_color: chatHeaderColor,
      chat_input_bg_color: chatInputBgColor,
      chat_send_button_color: chatSendButtonColor,
      chat_ania_bubble_color: chatAniaBubbleColor,
      chat_user_bubble_color: chatUserBubbleColor,
      chat_link_color: chatLinkColor,
      chat_icon_color: chatIconColor,
      chat_catalog_card_color: chatCatalogCardColor,
    } as any);
    if (r?.success) {
      const oldSplash = stripAssetVersion(config?.splash_image_url);
      const newSplash = stripAssetVersion(versionedSplashImageUrl);
      if (oldSplash && newSplash && oldSplash !== newSplash) {
        void refreshSplashRuntime(oldSplash);
        void deleteImage(oldSplash);
      } else {
        void refreshSplashRuntime(oldSplash);
      }
      setOfficialIconUrl(versionedOfficialIconUrl);
      setSplashImageUrl(versionedSplashImageUrl);
      toast.success('Identidade visual atualizada!');
    } else toast.error('Erro ao salvar');
  };

  const previewTheme = themes[getThemeForCategory(business.categoria || '')] || themes.default;
  const previewBusinessName = business.nome || 'Minha Loja';

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Meu Negócio" subtitle="Dados e Identidade Visual" />

      <main className="px-6 py-4 space-y-4 max-w-lg mx-auto">
        <div className="glass-card rounded-2xl p-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mb-4">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-bold">{business.nome || 'Seu Negócio'}</h2>
          <p className="text-sm text-muted-foreground">{business.categoria || 'Categoria não definida'}</p>
        </div>

        {/* Dados básicos */}
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-4">
            <Label className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Nome do estabelecimento</Label>
            <Input value={business.nome} onChange={(e) => updateBusiness({ nome: e.target.value })} placeholder="Ex: Loja da Maria" />
          </div>

          <div className="glass-card rounded-xl p-4">
            <Label>Categoria</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => updateBusiness({ categoria: cat })}
                  className={`px-3 py-2 rounded-lg text-sm transition-all ${
                    business.categoria === cat ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-xl p-4">
            <Label className="flex items-center gap-2"><Phone className="w-4 h-4" /> Telefone / WhatsApp</Label>
            <Input value={business.telefone || ''} onChange={(e) => updateBusiness({ telefone: e.target.value })} placeholder="(00) 00000-0000" type="tel" />
          </div>

          <div className="glass-card rounded-xl p-4">
            <Label className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Endereço</Label>
            <Input value={business.endereco || ''} onChange={(e) => updateBusiness({ endereco: e.target.value })} placeholder="Rua, número, bairro..." />
          </div>

          <div className="glass-card rounded-xl p-4">
            <Label className="flex items-center gap-2"><FileText className="w-4 h-4" /> Descrição do negócio</Label>
            <Textarea value={business.descricao || ''} onChange={(e) => updateBusiness({ descricao: e.target.value })} placeholder="Conte um pouco sobre o seu negócio..." rows={3} />
          </div>

          <Button variant="outline" className="w-full" onClick={handleSaveLocal}>
            <Save className="w-4 h-4" /> Salvar dados básicos
          </Button>
        </div>

        {/* HERO PRINCIPAL */}
        <SectionCard icon={<Type className="w-5 h-5 text-primary" />} title="Hero principal" subtitle="Textos do topo da Landing">
          <div>
            <Label>Título principal</Label>
            <Input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} placeholder="Sua vitrine inteligente com atendimento 24h" />
          </div>
          <SliderRow
            label="Tamanho do título"
            value={heroTitleSize}
            min={20} max={60} unit="px"
            onChange={setHeroTitleSize}
          />
          <div>
            <Label>Subtítulo</Label>
            <Textarea rows={2} value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} placeholder="Cursos, aplicativos..." />
          </div>
          <SliderRow
            label="Tamanho do subtítulo"
            value={heroSubtitleSize}
            min={12} max={36} unit="px"
            onChange={setHeroSubtitleSize}
          />
          <div>
            <Label>Texto do rodapé</Label>
            <Textarea rows={2} value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Atendimento por IA 24h..." />
          </div>
        </SectionCard>

        {/* IMAGENS */}
        <SectionCard icon={<ImageIcon className="w-5 h-5 text-primary" />} title="Imagens" subtitle="Banner e assistente">
          <ImagePicker label="Banner principal" buttonLabel="Alterar Banner" value={heroBannerUrl} onChange={setHeroBannerUrl} aspect="banner" />
          <ImagePicker label="Imagem da assistente" buttonLabel="Alterar Assistente" value={assistantImageUrl} onChange={setAssistantImageUrl} aspect="avatar" />
        </SectionCard>

        {/* ASSISTENTE VIRTUAL */}
        <SectionCard icon={<Sparkles className="w-5 h-5 text-primary" />} title="Assistente virtual" subtitle="Posição, tamanho e balão">
          <div>
            <Label>Eixo de movimento</Label>
            <div className="flex gap-2 mt-2">
              {(['vertical', 'horizontal'] as const).map((axis) => (
                <button
                  key={axis}
                  onClick={() => setAssistantPositionAxis(axis)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm capitalize transition-all ${
                    assistantPositionAxis === axis ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {axis === 'vertical' ? 'Vertical' : 'Horizontal'}
                </button>
              ))}
            </div>
          </div>
          <SliderRow
            label={`Posição (${assistantPositionAxis})`}
            value={assistantPositionValue}
            min={-50} max={50} unit="%"
            onChange={setAssistantPositionValue}
          />
          <SliderRow
            label="Tamanho da assistente"
            value={assistantSize}
            min={60} max={140} unit="%"
            onChange={setAssistantSize}
          />
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Exibir balão de fala</Label>
            <Switch checked={showAssistantBubble} onCheckedChange={setShowAssistantBubble} />
          </div>
          {showAssistantBubble && (
            <div>
              <Label>Texto do balão</Label>
              <Input value={assistantBubbleText} onChange={(e) => setAssistantBubbleText(e.target.value)} placeholder="Olá! Precisa de ajuda?" />
            </div>
          )}
        </SectionCard>

        {/* BOTÃO */}
        <SectionCard icon={<MousePointer className="w-5 h-5 text-primary" />} title="Botão principal" subtitle="Aparência do CTA">
          <div>
            <Label>Texto do botão</Label>
            <Input value={heroButtonText} onChange={(e) => setHeroButtonText(e.target.value)} placeholder="Falar com a ANIA" />
          </div>
          <SliderRow label="Intensidade do brilho" value={heroButtonGlow} min={0} max={100} unit="" onChange={setHeroButtonGlow} />
          <SliderRow label="Arredondamento dos cantos" value={heroButtonRadius} min={0} max={40} unit="px" onChange={setHeroButtonRadius} />
        </SectionCard>

        {/* CORES */}
        <SectionCard icon={<Palette className="w-5 h-5 text-primary" />} title="Cores" subtitle="Paleta da Landing">
          <ColorRow label="Cor principal" value={primaryColor} onChange={setPrimaryColor} />
          <ColorRow label="Cor dos títulos" value={titleColor} onChange={setTitleColor} />
          <ColorRow label="Cor dos textos" value={textColor} onChange={setTextColor} />
          <ColorRow label="Cor dos botões" value={buttonColor} onChange={setButtonColor} />
          <ColorRow label="Cor dos destaques" value={accentColor} onChange={setAccentColor} />
        </SectionCard>

        {/* ÍCONE OFICIAL DA ANIA */}
        <SectionCard
          icon={<Sparkles className="w-5 h-5 text-primary" />}
          title="Ícone Oficial da ANIA"
          subtitle="Usado na splash, favicon do navegador e ícone do PWA"
        >
          <ImagePicker
            label="Ícone único da aplicação"
            buttonLabel="Alterar Ícone"
            value={officialIconUrl}
            onChange={setOfficialIconUrl}
            aspect="avatar"
          />
          <p className="text-xs text-muted-foreground">
            Ao salvar, este ícone será aplicado automaticamente na tela de abertura, na aba do navegador,
            no manifest do PWA e na tela inicial do celular. Recomendado: PNG quadrado de 512×512px.
          </p>
        </SectionCard>

        {/* NICHOS DA VITRINE */}
        <SectionCard
          icon={<Layout className="w-5 h-5 text-primary" />}
          title="Nichos da Vitrine"
          subtitle="Escolha quais nichos serão exibidos na sua Landing Page."
        >
          {nichesLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : (
            <div className="divide-y divide-border">
              {niches.map((n) => (
                <div key={n.id} className="flex items-center justify-between py-3 gap-3">
                  <Label htmlFor={`niche-${n.id}`} className="text-sm font-medium cursor-pointer">{n.name}</Label>
                  <Switch
                    id={`niche-${n.id}`}
                    checked={n.show_on_landing}
                    onCheckedChange={(v) => setShowOnLanding(n.id, v)}
                    aria-label={`Exibir ${n.name} na vitrine`}
                  />
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Nichos ocultos continuam existindo e podem ser usados nos produtos normalmente.
          </p>
        </SectionCard>

        {/* SPLASH SCREEN */}
        <div className="pt-6">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
            <Smartphone className="w-5 h-5 text-primary" /> Tela de abertura (Splash)
          </h2>
        </div>
        <SectionCard icon={<ImageIcon className="w-5 h-5 text-primary" />} title="Splash Screen" subtitle="Aparece na abertura do app">
          <div className="flex items-center justify-between">
            <Label>Ativar splash</Label>
            <Switch checked={splashEnabled} onCheckedChange={setSplashEnabled} />
          </div>
          <ImagePicker
            label="Imagem da splash"
            buttonLabel="Alterar imagem"
            value={splashImageUrl}
            onChange={setSplashImageUrl}
            aspect="avatar"
          />
          <div>
            <Label>Tipo de fundo</Label>
            <div className="flex gap-2 mt-2">
              {(['solid', 'gradient'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSplashBgType(t)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                    splashBgType === t ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t === 'solid' ? 'Sólido' : 'Gradiente'}
                </button>
              ))}
            </div>
          </div>
          {splashBgType === 'solid' ? (
            <ColorRow label="Cor de fundo" value={splashBgColor} onChange={setSplashBgColor} />
          ) : (
            <>
              <ColorRow label="Gradiente – início" value={splashBgFrom} onChange={setSplashBgFrom} />
              <ColorRow label="Gradiente – fim" value={splashBgTo} onChange={setSplashBgTo} />
            </>
          )}
          <SliderRow
            label="Tempo de exibição"
            value={splashDurationMs}
            min={1000} max={5000} unit="ms"
            onChange={setSplashDurationMs}
          />
          <div className="flex items-center justify-between">
            <Label>Animação (fade + zoom)</Label>
            <Switch checked={splashAnimation} onCheckedChange={setSplashAnimation} />
          </div>
        </SectionCard>

        {/* CHAT */}
        <div className="pt-6">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
            <Layout className="w-5 h-5 text-primary" /> Aparência do Chat
          </h2>
        </div>
        <SectionCard icon={<ImageIcon className="w-5 h-5 text-primary" />} title="Papel de parede" subtitle="Fundo do chat da ANIA">
          <ImagePicker
            label="Papel de parede"
            buttonLabel="Alterar papel de parede"
            value={chatWallpaperUrl}
            onChange={setChatWallpaperUrl}
            aspect="banner"
          />
          <SliderRow
            label="Opacidade"
            value={chatWallpaperOpacity}
            min={0} max={100} unit="%"
            onChange={setChatWallpaperOpacity}
          />
          <div>
            <Label>Intensidade do blur</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {(['none', 'light', 'medium', 'strong'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setChatWallpaperBlur(b)}
                  className={`px-2 py-2 rounded-lg text-xs transition-all ${
                    chatWallpaperBlur === b ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {b === 'none' ? 'Sem' : b === 'light' ? 'Leve' : b === 'medium' ? 'Médio' : 'Forte'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Escurecimento automático</Label>
            <Switch checked={chatWallpaperDim} onCheckedChange={setChatWallpaperDim} />
          </div>
          <div>
            <Label>Ajuste da imagem</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {(['cover', 'contain', 'center', 'repeat'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setChatWallpaperFit(f)}
                  className={`px-2 py-2 rounded-lg text-xs transition-all ${
                    chatWallpaperFit === f ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {f === 'cover' ? 'Cobrir' : f === 'contain' ? 'Ajustar' : f === 'center' ? 'Centralizar' : 'Repetir'}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>
        <SectionCard icon={<Palette className="w-5 h-5 text-primary" />} title="Cores do Chat" subtitle="Personalize toda a interface">
          <ColorRow label="Cabeçalho" value={chatHeaderColor} onChange={setChatHeaderColor} />
          <ColorRow label="Caixa de digitação" value={chatInputBgColor} onChange={setChatInputBgColor} />
          <ColorRow label="Botão Enviar" value={chatSendButtonColor} onChange={setChatSendButtonColor} />
          <ColorRow label="Mensagens da ANIA" value={chatAniaBubbleColor} onChange={setChatAniaBubbleColor} />
          <ColorRow label="Mensagens do cliente" value={chatUserBubbleColor} onChange={setChatUserBubbleColor} />
          <ColorRow label="Links" value={chatLinkColor} onChange={setChatLinkColor} />
          <ColorRow label="Ícones" value={chatIconColor} onChange={setChatIconColor} />
          <ColorRow label="Cartões do catálogo" value={chatCatalogCardColor} onChange={setChatCatalogCardColor} />
        </SectionCard>

        {/* AÇÕES */}
        <div className="space-y-2 sticky bottom-20 z-10">
          <Button variant="gradient" className="w-full" onClick={handleSaveLanding}>
            <Save className="w-4 h-4" /> Salvar Identidade Visual
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setPreviewOpen(true)}>
            <Eye className="w-4 h-4" /> Pré-visualizar Landing Page
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => window.open('/vitrine', '_blank', 'noopener,noreferrer')}>
            <Eye className="w-4 h-4" /> Visualizar Landing Page publicada
          </Button>
        </div>
      </main>

      <BottomNav />

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Pré-visualização da Landing Page</DialogTitle>
          </DialogHeader>
          <div className="bg-background">
            <VitrineHero
              previewMode
              businessName={previewBusinessName}
              theme={previewTheme}
              chatPath="#"
              heroTitle={heroTitle}
              heroSubtitle={heroSubtitle}
              bannerUrl={heroBannerUrl}
              assistantImageUrl={assistantImageUrl}
              heroTitleSize={heroTitleSize}
              heroSubtitleSize={heroSubtitleSize}
              assistantPositionAxis={assistantPositionAxis}
              assistantPositionValue={assistantPositionValue}
              assistantSize={assistantSize}
              showAssistantBubble={showAssistantBubble}
              assistantBubbleText={assistantBubbleText}
              heroButtonText={heroButtonText}
              heroButtonGlow={heroButtonGlow}
              heroButtonRadius={heroButtonRadius}
              primaryColor={primaryColor}
              titleColor={titleColor}
              textColor={textColor}
              buttonColor={buttonColor}
              accentColor={accentColor}
            />
            {footerText && (
              <div className="px-6 py-6 text-center text-sm" style={{ color: textColor }}>
                {footerText}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionCard({
  icon, title, subtitle, children,
}: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 mt-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function SliderRow({
  label, value, min, max, unit, onChange,
}: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>{label}</Label>
        <span className="text-sm text-muted-foreground tabular-nums">{value}{unit}</span>
      </div>
      <Slider min={min} max={max} step={1} value={[value]} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="flex-1">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 p-1 cursor-pointer"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 text-xs font-mono"
        />
      </div>
    </div>
  );
}

interface ImagePickerProps {
  label: string;
  buttonLabel: string;
  value: string;
  onChange: (url: string) => void;
  aspect: 'banner' | 'avatar';
}

function ImagePicker({ label, buttonLabel, value, onChange, aspect }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, uploading } = useProductImageUpload();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) {
      onChange(versionAssetUrl(url, Date.now()));
      toast.success('Imagem enviada com sucesso!');
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        className={`relative w-full overflow-hidden rounded-xl border border-border bg-muted/30 ${
          aspect === 'banner' ? 'aspect-[16/9]' : 'aspect-square max-w-[180px]'
        }`}
      >
        {value ? (
          <img src={value} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sem imagem</div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <Button type="button" variant="outline" className="w-full" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {buttonLabel}
      </Button>
    </div>
  );
}
