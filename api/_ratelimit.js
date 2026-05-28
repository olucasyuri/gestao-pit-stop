/* ==========================================================================
   api/_ratelimit.js — Rate limiting simples (janela deslizante em memória)
   --------------------------------------------------------------------------
   ATENÇÃO: o estado fica na memória da instância serverless. Em escala, cada
   instância tem seu próprio contador, então isso é uma proteção BÁSICA contra
   flood/abuso — não um limite global exato. Para limite global rígido, use
   Upstash Redis / Vercel KV (instruções no README_PRODUCAO.md).
   ========================================================================== */

const buckets = new Map(); // chave -> { count, reset }

/**
 * @param {string} key       identificador (ex: IP + rota)
 * @param {number} limit     máximo de requisições por janela
 * @param {number} windowMs  tamanho da janela em ms
 * @returns {{ ok: boolean, remaining: number, retryAfter: number }}
 */
export function rateLimit(key, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  let b = buckets.get(key);

  if (!b || now > b.reset) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }

  b.count += 1;

  // Limpeza preguiçosa para não vazar memória.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }

  const ok = b.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - b.count),
    retryAfter: ok ? 0 : Math.ceil((b.reset - now) / 1000),
  };
}

/** Tenta descobrir o IP do cliente atrás do proxy da Vercel. */
export function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}
