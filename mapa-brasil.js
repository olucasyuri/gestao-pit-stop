/**
 * Mapa de Calor — Brasil
 * Distribui colaboradores PEV (por regiao→estado) e PIT STOP (campo estado)
 * em um mapa SVG interativo com heatmap de densidade.
 */
"use strict";

/* ─── Mapeamento cidade/região PEV → UF ─────────────────── */
const MAPA_REGIAO_UF = {
  "Aracaju":                  "SE",
  "São Luiz":                 "MA",
  "São Luís":                 "MA",
  "Ipatinga / Teófilo Otoni": "MG",
  "Ipatinga":                 "MG",
  "Teófilo Otoni":            "MG",
  "Ribeirão Preto":           "SP",
  "Goiânia":                  "GO",
  "Juazeiro do Norte":        "CE",
  "Cuiabá":                   "MT",
  "Fortaleza":                "CE",
  "Recife":                   "PE",
  "Salvador":                 "BA",
  "Manaus":                   "AM",
  "Belém":                    "PA",
  "Porto Alegre":             "RS",
  "Curitiba":                 "PR",
  "Florianópolis":            "SC",
  "Belo Horizonte":           "MG",
  "São Paulo":                "SP",
  "Rio de Janeiro":           "RJ",
  "Brasília":                 "DF",
  "Natal":                    "RN",
  "Maceió":                   "AL",
  "João Pessoa":              "PB",
  "Teresina":                 "PI",
  "Macapá":                   "AP",
  "Boa Vista":                "RR",
  "Porto Velho":              "RO",
  "Rio Branco":               "AC",
  "Palmas":                   "TO",
  "Campo Grande":             "MS",
  "Macaé":                    "RJ",
  "Vitória":                  "ES",
  "São Luís do Maranhão":     "MA",
};

/* ─── Nomes completos dos estados ──────────────────────────── */
const NOME_ESTADO = {
  AC:"Acre", AL:"Alagoas", AP:"Amapá", AM:"Amazonas", BA:"Bahia",
  CE:"Ceará", DF:"Distrito Federal", ES:"Espírito Santo", GO:"Goiás",
  MA:"Maranhão", MT:"Mato Grosso", MS:"Mato Grosso do Sul",
  MG:"Minas Gerais", PA:"Pará", PB:"Paraíba", PR:"Paraná",
  PE:"Pernambuco", PI:"Piauí", RJ:"Rio de Janeiro",
  RN:"Rio Grande do Norte", RS:"Rio Grande do Sul", RO:"Rondônia",
  RR:"Roraima", SC:"Santa Catarina", SP:"São Paulo",
  SE:"Sergipe", TO:"Tocantins",
};

/* ─── Coordenadas label por estado (cx,cy no viewBox) ────── */
const LABEL_POS = {
  AC:{x:95,y:310},  AL:{x:595,y:295},  AP:{x:450,y:105},
  AM:{x:185,y:195}, BA:{x:555,y:320},  CE:{x:600,y:215},
  DF:{x:460,y:355}, ES:{x:570,y:390},  GO:{x:450,y:355},
  MA:{x:510,y:205}, MT:{x:355,y:315},  MS:{x:370,y:410},
  MG:{x:510,y:380}, PA:{x:420,y:190},  PB:{x:615,y:250},
  PR:{x:415,y:455}, PE:{x:590,y:260},  PI:{x:545,y:240},
  RJ:{x:540,y:415}, RN:{x:625,y:235},  RS:{x:390,y:500},
  RO:{x:225,y:300}, RR:{x:265,y:105},  SC:{x:415,y:475},
  SP:{x:460,y:415}, SE:{x:590,y:305},  TO:{x:480,y:280},
};

/* ─── Leitura de dados ──────────────────────────────────────── */
function mapaLerDados() {
  function tryParse(key, def) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); } catch { return def; }
  }

  const pitstopColabs  = tryParse('pitstop_colaboradores', []);
  const pitstopFlags   = tryParse('pitstop_flags', {});
  const pevColabs      = tryParse('pev_colaboradores', []);
  const mapaEstados    = tryParse('mapa_estados_pitstop', {});   // { nome: "SP" }

  return { pitstopColabs, pitstopFlags, pevColabs, mapaEstados };
}

/* ─── Agregar por UF ────────────────────────────────────────── */
function mapaAgregarUF(pitstopColabs, pitstopFlags, pevColabs, mapaEstados) {
  const ufMap = {}; // { UF: { pit: [], pev: [], total: 0 } }

  const initUF = (uf) => {
    if (!ufMap[uf]) ufMap[uf] = { pit: [], pev: [], total: 0 };
  };

  // PIT STOP — usa mapaEstados (editável pelo gestor) para resolver UF
  pitstopColabs.forEach(c => {
    const uf = (mapaEstados[c.nome] || '').toUpperCase();
    if (!uf || !NOME_ESTADO[uf]) return;
    const flag = (pitstopFlags[c.nome] || {});
    const ativo = !(flag.off || flag.ferias || flag.atestado);
    initUF(uf);
    ufMap[uf].pit.push({ nome: c.nome, cargo: c.cargo, ativo });
    if (ativo) ufMap[uf].total++;
  });

  // PEV — usa regiao → MAPA_REGIAO_UF
  pevColabs.forEach(c => {
    const regiao = c.regiao || '';
    let uf = null;
    // tenta match exato primeiro
    for (const [key, val] of Object.entries(MAPA_REGIAO_UF)) {
      if (regiao.toLowerCase().includes(key.toLowerCase()) ||
          key.toLowerCase().includes(regiao.toLowerCase())) {
        uf = val; break;
      }
    }
    if (!uf || !NOME_ESTADO[uf]) return;
    initUF(uf);
    ufMap[uf].pev.push({ nome: c.nome, regiao, horario: c.horario });
    ufMap[uf].total++;
  });

  return ufMap;
}

