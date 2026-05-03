/**
 * Gestão PIT STOP — Lógica principal
 *
 * Responsabilidades:
 *   - Gerenciar colaboradores, pausas e folgas (local e Supabase)
 *   - Renderizar o painel e as seções
 *   - Disparar avisos e pausas via Hermes
 */

"use strict";

/* ==========================================================================
   1. Configuração e instância do Supabase
   ========================================================================== */

const SUPABASE_URL = "https://ffzzkjkhwylbskfxwmfc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SsEK4XJzo6IUveI6ew1J8w_OJfxxRFk";

/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
const supa =
  SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

/* ==========================================================================
   2. Dados padrão de colaboradores
   ========================================================================== */

const COLABORADORES_DEFAULT = [
  { nome: "Amanda",        cargo: "Técnicos",          discord_id: "1142444965092405278", aniversario_mes: 12,   aniversario_dia: 19,   ativo: true },
  { nome: "Caue",          cargo: "Técnicos",          discord_id: "670371895463378944",  aniversario_mes: 6,    aniversario_dia: 15,   ativo: true },
  { nome: "Diniz",         cargo: "Técnicos",          discord_id: "432541657238601744",  aniversario_mes: 8,    aniversario_dia: 1,    ativo: true },
  { nome: "Fabio",         cargo: "Técnicos",          discord_id: "1336014660855533579", aniversario_mes: 2,    aniversario_dia: 4,    ativo: true },
  { nome: "Fabricia",      cargo: "Técnicos",          discord_id: "890702151138021406",  aniversario_mes: 2,    aniversario_dia: 24,   ativo: true },
  { nome: "Francisco",     cargo: "Técnicos",          discord_id: "1070554199009525881", aniversario_mes: 1,    aniversario_dia: 18,   ativo: true },
  { nome: "Graziele",      cargo: "Técnicos",          discord_id: "1168599593118875682", aniversario_mes: 5,    aniversario_dia: 5,    ativo: true },
  { nome: "Guilherme",     cargo: "Técnicos",          discord_id: "1313890897339093122", aniversario_mes: 2,    aniversario_dia: 17,   ativo: true },
  { nome: "Gustavo",       cargo: "Técnicos",          discord_id: "523528133622628352",  aniversario_mes: 2,    aniversario_dia: 19,   ativo: true },
  { nome: "Henrique",      cargo: "Técnicos",          discord_id: "124810672306520064",  aniversario_mes: 4,    aniversario_dia: 17,   ativo: true },
  { nome: "Jonas",         cargo: "Técnicos",          discord_id: "1475609703139643474", aniversario_mes: null, aniversario_dia: null, ativo: true },
  { nome: "Maicon Felipe", cargo: "Técnicos",          discord_id: "1133910691322011738", aniversario_mes: 10,   aniversario_dia: 13,   ativo: true },
  { nome: "Maria Fernanda",cargo: "Técnicos",          discord_id: "1367356773136334867", aniversario_mes: 2,    aniversario_dia: 15,   ativo: true },
  { nome: "Marlisson",     cargo: "Técnicos",          discord_id: "609024223436079126",  aniversario_mes: null, aniversario_dia: null, ativo: true },
  { nome: "Nanda",         cargo: "Técnicos",          discord_id: "692485650095800441",  aniversario_mes: 8,    aniversario_dia: 22,   ativo: true },
  { nome: "Cavalcante",    cargo: "Técnicos",          discord_id: "678613561068486689",  aniversario_mes: 2,    aniversario_dia: 7,    ativo: true },
  { nome: "Ryan",          cargo: "Técnicos",          discord_id: "869769851831476254",  aniversario_mes: null, aniversario_dia: null, ativo: true },
  { nome: "Santos",        cargo: "Técnicos",          discord_id: "1342505957946687559", aniversario_mes: 5,    aniversario_dia: 3,    ativo: true },
  { nome: "Tony",          cargo: "Técnicos",          discord_id: "900053590666780792",  aniversario_mes: 10,   aniversario_dia: 29,   ativo: true },
  { nome: "Ueslei Reis",   cargo: "Técnicos",          discord_id: "433399243877646338",  aniversario_mes: 6,    aniversario_dia: 16,   ativo: true },
  { nome: "Willy",         cargo: "Técnicos",          discord_id: "1079536760876453979", aniversario_mes: 2,    aniversario_dia: 1,    ativo: true },
  { nome: "Fernanda",      cargo: "Gestão Pit Stop",   discord_id: "900716792605995028",  aniversario_mes: 11,   aniversario_dia: 4,    ativo: true },
  { nome: "Ferreira",      cargo: "Gestão Pit Stop",   discord_id: "1228019341472038916", aniversario_mes: 6,    aniversario_dia: 13,   ativo: true },
  { nome: "Jannekeli",     cargo: "Gestão Pit Stop",   discord_id: "997506399640768522",  aniversario_mes: null, aniversario_dia: null, ativo: true },
  { nome: "Zenaide",       cargo: "Gestão Pit Stop",   discord_id: "954327373942243378",  aniversario_mes: 8,    aniversario_dia: 21,   ativo: true },
  { nome: "Yuri",       cargo: "Gestão Pit Stop",   discord_id: "663106315073093662",  aniversario_mes: 9,    aniversario_dia: 7,   ativo: true },
];

