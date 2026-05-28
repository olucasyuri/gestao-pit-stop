/**
 * API Route: /api/pev-importacao  (versão endurecida para produção)
 *
 * MUDANÇAS DE SEGURANÇA vs. versão anterior:
 *   1. Ações internas (aprovar/reprovar/toggle-agendado/PATCH/DELETE) agora
 *      EXIGEM um usuário autenticado (token Supabase) — antes pulavam o secret.
 *   2. Criação vinda do bot Discord (POST create) exige x-api-secret OU
 *      um usuário autenticado (criação manual pelo gestor no site).
 *   3. CORS restrito à origem do site (env PUBLIC_SITE_URL); o bot é
 *      servidor-para-servidor e não depende de CORS.
 *   4. Rate limit por IP.
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
  // ── CORS: somente a origem do site (se configurada) ─────────────────────
  if (SITE_ORIGIN) res.setHeader('Access-Control-Allow-Origin', SITE_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Rate limit por IP ────────────────────────────────────────────────────
  const rl = rateLimit(`pev-import:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' });
  }

  const API_SECRET = process.env.API_SECRET;
  const action = req.body?.action || req.query?.action || '';
  const isInternalAction =
    ['aprovar', 'reprovar', 'toggle-agendado'].includes(action) ||
    req.method === 'DELETE' || req.method === 'PUT' || req.method === 'PATCH';

  // Usuário logado? (token enviado pelo front via wrapper de fetch)
  const user = await getUserFromToken(getBearer(req));
  const secretOk = API_SECRET ? (req.headers['x-api-secret'] === API_SECRET) : false;

  // ── Autorização ──────────────────────────────────────────────────────────
  // Ações internas: SOMENTE usuário autenticado (gestor logado no site).
  if (isInternalAction && !user) {
    return res.status(401).json({ error: 'Sessão necessária. Faça login no painel.' });
  }
  // Criação (bot ou manual): aceita secret do bot OU gestor logado.
  if (!isInternalAction && req.method === 'POST') {
    if (!user && !(API_SECRET && secretOk)) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }
  }
  // GET (listar): exige login.
  if (req.method === 'GET' && !user) {
    return res.status(401).json({ error: 'Sessão necessária.' });
  }

  try {
    // ── GET: listar registros ─────────────────────────────────────────────
    if (req.method === 'GET') {
      const data = await supaReq('pev_importacoes?order=criado_em.desc');
      return res.status(200).json({ ok: true, data });
    }

    // ── POST: criar novo registro (vindo do bot Discord ou manual) ────────
    if (req.method === 'POST') {
      const { empresa, cnpj, importacao, discord_user, discord_nome, discord_id, obs, data_virada } = req.body || {};

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

        const registros = await supaReq(`pev_importacoes?id=eq.${encodeURIComponent(id)}`);
        const registroOriginal = Array.isArray(registros) ? registros[0] : registros;

        const updates = { status: 'aprovado', status_em: new Date().toISOString() };
        const data = await supaReq(`pev_importacoes?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: updates });
        const item = { ...registroOriginal, ...(Array.isArray(data) ? data[0] : data), ...updates };

        let hermesResult = null;
        try { hermesResult = await notificarViaHermes(item, 'aprovado'); }
        catch (he) { console.warn('[pev-importacao] DM falhou:', he.message); }

        return res.status(200).json({ ok: true, data: item, hermes: hermesResult });
      }

      // ── Ação: reprovar ───────────────────────────────────────────────────
      if (action === 'reprovar') {
        const { id, motivo_reprovacao } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id obrigatório.' });

        const registros = await supaReq(`pev_importacoes?id=eq.${encodeURIComponent(id)}`);
        const registroOriginal = Array.isArray(registros) ? registros[0] : registros;

        const updates = {
          status: 'reprovado',
          status_em: new Date().toISOString(),
          motivo_reprovacao: String(motivo_reprovacao || '').trim(),
        };
        const data = await supaReq(`pev_importacoes?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: updates });
        const item = { ...registroOriginal, ...(Array.isArray(data) ? data[0] : data), ...updates };

        let hermesResult = null;
        try { hermesResult = await notificarViaHermes(item, 'reprovado'); }
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