/* ─── Cor do heatmap ────────────────────────────────────────── */
function mapaHeatColor(count, max) {
  if (!count || !max) return 'rgba(255,255,255,0.04)';
  const ratio = count / max;
  // Gradiente: cinza → dourado → laranja → vermelho
  if (ratio < 0.25) {
    const t = ratio / 0.25;
    return `rgba(245,200,66,${0.12 + t * 0.18})`;
  } else if (ratio < 0.6) {
    const t = (ratio - 0.25) / 0.35;
    return `rgba(251,146,60,${0.30 + t * 0.25})`;
  } else {
    const t = (ratio - 0.6) / 0.4;
    return `rgba(248,113,113,${0.55 + t * 0.35})`;
  }
}

/* ─── SVG Paths dos estados brasileiros ─────────────────────── */
// ViewBox: 0 0 760 600 (projeção simplificada mantendo proporções reais)
const ESTADOS_SVG = {
  AC: "M 80,270 L 85,285 L 100,290 L 120,300 L 135,298 L 150,310 L 148,325 L 130,330 L 110,325 L 90,330 L 70,320 L 60,305 L 65,285 Z",
  AL: "M 590,275 L 605,270 L 615,278 L 618,292 L 608,300 L 595,298 L 585,288 Z",
  AP: "M 435,90 L 455,82 L 475,88 L 490,100 L 492,118 L 478,128 L 460,130 L 440,122 L 428,108 Z",
  AM: "M 100,140 L 150,130 L 200,125 L 250,132 L 290,145 L 310,165 L 315,190 L 300,215 L 270,228 L 240,235 L 200,240 L 165,250 L 135,260 L 110,270 L 88,265 L 75,245 L 80,220 L 90,195 L 85,170 Z",
  BA: "M 490,280 L 530,268 L 565,260 L 590,265 L 605,270 L 608,300 L 600,320 L 595,345 L 575,365 L 555,378 L 530,385 L 510,390 L 490,385 L 478,370 L 472,350 L 475,328 L 480,308 Z",
  CE: "M 565,195 L 595,188 L 620,192 L 635,205 L 638,220 L 625,232 L 608,238 L 590,235 L 572,228 L 558,215 Z",
  DF: "M 455,345 L 465,342 L 470,350 L 465,358 L 455,358 L 448,352 Z",
  ES: "M 560,370 L 575,365 L 585,375 L 585,395 L 575,405 L 562,400 L 555,388 Z",
  GO: "M 420,318 L 455,308 L 478,315 L 490,330 L 488,355 L 475,368 L 455,373 L 435,370 L 415,358 L 408,340 Z",
  MA: "M 490,175 L 525,168 L 555,172 L 568,185 L 565,200 L 545,212 L 520,218 L 498,215 L 480,205 L 478,190 Z",
  MT: "M 285,270 L 330,258 L 370,255 L 398,262 L 418,275 L 422,300 L 418,325 L 400,342 L 370,350 L 340,352 L 312,345 L 292,330 L 278,310 L 278,290 Z",
  MS: "M 325,380 L 365,368 L 400,362 L 418,370 L 422,390 L 418,415 L 400,432 L 375,438 L 350,435 L 328,422 L 315,405 L 318,388 Z",
  MG: "M 465,335 L 495,325 L 530,322 L 558,328 L 572,342 L 570,365 L 558,378 L 535,385 L 508,388 L 485,382 L 465,368 L 455,352 L 458,338 Z",
  PA: "M 310,142 L 355,132 L 400,128 L 435,132 L 458,148 L 468,165 L 462,185 L 440,198 L 408,208 L 375,215 L 340,218 L 312,212 L 295,198 L 290,178 L 298,160 Z",
  PB: "M 618,242 L 640,238 L 652,245 L 650,258 L 638,265 L 622,262 L 612,253 Z",
  PR: "M 380,430 L 415,422 L 445,425 L 465,438 L 462,458 L 445,468 L 418,472 L 390,465 L 372,450 Z",
  PE: "M 558,248 L 600,242 L 635,248 L 645,258 L 638,268 L 618,272 L 590,270 L 565,265 L 552,258 Z",
  PI: "M 520,200 L 548,192 L 565,198 L 568,215 L 558,230 L 538,238 L 518,235 L 505,222 L 508,208 Z",
  RJ: "M 520,398 L 540,392 L 558,398 L 562,412 L 548,422 L 530,420 L 515,410 Z",
  RN: "M 620,215 L 645,210 L 658,220 L 655,232 L 642,238 L 625,235 L 615,225 Z",
  RS: "M 358,468 L 392,462 L 418,468 L 430,485 L 425,505 L 408,518 L 385,520 L 362,512 L 348,495 L 348,478 Z",
  RO: "M 152,255 L 188,245 L 215,248 L 232,262 L 235,282 L 225,300 L 205,312 L 180,315 L 158,305 L 142,288 L 142,270 Z",
  RR: "M 215,82 L 248,75 L 275,80 L 295,95 L 298,115 L 285,130 L 260,138 L 235,135 L 215,120 L 205,102 Z",
  SC: "M 378,455 L 408,450 L 435,455 L 445,468 L 435,480 L 410,485 L 382,480 L 368,468 Z",
  SP: "M 420,380 L 452,372 L 478,375 L 498,388 L 495,408 L 478,420 L 455,425 L 428,420 L 408,408 L 405,390 Z",
  SE: "M 595,278 L 612,274 L 618,285 L 612,295 L 598,298 L 588,290 Z",
  TO: "M 448,218 L 478,210 L 498,218 L 500,240 L 495,262 L 480,275 L 460,278 L 440,270 L 430,250 L 432,232 Z",
};

