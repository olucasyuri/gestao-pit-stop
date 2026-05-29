/**
 * Gestão PIT STOP — Lógica principal
 *
 * Responsabilidades:
 *   - Gerenciar colaboradores, pausas e folgas (local e Supabase)
 *   - Renderizar o painel e as seções
 *   - Disparar avisos e pausas via Hermes
 *
 * CORREÇÕES APLICADAS:
 *   [FIX 1] SUPABASE_ANON_KEY: placeholder substituído — insira sua chave JWT real (começa com "eyJ")
 *   [FIX 2] upsert de colaboradores agora usa "nome" como fallback quando discord_id está vazio
 *   [FIX 3] insertNotificacao agora tem try/catch individual com toast de feedback em cada chamador
 *   [FIX 4] loadSupabase trata erro de order("data_folga") e faz fallback para localStorage
 *   [FIX 5] savePausas não notifica colaboradores recém-cadastrados (apenas alterações reais)
 */

"use strict";

/* ==========================================================================
   1. Configuração e instância do Supabase
   ========================================================================== */

const SUPABASE_URL = "https://ffzzkjkhwylbskfxwmfc.supabase.co";

// [FIX 1] A chave ANON deve ser um JWT válido — copie de:
// Supabase Dashboard → Settings → API → "anon public"
// Ela SEMPRE começa com "eyJ..."
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmenpramtod3lsYnNrZnh3bWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MjYxMTQsImV4cCI6MjA5MzQwMjExNH0._J7yVV2_0IQbz5quIt-nIrH5-Wej9tVCDIed3DKxBhE"; // ex: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
const supa =
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== "COLE_SUA_CHAVE_ANON_AQUI" && window.supabase
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
  { nome: "Yuri",          cargo: "Gestão Pit Stop",   discord_id: "663106315073093662",  aniversario_mes: 9,    aniversario_dia: 7,    ativo: true },
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

/**
 * Flags de status por colaborador.
 * Exemplo: { "Diniz": { off: false, ferias: false, atestado: false, saida_ant: false, atraso: false, atraso_min: 0, rodizio: false, chat: false } }
 * @type {Record<string, object>}
 */
let flags = {};

/**
 * Escala de sábado — lista de entradas temporárias.
 * @type {Array<{ nome: string; entrada: string; pausa_10_1: string; pausa_20: string; pausa_10_2: string; saida: string }>}
 */
let escala_sabado = [];

/** 
 * Estado de atestados por colaborador: { nome: { dias: number, dataInicio: string } }
 * @type {Record<string, {dias: number, dataInicio: string}>}
 */
let atestados = {};

/**
 * Horários de chegada real (para atraso): { nome: string horario "HH:MM" }
 * @type {Record<string, string>}
 */
let horariosChegada = {};

/**
 * Status de confirmação das pausas do dia por colaborador.
 * Valores: "pendente" | "confirmada" | "atrasada" | "ausente"
 * @type {Record<string, { pausa_10_1: string, pausa_20: string, pausa_10_2: string, obs: string }>}
 */
let pausaStatusHoje = {};

/**
 * Estado de ordenação das pausas.
 * @type {{ campo: "status" | "horario" | "nome", direcao: "asc" | "desc" }}
 */
let pausasOrdenacao = { campo: "horario", direcao: "asc" };

/**
 * Se true, oculta colaboradores ausentes (OFF/férias/atestado) da lista de pausas.
 * @type {boolean}
 */
let pausasOcultarAusentes = false;

/**
 * Filtro de colaborador específico na tela de pausas (nome ou "").
 * @type {string}
 */
let pausasFiltroColab = "";


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

/**
 * Verifica se um colaborador está em atestado válido hoje.
 * @param {string} nome
 * @returns {boolean}
 */
function isAtestadoAtivo(nome) {
  const at = atestados[nome];
  if (!at) return false;
  const hoje = todayISO();
  const dataInicio = new Date(at.dataInicio + 'T12:00:00');
  const dataFim = new Date(dataInicio);
  dataFim.setDate(dataFim.getDate() + at.dias);
  const dataFimISO = dataFim.toISOString().split('T')[0];
  return hoje <= dataFimISO;
}

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
  localStorage.setItem("pitstop_flags", JSON.stringify(flags));
  localStorage.setItem("pitstop_escala_sabado", JSON.stringify(escala_sabado));
  localStorage.setItem("pitstop_atestados", JSON.stringify(atestados));
  localStorage.setItem("pitstop_horariosChegada", JSON.stringify(horariosChegada));
}

/** Carrega o estado do localStorage (usa os defaults se vazio). */
function loadLocal() {
  colaboradores =
    JSON.parse(localStorage.getItem("pitstop_colaboradores")) ??
    COLABORADORES_DEFAULT.map((c) => ({ ...c }));

  pausas = JSON.parse(localStorage.getItem("pitstop_pausas")) ?? {};
  folgas = JSON.parse(localStorage.getItem("pitstop_folgas")) ?? [];
  pendencias = JSON.parse(localStorage.getItem("pitstop_pendencias")) ?? [];
  flags = JSON.parse(localStorage.getItem("pitstop_flags")) ?? {};
  escala_sabado = JSON.parse(localStorage.getItem("pitstop_escala_sabado")) ?? [];
  atestados = JSON.parse(localStorage.getItem("pitstop_atestados")) ?? {};
  horariosChegada = JSON.parse(localStorage.getItem("pitstop_horariosChegada")) ?? {};
}

/* ==========================================================================
   6. Persistência — Supabase
   ========================================================================== */

/**
 * Carrega os dados do Supabase e atualiza o estado global.
 * Inclui: colaboradores, pausas, folgas, flags, atestados, escala_sabado, horariosChegada.
 * @returns {Promise<boolean>} true se carregado com sucesso.
 */
async function loadSupabase() {
  if (!supa) return false;

  // Executa todas as queries em paralelo
  const [resColabs, resPausas, resFolgas, resFlags, resAtestados, resSabado, resPendencias] = await Promise.all([
    supa.from("colaboradores").select("*").order("nome"),
    supa.from("pausas").select("*"),
    supa.from("folgas").select("*").order("data_folga", { ascending: true }),
    supa.from("pitstop_flags").select("*"),
    supa.from("pitstop_atestados").select("*"),
    supa.from("pitstop_escala_sabado").select("*").order("nome"),
    supa.from("pitstop_pendencias").select("*").order("criado_em", { ascending: false }),
  ]);

  // Colaboradores — erro crítico, propaga para o boot()
  if (resColabs.error) throw resColabs.error;

  colaboradores = resColabs.data?.length
    ? resColabs.data
    : COLABORADORES_DEFAULT.map((c) => ({ ...c }));

  // Pausas — erro não-crítico
  if (resPausas.error) {
    console.warn("[Supabase] Erro ao carregar pausas:", resPausas.error);
  } else {
    pausas = {};
    (resPausas.data ?? []).forEach((row) => {
      pausas[row.colaborador_nome] = row;
    });
  }

  // Folgas — erro não-crítico, fallback para localStorage
  if (resFolgas.error) {
    console.warn("[Supabase] Erro ao carregar folgas:", resFolgas.error);
    folgas = JSON.parse(localStorage.getItem("pitstop_folgas")) ?? [];
  } else {
    folgas = resFolgas.data ?? [];
  }

  // Flags (OFF, férias, atestado, atraso, etc.) — erro não-crítico
  if (resFlags.error) {
    console.warn("[Supabase] Tabela pitstop_flags não encontrada — usando localStorage. Execute o SQL de criação.", resFlags.error);
    flags = JSON.parse(localStorage.getItem("pitstop_flags")) ?? {};
  } else {
    flags = {};
    (resFlags.data ?? []).forEach((row) => {
      flags[row.colaborador_nome] = {
        ferias:    !!row.ferias,
        atestado:  !!row.atestado,
        off:       !!row.off,
        saida_ant: !!row.saida_ant,
        atraso:    !!row.atraso,
        atraso_min: row.atraso_min ?? 60,
        rodizio:   !!row.rodizio,
        chat:      !!row.chat,
      };
    });
  }

  // Atestados — erro não-crítico
  if (resAtestados.error) {
    console.warn("[Supabase] Tabela pitstop_atestados não encontrada — usando localStorage. Execute o SQL de criação.", resAtestados.error);
    atestados = JSON.parse(localStorage.getItem("pitstop_atestados")) ?? {};
  } else {
    atestados = {};
    (resAtestados.data ?? []).forEach((row) => {
      atestados[row.colaborador_nome] = { dias: row.dias, dataInicio: row.data_inicio };
    });
    horariosChegada = {};
    (resAtestados.data ?? []).forEach((row) => {
      if (row.horario_chegada) horariosChegada[row.colaborador_nome] = row.horario_chegada;
    });
  }

  // Escala de sábado — erro não-crítico
  if (resSabado.error) {
    console.warn("[Supabase] Tabela pitstop_escala_sabado não encontrada — usando localStorage. Execute o SQL de criação.", resSabado.error);
    escala_sabado = JSON.parse(localStorage.getItem("pitstop_escala_sabado")) ?? [];
  } else {
    escala_sabado = (resSabado.data ?? []).map(row => ({
      nome:       row.nome,
      entrada:    row.entrada    ?? "",
      pausa_10_1: row.pausa_10_1 ?? "",
      pausa_20:   row.pausa_20   ?? "",
      pausa_10_2: row.pausa_10_2 ?? "",
      saida:      row.saida      ?? "",
    }));
  }

  // Pendências — erro não-crítico, fallback para localStorage
  if (resPendencias.error) {
    console.warn("[Supabase] Tabela pitstop_pendencias não encontrada — usando localStorage. Execute o SQL de criação.", resPendencias.error);
    pendencias = JSON.parse(localStorage.getItem("pitstop_pendencias")) ?? [];
  } else {
    const todasPend = resPendencias.data ?? [];
    // Abertas (status diferente de 'concluida') vao para o array principal;
    // concluidas ficam num array separado para a coluna "Concluidas".
    pendencias = todasPend.filter(p => p.status !== 'concluida');
    window.pendenciasConcluidas = todasPend
      .filter(p => p.status === 'concluida')
      .sort((a, b) => new Date(b.concluida_em || b.criado_em || 0) - new Date(a.concluida_em || a.criado_em || 0));
  }

  // Status de pausas do dia — erro não-crítico
  try {
    const { data: dataPausaStatus, error: errPausaStatus } = await supa
      .from("pitstop_pausa_status")
      .select("*")
      .eq("data", todayISO());
    if (errPausaStatus) {
      console.warn("[Supabase] Tabela pitstop_pausa_status não encontrada — execute o SQL de criação.", errPausaStatus);
    } else {
      pausaStatusHoje = {};
      (dataPausaStatus ?? []).forEach(row => {
        pausaStatusHoje[row.colaborador_nome] = {
          pausa_10_1: row.pausa_10_1 ?? "pendente",
          pausa_20:   row.pausa_20   ?? "pendente",
          pausa_10_2: row.pausa_10_2 ?? "pendente",
          obs:        row.obs        ?? "",
        };
      });
    }
  } catch (err) {
    console.warn("[Supabase] Erro ao carregar pitstop_pausa_status:", err);
  }

  return true;
}

/* --------------------------------------------------------------------------
   Funções de persistência no Supabase para cada entidade mutável
   -------------------------------------------------------------------------- */

/**
 * Persiste as flags de um colaborador no Supabase.
 * Usa upsert com onConflict: "colaborador_nome".
 * @param {string} nome
 */
async function saveFlag(nome) {
  if (!supa) return;
  const f = getFlagDefault(nome);
  try {
    const { error } = await supa.from("pitstop_flags").upsert({
      colaborador_nome: nome,
      ferias:    f.ferias    ?? false,
      atestado:  f.atestado  ?? false,
      off:       f.off       ?? false,
      saida_ant: f.saida_ant ?? false,
      atraso:    f.atraso    ?? false,
      atraso_min: f.atraso_min ?? 60,
      rodizio:   f.rodizio   ?? false,
      chat:      f.chat      ?? false,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: "colaborador_nome" });
    if (error) console.warn("[saveFlag]", error);
  } catch (err) {
    console.warn("[saveFlag] exception:", err);
  }
}

/**
 * Persiste o atestado de um colaborador no Supabase.
 * @param {string} nome
 */
async function saveAtestado(nome) {
  if (!supa) return;
  const at = atestados[nome];
  try {
    if (!at) {
      // Remove o atestado
      const { error } = await supa.from("pitstop_atestados").delete().eq("colaborador_nome", nome);
      if (error) console.warn("[saveAtestado delete]", error);
    } else {
      const { error } = await supa.from("pitstop_atestados").upsert({
        colaborador_nome: nome,
        dias:            at.dias,
        data_inicio:     at.dataInicio,
        horario_chegada: horariosChegada[nome] ?? null,
        atualizado_em:   new Date().toISOString(),
      }, { onConflict: "colaborador_nome" });
      if (error) console.warn("[saveAtestado upsert]", error);
    }
  } catch (err) {
    console.warn("[saveAtestado] exception:", err);
  }
}

/**
 * Persiste toda a escala de sábado no Supabase.
 * Estratégia: delete all + insert (escala é pequena e temporária).
 */
async function saveEscalaSabadoSupabase() {
  if (!supa) return;
  try {
    // Apaga tudo e reinserere
    const { error: delErr } = await supa.from("pitstop_escala_sabado").delete().neq("nome", "__never__");
    if (delErr) { console.warn("[saveEscalaSabado delete]", delErr); return; }

    if (escala_sabado.length === 0) return;

    const rows = escala_sabado.map(e => ({
      nome:       e.nome,
      entrada:    e.entrada    ?? "",
      pausa_10_1: e.pausa_10_1 ?? "",
      pausa_20:   e.pausa_20   ?? "",
      pausa_10_2: e.pausa_10_2 ?? "",
      saida:      e.saida      ?? "",
      atualizado_em: new Date().toISOString(),
    }));

    const { error: insErr } = await supa.from("pitstop_escala_sabado").insert(rows);
    if (insErr) console.warn("[saveEscalaSabado insert]", insErr);
  } catch (err) {
    console.warn("[saveEscalaSabado] exception:", err);
  }
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
  (window.renderPendencias || renderPendencias)();
  renderAniversarios();
  renderDash();
  renderEscalaSabado();

  // IMPORTANTE
  popularSelectFeedback();
  popularSelectSabado();
}

/** Atualiza os cards de métricas no dashboard. */
function renderMetrics() {
  $("metric-colabs").textContent = colaboradores.length;
  $("metric-tecnicos").textContent = colaboradores.filter((c) => c.cargo === "Técnicos").length;
  $("metric-gestao").textContent = colaboradores.filter((c) => c.cargo === "Gestão Pit Stop").length;
  $("metric-folgas").textContent = folgas.filter(f => isFolgaAtualOuFutura(f) && getFolgaInfo(f).tipo !== "ferias").length;
  $("metric-ferias").textContent = folgas.filter(f => isFolgaAtualOuFutura(f) && getFolgaInfo(f).tipo === "ferias").length;

  // Painel de indicadores gerenciais
  renderIndicadoresGerenciais();
  renderBarraOcupacao();
}

/** Renderiza indicadores gerenciais no dashboard. */
function renderIndicadoresGerenciais() {
  const el = $("painel-indicadores");
  if (!el) return;

  const total = colaboradores.length;
  const ausentes = colaboradores.filter(c => {
    const f = getFlagDefault(c.nome);
    return f.off || f.ferias || f.atestado;
  }).length;
  const ativos = total - ausentes;
  const emAtraso = colaboradores.filter(c => getFlagDefault(c.nome).atraso).length;
  const emChat = colaboradores.filter(c => getFlagDefault(c.nome).chat).length;
  const taxaPresenca = total > 0 ? Math.round((ativos / total) * 100) : 0;

  el.innerHTML = `
    <div class="indicadores-grid">
      <div class="indicador-card ind-green">
        <div class="ind-icon">✅</div>
        <div class="ind-body">
          <strong>${ativos}</strong>
          <span>Presentes</span>
        </div>
      </div>
      <div class="indicador-card ind-red" role="button" tabindex="0" title="Ver ausentes de hoje"
           style="cursor:pointer;"
           onclick="abrirModalAusentes()"
           onkeydown="if(event.key==='Enter'||event.key===' ')abrirModalAusentes()">
        <div class="ind-icon">⛔</div>
        <div class="ind-body">
          <strong>${ausentes}</strong>
          <span>Ausentes</span>
        </div>
        ${ausentes > 0 ? `<div style="font-size:9px;opacity:.7;margin-top:2px;">ver detalhes →</div>` : ''}
      </div>
      <div class="indicador-card ind-yellow">
        <div class="ind-icon">⏰</div>
        <div class="ind-body">
          <strong>${emAtraso}</strong>
          <span>Em atraso</span>
        </div>
      </div>
      <div class="indicador-card ind-blue">
        <div class="ind-icon">💬</div>
        <div class="ind-body">
          <strong>${emChat}</strong>
          <span>Em chat</span>
        </div>
      </div>
      <div class="indicador-card ind-purple" style="grid-column:1/-1;">
        <div class="ind-icon">📊</div>
        <div class="ind-body">
          <strong>${taxaPresenca}%</strong>
          <span>Taxa de presença hoje</span>
        </div>
        <div class="ind-bar-wrap">
          <div class="ind-bar" style="width:${taxaPresenca}%;background:${taxaPresenca >= 80 ? 'var(--green,#4ade80)' : taxaPresenca >= 60 ? 'var(--gold)' : 'var(--red)'};"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Abre um modal com a lista detalhada de colaboradores ausentes no dia.
 * Exibe o motivo (OFF, férias, atestado) e — se atestado — quantos dias restam.
 */
function abrirModalAusentes() {
  const hoje = todayISO();

  const lista = colaboradores
    .map(c => {
      const f   = getFlagDefault(c.nome);
      const at  = atestados[c.nome];
      let motivo = null;
      let detalhe = '';

      if (f.ferias)   { motivo = 'ferias';   detalhe = 'Férias'; }
      if (f.atestado) {
        motivo = 'atestado';
        if (at?.dias && at?.dataInicio) {
          const inicio = new Date(at.dataInicio + 'T12:00:00');
          const fim    = new Date(inicio);
          fim.setDate(fim.getDate() + at.dias);
          const restam = Math.ceil((fim - new Date()) / 86400000);
          detalhe = `Atestado · ${restam > 0 ? restam + 'd restante' + (restam > 1 ? 's' : '') : 'vence hoje'}`;
        } else {
          detalhe = 'Atestado';
        }
      }
      if (f.off)      { motivo = 'off';      detalhe = 'Day off'; }

      return motivo ? { nome: c.nome, cargo: c.cargo, motivo, detalhe } : null;
    })
    .filter(Boolean);

  // Cria ou reutiliza o modal
  let overlay = document.getElementById('modal-ausentes-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-ausentes-overlay';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div id="modal-ausentes" style="
        background:var(--bg-card,#1e1e2e);
        border:1px solid var(--border,#333);
        border-radius:14px;
        width:min(420px,92vw);
        max-height:80vh;
        display:flex;
        flex-direction:column;
        overflow:hidden;
        box-shadow:0 8px 40px rgba(0,0,0,.4);
      ">
        <div style="padding:18px 20px 14px;border-bottom:1px solid var(--border,#333);display:flex;align-items:center;justify-content:space-between;">
          <div>
            <h3 style="margin:0;font-size:15px;font-weight:700;">⛔ Ausentes hoje</h3>
            <p id="modal-ausentes-sub" style="margin:2px 0 0;font-size:12px;opacity:.6;"></p>
          </div>
          <button onclick="document.getElementById('modal-ausentes-overlay').style.display='none'"
            style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-muted,#888);line-height:1;padding:4px;">✕</button>
        </div>
        <div id="modal-ausentes-list" style="overflow-y:auto;padding:14px 16px;flex:1;"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
  }

  const ICON  = { ferias: '🌴', atestado: '🩺', off: '🔴' };
  const COLOR = { ferias: '#34d399', atestado: '#f59e0b', off: '#f87171' };

  const listEl = document.getElementById('modal-ausentes-list');
  const subEl  = document.getElementById('modal-ausentes-sub');

  subEl.textContent = lista.length
    ? `${lista.length} colaborador${lista.length > 1 ? 'es' : ''} fora hoje`
    : 'Nenhum colaborador ausente';

  if (!lista.length) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:32px 0;opacity:.5;">
        <div style="font-size:36px;">✅</div>
        <p style="margin:8px 0 0;font-size:13px;">Equipe completa hoje!</p>
      </div>`;
  } else {
    listEl.innerHTML = lista.map(p => `
      <div style="
        display:flex;align-items:center;gap:12px;
        padding:10px 12px;border-radius:10px;
        background:var(--bg-alt,rgba(255,255,255,.04));
        margin-bottom:8px;
      ">
        <div style="
          width:38px;height:38px;border-radius:50%;
          background:var(--bg-alt2,rgba(255,255,255,.08));
          display:flex;align-items:center;justify-content:center;
          font-size:13px;font-weight:700;flex-shrink:0;
          color:${COLOR[p.motivo]};
          border:2px solid ${COLOR[p.motivo]}33;
        ">${initials(p.nome)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.nome}</div>
          <div style="font-size:11px;opacity:.6;">${p.cargo || ''}</div>
        </div>
        <div style="
          font-size:11px;font-weight:600;
          color:${COLOR[p.motivo]};
          background:${COLOR[p.motivo]}1a;
          border-radius:20px;padding:3px 10px;white-space:nowrap;
        ">${ICON[p.motivo]} ${p.detalhe}</div>
      </div>`).join('');
  }

  overlay.style.display = 'flex';
}

