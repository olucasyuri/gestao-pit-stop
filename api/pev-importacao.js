/**
 * API Route: /api/pev-importacao
 *
 * Recebe dados do bot Discord quando o colaborador usa /importação de dados.
 * Persiste no Supabase (tabela pev_importacoes).
 *
 * Campos adicionais para fluxo de aprovação:
 *   - discord_id   : ID numérico do usuário no Discord (para enviar DM)
 *   - discord_nome : Display name no Discord
 *   - status       : 'pendente' | 'aprovado' | 'reprovado'
 *   - status_em    : ISO timestamp da última mudança de status
 *   - motivo_reprovacao : texto livre
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

async function notificarViaHermes(item, statusNovo) {
  const HERMES_URL = process.env.HERMES_URL;
  const API_SECRET = process.env.API_SECRET;
  if (!HERMES_URL) {
    console.warn('[api/pev-importacao] HERMES_URL não configurada — DM não enviada.');
    return { ok: false, reason: 'HERMES_URL ausente' };
  }
  if (!item.discord_id) {
    console.warn('[api/pev-importacao] discord_id ausente — DM não enviada.');
    return { ok: false, reason: 'discord_id ausente' };
  }

  const nomeColab = item.discord_nome || item.discord_user || 'colaborador';
  const emoji     = statusNovo === 'aprovado' ? '✅' : '❌';

  let mensagem = `Olá, ${nomeColab}! Sua solicitação de importação de dados foi analisada.\n\n`;
  mensagem += `**Empresa:** ${item.empresa || '—'}\n`;
  mensagem += `**CNPJ:** ${item.cnpj || '—'}\n`;
  if (item.data_virada) {
    const dv = new Date(item.data_virada + 'T00:00:00').toLocaleDateString('pt-BR');
    mensagem += `**Virada do sistema:** ${dv}\n`;
  }
  mensagem += `\n**Status: ${emoji} ${statusNovo === 'aprovado' ? 'APROVADO' : 'REPROVADO'}**`;
  if (statusNovo === 'reprovado' && item.motivo_reprovacao) {
    mensagem += `\n**Motivo:** ${item.motivo_reprovacao}`;
  }
  mensagem += `\n\nQualquer dúvida, fale com a gestão. 🚗`;

  const res = await fetch(`${HERMES_URL.replace(/\/$/, '')}/api/hermes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_SECRET ? { 'x-api-secret': API_SECRET } : {}),
    },
    body: JSON.stringify({
      tipo: 'pitstop-mensagem',
      discord_id: item.discord_id,
      nome: nomeColab,
      mensagem,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Hermes HTTP ${res.status}`);
  return { ok: true, hermes: data };
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

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
      const { empresa, cnpj, importacao, discord_user, discord_nome, discord_id, obs, data_virada, action } = req.body || {};

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
          discord_nome: String(discord_nome || discord_user || '').trim(),
          discord_id:   String(discord_id   || '').trim(),
          obs: String(obs || '').trim(),
          status: 'pendente',
          status_em: null,
          motivo_reprovacao: '',
          agendado: 'nao',
          criado_em: new Date().toISOString(),
        };
        const saved = await supaReq('pev_importacoes', { method: 'POST', body: item });
        return res.status(201).json({ ok: true, data: Array.isArray(saved) ? saved[0] : saved });
      }

      // ── Ação: aprovar ────────────────────────────────────────────────────
      if (action === 'aprovar') {
        const { id } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id obrigatório.' });

        const updates = { status: 'aprovado', status_em: new Date().toISOString() };
        const data = await supaReq(`pev_importacoes?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: updates });
        const item = Array.isArray(data) ? data[0] : data;

        let hermesResult = null;
        try { hermesResult = await notificarViaHermes(item, 'aprovado'); }
        catch (he) { console.warn('[pev-importacao] DM falhou:', he.message); }

        return res.status(200).json({ ok: true, data: item, hermes: hermesResult });
      }

      // ── Ação: reprovar ───────────────────────────────────────────────────
      if (action === 'reprovar') {
        const { id, motivo_reprovacao } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id obrigatório.' });

        const updates = {
          status: 'reprovado',
          status_em: new Date().toISOString(),
          motivo_reprovacao: String(motivo_reprovacao || '').trim(),
        };
        const data = await supaReq(`pev_importacoes?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: updates });
        const item = Array.isArray(data) ? data[0] : data;

        let hermesResult = null;
        try { hermesResult = await notificarViaHermes({ ...item, ...updates }, 'reprovado'); }
        catch (he) { console.warn('[pev-importacao] DM falhou:', he.message); }

        return res.status(200).json({ ok: true, data: item, hermes: hermesResult });
      }

      return res.status(400).json({ error: 'action inválida.' });
    }

    // ── PUT/PATCH: atualizar registro ─────────────────────────────────────
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { id, empresa, cnpj, importacao, obs, data_virada, status, motivo_reprovacao } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id obrigatório.' });
      const updates = {};
      if (empresa     !== undefined) updates.empresa     = String(empresa).trim();
      if (cnpj        !== undefined) updates.cnpj        = formatCNPJ(String(cnpj).trim());
      if (importacao  !== undefined) updates.importacao  = importacao === 'sim' ? 'sim' : 'nao';
      if (data_virada !== undefined) updates.data_virada = data_virada ? String(data_virada).trim() : null;
      if (obs         !== undefined) updates.obs         = String(obs).trim();
      if (status      !== undefined) {
        updates.status    = ['aprovado','reprovado','pendente'].includes(status) ? status : 'pendente';
        updates.status_em = new Date().toISOString();
      }
      if (motivo_reprovacao !== undefined) updates.motivo_reprovacao = String(motivo_reprovacao).trim();
      if (req.body?.agendado !== undefined) updates.agendado = req.body.agendado === 'sim' ? 'sim' : 'nao';
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
