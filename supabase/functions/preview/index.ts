import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const productId = pathParts[pathParts.length - 1];

    if (!productId) {
      return new Response("Product ID required", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: product, error } = await supabase
      .from("products")
      .select("name, short_description, image_url")
      .eq("id", productId)
      .single();

    if (error || !product) {
      return new Response("Product not found", { status: 404 });
    }

    const siteUrl = (Deno.env.get("SITE_URL") || "https://vitrine-digital-smart.lovable.app").replace(//+$/, "");  
    const chatUrl = `${siteUrl}/chat/${productId}`;

    // Detecção de crawlers sociais
    const userAgent = req.headers.get("user-agent") ?? "";
    const purpose = (req.headers.get("purpose") ?? req.headers.get("x-purpose") ?? "").toLowerCase();
    const secFetchMode = (req.headers.get("sec-fetch-mode") ?? "").toLowerCase();
    const secFetchDest = (req.headers.get("sec-fetch-dest") ?? "").toLowerCase();
    const secFetchUser = req.headers.get("sec-fetch-user") ?? "";
    const hasUpgradeInsecureRequests = req.headers.has("upgrade-insecure-requests");
    const accept = (req.headers.get("accept") ?? "").toLowerCase();

    // Lista expandida de crawlers sociais.
    // IMPORTANTE: NÃO marcar o app do Instagram (navegação humana) como crawler.
    // O app do Instagram costuma enviar UA contendo "Instagram" (sem "Bot") e com sec-fetch-mode=navigate.
    const crawlerPatterns = [
      /facebookexternalhit/i,
      /facebot/i,
      /twitterbot/i,
      /telegrambot/i,
      /linkedinbot/i,
      /slackbot/i,
      /discordbot/i,
      /whatsapp/i,
      /instagrambot/i,        // InstagramBot específico (crawler)
      /metainspector/i,
      /pinterest/i,
      /pinterestbot/i,
      /googlebot/i,
      /bingbot/i,
      /applebot/i,
      /embedly/i,
      /quora link preview/i,
      /showyoubot/i,
      /outbrain/i,
      /vkshare/i,
      /w3c_validator/i,
      /facebookcatalog/i,
    ];

    // Instagram in-app browser (humano): contém "Instagram" no UA, mas não "InstagramBot".
    // Em alguns ambientes ele pode vir sem os sec-fetch-*; ainda assim devemos redirecionar para o chat.
    const isInstagramApp = /instagram/i.test(userAgent) && !/instagrambot/i.test(userAgent);

    const isSocialCrawler =
      crawlerPatterns.some((pattern) => pattern.test(userAgent)) ||
      purpose.includes("preview") ||
      purpose.includes("prefetch") ||
      // Alguns crawlers não se identificam mas pedem apenas HTML/imagem
      (accept.includes("text/html") && !accept.includes("application/javascript") && /bot/i.test(userAgent));

    // Detectar navegação humana real
    const isNavigation =
      secFetchMode === "navigate" ||
      secFetchDest === "document" ||
      secFetchUser === "?1" ||
      hasUpgradeInsecureRequests;

    // Log para debug
    console.log(`[preview] UA: ${userAgent.substring(0, 100)}`);
    console.log(`[preview] isSocialCrawler: ${isSocialCrawler}, isNavigation: ${isNavigation}`);

    // Redirecionar navegação humana real.
    // - Não redirecionar crawlers (para manter o banner/OG)
    // - EXCEÇÃO: o app do Instagram (human) contém "Instagram" no UA e era confundido com crawler.
    const shouldRedirectToChat =
      req.method === "GET" &&
      // Navegação humana real OU webview do Instagram (que às vezes não manda sec-fetch-*)
      (isNavigation || isInstagramApp) &&
      // Não redirecionar crawlers (para manter OG), exceto o app do Instagram (humano)
      (!isSocialCrawler || isInstagramApp);

    if (shouldRedirectToChat) {
      const headers = new Headers(corsHeaders);
      headers.set("Location", chatUrl);
      headers.set("Cache-Control", "no-store, max-age=0");
      return new Response(null, { status: 302, headers });
    }

    // OG data - sempre renderizado server-side para garantir preview imediato
    const ogTitle = product.name || "Produto";
    const ogDescription = product.short_description || "Confira este produto incrível!";
    const ogImage = product.image_url || `${siteUrl}/icon-512.png`;
    const ogImageType = guessImageMimeType(ogImage);

    // HTML otimizado para crawlers sociais (Instagram, WhatsApp, Facebook, etc.)
    // IMPORTANTE: Manter estrutura mínima e limpa para evitar problemas de parsing
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${escapeHtml(ogTitle)}</title>
<meta name="description" content="${escapeHtml(ogDescription)}">

<!-- Open Graph Meta Tags (Instagram, WhatsApp, Facebook, LinkedIn) -->
<meta property="og:title" content="${escapeHtml(ogTitle)}">
<meta property="og:description" content="${escapeHtml(ogDescription)}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta property="og:image:secure_url" content="${escapeHtml(ogImage)}">
${ogImageType ? `<meta property="og:image:type" content="${escapeHtml(ogImageType)}">` : ''}
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtml(ogTitle)}">
<meta property="og:url" content="${escapeHtml(chatUrl)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="${escapeHtml(ogTitle)}">
<meta property="og:locale" content="pt_BR">

<!-- Twitter Card Meta Tags -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(ogTitle)}">
<meta name="twitter:description" content="${escapeHtml(ogDescription)}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">
<meta name="twitter:image:alt" content="${escapeHtml(ogTitle)}">