/* ─── Render principal ──────────────────────────────────────── */
function renderMapaBrasil() {
  const container = document.getElementById('mapa-brasil-container');
  if (!container) return;

  const { pitstopColabs, pitstopFlags, pevColabs, mapaEstados } = mapaLerDados();
  const ufMap = mapaAgregarUF(pitstopColabs, pitstopFlags, pevColabs, mapaEstados);

  const allTotals = Object.values(ufMap).map(d => d.total);
  const maxTotal  = Math.max(...allTotals, 1);

  const totalPIT  = pitstopColabs.length;
  const totalPEV  = pevColabs.length;
  const totalGeral = Object.values(ufMap).reduce((s, d) => s + d.total, 0);
  const estadosAtivos = Object.keys(ufMap).length;

  // Ordenação para ranking lateral
  const ranking = Object.entries(ufMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8);

  // Tooltip ativo
  let tooltipUF = null;

  /* ── Paths do mapa ── */
  const pathsHTML = Object.entries(ESTADOS_SVG).map(([uf, path]) => {
    const dados   = ufMap[uf];
    const count   = dados?.total || 0;
    const fill    = mapaHeatColor(count, maxTotal);
    const stroke  = count > 0 ? 'rgba(245,200,66,0.35)' : 'rgba(255,255,255,0.08)';
    const sw      = count > 0 ? '1.2' : '0.7';
    const lp      = LABEL_POS[uf] || { x: 0, y: 0 };
    const label   = count > 0
      ? `<text x="${lp.x}" y="${lp.y}" text-anchor="middle" dominant-baseline="middle"
           font-size="9" font-weight="700" fill="rgba(255,255,255,0.85)"
           font-family="'Outfit',sans-serif" pointer-events="none">${count}</text>` : '';

    return `
      <g class="mapa-estado" data-uf="${uf}" data-count="${count}" style="cursor:${count>0?'pointer':'default'}">
        <path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"
              stroke-linejoin="round"
              style="transition:filter 0.15s,opacity 0.15s"/>
        ${label}
      </g>`;
  }).join('');

  /* ── Ranking lateral ── */
  const rankingHTML = ranking.map(([uf, dados], i) => {
    const pct = Math.round((dados.total / maxTotal) * 100);
    const barColor = i === 0 ? '#f5c842' : i < 3 ? '#fb923c' : '#60a5fa';
    return `
      <div class="mapa-rank-item" data-uf="${uf}">
        <div class="mapa-rank-pos">${i + 1}</div>
        <div class="mapa-rank-info">
          <div class="mapa-rank-uf">${NOME_ESTADO[uf] || uf} <span class="mapa-rank-uf-badge">${uf}</span></div>
          <div class="mapa-rank-bar-wrap">
            <div class="mapa-rank-bar" style="width:${pct}%;background:${barColor}"></div>
          </div>
        </div>
        <div class="mapa-rank-count" style="color:${barColor}">${dados.total}</div>
      </div>`;
  }).join('');

  /* ── Tooltip ── */
  const tooltipHTML = `<div id="mapa-tooltip" style="display:none"></div>`;

  /* ── Botão config ── */
  const configHTML = `
    <button id="mapa-btn-config" class="mapa-btn-config" type="button" title="Configurar estados dos colaboradores PIT STOP">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M21 12h-2M5 12H3M12 21v-2M12 5V3"/></svg>
      Configurar estados PIT STOP
    </button>`;

  container.innerHTML = `
    ${tooltipHTML}
    <div class="mapa-header">
      <div class="mapa-header-left">
        <div class="mapa-titulo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".6"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
          Distribuição Geográfica
        </div>
        <div class="mapa-kpis">
          <div class="mapa-kpi"><span class="mapa-kpi-n" style="color:#f5c842">${totalGeral}</span><span class="mapa-kpi-l">Mapeados</span></div>
          <div class="mapa-kpi-sep"></div>
          <div class="mapa-kpi"><span class="mapa-kpi-n" style="color:#60a5fa">${estadosAtivos}</span><span class="mapa-kpi-l">Estados</span></div>
          <div class="mapa-kpi-sep"></div>
          <div class="mapa-kpi"><span class="mapa-kpi-n" style="color:#a78bfa">${totalPEV}</span><span class="mapa-kpi-l">PEV</span></div>
          <div class="mapa-kpi-sep"></div>
          <div class="mapa-kpi"><span class="mapa-kpi-n" style="color:#34d399">${totalPIT}</span><span class="mapa-kpi-l">PIT STOP</span></div>
        </div>
      </div>
      ${configHTML}
    </div>

    <div class="mapa-body">
      <div class="mapa-svg-wrap">
        <svg id="mapa-svg" viewBox="0 0 760 550" xmlns="http://www.w3.org/2000/svg"
             style="width:100%;height:100%;display:block">
          ${pathsHTML}
        </svg>
        <div class="mapa-legenda">
          <span>Poucos</span>
          <div class="mapa-leg-grad"></div>
          <span>Muitos</span>
        </div>
      </div>

      <div class="mapa-sidebar">
        <div class="mapa-sidebar-title">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
          Top estados
        </div>
        <div class="mapa-rank-list">
          ${ranking.length > 0 ? rankingHTML : '<div style="font-size:12px;color:rgba(255,255,255,.25);padding:8px 4px">Nenhum estado mapeado ainda.</div>'}
        </div>
        <div class="mapa-sidebar-legend">
          <div class="mapa-sidleg-item"><span class="mapa-sidleg-dot" style="background:#a78bfa"></span>PEV</div>
          <div class="mapa-sidleg-item"><span class="mapa-sidleg-dot" style="background:#34d399"></span>PIT STOP</div>
        </div>
      </div>
    </div>

    <!-- Modal config PIT STOP estados -->
    <div id="mapa-modal" style="display:none">
      <div class="mapa-modal-box">
        <div class="mapa-modal-header">
          <span>Configurar estados — PIT STOP</span>
          <button id="mapa-modal-close" type="button" class="mapa-modal-close">✕</button>
        </div>
        <p class="mapa-modal-desc">Associe cada colaborador PIT STOP a um estado para aparecer no mapa.</p>
        <div id="mapa-modal-list" class="mapa-modal-list"></div>
        <div class="mapa-modal-footer">
          <button id="mapa-modal-save" class="mapa-modal-save" type="button">Salvar</button>
        </div>
      </div>
    </div>
  `;

  /* ── Interações ── */
  mapaBindInteracoes(ufMap);
}

