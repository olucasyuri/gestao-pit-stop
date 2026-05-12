// gestao-pitstop.js — exemplo correto do envio de pausas

await sendHermes("pitstop-pausas", {
  destinatarios: colaboradores.map(c => ({
    nome: c.nome,
    discord_id: c.discord_id,
    ...(pausas[c.nome] || {})
  }))
});
