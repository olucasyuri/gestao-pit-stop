/* ==========================================================================
   api/_auth.js — Verificação de sessão no servidor
   --------------------------------------------------------------------------
   Valida o token JWT do usuário (enviado pelo front no header
   Authorization: Bearer ...) chamando o endpoint /auth/v1/user do Supabase.
   Retorna o usuário se válido, ou null.
   ========================================================================== */

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Extrai o Bearer token do request.
 */
export function getBearer(req) {
  const h = req.headers["authorization"] || req.headers["Authorization"] || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

/**
 * Verifica o token contra o Supabase Auth.
 * @returns {Promise<object|null>} usuário autenticado, ou null se inválido.
 */
export async function getUserFromToken(token) {
  if (!token || !SUPABASE_URL || !ANON_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const user = await res.json().catch(() => null);
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

/**
 * Atalho: true se o request traz um usuário autenticado válido.
 */
export async function isAuthenticated(req) {
  const user = await getUserFromToken(getBearer(req));
  return !!user;
}
