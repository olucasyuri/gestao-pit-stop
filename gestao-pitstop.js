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

/** @type {Array<{ id: string; cliente: string; cnpj: string; registro: string; motivo: string; caso_aberto: boolean; numero_caso?: string; criado_em: string }>} */
let pendencias = [];
let feedbacks = [];

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
 * Escapa texto antes de inserir em templates HTML.
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

/**
 * Retorna a data local de hoje em YYYY-MM-DD.
 * @returns {string}
 */
function todayISO() {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = String(hoje.getMonth() + 1).padStart(2, "0");
  const d = String(hoje.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
 * Extrai tipo e período de uma folga/férias.
 * @param {object} folga
 */
function getFolgaInfo(folga) {
  const status = String(folga.status ?? "").toLowerCase();
  const statusFim = status.match(/(?:ferias|férias):(\d{4}-\d{2}-\d{2})/);
  const tipo = folga.tipo === "ferias" || status.includes("ferias") || status.includes("férias")
    ? "ferias"
    : "folga";
  const dataInicio = folga.data_folga ?? folga.data ?? "";
  const dataFim = tipo === "ferias"
    ? (folga.data_fim ?? folga.data_final ?? statusFim?.[1] ?? dataInicio)
    : "";

  return { tipo, dataInicio, dataFim };
}

/**
 * Serializa o tipo no campo status para manter compatibilidade com a tabela atual.
 * @param {"folga" | "ferias"} tipo
 * @param {string} dataFim
 */
function serializeFolgaStatus(tipo, dataFim = "") {
  return tipo === "ferias" ? `ferias:${dataFim}` : "folga";
}

/**
 * Data usada para decidir se uma ausência já deve ir para o arquivo.
 * @param {object} folga
 */
function getFolgaArchiveDate(folga) {
  const info = getFolgaInfo(folga);
  return info.tipo === "ferias" ? (info.dataFim || info.dataInicio) : info.dataInicio;
}

/**
 * @param {object} folga
 * @returns {boolean}
 */
function isFolgaAtualOuFutura(folga) {
  return getFolgaArchiveDate(folga) >= todayISO();
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function compareFolgas(a, b) {
  const dataA = getFolgaInfo(a).dataInicio;
  const dataB = getFolgaInfo(b).dataInicio;
  return dataA.localeCompare(dataB);
}

/**
 * @param {object} folga
 * @returns {string}
 */
function formatFolgaPeriodo(folga) {
  const info = getFolgaInfo(folga);
  if (info.tipo !== "ferias" || !info.dataFim || info.dataFim === info.dataInicio) {
    return formatDate(info.dataInicio);
  }
  return `${formatDate(info.dataInicio)} a ${formatDate(info.dataFim)}`;
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
  localStorage.setItem("pitstop_pendencias", JSON.stringify(pendencias));
}

/** Carrega o estado do localStorage (usa os defaults se vazio). */
function loadLocal() {
  colaboradores =
    JSON.parse(localStorage.getItem("pitstop_colaboradores")) ??
    COLABORADORES_DEFAULT.map((c) => ({ ...c }));

  pausas = JSON.parse(localStorage.getItem("pitstop_pausas")) ?? {};
  folgas = JSON.parse(localStorage.getItem("pitstop_folgas")) ?? [];
  pendencias = JSON.parse(localStorage.getItem("pitstop_pendencias")) ?? [];
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
  renderPendencias();
  renderAniversarios();
  renderDash();

  // IMPORTANTE
  popularSelectFeedback();
}

/** Atualiza os cards de métricas no dashboard. */
function renderMetrics() {
  $("metric-colabs").textContent = colaboradores.length;
  $("metric-tecnicos").textContent = colaboradores.filter((c) => c.cargo === "Técnicos").length;
  $("metric-gestao").textContent = colaboradores.filter((c) => c.cargo === "Gestão Pit Stop").length;
  $("metric-folgas").textContent = folgas.filter(isFolgaAtualOuFutura).length;
}

/** Renderiza a lista de membros da equipe. */
function renderEquipe() {
  const lista = $("equipe-list");
  lista.innerHTML = "";

  if (!colaboradores.length) {
    lista.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><strong>Nenhum colaborador cadastrado</strong><small>Clique em "+ Adicionar" para começar.</small></div>`;
    $("folga-colaborador").innerHTML = "";
    return;
  }

  colaboradores.forEach((colab, i) => {
    const isGestao = colab.cargo === "Gestão Pit Stop";
    const badgeClass = isGestao ? "gestao" : "tecnico";
    const badgeLabel = isGestao ? "Gestão" : "Técnico";
    const row = document.createElement("div");
    row.className = "team-row";
    row.innerHTML = `
      <div class="team-info">
        <div class="avatar">${initials(colab.nome)}</div>
        <div>
          <strong>${colab.nome}</strong>
          <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
            <span class="cargo-badge ${badgeClass}">${badgeLabel}</span>
            ${colab.discord_id ? `<small style="color:var(--muted);font-size:11px;">ID ${colab.discord_id}</small>` : '<small style="color:var(--muted);font-size:11px;">sem Discord</small>'}
          </div>
        </div>
      </div>
      <button class="btn" type="button" onclick="openColab(${i})">Editar</button>
    `;
    lista.appendChild(row);
  });

  $("folga-colaborador").innerHTML = `
    <option value="">Selecionar colaborador...</option>
    ${colaboradores.map((c) => `<option value="${escapeHtml(c.nome)}">${escapeHtml(c.nome)}</option>`).join("")}
  `;
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

/**
 * Determina o turno com base no horário de entrada.
 * @param {string} entrada
 * @returns {"manha" | "tarde"}
 */
function getTurnoPausa(entrada) {
  if (!entrada) return "manha";
  const [hora] = entrada.split(":").map(Number);
  return hora >= 12 ? "tarde" : "manha";
}

/**
 * Monta o card de pausas de um colaborador.
 * @param {object} colab
 * @returns {HTMLElement}
 */
function buildPausaRow(colab) {
  const p = getPausaDefault(colab.nome);
  const isGestao = colab.cargo === "Gestão Pit Stop";
  const nomeArg = JSON.stringify(colab.nome);
  const nomeSeguro = escapeHtml(colab.nome);
  const row = document.createElement("div");
  row.className = "pausa-row";

  const nomeCell = `
    <div class="pausa-nome">
      <div class="avatar" style="width:34px;height:34px;font-size:12px;flex-shrink:0;">${initials(colab.nome)}</div>
      <div>
        <strong>${nomeSeguro}</strong>
        <span class="cargo-badge ${isGestao ? "gestao" : "tecnico"}">${isGestao ? "Gestão" : "Técnico"}</span>
      </div>
    </div>`;

  if (isGestao) {
    row.innerHTML = `
      ${nomeCell}
      <div class="pausa-fields">
        <div class="pausa-field">
          <label>Entrada</label>
          <input type="time" value="${p.entrada || ""}" onchange="setPausa(${nomeArg}, 'entrada', this.value)" />
        </div>
        <div class="pausa-divider">→</div>
        <div class="pausa-field">
          <label>Almoço</label>
          <input type="time" value="${p.pausa_20 || ""}" onchange="setPausa(${nomeArg}, 'pausa_20', this.value)" />
        </div>
        <div class="pausa-pill-almoco">1h12</div>
        <div class="pausa-divider">→</div>
        <div class="pausa-field">
          <label>Saída</label>
          <input type="time" value="${p.saida || ""}" onchange="setPausa(${nomeArg}, 'saida', this.value)" />
        </div>
      </div>`;
  } else {
    row.innerHTML = `
      ${nomeCell}
      <div class="pausa-fields">
        <div class="pausa-field">
          <label>Entrada</label>
          <input type="time" value="${p.entrada || ""}" onchange="setPausa(${nomeArg}, 'entrada', this.value)" />
        </div>
        <div class="pausa-divider">·</div>
        <div class="pausa-field">
          <label>Pausa 10</label>
          <input type="time" value="${p.pausa_10_1 || ""}" onchange="setPausa(${nomeArg}, 'pausa_10_1', this.value)" />
        </div>
        <div class="pausa-divider">·</div>
        <div class="pausa-field">
          <label>Pausa 20</label>
          <input type="time" value="${p.pausa_20 || ""}" onchange="setPausa(${nomeArg}, 'pausa_20', this.value)" />
        </div>
        <div class="pausa-divider">·</div>
        <div class="pausa-field">
          <label>Pausa 10</label>
          <input type="time" value="${p.pausa_10_2 || ""}" onchange="setPausa(${nomeArg}, 'pausa_10_2', this.value)" />
        </div>
        <div class="pausa-divider">→</div>
        <div class="pausa-field">
          <label>Saída</label>
          <input type="time" value="${p.saida || ""}" onchange="setPausa(${nomeArg}, 'saida', this.value)" />
        </div>
      </div>`;
  }

  return row;
}

/** Renderiza a lista de pausas separada por turno. */
function renderPausas() {
  const container = $("pausas-body");
  container.innerHTML = "";

  const grupos = [
    { id: "manha", label: "Turno da manhã", hint: "Entradas antes de 12:00" },
    { id: "tarde", label: "Turno da tarde", hint: "Entradas a partir de 12:00" },
  ];

  grupos.forEach((grupo) => {
    const colabsTurno = colaboradores
      .filter((colab) => getTurnoPausa(getPausaDefault(colab.nome).entrada) === grupo.id)
      .sort((a, b) => {
        const entradaA = getPausaDefault(a.nome).entrada || "99:99";
        const entradaB = getPausaDefault(b.nome).entrada || "99:99";
        return entradaA.localeCompare(entradaB) || a.nome.localeCompare(b.nome);
      });

    const section = document.createElement("section");
    section.className = "pausa-turno";
    section.innerHTML = `
      <div class="pausa-turno-head">
        <div>
          <strong>${grupo.label}</strong>
          <small>${grupo.hint}</small>
        </div>
        <span class="pausa-turno-count">${colabsTurno.length}</span>
      </div>
      <div class="pausa-turno-list"></div>
    `;

    const lista = section.querySelector(".pausa-turno-list");
    if (colabsTurno.length) {
      colabsTurno.forEach((colab) => lista.appendChild(buildPausaRow(colab)));
    } else {
      lista.innerHTML = `<div class="empty-state empty-state-compact"><strong>Nenhum colaborador neste turno</strong></div>`;
    }

    container.appendChild(section);
  });
}

/** Renderiza a lista de folgas cadastradas. */
function renderFolgas() {
  const lista = $("folgas-list");

  const ativas = folgas.filter(isFolgaAtualOuFutura).sort(compareFolgas);
  const folgasAtivas = ativas.filter((f) => getFolgaInfo(f).tipo !== "ferias");
  const feriasAtivas = ativas.filter((f) => getFolgaInfo(f).tipo === "ferias");
  const arquivadas = folgas
    .filter((f) => !isFolgaAtualOuFutura(f))
    .sort((a, b) => getFolgaArchiveDate(b).localeCompare(getFolgaArchiveDate(a)));

  lista.innerHTML = "";
  lista.appendChild(buildFolgaCategory(
    "Folgas futuras",
    "Folgas de hoje ou próximas",
    folgasAtivas,
    "Nenhuma folga futura cadastrada."
  ));
  lista.appendChild(buildFolgaCategory(
    "Férias futuras",
    "Períodos de férias dos colaboradores",
    feriasAtivas,
    "Nenhum período de férias cadastrado."
  ));

  if (arquivadas.length) {
    const arquivo = document.createElement("details");
    arquivo.className = "folga-archive";
    arquivo.innerHTML = `
      <summary>
        <span>Arquivo</span>
        <strong>${arquivadas.length} ${arquivadas.length === 1 ? "registro" : "registros"}</strong>
      </summary>
      <div class="folga-archive-list"></div>
    `;
    const arquivoLista = arquivo.querySelector(".folga-archive-list");
    arquivadas.forEach((f) => arquivoLista.appendChild(buildFolgaItem(f, true)));
    lista.appendChild(arquivo);
  }
}

/**
 * Cria uma categoria visual para folgas ou férias.
 * @param {string} titulo
 * @param {string} subtitulo
 * @param {object[]} items
 * @param {string} emptyText
 * @returns {HTMLElement}
 */
function buildFolgaCategory(titulo, subtitulo, items, emptyText) {
  const section = document.createElement("section");
  section.className = "folga-category";
  section.innerHTML = `
    <div class="folga-category-head">
      <div>
        <strong>${titulo}</strong>
        <small>${subtitulo}</small>
      </div>
      <span class="pausa-turno-count">${items.length}</span>
    </div>
    <div class="folga-category-list"></div>
  `;

  const list = section.querySelector(".folga-category-list");
  if (items.length) {
    items.forEach((f) => list.appendChild(buildFolgaItem(f, false)));
  } else {
    list.innerHTML = `<div class="empty-state empty-state-compact"><strong>${emptyText}</strong></div>`;
  }

  return section;
}

/**
 * Cria o item visual de folga/férias.
 * @param {object} folga
 * @param {boolean} arquivada
 * @returns {HTMLElement}
 */
function buildFolgaItem(folga, arquivada) {
  const info = getFolgaInfo(folga);
  const nome = folga.colaborador_nome ?? folga.colaborador ?? "?";
  const isHoje = getFolgaArchiveDate(folga) === todayISO() || info.dataInicio === todayISO();
  const item = document.createElement("div");
  item.className = `item folga-item${arquivada ? " folga-item-archived" : ""}`;
  item.innerHTML = `
    <div class="team-info">
      <div class="avatar">${initials(nome)}</div>
      <div>
        <strong>${escapeHtml(nome)}</strong>
        <div class="folga-meta">
          <small>${formatFolgaPeriodo(folga)}</small>
          ${folga.motivo ? `<small>· ${escapeHtml(folga.motivo)}</small>` : ""}
        </div>
      </div>
    </div>
    <div class="folga-badges">
      <span class="cargo-badge ${info.tipo === "ferias" ? "ferias" : "tecnico"}">${info.tipo === "ferias" ? "Férias" : "Folga"}</span>
      <span class="cargo-badge ${arquivada ? "arquivada" : isHoje ? "hoje" : "gestao"}">${arquivada ? "Arquivada" : isHoje ? "Hoje" : "Futura"}</span>
    </div>
  `;
  return item;
}

/** Renderiza as pendências de análise. */
function renderPendencias() {
  const lista = $("pendencias-list");
  if (!lista) return;

  if (!pendencias.length) {
    lista.innerHTML = `<div class="empty-state"><div class="empty-icon">✓</div><strong>Nenhuma pendência cadastrada</strong></div>`;
    return;
  }

  lista.innerHTML = pendencias
    .map((p) => `
      <div class="item pendencia-item">
        <div>
          <div class="pendencia-title">
            <strong>${escapeHtml(p.cliente)}</strong>
            <span class="cargo-badge ${p.caso_aberto ? "ferias" : "tecnico"}">${p.caso_aberto ? "Caso " + escapeHtml(p.numero_caso || "aberto") : "Sem caso"}</span>
          </div>
          <div class="pendencia-meta">
            <span>CNPJ ${escapeHtml(p.cnpj)}</span>
            <span>Registro ${escapeHtml(p.registro)}</span>
          </div>
          <p>${escapeHtml(p.motivo)}</p>
        </div>
        <button class="btn btn-small" type="button" onclick="removePendencia('${p.id}')">Concluir</button>
      </div>
    `)
    .join("");
}

/** Renderiza a grid de aniversários ordenada por data. */
function renderAniversarios() {
  const hoje = new Date();
  const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const comAniversario = colaboradores
    .filter((c) => c.aniversario_mes && c.aniversario_dia)
    .map((c) => {
      const prox = proximoAniversario(c.aniversario_mes, c.aniversario_dia);
      const diffMs = prox - hojeZerado;
      const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return { ...c, prox, dias };
    })
    .sort((a, b) => a.dias - b.dias);

  if (!comAniversario.length) {
    $("aniversarios-list").innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🎂</div><strong>Nenhum aniversário cadastrado</strong></div>`;
    return;
  }

  $("aniversarios-list").innerHTML = comAniversario
    .map((c) => {
      const diaStr = String(c.aniversario_dia).padStart(2, "0");
      const mesStr = String(c.aniversario_mes).padStart(2, "0");
      const isGestao = c.cargo === "Gestão Pit Stop";

      let pillClass, pillText;
      if (c.dias === 0) { pillClass = "hoje"; pillText = "🎉 Hoje!"; }
      else if (c.dias <= 7) { pillClass = "breve"; pillText = `Em ${c.dias} dia${c.dias > 1 ? "s" : ""}`; }
      else { pillClass = "normal"; pillText = `${diaStr}/${mesStr}`; }

      return `
        <div class="birthday-card ${c.dias <= 7 ? "destaque" : ""}">
          <div class="bday-avatar">${initials(c.nome)}</div>
          <strong>${c.nome}</strong>
          <small class="cargo-badge ${isGestao ? "gestao" : "tecnico"}" style="width:fit-content;">${isGestao ? "Gestão" : "Técnico"}</small>
          <span class="bday-pill ${pillClass}">${pillText}</span>
        </div>
      `;
    })
    .join("");
}

/** Renderiza os painéis de destaque do dashboard. */
function renderDash() {
  const hoje = new Date();
  const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  // Próximos aniversários
  const proximosAniversarios = colaboradores
    .filter((c) => c.aniversario_mes && c.aniversario_dia)
    .map((c) => {
      const prox = proximoAniversario(c.aniversario_mes, c.aniversario_dia);
      const dias = Math.round((prox - hojeZerado) / (1000 * 60 * 60 * 24));
      return { ...c, prox, dias };
    })
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 5);

  if (proximosAniversarios.length) {
    $("dash-aniversarios").innerHTML = proximosAniversarios
      .map((c) => {
        const isGestao = c.cargo === "Gestão Pit Stop";
        const diaStr = String(c.aniversario_dia).padStart(2, "0");
        const mesStr = String(c.aniversario_mes).padStart(2, "0");
        const isHoje = c.dias === 0;
        const isBreve = c.dias > 0 && c.dias <= 7;

        let countdownText, countdownClass;
        if (isHoje)       { countdownText = "🎉 Hoje!";              countdownClass = "hoje"; }
        else if (isBreve) { countdownText = `Em ${c.dias}d`;         countdownClass = "breve"; }
        else              { countdownText = `${diaStr}/${mesStr}`;   countdownClass = "normal"; }

        return `
          <div class="dash-bday-item ${isHoje ? "dash-bday-item--hoje" : isBreve ? "dash-bday-item--breve" : ""}">
            <div class="dash-bday-avatar ${isGestao ? "dash-bday-avatar--gestao" : ""}">${initials(c.nome)}</div>
            <div class="dash-bday-info">
              <strong>${c.nome}</strong>
              <span class="cargo-badge ${isGestao ? "gestao" : "tecnico"}">${isGestao ? "Gestão" : "Técnico"}</span>
            </div>
            <div class="dash-bday-countdown ${countdownClass}">
              ${countdownText}
            </div>
          </div>`;
      }).join("");
  } else {
    $("dash-aniversarios").innerHTML = `<div class="empty-state"><div class="empty-icon">🎂</div><strong>Sem aniversários próximos</strong></div>`;
  }

  // Próximas pausas com base no horário atual
  const agora = new Date();
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();

  /**
   * Converte "HH:MM" para minutos desde meia-noite.
   * @param {string} hhmm
   * @returns {number}
   */
  function toMin(hhmm) {
    if (!hhmm) return Infinity;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  // Para cada colaborador com pausas, determina qual é a próxima pausa
  const proximasPausas = colaboradores
    .filter((c) => pausas[c.nome]?.entrada)
    .map((c) => {
      const p = getPausaDefault(c.nome);
      const isGestao = c.cargo === "Gestão Pit Stop";

      // Slots de eventos relevantes (pausa_10_1, pausa_20, pausa_10_2, saida)
      const slots = isGestao
        ? [
            { label: "Almoço", time: p.pausa_20 },
            { label: "Saída",  time: p.saida },
          ]
        : [
            { label: "Pausa 10", time: p.pausa_10_1 },
            { label: "Pausa 20", time: p.pausa_20 },
            { label: "Pausa 10", time: p.pausa_10_2 },
            { label: "Saída",    time: p.saida },
          ];

      // Próximo slot ainda não ocorrido
      const proxSlot = slots.find((s) => s.time && toMin(s.time) > agoraMin);

      return {
        c, p, isGestao,
        proxSlot,
        proxMin: proxSlot ? toMin(proxSlot.time) : Infinity,
      };
    })
    // Apenas quem ainda tem algo acontecendo hoje
    .filter((item) => item.proxMin !== Infinity)
    // Ordena pelo próximo evento mais próximo
    .sort((a, b) => a.proxMin - b.proxMin)
    .slice(0, 5);

  if (proximasPausas.length) {
    $("dash-pausas").innerHTML = proximasPausas.map(({ c, p, isGestao, proxSlot }) => {
      // Calcula minutos até a próxima pausa
      const diffMin = toMin(proxSlot.time) - agoraMin;
      const diffText = diffMin <= 0 ? "Agora"
        : diffMin < 60 ? `em ${diffMin}min`
        : `em ${Math.floor(diffMin / 60)}h${diffMin % 60 > 0 ? String(diffMin % 60).padStart(2,"0") : ""}`;

      // Monta os blocos de pausa para técnicos
      const pausaSlots = isGestao
        ? [
            { key: "pausa_20", label: "Almoço", icon: "🍽️", time: p.pausa_20, isNext: proxSlot.time === p.pausa_20 },
            { key: "saida",    label: "Saída",  icon: "🚪", time: p.saida,    isNext: proxSlot.time === p.saida },
          ]
        : [
            { key: "pausa_10_1", label: "1ª Pausa 10", icon: "☕", time: p.pausa_10_1, isNext: proxSlot.time === p.pausa_10_1 },
            { key: "pausa_20",   label: "Pausa 20",    icon: "🍽️", time: p.pausa_20,   isNext: proxSlot.time === p.pausa_20 },
            { key: "pausa_10_2", label: "2ª Pausa 10", icon: "☕", time: p.pausa_10_2, isNext: proxSlot.time === p.pausa_10_2 },
          ];

      const pausaBlocos = pausaSlots.filter(s => s.time).map(s => `
        <div class="dash-pausa-slot ${s.isNext ? "dash-pausa-slot--next" : ""}">
          <span class="dash-pausa-slot-label">${s.icon} ${s.label}</span>
          <span class="dash-pausa-slot-time">${s.time}</span>
        </div>
      `).join("");

      return `
        <div class="dash-pausa-item">
          <div class="dash-pausa-top">
            <div class="team-info" style="flex:0 0 auto;gap:8px;">
              <div class="avatar" style="width:32px;height:32px;font-size:11px;">${initials(c.nome)}</div>
              <div>
                <strong style="font-size:13px;">${c.nome}</strong>
                <div style="display:flex;gap:4px;align-items:center;margin-top:3px;">
                  <span class="time-badge filled" style="font-size:10px;padding:2px 6px;">${p.entrada || "--:--"}</span>
                  <span style="color:var(--muted);font-size:10px;">→</span>
                  <span class="time-badge filled" style="font-size:10px;padding:2px 6px;">${p.saida || "--:--"}</span>
                </div>
              </div>
            </div>
            <div class="dash-pausa-next-badge">
              <span class="dash-pausa-next-label">Próxima</span>
              <span class="dash-pausa-next-time">${proxSlot.time}</span>
              <span class="dash-pausa-next-diff">${diffText}</span>
            </div>
          </div>
          <div class="dash-pausa-slots">${pausaBlocos}</div>
        </div>`;
    }).join("");
  } else {
    // Se não há mais pausas no dia, mostra as que foram cadastradas (já realizadas)
    const comPausa = colaboradores.filter((c) => pausas[c.nome]?.entrada).slice(0, 5);
    if (comPausa.length) {
      $("dash-pausas").innerHTML = `
        <div style="font-size:12px;color:var(--muted);text-align:center;padding:10px 0;margin-bottom:8px;">
          ✅ Todas as pausas de hoje foram concluídas
        </div>` +
        comPausa.map((c) => {
          const p = getPausaDefault(c.nome);
          return `
            <div class="item" style="opacity:0.6;">
              <div class="team-info">
                <div class="avatar">${initials(c.nome)}</div>
                <div>
                  <strong>${c.nome}</strong>
                  <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">
                    <span class="time-badge filled">${p.entrada || "--:--"}</span>
                    <span style="color:var(--muted);font-size:11px;align-self:center;">→</span>
                    <span class="time-badge filled">${p.saida || "--:--"}</span>
                  </div>
                </div>
              </div>
              <span style="font-size:11px;color:var(--muted);">${[p.pausa_10_1, p.pausa_20, p.pausa_10_2].filter(Boolean).join(" · ") || "--:--"}</span>
            </div>`;
        }).join("");
    } else {
      $("dash-pausas").innerHTML = `<div class="empty-state"><div class="empty-icon">☕</div><strong>Nenhuma pausa configurada</strong><small>Use "Gerar automático" na aba Pausas.</small></div>`;
    }
  }
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
  if (campo === "entrada") renderPausas();
  renderDash();
};

/** Gera pausas automáticas para todos os colaboradores com base em horários rotativos. */
function autoPausas() {
  const entradasBase = ["07:00", "08:00", "10:00", "11:40", "12:00", "12:40"];

  colaboradores.forEach((colab, i) => {
    const entrada = pausas[colab.nome]?.entrada || entradasBase[i % entradasBase.length];
    const isGestao = colab.cargo === "Gestão Pit Stop";

    if (isGestao) {
      // Gestão: apenas pausa de almoço de 1h12 (72 min), sem pausas 10/20/10
      pausas[colab.nome] = {
        entrada,
        pausa_10_1: "",
        pausa_20:   addMinutes(entrada, 240),  // almoço começa após 4h
        pausa_10_2: "",
        saida:      addMinutes(entrada, 240 + 72), // volta após 1h12
      };
    } else {
      // Técnicos: pausas 10 + 20 + 10
      pausas[colab.nome] = {
        entrada,
        pausa_10_1: addMinutes(entrada, 120),
        pausa_20:   addMinutes(entrada, 240),
        pausa_10_2: addMinutes(entrada, 360),
        saida:      addMinutes(entrada, 380),
      };
    }
  });

  saveLocal();
  renderPausas();
  toast("Pausas geradas.");
}

/** Salva as pausas no Supabase (se configurado) e no localStorage. */
async function savePausas() {
  try {
    const rows = Object.entries(pausas).map(([nome, p]) => ({
      colaborador_nome: nome,
      entrada:    p.entrada    ?? "",
      pausa_10_1: p.pausa_10_1 ?? "",
      pausa_20:   p.pausa_20   ?? "",
      pausa_10_2: p.pausa_10_2 ?? "",
      saida:      p.saida      ?? "",
    }));

    if (supa) {
      const { data: atuais, error: errAtuais } = await supa.from("pausas").select("*");
      if (errAtuais) throw errAtuais;

      const antes = {};
      (atuais ?? []).forEach((row) => { antes[row.colaborador_nome] = row; });

      const { error } = await supa
        .from("pausas")
        .upsert(rows, { onConflict: "colaborador_nome" });
      if (error) throw error;

      const campos = ["entrada", "pausa_10_1", "pausa_20", "pausa_10_2", "saida"];
      const alteradas = rows.filter((row) => {
        const antiga = antes[row.colaborador_nome] ?? {};
        return campos.some((campo) => String(row[campo] ?? "") !== String(antiga[campo] ?? ""));
      });

      await insertNotificacoesBulk(alteradas.map((row) => ({
        colaborador_nome: row.colaborador_nome,
        tipo: "pausa",
        titulo: "Sua pausa foi atualizada",
        mensagem: pausaResumo(row) || "Confira sua nova jornada no portal.",
      })));
    }

    saveLocal();
    toast("Pausas salvas e colaboradores alterados notificados.");
  } catch (err) {
    console.error(err);
    toast("Erro: " + err.message);
  }
}

/* ==========================================================================
   11. Ações de dados — Folgas
   ========================================================================== */

/** Atualiza campos do modal conforme o tipo de ausência. */
function toggleFolgaTipoFields() {
  const tipo = $("folga-tipo")?.value ?? "folga";
  const isFerias = tipo === "ferias";
  const dataFimField = $("folga-data-fim-field");
  const dataLabel = $("folga-data-label");
  const saveLabel = $("btn-save-folga-label");

  if (dataFimField) dataFimField.hidden = !isFerias;
  if (dataLabel) dataLabel.textContent = isFerias ? "Data de início" : "Data da folga";
  if (saveLabel) saveLabel.textContent = isFerias ? "Salvar férias" : "Salvar folga";
  $("modal-folga-title").textContent = isFerias ? "Cadastrar férias" : "Cadastrar folga";
  if (!isFerias) $("folga-data-fim").value = "";
}

/**
 * Abre o modal de folga/férias no modo criação.
 * @param {"folga" | "ferias"} tipo
 */
function newFolga(tipo = "folga") {
  $("folga-tipo").value = tipo;
  $("folga-data-fim").value = "";
  $("folga-motivo").value = "";
  toggleFolgaTipoFields();
  openModal("modal-folga");
}

/** Cadastra uma nova folga/férias a partir dos campos do modal. */
async function saveFolga() {
  const tipo = $("folga-tipo").value;
  const dataFim = tipo === "ferias" ? $("folga-data-fim").value : "";
  const folga = {
    colaborador_nome: $("folga-colaborador").value,
    data_folga:       $("folga-data").value,
    motivo:           $("folga-motivo").value.trim(),
    status:           serializeFolgaStatus(tipo, dataFim),
  };

  if (!folga.colaborador_nome || !folga.data_folga) {
    toast("Informe colaborador e data.");
    return;
  }

  if (tipo === "ferias" && !dataFim) {
    toast("Informe a data final das férias.");
    return;
  }

  if (dataFim && dataFim < folga.data_folga) {
    toast("A data final não pode ser antes do início.");
    return;
  }

  try {
    let folgaId = null;

    if (supa) {
      const { data, error } = await supa.from("folgas").insert(folga).select("id").single();
      if (error) throw error;
      folgaId = data?.id ?? null;

      const periodo = tipo === "ferias"
        ? `${formatDate(folga.data_folga)} a ${formatDate(dataFim)}`
        : formatDate(folga.data_folga);

      await insertNotificacao({
        colaborador_nome: folga.colaborador_nome,
        tipo,
        titulo: tipo === "ferias" ? "Férias cadastradas" : "Folga cadastrada",
        mensagem: `${tipo === "ferias" ? "Período de férias" : "Data da folga"}: ${periodo}. ${folga.motivo ? "Motivo: " + folga.motivo : ""}`,
        referencia_id: folgaId,
      });
    }

    folgas.push({
      ...folga,
      id: folgaId,
      tipo,
      data_fim: dataFim,
    });

    saveLocal();
    closeModal("modal-folga");
    renderAll();
    toast(tipo === "ferias" ? "Férias cadastradas e colaborador notificado." : "Folga cadastrada e colaborador notificado.");
  } catch (err) {
    console.error(err);
    toast("Erro: " + err.message);
  }
}

/** Salva uma nova pendência de análise. */
function savePendencia() {
  const casoAberto = $("pendencia-caso-aberto").checked;
  const pendencia = {
    id: window.crypto?.randomUUID ? window.crypto.randomUUID() : String(Date.now()),
    cliente: $("pendencia-cliente").value.trim(),
    cnpj: $("pendencia-cnpj").value.trim(),
    registro: $("pendencia-registro").value.trim(),
    motivo: $("pendencia-motivo").value.trim(),
    caso_aberto: casoAberto,
    numero_caso: casoAberto ? $("pendencia-numero-caso").value.trim() : "",
    criado_em: new Date().toISOString(),
  };

  if (!pendencia.cliente || !pendencia.cnpj || !pendencia.registro || !pendencia.motivo) {
    toast("Preencha cliente, CNPJ, registro e motivo.");
    return;
  }

  if (casoAberto && !pendencia.numero_caso) {
    toast("Informe o número do caso.");
    return;
  }

  pendencias.unshift(pendencia);
  saveLocal();
  ["pendencia-cliente", "pendencia-cnpj", "pendencia-registro", "pendencia-motivo", "pendencia-numero-caso"].forEach(
    (id) => ($(id).value = "")
  );
  $("pendencia-caso-aberto").checked = false;
  togglePendenciaCaso();
  renderPendencias();
  toast("Pendência adicionada.");
}

/** Mostra ou oculta o campo de número do caso. */
function togglePendenciaCaso() {
  const aberto = $("pendencia-caso-aberto")?.checked;
  const wrap = $("pendencia-numero-caso-wrap");
  if (!wrap) return;
  wrap.hidden = !aberto;
  if (!aberto) $("pendencia-numero-caso").value = "";
}

/** Remove uma pendência concluída. */
window.removePendencia = (id) => {
  pendencias = pendencias.filter((p) => p.id !== id);
  saveLocal();
  renderPendencias();
  toast("Pendência concluída.");
};

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
  const destinatarios = getDestinatariosAviso();

  if (!destinatarios.length) {
    toast("Nenhum destinatário.");
    return;
  }

  const canal = $("aviso-canal").value;
  const titulo = $("aviso-titulo").value.trim();
  const mensagem = $("aviso-msg").value.trim();

  if (!titulo || !mensagem) {
    toast("Informe título e mensagem.");
    return;
  }

  try {
    let avisoId = null;

    if (supa) {
      const { data, error } = await supa
        .from("avisos")
        .insert({
          canal,
          titulo,
          mensagem,
          criado_por: "Gestão PIT STOP",
          criado_em: new Date().toISOString(),
          lidos_count: 0,
        })
        .select("id")
        .single();

      if (error) throw error;
      avisoId = data?.id ?? null;

      await insertNotificacoesBulk(destinatarios.map((dest) => ({
        colaborador_nome: dest.nome,
        tipo: "aviso",
        titulo: `Novo aviso: ${titulo}`,
        mensagem,
        referencia_id: avisoId,
      })));
    }

    try {
      await sendHermes("novo-aviso", {
        canal,
        titulo,
        mensagem,
        destinatarios,
      });
    } catch (err) {
      console.warn("[Hermes] aviso salvo no portal, mas Discord falhou:", err);
    }

    toast(`Aviso publicado no portal e notificação enviada para ${destinatarios.length} colaborador(es).`);
  } catch (err) {
    console.error(err);
    toast("Erro: " + (err.message ?? err));
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

    if (supa) {
      await loadSupabase();
    }

    saveLocal();

    renderAll();

    setTimeout(() => {
      popularSelectFeedback();
    }, 300);

  } catch (err) {

    console.error(err);

    loadLocal();

    renderAll();

    setTimeout(() => {
      popularSelectFeedback();
    }, 300);

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
$("btn-add-folga").onclick  = () => newFolga("folga");
$("btn-add-ferias").onclick = () => newFolga("ferias");
$("btn-save-folga").onclick = saveFolga;
$("folga-tipo").onchange = toggleFolgaTipoFields;
$("btn-save-pendencia").onclick = savePendencia;
$("pendencia-caso-aberto").onchange = togglePendenciaCaso;
$("btn-auto-pausas").onclick = autoPausas;
$("btn-save-pausas").onclick = savePausas;
$("btn-send-aviso").onclick  = sendAviso;
if ($("btn-send-feedback")) $("btn-send-feedback").onclick = criarFeedbackPrivado;
$("btn-send-pausas").onclick = sendPausas;

toggleFolgaTipoFields();
togglePendenciaCaso();

// Inicia a aplicação
boot();

// Atualiza o painel a cada 60 segundos para manter as próximas pausas atualizadas
setInterval(() => {
  renderMetrics();
  renderDash();
}, 60000);

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
function popularSelectFeedback() {
  const select =
    document.getElementById("feedback-colaborador") ||
    document.getElementById("feedback-destinatario") ||
    document.getElementById("select-feedback-colab");

  if (!select) {
    console.warn("[Feedback] select não encontrado");
    return;
  }

  const ativos = colaboradores
    .filter((c) => c && c.nome && c.ativo !== false)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  if (!ativos.length) {
    select.innerHTML = `
      <option value="">
        Nenhum colaborador encontrado
      </option>
    `;
    return;
  }

  select.innerHTML = `
    <option value="">
      Selecione o colaborador
    </option>
  `;

  ativos.forEach((c) => {
    const option = document.createElement("option");

    option.value = c.nome;

    option.textContent =
      `${c.nome} — ${c.cargo || "Sem cargo"}`;

    select.appendChild(option);
  });

  console.log(
    "[Feedback] colaboradores carregados:",
    ativos.length
  );
}

window.popularSelectFeedback = popularSelectFeedback;