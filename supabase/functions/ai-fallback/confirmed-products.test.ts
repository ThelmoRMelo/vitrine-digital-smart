import { expect, test } from 'bun:test';
import { confirmedPriceReply, confirmedProductFallback, isCurrentPriceQuestion } from './confirmed-products';

test('preço vem do registro atual de R$ 92,00', () => {
  expect(confirmedPriceReply({ id: 'pet', nome: 'Kit', preco: 92 }).replace(/\s/g, ' ')).toContain('R$ 92,00');
});
test('contingência usa somente características e condições confirmadas', () => {
  const result = confirmedProductFallback({ id: 'pet', nome: 'Kit', preco: 92, descricao: 'Volume: 500 mL' });
  expect(result).toContain('500 mL');
  expect(result).not.toContain('Pagamento:');
  expect(result).not.toContain('Entrega:');
  expect(result).not.toContain('99,00');
});
test('preço não confirmado não vira zero', () => {
  expect(confirmedPriceReply({ id: 'pet', nome: 'Kit', preco: NaN })).not.toContain('R$');
});
test('consulta de preço atual não modifica negociação', () => {
  expect(isCurrentPriceQuestion('Qual é o preço atual deste produto?')).toBe(true);
  expect(isCurrentPriceQuestion('Quero desconto no preço')).toBe(false);
});