/** Renderiza a barra de ocupação do turno atual. */
function renderBarraOcupacao() {
  const el = $("barra-ocupacao");
  if (!el) return;

  const agora = new Date();
  const horaAtual = agora.getHours() + agora.getMinutes() / 60;

  // Determinar turno atual
  const isManhaAtual = horaAtual < 10;
  const turnoLabel = isManhaAtual ? "Turno da Manhã" : "Turno da Tarde";
  const turnoId = isManhaAtual ? "manha" : "tarde";

  const colabsTurno = colaboradores.filter(c =>
    getTurnoPausa(getPausaDefault(c.nome).entrada) === turnoId
  );

  const total = colabsTurno.length;
  const ativos = colabsTurno.filter(c => {
    const f = getFlagDefault(c.nome);
    return !f.off && !f.ferias && !f.atestado;
  }).length;

  const perc = total > 0 ? Math.round((ativos / total) * 100) : 0;
  const cor = perc >= 75 ? '#4ade80' : perc >= 50 ? 'var(--gold)' : 'var(--red)';

  el.innerHTML = `
    <div class="ocupacao-header">
      <span class="ocupacao-label">⚡ ${turnoLabel}</span>
      <span class="ocupacao-percent" style="color:${cor}">${perc}% ocupado</span>
    </div>
    <div class="ocupacao-bar-track">
      <div class="ocupacao-bar-fill" style="width:${perc}%;background:${cor}"></div>
    </div>
    <div class="ocupacao-sub">${ativos} de ${total} colaboradores disponíveis</div>
  `;
}


/* ==========================================================================
   ESCALA DE SÁBADO
   ========================================================================== */

/** Popula o select de colaboradores no modal de sábado. */
function popularSelectSabado() {
  const sel = $("sabado-colab");
  if (!sel) return;
  sel.innerHTML = `<option value="">Selecionar colaborador...</option>` +
    colaboradores
      .filter(c => c.ativo !== false)
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(c => `<option value="${escapeHtml(c.nome)}">${escapeHtml(c.nome)}</option>`)
      .join("");
}

/** Renderiza a lista de escala de sábado. */
function renderEscalaSabado() {
  const lista = $("sabado-list");
  if (!lista) return;

  if (!escala_sabado.length) {
    lista.innerHTML = `<div class="sabado-vazio">Nenhuma escala de sábado cadastrada. Clique em "+ Adicionar" para começar.</div>`;
    return;
  }

  lista.innerHTML = "";
  escala_sabado.forEach((entry, idx) => {
    const row = document.createElement("div");
    row.className = "sabado-row";
    const nomeSeguro = escapeHtml(entry.nome);
    const isGestao = colaboradores.find(c => c.nome === entry.nome)?.cargo === "Gestão Pit Stop";

    row.innerHTML = `
      <div class="pausa-nome" style="min-width:130px;flex:0 0 130px;">
        <div class="avatar" style="width:30px;height:30px;font-size:11px;flex-shrink:0;">${initials(entry.nome)}</div>
        <div>
          <strong style="font-size:13px;">${nomeSeguro}</strong>
          <span class="cargo-badge ${isGestao ? "gestao" : "tecnico"}" style="margin-top:2px;display:block;">${isGestao ? "Gestão" : "Técnico"}</span>
        </div>
      </div>
      <div class="pausa-fields" style="flex:1;">
        <div class="pausa-field"><label>Entrada</label><input type="time" value="${entry.entrada||""}" onchange="setSabado(${idx},'entrada',this.value)" /></div>
        <div class="pausa-divider">·</div>
        <div class="pausa-field"><label>Pausa 10</label><input type="time" value="${entry.pausa_10_1||""}" onchange="setSabado(${idx},'pausa_10_1',this.value)" /></div>
        <div class="pausa-divider">·</div>
        <div class="pausa-field"><label>Pausa 20</label><input type="time" value="${entry.pausa_20||""}" onchange="setSabado(${idx},'pausa_20',this.value)" /></div>
        <div class="pausa-divider">·</div>
        <div class="pausa-field"><label>Pausa 10</label><input type="time" value="${entry.pausa_10_2||""}" onchange="setSabado(${idx},'pausa_10_2',this.value)" /></div>
        <div class="pausa-divider">→</div>
        <div class="pausa-field"><label>Saída</label><input type="time" value="${entry.saida||""}" onchange="setSabado(${idx},'saida',this.value)" /></div>
      </div>
      <button class="btn-remove" type="button" onclick="removeSabado(${idx})" title="Remover">×</button>
    `;
    lista.appendChild(row);
  });
}

/**
 * Atualiza um campo da escala de sábado.
 * @param {number} idx
 * @param {string} campo
 * @param {string} valor
 */
window.setSabado = (idx, campo, valor) => {
  if (!escala_sabado[idx]) return;
  escala_sabado[idx][campo] = valor;
  saveLocal();
  saveEscalaSabadoSupabase();
};

/**
 * Remove uma entrada da escala de sábado.
 * @param {number} idx
 */
window.removeSabado = (idx) => {
  escala_sabado.splice(idx, 1);
  saveLocal();
  saveEscalaSabadoSupabase();
  renderEscalaSabado();
  toast("Entrada removida da escala de sábado.");
};

/** Abre o modal de adição de escala de sábado. */
function newSabadoEntry() {
  ["sabado-entrada","sabado-pausa10_1","sabado-pausa20","sabado-pausa10_2","sabado-saida"].forEach(id => {
    const el = $(id);
    if (el) el.value = "";
  });
  $("sabado-colab").value = "";
  openModal("modal-sabado");
}

/** Salva uma nova entrada na escala de sábado. */
function saveSabadoEntry() {
  const nome = $("sabado-colab").value;
  if (!nome) {
    toast("Selecione um colaborador.");
    return;
  }
  const entry = {
    nome,
    entrada:    $("sabado-entrada").value,
    pausa_10_1: $("sabado-pausa10_1").value,
    pausa_20:   $("sabado-pausa20").value,
    pausa_10_2: $("sabado-pausa10_2").value,
    saida:      $("sabado-saida").value,
  };
  // Remove entrada anterior do mesmo colaborador se existir
  escala_sabado = escala_sabado.filter(e => e.nome !== nome);
  escala_sabado.push(entry);
  saveLocal();
  saveEscalaSabadoSupabase();
  closeModal("modal-sabado");
  renderEscalaSabado();
  toast(`${nome} adicionado(a) à escala de sábado.`);
}

/** Envia a escala de sábado no Discord via Hermes. */
async function sendEscalaSabado() {
  if (!escala_sabado.length) {
    toast("Nenhuma escala de sábado para enviar.");
    return;
  }
  try {
    const colabsEnvio = escala_sabado.map(e => colaboradores.find(c => c.nome === e.nome)).filter(Boolean);
    const pausasEnvio = {};
    escala_sabado.forEach(e => { pausasEnvio[e.nome] = e; });
    await sendHermes("pitstop-pausas", { pausas: pausasEnvio, colaboradores: colabsEnvio, contexto: "sabado" });
    toast("Escala de sábado enviada no Discord.");
  } catch (err) {
    toast("Erro: " + err.message);
  }
}

/** Limpa toda a escala de sábado. */
function clearEscalaSabado() {
  if (!escala_sabado.length) {
    toast("Escala de sábado já está vazia.");
    return;
  }
  if (!confirm("Limpar toda a escala de sábado?")) return;
  escala_sabado = [];
  saveLocal();
  saveEscalaSabadoSupabase();
  renderEscalaSabado();
  toast("Escala de sábado limpa.");
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
      <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
        <button class="btn" type="button" onclick="openColab(${i})">Editar</button>
        <button class="btn btn-delete-colab" type="button" onclick="confirmarExclusaoColab(${i})" title="Excluir colaborador" style="height:36px;padding:0 12px;background:rgba(251,113,133,0.08);border-color:rgba(251,113,133,0.2);color:var(--red);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
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
 * Entradas a partir de 10:00 são consideradas turno da tarde.
 * @param {string} entrada
 * @returns {"manha" | "tarde"}
 */
function getTurnoPausa(entrada) {
  if (!entrada) return "manha";
  const [hora, min] = entrada.split(":").map(Number);
  const totalMin = hora * 60 + (min || 0);
  return totalMin >= 10 * 60 ? "tarde" : "manha";
}

/**
 * Retorna o objeto de flags de um colaborador (cria se não existir).
 * @param {string} nome
 * @returns {object}
 */
function getFlagDefault(nome) {
  if (!flags[nome]) {
    flags[nome] = { ferias: false, atestado: false, off: false, saida_ant: false, atraso: false, atraso_min: 60, rodizio: false, chat: false };
  }
  return flags[nome];
}

/**
 * Alterna uma flag de status de um colaborador.
 * @param {string} nome
 * @param {string} flag
 */
window.toggleFlag = (nome, flag) => {
  const f = getFlagDefault(nome);

  // Flags que abrem modal ao ATIVAR
  if (flag === 'atestado' && !f.atestado) {
    abrirModalAtestado(nome);
    return;
  }

  if (flag === 'atraso' && !f.atraso) {
    abrirModalAtraso(nome);
    return;
  }

  if (flag === 'off' && !f.off) {
    abrirModalOff(nome);
    return;
  }

  if (flag === 'ferias' && !f.ferias) {
    abrirModalFerias(nome);
    return;
  }

  // Limpeza ao DESATIVAR flags com estado
  if (flag === 'atestado' && f.atestado) {
    delete atestados[nome];
    delete horariosChegada[nome + '_atestado'];
    saveAtestado(nome); // remove do Supabase
    toast(`Atestado de ${nome} removido.`);
  }

  if (flag === 'atraso' && f.atraso) {
    delete horariosChegada[nome];
    saveAtestado(nome); // atualiza horario_chegada no Supabase
    toast(`Atraso de ${nome} removido.`);
  }

  if (flag === 'off' && f.off) {
    toast(`${nome} voltou para a escala.`);
  }

  if (flag === 'ferias' && f.ferias) {
    toast(`Férias de ${nome} removidas.`);
  }

  // Toasts para flags simples
  const toastMsgs = {
    saida_ant: f.saida_ant ? `Saída antecipada de ${nome} removida.` : `Saída antecipada de ${nome} marcada.`,
    rodizio:   f.rodizio   ? `Rodízio de ${nome} desativado.`         : `${nome} marcado(a) em rodízio.`,
    chat:      f.chat      ? `Chat de ${nome} desativado.`             : `${nome} em modo chat.`,
  };
  if (toastMsgs[flag]) toast(toastMsgs[flag]);

  f[flag] = !f[flag];
  saveLocal();
  saveFlag(nome); // persiste no Supabase
  renderPausas();
  renderDash();
  renderOffSugestoes();
  renderAtrasoAlertas();
};

/** Garante que o modal de atraso existe no DOM (cria dinamicamente se necessário). */
function garantirModalAtraso() {
  if (document.getElementById('modal-atraso')) return;
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.id = 'modal-atraso';
  div.setAttribute('role', 'dialog');
  div.setAttribute('aria-modal', 'true');
  div.innerHTML = `
    <div class="modal modal-atraso-inner" style="gap:0;padding:0;overflow:hidden;max-width:460px;">
      <div class="modal-folga-header">
        <div class="modal-folga-icon" style="background:rgba(239,68,68,0.12);color:#f87171;border-color:rgba(239,68,68,0.25);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
          </svg>
        </div>
        <div>
          <h2 style="font-size:18px;margin:0;">Registrar atraso</h2>
          <p style="font-size:12px;color:var(--muted);margin-top:2px;">Colaborador: <strong id="modal-atraso-nome"></strong></p>
        </div>
        <button class="modal-close-btn" type="button" id="btn-close-modal-atraso" aria-label="Fechar" style="position:absolute;right:18px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;">✕</button>
      </div>
      <div style="padding:20px 24px;display:flex;flex-direction:column;gap:16px;">
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);">Horário real de chegada</label>
          <input id="atraso-horario-chegada" type="time" />
          <small id="atraso-entrada-info" style="color:var(--muted);font-size:12px;margin-top:4px;display:block;"></small>
        </div>
        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:10px;padding:10px 14px;font-size:12px;color:#f87171;">
          ⏰ A 1ª pausa será calculada automaticamente como <strong>1 hora após a chegada real</strong> e o Discord será notificado.
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding:16px 24px 20px;border-top:1px solid var(--border);">
        <button class="btn" type="button" id="btn-cancel-modal-atraso">Cancelar</button>
        <button class="btn" id="btn-confirm-atraso" type="button" style="background:rgba(239,68,68,0.14);border-color:rgba(239,68,68,0.35);color:#f87171;">Confirmar atraso</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  // Fechar ao clicar fora
  div.addEventListener('click', (e) => { if (e.target === div) div.classList.remove('open'); });
  document.getElementById('btn-close-modal-atraso').onclick = () => div.classList.remove('open');
  document.getElementById('btn-cancel-modal-atraso').onclick = () => div.classList.remove('open');
}

/** Abre o modal para registrar horário de chegada (atraso). */
function abrirModalAtraso(nome) {
  garantirModalAtraso();
  const p = getPausaDefault(nome);
  const modal = document.getElementById('modal-atraso');
  const nomeEl = document.getElementById('modal-atraso-nome');
  const chegadaInput = document.getElementById('atraso-horario-chegada');
  const entradaInfo = document.getElementById('atraso-entrada-info');

  nomeEl.textContent = nome;
  chegadaInput.value = horariosChegada[nome] || '';
  entradaInfo.textContent = p.entrada ? `Entrada prevista: ${p.entrada}` : 'Entrada prevista não definida';

  document.getElementById('btn-confirm-atraso').onclick = () => {
    const chegada = chegadaInput.value;
    if (!chegada) { toast('Informe o horário de chegada.'); return; }
    horariosChegada[nome] = chegada;
    const f = getFlagDefault(nome);
    f.atraso = true;
    if (p.entrada) {
      const [hh, mm] = chegada.split(':').map(Number);
      const [eh, em] = p.entrada.split(':').map(Number);
      const diffMin = (hh * 60 + mm) - (eh * 60 + em);
      f.atraso_min = Math.max(diffMin, 1);
    }
    saveLocal();
    saveFlag(nome);
    saveAtestado(nome); // salva horario_chegada no Supabase
    modal.classList.remove('open');
    renderPausas();
    renderDash();
    renderAtrasoAlertas();
    enviarAtrasoDiscord(nome, chegada);
    toast(`Atraso de ${nome} registrado. Pausa ajustada automaticamente.`);
  };

  modal.classList.add('open');
}


/* ---- Modal OFF ---- */

/** Garante que o modal de OFF existe no DOM. */
function garantirModalOff() {
  if (document.getElementById('modal-off')) return;
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.id = 'modal-off';
  div.setAttribute('role', 'dialog');
  div.setAttribute('aria-modal', 'true');
  div.innerHTML = `
    <div class="modal modal-atraso-inner" style="gap:0;padding:0;overflow:hidden;max-width:460px;">
      <div class="modal-folga-header">
        <div class="modal-folga-icon" style="background:rgba(148,163,184,0.12);color:#94a3b8;border-color:rgba(148,163,184,0.25);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          </svg>
        </div>
        <div>
          <h2 style="font-size:18px;margin:0;">Marcar como OFF</h2>
          <p style="font-size:12px;color:var(--muted);margin-top:2px;">Colaborador: <strong id="modal-off-nome"></strong></p>
        </div>
        <button class="modal-close-btn" type="button" id="btn-close-modal-off" aria-label="Fechar" style="position:absolute;right:18px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;">✕</button>
      </div>
      <div style="padding:20px 24px;display:flex;flex-direction:column;gap:14px;">
        <div style="background:rgba(148,163,184,0.06);border:1px solid rgba(148,163,184,0.15);border-radius:10px;padding:12px 16px;font-size:13px;color:#94a3b8;line-height:1.5;">
          ⛔ O colaborador <strong id="modal-off-nome2"></strong> será marcado como <strong>OFF</strong> e <strong>não aparecerá na escala de pausas</strong>. Uma sugestão de reorganização será exibida.
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);">Motivo (opcional)</label>
          <input id="off-motivo" type="text" placeholder="Ex: folga, feriado, escala diferente..." />
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding:16px 24px 20px;border-top:1px solid var(--border);">
        <button class="btn" type="button" id="btn-cancel-modal-off">Cancelar</button>
        <button class="btn" id="btn-confirm-off" type="button" style="background:rgba(148,163,184,0.14);border-color:rgba(148,163,184,0.35);color:#94a3b8;">⛔ Confirmar OFF</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  div.addEventListener('click', (e) => { if (e.target === div) div.classList.remove('open'); });
  document.getElementById('btn-close-modal-off').onclick  = () => div.classList.remove('open');
  document.getElementById('btn-cancel-modal-off').onclick = () => div.classList.remove('open');
}

