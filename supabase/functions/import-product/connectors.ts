// Conectores modulares por plataforma.
// Cada conector: detecta o link, resolve o produto e normaliza os dados.

export interface NormalizedReview {
  customerName: string;
  comment: string;
  stars: number;
  sourceUrl: string | null;
  sourcePlatform: string | null;
}

export interface NormalizedProduct {
  platform: string;
  platformLabel: string;
  externalId: string | null;
  sourceUrl: string;
  title: string | null;
  price: number | null;
  category: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  coverImage: string | null;
  galleryImages: string[];
  missingFields: string[];
  reviews: NormalizedReview[];
}

export const MAX_IMPORTED_REVIEWS = 5;

interface RawReview {
  customerName?: unknown;
  comment?: unknown;
  stars?: unknown;
}

/** Normaliza avaliações encontradas na fonte. Nunca inventa dados. */
export function normalizeReviews(
  raw: RawReview[],
  platform: string,
  platformLabel: string,
  sourceUrl: string | null,
): NormalizedReview[] {
  const out: NormalizedReview[] = [];
  const seen = new Set<string>();

  for (const r of raw ?? []) {
    const comment = typeof r.comment === "string" ? decodeEntities(r.comment).replace(/\s+/g, " ").trim() : "";
    if (!comment) continue;

    const starsNum = typeof r.stars === "number" ? r.stars : parseFloat(String(r.stars ?? ""));
    if (!Number.isFinite(starsNum)) continue; // sem nota real: ignora (não inventa)
    const stars = Math.max(1, Math.min(5, Math.round(starsNum)));

    const rawName = typeof r.customerName === "string" ? decodeEntities(r.customerName).replace(/\s+/g, " ").trim() : "";
    const customerName = (rawName || "Cliente").slice(0, 60);

    const key = `${customerName.toLowerCase()}|${comment.toLowerCase().slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      customerName,
      comment: comment.slice(0, 1000),
      stars,
      sourceUrl,
      sourcePlatform: platformLabel || platform,
    });

    if (out.length >= MAX_IMPORTED_REVIEWS) break;
  }

  return out;
}

/** Avaliações reais presentes em dados estruturados (JSON-LD) da página pública. */
export function reviewsFromJsonLd(html: string | null): RawReview[] {
  if (!html) return [];
  const out: RawReview[] = [];
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch (_e) {
      continue;
    }
    const nodes = Array.isArray(parsed)
      ? parsed
      : [parsed, ...(((parsed as Record<string, unknown>)?.["@graph"] as unknown[]) ?? [])];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const obj = node as Record<string, unknown>;
      const list = [obj.review, obj.reviews].flat().filter(Boolean) as Record<string, unknown>[];
      for (const rv of list) {
        if (!rv || typeof rv !== "object") continue;
        const author = rv.author as Record<string, unknown> | string | undefined;
        const rating = rv.reviewRating as Record<string, unknown> | undefined;
        out.push({
          customerName: typeof author === "string" ? author : (author?.name as string | undefined),
          comment: (rv.reviewBody ?? rv.description ?? rv.name) as string | undefined,
          stars: (rating?.ratingValue ?? rv.ratingValue) as string | number | undefined,
        });
      }
    }
  }
  return out;
}

export interface Connector {
  id: string;
  label: string;
  matches: (url: URL) => boolean;
  fetchProduct: (finalUrl: string, html: string | null) => Promise<NormalizedProduct>;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function resolveUrl(rawUrl: string): Promise<{ finalUrl: string; html: string | null }> {
  try {
    const res = await fetch(rawUrl, {
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    });
    const finalUrl = res.url || rawUrl;
    if (!res.ok) return { finalUrl, html: null };
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html")) return { finalUrl, html: null };
    const html = await res.text();
    return { finalUrl, html: html.slice(0, 800_000) };
  } catch (_e) {
    return { finalUrl: rawUrl, html: null };
  }
}

// ---------- Extração de metadados públicos (OG tags / JSON-LD) ----------

function metaContent(html: string, patterns: string[]): string | null {
  for (const p of patterns) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']+)["']`,
      "i",
    );
    const m = html.match(re);
    if (m) return decodeEntities(m[1]);
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${p}["']`,
      "i",
    );
    const m2 = html.match(re2);
    if (m2) return decodeEntities(m2[1]);
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([aeiouAEIOU])(acute|grave|circ|uml|tilde);/g, (_m, l: string, t: string) => {
      const marks: Record<string, string> = { acute: "\u0301", grave: "\u0300", circ: "\u0302", uml: "\u0308", tilde: "\u0303" };
      return (l + marks[t]).normalize("NFC");
    })
    .replace(/&ccedil;/g, "ç")
    .replace(/&Ccedil;/g, "Ç")
    .trim();
}