<!-- Redirect para humanos que não são crawlers -->
<meta http-equiv="refresh" content="0; url=${escapeHtml(chatUrl)}">
<link rel="canonical" href="${escapeHtml(chatUrl)}">

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.container { text-align: center; padding: 20px; max-width: 500px; }
.product-image {
  width: 100%;
  max-width: 400px;
  height: auto;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  margin-bottom: 24px;
  display: block;
}
.product-name {
  color: white;
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 12px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.product-description {
  color: rgba(255,255,255,0.9);
  font-size: 16px;
  line-height: 1.5;
  margin-bottom: 24px;
}
.loading { color: rgba(255,255,255,0.8); font-size: 14px; }
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.fallback-link {
  display: inline-block;
  margin-top: 10px;
  color: rgba(255,255,255,0.95);
  text-decoration: underline;
}
</style>
</head>
<body>
<div class="container">
${ogImage ? `<a href="${escapeHtml(chatUrl)}"><img src="${escapeHtml(ogImage)}" alt="${escapeHtml(ogTitle)}" class="product-image"></a>` : ''}
<h1 class="product-name">${escapeHtml(ogTitle)}</h1>
<p class="product-description">${escapeHtml(ogDescription)}</p>
<div class="loading">
<div class="spinner"></div>
Abrindo o chat do produto...
<div><a class="fallback-link" href="${escapeHtml(chatUrl)}">Clique aqui se não redirecionar</a></div>
</div>
</div>
</body>
</html>`;

    // Headers (em formato objeto) para evitar o runtime cair no default text/plain.
    const headers: Record<string, string> = {
      ...corsHeaders,
      // Content-Type é crítico para que navegadores (ex.: in-app browser do Instagram) renderizem HTML e não exibam como texto.
      "Content-Type": "text/html; charset=utf-8",
      // Cache curto para permitir atualizações rápidas de produtos
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      // CSP mais permissivo para evitar bloqueios de imagem
      "Content-Security-Policy":
        "default-src 'self'; img-src * data: https:; style-src 'unsafe-inline'; script-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      // Forçar respeito ao Content-Type
      "X-Content-Type-Options": "nosniff",
      // Ajuda a evitar cache/variações estranhas por user-agent
      Vary: "User-Agent, Accept",
    };

    return new Response(html, { status: 200, headers });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function guessImageMimeType(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.png')) return 'image/png';
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
    if (pathname.endsWith('.webp')) return 'image/webp';
    if (pathname.endsWith('.gif')) return 'image/gif';
    // Para URLs do Supabase Storage que não têm extensão, assumir JPEG
    if (url.includes('supabase') && url.includes('storage')) return 'image/jpeg';
    return 'image/jpeg'; // Default para imagens sem extensão
  } catch {
    return 'image/jpeg';
  }
}
