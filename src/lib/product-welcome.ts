export function currentProductWelcome(product: { name: string; price: number }, isNewSession = false): string {
  const price = Number.isFinite(product.price) && product.price >= 0
    ? `O valor atual cadastrado é ${product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
    : 'Preciso verificar o preço deste produto antes de informar um valor.';
  return isNewSession
    ? `✨ **Novo atendimento iniciado!**\n\nOlá! 👋 Agora estou focada em te ajudar com o **${product.name}**! ${price} Em que posso ajudar?`
    : `Olá! 👋 Você está interessado no **${product.name}**! ${price} Posso te ajudar?`;
}