function allMetaImages(html: string): string[] {
  const out: string[] = [];
  const re = /<meta[^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["'][^>]*content=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(decodeEntities(m[1]));
  return out;
}

interface JsonLdProduct {
  name?: string;
  description?: string;
  image?: string | string[];
  category?: string;
  url?: string;
  offers?: { price?: string | number; lowPrice?: string | number } | Array<{ price?: string | number }>;
}

function jsonLdProduct(html: string): JsonLdProduct | null {
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const candidates = Array.isArray(parsed) ? parsed : [parsed, ...(parsed["@graph"] ?? [])];
      for (const c of candidates) {
        if (!c || typeof c !== "object") continue;
        const type = c["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.includes("Product")) return c as JsonLdProduct;
      }
    } catch (_e) {
      // ignora blocos inválidos
    }
  }
  return null;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function uniq(list: string[]): string[] {
  return [...new Set(list.filter((u) => /^https?:\/\//i.test(u)))];
}

/** Normalização genérica baseada em metadados públicos da página. */
export function fromPublicMetadata(
  platform: string,
  platformLabel: string,
  finalUrl: string,
  html: string | null,
  externalId: string | null,
): NormalizedProduct {
  const base: NormalizedProduct = {
    platform,
    platformLabel,
    externalId,
    sourceUrl: finalUrl,
    title: null,
    price: null,
    category: null,
    shortDescription: null,
    longDescription: null,
    coverImage: null,
    galleryImages: [],
    missingFields: [],
    reviews: [],
  };

  if (html) {
    const ld = jsonLdProduct(html);
    const offers = Array.isArray(ld?.offers) ? ld?.offers?.[0] : ld?.offers;

    base.title = ld?.name ?? metaContent(html, ["og:title", "twitter:title"]) ?? titleTag(html);
    base.price =
      toNumber(offers?.price) ??
      toNumber((offers as { lowPrice?: string | number } | undefined)?.lowPrice) ??
      toNumber(metaContent(html, ["product:price:amount", "og:price:amount"]));
    base.category = ld?.category ?? null;

    const desc = ld?.description ?? metaContent(html, ["og:description", "description", "twitter:description"]);
    if (desc) {
      base.shortDescription = desc.length > 180 ? desc.slice(0, 177) + "..." : desc;
      base.longDescription = desc;
    }

    const ldImages = ld?.image ? (Array.isArray(ld.image) ? ld.image : [ld.image]) : [];
    const images = uniq([...ldImages, ...allMetaImages(html)]);
    base.coverImage = images[0] ?? null;
    base.galleryImages = images.slice(1, 6);

    try {
      base.reviews = normalizeReviews(reviewsFromJsonLd(html), platform, platformLabel, finalUrl);
    } catch (e) {
      console.error("[import-product] reviews extraction failed", e);
      base.reviews = [];
    }
  }

  return withMissing(base);
}

/**
 * Extrai a URL canônica declarada pela própria página.
 * Isso é importante para links curtos/afiliados que podem
 * redirecionar para páginas intermediárias.
 */
function canonicalUrl(html: string | null): string | null {
  if (!html) return null;

  const relFirst = html.match(
    /<link[^>]+rel=["'][^"']*\bcanonical\b[^"']*["'][^>]+href=["']([^"']+)["']/i,
  );

  if (relFirst?.[1]) {
    return decodeEntities(relFirst[1]);
  }

  const hrefFirst = html.match(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*\bcanonical\b[^"']*["']/i,
  );

  return hrefFirst?.[1] ? decodeEntities(hrefFirst[1]) : null;
}

/**
 * Extrai um ID real de produto do Mercado Livre a partir
 * de uma URL confiável.
 *
 * IMPORTANTE:
 * Não procuramos mais simplesmente o primeiro MLBxxxx
 * encontrado em todo o HTML da página.
 */
function extractMercadoLivreProductIdFromUrl(value: string | null): string | null {
  if (!value) return null;

  const match = value.match(/\bMLB-?(\d{6,})\b/i);

  return match ? `MLB${match[1]}` : null;
}

/**
 * Identifica o produto do Mercado Livre somente através
 * de fontes que representam a URL do produto:
 *
 * 1. URL final do redirecionamento
 * 2. URL canônica
 * 3. og:url
 * 4. URL do JSON-LD Product
 *
 * Não utiliza mais o primeiro MLB encontrado aleatoriamente
 * no HTML.
 */
function extractMercadoLivreProductId(
  finalUrl: string,
  html: string | null,
): string | null {
  // 1. URL final do redirecionamento
  const fromFinalUrl = extractMercadoLivreProductIdFromUrl(finalUrl);

  if (fromFinalUrl) {
    return fromFinalUrl;
  }

  if (!html) {
    return null;
  }

  // 2. URL canônica
  const fromCanonical = extractMercadoLivreProductIdFromUrl(
    canonicalUrl(html),
  );

  if (fromCanonical) {
    return fromCanonical;
  }

  // 3. og:url
  const ogUrl = metaContent(html, ["og:url"]);

  const fromOgUrl = extractMercadoLivreProductIdFromUrl(ogUrl);

  if (fromOgUrl) {
    return fromOgUrl;
  }

  // 4. JSON-LD Product
  const ld = jsonLdProduct(html);

  const fromJsonLd = extractMercadoLivreProductIdFromUrl(
    ld?.url ?? null,
  );

  if (fromJsonLd) {
    return fromJsonLd;
  }

  // Não usamos mais:
  //
  // html.match(/(ML[A-Z])-?(\d{6,})/i)
  //
  // porque isso pode capturar o ID de outro produto
  // recomendado ou relacionado dentro da mesma página.

  return null;
}

function titleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]{1,300}?)<\/title>/i);
  return m ? decodeEntities(m[1]) : null;
}

export function withMissing(p: NormalizedProduct): NormalizedProduct {
  const missing: string[] = [];
  if (!p.title) missing.push("nome");
  if (!p.price) missing.push("preço");
  if (!p.category) missing.push("categoria");
  if (!p.shortDescription) missing.push("descrição");
  if (!p.coverImage) missing.push("imagem principal");
  p.missingFields = missing;
  return p;
}

// ---------------------- Mercado Livre ----------------------

/** Avaliações públicas do Mercado Livre (API pública de reviews, sem credenciais). */
async function fetchMercadoLivreReviews(itemId: string, sourceUrl: string): Promise<NormalizedReview[]> {
  try {
    const res = await fetch(`https://api.mercadolibre.com/reviews/item/${itemId}?limit=20`, {
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data?.reviews) ? data.reviews : [];
    const raw = list.map((r: Record<string, unknown>) => ({
      customerName: (r.reviewer_name ?? (r.reviewer as Record<string, unknown> | undefined)?.nickname) as unknown,
      comment: [r.title, r.content].filter((v) => typeof v === "string" && v.trim()).join(" — "),
      stars: r.rate ?? r.rating,
    }));
    return normalizeReviews(raw, "mercado_livre", "Mercado Livre", sourceUrl);
  } catch (e) {
    console.error("[import-product] reviews extraction failed (ML)", e);
    return [];
  }
}

const mercadoLivre: Connector = {
const mercadoLivre: Connector = {
  id: "mercado_livre",
  label: "Mercado Livre",

  matches: (u) =>
    /(^|\.)mercadolivre\.com|(^|\.)mercadolibre\.com|(^|\.)mercadolivre\.com\.br|meli\.la/i.test(
      u.hostname,
    ),

  fetchProduct: async (finalUrl, html) => {
    /**
     * IMPORTANTE:
     * Nunca mais usamos o primeiro MLB encontrado aleatoriamente
     * no HTML.
     *
     * Isso evita que uma página intermediária do meli.la contendo
     * vários produtos faça o sistema importar um produto diferente
     * daquele enviado pelo usuário.
     */
    const itemId = extractMercadoLivreProductId(finalUrl, html);

    if (itemId) {
      try {
        const res = await fetch(
          `https://api.mercadolibre.com/items/${itemId}`,
          {
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (res.ok) {
          const item = await res.json();

          let category: string | null = null;

          if (item.category_id) {
            try {
              const catRes = await fetch(
                `https://api.mercadolibre.com/categories/${item.category_id}`,
              );

              if (catRes.ok) {
                category = (await catRes.json())?.name ?? null;
              }
            } catch (_e) {
              // Categoria é opcional.
            }
          }

          let description: string | null = null;

          try {
            const dRes = await fetch(
              `https://api.mercadolibre.com/items/${itemId}/description`,
            );

            if (dRes.ok) {
              description = (await dRes.json())?.plain_text ?? null;
            }
          } catch (_e) {
            // Descrição é opcional.
          }

          const pics: string[] = uniq(
            (item.pictures ?? []).map(
              (p: { secure_url?: string; url?: string }) =>
                p.secure_url || p.url || "",
            ),
          );

          const attrs = (item.attributes ?? [])
            .filter(
              (a: { name?: string; value_name?: string }) =>
                a?.name && a?.value_name,
            )
            .slice(0, 12)
            .map(
              (a: { name: string; value_name: string }) =>
                `${a.name}: ${a.value_name}`,
            )
            .join("\n");

          const productUrl = item.permalink || finalUrl;

          return withMissing({
            platform: "mercado_livre",
            platformLabel: "Mercado Livre",

            // ID real confirmado pela API do Mercado Livre.
            externalId: itemId,

            // URL canônica real do produto.
            sourceUrl: productUrl,

            title: item.title ?? null,

            price: toNumber(item.price),

            category,

            shortDescription: item.title ?? null,

            longDescription:
              [description, attrs].filter(Boolean).join("\n\n") || null,

            coverImage: pics[0] ?? item.thumbnail ?? null,

            galleryImages: pics.slice(1, 6),

            missingFields: [],

            reviews: await fetchMercadoLivreReviews(
              itemId,
              productUrl,
            ),
          });
        }
      } catch (_e) {
        // Cai para tratamento abaixo.
      }
    }

    /**
     * Se o link não permitiu identificar um ID confiável,
     * não tentamos escolher aleatoriamente outro MLB existente
     * no HTML.
     *
     * O fallback de metadados ainda pode ser utilizado quando
     * a página realmente representa um produto, mas nunca mais
     * usamos o primeiro MLB encontrado na página.
     */
    return fromPublicMetadata(
      "mercado_livre",
      "Mercado Livre",
      finalUrl,
      html,
      itemId,
    );
  },
};

// ---------------------- Shopee ----------------------

const shopee: Connector = {
  id: "shopee",
  label: "Shopee",
  matches: (u) => /(^|\.)shopee\.|(^|\.)shp\.ee/i.test(u.hostname),
  fetchProduct: async (finalUrl, html) => {
    const m = finalUrl.match(/i\.(\d+)\.(\d+)/) ?? finalUrl.match(/-i\.(\d+)\.(\d+)/);
    const externalId = m ? `${m[1]}_${m[2]}` : null;
    return fromPublicMetadata("shopee", "Shopee", finalUrl, html, externalId);
  },
};

// ---------------------- Hotmart ----------------------

const hotmart: Connector = {
  id: "hotmart",
  label: "Hotmart",
  matches: (u) => /(^|\.)hotmart\.com|(^|\.)hotm\.art/i.test(u.hostname),
  fetchProduct: async (finalUrl, html) => {
    const off = finalUrl.match(/[?&]off=([A-Za-z0-9]+)/);
    const slug = finalUrl.match(/hotmart\.com\/[^/]+\/([A-Za-z0-9-]+)/);
    const externalId = off?.[1] ?? slug?.[1] ?? null;
    return fromPublicMetadata("hotmart", "Hotmart", finalUrl, html, externalId);
  },
};

// ---------------------- Genérico (outras plataformas) ----------------------

const genericConnector: Connector = {
  id: "outro",
  label: "Outra plataforma",
  matches: () => false,
  fetchProduct: (finalUrl, html) => Promise.resolve(fromPublicMetadata("outro", "Outra plataforma", finalUrl, html, null)),
};

export const connectors: Connector[] = [mercadoLivre, shopee, hotmart];

export function detectConnector(url: string, forced?: string | null): Connector | null {
  if (forced) {
    if (forced === "outro") return genericConnector;
    return connectors.find((c) => c.id === forced) ?? null;
  }
  try {
    const u = new URL(url);
    return connectors.find((c) => c.matches(u)) ?? null;
  } catch (_e) {
    return null;
  }
}

export { genericConnector };
