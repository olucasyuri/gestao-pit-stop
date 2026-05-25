/**
 * API Route: /api/pev-importacao
 * 
 * Recebe dados do bot Discord quando o colaborador usa /importação de dados.
 * Persiste no Supabase (tabela pev_importacoes).
 * 
 * Também pode ser chamado internamente pelo site para listar/editar/excluir.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function genId() {
  return 'pev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatCNPJ(v) {
  const n = String(v || '').replace(/\D/g, '');
  if (n.length !== 14) return v;
  return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

export default async function handler(req, res) {
  // CORS para bots externos
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Verificação de secret opcional
  const API_SECRET = process.env.API_SECRET;
  if (API_SECRET) {
    const provided = req.headers['x-api-secret'] || req.query.secret;
    if (provided !== API_SECRET) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }
  }

  try {
    // ── GET: listar registros ─────────────────────────────────────────────
    if (req.method === 'GET') {
      const data = await supaReq('pev_importacoes?order=criado_em.desc');
      return res.status(200).json({ ok: true, data });
    }

    // ── POST: criar novo registro (vindo do bot Discord ou manual) ────────
    if (req.method === 'POST') {
      const { empresa, cnpj, importacao, discord_user, obs, data_virada, action } = req.body || {};

      // Ação especial: receber do bot Discord
      if (!action || action === 'create') {
        if (!empresa || !cnpj) {
          return res.status(400).json({ error: 'Campos obrigatórios: empresa, cnpj.' });
        }
        const item = {
          id: genId(),
          empresa: String(empresa).trim(),
          cnpj: formatCNPJ(String(cnpj).trim()),
          importacao: importacao === 'sim' ? 'sim' : 'nao',
          data_virada: data_virada ? String(data_virada).trim() : null,
          discord_user: String(discord_user || '').trim(),
          obs: String(obs || '').trim(),
          criado_em: new Date().toISOString(),
        };
        const saved = await supaReq('pev_importacoes', { method: 'POST', body: item });
        return res.status(201).json({ ok: true, data: Array.isArray(saved) ? saved[0] : saved });
      }

      return res.status(400).json({ error: 'action inválida.' });
    }

    // ── PUT: atualizar registro ────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { id, empresa, cnpj, importacao, obs, data_virada } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id obrigatório.' });
      const updates = {};
      if (empresa !== undefined) updates.empresa = String(empresa).trim();
      if (cnpj !== undefined) updates.cnpj = formatCNPJ(String(cnpj).trim());
      if (importacao !== undefined) updates.importacao = importacao === 'sim' ? 'sim' : 'nao';
      if (data_virada !== undefined) updates.data_virada = data_virada ? String(data_virada).trim() : null;
      if (obs !== undefined) updates.obs = String(obs).trim();
      const data = await supaReq(`pev_importacoes?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: updates });
      return res.status(200).json({ ok: true, data });
    }

    // ── DELETE: excluir registro ───────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.body || req.query || {};
      if (!id) return res.status(400).json({ error: 'id obrigatório.' });
      await supaReq(`pev_importacoes?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido.' });

  } catch (err) {
    console.error('[api/pev-importacao]', err);
    return res.status(500).json({ error: err.message });
  }
}