/** Abre o modal de confirmação de OFF. */
function abrirModalOff(nome) {
  garantirModalOff();
  const modal = document.getElementById('modal-off');
  document.getElementById('modal-off-nome').textContent  = nome;
  document.getElementById('modal-off-nome2').textContent = nome;
  document.getElementById('off-motivo').value = '';

  document.getElementById('btn-confirm-off').onclick = () => {
    const f = getFlagDefault(nome);
    f.off = true;
    saveLocal();
    saveFlag(nome);
    modal.classList.remove('open');
    renderPausas();
    renderDash();
    renderOffSugestoes();
    toast(`${nome} marcado(a) como OFF.`);
  };

  modal.classList.add('open');
}

/* ---- Modal FERIAS (flag) ---- */

/** Garante que o modal de Férias flag existe no DOM. */
function garantirModalFeriasFlag() {
  if (document.getElementById('modal-ferias-flag')) return;
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.id = 'modal-ferias-flag';
  div.setAttribute('role', 'dialog');
  div.setAttribute('aria-modal', 'true');
  div.innerHTML = `
    <div class="modal modal-atraso-inner" style="gap:0;padding:0;overflow:hidden;max-width:460px;">
      <div class="modal-folga-header">
        <div class="modal-folga-icon" style="background:rgba(34,197,94,0.12);color:#4ade80;border-color:rgba(34,197,94,0.25);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 8C8 10 5.9 16.17 3.82 19.34a1 1 0 0 0 1.64 1.15C7.2 18.35 9.88 17 16 17c0-4-1-7-1-7s2 0 4 3c0-5-1-9-1-9s1 0 2 2c0-4-5-6-4-6z"/>
          </svg>
        </div>
        <div>
          <h2 style="font-size:18px;margin:0;">Marcar como Férias</h2>
          <p style="font-size:12px;color:var(--muted);margin-top:2px;">Colaborador: <strong id="modal-ferias-flag-nome"></strong></p>
        </div>
        <button class="modal-close-btn" type="button" id="btn-close-modal-ferias-flag" aria-label="Fechar" style="position:absolute;right:18px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;">✕</button>
      </div>
      <div style="padding:20px 24px;display:flex;flex-direction:column;gap:14px;">
        <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:10px;padding:12px 16px;font-size:13px;color:#4ade80;line-height:1.5;">
          🌴 O colaborador <strong id="modal-ferias-flag-nome2"></strong> será marcado como <strong>em Férias</strong> e <strong>não aparecerá na escala de pausas</strong> enquanto a flag estiver ativa.
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);">Período / Observação (opcional)</label>
          <input id="ferias-flag-obs" type="text" placeholder="Ex: até 20/06, férias aprovadas..." />
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding:16px 24px 20px;border-top:1px solid var(--border);">
        <button class="btn" type="button" id="btn-cancel-modal-ferias-flag">Cancelar</button>
        <button class="btn" id="btn-confirm-ferias-flag" type="button" style="background:rgba(34,197,94,0.14);border-color:rgba(34,197,94,0.35);color:#4ade80;">🌴 Confirmar Férias</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  div.addEventListener('click', (e) => { if (e.target === div) div.classList.remove('open'); });
  document.getElementById('btn-close-modal-ferias-flag').onclick  = () => div.classList.remove('open');
  document.getElementById('btn-cancel-modal-ferias-flag').onclick = () => div.classList.remove('open');
}

/** Abre o modal de confirmação de Férias (flag). */
function abrirModalFerias(nome) {
  garantirModalFeriasFlag();
  const modal = document.getElementById('modal-ferias-flag');
  document.getElementById('modal-ferias-flag-nome').textContent  = nome;
  document.getElementById('modal-ferias-flag-nome2').textContent = nome;
  document.getElementById('ferias-flag-obs').value = '';

  document.getElementById('btn-confirm-ferias-flag').onclick = () => {
    const f = getFlagDefault(nome);
    f.ferias = true;
    saveLocal();
    saveFlag(nome);
    modal.classList.remove('open');
    renderPausas();
    renderDash();
    toast(`🌴 ${nome} marcado(a) como em Férias.`);
  };

  modal.classList.add('open');
}

/** Envia aviso de atraso para o Discord do colaborador. */
async function enviarAtrasoDiscord(nome, horarioChegada) {
  const colab = colaboradores.find(c => c.nome === nome);
  if (!colab || !colab.discord_id) return;
  const p = getPausaDefault(nome);
  // Pausa deve ser 1h após chegada real
  const [hh, mm] = horarioChegada.split(':').map(Number);
  const pausaMin = hh * 60 + mm + 60;
  const pausaH = String(Math.floor(pausaMin / 60)).padStart(2, '0');
  const pausaM = String(pausaMin % 60).padStart(2, '0');
  const pausaHorario = `${pausaH}:${pausaM}`;
  try {
    await sendHermes('pitstop-pausas', {
      pausas: { [nome]: { ...p, pausa_10_1: pausaHorario, _atraso: true, _chegada: horarioChegada } },
      colaboradores: [colab],
      contexto: 'atraso'
    });
  } catch (err) {
    console.warn('[enviarAtrasoDiscord]', err);
  }
}

/** Garante que o modal de atestado existe no DOM (cria dinamicamente se necessário). */
function garantirModalAtestado() {
  if (document.getElementById('modal-atestado')) return;
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.id = 'modal-atestado';
  div.setAttribute('role', 'dialog');
  div.setAttribute('aria-modal', 'true');
  div.innerHTML = `
    <div class="modal modal-atestado-inner" style="gap:0;padding:0;overflow:hidden;max-width:460px;">
      <div class="modal-folga-header">
        <div class="modal-folga-icon" style="background:rgba(251,113,133,0.12);color:var(--red);border-color:rgba(251,113,133,0.25);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M12 14v4M10 16h4"/>
          </svg>
        </div>
        <div>
          <h2 style="font-size:18px;margin:0;">Registrar atestado</h2>
          <p style="font-size:12px;color:var(--muted);margin-top:2px;">Colaborador: <strong id="modal-atestado-nome"></strong></p>
        </div>
        <button type="button" id="btn-close-modal-atestado" aria-label="Fechar" style="position:absolute;right:18px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;">✕</button>
      </div>
      <div style="padding:20px 24px;display:flex;flex-direction:column;gap:16px;">
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);">Quantos dias de atestado?</label>
          <input id="atestado-dias" type="number" min="1" max="365" placeholder="Ex: 3" />
        </div>
        <div style="background:rgba(251,113,133,0.06);border:1px solid rgba(251,113,133,0.15);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--red);">
          🏥 O colaborador <strong>não aparecerá nas próximas pausas</strong> e voltará automaticamente após o período informado.
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding:16px 24px 20px;border-top:1px solid var(--border);">
        <button class="btn" type="button" id="btn-cancel-modal-atestado">Cancelar</button>
        <button class="btn" id="btn-confirm-atestado" type="button" style="background:rgba(251,113,133,0.14);border-color:rgba(251,113,133,0.35);color:var(--red);">Confirmar atestado</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  div.addEventListener('click', (e) => { if (e.target === div) div.classList.remove('open'); });
  document.getElementById('btn-close-modal-atestado').onclick = () => div.classList.remove('open');
  document.getElementById('btn-cancel-modal-atestado').onclick = () => div.classList.remove('open');
}

/** Abre o modal para registrar dias de atestado. */
function abrirModalAtestado(nome) {
  garantirModalAtestado();
  const modal = document.getElementById('modal-atestado');
  const nomeEl = document.getElementById('modal-atestado-nome');
  const diasInput = document.getElementById('atestado-dias');

  nomeEl.textContent = nome;
  diasInput.value = atestados[nome]?.dias || '';

  document.getElementById('btn-confirm-atestado').onclick = () => {
    const dias = parseInt(diasInput.value);
    if (!dias || dias < 1) { toast('Informe a quantidade de dias.'); return; }
    const hoje = new Date();
    const dataInicio = hoje.toISOString().split('T')[0];
    atestados[nome] = { dias, dataInicio };
    const f = getFlagDefault(nome);
    f.atestado = true;
    saveLocal();
    saveFlag(nome);
    saveAtestado(nome);
    modal.classList.remove('open');
    renderPausas();
    renderDash();
    toast(`Atestado de ${nome}: ${dias} dia(s). Voltará automaticamente após ${dias} dia(s).`);
    agendarRetornoAtestado(nome, dias, dataInicio);
  };

  modal.classList.add('open');
}

/** Verifica atestados vencidos e reativa colaboradores. */
function verificarAtestadosVencidos() {
  const hoje = todayISO();
  let mudou = false;
  Object.keys(atestados).forEach(nome => {
    const at = atestados[nome];
    if (!at) return;
    const dataInicio = new Date(at.dataInicio + 'T12:00:00');
    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataFim.getDate() + at.dias);
    const dataFimISO = dataFim.toISOString().split('T')[0];
    if (hoje > dataFimISO) {
      // Atestado vencido — reativar
      const f = getFlagDefault(nome);
      f.atestado = false;
      delete atestados[nome];
      mudou = true;
      saveFlag(nome);
      saveAtestado(nome);
      console.log(`[Atestado] ${nome} retornou automaticamente.`);
    }
  });
  if (mudou) {
    saveLocal();
    renderPausas();
    renderDash();
  }
}

function agendarRetornoAtestado(nome, dias, dataInicio) {
  const dataInicioDate = new Date(dataInicio + 'T12:00:00');
  const dataFim = new Date(dataInicioDate);
  dataFim.setDate(dataFim.getDate() + dias);
  const agora = new Date();
  const msAteRetorno = dataFim - agora;
  if (msAteRetorno > 0 && msAteRetorno < 7 * 24 * 60 * 60 * 1000) {
    // Só agenda se for em menos de 7 dias (para não vazar memória)
    setTimeout(() => {
      verificarAtestadosVencidos();
    }, msAteRetorno + 60000);
  }
}

/**
 * Atualiza os minutos de atraso de um colaborador.
 * @param {string} nome
 * @param {number} min
 */
window.setAtrasoMin = (nome, min) => {
  const f = getFlagDefault(nome);
  f.atraso_min = Number(min) || 60;
  saveLocal();
  renderAtrasoAlertas();
};

/**
 * Envia a pausa de um colaborador via Hermes individualmente.
 * @param {string} nome
 */
