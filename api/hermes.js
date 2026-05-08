export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, service: "api/hermes" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const HERMES_URL = process.env.HERMES_URL;
  const API_SECRET = process.env.API_SECRET;

  if (!HERMES_URL || !API_SECRET) {
    return res.status(500).json({ error: "HERMES_URL/API_SECRET ausentes na Vercel" });
  }

  const { tipo, ...payload } = req.body || {};
  if (!tipo) {
    return res.status(400).json({ error: "Informe o campo tipo" });
  }

  try {
    const response = await fetch(`${HERMES_URL.replace(/\/$/, "")}/send/${tipo}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": API_SECRET,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error || "Falha ao chamar Hermes",
        details: data,
      });
    }

    return res.status(200).json({ ok: true, hermes: data });
  } catch (error) {
    console.error("[api/hermes]", error);
    return res.status(502).json({ error: "Hermes indisponível", details: error.message });
  }
}
