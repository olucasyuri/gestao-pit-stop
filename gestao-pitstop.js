/* ==========================================================================
   FEEDBACK PRIVADO + NOTIFICAÇÕES
   ========================================================================== */

function popularSelectFeedback() {
  const select = $("feedback-colaborador");

  if (!select) return;

  const ativos = colaboradores
    .filter((c) => c?.nome && c.ativo !== false)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  select.innerHTML = `
    <option value="">Selecione o colaborador</option>
  `;

  ativos.forEach((c) => {
    const option = document.createElement("option");

    option.value = c.nome;
    option.textContent = `${c.nome} — ${c.cargo}`;

    select.appendChild(option);
  });
}

async function insertNotificacao({
  colaborador_nome,
  tipo = "geral",
  titulo,
  mensagem,
  referencia_id = null,
}) {

  if (!supa) return null;

  const payload = {
    colaborador_nome,
    tipo,
    titulo,
    mensagem,
    referencia_id,
    lida: false,
    criado_em: new Date().toISOString(),
  };

  const { data, error } = await supa
    .from("notificacoes")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("[NOTIF]", error);
    throw error;
  }

  return data;
}

async function insertNotificacoesBulk(lista = []) {

  if (!supa || !lista.length) return;

  const payload = lista.map((item) => ({
    colaborador_nome: item.colaborador_nome,
    tipo: item.tipo || "geral",
    titulo: item.titulo,
    mensagem: item.mensagem,
    referencia_id: item.referencia_id || null,
    lida: false,
    criado_em: new Date().toISOString(),
  }));

  const { error } = await supa
    .from("notificacoes")
    .insert(payload);

  if (error) {
    console.error("[NOTIF BULK]", error);
    throw error;
  }
}

async function criarFeedbackPrivado() {

  const colaborador = $("feedback-colaborador")?.value?.trim();
  const titulo = $("feedback-titulo")?.value?.trim();
  const mensagem = $("feedback-mensagem")?.value?.trim();

  if (!colaborador || !titulo || !mensagem) {
    toast("Preencha colaborador, título e mensagem.");
    return;
  }

  try {

    let feedbackId = null;

    if (supa) {

      const { data, error } = await supa
        .from("feedbacks")
        .insert({
          colaborador_nome: colaborador,
          titulo,
          mensagem,
          criado_por: "Gestão PIT STOP",
          criado_em: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;

      feedbackId = data?.id ?? null;

      await insertNotificacao({
        colaborador_nome: colaborador,
        tipo: "feedback",
        titulo: `Novo feedback: ${titulo}`,
        mensagem,
        referencia_id: feedbackId,
      });
    }

    $("feedback-colaborador").value = "";
    $("feedback-titulo").value = "";
    $("feedback-mensagem").value = "";

    toast("Feedback enviado com sucesso.");

  } catch (err) {

    console.error("[FEEDBACK]", err);

    toast(
      "Erro ao enviar feedback: " +
      (err.message || err)
    );
  }
}

window.criarFeedbackPrivado = criarFeedbackPrivado;
window.popularSelectFeedback = popularSelectFeedback;