window.sendPausaIndividual = async (nome) => {
  const p = getPausaDefault(nome);
  const colab = colaboradores.find(c => c.nome === nome);
  if (!colab || !colab.discord_id) {
    toast("Colaborador sem Discord ID configurado.");
    return;
  }
  // Marcar botão como enviado
  const btn = document.querySelector(`[data-send-nome="${CSS.escape(nome)}"]`);
  if (btn) {
    btn.classList.add("btn-sent");
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Enviado`;
    btn.disabled = true;
    // Reset após 8s
    setTimeout(() => {
      btn.classList.remove("btn-sent");
      btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg> Enviar pausa`;
      btn.disabled = false;
    }, 8000);
  }
  try {
    await sendHermes("pitstop-pausas", { pausas: { [nome]: p }, colaboradores: [colab], individual: true });
    toast(`Pausa de ${nome} enviada no Discord.`);
  } catch (err) {
    if (btn) {
      btn.classList.remove("btn-sent");
      btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg> Enviar pausa`;
      btn.disabled = false;
    }
    toast("Erro: " + err.message);
  }
};

/**
 * Monta o card de pausas de um colaborador.
 * @param {object} colab
 * @returns {HTMLElement}
 */
function buildPausaRow(colab) {
  const nome = colab.nome;
  const p = getPausaDefault(nome);
  const f = getFlagDefault(nome);
  const isGestao = colab.cargo === "Gestão Pit Stop";
  const nomeSeguro = escapeHtml(nome);
  const row = document.createElement("div");
  row.className = isGestao ? "pausa-row pausa-row--gestao" : "pausa-row pausa-row--tecnico";

  // Classes da row de acordo com flags ativas
  if (f.off)  row.classList.add("flag-off");
  if (f.chat) row.classList.add("flag-chat");

  // Chips das flags ativas para exibir no nome
  const chipMap = {
    ferias:    { cls: "chip-ferias",    label: "FÉRIAS" },
    atestado:  { cls: "chip-atestado",  label: "ATESTADO" },
    off:       { cls: "chip-off",       label: "OFF" },
    saida_ant: { cls: "chip-saida-ant", label: "S. ANTECIPADA" },
    atraso:    { cls: "chip-atraso",    label: "ATRASO" },
    rodizio:   { cls: "chip-rodizio",   label: "RODÍZIO" },
    chat:      { cls: "chip-chat",      label: "CHAT" },
  };

  const activeChips = Object.entries(chipMap)
    .filter(([key]) => f[key])
    .map(([, v]) => `<span class="flag-chip ${v.cls}">${v.label}</span>`)
    .join("");

  // Definição dos flags agrupados por categoria visual
  const flagGroups = [
    {
      cat: "AUSÊNCIA",
      flags: [
        { key: "ferias",   label: "🌴 Férias" },
        { key: "atestado", label: "🏥 Atestado" },
        { key: "off",      label: "⛔ OFF" },
      ],
    },
    {
      cat: "TURNO",
      flags: [
        { key: "saida_ant", label: "🚪 S. Antecipada" },
        { key: "atraso",    label: "⏰ Atraso" },
      ],
    },
    {
      cat: "ESCALA",
      flags: [
        { key: "rodizio", label: "🔄 Rodízio" },
        { key: "chat",    label: "💬 Chat" },
      ],
    },
  ];

  // Monta HTML dos botões de flag agrupados por categoria
  const flagBtnsHtml = flagGroups.map((group, gi) => {
    const btns = group.flags.map(({ key, label }) => {
      const activeClass = f[key] ? `flag-on-${key.replace("_", "-")}` : "";
      return `<button type="button" class="flag-btn ${activeClass}" data-flag="${key}">${label}</button>`;
    }).join("");
    const sep = gi < flagGroups.length - 1 ? `<span class="flag-group-sep"></span>` : "";
    return `<span class="flag-cat-label">${group.cat}</span><span class="flag-group">${btns}</span>${sep}`;
  }).join("");

  // Aplicar classe de status de borda lateral ao row
  const statusClasses = ["ferias","atestado","off","atraso","saida_ant","rodizio","chat"];
  for (const s of statusClasses) {
    if (f[s]) {
      row.classList.add(`status-${s.replace("_","-")}`);
      break; // só o mais prioritário
    }
  }

  // Campo de minutos de atraso (só quando atraso ativo)
  const atrasoFieldHtml = f.atraso ? `
    <div class="atraso-field">
      <span>Atraso de</span>
      <input type="number" class="atraso-min-input" min="1" max="480" value="${f.atraso_min || 60}" />
      <span>min</span>
    </div>` : "";

  // Botão envio individual
  const isAusente = f.off || f.ferias || f.atestado;
  const btnOcultarHtml = !isAusente ? `
    <button type="button" class="btn-ocultar-hoje btn-ocultar-js" title="Ocultar da escala hoje (ativar OFF rapidamente)" style="height:20px;padding:0 7px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:9px;font-weight:800;letter-spacing:.04em;cursor:pointer;font-family:var(--font,'DM Sans',sans-serif);transition:all .15s;white-space:nowrap;">
      OCULTAR
    </button>` : `
    <button type="button" class="btn-restaurar-js" title="Restaurar na escala" style="height:20px;padding:0 7px;border-radius:6px;border:1px solid rgba(34,197,94,.3);background:rgba(34,197,94,.08);color:#4ade80;font-size:9px;font-weight:800;letter-spacing:.04em;cursor:pointer;font-family:var(--font,'DM Sans',sans-serif);transition:all .15s;white-space:nowrap;">
      RESTAURAR
    </button>`;

  const btnIndividualHtml = `
    <button type="button" class="btn-send-pausa-individual btn-send-individual-js" data-send-nome="${nomeSeguro}">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
      Enviar pausa
    </button>
    <button type="button" class="btn-msg-rapida-js" title="Mensagem rápida via Discord" style="height:20px;padding:0 7px;border-radius:6px;border:1px solid rgba(88,101,242,0.3);background:rgba(88,101,242,0.08);color:#9ba3ff;font-size:9px;font-weight:800;letter-spacing:.04em;cursor:pointer;font-family:var(--font,'DM Sans',sans-serif);transition:all .15s;white-space:nowrap;">
      💬 MSG
    </button>`;

  const nomeCell = `
    <div class="pausa-nome">
      <div class="pr-avatar pr-avatar--${isGestao ? "gestao" : "tecnico"}">${initials(nome)}</div>
      <div class="pr-nome-info">
        <div class="pr-nome-linha1">
          <span class="pr-nome-texto">${nomeSeguro}</span>
          ${activeChips}
        </div>
        <div class="pr-nome-linha2">
          ${btnIndividualHtml}
          ${btnOcultarHtml}
        </div>
        ${atrasoFieldHtml}
      </div>
    </div>`;

  // Campos de horário — SEM onclick inline: usamos data-campo e addEventListener
  let fieldsHtml = "";
  if (isGestao) {
    fieldsHtml = `
      <div class="pausa-fields">
        <div class="pausa-field"><label>Entrada</label>
          <input type="time" class="pausa-time-input" data-campo="entrada" value="${p.entrada || ""}" /></div>
        <div class="pausa-divider">→</div>
        <div class="pausa-field"><label>Almoço</label>
          <input type="time" class="pausa-time-input" data-campo="pausa_20" value="${p.pausa_20 || ""}" /></div>
        <div class="pausa-pill-almoco">1h12</div>
        <div class="pausa-divider">→</div>
        <div class="pausa-field"><label>Saída</label>
          <input type="time" class="pausa-time-input" data-campo="saida" value="${p.saida || ""}" /></div>
      </div>`;
  } else {
    fieldsHtml = `
      <div class="pausa-fields">
        <div class="pausa-field"><label>Entrada</label>
          <input type="time" class="pausa-time-input" data-campo="entrada" value="${p.entrada || ""}" /></div>
        <div class="pausa-divider">·</div>
        <div class="pausa-field"><label>Pausa 10</label>
          <input type="time" class="pausa-time-input" data-campo="pausa_10_1" value="${p.pausa_10_1 || ""}" /></div>
        <div class="pausa-divider">·</div>
        <div class="pausa-field"><label>Pausa 20</label>
          <input type="time" class="pausa-time-input" data-campo="pausa_20" value="${p.pausa_20 || ""}" /></div>
        <div class="pausa-divider">·</div>
        <div class="pausa-field"><label>Pausa 10</label>
          <input type="time" class="pausa-time-input" data-campo="pausa_10_2" value="${p.pausa_10_2 || ""}" /></div>
        <div class="pausa-divider">→</div>
        <div class="pausa-field"><label>Saída</label>
          <input type="time" class="pausa-time-input" data-campo="saida" value="${p.saida || ""}" /></div>
      </div>`;
  }

  // Flags: gestão sempre visível (poucos campos), técnico com toggle compacto
  const hasActiveFlag = Object.values(f).some(v => v === true);

  const flagsDrawer = isGestao
    ? `<div class="pr-flags pr-flags--gestao">${flagBtnsHtml}</div>`
    : `<div class="pr-flags pr-flags--tecnico${hasActiveFlag ? " pr-flags--has-active" : ""}">
         <button type="button" class="pr-flags-trigger btn-flags-toggle-js" data-flags-trigger>
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
           Status
           ${hasActiveFlag ? '<span class="pr-flags-dot"></span>' : ''}
         </button>
         <div class="pr-flags-panel" data-flags-panel>${flagBtnsHtml}</div>
       </div>`;

  row.innerHTML = `
    <div class="pr-body">
      ${nomeCell}
      <div class="pr-times${f.chat ? " pr-times--hidden" : ""}">
        ${f.chat ? "" : fieldsHtml}
      </div>
      ${flagsDrawer}
    </div>
  `;

  // ── Vincular eventos via addEventListener (sem onclick inline, sem problema de aspas) ──

  // Botões de flag
  row.querySelectorAll(".flag-btn[data-flag]").forEach(btn => {
    btn.addEventListener("click", () => toggleFlag(nome, btn.dataset.flag));
  });

  // Inputs de horário
  row.querySelectorAll(".pausa-time-input").forEach(input => {
    input.addEventListener("change", () => setPausa(nome, input.dataset.campo, input.value));
  });

  // Input de minutos de atraso
  const atrasoInput = row.querySelector(".atraso-min-input");
  if (atrasoInput) {
    atrasoInput.addEventListener("change", () => setAtrasoMin(nome, atrasoInput.value));
  }

  // Botão enviar pausa individual
  const btnEnviar = row.querySelector(".btn-send-individual-js");
  if (btnEnviar) {
    btnEnviar.addEventListener("click", () => sendPausaIndividual(nome));
  }

  // Botão mensagem rápida Discord
  const btnMsg = row.querySelector(".btn-msg-rapida-js");
  if (btnMsg) {
    btnMsg.addEventListener("click", () => abrirMensagemRapida(nome));
  }

  // Botão "Ocultar hoje" (ativa OFF sem modal)
  const btnOcultar = row.querySelector(".btn-ocultar-js");
  if (btnOcultar) {
    btnOcultar.addEventListener("click", () => {
      const fOcult = getFlagDefault(nome);
      fOcult.off = true;
      saveLocal();
      saveFlag(nome);
      renderPausas();
      renderDash();
      renderOffSugestoes();
      toast(`${nome} ocultado(a) da escala. Flag OFF ativada.`);
    });
  }

  // Botão "Restaurar" (desativa off/ferias/atestado rapidamente)
  const btnRestore = row.querySelector(".btn-restaurar-js");
  if (btnRestore) {
    btnRestore.addEventListener("click", () => {
      const fRes = getFlagDefault(nome);
      fRes.off = false;
      fRes.ferias = false;
      fRes.atestado = false;
      saveLocal();
      saveFlag(nome);
      renderPausas();
      renderDash();
      renderOffSugestoes();
      toast(`${nome} restaurado(a) na escala.`);
    });
  }

  // Toggle de flags colapsáveis (técnicos)
  const btnFlagsToggle = row.querySelector('.btn-flags-toggle-js');
  if (btnFlagsToggle) {
    btnFlagsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const wrapper = row.querySelector('.pr-flags--tecnico');
      const panel   = row.querySelector('[data-flags-panel]');
      const jaAberto = wrapper && wrapper.classList.contains('pr-flags--open');

      // Fecha todos os outros dropdowns de status abertos
      document.querySelectorAll('.pr-flags--tecnico.pr-flags--open').forEach(w => {
        w.classList.remove('pr-flags--open');
        w.querySelector('[data-flags-trigger]')?.setAttribute('aria-expanded', 'false');
      });

      // Se nao estava aberto, abre este e posiciona o panel (fixed)
      if (!jaAberto && wrapper && panel) {
        // Calcula posição relativa ao botão trigger
        const rect = btnFlagsToggle.getBoundingClientRect();
        const panelW = 290; // min-width do panel
        let left = rect.right - panelW;
        if (left < 8) left = 8;
        panel.style.top  = (rect.bottom + 6) + 'px';
        panel.style.left = left + 'px';
        wrapper.classList.add('pr-flags--open');
        btnFlagsToggle.setAttribute('aria-expanded', 'true');
      }
    });
  }

  return row;
}

/** Renderiza o painel de ausencias ativas (OFF, Atestado) acima dos cards.
 *  Férias são gerenciadas na aba Férias e não aparecem aqui para evitar duplicidade. */
function renderPainelAusencias() {
  const container = document.getElementById("ausencias-painel-container");
  if (!container) return;

  const ausentes = colaboradores.filter(c => {
    const f = getFlagDefault(c.nome);
    return f.atestado || f.off; // ferias removidas daqui — use a aba Férias
  });

  if (!ausentes.length) {
    container.innerHTML = "";
    return;
  }

  const cards = ausentes.map(c => {
    const f = getFlagDefault(c.nome);
    let tipo, cls, badge;
    if (f.atestado) { tipo = "atestado"; cls = "ac-atestado"; badge = "ATESTADO"; }
    else            { tipo = "off";      cls = "ac-off";      badge = "OFF HOJE"; }

    let sub = "";
    if (tipo === "atestado" && atestados[c.nome]) {
      sub = atestados[c.nome].dias + " dia(s) de atestado";
    } else {
      sub = "Fora da escala";
    }

    return `
      <div class="ausencia-card ${cls}">
        <div class="ausencia-avatar-ac">${initials(c.nome)}</div>
        <div class="ausencia-info-ac">
          <strong>${escapeHtml(c.nome)}</strong>
          <small>${escapeHtml(sub)}</small>
        </div>
        <span class="ausencia-badge-ac">${badge}</span>
      </div>`;
  }).join("");

  container.innerHTML = `<div class="ausencias-painel">${cards}</div>`;
}

/** Renderiza a lista de pausas separada por turno. */
function renderPausas() {
  const container = $("pausas-body");
  container.innerHTML = "";

  renderPainelAusencias();

  const grupos = [
    { id: "manha", label: "Turno da manhã", hint: "Entradas antes de 10:00" },
    { id: "tarde", label: "Turno da tarde", hint: "Entradas a partir de 10:00" },
  ];

  grupos.forEach((grupo) => {
    let colabsTurno = colaboradores
      .filter((colab) => getTurnoPausa(getPausaDefault(colab.nome).entrada) === grupo.id);

    // Filtro de colaborador específico
    if (pausasFiltroColab) {
      colabsTurno = colabsTurno.filter(c =>
        c.nome.toLowerCase().includes(pausasFiltroColab.toLowerCase())
      );
    }

    // Ocultar ausentes
    if (pausasOcultarAusentes) {
      colabsTurno = colabsTurno.filter(c => {
        const f = getFlagDefault(c.nome);
        return !f.off && !f.ferias && !f.atestado;
      });
    }

    // Ordenação
    colabsTurno = sortColabsForPausas(colabsTurno);

    const section = document.createElement("section");
    section.className = "pausa-turno";

    // Conta colaboradores ativos (excluindo OFF e Chat da contagem de escaláveis)
    const ativos = colabsTurno.filter(c => {
      const f = getFlagDefault(c.nome);
      return !f.off && !f.ferias && !f.atestado;
    });

    const totalTurno = colabsTurno.length;
    const ativosCount = ativos.length;
    const ausentesCount = totalTurno - ativosCount;

    section.innerHTML = `
      <div class="pausa-turno-head">
        <div>
          <strong>${grupo.label}</strong>
          <small>${grupo.hint}</small>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="pausas-counter-badge">
            <strong>${ativosCount}</strong> de ${totalTurno} disponíveis
            ${ausentesCount > 0 ? `<span style="color:var(--red);font-size:10px;">· ${ausentesCount} ausente${ausentesCount > 1 ? 's' : ''}</span>` : ''}
          </span>
        </div>
      </div>
      <div class="pausa-turno-list"></div>
    `;

    const lista = section.querySelector(".pausa-turno-list");
    if (colabsTurno.length) {
      // Separa gestão de técnicos e insere label divisório
      const gestaoColabs = colabsTurno.filter(c => c.cargo === "Gestão Pit Stop");
      const tecnicoColabs = colabsTurno.filter(c => c.cargo !== "Gestão Pit Stop");
      if (gestaoColabs.length) {
        const labelGestao = document.createElement("div");
        labelGestao.className = "pausa-group-label pausa-group-label--gestao";
        labelGestao.textContent = "Gestão";
        lista.appendChild(labelGestao);
        gestaoColabs.forEach(colab => lista.appendChild(buildPausaRow(colab)));
      }
      if (tecnicoColabs.length) {
        const labelTecnico = document.createElement("div");
        labelTecnico.className = "pausa-group-label pausa-group-label--tecnico";
        labelTecnico.textContent = "Técnicos";
        lista.appendChild(labelTecnico);
        tecnicoColabs.forEach(colab => lista.appendChild(buildPausaRow(colab)));
      }
    } else {
      lista.innerHTML = `<div class="empty-state empty-state-compact"><strong>Nenhum colaborador neste turno</strong></div>`;
    }

    container.appendChild(section);
  });

  renderOffSugestoes();
  renderAtrasoAlertas();
}

/**
 * Ordena colaboradores para a tela de pausas conforme configuração atual.
 * @param {Array} colabs
 * @returns {Array}
 */
function sortColabsForPausas(colabs) {
  const { campo, direcao } = pausasOrdenacao;
  const mult = direcao === "asc" ? 1 : -1;
  return [...colabs].sort((a, b) => {
    if (campo === "nome") {
      return mult * a.nome.localeCompare(b.nome);
    }
    if (campo === "horario") {
      const ea = getPausaDefault(a.nome).entrada || "99:99";
      const eb = getPausaDefault(b.nome).entrada || "99:99";
      return mult * (ea.localeCompare(eb) || a.nome.localeCompare(b.nome));
    }
    if (campo === "status") {
      const prioridade = (nome) => {
        const f = getFlagDefault(nome);
        if (f.ferias)   return 5;
        if (f.atestado) return 4;
        if (f.off)      return 3;
        if (f.atraso)   return 2;
        if (f.rodizio)  return 1;
        return 0;
      };
      return mult * (prioridade(b.nome) - prioridade(a.nome));
    }
    return 0;
  });
}

function renderOffSugestoes() {
  const container = $("off-sugestoes-container");
  if (!container) return;
  container.innerHTML = "";

  const colabsOff = colaboradores.filter(c => {
    const f = getFlagDefault(c.nome);
    return f.off && pausas[c.nome]?.entrada;
  });

  if (!colabsOff.length) return;

  const disponiveis = colaboradores.filter(c => {
    const f = getFlagDefault(c.nome);
    return !f.off && !f.ferias && !f.atestado && pausas[c.nome]?.entrada;
  });

  colabsOff.forEach(offColab => {
    const candidato = disponiveis[Math.floor(Math.random() * disponiveis.length)];
    const div = document.createElement("div");
    div.className = "off-sugestao";
    div.innerHTML = `
      <div>
        <strong>⛔ ${offColab.nome} está OFF</strong><br>
        <span>Deseja adiantar a pausa de ${candidato ? escapeHtml(candidato.nome) : "outro colaborador"}?</span>
      </div>
      ${candidato ? `<button class="btn btn-small btn-gold" type="button" onclick="this.closest('.off-sugestao').remove()">Confirmar</button>` : ""}
      <button class="btn btn-small" type="button" onclick="this.closest('.off-sugestao').remove()">Dispensar</button>
    `;
    container.appendChild(div);
  });
}

/** Renderiza alertas de reorganização de escala por atraso. */
function renderAtrasoAlertas() {
  const container = $("atraso-alertas-container");
  if (!container) return;
  container.innerHTML = "";

  colaboradores.forEach(colab => {
    const f = getFlagDefault(colab.nome);
    if (!f.atraso) return;
    const p = getPausaDefault(colab.nome);
    if (!p.entrada) return;

    const atrasoMin = f.atraso_min || 60;
    const [hh, mm] = p.entrada.split(":").map(Number);
    const entradaReal = hh * 60 + mm + atrasoMin;
    const primeiraDisp = entradaReal + 60; // 1h de trabalho para 1ª pausa

    const hDisp = String(Math.floor(primeiraDisp / 60)).padStart(2, "0");
    const mDisp = String(primeiraDisp % 60).padStart(2, "0");

    const div = document.createElement("div");
    div.className = "atraso-alert";
    const nomeEsc = colab.nome.replace(/'/g, "\\'");
    const horarioAjustado = `${hDisp}:${mDisp}`;
    div.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span><strong>${colab.nome}</strong> chegou com ${atrasoMin}min de atraso — 1ª pausa somente após <strong>${hDisp}:${mDisp}</strong>.</span>
      <div style="display:flex;gap:6px;margin-left:auto;flex-shrink:0;">
        <button class="btn btn-small btn-gold" type="button" data-aplicar-atraso="${colab.nome}" data-horario="${horarioAjustado}">Aplicar ajuste</button>
        <button class="btn btn-small" type="button" onclick="this.closest('.atraso-alert').remove()">Dispensar</button>
      </div>
    `;
    div.querySelector('[data-aplicar-atraso]').addEventListener('click', function() {
      const n = this.dataset.aplicarAtraso;
      const h = this.dataset.horario;
      if (!pausas[n]) pausas[n] = {};
      pausas[n].pausa_10_1 = h;
      saveLocal();
      renderPausas();
      toast(`Pausa de ${n} ajustada para ${h}.`);
      this.closest('.atraso-alert').remove();
    });
    container.appendChild(div);
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

  const proximasPausas = colaboradores
    .filter((c) => {
      if (!pausas[c.nome]?.entrada) return false;
      // Exclui colaboradores com flags que os tiram da escala
      const f = getFlagDefault(c.nome);
      if (f.off || f.ferias || f.atestado || f.chat) return false;
      return true;
    })
    .map((c) => {
      const p = getPausaDefault(c.nome);
      const isGestao = c.cargo === "Gestão Pit Stop";

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

      const proxSlot = slots.find((s) => s.time && toMin(s.time) > agoraMin);

      return {
        c, p, isGestao,
        proxSlot,
        proxMin: proxSlot ? toMin(proxSlot.time) : Infinity,
      };
    })
    .filter((item) => item.proxMin !== Infinity)
    .sort((a, b) => a.proxMin - b.proxMin)
    .slice(0, 5);

  if (proximasPausas.length) {
    $("dash-pausas").innerHTML = `<div style="display:flex;flex-direction:column;gap:0;">` +
      proximasPausas.map(({ c, p, isGestao, proxSlot }) => {
      const diffMin = toMin(proxSlot.time) - agoraMin;
      const diffText = diffMin <= 0 ? "Agora"
        : diffMin < 60 ? `em ${diffMin}min`
        : `em ${Math.floor(diffMin / 60)}h${diffMin % 60 > 0 ? String(diffMin % 60).padStart(2,"0") : ""}`;

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

      const pausaBlocos = pausaSlots.filter(s => s.time)
        .map(s => buildPausaSlotHtml(s, c.nome))
        .join("");

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
    }).join("") + `</div>`;
  } else {
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

/**
 * Confirma e exclui um colaborador.
 * @param {number} index
 */
window.confirmarExclusaoColab = async (index) => {
  const colab = colaboradores[index];
  if (!colab) return;
  if (!confirm(`Deseja realmente excluir ${colab.nome}? Esta ação não pode ser desfeita.`)) return;
  
  colaboradores.splice(index, 1);
  delete pausas[colab.nome];
  delete flags[colab.nome];
  delete atestados[colab.nome];
  delete horariosChegada[colab.nome];

  try {
    if (supa && colab.discord_id) {
      await supa.from("colaboradores").delete().eq("discord_id", colab.discord_id);
    } else if (supa && colab.nome) {
      await supa.from("colaboradores").delete().eq("nome", colab.nome);
    }
  } catch (err) {
    console.warn("[excluirColab] Erro no Supabase:", err);
  }

  saveLocal();
  renderAll();
  toast(`${colab.nome} foi excluído(a) da equipe.`);
};

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

/**
 * Salva ou atualiza o colaborador a partir dos campos do modal.
 * [FIX 2] upsert usa "nome" como fallback quando discord_id está ausente.
 */
async function saveColab() {
  const colab = {
    nome: $("colab-nome").value.trim(),
    cargo: $("colab-cargo").value,
    discord_id: $("colab-discord").value.trim() || null,
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
      // [FIX 2] Se não tem discord_id, usa "nome" como chave de conflito para evitar duplicatas
      const conflictField = colab.discord_id ? "discord_id" : "nome";
      const { error } = await supa
        .from("colaboradores")
        .upsert(colab, { onConflict: conflictField });
      if (error) throw error;
    }

    saveLocal();
    closeModal("modal-colab");
    renderAll();
    toast("Colaborador salvo.");
  } catch (err) {
    console.error("[saveColab]", err);
    toast("Erro ao salvar colaborador: " + err.message);
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
      pausas[colab.nome] = {
        entrada,
        pausa_10_1: "",
        pausa_20:   addMinutes(entrada, 240),
        pausa_10_2: "",
        saida:      addMinutes(entrada, 240 + 72),
      };
    } else {
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

/**
 * Salva as pausas no Supabase (se configurado) e no localStorage.
 * [FIX 5] Não notifica colaboradores recém-cadastrados na tabela; apenas alterações reais.
 */
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

      // [FIX 5] Só notifica se o colaborador já existia na tabela E houve mudança real
      const alteradas = rows.filter((row) => {
        const antiga = antes[row.colaborador_nome];
        if (!antiga) return false; // novo cadastro → não notificar
        return campos.some((campo) => String(row[campo] ?? "") !== String(antiga[campo] ?? ""));
      });

      if (alteradas.length > 0) {
        // [FIX 3] try/catch individual para não deixar falha silenciosa
        try {
          await insertNotificacoesBulk(alteradas.map((row) => ({
            colaborador_nome: row.colaborador_nome,
            tipo: "pausa",
            titulo: "Sua pausa foi atualizada",
            mensagem: pausaResumo(row) || "Confira sua nova jornada no portal.",
          })));
        } catch (notifErr) {
          console.error("[savePausas] Falha ao enviar notificações em bulk:", notifErr);
          toast("Pausas salvas, mas notificações falharam: " + notifErr.message);
          saveLocal();
          return;
        }
      }
    }

    saveLocal();
    toast("Pausas salvas" + (supa ? " e colaboradores alterados notificados." : " localmente."));
  } catch (err) {
    console.error("[savePausas]", err);
    toast("Erro ao salvar pausas: " + err.message);
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

/**
 * Cadastra uma nova folga/férias a partir dos campos do modal.
 * [FIX 3] Notificação com try/catch individual e toast de erro.
 */
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

      // [FIX 3] try/catch individual — erro de notificação não cancela o salvamento
      try {
        await insertNotificacao({
          colaborador_nome: folga.colaborador_nome,
          tipo,
          titulo: tipo === "ferias" ? "Férias cadastradas" : "Folga cadastrada",
          mensagem: `${tipo === "ferias" ? "Período de férias" : "Data da folga"}: ${periodo}. ${folga.motivo ? "Motivo: " + folga.motivo : ""}`,
          referencia_id: folgaId,
        });
      } catch (notifErr) {
        console.error("[saveFolga] Falha ao notificar:", notifErr);
        toast("Salvo, mas notificação falhou: " + notifErr.message);
      }
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
    // Marca botão de origem como "registrado"
    const btnOrig = tipo === "ferias" ? document.getElementById("btn-add-ferias") : document.getElementById("btn-add-folga");
    if (btnOrig) {
      const _orig = btnOrig.innerHTML;
      btnOrig.innerHTML = `✓ ${tipo === "ferias" ? "Férias registradas" : "Folga registrada"}`;
      btnOrig.classList.add("btn-sent-success");
      setTimeout(() => {
        btnOrig.innerHTML = _orig;
        btnOrig.classList.remove("btn-sent-success");
      }, 4000);
    }
    toast(tipo === "ferias" ? "Férias cadastradas." : "Folga cadastrada.");
  } catch (err) {
    console.error("[saveFolga]", err);
    toast("Erro ao salvar: " + err.message);
  }
}

/** Salva uma nova pendência de análise. */
async function savePendencia() {
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
  (window.renderPendencias || renderPendencias)();

  if (supa) {
    try {
      const { error } = await supa.from("pitstop_pendencias").insert({
        id:          pendencia.id,
        cliente:     pendencia.cliente,
        cnpj:        pendencia.cnpj,
        registro:    pendencia.registro,
        motivo:      pendencia.motivo,
        caso_aberto: pendencia.caso_aberto,
        numero_caso: pendencia.numero_caso || null,
        criado_em:   pendencia.criado_em,
        status:      'aberta',
      });
      if (error) {
        console.warn("[savePendencia]", error);
        toast("Pendência adicionada localmente (falha ao sincronizar).");
        return;
      }
    } catch (err) {
      console.warn("[savePendencia] exception:", err);
      toast("Pendência adicionada localmente (falha ao sincronizar).");
      return;
    }
  }

  toast("Pendência adicionada." + (supa ? "" : " (modo local)"));
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
window.removePendencia = async (id) => {
  // Salva no histórico local antes de remover
  const concluida = pendencias.find((p) => p.id === id);
  if (concluida) {
    const hist = JSON.parse(localStorage.getItem("pitstop_pend_concl") || "[]");
    hist.unshift(concluida);
    localStorage.setItem("pitstop_pend_concl", JSON.stringify(hist.slice(0, 20)));
  }

  pendencias = pendencias.filter((p) => p.id !== id);
  saveLocal();
  (window.renderPendencias || renderPendencias)();

  if (supa) {
    try {
      const { error } = await supa.from("pitstop_pendencias").delete().eq("id", id);
      if (error) console.warn("[removePendencia]", error);
    } catch (err) {
      console.warn("[removePendencia] exception:", err);
    }
  }

  toast("Pendência concluída.");
};

/* ==========================================================================
   NOTIFICAÇÕES
   ========================================================================== */

/**
 * Insere uma notificação individual no Supabase.
 * [FIX 3] Lança erro real para que o chamador possa capturá-lo no try/catch.
 * @param {object} data
 * @returns {Promise<object|null>}
 */
async function insertNotificacao(data) {
  if (!supa) {
    console.warn("[NOTIF] Supabase indisponível — notificação ignorada");
    return null;
  }

  const payload = {
    colaborador_nome: data.colaborador_nome,
    tipo:             data.tipo         || "geral",
    titulo:           data.titulo       || "Nova notificação",
    mensagem:         data.mensagem     || "",
    referencia_id:    data.referencia_id || null,
    lida:             false,
    criado_em:        new Date().toISOString(),
  };

  console.log("[NOTIF] Inserindo:", payload);

  const { data: inserted, error } = await supa
    .from("notificacoes")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("[NOTIF] Erro:", error);
    throw error; // propaga para o chamador
  }

  console.log("[NOTIF] Inserida com sucesso:", inserted?.id);
  return inserted;
}

/**
 * Insere múltiplas notificações em lote.
 * [FIX 3] Lança erro real para que o chamador possa capturá-lo no try/catch.
 * @param {object[]} lista
 */
async function insertNotificacoesBulk(lista = []) {
  if (!supa) {
    console.warn("[NOTIF BULK] Supabase indisponível — notificações ignoradas");
    return;
  }

  if (!Array.isArray(lista) || !lista.length) return;

  const payload = lista.map((item) => ({
    colaborador_nome: item.colaborador_nome,
    tipo:             item.tipo         || "geral",
    titulo:           item.titulo       || "Nova notificação",
    mensagem:         item.mensagem     || "",
    referencia_id:    item.referencia_id || null,
    lida:             false,
    criado_em:        new Date().toISOString(),
  }));

  console.log("[NOTIF BULK] Inserindo", payload.length, "notificações");

  const { error } = await supa.from("notificacoes").insert(payload);

  if (error) {
    console.error("[NOTIF BULK] Erro:", error);
    throw error; // propaga para o chamador
  }

  console.log("[NOTIF BULK] Sucesso");
}

/**
 * Retorna um resumo textual das pausas de um colaborador.
 * @param {object} pausa
 * @returns {string}
 */
function pausaResumo(pausa) {
  return `
Entrada: ${pausa.entrada || "--:--"}
Pausa 10 #1: ${pausa.pausa_10_1 || "--:--"}
Pausa 20: ${pausa.pausa_20 || "--:--"}
Pausa 10 #2: ${pausa.pausa_10_2 || "--:--"}
Saída: ${pausa.saida || "--:--"}
  `.trim();
}

/**
 * Retorna os colaboradores destinatarios do aviso.
 * Suporta radio buttons com name="grupo-aviso" (padrao do HTML atual).
 * Values esperados nos radios:
 *   "todos"            - todos os colaboradores ativos
 *   "Tecnicos"         - apenas tecnicos
 *   "Gestao Pit Stop"  - apenas gestao
 */
function getDestinatariosAviso() {
  // Busca radio com qualquer um dos nomes possiveis usados no HTML
  const radioChecked = document.querySelector(
    'input[name="grupo-aviso"]:checked, ' +
    'input[name="aviso-grupo"]:checked, ' +
    'input[name="aviso-destinatario"]:checked, ' +
    'input[name="aviso-filtro"]:checked'
  );

  if (radioChecked) {
    const val = radioChecked.value; // preserva case original do HTML

    if (val === "todos" || val.toLowerCase() === "all") {
      return colaboradores.filter((c) => c.ativo !== false);
    }
    if (val === "Técnicos" || val.toLowerCase() === "tecnicos") {
      return colaboradores.filter((c) => c.ativo !== false && c.cargo === "Técnicos");
    }
    if (val === "Gestão Pit Stop" || val.toLowerCase() === "gestao" || val.toLowerCase() === "gestao pit stop") {
      return colaboradores.filter((c) => c.ativo !== false && c.cargo === "Gestão Pit Stop");
    }
    // Fallback: filtra por nome exato
    return colaboradores.filter((c) => c.ativo !== false && c.nome === val);
  }

  // Fallback para select multiplo (caso a UI use outro padrao)
  const select =
    document.getElementById("aviso-destinatarios") ||
    document.getElementById("aviso-colaboradores");

  if (!select) return colaboradores.filter((c) => c.ativo !== false);

  const values = Array.from(select.selectedOptions || [])
    .map((opt) => opt.value)
    .filter(Boolean);

  if (!values.length) return colaboradores.filter((c) => c.ativo !== false);

  return colaboradores.filter((c) => values.includes(c.nome));
}

/**
 * Cria um feedback privado para um colaborador.
 * [FIX 3] Notificação com try/catch individual.
 */
async function criarFeedbackPrivado() {
  const colaboradorNome = $("feedback-colaborador")?.value;
  const titulo = $("feedback-titulo")?.value?.trim();
  const mensagem = $("feedback-mensagem")?.value?.trim();

  if (!colaboradorNome || !titulo || !mensagem) {
    toast("Informe colaborador, título e mensagem do feedback.");
    return;
  }

  try {
    let feedbackId = null;

    if (supa) {
      // [FIX 7] Usa apenas colunas existentes. Ajuste "criado_por" se sua
      // tabela feedbacks nao tiver essa coluna.
      const { data, error } = await supa
        .from("feedbacks")
        .insert({
          colaborador_nome: colaboradorNome,
          titulo,
          mensagem,
          criado_por: "Gestão PIT STOP",
        })
        .select("id")
        .single();

      if (error) throw error;
      feedbackId = data?.id ?? null;

      // [FIX 3] try/catch individual — falha na notificação não cancela o feedback
      try {
        await insertNotificacao({
          colaborador_nome: colaboradorNome,
          tipo: "feedback",
          titulo: `Novo feedback: ${titulo}`,
          mensagem,
          referencia_id: feedbackId,
        });
      } catch (notifErr) {
        console.error("[criarFeedbackPrivado] Falha ao notificar:", notifErr);
        toast("Feedback salvo, mas notificação falhou: " + notifErr.message);
      }
    }

    const colabFeedback = colaboradores.find(c => c.nome === colaboradorNome);
    if (colabFeedback?.discord_id) {
      try {
        await sendHermes("feedback-privado", {
          titulo,
          mensagem,
          destinatarios: [colabFeedback],
        });
      } catch (hermesErr) {
        console.warn("[Hermes] Feedback salvo, mas DM falhou:", hermesErr);
        toast("Feedback salvo, mas o envio no Discord falhou: " + hermesErr.message);
      }
    }

    if ($("feedback-titulo"))        $("feedback-titulo").value = "";
    if ($("feedback-mensagem"))      $("feedback-mensagem").value = "";
    if ($("feedback-colaborador"))   $("feedback-colaborador").value = "";

    const btn = document.getElementById('btn-send-feedback');
    confirmarEnvioBtn(btn, 'Feedback enviado');
    toast("Feedback privado enviado.");
  } catch (err) {
    console.error("[criarFeedbackPrivado]", err);
    toast("Erro ao enviar feedback: " + err.message);
  }
}

window.criarFeedbackPrivado = criarFeedbackPrivado;
window.getDestinatariosAviso = getDestinatariosAviso;

/* ==========================================================================
   12. Integração com Hermes
   ========================================================================== */

/**
 * Envia uma requisição para a API do Hermes (proxy via /api/hermes).
 * @param {string} tipo
 * @param {object} payload
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

/**
 * Dispara aviso no Discord para os destinatários selecionados.
 * [FIX 3] Notificação bulk com try/catch individual.
 */
async function sendAviso() {
  const destinatarios = getDestinatariosAviso();

  if (!destinatarios.length) {
    toast("Nenhum destinatário.");
    return;
  }

  const canal    = $("aviso-canal").value;
  const titulo   = $("aviso-titulo").value.trim();
  const mensagem = $("aviso-msg").value.trim();

  if (!titulo || !mensagem) {
    toast("Informe título e mensagem.");
    return;
  }

  try {
    let avisoId = null;

    if (supa) {
      // [FIX 7] Usa apenas colunas que existem na tabela avisos do Supabase.
      // Se sua tabela usa "created_at" (padrao Supabase), mantenha assim.
      // Se usa "criado_em", troque created_at por criado_em abaixo.
      const avisoPayload = {
        canal,
        titulo,
        mensagem,
        criado_por: "Gestão PIT STOP",
      };

      const { data, error } = await supa
        .from("avisos")
        .insert(avisoPayload)
        .select("id")
        .single();

      if (error) throw error;
      avisoId = data?.id ?? null;

      // [FIX 3] try/catch individual para notificações bulk
      try {
        await insertNotificacoesBulk(destinatarios.map((dest) => ({
          colaborador_nome: dest.nome,
          tipo: "aviso",
          titulo: `Novo aviso: ${titulo}`,
          mensagem,
          referencia_id: avisoId,
        })));
      } catch (notifErr) {
        console.error("[sendAviso] Falha ao notificar em bulk:", notifErr);
        toast("Aviso salvo, mas notificações falharam: " + notifErr.message);
      }
    }

    try {
      await sendHermes("novo-aviso", { canal, titulo, mensagem, destinatarios });
    } catch (err) {
      console.warn("[Hermes] aviso salvo no portal, mas Discord falhou:", err);
    }

    // Sinaliza o sino imediatamente para o gestor que acabou de enviar
    if (window.NotifBell) {
      window.NotifBell.add('aviso', '📢 ' + titulo, mensagem, '📢');
    }

    const btn = document.getElementById('btn-send-aviso');
    confirmarEnvioBtn(btn, `${destinatarios.length} enviado(s)`);
    toast(`Aviso publicado para ${destinatarios.length} colaborador(es).`);
  } catch (err) {
    console.error("[sendAviso]", err);
    toast("Erro: " + (err.message ?? err));
  }
}

/** Envia as pausas do dia via Hermes para o Discord. */
async function sendPausas() {
  const btn = document.getElementById('btn-send-pausas');
  marcarBotaoEnviado(btn, 'Enviando...', 'Discord ✓ Enviado');
  try {
    await sendHermes("pitstop-pausas", { pausas, colaboradores });
    toast("Pausas enviadas no Discord.");
    confirmarEnvioBtn(btn, '✓ Enviado');
  } catch (err) {
    resetarBtn(btn, 'Enviar no Discord');
    toast("Erro: " + err.message);
  }
}

/** Marca um botão como "enviando" e depois "enviado". */
function marcarBotaoEnviado(btn, textoEnviando, textoSucesso) {
  if (!btn) return;
  btn.disabled = true;
  btn._textoOriginal = btn.innerHTML;
  btn.innerHTML = textoEnviando;
  btn.classList.add('btn-sending');
}

function confirmarEnvioBtn(btn, texto) {
  if (!btn) return;
  btn.classList.remove('btn-sending');
  btn.classList.add('btn-sent-success');
  btn.innerHTML = `✓ ${texto.replace('✓ ', '')}`;
  setTimeout(() => {
    btn.classList.remove('btn-sent-success');
    btn.innerHTML = btn._textoOriginal || texto;
    btn.disabled = false;
  }, 6000);
}

function resetarBtn(btn, texto) {
  if (!btn) return;
  btn.disabled = false;
  btn.classList.remove('btn-sending', 'btn-sent-success');
  btn.innerHTML = btn._textoOriginal || texto;
}

/* ==========================================================================
   13. Inicialização
   ========================================================================== */

/** Inicializa a aplicação: carrega dados e renderiza a interface. */
/* ==========================================================================
   13b. Realtime — sincronização via WebSocket (Supabase)
   ========================================================================== */

/**
 * Inicia a subscription Realtime do Supabase.
 * Qualquer mutação nas tabelas monitoradas dispara um re-load completo,
 * garantindo que todos os gestores vejam o mesmo estado sem polling.
 *
 * Tabelas monitoradas:
 *   colaboradores, pausas, folgas, pitstop_flags, pitstop_atestados,
 *   pitstop_escala_sabado, pitstop_pendencias
 *
 * Pré-requisito (SQL, uma vez no Dashboard):
 *   alter publication supabase_realtime add table colaboradores;
 *   alter publication supabase_realtime add table pausas;
 *   alter publication supabase_realtime add table folgas;
 *   alter publication supabase_realtime add table pitstop_flags;
 *   alter publication supabase_realtime add table pitstop_atestados;
 *   alter publication supabase_realtime add table pitstop_escala_sabado;
 *   alter publication supabase_realtime add table pitstop_pendencias;
 *
 * @returns {import("@supabase/supabase-js").RealtimeChannel}
 */
function iniciarRealtime() {
  if (!supa) return null;

  const TABELAS = [
    "colaboradores",
    "pausas",
    "folgas",
    "pitstop_flags",
    "pitstop_atestados",
    "pitstop_escala_sabado",
    "pitstop_pendencias",
  ];

  /** Re-sincroniza o estado global quando chega qualquer evento remoto. */
  async function _onRemoteChange(payload) {
    try {
      await loadSupabase();
      saveLocal();
      refreshDcPreloadedData();
      renderAll();
    } catch (err) {
      console.warn("[Realtime] Falha ao re-sincronizar após evento remoto:", err);
    }
  }

  let channel = supa.channel("pitstop-sync");

  TABELAS.forEach((tabela) => {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: tabela },
      _onRemoteChange
    );
  });

  channel.subscribe((status, err) => {
    if (status === "SUBSCRIBED") {
      console.log("[Realtime] Conectado — sincronização em tempo real ativa.");
    } else if (status === "CHANNEL_ERROR") {
      console.warn("[Realtime] Erro no canal:", err);
    } else if (status === "TIMED_OUT") {
      console.warn("[Realtime] Timeout — tentando reconectar...");
    }
  });

  // Reconecta automaticamente quando o usuário volta para a aba
  // (WebSockets ficam ociosos em abas em background em alguns browsers)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadSupabase()
        .then(() => { saveLocal(); renderAll(); })
        .catch((err) => console.warn("[Realtime] Re-sync ao retornar para aba:", err));
    }
  });

  return channel;
}


