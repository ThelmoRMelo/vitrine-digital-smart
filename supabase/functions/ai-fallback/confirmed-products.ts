export interface ConfirmedProduct {
  id: string;
  nome: string;
  preco: number;
  descricao?: string;
  conhecimentoIA?: string;
  categoria?: string;
  precoMinimo?: number | null;
  formasPagamento?: string[];
  infoEntrega?: string;
  linkPagamento?: string;
}

export function confirmedPriceReply(product: ConfirmedProduct): string {
  const price = Number.isFinite(product.preco) && product.preco >= 0
    ? `O preço atual cadastrado de **${product.nome}** é **${product.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}**.`
    : `Preciso verificar o preço de **${product.nome}** antes de informar um valor.`;
  return price;
}

export function isCurrentPriceQuestion(message: string): boolean {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return !/desconto|negoci|baixar|menor|barato|promoc/.test(normalized)
    && /preco|valor|quanto custa|quanto (e|esta|ta)\b/.test(normalized);
}

export function confirmedProductFallback(product?: ConfirmedProduct): string {
  if (!product) return 'O atendimento inteligente está indisponível no momento. Você pode consultar os produtos e seus preços atuais na vitrine. Selecione um produto para ver as informações cadastradas.';
  const facts = [
    'O atendimento inteligente está indisponível no momento, mas posso confirmar os dados cadastrados deste produto:',
    confirmedPriceReply(product),
    product.conhecimentoIA || product.descricao || '',
    product.formasPagamento?.length ? `Pagamento: ${product.formasPagamento.join(', ')}.` : '',
    product.infoEntrega ? `Entrega: ${product.infoEntrega}` : '',
    product.linkPagamento ? `[Consultar a página de aquisição](${product.linkPagamento})` : '',
    'Informações que não estejam cadastradas precisam ser verificadas antes da compra.',
  ];
  return facts.filter(Boolean).join('\n\n');
}