/* ─── Bind eventos ──────────────────────────────────────────── */
function mapaBindInteracoes(ufMap) {
  const tooltip = document.getElementById('mapa-tooltip');
  const svg     = document.getElementById('mapa-svg');
  if (!svg || !tooltip) return;

  /* hover nos estados */
  svg.querySelectorAll('.mapa-estado').forEach(g => {
    const uf    = g.dataset.uf;
    const dados = ufMap[uf];

    g.addEventListener('mouseenter', (e) => {
      const path = g.querySelector('path');
      if (path) path.style.filter = 'brightness(1.4)';

      if (!dados) return;
      const pitNomes = dados.pit.map(c => `<span class="mapa-tt-colab ${c.ativo ? '' : 'inactive'}">${c.nome}</span>`).join('');
      const pevNomes = dados.pev.map(c => `<span class="mapa-tt-colab">${c.nome}</span>`).join('');
      tooltip.innerHTML = `
        <div class="mapa-tt-header">${NOME_ESTADO[uf] || uf} <span class="mapa-tt-uf">${uf}</span></div>
        <div class="mapa-tt-total">${dados.total} colaborador${dados.total !== 1 ? 'es' : ''} ativo${dados.total !== 1 ? 's' : ''}</div>
        ${dados.pev.length > 0 ? `<div class="mapa-tt-sec"><span class="mapa-tt-tag pev">PEV ${dados.pev.length}</span><div class="mapa-tt-names">${pevNomes}</div></div>` : ''}
        ${dados.pit.length > 0 ? `<div class="mapa-tt-sec"><span class="mapa-tt-tag pit">PIT STOP ${dados.pit.length}</span><div class="mapa-tt-names">${pitNomes}</div></div>` : ''}
      `;
      tooltip.style.display = 'block';
    });

    g.addEventListener('mousemove', (e) => {
      const rect = document.getElementById('mapa-brasil-container').getBoundingClientRect();
      let tx = e.clientX - rect.left + 14;
      let ty = e.clientY - rect.top  - 10;
      if (tx + 220 > rect.width)  tx = e.clientX - rect.left - 230;
      if (ty + 150 > rect.height) ty = e.clientY - rect.top  - 160;
      tooltip.style.left = tx + 'px';
      tooltip.style.top  = ty + 'px';
    });

    g.addEventListener('mouseleave', () => {
      const path = g.querySelector('path');
      if (path) path.style.filter = '';
      tooltip.style.display = 'none';
    });
  });

  /* hover no ranking — highlight no mapa */
  document.querySelectorAll('.mapa-rank-item').forEach(item => {
    const uf = item.dataset.uf;
    item.addEventListener('mouseenter', () => {
      const g = svg.querySelector(`[data-uf="${uf}"]`);
      if (g) g.querySelector('path').style.filter = 'brightness(1.5)';
      item.style.background = 'rgba(245,200,66,0.07)';
    });
    item.addEventListener('mouseleave', () => {
      const g = svg.querySelector(`[data-uf="${uf}"]`);
      if (g) g.querySelector('path').style.filter = '';
      item.style.background = '';
    });
  });

  /* botão config */
  const btnCfg = document.getElementById('mapa-btn-config');
  if (btnCfg) btnCfg.onclick = mapaAbrirConfig;

  /* modal fechar */
  const btnClose = document.getElementById('mapa-modal-close');
  if (btnClose) btnClose.onclick = mapaFecharConfig;

  const modal = document.getElementById('mapa-modal');
  if (modal) modal.onclick = (e) => { if (e.target === modal) mapaFecharConfig(); };

  /* salvar config */
  const btnSave = document.getElementById('mapa-modal-save');
  if (btnSave) btnSave.onclick = mapaAlvarConfig;
}

