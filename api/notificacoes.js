import { getBearer, getUserFromToken } from './_auth.js';
import { rateLimit, clientIp } from './_ratelimit.js';

const SITE_ORIGIN = process.env.PUBLIC_SITE_URL || '';
const jsonHeaders = { 'Content-Type': 'application/json' };

async function supabaseRequest(path, { method = 'GET', body } = {}) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes');
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, {
    method,
    headers: {
      ...jsonHeaders,
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Erro Supabase REST');
  }
  return data;
}

export default async function handler(req, res) {
  if (SITE_ORIGIN) res.setHeader('Access-Control-Allow-Origin', SITE_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const rl = rateLimit(`notif:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Muitas requisições.' });
  }

  const user = await getUserFromToken(getBearer(req));
  if (!user) return res.status(401).json({ error: 'Sessão necessária.' });

  try {
    const { action, notificacao, notificacoes, feedback } = req.body || {};

    if (action === 'criar_notificacao') {
      const data = await supabaseRequest('notificacoes', { method: 'POST', body: notificacao });
      return res.status(200).json({ ok: true, data });
    }

    if (action === 'criar_notificacoes') {
      const data = await supabaseRequest('notificacoes', { method: 'POST', body: notificacoes || [] });
      return res.status(200).json({ ok: true, data });
    }

    if (action === 'criar_feedback') {
      const created = await supabaseRequest('feedbacks', { method: 'POST', body: feedback });
      const fb = Array.isArray(created) ? created[0] : created;

      await supabaseRequest('notificacoes', {
        method: 'POST',
        body: {
          colaborador_nome: feedback.colaborador_nome,
          tipo: 'feedback',
          titulo: `Novo feedback: ${feedback.titulo}`,
          mensagem: feedback.mensagem,
          referencia_id: fb?.id || null,
        },
      });

      return res.status(200).json({ ok: true, feedback: fb });
    }

    return res.status(400).json({ error: 'Action inválida' });
  } catch (error) {
    console.error('[api/notificacoes]', error);
    return res.status(500).json({ error: error.message });
  }
}