/** Mantém o cache de dados pré-carregados para o dashboard atualizado. */
function refreshDcPreloadedData() {
  window._dcPreloadedData = {
    folgas:      folgas,
    pendencias:  pendencias,
    importacoes: (typeof PEV_importacoes !== 'undefined' ? PEV_importacoes : []),
  };
}

async function boot() {
  try {
    loadLocal();

    if (supa) {
      await loadSupabase();
    } else {
      console.warn("[boot] Supabase não inicializado — verifique SUPABASE_ANON_KEY.");
    }

    saveLocal();
    verificarAtestadosVencidos();

    // Expõe dados já carregados para o dashboard evitar 3 queries extras
    window._dcPreloadedData = {
      folgas:      folgas,
      pendencias:  pendencias,
      importacoes: (typeof PEV_importacoes !== 'undefined' ? PEV_importacoes : []),
    };

    renderAll();

    setTimeout(() => {
      popularSelectFeedback();
    }, 300);

  } catch (err) {
    console.error("[boot]", err);
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
$("btn-sync").onclick           = boot;
$("btn-add-colab").onclick      = newColab;
$("btn-save-colab").onclick     = saveColab;
$("btn-add-folga").onclick      = () => newFolga("folga");
$("btn-add-ferias").onclick     = () => newFolga("ferias");
$("btn-save-folga").onclick     = saveFolga;
$("folga-tipo").onchange        = toggleFolgaTipoFields;
$("btn-save-pendencia").onclick = savePendencia;
$("pendencia-caso-aberto").onchange = togglePendenciaCaso;
$("btn-auto-pausas").onclick    = autoPausas;
$("btn-save-pausas").onclick    = savePausas;
$("btn-send-aviso").onclick     = sendAviso;
if ($("btn-send-feedback")) $("btn-send-feedback").onclick = criarFeedbackPrivado;
$("btn-send-pausas").onclick    = sendPausas;

// Escala de sábado
if ($("btn-add-sabado"))   $("btn-add-sabado").onclick   = newSabadoEntry;
if ($("btn-save-sabado"))  $("btn-save-sabado").onclick  = saveSabadoEntry;
if ($("btn-send-sabado"))  $("btn-send-sabado").onclick  = sendEscalaSabado;
if ($("btn-clear-sabado")) $("btn-clear-sabado").onclick = clearEscalaSabado;

toggleFolgaTipoFields();
togglePendenciaCaso();

// Inicia a aplicação
boot().then(() => {
  iniciarControlesPausas();
});

// Atualiza o painel a cada 60 segundos
setInterval(() => {
  renderMetrics();
  renderDash();
}, 60000);

// Auto-sincronização via Supabase Realtime (WebSocket).
// Substitui o polling de 30s: qualquer INSERT/UPDATE/DELETE nas tabelas
// abaixo dispara um re-load imediato em todos os gestores conectados.
if (supa) {
  iniciarRealtime();
  // Heartbeat leve: re-sincroniza a cada 5min como fallback para quedas
  // silenciosas de WebSocket (ex.: aba em background por muito tempo).
  setInterval(() => {
    if (!document.hidden) {
      loadSupabase().then(() => { saveLocal(); refreshDcPreloadedData(); renderAll(); }).catch((err) => {
        console.warn("[heartbeat]", err);
      });
    }
  }, 300_000);
}

/* ==========================================================================
   15. Status do sistema
   ========================================================================== */

async function atualizarStatusSistema() {
  const titulo = document.getElementById("status-conexao");
  const desc   = document.getElementById("status-descricao");
  const hora   = document.getElementById("status-time");
  const badge  = document.getElementById("status-badge");
  const card   = document.getElementById("status-card");

  let hermesOk = false;
  let bancoOk  = false;

  // Testa Hermes
  try {
    const r = await fetch("/api/hermes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "health-check" }),
    });
    hermesOk = r.ok;
  } catch {}

  // Testa Supabase
  try {
    if (supa) {
      const { error } = await supa.from("colaboradores").select("id").limit(1);
      bancoOk = !error;
    } else {
      // [FIX 6] Se supa é null por chave inválida, banco está realmente offline
      bancoOk = false;
    }
  } catch {}

  const agora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (hermesOk && bancoOk) {
    titulo.textContent = "Ambiente Operacional";
    desc.textContent   = "Todos os serviços ativos.";
    badge.className    = "status-badge online";
    badge.textContent  = "ONLINE";
    card.className     = "status-card";
  } else if (hermesOk || bancoOk) {
    titulo.textContent = "Atenção Necessária";
    desc.textContent   = "Algumas funções podem oscilar.";
    badge.className    = "status-badge warning";
    badge.textContent  = "ATENÇÃO";
    card.className     = "status-card warning";
  } else {
    titulo.textContent = "Serviço Indisponível";
    desc.textContent   = "Contate o responsável técnico.";
    badge.className    = "status-badge offline";
    badge.textContent  = "OFFLINE";
    card.className     = "status-card offline";
  }

  hora.textContent = "Última atualização: " + agora;
}

atualizarStatusSistema();
setInterval(atualizarStatusSistema, 60000);

/* ==========================================================================
   16. Select de feedback
   ========================================================================== */

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
    select.innerHTML = `<option value="">Nenhum colaborador encontrado</option>`;
    return;
  }

  select.innerHTML = `<option value="">Selecione o colaborador</option>`;

  ativos.forEach((c) => {
    const option = document.createElement("option");
    option.value = c.nome;
    option.textContent = `${c.nome} — ${c.cargo || "Sem cargo"}`;
    select.appendChild(option);
  });

  console.log("[Feedback] colaboradores carregados:", ativos.length);
}

