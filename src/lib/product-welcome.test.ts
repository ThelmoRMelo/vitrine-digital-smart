import { describe, expect, test } from 'bun:test';
import { currentProductWelcome } from './product-welcome';

describe('preço confirmado na saudação', () => {
  test('usa R$ 92,00 cadastrado, nunca o preço anterior R$ 99,00', () => {
    const text = currentProductWelcome({ name: 'Kit Dermatite', price: 92 });
    expect(text.replace(/\s/g, ' ')).toContain('R$ 92,00');
    expect(text).not.toContain('99,00');
  });
  test('não inventa preço quando não confirmado', () => {
    expect(currentProductWelcome({ name: 'Kit', price: NaN })).not.toContain('R$');
  });
});