/**
 * /api/hermes.js — Proxy para o serviço Hermes (Discord bot)
 *
 * Recebe requisições do frontend e as repassa para o Hermes,
 * adicionando a autenticação via x-api-secret.
 *
 * Variáveis de ambiente necessárias (Vercel):
 *   - HERMES_URL   : URL base do serviço Hermes
 *   - API_SECRET   : Chave de autenticação do Hermes
 */

"use strict";

const HERMES_URL = process.env.HERMES_URL;
const API_SECRET = process.env.API_SECRET;

/**
 * Mapeamento de tipos de evento para as rotas do Hermes.
 * @type {Record<string, string>}
 */
const ROUTES = {
  "health-check": "/health",
  "novo-aviso":           "/send/novo-aviso",
  "pitstop-pausas":       "/send/pitstop-pausas",
  "pitstop-folga":        "/send/pitstop-folga",
  "pitstop-aniversario":  "/send/pitstop-aniversario",
  "escala-sabado":        "/send/escala-sabado",
};

/**
 * Handler da API route (Vercel Serverless Function).
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 */
module.exports = async function handler(req, res) {
  // Apenas POST é aceito
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Hermes URL deve estar configurada
  if (!HERMES_URL) {
    return res.status(500).json({ error: "HERMES_URL não configurada no Vercel" });
  }

  const { tipo, ...payload } = req.body ?? {};

  // Valida o tipo de evento
  const rota = ROUTES[tipo];
  if (!rota) {
    return res.status(400).json({ error: `Tipo inválido: "${tipo}"` });
  }

  try {
    const hermesResponse = await fetch(`${HERMES_URL}${rota}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": API_SECRET ?? "",
      },
      body: JSON.stringify(payload),
    });

    const data = await hermesResponse.json().catch(() => ({}));

    if (!hermesResponse.ok) {
      return res.status(502).json({
        error: "Hermes retornou erro",
        details: data,
      });
    }

    return res.status(200).json({ ok: true, ...data });
  } catch (err) {
    return res.status(500).json({
      error: "Não foi possível contatar o Hermes",
      details: err.message,
    });
  }
};