/* ─── Modal de configuração de estados PIT STOP ─────────────── */
function mapaAbrirConfig() {
  const modal = document.getElementById('mapa-modal');
  const list  = document.getElementById('mapa-modal-list');
  if (!modal || !list) return;

  const { pitstopColabs, mapaEstados } = mapaLerDados();
  const ufs = Object.keys(NOME_ESTADO).sort((a, b) =>
    NOME_ESTADO[a].localeCompare(NOME_ESTADO[b]));

  const allUfs = [{ value: '', label: '— Não definido —' }].concat(
    ufs.map(uf => ({ value: uf, label: `${NOME_ESTADO[uf]} (${uf})` }))
  );

  list.innerHTML = pitstopColabs.map(c => {
    const sel     = mapaEstados[c.nome] || '';
    const selLabel = sel ? `${NOME_ESTADO[sel]} (${sel})` : '— Não definido —';
    const dotColor = c.cargo === 'Técnicos' ? '#34d399' : '#f5c842';
    return `
      <div class="mapa-modal-row">
        <div class="mapa-modal-nome">
          <span class="mapa-modal-cargo-dot" style="background:${dotColor}"></span>
          <span class="mapa-modal-nome-text">${c.nome}</span>
          <span class="mapa-modal-cargo">${c.cargo || ''}</span>
        </div>
        <div class="mapa-dd" data-nome="${c.nome}" data-value="${sel}">
          <button type="button" class="mapa-dd-btn">
            <span class="mapa-dd-label">${selLabel}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="mapa-dd-list" style="display:none">
            <div class="mapa-dd-search-wrap">
              <input type="text" class="mapa-dd-search" placeholder="Buscar estado...">
            </div>
            <div class="mapa-dd-options">
              ${allUfs.map(u => `<div class="mapa-dd-opt${u.value === sel ? ' selected' : ''}" data-val="${u.value}">${u.label}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  // Bind dos dropdowns customizados
  mapaBindDropdowns(list);

  // Move o modal para o body para garantir que position:fixed funcione corretamente,
  // evitando que fique preso dentro de containers com overflow/transform
  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';
}

/* ─── Bind dos dropdowns customizados ────────────────────── */
function mapaBindDropdowns(container) {
  // Fecha todos os dropdowns abertos
  function fecharTodos(exceto) {
    container.querySelectorAll('.mapa-dd-list').forEach(dl => {
      if (dl !== exceto) dl.style.display = 'none';
    });
    container.querySelectorAll('.mapa-dd-btn').forEach(b => b.classList.remove('open'));
  }

  container.querySelectorAll('.mapa-dd').forEach(dd => {
    const btn   = dd.querySelector('.mapa-dd-btn');
    const list  = dd.querySelector('.mapa-dd-list');
    const search = dd.querySelector('.mapa-dd-search');
    const opts  = dd.querySelector('.mapa-dd-options');

    // Abrir / fechar
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = list.style.display !== 'none';
      fecharTodos();
      if (!isOpen) {
        list.style.display = 'block';
        btn.classList.add('open');
        search.value = '';
        opts.querySelectorAll('.mapa-dd-opt').forEach(o => o.style.display = '');
        search.focus();
        // Posiciona o dropdown para não sair da tela
        const rect = dd.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 260) {
          list.style.top = 'auto';
          list.style.bottom = '100%';
          list.style.marginBottom = '4px';
          list.style.marginTop = '0';
        } else {
          list.style.top = '100%';
          list.style.bottom = 'auto';
          list.style.marginTop = '4px';
          list.style.marginBottom = '0';
        }
      }
    });

    // Busca
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      opts.querySelectorAll('.mapa-dd-opt').forEach(o => {
        o.style.display = o.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    // Selecionar opção
    opts.addEventListener('click', (e) => {
      const opt = e.target.closest('.mapa-dd-opt');
      if (!opt) return;
      const val   = opt.dataset.val;
      const label = opt.textContent.trim();
      dd.dataset.value = val;
      btn.querySelector('.mapa-dd-label').textContent = label;
      opts.querySelectorAll('.mapa-dd-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      list.style.display = 'none';
      btn.classList.remove('open');
    });
  });

  // Clique fora fecha tudo
  document.addEventListener('click', fecharTodos, { capture: false });
}

function mapaFecharConfig() {
  const modal = document.getElementById('mapa-modal');
  if (modal) modal.style.display = 'none';
}

async function mapaAlvarConfig() {
  // Lê os valores dos dropdowns customizados (data-value no .mapa-dd)
  const dropdowns = document.querySelectorAll('.mapa-dd[data-nome]');
  const mapaEstados = {};
  dropdowns.forEach(dd => {
    if (dd.dataset.value) mapaEstados[dd.dataset.nome] = dd.dataset.value;
  });

  // Salva no localStorage imediatamente (UI não trava)
  localStorage.setItem('mapa_estados_pitstop', JSON.stringify(mapaEstados));
  mapaFecharConfig();
  renderMapaBrasil();
  if (typeof window.DC_refreshDashboard === 'function') window.DC_refreshDashboard();

  // Sincroniza com Supabase em background
  if (typeof supa !== 'undefined' && supa) {
    try {
      // Monta array para upsert em lote
      const rows = Object.entries(mapaEstados).map(([colaborador_nome, uf]) => ({
        colaborador_nome,
        uf,
        atualizado_em: new Date().toISOString(),
      }));
      if (rows.length > 0) {
        const { error } = await supa
          .from('mapa_estados_pitstop')
          .upsert(rows, { onConflict: 'colaborador_nome' });
        if (error) throw error;
        console.log('✅ Mapa: estados sincronizados com Supabase —', rows.length, 'registros');
      }
    } catch (e) {
      console.error('❌ Mapa: erro ao sincronizar estados:', e.message);
      // Não reverte — localStorage já foi salvo, outro gestor verá na próxima carga
    }
  }
}

/* ─── Injetar CSS ──────────────────────────────────────────── */
function mapaInjetarCSS() {
  if (document.getElementById('mapa-brasil-styles')) return;
  const s = document.createElement('style');
  s.id = 'mapa-brasil-styles';
  s.textContent = `
#mapa-brasil-container {
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px;
  padding: 20px 22px;
  margin-bottom: 1.25rem;
  position: relative;
  overflow: visible;
}

/* Header */
.mapa-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 10px;
}
.mapa-header-left { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.mapa-titulo {
  display: flex; align-items: center; gap: 7px;
  font-size: 11.5px; font-weight: 700; color: rgba(255,255,255,.45);
  text-transform: uppercase; letter-spacing: .6px;
}
.mapa-kpis { display: flex; align-items: center; gap: 0; }
.mapa-kpi  { display: flex; flex-direction: column; align-items: center; padding: 0 14px; }
.mapa-kpi-sep { width: 1px; height: 28px; background: rgba(255,255,255,.07); }
.mapa-kpi-n { font-size: 1.25rem; font-weight: 700; line-height: 1; font-family: 'Outfit',sans-serif; }
.mapa-kpi-l { font-size: 10px; color: rgba(255,255,255,.3); margin-top: 2px; }

/* Botão config */
.mapa-btn-config {
  display: inline-flex; align-items: center; gap: 6px;
  background: transparent; border: 1px solid rgba(255,255,255,.1);
  color: rgba(255,255,255,.4); font-family: inherit; font-size: 11.5px;
  padding: 6px 12px; border-radius: 9px; cursor: pointer;
  transition: all .15s;
}
.mapa-btn-config:hover { border-color: #f5c842; color: #f5c842; }

/* Body */
.mapa-body {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 18px;
  align-items: start;
}
@media(max-width:900px) { .mapa-body { grid-template-columns: 1fr; } }

/* SVG wrap */
.mapa-svg-wrap {
  position: relative;
  width: 100%;
  max-height: 480px;
  display: flex;
  flex-direction: column;
}
.mapa-estado path { transition: filter .15s, opacity .15s; }

/* Legenda heatmap */
.mapa-legenda {
  display: flex; align-items: center; gap: 8px;
  font-size: 10px; color: rgba(255,255,255,.3); margin-top: 8px;
}
.mapa-leg-grad {
  flex: 1; max-width: 140px; height: 5px; border-radius: 99px;
  background: linear-gradient(90deg,
    rgba(245,200,66,.15),
    rgba(251,146,60,.45),
    rgba(248,113,113,.85));
}

/* Sidebar ranking */
.mapa-sidebar { display: flex; flex-direction: column; gap: 10px; }
.mapa-sidebar-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 10.5px; font-weight: 700; color: rgba(255,255,255,.35);
  text-transform: uppercase; letter-spacing: .5px;
}
.mapa-rank-list { display: flex; flex-direction: column; gap: 5px; }
.mapa-rank-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 9px;
  cursor: default; transition: background .12s;
}
.mapa-rank-pos {
  font-size: 10.5px; font-weight: 700;
  color: rgba(255,255,255,.2); min-width: 16px; text-align: center;
}
.mapa-rank-info { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.mapa-rank-uf {
  font-size: 11.5px; font-weight: 600; color: rgba(255,255,255,.75);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: flex; align-items: center; gap: 5px;
}
.mapa-rank-uf-badge {
  font-size: 9.5px; font-weight: 700;
  background: rgba(255,255,255,.07); color: rgba(255,255,255,.35);
  border-radius: 4px; padding: 1px 4px;
}
.mapa-rank-bar-wrap {
  height: 3px; background: rgba(255,255,255,.06); border-radius: 99px; overflow: hidden;
}
.mapa-rank-bar { height: 100%; border-radius: 99px; transition: width .5s ease; }
.mapa-rank-count { font-size: 14px; font-weight: 700; min-width: 24px; text-align: right; }

.mapa-sidebar-legend {
  display: flex; gap: 12px; padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,.05);
}
.mapa-sidleg-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(255,255,255,.3); }
.mapa-sidleg-dot  { width: 7px; height: 7px; border-radius: 50%; }

/* Tooltip */
#mapa-tooltip {
  position: absolute; z-index: 9999; pointer-events: none;
  background: rgba(14,14,22,0.97); border: 1px solid rgba(245,200,66,.25);
  border-radius: 12px; padding: 10px 14px; min-width: 180px; max-width: 240px;
  box-shadow: 0 8px 32px rgba(0,0,0,.6);
  animation: mapa-tt-in .1s ease;
}
@keyframes mapa-tt-in { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
.mapa-tt-header {
  font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 2px;
  display: flex; align-items: center; gap: 6px;
}
.mapa-tt-uf {
  font-size: 10px; font-weight: 700; background: rgba(245,200,66,.15);
  color: #f5c842; border-radius: 4px; padding: 1px 5px;
}
.mapa-tt-total { font-size: 11px; color: rgba(255,255,255,.4); margin-bottom: 8px; }
.mapa-tt-sec   { margin-bottom: 6px; }
.mapa-tt-tag {
  font-size: 10px; font-weight: 700; border-radius: 4px; padding: 1px 6px;
  display: inline-block; margin-bottom: 4px;
}
.mapa-tt-tag.pev { background: rgba(167,139,250,.2); color: #a78bfa; }
.mapa-tt-tag.pit { background: rgba(52,211,153,.15); color: #34d399; }
.mapa-tt-names  { display: flex; flex-wrap: wrap; gap: 3px; }
.mapa-tt-colab  {
  font-size: 11px; background: rgba(255,255,255,.07);
  color: rgba(255,255,255,.75); border-radius: 5px; padding: 2px 6px;
}
.mapa-tt-colab.inactive { opacity: .4; text-decoration: line-through; }

/* Modal config */
#mapa-modal {
  position: fixed; inset: 0; background: rgba(0,0,0,.65);
  z-index: 99999; display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.mapa-modal-box {
  background: #13131a; border: 1px solid rgba(255,255,255,.1);
  border-radius: 18px; width: 100%; max-width: 540px; max-height: 85vh;
  overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 24px 80px rgba(0,0,0,.7);
}
.mapa-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,.07);
  font-size: 14px; font-weight: 700; color: #fff;
}
.mapa-modal-close {
  background: transparent; border: none; color: rgba(255,255,255,.4);
  font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: 6px;
  transition: color .15s;
}
.mapa-modal-close:hover { color: #fff; }
.mapa-modal-desc {
  font-size: 12px; color: rgba(255,255,255,.35); padding: 10px 20px 6px;
}
.mapa-modal-list {
  overflow-y: auto; flex: 1; padding: 6px 16px 12px;
  display: flex; flex-direction: column; gap: 6px;
}
.mapa-modal-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 10px 12px; border-radius: 9px;
  background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.05);
  min-height: 44px;
}
.mapa-modal-nome {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: rgba(255,255,255,.8);
  min-width: 0; flex: 1; overflow: hidden;
}
.mapa-modal-nome-text {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex-shrink: 1; min-width: 0;
}
.mapa-modal-cargo-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.mapa-modal-cargo     { font-size: 10.5px; color: rgba(255,255,255,.3); flex-shrink: 0; white-space: nowrap; }
/* Dropdown customizado — substitui o <select> nativo */
.mapa-dd {
  position: relative; flex-shrink: 0; min-width: 190px;
}
.mapa-dd-btn {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12);
  color: rgba(255,255,255,.85); border-radius: 8px; padding: 7px 10px;
  font-size: 12px; font-family: inherit; cursor: pointer;
  transition: border-color .15s; text-align: left;
}
.mapa-dd-btn:hover, .mapa-dd-btn.open { border-color: #f5c842; color: #fff; }
.mapa-dd-btn svg { flex-shrink: 0; opacity: .5; transition: transform .15s; }
.mapa-dd-btn.open svg { transform: rotate(180deg); opacity: 1; }
.mapa-dd-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mapa-dd-list {
  position: absolute; left: 0; z-index: 999999;
  background: #1a1a26; border: 1px solid rgba(255,255,255,.12);
  border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,.7);
  width: 220px; overflow: hidden;
}
.mapa-dd-search-wrap {
  padding: 8px 8px 4px;
  border-bottom: 1px solid rgba(255,255,255,.07);
}
.mapa-dd-search {
  width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  border-radius: 6px; color: #fff; font-family: inherit; font-size: 12px;
  padding: 5px 8px; outline: none; box-sizing: border-box;
}
.mapa-dd-search:focus { border-color: #f5c842; }
.mapa-dd-search::placeholder { color: rgba(255,255,255,.3); }
.mapa-dd-options {
  max-height: 220px; overflow-y: auto; padding: 4px;
}
.mapa-dd-options::-webkit-scrollbar { width: 4px; }
.mapa-dd-options::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 99px; }
.mapa-dd-opt {
  padding: 7px 10px; border-radius: 6px; font-size: 12px;
  color: rgba(255,255,255,.75); cursor: pointer; transition: background .1s;
  white-space: nowrap;
}
.mapa-dd-opt:hover { background: rgba(255,255,255,.07); color: #fff; }
.mapa-dd-opt.selected { background: rgba(245,200,66,.15); color: #f5c842; font-weight: 600; }
.mapa-modal-footer {
  padding: 12px 20px; border-top: 1px solid rgba(255,255,255,.07);
  display: flex; justify-content: flex-end;
}
.mapa-modal-save {
  background: #f5c842; color: #0b0b0f; border: none; border-radius: 10px;
  font-family: inherit; font-size: 13px; font-weight: 700; padding: 9px 24px;
  cursor: pointer; transition: opacity .15s;
}
.mapa-modal-save:hover { opacity: .88; }
  `;
  document.head.appendChild(s);
}

/* ─── Montar no DOM ─────────────────────────────────────────── */

/* ─── Montar no DOM (VERSÃO CORRIGIDA) ─────────────────────────── */
function mapaMontarNoDOM() {
  const page = document.getElementById('page-dashboard');
  if (!page) return;
  if (document.getElementById('mapa-brasil-container')) return;

  const container = document.createElement('div');
  container.id = 'mapa-brasil-container';

  // Inserir antes do card de pausas
  const pausasCard = page.querySelector('.dash-pausas-full-card');
  if (pausasCard) pausasCard.before(container);
  else page.appendChild(container);

  mapaInjetarCSS();
  
  // ✅ CORREÇÃO: Aguardar dados antes de renderizar
  waitForMapaDataThenRender();
}

/* ─── Aguardar dados estarem prontos ─────────────────────────── */
function waitForMapaDataThenRender() {
  let attempts = 0;
  const maxAttempts = 50; // 5 segundos máximo
  
  function checkData() {
    attempts++;
    
    const pitstopColabs = JSON.parse(localStorage.getItem('pitstop_colaboradores') || '[]');
    const pevColabs = JSON.parse(localStorage.getItem('pev_colaboradores') || '[]');
    const mapaEstados = JSON.parse(localStorage.getItem('mapa_estados_pitstop') || '{}');
    
    // Mapa precisa de pelo menos um dos dois: PEV ou estados mapeados
    const hasPitStop = pitstopColabs.length > 0 && Object.keys(mapaEstados).length > 0;
    const hasPev = pevColabs.length > 0;
    const hasData = hasPitStop || hasPev;
    
    if (hasData) {
      console.log('✅ Mapa: Dados prontos, renderizando...');
      console.log('  - PIT STOP:', pitstopColabs.length, 'colaboradores');
      console.log('  - PEV:', pevColabs.length, 'colaboradores');
      console.log('  - Estados mapeados:', Object.keys(mapaEstados).length);
      renderMapaBrasil();
      
      // Sempre escuta evento de atualização PEV (não só quando vazio)
      window.addEventListener('pev-data-ready', () => {
        console.log('🔄 Mapa: PEV atualizado, re-renderizando...');
        renderMapaBrasil();
      });
    } else if (attempts < maxAttempts) {
      // Tenta novamente em 100ms
      setTimeout(checkData, 100);
    } else {
      console.warn('⚠️ Mapa: Timeout aguardando dados');
      console.warn('  Renderizando mapa vazio...');
      renderMapaBrasil(); // Renderiza vazio para não quebrar UI
      // Ainda escuta para quando dados chegarem depois
      window.addEventListener('pev-data-ready', () => {
        console.log('🔄 Mapa: PEV chegou após timeout, re-renderizando...');
        renderMapaBrasil();
      });
    }
  }
  
  checkData();
}

/* ─── Auto-refresh (VERSÃO MELHORADA) ──────────────────────────── */
function mapaStartAutoRefresh() {
  // Atualiza quando dados mudam em OUTRAS abas
  window.addEventListener('storage', (e) => {
    if (e.key && (
      e.key === 'pitstop_colaboradores' ||
      e.key === 'pev_colaboradores' ||
      e.key === 'pitstop_flags' ||
      e.key === 'mapa_estados_pitstop'
    )) {
      console.log('🔄 Mapa: Storage mudou, atualizando...');
      renderMapaBrasil();
    }
  });
  
  // Escuta eventos customizados
  window.addEventListener('system-data-ready', (e) => {
    if (e.detail && e.detail.allReady) {
      console.log('🎉 Mapa: Todos dados prontos, renderizando...');
      renderMapaBrasil();
    }
  });
  
  // Atualiza ao abrir o dashboard
  document.querySelectorAll('.tab[data-tab="dashboard"]').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(renderMapaBrasil, 100));
  });
  
  console.log('✅ Mapa: Auto-refresh configurado');
}

/* ─── Init (VERSÃO MELHORADA) ──────────────────────────────────── */
(function initMapaBrasil() {
  function doMount() {
    setTimeout(() => {
      mapaMontarNoDOM();
      mapaStartAutoRefresh();
    }, 500);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doMount);
  } else {
    doMount();
  }
})();

// API pública para refresh manual
window.MapaBrasil_refresh = renderMapaBrasil;
