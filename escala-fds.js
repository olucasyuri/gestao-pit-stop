/* ==========================================================================
   Escala FDS — Gestão PIT STOP  (v2)
   Melhorias:
   • Até 20 registros fixos por coluna (sem crescimento dinâmico)
   • Todos os campos acima de PIT STOP / BLIP / ESPECIALISTAS são editáveis
   • Formatação de cópia reorganizada em blocos por seção (Discord-friendly)
   • Persistência no Supabase (tabela fds_escalas) com fallback para localStorage
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     1. Constantes
  ------------------------------------------------------------------ */
  const MAX_ROWS     = 20;
  const KEY_DIARIA   = "pitstop_fds_diaria_v2";
  const KEY_MENSAL   = "pitstop_fds_mensal_v2";
  const KEY_META     = "pitstop_fds_meta_v2";
  const SUPA_TABLE   = "fds_escalas";

  const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  const COLS_DIARIA = ["pitstop","blip","especialistas","tarde","off"];

  /* ------------------------------------------------------------------
     2. Estado
  ------------------------------------------------------------------ */
  let estadoDiario = null;
  let estadoMensal = null;
  let estadoMeta   = null;
  let _syncTimer   = null;

  /* ------------------------------------------------------------------
     3. Supabase helpers
  ------------------------------------------------------------------ */
  function getSupa() {
    return (typeof supa !== "undefined" && supa) ? supa : null;
  }

  /**
   * Salva tudo localmente e agenda sync com Supabase (debounce 1.5s).
   */
  function salvarTudo() {
    localStorage.setItem(KEY_DIARIA, JSON.stringify(estadoDiario));
    localStorage.setItem(KEY_MENSAL, JSON.stringify(estadoMensal));
    localStorage.setItem(KEY_META,   JSON.stringify(estadoMeta));
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(sincronizarSupabase, 1500);
  }

  async function sincronizarSupabase() {
    const db = getSupa();
    if (!db) return;

    // Chave única por data + mês + ano
    const chave = `fds_${estadoMeta.mes}_${estadoMeta.ano}_${(estadoMeta.data || "xx").replace("/","")}`;

    const payload = {
      id:       chave,
      meta:     estadoMeta,
      diario:   estadoDiario,
      mensal:   estadoMensal,
      atualizado_em: new Date().toISOString(),
    };

    try {
      const { error } = await db
        .from(SUPA_TABLE)
        .upsert(payload, { onConflict: "id" });

      if (error) throw error;
      mostrarIndicadorSync("✓ Salvo");
    } catch (e) {
      console.warn("[FDS] Supabase sync falhou:", e.message);
      mostrarIndicadorSync("⚠ Offline");
    }
  }

  async function carregarDoSupabase(chave) {
    const db = getSupa();
    if (!db) return false;

    try {
      const { data, error } = await db
        .from(SUPA_TABLE)
        .select("meta,diario,mensal")
        .eq("id", chave)
        .single();

      if (error || !data) return false;

      estadoMeta   = data.meta   || estadoMeta;
      estadoDiario = data.diario || estadoDiario;
      estadoMensal = data.mensal || estadoMensal;

      // Garante estrutura dos arrays
      normalizarEstado();
      return true;
    } catch {
      return false;
    }
  }

  function mostrarIndicadorSync(msg) {
    const el = document.getElementById("fds-sync-status");
    if (!el) return;
    el.textContent = msg;
    el.style.opacity = "1";
    setTimeout(() => { el.style.opacity = "0"; }, 3000);
  }

  /* ------------------------------------------------------------------
     4. Carga inicial
  ------------------------------------------------------------------ */
  function carregarTudo() {
    const now = new Date();

    estadoMeta = JSON.parse(localStorage.getItem(KEY_META)) ?? {
      data:            "",
      // Linha de cabeçalho col A
      label_pitstop:   "",
      // Linha de cabeçalho col B
      label_blip:      "",
      // Linha de cabeçalho col C
      label_n1pitstop: "",
      // Linha de cabeçalho col D
      label_n1chat:    "",
      // Linha de cabeçalho col E
      label_esp:       "",
      // Campo agenda: quem da agenda está presente no dia
      agenda:          "",
      // Rótulos das colunas (linha abaixo do cabeçalho)
      col_pitstop:     "PIT STOP",
      col_blip:        "BLIP",
      col_esp:         "ESPECIALISTAS",
      col_tarde:       "TARDE",
      col_off:         "OFF",
      mes:             now.getMonth() + 1,
      ano:             now.getFullYear(),
    };

    estadoDiario = JSON.parse(localStorage.getItem(KEY_DIARIA)) ?? {
      pitstop:      [],
      blip:         [],
      especialistas:[],
      tarde:        [],
      off:          [],
    };

    estadoMensal = JSON.parse(localStorage.getItem(KEY_MENSAL)) ?? {
      sabados:       [],
      linha_home:    [],
      blip_tarde:    [],
      especialistas: [],
    };

    normalizarEstado();
  }

  function normalizarEstado() {
    // Garante exatamente MAX_ROWS células em cada coluna
    COLS_DIARIA.forEach(k => {
      if (!Array.isArray(estadoDiario[k])) estadoDiario[k] = [];
      while (estadoDiario[k].length < MAX_ROWS)
        estadoDiario[k].push({ valor: "", tipo: "normal" });
      estadoDiario[k] = estadoDiario[k].slice(0, MAX_ROWS);
    });

    // Garante chaves de meta novas para instalações antigas
    const metaDef = {
      label_pitstop: "", label_blip: "AGENDA / BLIP",
      label_n1pitstop: "", label_n1chat: "", label_esp: "",
      agenda: "",
      col_pitstop: "PIT STOP", col_blip: "BLIP",
      col_esp: "ESPECIALISTAS", col_tarde: "TARDE", col_off: "OFF",
    };
    Object.entries(metaDef).forEach(([k, v]) => {
      if (estadoMeta[k] === undefined) estadoMeta[k] = v;
    });
  }

  /* ------------------------------------------------------------------
     5. Helpers DOM
  ------------------------------------------------------------------ */
  function el(id)  { return document.getElementById(id); }
  function esc(s)  {
    return String(s ?? "").replace(/[&<>"']/g, c =>
      ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":'&#39;'}[c]));
  }

  function toastFDS(msg) {
    if (typeof toast === "function") { toast(msg); return; }
    const t = el("toast");
    if (!t) return;
    t.textContent = msg;
    t.className   = "toast-show";
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.className = "", 3200);
  }

  /* ------------------------------------------------------------------
     6. Render — Tabela Diária
  ------------------------------------------------------------------ */
  function renderDiaria() {
    const wrapper = el("fds-tabela-diaria");
    if (!wrapper) return;

    const d = estadoDiario;
    const m = estadoMeta;

    /* ── Indicador de sync ── */
    let html = `
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:6px;min-height:18px;">
      <span id="fds-sync-status" style="font-size:11px;color:var(--muted);opacity:0;transition:opacity 0.4s;"></span>
      ${getSupa() ? '<span style="font-size:10px;color:var(--muted);display:flex;align-items:center;gap:4px;">&#x2601; Supabase</span>' : '<span style="font-size:10px;color:var(--muted);">&#128197; Local</span>'}
    </div>
    <div class="fds-table-scroll">
      <table class="fds-table">
        <thead>
          <!-- Linha 1: título + data -->
          <tr class="fds-header-row-top">
            <th colspan="5" class="fds-title-cell">
              <span class="fds-title-badge">📅 ESCALA FDS</span>
              <input class="fds-meta-input" id="fds-meta-data" type="text"
                placeholder="Ex: 31/05" value="${esc(m.data)}"
                style="width:72px;font-weight:700;font-size:15px;" title="Data do sábado">
            </th>
          </tr>
          <!-- Linha 2: responsáveis (todos editáveis) -->
          <tr class="fds-header-row-secondary">
            <th>
              <input class="fds-meta-input" id="fds-meta-label-pitstop" type="text"
                placeholder="Gestão Pit Stop" value="${esc(m.label_pitstop)}"
                title="Responsável N1 Pit Stop">
            </th>
            <th>
              <input class="fds-meta-input" id="fds-meta-label-blip" type="text"
                placeholder="Gestão Chat" value="${esc(m.label_blip)}"
                title="Responsável N1 Chat">
            </th>
            <th>
              <input class="fds-meta-input" id="fds-meta-label-n1pitstop" type="text"
                placeholder="Gestão Especialistas" value="${esc(m.label_n1pitstop)}"
                title="Especialistas">
            </th>
            <th>
              <input class="fds-meta-input" id="fds-meta-label-n1chat" type="text"
                placeholder="Gestão Plantão" value="${esc(m.label_n1chat)}"
                title="Gestor Plantão">
            </th>
            <th>
              <input class="fds-meta-input" id="fds-meta-label-esp" type="text"
                placeholder="" value="${esc(m.label_esp)}"
                title="">
            </th>
          </tr>
          <!-- Linha 2b: campo Agenda -->
          <tr class="fds-header-row-secondary" style="background:rgba(245,200,66,0.05);border-top:1px solid rgba(245,200,66,0.15);">
            <th colspan="5" style="padding:6px 10px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.05em;white-space:nowrap;">📋 AGENDA:</span>
                <input class="fds-meta-input" id="fds-meta-agenda" type="text"
                  placeholder="Ex: FERNANDA, ZENAIDE, JANNEKELI — quem da agenda está presente no dia"
                  value="${esc(m.agenda)}"
                  style="flex:1;"
                  title="Quem da agenda está presente no dia">
              </div>
            </th>
          </tr>
          <!-- Linha 3: nomes das colunas (editáveis) -->
          <tr class="fds-header-cols">
            <th><input class="fds-col-label-input" id="fds-col-pitstop" type="text"
              value="${esc(m.col_pitstop)}" placeholder="PIT STOP"></th>
            <th><input class="fds-col-label-input" id="fds-col-blip" type="text"
              value="${esc(m.col_blip)}" placeholder="BLIP"></th>
            <th><input class="fds-col-label-input" id="fds-col-esp" type="text"
              value="${esc(m.col_esp)}" placeholder="ESPECIALISTAS"></th>
            <th><input class="fds-col-label-input" id="fds-col-tarde" type="text"
              value="${esc(m.col_tarde)}" placeholder="TARDE"></th>
            <th><input class="fds-col-label-input" id="fds-col-off" type="text"
              value="${esc(m.col_off)}" placeholder="OFF"></th>
          </tr>
        </thead>
        <tbody id="fds-tbody-diaria">
    `;

    for (let i = 0; i < MAX_ROWS; i++) {
      html += `<tr class="fds-data-row" data-row="${i}">`;
      COLS_DIARIA.forEach(col => {
        const cell   = d[col][i] ?? { valor: "", tipo: "normal" };
        const isRed  = cell.tipo === "vermelho";
        const isBold = cell.tipo === "negrito";
        const isHdr  = cell.tipo === "header";
        html += `
          <td class="fds-cell fds-cell-${col} ${isHdr ? "fds-cell-header" : ""}"
              data-col="${col}" data-row="${i}">
            <div class="fds-cell-inner">
              <input type="text"
                class="fds-cell-input${isRed?" fds-red":""}${isBold?" fds-bold":""}${isHdr?" fds-header-cell-input":""}"
                value="${esc(cell.valor)}"
                placeholder="${i === 0 ? "Digite..." : ""}"
                data-col="${col}" data-row="${i}"
              >
              <button type="button" class="fds-cell-menu-btn" data-col="${col}" data-row="${i}" title="Opções">⋮</button>
            </div>
          </td>`;
      });
      html += `</tr>`;
    }

    html += `</tbody></table></div>
    <div style="margin-top:6px;text-align:right;font-size:11px;color:var(--muted);">
      ${MAX_ROWS} linhas disponíveis por coluna
    </div>`;

    wrapper.innerHTML = html;
    bindDiariaInputs(wrapper);
  }

  function bindDiariaInputs(wrapper) {
    /* Meta linha 1 e 2 */
    const metaMap = {
      "fds-meta-data":           "data",
      "fds-meta-label-pitstop":  "label_pitstop",
      "fds-meta-label-blip":     "label_blip",
      "fds-meta-label-n1pitstop":"label_especialista",
      "fds-meta-label-n1chat":   "label_n1chat",
      "fds-meta-label-esp":      "label_esp",
      "fds-meta-agenda":         "agenda",
      "fds-col-pitstop":         "col_pitstop",
      "fds-col-blip":            "col_blip",
      "fds-col-esp":             "col_esp",
      "fds-col-tarde":           "col_tarde",
      "fds-col-off":             "col_off",
    };
    Object.entries(metaMap).forEach(([id, key]) => {
      const inp = el(id);
      if (inp) inp.oninput = () => { estadoMeta[key] = inp.value; salvarTudo(); };
    });

    /* Inputs de célula */
    wrapper.querySelectorAll(".fds-cell-input").forEach(inp => {
      inp.oninput = () => {
        const col = inp.dataset.col;
        const row = parseInt(inp.dataset.row);
        estadoDiario[col][row].valor = inp.value;
        salvarTudo();
      };
      inp.onkeydown = (e) => {
        if (e.key !== "Tab" && e.key !== "Enter") return;
        e.preventDefault();
        const col = inp.dataset.col;
        const row = parseInt(inp.dataset.row);
        const ci  = COLS_DIARIA.indexOf(col);
        let nextCol, nextRow;
        if (e.key === "Enter" || ci === COLS_DIARIA.length - 1) {
          nextCol = COLS_DIARIA[0];
          nextRow = Math.min(row + 1, MAX_ROWS - 1);
        } else {
          nextCol = COLS_DIARIA[ci + 1];
          nextRow = row;
        }
        const next = wrapper.querySelector(
          `.fds-cell-input[data-col="${nextCol}"][data-row="${nextRow}"]`
        );
        if (next) next.focus();
      };
    });

    /* Botões de menu de célula */
    wrapper.querySelectorAll(".fds-cell-menu-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        abrirMenuCelula(btn.dataset.col, parseInt(btn.dataset.row), btn);
      };
    });
  }

  /* ------------------------------------------------------------------
     7. Menu de opções de célula
  ------------------------------------------------------------------ */
  let menuAtivo = null;

  function abrirMenuCelula(col, row, anchor) {
    fecharMenuAtivo();
    const menu = document.createElement("div");
    menu.className = "fds-cell-ctx-menu";
    menu.innerHTML = `
      <button type="button" class="fds-ctx-opt" data-acao="vermelho">🔴 Vermelho</button>
      <button type="button" class="fds-ctx-opt" data-acao="negrito">⬛ Negrito</button>
      <button type="button" class="fds-ctx-opt" data-acao="normal">⬜ Normal</button>
      <div class="fds-ctx-sep"></div>
      <button type="button" class="fds-ctx-opt fds-ctx-del" data-acao="limpar">🗑 Limpar</button>
    `;
    const rect = anchor.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top  = (rect.bottom + 4) + "px";
    menu.style.left = Math.max(0, rect.left - 60) + "px";
    document.body.appendChild(menu);
    menuAtivo = menu;

    menu.querySelectorAll(".fds-ctx-opt").forEach(opt => {
      opt.onclick = () => {
        const acao = opt.dataset.acao;
        const cell = estadoDiario[col]?.[row];
        if (!cell) return;
        if (acao === "limpar") { cell.valor = ""; cell.tipo = "normal"; }
        else cell.tipo = acao;
        salvarTudo();
        renderDiaria();
        fecharMenuAtivo();
      };
    });

    setTimeout(() => document.addEventListener("click", fecharMenuAtivo, { once: true }), 50);
  }

  function fecharMenuAtivo() {
    if (menuAtivo) { menuAtivo.remove(); menuAtivo = null; }
  }

  /* ------------------------------------------------------------------
     8. Tabela Mensal
  ------------------------------------------------------------------ */
  function renderMensal() {
    const wrapper = el("fds-tabela-mensal");
    if (!wrapper) return;

    const m  = estadoMeta;
    const em = estadoMensal;
    const sabados = calcularSabados(m.mes, m.ano);
    em.sabados = sabados;

    ["linha_home","blip_tarde","especialistas"].forEach(sec => {
      while (em[sec].length < sabados.length) em[sec].push({ c1:"",c2:"",c3:"" });
    });

    const mesAno = `${MESES_PT[m.mes - 1]} ${m.ano}`;

    let html = `
    <div class="fds-table-scroll">
      <table class="fds-table fds-table-mensal">
        <thead>
          <tr class="fds-header-row-top">
            <th colspan="4" class="fds-title-cell">
              <span class="fds-title-badge">📆 ESCALA — ${mesAno.toUpperCase()}</span>
            </th>
          </tr>
        </thead>
        <tbody id="fds-tbody-mensal">
    `;

    const secoes = [
      { label: "LINHA HOME — HORÁRIO (11 ÀS 17:20)", key: "linha_home" },
      { label: "BLIP TARDE HOME (13 ÀS 17)",         key: "blip_tarde" },
      { label: "ESPECIALISTAS (08 ÀS 12)",            key: "especialistas" },
    ];

    secoes.forEach(sec => {
      html += `
        <tr class="fds-mensal-section-header">
          <td class="fds-mensal-datas-col fds-mensal-label-cell">DATAS</td>
          <td colspan="3" class="fds-mensal-section-title">${sec.label}</td>
        </tr>`;
      sabados.forEach((sab, i) => {
        const row = em[sec.key][i] ?? { c1:"",c2:"",c3:"" };
        html += `
        <tr class="fds-mensal-data-row" data-sec="${sec.key}" data-idx="${i}">
          <td class="fds-mensal-datas-col">${esc(sab)}</td>
          <td><input type="text" class="fds-mensal-input" data-sec="${sec.key}" data-idx="${i}" data-col="c1" value="${esc(row.c1)}" placeholder=""></td>
          <td><input type="text" class="fds-mensal-input" data-sec="${sec.key}" data-idx="${i}" data-col="c2" value="${esc(row.c2)}" placeholder=""></td>
          <td><input type="text" class="fds-mensal-input" data-sec="${sec.key}" data-idx="${i}" data-col="c3" value="${esc(row.c3)}" placeholder=""></td>
        </tr>`;
      });
    });

    html += `</tbody></table></div>`;
    wrapper.innerHTML = html;

    wrapper.querySelectorAll(".fds-mensal-input").forEach(inp => {
      inp.oninput = () => {
        const sec = inp.dataset.sec;
        const idx = parseInt(inp.dataset.idx);
        const col = inp.dataset.col;
        if (!estadoMensal[sec][idx]) estadoMensal[sec][idx] = { c1:"",c2:"",c3:"" };
        estadoMensal[sec][idx][col] = inp.value;
        salvarTudo();
      };
    });
  }

  function calcularSabados(mes, ano) {
    const sabs = [];
    const d = new Date(ano, mes - 1, 1);
    while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
    while (d.getMonth() === mes - 1) {
      sabs.push(`${String(d.getDate()).padStart(2,"0")}/${String(mes).padStart(2,"0")}`);
      d.setDate(d.getDate() + 7);
    }
    return sabs;
  }

  /* ------------------------------------------------------------------
     9. Controles de mês
  ------------------------------------------------------------------ */
  function renderControlesMes() {
    const wrapper = el("fds-mes-controles");
    if (!wrapper) return;

    const m = estadoMeta;
    wrapper.innerHTML = `
      <div class="fds-mes-nav">
        <button type="button" class="btn btn-small" id="fds-mes-prev">‹</button>
        <span class="fds-mes-label">${MESES_PT[m.mes - 1]} ${m.ano}</span>
        <button type="button" class="btn btn-small" id="fds-mes-next">›</button>
      </div>
    `;

    const resetMensal = () => {
      estadoMensal.sabados = [];
      estadoMensal.linha_home = [];
      estadoMensal.blip_tarde = [];
      estadoMensal.especialistas = [];
    };

    el("fds-mes-prev").onclick = () => {
      m.mes--; if (m.mes < 1) { m.mes = 12; m.ano--; }
      resetMensal(); salvarTudo(); renderControlesMes(); renderMensal();
    };
    el("fds-mes-next").onclick = () => {
      m.mes++; if (m.mes > 12) { m.mes = 1; m.ano++; }
      resetMensal(); salvarTudo(); renderControlesMes(); renderMensal();
    };
  }

  /* ------------------------------------------------------------------
     10. Geração de texto formatado
         Formato por BLOCOS — compatível com Discord / WhatsApp
  ------------------------------------------------------------------ */
  function gerarTxtDiaria() {
    const d = estadoDiario;
    const m = estadoMeta;

    const colPitstop = m.col_pitstop || "PIT STOP";
    const colBlip    = m.col_blip    || "BLIP";
    const colEsp     = m.col_esp     || "ESPECIALISTAS";
    const colTarde   = m.col_tarde   || "TARDE";
    const colOff     = m.col_off     || "OFF";

    const data  = m.data || "??/??";
    const linha = (a,b,c,dd,e) =>
      `${pad(a,18)} │ ${pad(b,20)} │ ${pad(c,20)} │ ${pad(dd,18)} │ ${pad(e,16)}`;
    const sep = `${"─".repeat(18)}─┼─${"─".repeat(20)}─┼─${"─".repeat(20)}─┼─${"─".repeat(18)}─┼─${"─".repeat(16)}`;

    let txt = "";

    // Cabeçalho
    txt += `╔════════════════════════════════════════════════════════════════════════════╗\n`;
    txt += `║  📅  ESCALA FDS — ${data.padEnd(55)}║\n`;
    txt += `╚════════════════════════════════════════════════════════════════════════════╝\n`;
    txt += `\n`;

    // Responsáveis — só imprime os que tiverem valor
    const resp = [];
    if (m.label_pitstop)   resp.push(`${colPitstop}: ${m.label_pitstop}`);
    if (m.label_blip)      resp.push(`${colBlip}: ${m.label_blip}`);
    if (m.label_n1pitstop) resp.push(`N1 ${colPitstop}: ${m.label_especialista}`);
    if (m.label_n1chat)    resp.push(`N1 Chat: ${m.label_n1chat}`);
    if (m.label_esp)       resp.push(`${colEsp}: ${m.label_esp}`);
    resp.forEach(r => { txt += `  ${r}\n`; });
    if (resp.length) txt += `\n`;
    if (m.agenda) { txt += `  📋 AGENDA: ${m.agenda}\n\n`; }

    // Tabela de nomes
    txt += sep + "\n";
    txt += linha(colPitstop, colBlip, colEsp, colTarde, colOff) + "\n";
    txt += sep + "\n";

    let temDados = false;
    for (let i = 0; i < MAX_ROWS; i++) {
      const a  = (d.pitstop[i]?.valor      || "").toUpperCase();
      const b  = (d.blip[i]?.valor         || "").toUpperCase();
      const c  = (d.especialistas[i]?.valor|| "").toUpperCase();
      const dd = (d.tarde[i]?.valor        || "").toUpperCase();
      const e  = (d.off[i]?.valor          || "").toUpperCase();
      if (a||b||c||dd||e) { txt += linha(a,b,c,dd,e) + "\n"; temDados = true; }
    }
    if (!temDados) txt += `  (sem registros)\n`;
    txt += sep + "\n";

    return txt;
  }

  function gerarTxtMensal() {
    const m  = estadoMeta;
    const em = estadoMensal;
    const mesAno = `${MESES_PT[m.mes - 1].toUpperCase()} ${m.ano}`;

    const w = [8, 20, 20, 20];
    const linha3 = (d,c1,c2,c3) =>
      `  ${pad(d,w[0])} │ ${pad(c1,w[1])} │ ${pad(c2,w[2])} │ ${pad(c3,w[3])}`;
    const sep3 = `  ${"─".repeat(w[0])}─┼─${"─".repeat(w[1])}─┼─${"─".repeat(w[2])}─┼─${"─".repeat(w[3])}`;

    let txt = "";
    txt += `╔═══════════════════════════════════════════════════════════╗\n`;
    txt += `║  📆  ESCALA — ${mesAno.padEnd(44)}║\n`;
    txt += `╚═══════════════════════════════════════════════════════════╝\n\n`;

    const secoes = [
      { label: "LINHA HOME — HORÁRIO (11 ÀS 17:20)", key: "linha_home" },
      { label: "BLIP TARDE HOME (13 ÀS 17)",         key: "blip_tarde" },
      { label: "ESPECIALISTAS (08 ÀS 12)",            key: "especialistas" },
    ];

    secoes.forEach(sec => {
      txt += `┌── ${sec.label}\n`;
      txt += sep3 + "\n";
      txt += linha3("DATA","NOME 1","NOME 2","NOME 3") + "\n";
      txt += sep3 + "\n";
      em.sabados.forEach((sab, i) => {
        const row = em[sec.key][i] ?? { c1:"",c2:"",c3:"" };
        txt += linha3(sab,
          (row.c1||"").toUpperCase(),
          (row.c2||"").toUpperCase(),
          (row.c3||"").toUpperCase()
        ) + "\n";
      });
      txt += sep3 + "\n\n";
    });

    return txt;
  }

  /**
   * Gera texto por BLOCOS separados — ideal para colar no Discord/WhatsApp
   * sem perda de alinhamento. Usa ``` code block ``` e seções bem delimitadas.
   */
  function gerarBlocoDiscord(modo) {
    const d  = estadoDiario;
    const m  = estadoMeta;
    const em = estadoMensal;

    const data   = m.data || "??/??";
    const linhas = [];

    if (modo === "diaria" || modo === "ambos") {
      const colPitstop = m.col_pitstop || "PIT STOP";
      const colBlip    = m.col_blip    || "BLIP";
      const colEsp     = m.col_esp     || "ESPECIALISTAS";
      const colTarde   = m.col_tarde   || "TARDE";
      const colOff     = m.col_off     || "OFF";

      // Cabeçalho bonito
      linhas.push(`📅 **ESCALA FDS — ${data}**`);
      linhas.push("");

      // Responsáveis em linha
      const resp = [];
      if (m.label_pitstop)   resp.push(`${colPitstop}: **${m.label_pitstop}**`);
      if (m.label_blip)      resp.push(`${colBlip}: **${m.label_blip}**`);
      if (m.label_n1pitstop) resp.push(`N1 ${colPitstop}: **${m.label_n1pitstop}**`);
      if (m.label_n1chat)    resp.push(`N1 Chat: **${m.label_n1chat}**`);
      if (m.label_esp)       resp.push(`${colEsp}: **${m.label_esp}**`);
      resp.forEach(r => linhas.push(r));
      if (resp.length) linhas.push("");
      if (m.agenda) { linhas.push(`📋 **AGENDA:** ${m.agenda}`); linhas.push(""); }

      // Tabela em bloco de código
      const sep = `${"─".repeat(16)}┬${"─".repeat(18)}┬${"─".repeat(18)}┬${"─".repeat(16)}┬${"─".repeat(14)}`;
      const linhaTbl = (a,b,c,dd,e) =>
        `${pad(a,16)}│${pad(b,18)}│${pad(c,18)}│${pad(dd,16)}│${pad(e,14)}`;

      const linhasTbl = [];
      for (let i = 0; i < MAX_ROWS; i++) {
        const a  = (d.pitstop[i]?.valor      || "").toUpperCase();
        const b  = (d.blip[i]?.valor         || "").toUpperCase();
        const c  = (d.especialistas[i]?.valor|| "").toUpperCase();
        const dd = (d.tarde[i]?.valor        || "").toUpperCase();
        const e  = (d.off[i]?.valor          || "").toUpperCase();
        if (a||b||c||dd||e) linhasTbl.push(linhaTbl(a,b,c,dd,e));
      }

      if (linhasTbl.length) {
        linhas.push("```");
        linhas.push(linhaTbl(
          colPitstop.toUpperCase(),
          colBlip.toUpperCase(),
          colEsp.toUpperCase(),
          colTarde.toUpperCase(),
          colOff.toUpperCase()
        ));
        linhas.push(sep);
        linhasTbl.forEach(l => linhas.push(l));
        linhas.push("```");
      }
    }

    if (modo === "mensal" || modo === "ambos") {
      if (modo === "ambos") linhas.push("", "━".repeat(40), "");

      const mesAno = `${MESES_PT[m.mes - 1]} ${m.ano}`.toUpperCase();
      linhas.push(`📆 **ESCALA — ${mesAno}**`);
      linhas.push("");

      const secoes = [
        { label: "LINHA HOME (11h–17h20)",   key: "linha_home" },
        { label: "BLIP TARDE HOME (13h–17h)", key: "blip_tarde" },
        { label: "ESPECIALISTAS (08h–12h)",   key: "especialistas" },
      ];

      secoes.forEach(sec => {
        linhas.push(`**${sec.label}**`);
        linhas.push("```");
        const sep3 = `${"─".repeat(8)}┬${"─".repeat(18)}┬${"─".repeat(18)}┬${"─".repeat(18)}`;
        linhas.push(`${"DATA".padEnd(8)}│${"NOME 1".padEnd(18)}│${"NOME 2".padEnd(18)}│${"NOME 3".padEnd(18)}`);
        linhas.push(sep3);
        em.sabados.forEach((sab, i) => {
          const row = em[sec.key][i] ?? { c1:"",c2:"",c3:"" };
          linhas.push(
            `${pad(sab,8)}│${pad((row.c1||"").toUpperCase(),18)}│${pad((row.c2||"").toUpperCase(),18)}│${pad((row.c3||"").toUpperCase(),18)}`
          );
        });
        linhas.push("```");
        linhas.push("");
      });
    }

    return linhas.join("\n");
  }

  function pad(str, len) {
    str = String(str || "");
    return str.length >= len ? str.substring(0, len) : str + " ".repeat(len - str.length);
  }

  /* ------------------------------------------------------------------
     11. Ações de exportação / cópia
  ------------------------------------------------------------------ */
  function getModo() {
    return document.querySelector('input[name="fds-export-modo"]:checked')?.value ?? "ambos";
  }

  function exportarTXT() {
    const modo = getModo();
    let conteudo = "";
    if (modo === "diaria" || modo === "ambos") {
      conteudo += gerarTxtDiaria();
      if (modo === "ambos") conteudo += "\n\n" + "═".repeat(90) + "\n\n";
    }
    if (modo === "mensal" || modo === "ambos") conteudo += gerarTxtMensal();

    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    const mes  = MESES_PT[estadoMeta.mes - 1];
    const data = estadoMeta.data ? `-${estadoMeta.data.replace("/","")}` : "";
    a.download = `escala-fds${data}-${mes}${estadoMeta.ano}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toastFDS("✅ Arquivo TXT exportado!");
  }

  function copiarTXT() {
    const modo     = getModo();
    const conteudo = gerarBlocoDiscord(modo);
    navigator.clipboard.writeText(conteudo).then(() => {
      toastFDS("📋 Escala copiada (formato Discord)!");
    }).catch(() => {
      toastFDS("❌ Não foi possível copiar.", "erro");
    });
  }

  /* ------------------------------------------------------------------
     12. Preview
  ------------------------------------------------------------------ */
  function atualizarPreview() {
    const box = el("fds-preview-box");
    if (!box) return;
    const modo = getModo();
    let c = "";
    if (modo === "diaria" || modo === "ambos") {
      c += gerarTxtDiaria();
      if (modo === "ambos") c += "\n\n";
    }
    if (modo === "mensal" || modo === "ambos") c += gerarTxtMensal();
    box.textContent = c;
  }

  /* ------------------------------------------------------------------
     13. Limpar
  ------------------------------------------------------------------ */
  function limparDiaria() {
    if (!confirm("Limpar toda a escala diária? Esta ação não pode ser desfeita.")) return;
    COLS_DIARIA.forEach(k => {
      estadoDiario[k] = Array.from({ length: MAX_ROWS }, () => ({ valor: "", tipo: "normal" }));
    });
    estadoMeta.data = "";
    estadoMeta.label_pitstop = ""; estadoMeta.label_blip = "AGENDA / BLIP";
    estadoMeta.label_n1pitstop = ""; estadoMeta.label_n1chat = "";
    estadoMeta.label_esp = ""; estadoMeta.agenda = "";
    salvarTudo(); renderDiaria();
    toastFDS("🗑 Escala diária limpa.");
  }

  function limparMensal() {
    if (!confirm("Limpar a escala mensal? Esta ação não pode ser desfeita.")) return;
    estadoMensal.linha_home = []; estadoMensal.blip_tarde = [];
    estadoMensal.especialistas = [];
    salvarTudo(); renderMensal();
    toastFDS("🗑 Escala mensal limpa.");
  }

  /* ------------------------------------------------------------------
     14. Consultar escalas salvas no Supabase
  ------------------------------------------------------------------ */
  async function consultarEscalasSalvas() {
    const db = getSupa();
    if (!db) {
      toastFDS("⚠ Supabase não configurado. Dados apenas locais.");
      return;
    }

    const { data, error } = await db
      .from(SUPA_TABLE)
      .select("id,meta,atualizado_em")
      .order("atualizado_em", { ascending: false })
      .limit(20);

    if (error || !data?.length) {
      toastFDS("Nenhuma escala salva encontrada.");
      return;
    }

    abrirModalEscalasSalvas(data);
  }

  function abrirModalEscalasSalvas(registros) {
    fecharModalEscalasSalvas();

    const modal = document.createElement("div");
    modal.id = "fds-modal-escalas";
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;
      display:flex;align-items:center;justify-content:center;padding:16px;
    `;

    const lista = registros.map(r => {
      const meta = r.meta || {};
      const data = meta.data || "??/??";
      const mes  = MESES_PT[(meta.mes||1)-1];
      const ano  = meta.ano || "";
      const at   = r.atualizado_em
        ? new Date(r.atualizado_em).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})
        : "—";
      return `
        <div class="pev-import-card" style="cursor:pointer;margin-bottom:8px;"
             onclick="window._FDS_carregarEscala('${r.id}')">
          <div class="pev-import-card-body">
            <div class="pev-import-empresa">📅 ${data} — ${mes} ${ano}</div>
            <div class="pev-import-meta"><span>Salvo: ${at}</span></div>
          </div>
        </div>`;
    }).join("");

    modal.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;
                  padding:24px;max-width:480px;width:100%;max-height:80vh;overflow-y:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <h3 style="font-size:15px;font-weight:700;color:var(--text);">📚 Escalas Salvas</h3>
          <button type="button" onclick="document.getElementById('fds-modal-escalas')?.remove()"
            style="background:transparent;border:none;color:var(--muted);font-size:18px;cursor:pointer;">✕</button>
        </div>
        ${lista}
      </div>
    `;

    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    // Expõe callback
    window._FDS_carregarEscala = async (id) => {
      const ok = await carregarDoSupabase(id);
      if (ok) {
        renderDiaria();
        renderControlesMes();
        renderMensal();
        toastFDS(`✅ Escala carregada: ${id}`);
      } else {
        toastFDS("❌ Não foi possível carregar essa escala.");
      }
      fecharModalEscalasSalvas();
    };
  }

  function fecharModalEscalasSalvas() {
    el("fds-modal-escalas")?.remove();
  }

  /* ------------------------------------------------------------------
     15. Init
  ------------------------------------------------------------------ */
  function init() {
    const page = el("page-fds");
    if (!page) return;

    carregarTudo();
    renderDiaria();
    renderControlesMes();
    renderMensal();

    const bindBtn = (id, fn) => { const b = el(id); if (b) b.onclick = fn; };

    bindBtn("fds-btn-limpar-diaria", limparDiaria);
    bindBtn("fds-btn-limpar-mensal", limparMensal);
    bindBtn("fds-btn-exportar-txt",  exportarTXT);
    bindBtn("fds-btn-copiar-txt",    copiarTXT);
    bindBtn("fds-btn-consultar",     consultarEscalasSalvas);

    bindBtn("fds-btn-preview", () => {
      const sec = el("fds-preview-section");
      if (!sec) return;
      const visible = sec.style.display !== "none";
      sec.style.display = visible ? "none" : "";
      if (!visible) atualizarPreview();
    });

    document.querySelectorAll('input[name="fds-export-modo"]').forEach(r => {
      r.onchange = () => {
        const s = el("fds-preview-section");
        if (s && s.style.display !== "none") atualizarPreview();
      };
    });

    // Tentativa de carregar do Supabase (escala do mês atual)
    const chaveAtual = `fds_${estadoMeta.mes}_${estadoMeta.ano}_${(estadoMeta.data||"xx").replace("/","")}`;
    carregarDoSupabase(chaveAtual).then(ok => {
      if (ok) {
        renderDiaria();
        renderControlesMes();
        renderMensal();
        toastFDS("☁ Escala carregada do Supabase.");
      }
    });
  }

  /* ------------------------------------------------------------------
     16. Hook de navegação
  ------------------------------------------------------------------ */
  function hookNavegacao() {
    const observeNav = () => {
      const tabFds = document.querySelector('.tab[data-tab="fds"]');
      if (!tabFds) return;
      tabFds.addEventListener("click", () => requestAnimationFrame(init));
      if (tabFds.classList.contains("active")) init();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", observeNav);
    } else {
      observeNav();
    }
  }

  hookNavegacao();
  window.FDS = { init, exportarTXT, copiarTXT, renderDiaria, renderMensal, consultarEscalasSalvas };

})();
