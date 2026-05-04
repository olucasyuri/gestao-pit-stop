"use strict";

const HERMES_URL = process.env.HERMES_URL;
const API_SECRET = process.env.API_SECRET;

const ROUTES = {
  "novo-aviso": "/send/novo-aviso",
  "pitstop-pausas": "/send/pitstop-pausas",
  "pitstop-folga": "/send/pitstop-folga",
  "pitstop-aniversario": "/send/pitstop-aniversario",
  "escala-sabado": "/send/escala-sabado",
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  if (!HERMES_URL) {
    return res.status(500).json({ error: "HERMES_URL não configurada no Vercel" });
  }

  const { tipo, ...payload } = req.body ?? {};

  if (tipo === "health-check") {
    try {
      const response = await fetch(`${HERMES_URL}/health`, {
        method: "GET",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return res.status(502).json({
          error: "Hermes health-check falhou",
          details: data,
        });
      }

      return res.status(200).json({ ok: true, ...data });
    } catch (err) {
      return res.status(500).json({
        error: "Não foi possível verificar o Hermes",
        details: err.message,
      });
    }
  }

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