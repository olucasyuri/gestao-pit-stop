/**
 * API Route: /api/treinamentos  (versão endurecida)
 * CRUD para `treinamentos` e `treinamento_presencas`.
 * Agora exige usuário autenticado, com rate limit e CORS restrito.
 */
import { getBearer, getUserFromToken } from './_auth.js';
import { rateLimit, clientIp } from './_ratelimit.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_ORIGIN  = process.env.PUBLIC_SITE_URL || '';

async function supaReq(path, { method = 'GET', body } = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Supabase não configurado no servidor.');
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

export default async function handler(req, res) {
  if (SITE_ORIGIN) res.setHeader('Access-Control-Allow-Origin', SITE_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const rl = rateLimit(`trein:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Muitas requisições.' });
  }

  const user = await getUserFromToken(getBearer(req));
  if (!user) return res.status(401).json({ error: 'Sessão necessária.' });

  try {
    if (req.method === 'GET') {
      const { setor } = req.query;
      const filtro = setor ? `?setor=eq.${encodeURIComponent(setor)}&order=mes_ref.desc,criado_em.desc` : '?order=mes_ref.desc,criado_em.desc';
      const [treinamentos, presencas] = await Promise.all([
        supaReq(`treinamentos${filtro}`),
        supaReq('treinamento_presencas?order=colaborador.asc'),
      ]);
      return res.status(200).json({ treinamentos: treinamentos || [], presencas: presencas || [] });
    }

    if (req.method === 'POST') {
      const { titulo, descricao, setor, mes_ref, colaboradores } = req.body || {};
      if (!titulo || !setor || !mes_ref) return res.status(400).json({ error: 'titulo, setor e mes_ref são obrigatórios.' });

      const id = `trein_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const [treinamento] = await supaReq('treinamentos', {
        method: 'POST',
        body: { id, titulo, descricao: descricao || '', setor, mes_ref },
      });

      let presencasCriadas = [];
      if (Array.isArray(colaboradores) && colaboradores.length > 0) {
        const presencas = colaboradores.map(nome => ({
          id: `pres_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${nome.slice(0, 4)}`,
          treinamento_id: id,
          colaborador: nome,
          status: 'pendente',
          atualizado_em: new Date().toISOString(),
        }));
        presencasCriadas = await supaReq('treinamento_presencas', { method: 'POST', body: presencas });
      }

      return res.status(201).json({ ok: true, treinamento, presencas: presencasCriadas });
    }

    if (req.method === 'PATCH') {
      const { tipo } = req.body || {};

      if (tipo === 'presenca') {
        const { presenca_id, status } = req.body;
        if (!presenca_id || !status) return res.status(400).json({ error: 'presenca_id e status obrigatórios.' });
        const [updated] = await supaReq(`treinamento_presencas?id=eq.${encodeURIComponent(presenca_id)}`, {
          method: 'PATCH',
          body: { status, atualizado_em: new Date().toISOString() },
        });
        return res.status(200).json({ ok: true, presenca: updated });
      }

      if (tipo === 'treinamento') {
        const { id, titulo, descricao, mes_ref } = req.body;
        if (!id) return res.status(400).json({ error: 'id obrigatório.' });
        const updates = {};
        if (titulo !== undefined) updates.titulo = titulo;
        if (descricao !== undefined) updates.descricao = descricao;
        if (mes_ref !== undefined) updates.mes_ref = mes_ref;
        const [updated] = await supaReq(`treinamentos?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: updates });
        return res.status(200).json({ ok: true, treinamento: updated });
      }

      return res.status(400).json({ error: 'tipo inválido. Use "presenca" ou "treinamento".' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id obrigatório.' });
      await supaReq(`treinamento_presencas?treinamento_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      await supaReq(`treinamentos?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error('[api/treinamentos]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
