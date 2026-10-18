// Configuração de voz da ANIA — fonte única de verdade (frontend).
// Os identificadores são compatíveis com o mapeamento Gemini da Edge Function.

export const ANIA_VOICES = [
  { value: 'coral', label: 'Coral (feminina, calorosa)' },
  { value: 'nova', label: 'Nova (feminina, suave)' },
  { value: 'shimmer', label: 'Shimmer (feminina, clara)' },
  { value: 'sage', label: 'Sage (feminina, serena)' },
  { value: 'alloy', label: 'Alloy (neutra)' },
  { value: 'ash', label: 'Ash (masculina, firme)' },
  { value: 'ballad', label: 'Ballad (expressiva)' },
  { value: 'echo', label: 'Echo (masculina, direta)' },
  { value: 'fable', label: 'Fable (narrativa)' },
  { value: 'onyx', label: 'Onyx (masculina, grave)' },
  { value: 'verse', label: 'Verse (versátil)' },
] as const;

export const DEFAULT_ANIA_VOICE = 'coral';
export const DEFAULT_ANIA_SPEED = 1;

export const VOICE_SPEED_MIN = 0.5;
export const VOICE_SPEED_MAX = 2;

const BASE = 'Fale em pt-BR';

export const DEFAULT_ANIA_VOICE_STYLE =
  'Fale em pt-BR com voz feminina jovem, suave e acolhedora. Use ritmo natural, pausas leves e tom simpático, claro e expressivo.';

export const VOICE_STYLE_PRESETS = [
  {
    key: 'natural',
    label: 'Natural',
    instructions: DEFAULT_ANIA_VOICE_STYLE,
  },
  {
    key: 'amigavel',
    label: 'Amigável',
    instructions: `${BASE} com tom leve, animado e simpático, como uma amiga. Use ritmo natural e entonação variada, sem exageros.`,
  },
  {
    key: 'profissional',
    label: 'Profissional',
    instructions: `${BASE} com tom claro, seguro e objetivo, como uma atendente experiente. Use boa dicção e cordialidade.`,
  },
  {
    key: 'acolhedora',
    label: 'Acolhedora',
    instructions: `${BASE} com tom calmo, gentil e empático. Use pausas suaves e transmita paciência e atenção.`,
  },
  {
    key: 'vendedora',
    label: 'Vendedora',
    instructions: `${BASE} com energia e confiança. Destaque benefícios sem pressionar nem soar artificial.`,
  },
] as const;

export const VOICE_SAMPLE_TEXT =
  'Olá! Eu sou a ANIA, sua assistente virtual. Posso te ajudar a escolher o produto ideal agora mesmo.';

export function styleKeyFromInstructions(instructions?: string | null): string {
  if (!instructions) return 'natural';
  const found = VOICE_STYLE_PRESETS.find((p) => p.instructions === instructions);
  if (found) return found.key;
  if (/voz feminina, suave, calorosa e acolhedora/i.test(instructions)) return 'natural';
  if (/como uma amiga conversando/i.test(instructions)) return 'amigavel';
  if (/atendente experiente/i.test(instructions)) return 'profissional';
  if (/como quem cuida de quem/i.test(instructions)) return 'acolhedora';
  if (/persuasivo, com energia e confiança/i.test(instructions)) return 'vendedora';
  return 'personalizado';
}

export function compactVoiceInstructions(instructions?: string | null): string {
  if (!instructions?.trim()) return DEFAULT_ANIA_VOICE_STYLE;
  const styleKey = styleKeyFromInstructions(instructions);
  const preset = VOICE_STYLE_PRESETS.find((item) => item.key === styleKey);
  if (preset) return preset.instructions;

  const value = instructions.trim();
  if (value.length <= 180) return value;
  const prefix = value.slice(0, 180);
  const sentenceEnd = Math.max(prefix.lastIndexOf('. '), prefix.lastIndexOf('! '), prefix.lastIndexOf('? '));
  const boundary = sentenceEnd > 0 ? sentenceEnd + 1 : prefix.lastIndexOf(' ');
  return prefix.slice(0, boundary > 0 ? boundary : 180).trimEnd();
}

export function clampSpeed(value: number | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_ANIA_SPEED;
  return Math.min(VOICE_SPEED_MAX, Math.max(VOICE_SPEED_MIN, n));
}
