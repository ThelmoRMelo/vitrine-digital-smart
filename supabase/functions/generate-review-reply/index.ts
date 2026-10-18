import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { geminiApiKey, geminiJson, geminiText, generateGeminiContent } from '../_shared/gemini.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { review_id } = await req.json();
    if (!review_id || typeof review_id !== 'string') {
      return new Response(JSON.stringify({ error: 'review_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: review, error: rErr } = await supabase
      .from('product_reviews')
      .select('*, products(name, short_description, long_description)')
      .eq('id', review_id)
      .single();

    if (rErr || !review) {
      return new Response(JSON.stringify({ error: 'Review not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: config } = await supabase
      .from('business_config')
      .select('business_name, use_emojis')
      .maybeSingle();

    const useEmojis = config?.use_emojis ?? true;
    const businessName = config?.business_name || 'nossa loja';
    const productName = (review as any).products?.name || 'o produto';

    const systemPrompt = `Você é ANIA, assistente virtual cordial de ${businessName}.
Responda de forma curta (máximo 2 frases), educada e útil ao comentário do cliente sobre "${productName}".
${useEmojis ? 'Use emojis com moderação.' : 'NÃO use emojis.'}
Não invente informações. Se for elogio, agradeça. Se for crítica, demonstre empatia.
Escreva em português do Brasil.`;

    const userPrompt = `Avaliação de ${review.customer_name} (${review.stars}★):
"${review.comment}"

Responda como ANIA:`;

    const apiKey = geminiApiKey();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Serviço de respostas não configurado.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiRes = await generateGeminiContent(apiKey, 'gemini-3.5-flash-lite', {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 200 },
    });

    if (!aiRes.ok) {
      console.error(`[generate-review-reply] Gemini returned HTTP ${aiRes.status}`);
      return new Response(JSON.stringify({ error: 'Não foi possível gerar uma resposta agora.' }), {
        status: aiRes.status === 429 ? 429 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reply = geminiText(await geminiJson(aiRes));
    if (!reply) {
      return new Response(JSON.stringify({ error: 'O provedor não retornou uma resposta válida.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: uErr } = await supabase
      .from('product_reviews')
      .update({ ania_reply: reply, ania_reply_at: new Date().toISOString() })
      .eq('id', review_id);

    if (uErr) {
      return new Response(JSON.stringify({ error: uErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[generate-review-reply] Request failed');
    return new Response(JSON.stringify({ error: 'Não foi possível gerar uma resposta agora.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
