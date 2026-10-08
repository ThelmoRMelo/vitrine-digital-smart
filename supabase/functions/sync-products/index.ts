// sync-products — sincroniza SOMENTE products.price de produtos importados.
// Nunca cria produtos, nunca chama import-product, nunca altera outros campos.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SyncProduct {
  id: string;
  name: string;
  price: number;
  source_platform: string | null;
  external_product_id: string | null;
  affiliate_url: string | null;
}

type PriceResult = { ok: true; price: number } | { ok: false; reason: string };

// ---------------- Adaptadores por plataforma ----------------
// Para adicionar Hotmart, Kiwify, Amazon, Shopee etc., basta criar
// um adaptador e registrá-lo em `adapters`.
interface PriceAdapter {
  fetchPrice(p: SyncProduct): Promise<PriceResult>;
}

/** Recorta o array JSON "polycards" e retorna o card do item informado. */
// deno-lint-ignore no-explicit-any
function findPolycard(html: string, itemId: string): any | null {
  const marker = '"polycards":';
  let from = 0;
  while (true) {
    const i = html.indexOf(marker, from);
    if (i < 0) return null;
    from = i + marker.length;
    const start = from;
    if (html[start] !== "[") continue;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let j = start; j < html.length && j < start + 400_000; j++) {
      const ch = html[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "[" || ch === "{") depth++;
      else if (ch === "]" || ch === "}") {
        depth--;
        if (depth === 0) { end = j + 1; break; }
      }
    }
    if (end < 0) continue;
    try {
      // deno-lint-ignore no-explicit-any
      const cards = JSON.parse(html.slice(start, end)) as any[];
      const card = cards.find((c) => String(c?.metadata?.id ?? "").toUpperCase() === itemId);
      if (card) return card;
    } catch { /* continua */ }
  }
}

const mercadoLivre: PriceAdapter = {
  async fetchPrice(p) {
    const itemId = (p.external_product_id ?? "").toUpperCase();
    if (!/^ML[A-Z]\d{6,}$/.test(itemId)) return { ok: false, reason: "Identificador do anúncio inválido" };

    // 1) API oficial: preço de venda atual no contexto marketplace
    //    (GET /items/{id}/sale_price?context=channel_marketplace). Exige token.
    const token = Deno.env.get("MERCADO_LIVRE_ACCESS_TOKEN");
    let apiReason: string | null = null;
    if (token) {
      try {
        const res = await fetch(
          `https://api.mercadolibre.com/items/${itemId}/sale_price?context=channel_marketplace`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
        );
        if (res.ok) {
          const data = await res.json();
          const amount = Number(data?.amount);
          if (Number.isFinite(amount) && amount > 0) return { ok: true, price: amount };
          apiReason = "Preço não informado pelo Mercado Livre";
        } else if (res.status === 404) {
          return { ok: false, reason: "Anúncio indisponível ou não encontrado" };
        } else {
          apiReason = `Erro de consulta (${res.status})`;
          console.error(`[sync-products] ML API ${itemId} -> ${res.status}: ${await res.text()}`);
        }
      } catch (e) {
        apiReason = "Erro de consulta";
        console.error("[sync-products] ML API error", e);
      }
    }

    // 2) Página pública do link de afiliado já salvo: só aceita o preço do card
    //    cujo ID é exatamente o external_product_id salvo (sem redescobrir produto).
    if (p.affiliate_url) {
      try {
        const res = await fetch(p.affiliate_url, { redirect: "follow", headers: { "User-Agent": UA } });
        if (res.ok) {
          const html = (await res.text()).slice(0, 1_500_000);
          const card = findPolycard(html, itemId);
          // deno-lint-ignore no-explicit-any
          const priceComp = (card?.components ?? []).find((c: any) => c?.type === "price");
          const amount = Number(priceComp?.price?.current_price?.value);
          if (Number.isFinite(amount) && amount > 0) return { ok: true, price: amount };
        }
      } catch (e) {
        console.error("[sync-products] affiliate page error", e);
      }
    }

    return {
      ok: false,
      reason: apiReason ??
        (token ? "Erro de consulta" : "Preço não disponível publicamente para este anúncio"),
    };
  },
};

const adapters: Record<string, PriceAdapter> = {
  mercado_livre: mercadoLivre,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let productId = "";
  try {
    const body = await req.json();
    productId = typeof body?.productId === "string" ? body.productId : "";
  } catch { /* inválido */ }
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return json({ error: "productId inválido" }, 400);

  // Cliente com a mesma permissão de quem chamou (RLS aplicada; sem service role):
  // só é possível ler/atualizar produtos que o chamador já pode editar.
  const authHeader = req.headers.get("Authorization") ?? `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: product, error } = await supabase
    .from("products")
    .select("id, name, price, source_platform, external_product_id, affiliate_url")
    .eq("id", productId)
    .maybeSingle();

  if (error || !product) return json({ status: "error", reason: "Produto não encontrado" });

  const p = product as SyncProduct;
  const adapter = p.source_platform ? adapters[p.source_platform] : undefined;
  if (!adapter || !p.external_product_id) {
    return json({ status: "skipped", name: p.name, reason: "Não sincronizável" });
  }

  const result = await adapter.fetchPrice(p);
  const now = new Date().toISOString();

  if (!result.ok) {
    await supabase.from("products").update({ last_synced_at: now }).eq("id", p.id);
    return json({ status: "error", name: p.name, reason: result.reason });
  }

  const oldPrice = Number(p.price);
  const newPrice = Math.round(result.price * 100) / 100;
  if (Math.abs(oldPrice - newPrice) < 0.005) {
    await supabase.from("products").update({ last_synced_at: now }).eq("id", p.id);
    return json({ status: "unchanged", name: p.name, price: oldPrice });
  }

  const { error: upErr } = await supabase
    .from("products")
    .update({ price: newPrice, last_synced_at: now })
    .eq("id", p.id);
  if (upErr) {
    console.error("[sync-products] update error", upErr);
    return json({ status: "error", name: p.name, reason: "Não foi possível salvar o novo preço" });
  }
  return json({ status: "updated", name: p.name, oldPrice, newPrice });
});
