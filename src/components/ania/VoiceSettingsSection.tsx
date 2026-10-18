// Seção "Voz da ANIA" — configura voz, estilo e velocidade do TTS.
// Reutiliza a Edge Function `text-to-speech` para a amostra de voz.
import { useEffect, useState } from 'react';
import { Volume2, Loader2, Save, AudioLines } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessConfig } from '@/hooks/useBusinessConfig';
import {
  ANIA_VOICES,
  DEFAULT_ANIA_SPEED,
  DEFAULT_ANIA_VOICE,
  DEFAULT_ANIA_VOICE_STYLE,
  VOICE_SAMPLE_TEXT,
  VOICE_SPEED_MAX,
  VOICE_SPEED_MIN,
  VOICE_STYLE_PRESETS,
  clampSpeed,
  styleKeyFromInstructions,
} from '@/lib/ania-voice';
import { toast } from 'sonner';

let sampleAudio: HTMLAudioElement | null = null;

export function VoiceSettingsSection() {
  const { config, updateConfig } = useBusinessConfig();

  const [voice, setVoice] = useState<string>(DEFAULT_ANIA_VOICE);
  const [styleKey, setStyleKey] = useState<string>('natural');
  const [instructions, setInstructions] = useState<string>(DEFAULT_ANIA_VOICE_STYLE);
  const [speed, setSpeed] = useState<number>(DEFAULT_ANIA_SPEED);
  const [saving, setSaving] = useState(false);
  const [sampling, setSampling] = useState(false);

  useEffect(() => {
    if (!config) return;
    setVoice(config.assistant_voice || DEFAULT_ANIA_VOICE);
    const style = config.assistant_voice_style || DEFAULT_ANIA_VOICE_STYLE;
    setInstructions(style);
    setStyleKey(styleKeyFromInstructions(style));
    setSpeed(clampSpeed(config.assistant_voice_speed ?? DEFAULT_ANIA_SPEED));
  }, [config]);

  const handleStyleChange = (key: string) => {
    setStyleKey(key);
    const preset = VOICE_STYLE_PRESETS.find((p) => p.key === key);
    if (preset) setInstructions(preset.instructions);
  };

  const handleSample = async () => {
    if (sampleAudio) {
      sampleAudio.pause();
      sampleAudio = null;
    }
    setSampling(true);
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: VOICE_SAMPLE_TEXT, voice, instructions, speed },
      });
      if (error) throw error;
      const speech = data as { audio?: string; mimeType?: string };
      const base64 = speech?.audio;
      if (!base64) throw new Error('sem áudio');
      sampleAudio = new Audio(`data:${speech.mimeType || 'audio/wav'};base64,${base64}`);
      await sampleAudio.play();
    } catch (err) {
      console.error('[VoiceSettings] amostra', err);
      toast.error('Não consegui gerar a amostra agora. Tente novamente.');
    } finally {
      setSampling(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const r = await updateConfig({
      assistant_voice: voice,
      assistant_voice_style: instructions,
      assistant_voice_speed: speed,
    });
    setSaving(false);
    if (r?.success) toast.success('Voz da ANIA salva!');
    else toast.error('Erro ao salvar a voz');
  };

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
          <AudioLines className="w-5 h-5 text-pink-400" />
        </div>
        <div>
          <h3 className="font-semibold">Voz da ANIA</h3>
          <p className="text-xs text-muted-foreground">
            Usada no botão "Ouvir" das respostas da ANIA.
          </p>
        </div>
      </div>

      <div>
        <Label>Voz</Label>
        <Select value={voice} onValueChange={setVoice}>
          <SelectTrigger>
            <SelectValue placeholder="Escolha a voz" />
          </SelectTrigger>
          <SelectContent>
            {ANIA_VOICES.map((v) => (
              <SelectItem key={v.value} value={v.value}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Estilo da voz</Label>
        <Select value={styleKey} onValueChange={handleStyleChange}>
          <SelectTrigger>
            <SelectValue placeholder="Escolha o estilo" />
          </SelectTrigger>
          <SelectContent>
            {VOICE_STYLE_PRESETS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
            {styleKey === 'personalizado' && (
              <SelectItem value="personalizado">Personalizado</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">
          Instruções de entonação (pode ajustar manualmente)
        </Label>
        <Textarea
          rows={4}
          value={instructions}
          onChange={(e) => {
            setInstructions(e.target.value);
            setStyleKey(styleKeyFromInstructions(e.target.value));
          }}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>Velocidade da fala</Label>
          <span className="text-sm font-medium text-primary">{speed.toFixed(2)}x</span>
        </div>
        <Slider
          className="mt-3"
          value={[speed]}
          min={VOICE_SPEED_MIN}
          max={VOICE_SPEED_MAX}
          step={0.05}
          onValueChange={(v) => setSpeed(clampSpeed(v[0]))}
        />
        <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
          <span>Mais devagar</span>
          <span>Mais rápido</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 h-11" onClick={handleSample} disabled={sampling}>
          {sampling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
          {sampling ? 'Gerando...' : 'Ouvir amostra'}
        </Button>
        <Button variant="gradient" className="flex-1 h-11" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar voz'}
        </Button>
      </div>
    </section>
  );
}