window.popularSelectFeedback = popularSelectFeedback;

/* ==========================================================================
   17. Relógio ao vivo
   ========================================================================== */

function iniciarRelogioAoVivo() {
  const el = $("relogio-ao-vivo");
  if (!el) return;
  function atualizar() {
    const agora = new Date();
    el.textContent = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  atualizar();
  setInterval(atualizar, 1000);
}
iniciarRelogioAoVivo();

/* ==========================================================================
   18. Controles de ordenação, filtro e ocultar ausentes (Pausas)
   ========================================================================== */

function iniciarControlesPausas() {
  // Ordenação por status/horário/nome
  document.querySelectorAll(".pausas-sort-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const campo = btn.dataset.sort;
      if (pausasOrdenacao.campo === campo) {
        pausasOrdenacao.direcao = pausasOrdenacao.direcao === "asc" ? "desc" : "asc";
      } else {
        pausasOrdenacao.campo = campo;
        pausasOrdenacao.direcao = "asc";
      }
      document.querySelectorAll(".pausas-sort-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderPausas();
    });
  });

  // Ocultar ausentes
  const btnOcultar = $("btn-ocultar-ausentes");
  if (btnOcultar) {
    btnOcultar.addEventListener("click", () => {
      pausasOcultarAusentes = !pausasOcultarAusentes;
      btnOcultar.classList.toggle("active", pausasOcultarAusentes);
      btnOcultar.textContent = pausasOcultarAusentes ? "👁 Mostrar ausentes" : "🚫 Ocultar ausentes";
      renderPausas();
    });
  }

  // Filtro por colaborador específico
  const filtroInput = $("pausas-filtro-colab");
  if (filtroInput) {
    filtroInput.addEventListener("input", () => {
      pausasFiltroColab = filtroInput.value.trim();
      renderPausas();
    });

    // Preencher datalist
    const dl = $("pausas-filtro-datalist");
    if (dl) {
      colaboradores.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.nome;
        dl.appendChild(opt);
      });
    }
  }

  // Botão limpar filtro
  const btnLimparFiltro = $("btn-limpar-filtro-colab");
  if (btnLimparFiltro) {
    btnLimparFiltro.addEventListener("click", () => {
      pausasFiltroColab = "";
      if (filtroInput) filtroInput.value = "";
      renderPausas();
    });
  }
}

// Inicializa controles após o boot
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(iniciarControlesPausas, 500);
});
/* ==========================================================================
   19. Mensagem rápida via Discord por colaborador
   ========================================================================== */

/**
 * Abre o modal de mensagem rápida para um colaborador específico.
 * @param {string} nome
 */
window.abrirMensagemRapida = function(nome) {
  garantirModalMensagemRapida();
  const modal = $("modal-mensagem-rapida");
  $("mensagem-rapida-nome").textContent = nome;
  $("mensagem-rapida-colab").value = nome;
  $("mensagem-rapida-texto").value = "";
  modal.classList.add("open");
};

