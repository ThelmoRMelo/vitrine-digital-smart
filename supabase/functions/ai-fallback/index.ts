import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(
  response: string,
  recommendedProductIds: string[] = [],
  negotiationUpdate: Partial<NegotiationState> | null = null,
  closingUpdate: Partial<ClosingState> | null = null,
) {
  return new Response(
    JSON.stringify({ response, recommendedProductIds, negotiationUpdate, closingUpdate }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function serviceFallback(storeName: string, productName?: string) {
  const focus = productName ? ` sobre ${productName}` : "";
  return `Oi! Sou a ANIA da ${storeName}. Estou com uma instabilidade temporária${focus}. Pode tentar novamente em instantes?`;
}

interface ProductInfo {
  id: string;
  nome: string;
  preco: number;

  // Descrição curta/publicada do produto
  descricao?: string;

  // Conhecimento interno da ANIA sobre o produto.
  // Usado para entender necessidades, perfil do cliente,
  // características, benefícios, diferenciais, cuidados,
  // restrições e situações em que o produto é relevante.
  conhecimentoIA?: string;

  categoria?: string;

  precoMinimo?: number | null;
  formasPagamento?: string[];
  infoEntrega?: string;
  linkPagamento?: string;
}

interface ProductContext extends ProductInfo {
  categoria?: string;
  linkPagamento?: string;
}

interface NegotiationState {
  hasOfferedDiscount: boolean;
  lastDiscountOffered: number | null;
  discountAttempts: number;
  maxDiscountReached: boolean;
}

interface ClosingState {
  isClosing: boolean;
  closingReason: 'discount_max' | 'purchase_intent' | 'price_accepted' | 'contact_request' | null;
  closingAttempts: number;
  hasOfferedWhatsApp: boolean;
  hasOfferedPaymentLink: boolean;
  conversationEnded: boolean;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * ai-fallback - ANIA: Assistente de Vendas Virtual
 * 
 * REGRAS ABSOLUTAS:
 * 1. ANIA é a assistente da LOJA ATUAL (nunca citar T&V Sistemas ou desenvolvedores)
 * 2. Identidade dinâmica baseada nos dados da loja
 * 3. Produtos listados em Markdown estruturado
 * 4. Fechamento via link de pagamento OU página externa
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      businessName, 
      businessCategory, 
      products,
      productContext,
      productId,
      negotiationState,
      conversationHistory,
      lastBotResponse,
      closingState,
      mode
    } = await req.json();

    const chatMode: 'vitrine' | 'product' = mode === 'vitrine' || !productContext ? 'vitrine' : 'product';

    // Load global ANIA settings (best-effort)
    let aniaSettings: any = null;
    try {
      const supaUrl = Deno.env.get("SUPABASE_URL");
      const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
      if (supaUrl && supaKey) {
        const supa = createClient(supaUrl, supaKey);
        const { data } = await supa.from("ania_settings").select("*").limit(1).maybeSingle();
        aniaSettings = data || null;
      }
    } catch (e) {
      console.warn("[ai-fallback] ania_settings load failed:", e);
    }

    const assistantName = aniaSettings?.assistant_name || "ANIA";
    const fallbackMessage =
      aniaSettings?.fallback_message ||
      "Essa informação não está cadastrada no sistema no momento.";

    const storeName = businessName || "nossa loja";
    const storeCategory = businessCategory || "produtos";
    const productList = products as ProductInfo[] || [];
    const hasProducts = productList.length > 0;
    const negotiation = negotiationState as NegotiationState || {
      hasOfferedDiscount: false,
      lastDiscountOffered: null,
      discountAttempts: 0,
      maxDiscountReached: false
    };
    const closing = closingState as ClosingState || {
      isClosing: false,
      closingReason: null,
      closingAttempts: 0,
      hasOfferedWhatsApp: false,
      hasOfferedPaymentLink: false,
      conversationEnded: false
    };
    const history = conversationHistory as ConversationMessage[] || [];

    // Se não há produtos, responder diretamente
    if (!hasProducts) {
      return jsonResponse(`Ainda não temos produtos cadastrados na **${storeName}**. Em breve teremos novidades! 😊`);
    }

    // Se a conversa já foi encerrada
    if (closing.conversationEnded) {
      return jsonResponse("Quando quiser finalizar, é só me chamar! 👍", [], null, { conversationEnded: true });
    }

    // Verificar se já houve mensagens (não é primeira interação)
    const isFirstMessage = history.length === 0;

    // ============================================================
// CONHECIMENTO DOS PRODUTOS PARA A ANIA
// ============================================================
//
// A descrição curta é apenas informação pública.
// O conhecimentoIA é o material que permite à ANIA
// entender para quem o produto é relevante e em quais
// necessidades ele pode ser recomendado.
//
// IMPORTANTE:
// A IA nunca deve inventar informações que não estejam
// cadastradas nesses campos.
//

const productKnowledgeText = productList.map((p: ProductInfo) => {
  const price = Number(p.preco).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  return `
═══════════════════════════════════════════
PRODUTO
ID: ${p.id}
NOME: ${p.nome}
CATEGORIA: ${p.categoria || '(não cadastrada)'}
PREÇO: ${price}

DESCRIÇÃO PÚBLICA:
${p.descricao || '(não cadastrada)'}

CONHECIMENTO DA ANIA:
${p.conhecimentoIA || '(não cadastrado)'}

PAGAMENTO:
${p.formasPagamento?.length ? p.formasPagamento.join(', ') : '(não cadastrado)'}

ENTREGA:
${p.infoEntrega || '(não cadastrada)'}
═══════════════════════════════════════════
`;
}).join('\n');

    
    // Contexto de produto específico
    let focusedProductText = "";
    let focusedProduct: ProductContext | null = null;
    
    if (productContext) {
      focusedProduct = productContext as ProductContext;
      const price = Number(focusedProduct.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const minPrice = focusedProduct.precoMinimo 
        ? Number(focusedProduct.precoMinimo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : null;
      const maxDiscount = focusedProduct.precoMinimo 
        ? ((focusedProduct.preco - focusedProduct.precoMinimo) / focusedProduct.preco * 100).toFixed(0)
        : null;
      
      const hasPaymentLink = focusedProduct.linkPagamento && focusedProduct.linkPagamento.trim() !== '';
      
      focusedProductText = `
═══════════════════════════════════════════
🎯 PRODUTO EM FOCO (cliente já escolheu):
• Nome: ${focusedProduct.nome}
• Preço: ${price}${minPrice ? `\n• Preço mínimo: ${minPrice} (desconto máximo: ${maxDiscount}%)` : '\n• SEM margem para desconto'}${focusedProduct.descricao ? `\n• Descrição: ${focusedProduct.descricao}` : ''}${focusedProduct.formasPagamento?.length ? `\n• Pagamento: ${focusedProduct.formasPagamento.join(', ')}` : ''}${focusedProduct.infoEntrega ? `\n• Entrega: ${focusedProduct.infoEntrega}` : ''}
${hasPaymentLink ? `\n💳 LINK DISPONÍVEL: ${focusedProduct.linkPagamento}` : '\n⚠️ SEM link cadastrado - orientar via WhatsApp'}
═══════════════════════════════════════════

IMPORTANTE: O cliente JÁ ESCOLHEU este produto. Foque apenas nele. NÃO liste outros produtos.`;
    }

    // Detectar gatilhos
    const msgLower = message.toLowerCase();
    
    // Detectar se cliente está perguntando sobre identidade
    const isAskingIdentity = /\b(quem (é|e) você|quem (és|es) tu|você (é|e) quem|qual (é|e) seu nome|me apresent|se apresent)\b/.test(msgLower);
    
    // Detectar se cliente quer ver catálogo/produtos
    
    // Detectar se cliente está pedindo link de pagamento
    const isAskingPaymentLink = /\b(pix|link|pagar|pagamento|como (eu )?(pago|faco|faço)|me (manda|passa|envia) o link|quero (pagar|comprar)|finalizar|fechar pedido)\b/.test(msgLower);
    
    const closingTriggers = {
      priceAccepted: /\b(ok|tá|ta|beleza|fechado|pode ser|aceito|quero|sim|vou levar|levo|comprar|compro|esse mesmo)\b/.test(msgLower),
      purchaseIntent: /\b(como (eu )?(faco|faço|compro|pago)|quero (comprar|fechar|pagar)|vou (comprar|pegar|levar)|me (passa|manda|envia))\b/.test(msgLower),
      contactRequest: /\b(whatsapp|zap|whats|telefone|ligar|contato|humano|atendente|pessoa)\b/.test(msgLower),
      paymentRequest: isAskingPaymentLink,
      discountMax: negotiation.maxDiscountReached
    };

    const shouldActivateClosing = !closing.isClosing && (
      closingTriggers.priceAccepted ||
      closingTriggers.purchaseIntent ||
      closingTriggers.contactRequest ||
      closingTriggers.discountMax
    );

    const isInClosingMode = closing.isClosing || shouldActivateClosing;
    
    let closingReason = closing.closingReason;
    if (shouldActivateClosing) {
      if (closingTriggers.priceAccepted) closingReason = 'price_accepted';
      else if (closingTriggers.purchaseIntent) closingReason = 'purchase_intent';
      else if (closingTriggers.contactRequest) closingReason = 'contact_request';
      else if (closingTriggers.discountMax) closingReason = 'discount_max';
    }

    // Verificar se mensagem pede desconto
    const discountKeywords = ['desconto', 'menor', 'baixar', 'abaixar', 'menos', 'promocao', 'promoção', 'melhor preço', 'negociar', 'barato'];
    const isAskingDiscount = discountKeywords.some(kw => msgLower.includes(kw));

    // Verificar se o cliente está respondendo a uma pergunta binária
    const isRespondingToChoice = /^(pix|cartão|cartao|credito|crédito|débito|debito|entrega|retirada|ok|sim|não|nao)$/i.test(msgLower.trim());
    
    // Verificar se o cliente está fazendo pergunta objetiva
    const isAskingObjectiveQuestion = /\?$/.test(message.trim()) || /\b(quanto|qual|como|quando|onde|tem|pode)\b/.test(msgLower);

    const shouldIncrementClosingAttempts = isInClosingMode && !isRespondingToChoice && !isAskingObjectiveQuestion;

    // Estado de negociação formatado
    const negotiationInfo = `
ESTADO DA NEGOCIAÇÃO:
- Já ofereceu desconto? ${negotiation.hasOfferedDiscount ? 'SIM' : 'NÃO'}
- Último desconto oferecido: ${negotiation.lastDiscountOffered ? `R$ ${negotiation.lastDiscountOffered}` : 'Nenhum'}
- Tentativas de desconto: ${negotiation.discountAttempts}/3
- Limite máximo atingido? ${negotiation.maxDiscountReached ? 'SIM' : 'NÃO'}`;

    // Detectar se produto tem link de pagamento
    const productHasPaymentLink = focusedProduct?.linkPagamento && focusedProduct.linkPagamento.trim() !== '';
    
    // Estado de fechamento formatado
    const closingInfo = `
═══════════════════════════════════════════
🔥 ESTADO DE FECHAMENTO:
- Modo fechamento ativo? ${isInClosingMode ? 'SIM' : 'NÃO'}
- Motivo: ${closingReason || 'nenhum'}
- Tentativas de fechamento: ${closing.closingAttempts}/3
- WhatsApp oferecido? ${closing.hasOfferedWhatsApp ? 'SIM' : 'NÃO'}
- Link de pagamento oferecido? ${closing.hasOfferedPaymentLink ? 'SIM' : 'NÃO'}
- Produto tem link? ${productHasPaymentLink ? 'SIM' : 'NÃO'}
═══════════════════════════════════════════`;
 
    // Lógica de desconto progressivo
    let discountGuidance = "";
    if (isAskingDiscount && focusedProduct && !isInClosingMode) {
      const originalPrice = Number(focusedProduct.preco);
      const minPrice = focusedProduct.precoMinimo ? Number(focusedProduct.precoMinimo) : originalPrice;
      const maxDiscountAmount = originalPrice - minPrice;
      
      if (maxDiscountAmount <= 0) {
        discountGuidance = `
⚠️ DESCONTO SOLICITADO - SEM MARGEM:
Seja educado e FIRME. Diga que o preço já é o melhor possível.
Exemplo: "Esse já é o melhor preço que consigo fazer. Vamos fechar?"`;
      } else if (negotiation.maxDiscountReached) {
        discountGuidance = `
⚠️ CLIENTE INSISTINDO - LIMITE JÁ ATINGIDO:
AVISE CLARAMENTE que é o máximo e entre em MODO FECHAMENTO.`;
      } else {
        const discountStep = maxDiscountAmount / 3;
        const currentStep = Math.min(negotiation.discountAttempts + 1, 3);
        const suggestedDiscount = discountStep * currentStep;
        const suggestedPrice = originalPrice - suggestedDiscount;
        const isMaxReached = currentStep >= 3 || suggestedPrice <= minPrice;
        
        discountGuidance = `
💰 DESCONTO PROGRESSIVO (tentativa ${currentStep}/3):
- Preço original: R$ ${originalPrice.toFixed(2)}
- Novo preço a oferecer: R$ ${Math.max(suggestedPrice, minPrice).toFixed(2)}
- É o máximo? ${isMaxReached ? 'SIM - AVISE O CLIENTE!' : 'NÃO'}`;
      }
    }

    // Instruções para link de pagamento/fechamento
    let paymentLinkInstructions = "";
    if (isAskingPaymentLink && focusedProduct) {
      if (productHasPaymentLink) {
        paymentLinkInstructions = `
════════════════════════════════════════════
💳 CLIENTE QUER PAGAR/COMPRAR - ENVIE O LINK!
════════════════════════════════════════════
LINK DO PRODUTO: ${focusedProduct.linkPagamento}

RESPOSTA OBRIGATÓRIA (use Markdown):
"Aqui está o link para finalizar:
👉 [Finalizar compra agora](${focusedProduct.linkPagamento})"

❌ PROIBIDO: placeholders, "vou gerar", "em breve"
✅ O link REAL deve aparecer como link clicável!
════════════════════════════════════════════`;
      } else {
        paymentLinkInstructions = `
════════════════════════════════════════════
⚠️ CLIENTE QUER PAGAR - SEM LINK CADASTRADO
════════════════════════════════════════════
Este produto não possui link direto.

RESPOSTA:
"Este produto não possui link direto no momento, mas posso te explicar como funciona ou te orientar pelo WhatsApp 😊"

❌ PROIBIDO: inventar link, usar placeholders
════════════════════════════════════════════`;
      }
    }

    // Instruções de MODO FECHAMENTO
    let closingModeInstructions = "";
    if (isInClosingMode) {
      const currentAttempts = shouldIncrementClosingAttempts ? closing.closingAttempts + 1 : closing.closingAttempts;
      
      if (currentAttempts >= 3) {
        closingModeInstructions = `
🛑 ENCERRAMENTO DEFINITIVO (3+ tentativas):
Responda: "Essa é minha melhor condição. Quando quiser finalizar, é só me chamar 👍"
NÃO insista mais.`;
      } else if (closing.hasOfferedWhatsApp && closingTriggers.contactRequest) {
        closingModeInstructions = `
⚠️ WHATSAPP JÁ OFERECIDO:
Continue o fechamento. Exemplo: "Já te passei o WhatsApp! Vamos fechar por aqui?"`;
      } else {
        closingModeInstructions = `
🔥 MODO FECHAMENTO ATIVO (tentativa ${currentAttempts + 1}/3):
- Faça perguntas BINÁRIAS: "Pix ou cartão?", "Entrega ou retirada?"
- NÃO volte para modo exploratório
- NÃO liste produtos novamente`;
      }
    }

    // Prevenção de loop e saudações repetidas
    let contextRules = "";
    if (!isFirstMessage) {
      contextRules = `
🚫 PROIBIDO (não é primeira mensagem):
- "Oi", "Olá", "Seja bem-vindo"
- "Como posso ajudar?"
- Qualquer saudação genérica

PRIORIDADE: Responda diretamente ao pedido do cliente.`;
    }
    
    const loopPrevention = lastBotResponse 
      ? `\n⚠️ SUA ÚLTIMA RESPOSTA: "${lastBotResponse.substring(0, 80)}..."\nNÃO repita. Avance a conversa.`
      : '';

    // ============================================================
// RECOMENDAÇÃO INTELIGENTE DE PRODUTOS
// ============================================================

const recommendationInstructions = chatMode === 'vitrine' && !focusedProduct
  ? `
════════════════════════════════════════════════════════════
🎯 RECOMENDAÇÃO INTELIGENTE DE PRODUTOS
════════════════════════════════════════════════════════════

Você está atendendo na vitrine geral.

NÃO apresente automaticamente todos os produtos.

Use o bloco "CONHECIMENTO DA ANIA" de cada produto para
entender a necessidade do cliente.

Seu trabalho é agir como uma vendedora:

1. Entenda o que o cliente está procurando.
2. Compare a necessidade dele com o conhecimento cadastrado
   dos produtos.
3. Se houver correspondência clara, recomende somente os
   produtos relevantes.
4. Se houver várias opções realmente pertinentes, selecione
   no máximo 3.
5. Se a necessidade ainda estiver vaga, faça uma pergunta
   curta para entender melhor antes de recomendar.
6. Se nenhum produto cadastrado atender claramente à
   necessidade, não invente uma solução.
7. Nunca recomende um produto apenas porque ele existe.
8. Nunca invente benefícios, indicações, resultados,
   contraindicações ou características.
9. À medida que o cliente fornecer mais informações, refine
   a recomendação.

QUANDO RECOMENDAR PRODUTOS:

Ao final da resposta, acrescente uma linha técnica neste formato:

[[PRODUCTS:ID1,ID2]]

Use somente os IDs dos produtos que realmente são relevantes.

Exemplo:

"Para o que você está procurando, encontrei uma opção que
pode fazer sentido para você. Dá uma olhada abaixo 👇

[[PRODUCTS:ID_DO_PRODUTO]]"

Se houver duas opções:

[[PRODUCTS:ID1,ID2]]

Se ainda não houver informação suficiente para recomendar,
NÃO use o marcador.

Se nenhum produto for relevante, NÃO use o marcador.

O marcador é interno e será removido antes de chegar ao cliente.

════════════════════════════════════════════════════════════
`
  : '';
   

    // Instruções de identidade
    let identityInstructions = "";
    if (isAskingIdentity || isFirstMessage) {
      identityInstructions = `
════════════════════════════════════════════
🤖 IDENTIDADE DA ANIA
════════════════════════════════════════════
${isFirstMessage ? `SAUDAÇÃO OBRIGATÓRIA:
"Oi! 👋 Eu sou a ANIA, a assistente de vendas virtual da **${storeName}**. Como posso te ajudar?"` : ''}

${isAskingIdentity ? `RESPOSTA SOBRE IDENTIDADE:
"Sou a ANIA, a assistente virtual da **${storeName}**, criada para te ajudar a conhecer nossos produtos e facilitar sua compra 😊"` : ''}

❌ NUNCA DIZER:
- "Trabalho para T&V Sistemas"
- "Fui criada por desenvolvedores"
- "Sou uma IA da OpenAI/Google"
- Qualquer referência a empresas de tecnologia

✅ SEMPRE: Você representa a ${storeName}
════════════════════════════════════════════`;
    }

    // ─── Bloco de configurações GLOBAIS da ANIA ───
    const globalConfigBlock = `
════════════════════════════════════════════
🌐 CONFIGURAÇÕES GLOBAIS DA ASSISTENTE (ania_settings)
════════════════════════════════════════════
Use estas informações OFICIAIS sempre que não houver dado no produto selecionado.
NUNCA invente nada que não esteja aqui ou no produto.

• Nome da assistente: ${assistantName}
• Mensagem inicial cadastrada: ${aniaSettings?.welcome_message || '(não cadastrada)'}
• Descrição da empresa: ${aniaSettings?.company_description || '(não cadastrada)'}
• WhatsApp de atendimento humano: ${aniaSettings?.human_support_whatsapp || '(não cadastrado)'}
• URL de atendimento humano: ${aniaSettings?.human_support_url || '(não cadastrada)'}
• E-mail de suporte: ${aniaSettings?.support_email || '(não cadastrado)'}
• Chave PIX oficial: ${aniaSettings?.pix_key || '(não cadastrada)'}
• Recebedor PIX: ${aniaSettings?.pix_receiver_name || '(não cadastrado)'}
• Banco PIX: ${aniaSettings?.pix_bank || '(não cadastrado)'}

📜 INSTRUÇÕES PERMANENTES (prompt mestre):
${aniaSettings?.global_instructions || '(nenhuma instrução adicional cadastrada)'}

📜 REGRAS DE VENDA:
${aniaSettings?.sales_rules || '(nenhuma regra adicional cadastrada)'}

════════════════════════════════════════════
🛡️ REGRAS ABSOLUTAS ANTI-INVENÇÃO
════════════════════════════════════════════
A ANIA está PROIBIDA de inventar QUALQUER um dos itens abaixo. Se não estiver cadastrado, responda exatamente:
"${fallbackMessage}"

NUNCA invente:
- Números de telefone ou WhatsApp
- Links (de pagamento, contato, suporte ou QR Code)
- Descontos, promoções ou cupons
- Chaves PIX ou dados bancários
- Formas de pagamento não listadas no produto
- Preços, prazos ou condições

✅ ORDEM DE PRIORIDADE para QUALQUER informação:
  1º — Dados do PRODUTO selecionado (se houver)
  2º — Configurações globais da ANIA (acima)
  3º — Caso nada exista: responda "${fallbackMessage}"
`;

    // PROMPT PRINCIPAL - ANIA: Assistente de Vendas Virtual
    const systemPrompt = `Você é a ${assistantName}, a assistente de vendas virtual da **${storeName}**.

${globalConfigBlock}


════════════════════════════════════════════
🧠 REGRAS ABSOLUTAS DE IDENTIDADE
════════════════════════════════════════════
- Você É a ANIA. Nunca fale de si na terceira pessoa.
- Você REPRESENTA a ${storeName} (${storeCategory}).
- NUNCA cite T&V Sistemas, desenvolvedores, criadores, OpenAI ou Google.
- NUNCA diga que trabalha para outra empresa.
- Sua identidade é SEMPRE a loja: ${storeName}

${identityInstructions}

════════════════════════════════════════════
📦 REGRAS DE APRESENTAÇÃO DE PRODUTOS
════════════════════════════════════════════

Na vitrine geral:

- NÃO apresente todos os produtos automaticamente.
- NÃO transforme a conversa em um catálogo completo.
- Recomende somente produtos relacionados à necessidade
  demonstrada pelo cliente.
- Você pode recomendar no máximo 3 produtos por resposta.
- Se não houver informação suficiente, faça uma pergunta
  para descobrir a necessidade.
- Se houver uma correspondência clara, recomende o produto
  e deixe os cards da interface apresentarem os detalhes.

Os cards possuem os botões:
👉 Saber mais
🛒 Adquirir agora

Não é necessário criar manualmente cards em Markdown.

${recommendationInstructions}

════════════════════════════════════════════
 📋 CONHECIMENTO DOS PRODUTOS
════════════════════════════════════════════
${productKnowledgeText}
${focusedProductText}

${negotiationInfo}
${closingInfo}
${discountGuidance}
${paymentLinkInstructions}
${closingModeInstructions}
${contextRules}
${loopPrevention}

════════════════════════════════════════════
💳 TIPOS DE FECHAMENTO
════════════════════════════════════════════
Cada produto pode ter UM tipo de fechamento:

🔹 TIPO A — LINK DE PAGAMENTO DIRETO
Se o produto tem link cadastrado, use Markdown clicável:
👉 [Finalizar compra agora](LINK_REAL_AQUI)

🔹 TIPO B — SEM LINK CADASTRADO
Se não tem link: orientar via WhatsApp ou explicar funcionamento.

REGRAS:
- Nunca assumir método de pagamento sem confirmação
- NUNCA inventar links
- NUNCA usar placeholders como [LINK AQUI]
  ════════════════════════════════════════════
🎯 FOCO NO PRODUTO SELECIONADO
════════════════════════════════════════════
Quando o cliente demonstrar interesse em um produto:
- PARE de falar dos outros
- Trate APENAS do produto selecionado
- Explique benefícios, uso, entrega, acesso

════════════════════════════════════════════
💬 COMPORTAMENTO GERAL
════════════════════════════════════════════
- Linguagem humana e natural
- Sem pressão excessiva
- Sem loops de resposta
- Respeitar quando o cliente disser que não quer comprar agora
- Responda em NO MÁXIMO 3 frases (exceto listagem de produtos)

════════════════════════════════════════════
🚫 FRASES PROIBIDAS
════════════════════════════════════════════
❌ "Posso ajudar em algo mais?"
❌ "Qual produto você quer?" (se há produto em foco)
❌ "Fico à disposição"
❌ "Vamos ver o que dá"
❌ "[LINK AQUI]" ou qualquer placeholder
❌ Qualquer menção a T&V Sistemas ou desenvolvedores

════════════════════════════════════════════
✅ REGRA FINAL
════════════════════════════════════════════
Você é uma vendedora virtual profissional.
Clareza visual é prioridade máxima.
Conduza o cliente até a decisão final.

${chatMode === 'vitrine' ? `
════════════════════════════════════════════
🛍️ MODO VITRINE (sem produto selecionado)
🛍️ MODO VITRINE
════════════════════════════════════════════
O cliente está conversando na vitrine geral, sem ter escolhido um produto.

A ANIA deve agir como uma VENDEDORA CONSULTIVA.

PRIMEIRO — ENTENDER A NECESSIDADE:
- Descubra o que o cliente procura.
- Use o CONHECIMENTO DA ANIA dos produtos para entender quais produtos podem atender à necessidade apresentada.
- Se ainda não houver informação suficiente, faça uma pergunta curta e natural para entender melhor.
- NÃO recomende produtos apenas porque eles existem no catálogo.

QUANDO HOUVER CORRESPONDÊNCIA:
- Recomende somente os produtos realmente relacionados à necessidade do cliente.
- Use o marcador interno [[PRODUCTS:ID1,ID2]] para exibir os cards correspondentes.
- Mostre no máximo 3 produtos.
- Explique brevemente por que aqueles produtos podem fazer sentido para a necessidade apresentada.
- Os cards da interface já possuem os botões "Saber mais" e "Adquirir agora".
- NÃO crie cards manualmente em Markdown.

REFINAMENTO DA RECOMENDAÇÃO:
- Conforme o cliente fornecer novas informações, refine a recomendação.
- Pode substituir ou reduzir os produtos anteriormente recomendados.
- Se nenhum produto atender claramente à necessidade, não force uma recomendação.

CATÁLOGO COMPLETO:
- NUNCA liste todos os produtos automaticamente na conversa.
- NUNCA apresente todos os produtos apenas porque o cliente iniciou o chat.
- Se o cliente pedir para ver o catálogo completo, a interface cuidará de encaminhá-lo para a vitrine completa.
- Nesse caso, NÃO use [[PRODUCTS:...]] para mostrar todos os produtos.

FECHAMENTO:
- Na vitrine geral, ajude o cliente a descobrir o produto adequado.
- Quando o cliente entrar no atendimento específico de um produto, o fluxo de negociação e fechamento poderá continuar normalmente.

REGRAS ABSOLUTAS:
- Nunca invente informações que não estejam cadastradas.
- Nunca invente benefícios, resultados, indicações, contraindicações, características ou condições comerciais.
- Se uma informação não estiver cadastrada, use a mensagem de fallback definida pela ANIA.
════════════════════════════════════════════
` : ''}`;

    // Montar mensagens com histórico
    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: message }
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[ai-fallback] LOVABLE_API_KEY is not configured");
      return jsonResponse(serviceFallback(storeName, focusedProduct?.nome));
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        max_tokens: 300, // Aumentado para permitir formatação Markdown
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ai-fallback] AI gateway returned HTTP ${response.status}:`, errorText);
      return jsonResponse(serviceFallback(storeName, focusedProduct?.nome));
    }

    const data = await response.json();
    const gatewayContent = data?.choices?.[0]?.message?.content;
    let aiResponse = typeof gatewayContent === "string" && gatewayContent.trim()
      ? gatewayContent.trim()
      : serviceFallback(storeName, focusedProduct?.nome);
  // ============================================================
// EXTRAIR RECOMENDAÇÕES DOS PRODUTOS
// ============================================================
//
// A IA pode devolver:
// [[PRODUCTS:id1,id2]]
//
// O marcador é removido da mensagem antes de chegar ao cliente.
// Os IDs são devolvidos separadamente para o frontend exibir
// somente os cards correspondentes.
//

let recommendedProductIds: string[] = [];

const productMarkerMatch = aiResponse.match(
  /\[\[PRODUCTS:([a-zA-Z0-9_,-]+)\]\]/i
);

if (productMarkerMatch) {
  recommendedProductIds = productMarkerMatch[1]
    .split(',')
    .map((id: string) => id.trim())
    .filter((id: string) =>
      productList.some((product: ProductInfo) => product.id === id)
    )
    .slice(0, 3);

  aiResponse = aiResponse
    .replace(productMarkerMatch[0], '')
    .trim();
}

    // Calcular atualizações de estado
    let negotiationUpdate: Partial<NegotiationState> | null = null;
    
    if (isAskingDiscount && focusedProduct && !isInClosingMode) {
      const minPrice = focusedProduct.precoMinimo ? Number(focusedProduct.precoMinimo) : Number(focusedProduct.preco);
      const originalPrice = Number(focusedProduct.preco);
      const maxDiscountAmount = originalPrice - minPrice;
      const discountStep = maxDiscountAmount / 3;
      const newAttempts = negotiation.discountAttempts + 1;
      const suggestedDiscount = discountStep * Math.min(newAttempts, 3);
      const suggestedPrice = originalPrice - suggestedDiscount;
      
      negotiationUpdate = {
        hasOfferedDiscount: true,
        lastDiscountOffered: suggestedDiscount,
        discountAttempts: newAttempts,
        maxDiscountReached: newAttempts >= 3 || suggestedPrice <= minPrice
      };
    }

    // Calcular atualização do estado de fechamento
    let closingUpdate: Partial<ClosingState> | null = null;
    
    const newClosingAttempts = shouldIncrementClosingAttempts 
      ? closing.closingAttempts + 1 
      : closing.closingAttempts;
    const shouldEndConversation = newClosingAttempts >= 3;

    // REGRA: hasOfferedWhatsApp = true SOMENTE se a IA enviar um LINK REAL de WhatsApp
    const aiSentWhatsAppLink = /wa\.me|whatsapp\.com|api\.whatsapp/.test(aiResponse.toLowerCase());
    
    // REGRA: hasOfferedPaymentLink = true SOMENTE se a IA enviar um LINK REAL de pagamento
    const aiSentPaymentLink = productHasPaymentLink && focusedProduct?.linkPagamento 
      ? aiResponse.includes(focusedProduct.linkPagamento)
      : false;

    if (isInClosingMode || shouldActivateClosing) {
      closingUpdate = {
        isClosing: true,
        closingReason: closingReason,
        closingAttempts: newClosingAttempts,
        hasOfferedWhatsApp: closing.hasOfferedWhatsApp || aiSentWhatsAppLink,
        hasOfferedPaymentLink: closing.hasOfferedPaymentLink || aiSentPaymentLink,
        conversationEnded: shouldEndConversation
      };
    }

    // Se é para encerrar, forçar mensagem final
    if (shouldEndConversation) {
      aiResponse = "Essa é minha melhor condição. Quando quiser finalizar, é só me chamar 👍";
    }

    return jsonResponse(aiResponse, recommendedProductIds, negotiationUpdate, closingUpdate);

  } catch (error) {
    console.error("ai-fallback error:", error);
    return jsonResponse("Oi! Sou a ANIA. Estou com uma instabilidade temporária. Pode tentar novamente em instantes?");
  }
});


