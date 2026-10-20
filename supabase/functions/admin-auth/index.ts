import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Senha de acesso ao painel administrativo (PWA).
// A senha fica somente como hash PBKDF2 na tabela app_admin_credentials (sem acesso público).
// A senha inicial vem do secret ADMIN_INITIAL_PASSWORD e é usada só se ainda não houver hash.

const ITERATIONS = 310_000;
const SESSION_DAYS = 30;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const enc = new TextEncoder();

const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64u = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}
async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64u(salt)}$${b64u(await pbkdf2(password, salt, ITERATIONS))}`;
}
function safeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
async function verifyPassword(password: string, stored: string) {
  const [, it, salt, hash] = stored.split("$");
  return safeEqual(await pbkdf2(password, fromB64u(salt), Number(it)), fromB64u(hash));
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(Deno.env.get("ADMIN_TOKEN_SECRET")!), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
async function makeToken(version: number) {
  const payload = b64u(enc.encode(JSON.stringify({ v: version, exp: Date.now() + SESSION_DAYS * 864e5 })));
  return `${payload}.${await hmac(payload)}`;
}
async function readToken(token: unknown): Promise<{ v: number } | null> {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!safeEqual(enc.encode(sig), enc.encode(await hmac(payload)))) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64u(payload)));
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function getCredentials() {
  const { data } = await db.from("app_admin_credentials").select("password_hash, password_version").eq("id", 1).maybeSingle();
  if (data) return data;
  const initial = Deno.env.get("ADMIN_INITIAL_PASSWORD");
  if (!initial) throw new Error("ADMIN_INITIAL_PASSWORD not configured");
  const row = { id: 1, password_hash: await hashPassword(initial), password_version: 1 };
  const { error } = await db.from("app_admin_credentials").insert(row);
  if (error) {
    const { data: again } = await db.from("app_admin_credentials").select("password_hash, password_version").eq("id", 1).single();
    return again!;
  }
  return row;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const slow = () => new Promise((r) => setTimeout(r, 600));

function safeStorageDiagnostic(error: { statusCode?: unknown; status?: unknown; error?: unknown; name?: unknown; message?: unknown }) {
  const rawStatus = Number(error.statusCode ?? error.status);
  const rawCode = typeof error.error === "string" ? error.error : typeof error.name === "string" ? error.name : "storage_error";
  const storageCode = /^[A-Za-z0-9_-]{1,80}$/.test(rawCode) ? rawCode : "storage_error";
  const storageMessage = typeof error.message === "string"
    ? error.message
      .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
      .replace(/\b(?:eyJ[A-Za-z0-9_-]*\.){2}[A-Za-z0-9_-]+\b/g, "[redacted-token]")
      .replace(/((?:authorization|api[_-]?key|token)\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
      .slice(0, 240)
    : null;

  return {
    storageStatus: Number.isFinite(rawStatus) && rawStatus > 0 ? rawStatus : null,
    storageCode,
    storageMessage,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const creds = await getCredentials();

    if (action === "login") {
      const password = typeof body.password === "string" ? body.password : "";
      if (!password || password.length > 200) return json({ error: "Informe a senha." }, 400);
      if (!(await verifyPassword(password, creds.password_hash))) { await slow(); return json({ error: "Senha incorreta." }, 401); }
      return json({ token: await makeToken(creds.password_version) });
    }

    if (action === "verify") {
      const t = await readToken(body.token);
      return json({ valid: !!t && t.v === creds.password_version });
    }

    if (action === "create-video-upload-url") {
      const t = await readToken(body.token);
      if (!t || t.v !== creds.password_version) {
        return json({ error: "admin_session_invalid" }, 401);
      }

      const fileSize = Number(body.fileSize);
      const contentType = body.contentType;
      if (!Number.isSafeInteger(fileSize) || fileSize < 1) {
        return json({ error: "invalid_file" }, 400);
      }
      if (fileSize > MAX_VIDEO_BYTES) {
        return json({ error: "video_too_large" }, 413);
      }

      const extension = contentType === "video/mp4" ? "mp4" : contentType === "video/webm" ? "webm" : null;
      if (!extension) return json({ error: "unsupported_video_type" }, 415);

      const path = `${crypto.randomUUID()}.${extension}`;
      const { data, error } = await db.storage
        .from("product-videos")
        .createSignedUploadUrl(path, { upsert: false });
      if (error || !data?.token) {
        const diagnostic = safeStorageDiagnostic(error ?? { message: "Signed upload URL was not returned." });
        console.error("[admin-auth] Signed video upload URL creation failed.", diagnostic);
        if (diagnostic.storageStatus === 403) return json({ error: "video_upload_forbidden", ...diagnostic }, 403);
        if (diagnostic.storageStatus === 413) return json({ error: "video_too_large", ...diagnostic }, 413);
        if (diagnostic.storageStatus === 404 || /bucket.*not found/i.test(diagnostic.storageMessage ?? "")) {
          return json({ error: "video_bucket_missing", ...diagnostic }, 503);
        }
        return json({ error: "video_upload_unavailable", ...diagnostic }, 503);
      }

      return json({ path: data.path, token: data.token });
    }

    if (action === "delete-product-video") {
      const t = await readToken(body.token);
      if (!t || t.v !== creds.password_version) {
        return json({ error: "admin_session_invalid" }, 401);
      }

      const path = body.path;
      if (typeof path !== "string" || path.length > 512 || path.startsWith("/") || path.includes("\\")) {
        return json({ error: "invalid_video_path" }, 400);
      }
      const segments = path.split("/");
      if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
        return json({ error: "invalid_video_path" }, 400);
      }

      const { error } = await db.storage.from("product-videos").remove([path]);
      if (error) {
        console.error("[admin-auth] Could not remove a product video object.");
        return json({ error: "video_delete_unavailable" }, 503);
      }
      return json({ success: true });
    }

    if (action === "change") {
      const t = await readToken(body.token);
      if (!t || t.v !== creds.password_version) return json({ error: "Sessão de administrador inválida. Entre novamente." }, 401);
      const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
      const next = typeof body.newPassword === "string" ? body.newPassword : "";
      if (!current || !next) return json({ error: "Preencha todos os campos." }, 400);
      if (next.length < 8 || next.length > 128) return json({ error: "A nova senha deve ter entre 8 e 128 caracteres." }, 400);
      if (!(await verifyPassword(current, creds.password_hash))) { await slow(); return json({ error: "Senha atual incorreta." }, 401); }
      const version = creds.password_version + 1;
      const { error } = await db.from("app_admin_credentials")
        .update({ password_hash: await hashPassword(next), password_version: version, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
      return json({ success: true, token: await makeToken(version) });
    }

    return json({ error: "invalid_action" }, 400);
  } catch (e) {
    console.error("[admin-auth]", e);
    return json({ error: "Erro interno. Tente novamente." }, 500);
  }
});