function garantirModalMensagemRapida() {
  if ($("modal-mensagem-rapida")) return;
  const div = document.createElement("div");
  div.className = "modal-overlay";
  div.id = "modal-mensagem-rapida";
  div.setAttribute("role", "dialog");
  div.setAttribute("aria-modal", "true");
  div.innerHTML = `
    <div class="modal modal-atraso-inner" style="gap:0;padding:0;overflow:hidden;max-width:500px;">
      <div class="modal-folga-header">
        <div class="modal-folga-icon" style="background:rgba(88,101,242,0.12);color:#9ba3ff;border-color:rgba(88,101,242,0.25);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div>
          <h2 style="font-size:18px;margin:0;">Mensagem rápida</h2>
          <p style="font-size:12px;color:var(--muted);margin-top:2px;">Para: <strong id="mensagem-rapida-nome"></strong></p>
        </div>
        <button type="button" id="btn-close-mensagem-rapida" aria-label="Fechar" style="position:absolute;right:18px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;">✕</button>
      </div>
      <div style="padding:20px 24px;display:flex;flex-direction:column;gap:14px;">
        <input type="hidden" id="mensagem-rapida-colab" />
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);">Mensagem</label>
          <textarea id="mensagem-rapida-texto" rows="4" placeholder="Digite a mensagem a enviar via Discord DM..." style="background:var(--surface3);border:1px solid var(--border);border-radius:10px;padding:10px 14px;color:var(--text);font-family:inherit;font-size:14px;resize:vertical;"></textarea>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${[
            "Sua pausa está chegando! ⏰",
            "Por favor, confirme sua disponibilidade.",
            "Retorne ao atendimento assim que possível.",
            "Temos uma reunião agora. Por favor, entre.",
          ].map(t => `<button type="button" class="btn btn-small btn-msg-rapida-sugestao" style="font-size:11px;height:28px;border-radius:8px;" data-texto="${t}">${t}</button>`).join("")}
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding:16px 24px 20px;border-top:1px solid var(--border);">
        <button class="btn" type="button" id="btn-cancel-mensagem-rapida">Cancelar</button>
        <button class="btn btn-discord" type="button" id="btn-confirm-mensagem-rapida" style="height:40px;padding:0 20px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
          Enviar no Discord
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  div.addEventListener("click", e => { if (e.target === div) div.classList.remove("open"); });
  $("btn-close-mensagem-rapida").onclick  = () => div.classList.remove("open");
  $("btn-cancel-mensagem-rapida").onclick = () => div.classList.remove("open");

  // Sugestões de texto
  div.querySelectorAll(".btn-msg-rapida-sugestao").forEach(btn => {
    btn.addEventListener("click", () => {
      $("mensagem-rapida-texto").value = btn.dataset.texto;
    });
  });

  // Enviar
  $("btn-confirm-mensagem-rapida").onclick = async () => {
    const nome    = $("mensagem-rapida-colab").value;
    const texto   = $("mensagem-rapida-texto").value.trim();
    const colab   = colaboradores.find(c => c.nome === nome);
    if (!texto) { toast("Digite a mensagem."); return; }
    if (!colab?.discord_id) { toast("Colaborador sem Discord ID configurado."); return; }
    try {
      await sendHermes("pitstop-mensagem", { discord_id: colab.discord_id, nome, mensagem: texto });
      toast(`Mensagem enviada para ${nome} no Discord.`);
      div.classList.remove("open");
    } catch (err) {
      toast("Erro ao enviar: " + err.message);
    }
  };
}

/* ==========================================================================
   20. Confirmação de pausas — status em tempo real
   ========================================================================== */

/**
 * Retorna o status de uma pausa específica de um colaborador.
 * @param {string} nome
 * @param {string} campo
 * @returns {"pendente"|"confirmada"|"atrasada"|"ausente"}
 */
function getPausaStatus(nome, campo) {
  return pausaStatusHoje[nome]?.[campo] ?? "pendente";
}

/**
 * Persiste o status de uma pausa no Supabase e atualiza o estado local imediatamente.
 * @param {string} nome        - Nome do colaborador
 * @param {string} campo       - "pausa_10_1" | "pausa_20" | "pausa_10_2"
 * @param {string} novoStatus  - "pendente" | "confirmada" | "atrasada" | "ausente"
 * @param {string} [obs]       - Observação opcional
 */
async function setPausaStatus(nome, campo, novoStatus, obs = "") {
  // Atualiza estado local imediatamente para resposta rápida
  if (!pausaStatusHoje[nome]) {
    pausaStatusHoje[nome] = { pausa_10_1: "pendente", pausa_20: "pendente", pausa_10_2: "pendente", obs: "" };
  }
  pausaStatusHoje[nome][campo] = novoStatus;
  if (obs) pausaStatusHoje[nome].obs = obs;

  renderDash();
  renderPausas();

  // Persiste no Supabase
  if (!supa) return;
  try {
    const row = {
      colaborador_nome: nome,
      data:             todayISO(),
      pausa_10_1:       pausaStatusHoje[nome].pausa_10_1,
      pausa_20:         pausaStatusHoje[nome].pausa_20,
      pausa_10_2:       pausaStatusHoje[nome].pausa_10_2,
      obs:              pausaStatusHoje[nome].obs,
      atualizado_em:    new Date().toISOString(),
    };
    const { error } = await supa
      .from("pitstop_pausa_status")
      .upsert(row, { onConflict: "colaborador_nome,data" });
    if (error) console.warn("[setPausaStatus]", error);
  } catch (err) {
    console.warn("[setPausaStatus] exception:", err);
  }
}

/**
 * Constrói o HTML de um slot de pausa com botões de confirmação de status.
 * @param {{ key: string, label: string, icon: string, time: string, isNext: boolean }} slot
 * @param {string} nome - Nome do colaborador
 * @returns {string}
 */
function buildPausaSlotHtml(slot, nome) {
  const status = getPausaStatus(nome, slot.key);
  const nomeEsc = escapeHtml(nome);

  const statusMap = {
    pendente:   { cls: "",             badge: "" },
    confirmada: { cls: "ps-confirmada", badge: "✅ saiu" },
    atrasada:   { cls: "ps-atrasada",   badge: "🔴 ATRASADO" },
    ausente:    { cls: "ps-ausente",    badge: "⛔ ausente" },
  };
  const st = statusMap[status] || statusMap.pendente;

  const nextPendente = slot.isNext && status === "pendente";
  const slotClass = [
    "dash-pausa-slot",
    slot.isNext ? "dash-pausa-slot--next" : "",
    st.cls,
    nextPendente ? "ps-pendente-next" : "",
  ].filter(Boolean).join(" ");

  const btnsHtml = `
    <div class="ps-action-row">
      <button class="ps-btn ps-btn-ok"
        title="Confirmar: ${escapeHtml(slot.label)} saiu"
        data-ps-nome="${nomeEsc}" data-ps-campo="${slot.key}" data-ps-status="confirmada">✔ saiu</button>
      <button class="ps-btn ps-btn-late"
        title="Marcar como atrasado"
        data-ps-nome="${nomeEsc}" data-ps-campo="${slot.key}" data-ps-status="atrasada">⏱ atrasou</button>
      <button class="ps-btn ps-btn-absent"
        title="Marcar como ausente"
        data-ps-nome="${nomeEsc}" data-ps-campo="${slot.key}" data-ps-status="ausente">✕</button>
    </div>`;

  return `
    <div class="${slotClass}" data-ps-campo="${slot.key}" data-ps-nome="${nomeEsc}">
      <div class="ps-slot-top">
        <span class="dash-pausa-slot-label">${slot.icon} ${slot.label}</span>
        ${st.badge ? `<span class="ps-status-label">${st.badge}</span>` : ""}
      </div>
      <span class="dash-pausa-slot-time">${slot.time}</span>
      ${btnsHtml}
    </div>`;
}

// Fecha dropdown de status ao clicar fora ou pressionar Escape
document.addEventListener("click", (e) => {
  if (!e.target.closest('.pr-flags--tecnico')) {
    document.querySelectorAll('.pr-flags--tecnico.pr-flags--open').forEach(w => {
      w.classList.remove('pr-flags--open');
      w.querySelector('[data-flags-trigger]')?.setAttribute('aria-expanded', 'false');
    });
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll('.pr-flags--tecnico.pr-flags--open').forEach(w => {
      w.classList.remove('pr-flags--open');
      w.querySelector('[data-flags-trigger]')?.setAttribute('aria-expanded', 'false');
    });
  }
});

// Delegação global de eventos para botões de status de pausa
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-ps-nome][data-ps-campo][data-ps-status]");
  if (!btn) return;
  e.stopPropagation();

  const nome   = btn.dataset.psNome;
  const campo  = btn.dataset.psCampo;
  const status = btn.dataset.psStatus;

  if (status === "confirmada") {
    await setPausaStatus(nome, campo, "confirmada");
    toast(`✅ ${nome} — pausa confirmada.`);
    return;
  }
  if (status === "ausente") {
    await setPausaStatus(nome, campo, "ausente");
    toast(`⛔ ${nome} — ausente nesta pausa.`);
    return;
  }
  if (status === "atrasada") {
    abrirModalPausaAtrasada(nome, campo);
    return;
  }
  if (status === "pendente") {
    await setPausaStatus(nome, campo, "pendente", "");
    toast(`🔘 ${nome} — status resetado.`);
  }
});

/** Abre o modal para registrar atraso de pausa. */
function abrirModalPausaAtrasada(nome, campo) {
  garantirModalPausaAtrasada();
  const modal = document.getElementById("modal-ps-atrasado");
  document.getElementById("ps-atrasado-nome").textContent = nome;
  document.getElementById("ps-atrasado-campo").value      = campo;
  document.getElementById("ps-atrasado-colab").value      = nome;
  document.getElementById("ps-atrasado-obs").value        = "";
  document.getElementById("ps-atrasado-min").value        = "10";

  const p = getPausaDefault(nome);
  document.getElementById("ps-atrasado-horario").textContent = p[campo] || "--:--";

  modal.classList.add("open");
}

/** Cria o modal de atraso de pausa dinamicamente (apenas uma vez). */
function garantirModalPausaAtrasada() {
  if (document.getElementById("modal-ps-atrasado")) return;
  const div = document.createElement("div");
  div.className = "modal-overlay";
  div.id = "modal-ps-atrasado";
  div.setAttribute("role", "dialog");
  div.setAttribute("aria-modal", "true");
  div.innerHTML = `
    <div class="modal modal-atraso-inner" style="gap:0;padding:0;overflow:hidden;max-width:480px;">
      <div class="modal-folga-header">
        <div class="modal-folga-icon" style="background:rgba(239,68,68,0.12);color:#f87171;border-color:rgba(239,68,68,0.25);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
          </svg>
        </div>
        <div>
          <h2 style="font-size:18px;margin:0;">Pausa atrasada</h2>
          <p style="font-size:12px;color:var(--muted);margin-top:2px;">
            Colaborador: <strong id="ps-atrasado-nome"></strong>
            &nbsp;·&nbsp; Previsto: <strong id="ps-atrasado-horario"></strong>
          </p>
        </div>
        <button type="button" id="btn-close-ps-atrasado" aria-label="Fechar"
          style="position:absolute;right:18px;top:50%;transform:translateY(-50%);width:30px;height:30px;
                 border-radius:8px;border:1px solid var(--border);background:var(--surface2);
                 color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;">✕</button>
      </div>
      <div style="padding:20px 24px;display:flex;flex-direction:column;gap:14px;">
        <input type="hidden" id="ps-atrasado-colab" />
        <input type="hidden" id="ps-atrasado-campo" />
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);">Minutos de atraso</label>
          <select id="ps-atrasado-min"
            style="background:var(--surface3);border:1px solid var(--border);border-radius:10px;
                   padding:10px 14px;color:var(--text);font-family:inherit;font-size:14px;">
            <option value="5">5 min</option>
            <option value="10" selected>10 min</option>
            <option value="15">15 min</option>
            <option value="20">20 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">1 hora</option>
          </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);">Observação (opcional)</label>
          <input id="ps-atrasado-obs" type="text" placeholder="Ex: estava em atendimento, sistema travou..."
            style="background:var(--surface3);border:1px solid var(--border);border-radius:10px;
                   padding:10px 14px;color:var(--text);font-family:inherit;font-size:14px;" />
        </div>
        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);
                    border-radius:10px;padding:10px 14px;font-size:12px;color:#f87171;line-height:1.5;">
          🔴 O card vai subir para o topo e ficar em destaque vermelho pulsante para quem estiver de plantão tomar providência.
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding:16px 24px 20px;border-top:1px solid var(--border);">
        <button class="btn" type="button" id="btn-cancel-ps-atrasado">Cancelar</button>
        <button class="btn" type="button" id="btn-confirm-ps-atrasado"
          style="background:rgba(239,68,68,0.14);border-color:rgba(239,68,68,0.35);color:#f87171;">
          ⏱ Confirmar atraso
        </button>
      </div>
    </div>`;
  document.body.appendChild(div);

  div.addEventListener("click", (e) => { if (e.target === div) div.classList.remove("open"); });
  document.getElementById("btn-close-ps-atrasado").onclick  = () => div.classList.remove("open");
  document.getElementById("btn-cancel-ps-atrasado").onclick = () => div.classList.remove("open");

  document.getElementById("btn-confirm-ps-atrasado").onclick = async () => {
    const nome  = document.getElementById("ps-atrasado-colab").value;
    const campo = document.getElementById("ps-atrasado-campo").value;
    const min   = parseInt(document.getElementById("ps-atrasado-min").value, 10) || 10;
    const obs   = document.getElementById("ps-atrasado-obs").value.trim();

    // Ajusta o horário da pausa somando os minutos de atraso
    const p = getPausaDefault(nome);
    const horarioAtual = p[campo];
    if (horarioAtual) {
      const novoHorario = addMinutes(horarioAtual, min);
      if (!pausas[nome]) pausas[nome] = {};
      pausas[nome][campo] = novoHorario;
      saveLocal();
      if (supa) {
        await supa.from("pausas").upsert(
          { ...getPausaDefault(nome), colaborador_nome: nome, [campo]: novoHorario },
          { onConflict: "colaborador_nome" }
        ).catch(err => console.warn("[ps-atrasado upsert pausas]", err));
      }
    }

    const obsCompleta = obs ? `Atrasado ${min}min — ${obs}` : `Atrasado ${min}min`;
    await setPausaStatus(nome, campo, "atrasada", obsCompleta);

    div.classList.remove("open");
    toast(`⏱ ${nome} atrasado ${min}min. Pausa ajustada e card em destaque.`);
  };
}

// Injeta CSS de status de pausas dinamicamente
(function injetarCSSPausaStatus() {
  if (document.getElementById("css-pausa-status")) return;
  const style = document.createElement("style");
  style.id = "css-pausa-status";
  style.textContent = `
    .ps-action-row {
      display: flex;
      gap: 4px;
      margin-top: 6px;
      flex-wrap: wrap;
    }
    .ps-btn {
      height: 22px;
      padding: 0 8px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--surface2);
      color: var(--muted);
      font-size: 10px;
      font-weight: 800;
      cursor: pointer;
      transition: all .15s;
      font-family: inherit;
      line-height: 1;
      white-space: nowrap;
    }
    .ps-btn:hover { opacity: .8; transform: scale(1.05); }
    .ps-btn-ok {
      background: rgba(74,222,128,.12);
      border-color: rgba(74,222,128,.3);
      color: #4ade80;
    }
    .ps-btn-late {
      background: rgba(239,68,68,.12);
      border-color: rgba(239,68,68,.3);
      color: #f87171;
    }
    .ps-btn-absent {
      background: rgba(148,163,184,.1);
      border-color: rgba(148,163,184,.25);
      color: #94a3b8;
    }
    .ps-slot-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
    }
    .ps-status-label {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: .06em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    /* Confirmado */
    .dash-pausa-slot.ps-confirmada {
      background: rgba(74,222,128,.08) !important;
      border-color: rgba(74,222,128,.3) !important;
    }
    .ps-confirmada .ps-status-label { color: #4ade80; }
    .ps-confirmada .dash-pausa-slot-time { color: #4ade80; }
    /* Atrasado — sobe com borda pulsante vermelha */
    .dash-pausa-slot.ps-atrasada {
      background: rgba(239,68,68,.10) !important;
      border: 1.5px solid rgba(239,68,68,.55) !important;
      animation: ps-pulse-red 1.4s ease-in-out infinite;
      order: -99;
    }
    .ps-atrasada .ps-status-label { color: #f87171; }
    .ps-atrasada .dash-pausa-slot-time { color: #f87171; }
    @keyframes ps-pulse-red {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
      50%       { box-shadow: 0 0 0 5px rgba(239,68,68,.18); }
    }
    /* Ausente */
    .dash-pausa-slot.ps-ausente {
      opacity: .5;
      background: rgba(148,163,184,.06) !important;
    }
    .ps-ausente .ps-status-label { color: #94a3b8; }
    /* Próximo pendente */
    .dash-pausa-slot.ps-pendente-next {
      border-color: rgba(255,193,7,.5) !important;
    }
    /* Card inteiro com pausa atrasada sobe para o topo */
    .dash-pausa-item:has(.ps-atrasada) {
      order: -99;
      border-left: 3px solid #f87171 !important;
      border-radius: 12px;
    }
  `;
  document.head.appendChild(style);
})();

/* ── CSS: Dashboard Folgas & Férias visual ── */
(function injetarCSSDFF() {
  if (document.getElementById('css-dff')) return;
  const s = document.createElement('style');
  s.id = 'css-dff';
  s.textContent = `
    /* Card ocupa 2 colunas no grid */
    .dff-card { grid-column: 1 / -1; }

    /* KPIs compactos */
    .dff-kpis {
      display: flex;
      align-items: center;
      gap: 0;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px;
      padding: 10px 16px;
      margin-bottom: 16px;
    }
    .dff-kpi {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .dff-kpi-num {
      font-size: 22px;
      font-weight: 800;
      line-height: 1;
      font-family: "Outfit", sans-serif;
    }
    .dff-kpi-lbl {
      font-size: 10.5px;
      color: rgba(255,255,255,0.38);
      font-weight: 500;
    }
    .dff-kpi-sep {
      width: 1px;
      height: 36px;
      background: rgba(255,255,255,0.08);
      margin: 0 4px;
    }

    /* Layout das duas seções lado a lado */
    .dff-body {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 20px;
      align-items: start;
    }
    @media (max-width: 900px) { .dff-body { grid-template-columns: 1fr; } }

    /* Título de seção interno */
    .dff-bars-title {
      font-size: 10.5px;
      font-weight: 700;
      color: rgba(255,255,255,0.35);
      text-transform: uppercase;
      letter-spacing: .07em;
      margin-bottom: 10px;
    }

    /* Barras mensais */
    .dff-bars-section { margin-bottom: 16px; }
    .dff-bars-row {
      display: flex;
      gap: 12px;
      align-items: flex-end;
      height: 80px;
      margin-bottom: 6px;
    }
    .dff-bar-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      height: 100%;
      justify-content: flex-end;
    }
    .dff-bar-col.dff-bar-current .dff-bar-label {
      color: rgba(255,255,255,0.75);
      font-weight: 700;
    }
    .dff-bar-stack {
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 1px;
      flex: 1;
    }
    .dff-bar-seg {
      width: 100%;
      border-radius: 3px;
      min-height: 3px;
      transition: height .5s cubic-bezier(.4,0,.2,1);
    }
    .dff-seg-ferias { background: linear-gradient(180deg,#facc15,rgba(250,204,21,.5)); border-radius: 4px 4px 0 0; }
    .dff-seg-folgas { background: linear-gradient(180deg,#63beff,rgba(99,190,255,.5)); border-radius: 0 0 4px 4px; }
    .dff-bar-nums {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      font-size: 9px;
      font-weight: 700;
      line-height: 1;
    }
    .dff-num-ferias { color: #facc15; }
    .dff-num-folgas { color: #63beff; }
    .dff-num-zero   { color: rgba(255,255,255,0.18); }
    .dff-bar-label {
      font-size: 10px;
      color: rgba(255,255,255,0.38);
      font-weight: 600;
    }

    /* Legenda */
    .dff-legend-row {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 10.5px;
      color: rgba(255,255,255,0.38);
    }
    .dff-legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dff-legend-txt { margin-right: 2px; }

    /* Heatmap */
    .dff-heatmap-section { flex: 1; }
    .dff-heatmap {
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-bottom: 6px;
    }
    .dff-heatmap-labels {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 3px;
      margin-bottom: 2px;
    }
    .dff-heatmap-labels span {
      text-align: center;
      font-size: 9px;
      font-weight: 700;
      color: rgba(255,255,255,0.25);
      letter-spacing: .04em;
    }
    .dff-heatmap-row {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 3px;
    }
    .dff-cell {
      aspect-ratio: 1;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: default;
      transition: transform .15s, opacity .15s;
      position: relative;
      min-width: 0;
    }
    .dff-cell:hover { transform: scale(1.18); z-index: 2; opacity: .9; }
    .dff-cell.dff-today {
      outline: 2px solid rgba(255,255,255,0.55);
      outline-offset: -1px;
    }
    .dff-cell-day {
      font-size: 8px;
      color: rgba(255,255,255,0.28);
      font-weight: 600;
      line-height: 1;
      pointer-events: none;
    }
  `;
  document.head.appendChild(s);
})();

/* =====================================================================
   MELHORIAS v2 — Kanban, Calendários, Avisos histórico, Dashboard
   ===================================================================== */

/* ── Sobreescreve renderPendencias para usar Kanban ── */
(function patchRenderPendencias() {
  const _orig = window.renderPendencias ?? renderPendencias;

  function renderKanban() {
    const analise   = pendencias.filter(p => !p.caso_aberto && !p._concluida);
    const comCaso   = pendencias.filter(p => p.caso_aberto  && !p._concluida);
    const concluidas = (window.pendenciasConcluidas || []).slice(0,6);

    function setCol(colId, countId, items, template) {
      const el = document.getElementById(colId);
      const ct = document.getElementById(countId);
      if (!el) return;
      if (ct) ct.textContent = items.length;
      if (!items.length) {
        el.innerHTML = `<div class="kanban-empty">Nenhum item</div>`;
        return;
      }
      el.innerHTML = items.map(template).join('');
    }

    function cardHtml(p, type) {
      const caso = p.caso_aberto ? `<span class="cargo-badge ferias" style="font-size:10px;">Caso ${escapeHtml(p.numero_caso||'aberto')}</span>` : '';
      const btns = type === 'concluida'
        ? ''
        : `<div class="kanban-card-actions">
            ${type === 'analise' ? `<button class="btn btn-small" onclick="moverParaCaso('${p.id}')" style="font-size:10px;color:#facc15;">+ Caso</button>` : ''}
            <button class="btn btn-small" onclick="concluirKanban('${p.id}')" style="font-size:10px;color:#4ade80;">✓ Concluir</button>
            <button class="btn btn-small" onclick="removePendencia('${p.id}')" style="font-size:10px;color:#f87171;">✕</button>
          </div>`;
      return `<div class="kanban-card">
        <div class="kanban-card-title">${escapeHtml(p.cliente)} ${caso}</div>
        <div class="kanban-card-meta">CNPJ ${escapeHtml(p.cnpj)} · Reg. ${escapeHtml(p.registro)}</div>
        <div class="kanban-card-motivo">${escapeHtml(p.motivo)}</div>
        ${btns}
      </div>`;
    }

    setCol('kanban-cards-analise', 'kanban-count-analise', analise, p => cardHtml(p, 'analise'));
    setCol('kanban-cards-caso',    'kanban-count-caso',    comCaso,  p => cardHtml(p, 'caso'));
    setCol('kanban-cards-concluido','kanban-count-concluido', concluidas, p => cardHtml(p, 'concluida'));
  }

  // Expose helpers
  window.moverParaCaso = async (id) => {
    const p = pendencias.find(x => x.id === id);
    if (!p) return;
    p.caso_aberto = true;
    saveLocal();
    renderKanban();
    if (supa) {
      try {
        const { error } = await supa.from('pitstop_pendencias')
          .update({ caso_aberto: true }).eq('id', id);
        if (error) console.warn('[moverParaCaso] Supabase update:', error);
      } catch (err) {
        console.warn('[moverParaCaso] exception:', err);
      }
    }
  };

  window.concluirKanban = async (id) => {
    const p = pendencias.find(x => x.id === id);
    if (!p) return;
    const concluidaEm = new Date().toISOString();
    // Tira da lista de abertas e coloca na lista de concluidas (compartilhada via banco).
    pendencias = pendencias.filter(x => x.id !== id);
    window.pendenciasConcluidas = window.pendenciasConcluidas || [];
    window.pendenciasConcluidas.unshift({ ...p, status: 'concluida', concluida_em: concluidaEm });
    saveLocal();
    renderKanban();
    // Persiste no Supabase: marca como concluida (NAO deleta), para todos verem.
    if (supa) {
      try {
        const { error } = await supa.from('pitstop_pendencias')
          .update({ status: 'concluida', concluida_em: concluidaEm })
          .eq('id', id);
        if (error) console.warn('[concluirKanban] Supabase update:', error);
      } catch (err) {
        console.warn('[concluirKanban] exception:', err);
      }
    }
    toast('Pendência concluída.');
  };

  // Override global renderPendencias if it exists
  if (typeof renderPendencias === 'function') {
    window.removePendencia = async (id) => {
      pendencias = pendencias.filter(p => p.id !== id);
      saveLocal();
      renderKanban();
      // Persiste a remocao no Supabase tambem.
      if (supa) {
        try {
          const { error } = await supa.from('pitstop_pendencias').delete().eq('id', id);
          if (error) console.warn('[removePendencia] Supabase delete:', error);
        } catch (err) {
          console.warn('[removePendencia] exception:', err);
        }
      }
      toast('Pendência removida.');
    };
  }

  window.renderPendencias = renderKanban;

  // Hook btn-show/hide-pendencia-form
  const btnShow = document.getElementById('btn-show-pendencia-form');
  const btnHide = document.getElementById('btn-hide-pendencia-form');
  const formCard = document.getElementById('pendencia-form-card');
  if (btnShow && formCard) {
    btnShow.onclick = () => { formCard.style.display = ''; };
  }
  if (btnHide && formCard) {
    btnHide.onclick = () => { formCard.style.display = 'none'; };
  }

  // Run once
  setTimeout(renderKanban, 200);
})();

/* ── Calendário de Folgas (mês atual) ── */
function renderFolgasCalendar() {
  const wrap = document.getElementById('folgas-calendar-view');
  if (!wrap) return;

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const hoje  = new Date();
  const ano   = hoje.getFullYear();
  const mesAtual = hoje.getMonth();

  // Map mês -> [{ nome, dia }]
  const folgasPorMes = {};
  for (let i = 0; i < 12; i++) folgasPorMes[i] = [];

  (folgas || []).forEach(f => {
    const info = typeof getFolgaInfo === 'function' ? getFolgaInfo(f) : null;
    if (!info || info.tipo === 'ferias') return;
    const nome = f.colaborador_nome || f.colaborador || '?';
    const d = new Date((info.dataInicio || '') + 'T12:00:00');
    if (d.getFullYear() === ano) {
      const fmtD = dt => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
      folgasPorMes[d.getMonth()].push({ nome, dia: fmtD(d) });
    }
  });

  const months = MESES.map((nomeMes, i) => {
    const items = folgasPorMes[i];
    const isCurrent = i === mesAtual;
    const people = items.length
      ? items.map(it => {
          const ini = (typeof initials === 'function') ? initials(it.nome) : it.nome.slice(0,2).toUpperCase();
          return `<div class="ferias-person-pill folga-person-pill">
            <div class="ferias-person-avatar folga-person-avatar">${ini}</div>
            <span class="ferias-person-name">${escapeHtml(it.nome)}</span>
            <span class="ferias-person-period">${it.dia}</span>
          </div>`;
        }).join('')
      : `<div class="ferias-month-empty">Sem folgas</div>`;

    return `<div class="ferias-month-card${isCurrent ? ' current-month' : ''}">
      <div class="ferias-month-title">${nomeMes}</div>
      <div class="ferias-month-people">${people}</div>
    </div>`;
  }).join('');

  wrap.innerHTML = `<div class="ferias-months-grid">${months}</div>`;
}
/* ── Calendário de Férias (anual) ── */
function renderFeriasCalendar() {
  const wrap = document.getElementById('ferias-calendar-view');
  if (!wrap) return;

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const hoje  = new Date();
  const ano   = hoje.getFullYear();
  const mesFolgas = hoje.getMonth();

  // Build map mes -> [{nome, inicio, fim}]
  const feriasPorMes = {};
  for (let i = 0; i < 12; i++) feriasPorMes[i] = [];

  (folgas || []).forEach(f => {
    const info = typeof getFolgaInfo === 'function' ? getFolgaInfo(f) : null;
    if (!info || info.tipo !== 'ferias') return;
    const nome  = f.colaborador_nome || f.colaborador || '?';
    const start = new Date((info.dataInicio || '') + 'T12:00:00');
    const end   = new Date((info.dataFim    || info.dataInicio || '') + 'T12:00:00');
    // Add to every month spanning
    for (let m = 0; m < 12; m++) {
      const mStart = new Date(ano, m, 1);
      const mEnd   = new Date(ano, m + 1, 0);
      if (start <= mEnd && end >= mStart && start.getFullYear() <= ano && end.getFullYear() >= ano) {
        // format period
        const fmtD = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
        feriasPorMes[m].push({ nome, period: `${fmtD(start)} - ${fmtD(end)}` });
      }
    }
  });

  const months = MESES.map((nomeMes, i) => {
    const items = feriasPorMes[i];
    const isCurrent = i === mesFolgas;
    const people = items.length
      ? items.map(it => {
          const ini = (typeof initials === 'function') ? initials(it.nome) : it.nome.slice(0,2).toUpperCase();
          return `<div class="ferias-person-pill">
            <div class="ferias-person-avatar">${ini}</div>
            <span class="ferias-person-name">${escapeHtml(it.nome)}</span>
            <span class="ferias-person-period">${it.period}</span>
          </div>`;
        }).join('')
      : `<div class="ferias-month-empty">Sem férias</div>`;

    return `<div class="ferias-month-card${isCurrent ? ' current-month' : ''}">
      <div class="ferias-month-title">${nomeMes}</div>
      <div class="ferias-month-people">${people}</div>
    </div>`;
  }).join('');

  wrap.innerHTML = `<div class="ferias-months-grid">${months}</div>`;
}

/* ── Patch renderFolgas para chamar calendários ── */
const _origRenderFolgas = typeof renderFolgas === 'function' ? renderFolgas : null;
window.renderFolgas = function() {
  if (_origRenderFolgas) _origRenderFolgas();
  setTimeout(() => {
    renderFolgasCalendar();
    renderFeriasCalendar();
  }, 50);
};

/* ── Avisos — histórico ── */
(function patchAvisos() {
  function getAvisosHist() {
    return JSON.parse(localStorage.getItem('pitstop_avisos_hist') || '[]');
  }
  function saveAvisoHist(entry) {
    const hist = getAvisosHist();
    hist.unshift(entry);
    localStorage.setItem('pitstop_avisos_hist', JSON.stringify(hist.slice(0, 30)));
    renderAvisosHist();
  }
  function renderAvisosHist() {
    const el = document.getElementById('avisos-historico-list');
    if (!el) return;
    const hist = getAvisosHist();
    if (!hist.length) {
      el.innerHTML = `<div class="empty-state empty-state-compact"><div class="empty-icon">📢</div><strong>Nenhum aviso enviado ainda</strong><small>Os avisos disparados aparecerão aqui</small></div>`;
      return;
    }
    el.innerHTML = hist.map(a => {
      const t = new Date(a.ts);
      const timeStr = t.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      return `<div class="aviso-hist-item">
        <div class="aviso-hist-header">
          <span class="aviso-hist-titulo">${escapeHtml(a.titulo || 'Sem título')}</span>
          <span class="aviso-hist-canal">#${escapeHtml(a.canal)}</span>
        </div>
        <span class="aviso-hist-grupo">→ ${escapeHtml(a.grupo)} · ${a.total || '?'} destinatário(s)</span>
        <span class="aviso-hist-time">${timeStr}</span>
      </div>`;
    }).join('');
  }

  // Hook btn-send-aviso
  const origBtn = document.getElementById('btn-send-aviso');
  if (origBtn) {
    origBtn.addEventListener('click', function handler() {
      setTimeout(() => {
        const canal  = document.getElementById('aviso-canal')?.value || '';
        const titulo = document.getElementById('aviso-titulo')?.value || '';
        const grupo  = document.querySelector('input[name="grupo-aviso"]:checked')?.value || 'todos';
        saveAvisoHist({ canal, titulo, grupo, ts: new Date().toISOString(), total: null });
      }, 500);
    }, { capture: true });
  }

  // Clear hist
  const btnClear = document.getElementById('btn-clear-avisos-hist');
  if (btnClear) {
    btnClear.onclick = () => {
      localStorage.removeItem('pitstop_avisos_hist');
      renderAvisosHist();
    };
  }

  window.renderAvisosHist = renderAvisosHist;
  setTimeout(renderAvisosHist, 300);
})();

/* ── Dashboard — gráficos de pizza (SVG) ── */
/* REMOVIDO: substituído pelo dashboard-charts.js (dc-dashboard-charts) */
(function patchDashCharts() {
  // Patch renderDash para manter aniversários melhorados
  // Os gráficos/cards são gerados pelo dashboard-charts.js
  const _origRenderDash = typeof renderDash === 'function' ? renderDash : null;
  window.renderDash = function() {
    if (_origRenderDash) _origRenderDash();
    renderDashAniversariosImproved();
    // dashboard-charts.js cuida dos demais cards via DC_refreshDashboard
    if (typeof window.DC_refreshDashboard === 'function') window.DC_refreshDashboard();
  };
})();


/* ── Dashboard — aniversários melhorados ── */
function renderDashAniversariosImproved() {
  const el = document.getElementById('dash-aniversarios');
  if (!el) return;
  const hoje = new Date();
  const hojeZ = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const proximos = colaboradores
    .filter(c => c.aniversario_mes && c.aniversario_dia)
    .map(c => {
      const prox = typeof proximoAniversario === 'function' ? proximoAniversario(c.aniversario_mes, c.aniversario_dia) : new Date();
      const dias = Math.round((prox - hojeZ) / (1000 * 60 * 60 * 24));
      return { ...c, dias };
    })
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 6);

  if (!proximos.length) return;

  const isGest = c => c.cargo === 'Gestão Pit Stop';
  el.innerHTML = `<div class="dash-aniv-list">` + proximos.map(c => {
    const ini = typeof initials === 'function' ? initials(c.nome) : c.nome.slice(0,2).toUpperCase();
    const dStr = String(c.aniversario_dia).padStart(2,'0');
    const mStr = String(c.aniversario_mes).padStart(2,'0');
    let badgeClass, badgeText;
    if (c.dias === 0) { badgeClass = 'hoje'; badgeText = '🎉 Hoje!'; }
    else if (c.dias <= 7) { badgeClass = 'breve'; badgeText = `em ${c.dias}d`; }
    else { badgeClass = 'normal'; badgeText = `${dStr}/${mStr}`; }
    const g = isGest(c);
    return `<div class="dash-aniv-item">
      <div class="dash-aniv-avatar${g?' gestao-av':''}">${ini}</div>
      <div class="dash-aniv-info">
        <div class="dash-aniv-name">${escapeHtml(c.nome)}</div>
        <div class="dash-aniv-cargo">${g ? 'Gestão' : 'Técnico'}</div>
      </div>
      <span class="dash-aniv-badge ${badgeClass}">${badgeText}</span>
    </div>`;
  }).join('') + `</div>`;
}

/* ── Aniversários — calendário anual ── */
(function patchAniversarios() {
  const _origRenderAniv = typeof renderAniversarios === 'function' ? renderAniversarios : null;
  window.renderAniversarios = function() {
    if (_origRenderAniv) _origRenderAniv();
    renderAnivCalendar();
  };

  function renderAnivCalendar() {
    const list = document.getElementById('aniversarios-list');
    if (!list) return;
    if (document.getElementById('aniv-cal-main')) return;

    const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const mesAtual = new Date().getMonth();

    // Build map mes (0-11) -> [{dia, nome, cargo}]
    const map = {};
    for (let i = 0; i < 12; i++) map[i] = [];
    colaboradores.filter(c => c.aniversario_mes && c.aniversario_dia).forEach(c => {
      const m = c.aniversario_mes - 1;
      if (m >= 0 && m < 12) map[m].push({ dia: c.aniversario_dia, nome: c.nome, cargo: c.cargo });
    });
    for (let m = 0; m < 12; m++) map[m].sort((a,b) => a.dia - b.dia);

    const calDiv = document.createElement('div');
    calDiv.id = 'aniv-cal-main';
    calDiv.className = 'bday-cal-wrap';
    calDiv.innerHTML = `<div class="bday-cal-grid">` +
      MESES.map((nomeMes, i) => {
        const isCur = i === mesAtual;
        const entries = map[i].map(p => {
          const ini = typeof initials === 'function' ? initials(p.nome) : p.nome.slice(0,2).toUpperCase();
          const g = p.cargo === 'Gestão Pit Stop';
          return `<div class="bday-person-entry">
            <span class="bday-person-day">${String(p.dia).padStart(2,'0')}</span>
            <span class="bday-person-name-sm">${escapeHtml(p.nome)}</span>
            <span class="bday-person-cargo-sm cargo-badge ${g ? 'gestao' : 'tecnico'}">${g ? 'G' : 'T'}</span>
          </div>`;
        }).join('') || `<div class="bday-month-empty-sm">—</div>`;
        return `<div class="bday-cal-month${isCur ? ' current-month' : ''}">
          <div class="bday-cal-month-title">${nomeMes}</div>
          ${entries}
        </div>`;
      }).join('')
    + `</div>`;

    // Insert before the birthday-grid
    const bdayMain = document.querySelector('.bday-main-card');
    if (bdayMain) {
      bdayMain.parentNode.insertBefore(calDiv, bdayMain);
      // Oculta o grid de cards abaixo — o calendário já mostra tudo
      bdayMain.style.display = 'none';
    } else {
      list.parentNode.insertBefore(calDiv, list.parentNode.firstChild);
    }
  }

  setTimeout(renderAnivCalendar, 400);
})();

/* ── Run calendários on tab switch ── */
document.querySelectorAll('.tab[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab === 'folgas')   setTimeout(renderFolgasCalendar, 100);
    if (tab === 'ferias')   setTimeout(renderFeriasCalendar, 100);
    if (tab === 'avisos')   setTimeout(() => { if(window.renderAvisosHist) window.renderAvisosHist(); }, 100);
    if (tab === 'pendencias') setTimeout(() => { if(window.renderPendencias) window.renderPendencias(); }, 100);
    if (tab === 'aniversarios') setTimeout(() => { if(typeof renderAniversarios === 'function') renderAniversarios(); }, 100);
    if (tab === 'relatorios') setTimeout(() => iniciarRelatorios(), 80);
  });
});

/* ==========================================================================
   21. Relatórios — acompanhamento de ausências por período
   ========================================================================== */

/**
 * Inicializa os controles da aba de relatórios na primeira abertura.
 * Preenche o select de colaboradores e define o período padrão (mês atual).
 */
let _relatoriosIniciado = false;
function iniciarRelatorios() {
  if (!_relatoriosIniciado) {
    _relatoriosIniciado = true;

    // Período padrão: mês atual
    const hoje = new Date();
    const priDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const ultDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
    document.getElementById('rel-de').value  = priDia;
    document.getElementById('rel-ate').value = ultDia;

    // Preenche select de colaboradores
    const sel = document.getElementById('rel-colab');
    sel.innerHTML = '<option value="">Todos</option>';
    [...colaboradores]
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.nome;
        opt.textContent = c.nome;
        sel.appendChild(opt);
      });

    document.getElementById('btn-rel-gerar').onclick    = gerarRelatorio;
    document.getElementById('btn-rel-exportar').onclick = exportarRelatorioCSV;
  }
  gerarRelatorio();
}

/**
 * Computa e renderiza o relatório de ausências para o período/colaborador selecionados.
 */
function gerarRelatorio() {
  const de   = document.getElementById('rel-de').value;
  const ate  = document.getElementById('rel-ate').value;
  const filtroColab = document.getElementById('rel-colab').value;

  if (!de || !ate) { toast('Selecione o período.'); return; }
  if (de > ate)    { toast('Data inicial maior que a final.'); return; }

  const deDate  = new Date(de  + 'T00:00:00');
  const ateDate = new Date(ate + 'T23:59:59');

  /** Conta quantos dias de um intervalo [inicio, fim] (ISO strings) caem dentro de [de, ate] */
  function diasNoIntervalo(inicio, fim) {
    if (!inicio) return 0;
    const s = new Date(Math.max(new Date(inicio + 'T00:00:00'), deDate));
    const e = new Date(Math.min(fim ? new Date(fim + 'T23:59:59') : ateDate, ateDate));
    if (s > e) return 0;
    return Math.round((e - s) / 86400000) + 1;
  }

  const lista = colaboradores
    .filter(c => !filtroColab || c.nome === filtroColab)
    .map(c => {
      // Folgas no período (cada registro = 1 dia)
      const qtdFolgas = folgas.filter(f => {
        if (f.nome !== c.nome) return false;
        if (f.tipo === 'ferias') return false;
        const d = f.data_folga || f.data;
        return d >= de && d <= ate;
      }).length;

      // Férias: dias que caem no período
      const diasFerias = folgas
        .filter(f => f.nome === c.nome && f.tipo === 'ferias')
        .reduce((acc, f) => acc + diasNoIntervalo(f.data_folga || f.data, f.data_fim), 0);

      // Atestado: se tiver registro, conta dias no período
      const at = atestados[c.nome];
      let diasAtestado = 0;
      if (at?.dias && at?.dataInicio) {
        const fimAt = new Date(at.dataInicio + 'T12:00:00');
        fimAt.setDate(fimAt.getDate() + at.dias - 1);
        diasAtestado = diasNoIntervalo(at.dataInicio, fimAt.toISOString().split('T')[0]);
      }

      const total = qtdFolgas + diasFerias + diasAtestado;

      // Status atual
      const f = getFlagDefault(c.nome);
      let statusHoje = '—';
      let statusCor  = 'var(--text-muted,#888)';
      if (f.ferias)   { statusHoje = '🌴 Férias';   statusCor = '#34d399'; }
      if (f.atestado) { statusHoje = '🩺 Atestado'; statusCor = '#f59e0b'; }
      if (f.off)      { statusHoje = '🔴 Day off';  statusCor = '#f87171'; }
      if (!f.ferias && !f.atestado && !f.off) { statusHoje = '✅ Presente'; statusCor = '#4ade80'; }

      return { nome: c.nome, cargo: c.cargo, qtdFolgas, diasFerias, diasAtestado, total, statusHoje, statusCor };
    })
    .sort((a, b) => b.total - a.total);

  // ── Resumo cards ──
  const totFolgas   = lista.reduce((s, r) => s + r.qtdFolgas, 0);
  const totFerias   = lista.reduce((s, r) => s + r.diasFerias, 0);
  const totAtestado = lista.reduce((s, r) => s + r.diasAtestado, 0);
  const ausHoje     = colaboradores.filter(c => {
    const f = getFlagDefault(c.nome);
    return f.off || f.ferias || f.atestado;
  }).length;

  const resumoEl = document.getElementById('rel-resumo');
  resumoEl.innerHTML = [
    { icon: '📅', label: 'Folgas no período',    valor: totFolgas,   cor: '#60a5fa' },
    { icon: '🌴', label: 'Dias de férias',        valor: totFerias,   cor: '#34d399' },
    { icon: '🩺', label: 'Dias de atestado',      valor: totAtestado, cor: '#f59e0b' },
    { icon: '⛔', label: 'Ausentes hoje',         valor: ausHoje,     cor: '#f87171' },
    { icon: '👥', label: 'Colaboradores filtrados', valor: lista.length, cor: '#a78bfa' },
  ].map(c => `
    <div class="card" style="padding:14px 16px;text-align:center;border-top:3px solid ${c.cor}40;">
      <div style="font-size:22px;margin-bottom:4px;">${c.icon}</div>
      <div style="font-size:22px;font-weight:800;color:${c.cor};">${c.valor}</div>
      <div style="font-size:11px;opacity:.6;margin-top:2px;">${c.label}</div>
    </div>`).join('');

  // ── Tabela ──
  const badge = document.getElementById('rel-total-badge');
  badge.textContent = `${lista.length} colaborador${lista.length !== 1 ? 'es' : ''}`;

  const tbody = document.getElementById('rel-tbody');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;opacity:.5;">Nenhum resultado para o período.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map((r, i) => `
    <tr style="border-bottom:1px solid var(--border,#2a2a3a);${i % 2 === 1 ? 'background:rgba(255,255,255,.02);' : ''}">
      <td style="padding:11px 16px;">
        <div style="font-weight:600;font-size:13px;">${r.nome}</div>
        <div style="font-size:11px;opacity:.5;">${r.cargo || ''}</div>
      </td>
      <td style="padding:11px 12px;text-align:center;">
        ${r.qtdFolgas > 0 ? `<span style="font-weight:600;color:#60a5fa;">${r.qtdFolgas}</span>` : `<span style="opacity:.3;">—</span>`}
      </td>
      <td style="padding:11px 12px;text-align:center;">
        ${r.diasFerias > 0 ? `<span style="font-weight:600;color:#34d399;">${r.diasFerias}</span>` : `<span style="opacity:.3;">—</span>`}
      </td>
      <td style="padding:11px 12px;text-align:center;">
        ${r.diasAtestado > 0 ? `<span style="font-weight:600;color:#f59e0b;">${r.diasAtestado}</span>` : `<span style="opacity:.3;">—</span>`}
      </td>
      <td style="padding:11px 12px;text-align:center;">
        ${r.total > 0
          ? `<span style="font-weight:700;background:rgba(255,255,255,.06);border-radius:20px;padding:2px 10px;">${r.total}</span>`
          : `<span style="opacity:.3;">0</span>`}
      </td>
      <td style="padding:11px 12px;text-align:center;">
        <span style="font-size:12px;font-weight:600;color:${r.statusCor};">${r.statusHoje}</span>
      </td>
    </tr>`).join('');

  // Guarda para exportação
  window._relatorioCache = { de, ate, lista };
}
/**
 * Exporta o relatório atual como XLSX (Excel).
 */
function exportarRelatorioCSV() {
  const cache = window._relatorioCache;
  if (!cache?.lista?.length) { toast('Gere um relatório antes de exportar.'); return; }

  const linhas = [
    ['Colaborador', 'Cargo', 'Folgas', 'Dias Férias', 'Dias Atestado', 'Total Ausências', 'Status Hoje'],
    ...cache.lista.map(r => [
      r.nome,
      r.cargo || '',
      r.qtdFolgas,
      r.diasFerias,
      r.diasAtestado,
      r.total,
      r.statusHoje.replace(/[^\w\s]/g, '').trim(),
    ]),
  ];

  // Cria planilha com SheetJS
  const ws = XLSX.utils.aoa_to_sheet(linhas);

  // Largura automática das colunas
  const colWidths = linhas[0].map((_, ci) => ({
    wch: Math.max(...linhas.map(row => String(row[ci] ?? '').length)) + 2,
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');

  XLSX.writeFile(wb, `relatorio-ausencias_${cache.de}_${cache.ate}.xlsx`);
  toast('Excel exportado com sucesso!');
}