/* ==========================================================================
   3. Estado global da aplicação
   ========================================================================== */

/** @type {typeof COLABORADORES_DEFAULT} */
let colaboradores = [];

/** @type {Record<string, { entrada?: string; pausa_10_1?: string; pausa_20?: string; pausa_10_2?: string; saida?: string }>} */
let pausas = {};

/** @type {Array<{ colaborador_nome: string; data_folga: string; motivo?: string; status?: string }>} */
let folgas = [];

/** @type {number | null} Índice do colaborador sendo editado no modal */
let editingColabIndex = null;

/* ==========================================================================
   4. Utilitários
   ========================================================================== */

/**
 * Atalho para document.getElementById.
 * @param {string} id
 * @returns {HTMLElement}
 */
const $ = (id) => document.getElementById(id);

/**
 * Exibe uma mensagem breve de feedback (toast).
 * @param {string} mensagem
 */
function toast(mensagem) {
  const el = $("toast");
  el.textContent = mensagem;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

/**
 * Gera as iniciais de um nome (até 2 letras).
 * @param {string} nome
 * @returns {string}
 */
function initials(nome) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Formata uma data ISO (YYYY-MM-DD) para o padrão BR (DD/MM/YYYY).
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Soma minutos a um horário no formato "HH:MM".
 * @param {string} horario
 * @param {number} minutos
 * @returns {string}
 */
function addMinutes(horario, minutos) {
  if (!horario) return "";
  const [hh, mm] = horario.split(":").map(Number);
  const data = new Date(2000, 0, 1, hh, mm);
  data.setMinutes(data.getMinutes() + minutos);
  return [
    String(data.getHours()).padStart(2, "0"),
    String(data.getMinutes()).padStart(2, "0"),
  ].join(":");
}

/**
 * Calcula a próxima data de aniversário a partir do mês e dia.
 * @param {number} mes
 * @param {number} dia
 * @returns {Date}
 */
function proximoAniversario(mes, dia) {
  const hoje = new Date();
  const candidato = new Date(hoje.getFullYear(), mes - 1, dia);
  const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (candidato < hojeZerado) {
    candidato.setFullYear(candidato.getFullYear() + 1);
  }
  return candidato;
}

/* ==========================================================================
   5. Persistência — localStorage
   ========================================================================== */

/** Salva o estado atual no localStorage. */
function saveLocal() {
  localStorage.setItem("pitstop_colaboradores", JSON.stringify(colaboradores));
  localStorage.setItem("pitstop_pausas", JSON.stringify(pausas));
  localStorage.setItem("pitstop_folgas", JSON.stringify(folgas));
}

/** Carrega o estado do localStorage (usa os defaults se vazio). */
function loadLocal() {
  colaboradores =
    JSON.parse(localStorage.getItem("pitstop_colaboradores")) ??
    COLABORADORES_DEFAULT.map((c) => ({ ...c }));

  pausas = JSON.parse(localStorage.getItem("pitstop_pausas")) ?? {};
  folgas = JSON.parse(localStorage.getItem("pitstop_folgas")) ?? [];
}

/* ==========================================================================
   6. Persistência — Supabase
   ========================================================================== */

/**
 * Carrega os dados do Supabase e atualiza o estado global.
 * @returns {Promise<boolean>} true se carregado com sucesso.
 */
async function loadSupabase() {
  if (!supa) return false;

  const [resColabs, resPausas, resFolgas] = await Promise.all([
    supa.from("colaboradores").select("*").order("nome"),
    supa.from("pausas").select("*"),
    supa.from("folgas").select("*").order("data_folga"),
  ]);

  if (resColabs.error) throw resColabs.error;

  colaboradores = resColabs.data?.length
    ? resColabs.data
    : COLABORADORES_DEFAULT.map((c) => ({ ...c }));

  pausas = {};
  (resPausas.data ?? []).forEach((row) => {
    pausas[row.colaborador_nome] = row;
  });

  folgas = resFolgas.data ?? [];

  return true;
}

/* ==========================================================================
   7. Renderização
   ========================================================================== */

/** Atualiza todos os componentes da interface. */
function renderAll() {
  renderMetrics();
  renderEquipe();
  renderPausas();
  renderFolgas();
  renderAniversarios();
  renderDash();
}

/** Atualiza os cards de métricas no dashboard. */
function renderMetrics() {
  const hoje = new Date().toISOString().slice(0, 10);

  $("metric-colabs").textContent = colaboradores.length;
  $("metric-tecnicos").textContent = colaboradores.filter((c) => c.cargo === "Técnicos").length;
  $("metric-gestao").textContent = colaboradores.filter((c) => c.cargo === "Gestão Pit Stop").length;
  $("metric-folgas").textContent = folgas.filter((f) => (f.data_folga ?? f.data) >= hoje).length;
}

/** Renderiza a lista de membros da equipe. */
function renderEquipe() {
  const lista = $("equipe-list");
  lista.innerHTML = "";

  colaboradores.forEach((colab, i) => {
    const row = document.createElement("div");
    row.className = "team-row";
    row.innerHTML = `
      <div class="team-info">
        <div class="avatar">${initials(colab.nome)}</div>
        <div>
          <strong>${colab.nome}</strong><br />
          <small>${colab.cargo} · Discord ID: ${colab.discord_id || "não informado"}</small>
        </div>
      </div>
      <button class="btn" type="button" onclick="openColab(${i})">Editar</button>
    `;
    lista.appendChild(row);
  });

  // Popula o select de colaboradores no modal de folga
  $("folga-colaborador").innerHTML = colaboradores
    .map((c) => `<option value="${c.nome}">${c.nome}</option>`)
    .join("");
}

/**
 * Retorna os dados de pausa de um colaborador ou um objeto vazio padrão.
 * @param {string} nome
 */
function getPausaDefault(nome) {
  return pausas[nome] ?? {
    entrada: "",
    pausa_10_1: "",
    pausa_20: "",
    pausa_10_2: "",
    saida: "",
  };
}

/** Renderiza a tabela de pausas. */
function renderPausas() {
  const tbody = $("pausas-body");
  tbody.innerHTML = "";

  colaboradores.forEach((colab) => {
    const p = getPausaDefault(colab.nome);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong>${colab.nome}</strong><br />
        <small>${colab.cargo}</small>
      </td>
      <td><input type="time" value="${p.entrada || ""}" onchange="setPausa('${colab.nome}', 'entrada', this.value)" /></td>
      <td><input type="time" value="${p.pausa_10_1 || ""}" onchange="setPausa('${colab.nome}', 'pausa_10_1', this.value)" /></td>
      <td><input type="time" value="${p.pausa_20 || ""}" onchange="setPausa('${colab.nome}', 'pausa_20', this.value)" /></td>
      <td><input type="time" value="${p.pausa_10_2 || ""}" onchange="setPausa('${colab.nome}', 'pausa_10_2', this.value)" /></td>
      <td><input type="time" value="${p.saida || ""}" onchange="setPausa('${colab.nome}', 'saida', this.value)" /></td>
    `;
    tbody.appendChild(tr);
  });
}

/** Renderiza a lista de folgas cadastradas. */
function renderFolgas() {
  const lista = $("folgas-list");

  if (!folgas.length) {
    lista.innerHTML = '<div class="item">Nenhuma folga cadastrada ainda.</div>';
    return;
  }

  lista.innerHTML = "";
  folgas.forEach((f) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div>
        <strong>${f.colaborador_nome ?? f.colaborador}</strong><br />
        <small>${formatDate(f.data_folga ?? f.data)} · ${f.motivo ?? ""}</small>
      </div>
      <span>🏖️</span>
    `;
    lista.appendChild(item);
  });
}

/** Renderiza a grid de aniversários ordenada por data. */
function renderAniversarios() {
  const comAniversario = colaboradores
    .filter((c) => c.aniversario_mes && c.aniversario_dia)
    .sort(
      (a, b) =>
        a.aniversario_mes * 100 + a.aniversario_dia -
        (b.aniversario_mes * 100 + b.aniversario_dia)
    );

  $("aniversarios-list").innerHTML = comAniversario
    .map(
      (c) => `
        <div class="birthday-card">
          <strong>
            ${String(c.aniversario_dia).padStart(2, "0")}/${String(c.aniversario_mes).padStart(2, "0")}
            — ${c.nome}
          </strong>
          <small>${c.cargo}</small>
        </div>
      `
    )
    .join("");
}

/** Renderiza os painéis de destaque do dashboard. */
function renderDash() {
  // Próximos aniversários
  const proximosAniversarios = colaboradores
    .filter((c) => c.aniversario_mes && c.aniversario_dia)
    .map((c) => ({ ...c, prox: proximoAniversario(c.aniversario_mes, c.aniversario_dia) }))
    .sort((a, b) => a.prox - b.prox)
    .slice(0, 5);

  $("dash-aniversarios").innerHTML =
    proximosAniversarios
      .map(
        (c) => `
          <div class="item">
            <div>
              <strong>${c.nome}</strong><br />
              <small>${formatDate(c.prox.toISOString().slice(0, 10))}</small>
            </div>
            <span>🎂</span>
          </div>
        `
      )
      .join("") || '<div class="item">Nenhum aniversário.</div>';

  // Primeiras 5 pausas
  $("dash-pausas").innerHTML = colaboradores
    .slice(0, 5)
    .map((c) => {
      const p = getPausaDefault(c.nome);
      return `
        <div class="item">
          <div>
            <strong>${c.nome}</strong><br />
            <small>
              ${p.entrada || "--:--"} → ${p.saida || "--:--"}
              · ${p.pausa_10_1 || "--:--"}, ${p.pausa_20 || "--:--"}, ${p.pausa_10_2 || "--:--"}
            </small>
          </div>
          <span>☕</span>
        </div>
      `;
    })
    .join("");
}

/* ==========================================================================
   8. Modais
   ========================================================================== */

/**
 * Abre um modal pelo ID do overlay.
 * @param {string} id
 */
function openModal(id) {
  $(id).classList.add("open");
}

/**
 * Fecha um modal pelo ID do overlay.
 * @param {string} id
 */
function closeModal(id) {
  $(id).classList.remove("open");
}

/**
 * Abre o modal de colaborador no modo edição.
 * @param {number} index
 */
window.openColab = (index) => {
  editingColabIndex = index;
  const colab = colaboradores[index];

  $("modal-colab-title").textContent = "Editar colaborador";
  $("colab-nome").value = colab.nome ?? "";
  $("colab-cargo").value = colab.cargo ?? "Técnicos";
  $("colab-discord").value = colab.discord_id ?? "";
  $("colab-mes").value = colab.aniversario_mes ?? "";
  $("colab-dia").value = colab.aniversario_dia ?? "";

  openModal("modal-colab");
};

/** Abre o modal de colaborador no modo criação. */
function newColab() {
  editingColabIndex = null;
  $("modal-colab-title").textContent = "Adicionar colaborador";
  ["colab-nome", "colab-discord", "colab-mes", "colab-dia"].forEach(
    (id) => ($(id).value = "")
  );
  openModal("modal-colab");
}

/* ==========================================================================
   9. Ações de dados — Colaboradores
   ========================================================================== */

/** Salva ou atualiza o colaborador a partir dos campos do modal. */
async function saveColab() {
  const colab = {
    nome: $("colab-nome").value.trim(),
    cargo: $("colab-cargo").value,
    discord_id: $("colab-discord").value.trim(),
    aniversario_mes: $("colab-mes").value ? Number($("colab-mes").value) : null,
    aniversario_dia: $("colab-dia").value ? Number($("colab-dia").value) : null,
    ativo: true,
  };

  if (!colab.nome) {
    toast("Informe o nome.");
    return;
  }

  if (editingColabIndex === null) {
    colaboradores.push(colab);
  } else {
    colaboradores[editingColabIndex] = { ...colaboradores[editingColabIndex], ...colab };
  }

  try {
    if (supa) {
      const { error } = await supa
        .from("colaboradores")
        .upsert(colab, { onConflict: "discord_id" });
      if (error) throw error;
    }

    saveLocal();
    closeModal("modal-colab");
    renderAll();
    toast("Colaborador salvo.");
  } catch (err) {
    toast("Erro: " + err.message);
  }
}

/* ==========================================================================
   10. Ações de dados — Pausas
   ========================================================================== */

/**
 * Atualiza um campo de pausa de um colaborador e persiste no localStorage.
 * @param {string} nome
 * @param {string} campo
 * @param {string} valor
 */
window.setPausa = (nome, campo, valor) => {
  if (!pausas[nome]) pausas[nome] = {};
  pausas[nome][campo] = valor;
  saveLocal();
};

/** Gera pausas automáticas para todos os colaboradores com base em horários rotativos. */
function autoPausas() {
  const entradasBase = ["07:00", "08:00", "10:00", "11:40", "12:00", "12:40"];

  colaboradores.forEach((colab, i) => {
    const entrada = pausas[colab.nome]?.entrada || entradasBase[i % entradasBase.length];
    pausas[colab.nome] = {
      entrada,
      pausa_10_1: addMinutes(entrada, 120),
      pausa_20:   addMinutes(entrada, 240),
      pausa_10_2: addMinutes(entrada, 360),
      saida:      addMinutes(entrada, 380),
    };
  });

  saveLocal();
  renderPausas();
  toast("Pausas geradas.");
}

/** Salva as pausas no Supabase (se configurado) e no localStorage. */
async function savePausas() {
  try {
    if (supa) {
      const rows = Object.entries(pausas).map(([nome, p]) => ({
        colaborador_nome: nome,
        entrada:    p.entrada    ?? "",
        pausa_10_1: p.pausa_10_1 ?? "",
        pausa_20:   p.pausa_20   ?? "",
        pausa_10_2: p.pausa_10_2 ?? "",
        saida:      p.saida      ?? "",
      }));

      const { error } = await supa
        .from("pausas")
        .upsert(rows, { onConflict: "colaborador_nome" });
      if (error) throw error;
    }

    saveLocal();
    toast("Pausas salvas.");
  } catch (err) {
    toast("Erro: " + err.message);
  }
}

/* ==========================================================================
   11. Ações de dados — Folgas
   ========================================================================== */

/** Cadastra uma nova folga a partir dos campos do modal. */
async function saveFolga() {
  const folga = {
    colaborador_nome: $("folga-colaborador").value,
    data_folga:       $("folga-data").value,
    motivo:           $("folga-motivo").value.trim(),
    status:           "liberada",
  };

  if (!folga.colaborador_nome || !folga.data_folga) {
    toast("Informe colaborador e data.");
    return;
  }

  try {
    if (supa) {
      const { error } = await supa.from("folgas").insert(folga);
      if (error) throw error;
    }

    folgas.push(folga);
    saveLocal();
    closeModal("modal-folga");
    renderAll();
    toast("Folga cadastrada.");
  } catch (err) {
    toast("Erro: " + err.message);
  }
}

/* ==========================================================================
   12. Integração com Hermes
   ========================================================================== */

/**
 * Envia uma requisição para a API do Hermes (proxy via /api/hermes).
 * @param {string} tipo - Tipo de evento (ex: "novo-aviso").
 * @param {object} payload - Dados adicionais do evento.
 * @returns {Promise<object>}
 */
async function sendHermes(tipo, payload) {
  const response = await fetch("/api/hermes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo, ...payload }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? data.details ?? "Erro ao contatar Hermes");
  }

  return data;
}

/** Dispara aviso privado no Discord para os destinatários selecionados. */
async function sendAviso() {
  const grupoSelecionado =
    document.querySelector("input[name='grupo-aviso']:checked")?.value ?? "todos";

  const destinatarios = colaboradores
    .filter((c) => c.ativo !== false)
    .filter((c) => grupoSelecionado === "todos" || c.cargo === grupoSelecionado)
    .filter((c) => c.discord_id)
    .map((c) => ({ nome: c.nome, discordId: c.discord_id }));

  if (!destinatarios.length) {
    toast("Nenhum destinatário.");
    return;
  }

  try {
    await sendHermes("novo-aviso", {
      canal:         $("aviso-canal").value,
      titulo:        $("aviso-titulo").value.trim(),
      mensagem:      $("aviso-msg").value.trim(),
      destinatarios,
    });
    toast(`Aviso enviado para ${destinatarios.length} colaborador(es).`);
  } catch (err) {
    toast("Erro: " + err.message);
  }
}

/** Envia as pausas do dia via Hermes para o Discord. */
async function sendPausas() {
  try {
    await sendHermes("pitstop-pausas", { pausas, colaboradores });
    toast("Pausas enviadas.");
  } catch (err) {
    toast("Erro: " + err.message);
  }
}

/* ==========================================================================
   13. Inicialização
   ========================================================================== */

/** Inicializa a aplicação: carrega dados e renderiza a interface. */
async function boot() {
  try {
    loadLocal();
    if (supa) await loadSupabase();
    saveLocal();
    renderAll();
  } catch (err) {
    loadLocal();
    renderAll();
    toast("Modo local: " + err.message);
  }
}

/* ==========================================================================
   14. Event listeners
   ========================================================================== */

// Navegação por abas
document.querySelectorAll(".tab").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t === btn);
      t.setAttribute("aria-selected", String(t === btn));
    });
    document.querySelectorAll(".page").forEach((page) => {
      page.classList.toggle("active", page.id === "page-" + btn.dataset.tab);
    });
  };
});

