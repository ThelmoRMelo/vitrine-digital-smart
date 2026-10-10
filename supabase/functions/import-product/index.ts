import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { connectors, detectConnector, resolveUrl, type NormalizedProduct } from "./connectors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const BUCKET = "product-images";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function friendly(code: string) {
  const map: Record<string, string> = {
    invalid_link: "Esse link não parece ser válido.",
    not_found: "Não conseguimos localizar o produto através desse link.",
    unsupported: "Essa plataforma ainda não possui integração automática.",
    connection: "Não foi possível obter as informações agora. Tente novamente.",
  };
  return map[code] ?? map.connection;
}

/** Baixa a imagem e reenvia para o Storage do projeto. Retorna null em falha. */
async function mirrorImage(
  supabase: ReturnType<typeof createClient>,
  imageUrl: string,
  prefix: string,
  index: number,
): Promise<string | null> {
  try {
    let currentUrl = imageUrl;
    let res: Response | null = null;
    for (let hop = 0; hop <= 3; hop++) {
      const url = new URL(currentUrl);
      if (url.protocol !== "https:" || url.username || url.password || await isPrivateHost(url.hostname)) return null;
      res = await fetch(url, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0" } });
      if (![301, 302, 303, 307, 308].includes(res.status)) break;
      const location = res.headers.get("location");
      if (!location || hop === 3) return null;
      currentUrl = new URL(location, url).toString();
    }
    if (!res) return null;
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024) return null;
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("gif") ? "gif" : "jpg";
    const path = `imported/${prefix}-${Date.now()}-${index}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: type,
      upsert: true,
    });
    if (error) return null;
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (_e) {
    return null;
  }
}

async function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const privateAddress = (value: string) => {
    const address = value.toLowerCase().replace(/^\[|\]$/g, "");
    return /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(address) ||
      address === "::" || address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:") || address.startsWith("ff") ||
      address.startsWith("::ffff:127.") || address.startsWith("::ffff:10.") || address.startsWith("::ffff:192.168.") || address.startsWith("::ffff:169.254.");
  };
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "metadata.google.internal" || privateAddress(host)) return true;
  if (/^\d+(?:\.\d+){3}$/.test(host) || host.includes(":")) return false;
  try {
    const lookups = await Promise.allSettled([Deno.resolveDns(host, "A"), Deno.resolveDns(host, "AAAA")]);
    const addresses = lookups.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    return addresses.length === 0 || addresses.some(privateAddress);
  } catch (_e) { return true; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: friendly("connection") }, 405);

  let payload: { url?: unknown; platform?: unknown };
  try {
    payload = await req.json();
  } catch (_e) {
    return json({ error: friendly("invalid_link"), code: "invalid_link" }, 400);
  }

  const rawUrl = typeof payload.url === "string" ? payload.url.trim() : "";
  const forced = typeof payload.platform === "string" && payload.platform ? payload.platform : null;

  if (!rawUrl || rawUrl.length > 2000 || !/^https?:\/\/\S+\.\S+/i.test(rawUrl)) {
    return json({ error: friendly("invalid_link"), code: "invalid_link" }, 400);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Sua sessão expirou. Entre novamente para importar produtos.", code: "unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Sua sessão expirou. Entre novamente para importar produtos.", code: "unauthorized" }, 401);
  const tenantId = userData.user.id;

  try {
    const { finalUrl, html } = await resolveUrl(rawUrl);

    const connector = detectConnector(finalUrl, forced) ?? detectConnector(rawUrl, null);
    if (!connector) {
      return json(
        {
          code: "unknown_platform",
          error: "Não conseguimos identificar automaticamente a plataforma.",
          platforms: [...connectors.map((c) => ({ id: c.id, label: c.label })), { id: "outro", label: "Outra plataforma" }],
        },
        200,
      );
    }

    let product: NormalizedProduct;
    try {
      product = await connector.fetchProduct(finalUrl, html);
    } catch (_e) {
      return json({ error: friendly("connection"), code: "connection" }, 200);
    }

/**
 * Segurança para importações do Mercado Livre:
 *
 * Se não conseguimos identificar um ID real de produto,
 * não permitimos que uma página intermediária seja tratada
 * como se fosse um produto válido.
 *
 * Isso evita importar acidentalmente um produto recomendado
 * ou relacionado encontrado no HTML de um link meli.la.
 */
if (product.platform === "mercado_livre" && !product.externalId) {
  return json(
    {
      error:
        "Não foi possível identificar com segurança o produto do Mercado Livre através deste link. Cole novamente o link de afiliado ou o link direto da página específica do produto.",
      code: "mercado_livre_product_id_not_found",
    },
    200,
  );
}

    if (!product.title && !product.coverImage && !product.price) {
      return json({ error: friendly("not_found"), code: "not_found" }, 200);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Duplicidade:
// Consideramos duplicado somente quando o mesmo produto de origem
// foi importado pelo MESMO link de origem.
// Isso permite cadastrar o mesmo produto de uma plataforma usando
// outro link de afiliado, sem bloquear o novo cadastro.
let duplicate: {
  id: string;
  name: string;
  reason: "same_source_link" | "same_external_product";
} | null = null;

if (product.externalId) {
  // 1. Primeiro: verifica se o MESMO link de origem já está cadastrado.
  const { data: sameSource } = await supabase
    .from("products")
    .select("id, name")
    .eq("source_platform", product.platform)
    .eq("source_url", product.sourceUrl)
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();

  if (sameSource) {
    duplicate = {
      id: sameSource.id as string,
      name: sameSource.name as string,
      reason: "same_source_link",
    };
  }
}

    // Espelhar imagens no Storage (falha de uma imagem não interrompe o processo)
    const warnings: string[] = [];
    const idPrefix = (product.externalId ?? "prod").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "prod";

    let cover: string | null = null;
    if (product.coverImage) {
      cover = await mirrorImage(supabase, product.coverImage, idPrefix, 0);
      if (!cover) {
        cover = product.coverImage;
        warnings.push("A imagem principal não pôde ser importada para o seu acervo e usará o link original.");
      }
    }

    const gallery: string[] = [];
    let failedGallery = 0;
    for (let offset = 0; offset < product.galleryImages.length; offset += 4) {
      const batch = product.galleryImages.slice(offset, offset + 4);
      const results = await Promise.all(batch.map((imageUrl, index) => mirrorImage(supabase, imageUrl, idPrefix, offset + index + 1)));
      results.forEach((mirrored, index) => {
        if (mirrored) gallery.push(mirrored);
        else { gallery.push(batch[index]); failedGallery++; }
      });
    }
    if (failedGallery > 0) {
      warnings.push(`${failedGallery} imagem(ns) da galeria não pôde(ram) ser armazenada(s); as URLs de origem foram mantidas.`);
    }

    const populatedFields = [product.title && "nome", product.price != null && "preço", product.shortDescription && "descrição curta", product.longDescription && "descrição comercial", product.technicalDetails && "ficha técnica", product.brand && "marca", product.model && "modelo", cover && "imagem principal", gallery.length > 0 && "galeria"].filter(Boolean) as string[];
    const errors = [...warnings];
    const report = {
      generatedAt: new Date().toISOString(),
      result: warnings.length || product.missingFields.length ? "partial" : "success",
      identity: { externalId: product.externalId, title: product.title, sourceUrl: product.sourceUrl },
      populatedFields,
      missingFields: product.missingFields,
      imageCounts: { found: product.galleryImages.length + (product.coverImage ? 1 : 0), imported: Math.max(0, (product.coverImage && cover !== product.coverImage ? 1 : 0) + gallery.filter((url, i) => url !== product.galleryImages[i]).length), failed: failedGallery + (product.coverImage && cover === product.coverImage ? 1 : 0) },
      dataSources: product.dataSources,
      errors,
      pendingReviewFields: product.missingFields,
    };

    return json({
      ok: true,
      duplicate,
      warnings,
      product: {
        platform: product.platform,
        platformLabel: product.platformLabel,
        externalId: product.externalId,
        sourceUrl: product.sourceUrl,
        title: product.title,
        price: product.price,
        category: product.category,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        technicalDetails: product.technicalDetails,
        brand: product.brand,
        model: product.model,
        coverImage: cover,
        galleryImages: gallery,
        missingFields: product.missingFields,
        report,
        reviews: Array.isArray(product.reviews) ? product.reviews.slice(0, 5) : [],
      },
    });
  } catch (e) {
    console.error("[import-product]", e);
    return json({ error: friendly("connection"), code: "connection" }, 200);
  }
});
