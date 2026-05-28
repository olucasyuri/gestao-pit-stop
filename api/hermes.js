import { getBearer, getUserFromToken } from './_auth.js';
import { rateLimit, clientIp } from './_ratelimit.js';

const SITE_ORIGIN = process.env.PUBLIC_SITE_URL || '';

export default async function handler(req, res) {
  // CORS restrito + preflight
  if (SITE_ORIGIN) res.setHeader('Access-Control-Allow-Origin', SITE_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'api/hermes' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Rate limit
  const rl = rateLimit(`hermes:${clientIp(req)}`, 40, 60_000);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Muitas requisições.' });
  }

  // Exige usuário autenticado (rota chamada pelo painel logado)
  const user = await getUserFromToken(getBearer(req));
  if (!user) return res.status(401).json({ error: 'Sessão necessária.' });

  const HERMES_URL = process.env.HERMES_URL;
  const API_SECRET = process.env.API_SECRET;

  if (!HERMES_URL) {
    return res.status(500).json({ error: 'HERMES_URL ausente na Vercel' });
  }

  const { tipo, ...payload } = req.body || {};

  if (!tipo) {
    return res.status(400).json({ error: 'Informe o campo tipo' });
  }

  const base = HERMES_URL.replace(/\/$/, '');

  try {
    if (tipo === 'health-check') {
      const response = await fetch(`${base}/health`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(response.status).json({ error: 'Hermes unhealthy', details: data });
      }
      return res.status(200).json({ ok: true, hermes: data });
    }

    const response = await fetch(`${base}/api/hermes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_SECRET ? { 'x-api-secret': API_SECRET } : {}),
      },
      body: JSON.stringify({ tipo, ...payload }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error || 'Falha ao chamar Hermes',
        details: data,
      });
    }

    return res.status(200).json({ ok: true, hermes: data });
  } catch (error) {
    console.error('[api/hermes]', error);
    return res.status(502).json({ error: 'Hermes indisponível', details: error.message });
  }
}
