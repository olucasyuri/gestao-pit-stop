/* ==========================================================================
   Escala FDS — Gestão PIT STOP
   Módulo responsável pela Escala do Sábado completa:
   • Tabela diária (ESCALA FDS) com colunas: PIT STOP, AGENDA/BLIP, N1 PIT STOP, N1 CHAT, ESPECIALISTAS
   • Tabela mensal (Escala do Mês) com seções: Linha Home, BLIP Tarde Home, Especialistas
   • Exportação TXT formatada para envio
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     1. Estado
  ------------------------------------------------------------------ */
  const KEY_DIARIA  = "pitstop_fds_diaria";
  const KEY_MENSAL  = "pitstop_fds_mensal";
  const KEY_META    = "pitstop_fds_meta";   // data, responsáveis, etc.

  let estadoDiario = null;
  let estadoMensal = null;
  let estadoMeta   = null;

  const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  /* ------------------------------------------------------------------
     2. Persistência (localStorage)
  ------------------------------------------------------------------ */
  function salvarTudo() {
    localStorage.setItem(KEY_DIARIA, JSON.stringify(estadoDiario));
    localStorage.setItem(KEY_MENSAL, JSON.stringify(estadoMensal));
    localStorage.setItem(KEY_META,   JSON.stringify(estadoMeta));
  }

  function carregarTudo() {
    const now = new Date();

    // Meta: data do sábado, responsáveis dos setores
    estadoMeta = JSON.parse(localStorage.getItem(KEY_META)) ?? {
      data:       "",
      agenda:     "",
      n1_pitstop: "",
      n1_chat:    "",
      especialista_n1: "",
      mes:        now.getMonth() + 1,
      ano:        now.getFullYear(),
    };

    // Tabela diária — colunas fixas
    estadoDiario = JSON.parse(localStorage.getItem(KEY_DIARIA)) ?? {
      pitstop:      [],  // col A
      blip:         [],  // col B
      especialistas:[],  // col C
      tarde:        [],  // col D
      off:          [],  // col E (seção OFF + seções especiais)
    };

    // Tabela mensal — 3 seções × n sábados
    estadoMensal = JSON.parse(localStorage.getItem(KEY_MENSAL)) ?? {
      sabados:    [],  // lista de datas/labels dos sábados
      linha_home: [],  // cada item: { sabado_idx, col1, col2, col3 }
      blip_tarde: [],
      especialistas: [],
    };
  }

  /* ------------------------------------------------------------------
     3. Helpers de DOM
  ------------------------------------------------------------------ */
  function el(id)   { return document.getElementById(id); }
  function qs(sel)  { return document.querySelector(sel); }
  function qsa(sel) { return document.querySelectorAll(sel); }

  function criarBotao(texto, classes, onclick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = texto;
    b.className = classes;
    b.onclick = onclick;
    return b;
  }

  function toastFDS(msg, tipo = "ok") {
    // Reutiliza o sistema de toast existente se disponível
    if (typeof toast === "function") { toast(msg); return; }
    const t = el("toast");
    if (!t) return;
    t.textContent = msg;
    t.className   = "toast-show" + (tipo === "erro" ? " toast-erro" : "");
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.className = "", 3200);
  }

  /* ------------------------------------------------------------------
     4. Render — Tabela Diária (ESCALA FDS)
  ------------------------------------------------------------------ */
  function renderDiaria() {
    const wrapper = el("fds-tabela-diaria");
    if (!wrapper) return;

    const d = estadoDiario;
    const m = estadoMeta;
    const maxRows = Math.max(
      d.pitstop.length,
      d.blip.length,
      d.especialistas.length,
      d.tarde.length,
      d.off.length,
      8   // mínimo de 8 linhas visíveis
    ) + 2;

    // Garante arrays com comprimento suficiente
    ["pitstop","blip","especialistas","tarde","off"].forEach(k => {
      while (d[k].length < maxRows) d[k].push({ valor: "", tipo: "normal" });
    });

    let html = `
    <div class="fds-table-scroll">
      <table class="fds-table">
        <thead>
          <tr class="fds-header-row-top">
            <th colspan="5" class="fds-title-cell">
              <span class="fds-title-badge">📅 ESCALA FDS</span>
              <input class="fds-meta-input" id="fds-meta-data" type="text"
                placeholder="Ex: 23/05" value="${esc(m.data)}"
                title="Data do sábado" style="width:80px; font-weight:700; font-size:15px;">
            </th>
          </tr>
          <tr class="fds-header-row-secondary">
            <th class="fds-col-a">
              <input class="fds-meta-input" id="fds-meta-agenda" type="text"
                placeholder="Agenda (ex: FERNANDA/JANNE)" value="${esc(m.agenda)}">
            </th>
            <th class="fds-col-b">AGENDA / BLIP</th>
            <th class="fds-col-c">
              <input class="fds-meta-input" id="fds-meta-n1pitstop" type="text"
                placeholder="Responsável N1" value="${esc(m.n1_pitstop)}">
            </th>
            <th class="fds-col-d">
              <input class="fds-meta-input" id="fds-meta-n1chat" type="text"
                placeholder="Ex: MAURICIO, BRUNO" value="${esc(m.n1_chat)}">
            </th>
            <th class="fds-col-e">
              <input class="fds-meta-input" id="fds-meta-esp" type="text"
                placeholder="Especialista (ex: OSIEL)" value="${esc(m.especialista_n1)}">
            </th>
          </tr>
          <tr class="fds-header-cols">
            <th>PIT STOP</th>
            <th>BLIP</th>
            <th>ESPECIALISTAS</th>
            <th>TARDE</th>
            <th>OFF</th>
          </tr>
        </thead>
        <tbody id="fds-tbody-diaria">
    `;

    for (let i = 0; i < maxRows; i++) {
      html += `<tr class="fds-data-row" data-row="${i}">`;
      ["pitstop","blip","especialistas","tarde","off"].forEach((col, ci) => {
        const cell = d[col][i] ?? { valor: "", tipo: "normal" };
        const isRed = cell.tipo === "vermelho";
        const isBold = cell.tipo === "negrito";
        const isHeader = cell.tipo === "header";
        html += `
          <td class="fds-cell fds-cell-${col} ${isHeader ? 'fds-cell-header' : ''}"
              data-col="${col}" data-row="${i}">
            <div class="fds-cell-inner">
              <input type="text"
                class="fds-cell-input ${isRed ? 'fds-red' : ''} ${isBold ? 'fds-bold' : ''} ${isHeader ? 'fds-header-cell-input' : ''}"
                value="${esc(cell.valor)}"
                placeholder=""
                data-col="${col}" data-row="${i}"
              >
              <button type="button" class="fds-cell-menu-btn" data-col="${col}" data-row="${i}" title="Opções">⋮</button>
            </div>
          </td>`;
      });
      html += `</tr>`;
    }

    html += `
        </tbody>
      </table>
    </div>
    `;

    wrapper.innerHTML = html;

    // Bind: inputs de meta
    ["fds-meta-data","fds-meta-agenda","fds-meta-n1pitstop","fds-meta-n1chat","fds-meta-esp"].forEach(id => {
      const inp = el(id);
      if (!inp) return;
      const mapa = {
        "fds-meta-data":      "data",
        "fds-meta-agenda":    "agenda",
        "fds-meta-n1pitstop": "n1_pitstop",
        "fds-meta-n1chat":    "n1_chat",
        "fds-meta-esp":       "especialista_n1",
      };
      inp.oninput = () => {
        estadoMeta[mapa[id]] = inp.value;
        salvarTudo();
      };
    });

    // Bind: inputs de célula
    wrapper.querySelectorAll(".fds-cell-input").forEach(inp => {
      inp.oninput = () => {
        const col = inp.dataset.col;
        const row = parseInt(inp.dataset.row);
        if (!estadoDiario[col][row]) estadoDiario[col][row] = { valor: "", tipo: "normal" };
        estadoDiario[col][row].valor = inp.value;
        // Auto-expand: adiciona linha se última linha tem conteúdo
        const arr = estadoDiario[col];
        if (row === arr.length - 1 && inp.value.trim()) {
          salvarTudo();
          renderDiaria();
          // Foca próxima célula da mesma coluna
          setTimeout(() => {
            const next = wrapper.querySelector(`.fds-cell-input[data-col="${col}"][data-row="${row + 1}"]`);
            if (next) next.focus();
          }, 10);
          return;
        }
        salvarTudo();
      };
      inp.onkeydown = (e) => {
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          const cols = ["pitstop","blip","especialistas","tarde","off"];
          const row  = parseInt(inp.dataset.row);
          const ci   = cols.indexOf(inp.dataset.col);
          let nextCol, nextRow;
          if (e.key === "Enter" || (e.key === "Tab" && ci === cols.length - 1)) {
            nextCol = cols[0];
            nextRow = row + 1;
          } else {
            nextCol = cols[ci + 1];
            nextRow = row;
          }
          const next = wrapper.querySelector(`.fds-cell-input[data-col="${nextCol}"][data-row="${nextRow}"]`);
          if (next) next.focus();
        }
      };
    });

    // Bind: botões de menu de célula
    wrapper.querySelectorAll(".fds-cell-menu-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        abrirMenuCelula(btn.dataset.col, parseInt(btn.dataset.row), btn);
      };
    });
  }

  function esc(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* ------------------------------------------------------------------
     5. Menu de opções de célula (vermelho, negrito, header, limpar)
  ------------------------------------------------------------------ */
  let menuAtivo = null;

  function abrirMenuCelula(col, row, anchor) {
    fecharMenuAtivo();

    const menu = document.createElement("div");
    menu.className = "fds-cell-ctx-menu";
    menu.innerHTML = `
      <button type="button" class="fds-ctx-opt" data-acao="vermelho">🔴 Vermelho</button>
      <button type="button" class="fds-ctx-opt" data-acao="negrito">⬛ Negrito (header)</button>
      <button type="button" class="fds-ctx-opt" data-acao="normal">⬜ Normal</button>
      <div class="fds-ctx-sep"></div>
      <button type="button" class="fds-ctx-opt fds-ctx-del" data-acao="limpar">🗑 Limpar célula</button>
    `;

    const rect = anchor.getBoundingClientRect();
    menu.style.top  = (rect.bottom + window.scrollY + 4) + "px";
    menu.style.left = (rect.left  + window.scrollX - 60) + "px";
    document.body.appendChild(menu);
    menuAtivo = menu;

    menu.querySelectorAll(".fds-ctx-opt").forEach(opt => {
      opt.onclick = () => {
        const acao = opt.dataset.acao;
        const cell = estadoDiario[col]?.[row];
        if (!cell) return;
        if (acao === "limpar") {
          cell.valor = "";
          cell.tipo  = "normal";
        } else {
          cell.tipo = acao;
        }
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
     6. Render — Tabela Mensal (Escala do Mês)
  ------------------------------------------------------------------ */
  function renderMensal() {
    const wrapper = el("fds-tabela-mensal");
    if (!wrapper) return;

    const m  = estadoMeta;
    const em = estadoMensal;

    // Calcula sábados do mês/ano selecionado
    const sabadosDoMes = calcularSabados(m.mes, m.ano);

    // Sincroniza sabados no estado
    em.sabados = sabadosDoMes;
    ["linha_home","blip_tarde","especialistas"].forEach(sec => {
      // Garante que cada sábado tenha 3 slots
      while (em[sec].length < sabadosDoMes.length) {
        em[sec].push({ c1: "", c2: "", c3: "" });
      }
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

    // Seção: Linha Home
    html += `
      <tr class="fds-mensal-section-header">
        <td class="fds-mensal-datas-col fds-mensal-label-cell">DATAS</td>
        <td colspan="3" class="fds-mensal-section-title">
          LINHA HOME — HORÁRIO (11 ÀS 17:20)
        </td>
      </tr>`;
    sabadosDoMes.forEach((sab, i) => {
      const row = em.linha_home[i] ?? { c1:"",c2:"",c3:"" };
      html += renderMensalRow("linha_home", i, sab, row);
    });

    // Seção: BLIP Tarde Home
    html += `
      <tr class="fds-mensal-section-header">
        <td class="fds-mensal-datas-col fds-mensal-label-cell">DATAS</td>
        <td colspan="3" class="fds-mensal-section-title">
          BLIP TARDE HOME (13 ÀS 17)
        </td>
      </tr>`;
    sabadosDoMes.forEach((sab, i) => {
      const row = em.blip_tarde[i] ?? { c1:"",c2:"",c3:"" };
      html += renderMensalRow("blip_tarde", i, sab, row);
    });

    // Seção: Especialistas
    html += `
      <tr class="fds-mensal-section-header">
        <td class="fds-mensal-datas-col fds-mensal-label-cell">DATAS</td>
        <td colspan="3" class="fds-mensal-section-title">
          ESPECIALISTAS (08 ÀS 12)
        </td>
      </tr>`;
    sabadosDoMes.forEach((sab, i) => {
      const row = em.especialistas[i] ?? { c1:"",c2:"",c3:"" };
      html += renderMensalRow("especialistas", i, sab, row);
    });

    html += `</tbody></table></div>`;
    wrapper.innerHTML = html;

    // Bind inputs mensais
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

  function renderMensalRow(sec, idx, sab, row) {
    return `
    <tr class="fds-mensal-data-row" data-sec="${sec}" data-idx="${idx}">
      <td class="fds-mensal-datas-col">${esc(sab)}</td>
      <td><input type="text" class="fds-mensal-input" data-sec="${sec}" data-idx="${idx}" data-col="c1" value="${esc(row.c1)}" placeholder=""></td>
      <td><input type="text" class="fds-mensal-input" data-sec="${sec}" data-idx="${idx}" data-col="c2" value="${esc(row.c2)}" placeholder=""></td>
      <td><input type="text" class="fds-mensal-input" data-sec="${sec}" data-idx="${idx}" data-col="c3" value="${esc(row.c3)}" placeholder=""></td>
    </tr>`;
  }

  function calcularSabados(mes, ano) {
    const sabs = [];
    const d = new Date(ano, mes - 1, 1);
    // Avança até sábado (6)
    while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
    while (d.getMonth() === mes - 1) {
      sabs.push(`${String(d.getDate()).padStart(2,"0")}/${String(mes).padStart(2,"0")}`);
      d.setDate(d.getDate() + 7);
    }
    return sabs;
  }

  /* ------------------------------------------------------------------
     7. Controles de mês/ano
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

    el("fds-mes-prev").onclick = () => {
      m.mes--;
      if (m.mes < 1) { m.mes = 12; m.ano--; }
      // Reset mensal ao trocar mês
      estadoMensal.sabados = [];
      estadoMensal.linha_home = [];
      estadoMensal.blip_tarde = [];
      estadoMensal.especialistas = [];
      salvarTudo();
      renderControlesMes();
      renderMensal();
    };

    el("fds-mes-next").onclick = () => {
      m.mes++;
      if (m.mes > 12) { m.mes = 1; m.ano++; }
      estadoMensal.sabados = [];
      estadoMensal.linha_home = [];
      estadoMensal.blip_tarde = [];
      estadoMensal.especialistas = [];
      salvarTudo();
      renderControlesMes();
      renderMensal();
    };
  }

  /* ------------------------------------------------------------------
     8. Exportação TXT
  ------------------------------------------------------------------ */
  function gerarTxtDiaria() {
    const d = estadoDiario;
    const m = estadoMeta;

    const linha = (a, b, c, dd, e) =>
      `${pad(a,18)} │ ${pad(b,22)} │ ${pad(c,22)} │ ${pad(dd,22)} │ ${pad(e,20)}`;

    const sep = `${"─".repeat(18)}─┼─${"─".repeat(22)}─┼─${"─".repeat(22)}─┼─${"─".repeat(22)}─┼─${"─".repeat(20)}`;

    let txt = `╔══════════════════════════════════════════════════════════════════════════════════════╗\n`;
    txt     += `║   📅  ESCALA FDS — ${(m.data || "??/??").padEnd(6)}                                                       ║\n`;
    txt     += `╚══════════════════════════════════════════════════════════════════════════════════════╝\n`;
    txt     += `\n`;
    txt     += `  Agenda  : ${m.agenda || "—"}\n`;
    txt     += `  N1 PitStop: ${m.n1_pitstop || "—"}    N1 Chat: ${m.n1_chat || "—"}    Especialista: ${m.especialista_n1 || "—"}\n`;
    txt     += `\n`;
    txt     += sep + "\n";
    txt     += linha("PIT STOP","BLIP","ESPECIALISTAS","TARDE","OFF") + "\n";
    txt     += sep + "\n";

    const maxRows = Math.max(
      d.pitstop.filter(c=>c.valor).length,
      d.blip.filter(c=>c.valor).length,
      d.especialistas.filter(c=>c.valor).length,
      d.tarde.filter(c=>c.valor).length,
      d.off.filter(c=>c.valor).length,
    );

    for (let i = 0; i < maxRows; i++) {
      const a = (d.pitstop[i]?.valor || "").toUpperCase();
      const b = (d.blip[i]?.valor || "").toUpperCase();
      const c = (d.especialistas[i]?.valor || "").toUpperCase();
      const dd = (d.tarde[i]?.valor || "").toUpperCase();
      const e = (d.off[i]?.valor || "").toUpperCase();
      if (a||b||c||dd||e) {
        txt += linha(a,b,c,dd,e) + "\n";
      }
    }

    txt += sep + "\n";
    return txt;
  }

  function gerarTxtMensal() {
    const m  = estadoMeta;
    const em = estadoMensal;
    const mesAno = `${MESES_PT[m.mes - 1].toUpperCase()} ${m.ano}`;

    const linha3 = (data, c1, c2, c3) =>
      `  ${pad(data,7)} │ ${pad(c1,18)} │ ${pad(c2,18)} │ ${pad(c3,18)}`;

    const sep3 = `  ${"─".repeat(7)}─┼─${"─".repeat(18)}─┼─${"─".repeat(18)}─┼─${"─".repeat(18)}`;

    let txt = `╔══════════════════════════════════════════════════════════╗\n`;
    txt     += `║   📆  ESCALA — ${mesAno.padEnd(42)}║\n`;
    txt     += `╚══════════════════════════════════════════════════════════╝\n\n`;

    const secoes = [
      { label: "LINHA HOME — HORÁRIO (11 ÀS 17:20)", key: "linha_home" },
      { label: "BLIP TARDE HOME (13 ÀS 17)",         key: "blip_tarde" },
      { label: "ESPECIALISTAS (08 ÀS 12)",            key: "especialistas" },
    ];

    secoes.forEach(sec => {
      txt += `┌── ${sec.label}\n`;
      txt += sep3 + "\n";
      txt += linha3("DATAS","","","") + "\n";
      txt += sep3 + "\n";
      em.sabados.forEach((sab, i) => {
        const row = em[sec.key][i] ?? { c1:"", c2:"", c3:"" };
        const c1  = (row.c1 || "").toUpperCase();
        const c2  = (row.c2 || "").toUpperCase();
        const c3  = (row.c3 || "").toUpperCase();
        txt += linha3(sab, c1, c2, c3) + "\n";
      });
      txt += sep3 + "\n\n";
    });

    return txt;
  }

  function pad(str, len) {
    str = String(str || "");
    return str.length >= len ? str.substring(0, len) : str + " ".repeat(len - str.length);
  }

  function exportarTXT(modo) {
    let conteudo = "";
    if (modo === "diaria" || modo === "ambos") {
      conteudo += gerarTxtDiaria();
      if (modo === "ambos") conteudo += "\n\n" + "═".repeat(88) + "\n\n";
    }
    if (modo === "mensal" || modo === "ambos") {
      conteudo += gerarTxtMensal();
    }

    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    const mes  = MESES_PT[estadoMeta.mes - 1];
    const data = estadoMeta.data ? `-${estadoMeta.data.replace("/","")}` : "";
    a.download = `escala-fds${data}-${mes}${estadoMeta.ano}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toastFDS("Arquivo TXT exportado com sucesso!");
  }

  function copiarTXT(modo) {
    let conteudo = "";
    if (modo === "diaria" || modo === "ambos") {
      conteudo += gerarTxtDiaria();
      if (modo === "ambos") conteudo += "\n\n";
    }
    if (modo === "mensal" || modo === "ambos") {
      conteudo += gerarTxtMensal();
    }
    navigator.clipboard.writeText(conteudo).then(() => {
      toastFDS("Escala copiada para a área de transferência!");
    }).catch(() => {
      toastFDS("Não foi possível copiar automaticamente.", "erro");
    });
  }

  /* ------------------------------------------------------------------
     9. Preview TXT
  ------------------------------------------------------------------ */
  function atualizarPreview() {
    const box = el("fds-preview-box");
    if (!box) return;
    const modo = document.querySelector('input[name="fds-export-modo"]:checked')?.value ?? "ambos";
    let conteudo = "";
    if (modo === "diaria" || modo === "ambos") {
      conteudo += gerarTxtDiaria();
      if (modo === "ambos") conteudo += "\n\n";
    }
    if (modo === "mensal" || modo === "ambos") {
      conteudo += gerarTxtMensal();
    }
    box.textContent = conteudo;
  }

  /* ------------------------------------------------------------------
     10. Limpar escalas
  ------------------------------------------------------------------ */
  function limparDiaria() {
    if (!confirm("Limpar toda a escala diária do FDS? Esta ação não pode ser desfeita.")) return;
    estadoDiario = { pitstop: [], blip: [], especialistas: [], tarde: [], off: [] };
    estadoMeta.data = "";
    estadoMeta.agenda = "";
    estadoMeta.n1_pitstop = "";
    estadoMeta.n1_chat = "";
    estadoMeta.especialista_n1 = "";
    salvarTudo();
    renderDiaria();
    toastFDS("Escala diária FDS limpa.");
  }

  function limparMensal() {
    if (!confirm("Limpar a escala mensal? Esta ação não pode ser desfeita.")) return;
    estadoMensal.linha_home    = [];
    estadoMensal.blip_tarde    = [];
    estadoMensal.especialistas = [];
    salvarTudo();
    renderMensal();
    toastFDS("Escala mensal limpa.");
  }

  /* ------------------------------------------------------------------
     11. Inicialização da aba
  ------------------------------------------------------------------ */
  function init() {
    const page = el("page-fds");
    if (!page) return;  // aba ainda não existe no DOM

    carregarTudo();
    renderDiaria();
    renderControlesMes();
    renderMensal();

    // Botões de ação
    bindBtn("fds-btn-limpar-diaria",  () => limparDiaria());
    bindBtn("fds-btn-limpar-mensal",  () => limparMensal());

    bindBtn("fds-btn-exportar-txt", () => {
      const modo = document.querySelector('input[name="fds-export-modo"]:checked')?.value ?? "ambos";
      exportarTXT(modo);
    });

    bindBtn("fds-btn-copiar-txt", () => {
      const modo = document.querySelector('input[name="fds-export-modo"]:checked')?.value ?? "ambos";
      copiarTXT(modo);
    });

    bindBtn("fds-btn-preview", () => {
      const box = el("fds-preview-box");
      const section = el("fds-preview-section");
      if (!section || !box) return;
      const visible = section.style.display !== "none";
      if (visible) {
        section.style.display = "none";
      } else {
        section.style.display = "";
        atualizarPreview();
      }
    });

    // Atualiza preview quando muda radio
    qsa('input[name="fds-export-modo"]').forEach(r => {
      r.onchange = () => {
        const s = el("fds-preview-section");
        if (s && s.style.display !== "none") atualizarPreview();
      };
    });
  }

  function bindBtn(id, fn) {
    const b = el(id);
    if (b) b.onclick = fn;
  }

  /* ------------------------------------------------------------------
     12. Hook na navegação principal
  ------------------------------------------------------------------ */
  function hookNavegacao() {
    // Aguarda o DOM estar pronto e hookeia o clique na aba FDS
    const observeNav = () => {
      const tabFds = document.querySelector('.tab[data-tab="fds"]');
      if (tabFds) {
        tabFds.addEventListener("click", () => {
          // Pequeno delay para o page ficar ativo
          requestAnimationFrame(() => init());
        });
        // Se a aba já estiver ativa ao carregar (improvável, mas seguro)
        if (tabFds.classList.contains("active")) init();
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", observeNav);
    } else {
      observeNav();
    }
  }

  hookNavegacao();

  // Expõe API mínima globalmente (para debug ou integração futura)
  window.FDS = { init, exportarTXT, copiarTXT, renderDiaria, renderMensal };

})();