// Fechar modais pelo atributo data-close
document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.onclick = () => closeModal(btn.dataset.close);
});

// Fechar modais ao clicar no overlay
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  };
});

// Botões principais
$("btn-sync").onclick      = boot;
$("btn-add-colab").onclick = newColab;
$("btn-save-colab").onclick = saveColab;
$("btn-add-folga").onclick  = () => openModal("modal-folga");
$("btn-save-folga").onclick = saveFolga;
$("btn-auto-pausas").onclick = autoPausas;
$("btn-save-pausas").onclick = savePausas;
$("btn-send-aviso").onclick  = sendAviso;
$("btn-send-pausas").onclick = sendPausas;

// Inicia a aplicação
boot();
async function atualizarStatusSistema() {
  const titulo = document.getElementById("status-conexao");
  const desc = document.getElementById("status-descricao");
  const hora = document.getElementById("status-time");
  const badge = document.getElementById("status-badge");
  

  let hermesOk = false;
  let bancoOk = false;

  // TESTA HERMES
  try {
    const r = await fetch("/api/hermes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "health-check" })
    });

    hermesOk = r.ok;
  } catch {}

  // TESTA SUPABASE
  try {
    if (supa) {
      const { error } = await supa.from("colaboradores").select("id").limit(1);
      bancoOk = !error;
    } else {
      bancoOk = true;
    }
  } catch {}

  const agora = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });


  const card = document.getElementById("status-card");

  if (hermesOk && bancoOk) {
    titulo.textContent = "Ambiente Operacional";
    desc.textContent = "Todos os serviços ativos.";
    badge.className = "status-badge online";
    badge.textContent = "ONLINE";
    card.className = "status-card";
  }

  else if (hermesOk || bancoOk) {
    titulo.textContent = "Atenção Necessária";
    desc.textContent = "Algumas funções podem oscilar.";
    badge.className = "status-badge warning";
    badge.textContent = "ATENÇÃO";
    card.className = "status-card warning";
  }

  else {
    titulo.textContent = "Serviço Indisponível";
    desc.textContent = "Contate o responsável técnico.";
    badge.className = "status-badge offline";
    badge.textContent = "OFFLINE";
    card.className = "status-card offline";
  }

  hora.textContent = "Última atualização: " + agora;
}
atualizarStatusSistema();
setInterval(atualizarStatusSistema, 60000);