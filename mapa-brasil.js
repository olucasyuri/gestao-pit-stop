/**
 * Mapa de Calor — Brasil (v3 — GeoJSON Real)
 * Usa D3.js + GeoJSON real (geometrias IBGE) para desenhar os estados.
 * Distribui colaboradores PEV (por regiao→estado) e PIT STOP (campo estado)
 * em um mapa SVG interativo com heatmap de densidade.
 */
"use strict";

/* ─── Cliente Supabase (compartilhado com gestao-pitstop.js) ──────────── */
/**
 * Retorna o cliente Supabase já instanciado por gestao-pitstop.js, ou null.
 * Usa window.supabase como fallback para criar um novo cliente se necessário.
 */
function getSupaClient() {
  // Tenta reutilizar o cliente já criado em gestao-pitstop.js
  if (typeof supa !== 'undefined' && supa) return supa;
  // Fallback: cria a partir das constantes globais (se disponíveis)
  try {
    if (
      typeof SUPABASE_URL !== 'undefined' &&
      typeof SUPABASE_ANON_KEY !== 'undefined' &&
      SUPABASE_ANON_KEY !== 'COLE_SUA_CHAVE_ANON_AQUI' &&
      window.supabase
    ) {
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  } catch (e) { /* ignorar */ }
  return null;
}

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

/* ─── URL do GeoJSON de estados ────────────────────────────── */
const GEOJSON_URL = "https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson";

/* ─── Cache do GeoJSON ──────────────────────────────────────── */
let _geoJsonCache = null;

async function mapaCarregarGeoJSON() {
  if (_geoJsonCache) return _geoJsonCache;
  try {
    const r = await fetch(GEOJSON_URL);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    _geoJsonCache = await r.json();
    return _geoJsonCache;
  } catch (e) {
    console.error('Mapa: falha ao carregar GeoJSON', e);
    return null;
  }
}

/* ─── Leitura de dados ──────────────────────────────────────── */
function mapaLerDados() {
  function tryParse(key, def) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); } catch { return def; }
  }
  const pitstopColabs  = tryParse('pitstop_colaboradores', []);
  const pitstopFlags   = tryParse('pitstop_flags', {});
  const pevColabs      = tryParse('pev_colaboradores', []);
  const mapaEstados    = tryParse('mapa_estados_pitstop', {});
  return { pitstopColabs, pitstopFlags, pevColabs, mapaEstados };
}

/**
 * Carrega os estados do mapa do Supabase e atualiza o localStorage.
 * Retorna true se encontrou dados no Supabase, false caso contrário.
 */
async function mapaCarregarEstadosSupabase() {
  const supaClient = getSupaClient();
  if (!supaClient) return false;

  try {
    const { data, error } = await supaClient
      .from('mapa_estados_pitstop')
      .select('colaborador_nome, uf');

    if (error) {
      console.warn('[mapa] Tabela mapa_estados_pitstop nao encontrada — usando localStorage.', error);
      return false;
    }

    if (data && data.length > 0) {
      const mapaEstados = {};
      data.forEach(row => {
        if (row.colaborador_nome && row.uf) {
          mapaEstados[row.colaborador_nome] = row.uf;
        }
      });
      // Mescla com localStorage: Supabase é fonte primária, mas mantém entradas locais não salvas ainda
      const localEstados = JSON.parse(localStorage.getItem('mapa_estados_pitstop') || '{}');
      const merged = Object.assign({}, localEstados, mapaEstados);
      localStorage.setItem('mapa_estados_pitstop', JSON.stringify(merged));
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[mapa] Erro ao carregar estados do Supabase:', err);
    return false;
  }
}

/**
 * Salva os estados do mapa no Supabase (upsert por colaborador_nome).
 * @param {Object} mapaEstados — { [nome]: uf }
 */
async function mapaSalvarEstadosSupabase(mapaEstados) {
  const supaClient = getSupaClient();
  if (!supaClient) return;

  const rows = Object.entries(mapaEstados).map(([nome, uf]) => ({
    colaborador_nome: nome,
    uf: uf,
  }));

  if (rows.length === 0) return;

  try {
    const { error } = await supaClient
      .from('mapa_estados_pitstop')
      .upsert(rows, { onConflict: 'colaborador_nome' });

    if (error) {
      console.warn('[mapa] Erro ao salvar estados no Supabase:', error);
    }
  } catch (err) {
    console.warn('[mapa] Erro ao salvar estados no Supabase:', err);
  }
}

/* ─── Agregar por UF ────────────────────────────────────────── */
function mapaAgregarUF(pitstopColabs, pitstopFlags, pevColabs, mapaEstados) {
  const ufMap = {};
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
  if (!count || !max) return '#1e2235';
  const ratio = count / max;
  if (ratio < 0.25)  return '#7a6f47';
  if (ratio < 0.6)   return '#c78742';
  return '#e05858';
}

/* ─── Projeção GeoJSON → SVG path com D3 ────────────────────── */
function mapaProjetarGeoJSON(geoData, width, height) {
  // Verifica se D3 está disponível
  if (typeof d3 === 'undefined') {
    console.error('Mapa: D3.js não está carregado');
    return null;
  }

  const projection = d3.geoMercator()
    .fitSize([width, height], geoData);

  const pathGen = d3.geoPath().projection(projection);
  return { pathGen, projection };
}

/* ─── Calcular centróide de feature para labels ─────────────── */
function mapaCentroide(pathGen, feature) {
  try {
    const [cx, cy] = pathGen.centroid(feature);
    if (isNaN(cx) || isNaN(cy)) return null;
    return { x: Math.round(cx), y: Math.round(cy) };
  } catch {
    return null;
  }
}

/* ─── Render principal ──────────────────────────────────────── */
async function renderMapaBrasil() {
  const container = document.getElementById('mapa-brasil-container');
  if (!container) return;

  const { pitstopColabs, pitstopFlags, pevColabs, mapaEstados } = mapaLerDados();
  const ufMap = mapaAgregarUF(pitstopColabs, pitstopFlags, pevColabs, mapaEstados);

  const allTotals  = Object.values(ufMap).map(d => d.total);
  const maxTotal   = Math.max(...allTotals, 1);
  // Conta apenas colaboradores que aparecem de fato no mapa (UF resolvida)
  const totalPIT   = Object.values(ufMap).reduce((s, d) => s + d.pit.length, 0);
  const totalPEV   = Object.values(ufMap).reduce((s, d) => s + d.pev.length, 0);
  const totalGeral = Object.values(ufMap).reduce((s, d) => s + d.total, 0);
  const estadosAtivos = Object.keys(ufMap).length;

  const ranking = Object.entries(ufMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8);

  /* ── Ranking lateral HTML ── */
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

  /* ── Botão config ── */
  const configHTML = `
    <button id="mapa-btn-config" class="mapa-btn-config" type="button" title="Configurar estados dos colaboradores PIT STOP">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M21 12h-2M5 12H3M12 21v-2M12 5V3"/></svg>
      Configurar estados PIT STOP
    </button>`;

  /* ── Estrutura HTML do container ── */
  container.innerHTML = `
    <div id="mapa-tooltip" style="display:none;position:absolute;z-index:9999;pointer-events:none"></div>
    <div class="mapa-header">
      <div class="mapa-header-left">
        <div class="mapa-titulo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".6"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
          Cobertura Operacioal
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
        <div id="mapa-svg-loading" style="display:flex;align-items:center;justify-content:center;height:380px;color:rgba(255,255,255,.3);font-size:13px;gap:10px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:mapa-spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          Carregando mapa...
        </div>
        <svg id="mapa-svg" viewBox="0 0 700 580" xmlns="http://www.w3.org/2000/svg"
             style="width:100%;height:100%;display:none"></svg>
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

  /* ── Garantir CSS injetado ── */
  mapaInjetarCSS();

  /* ── Garantir D3 carregado, depois renderizar SVG ── */
  await mapaGarantirD3();
  await mapaRenderizarSVG(ufMap, maxTotal);

  /* ── Bind eventos (ranking, modal, etc) ── */
  mapaBindInteracoes(ufMap);
}

/* ─── Garantir D3 carregado ─────────────────────────────────── */
function mapaGarantirD3() {
  return new Promise((resolve) => {
    if (typeof d3 !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js';
    s.onload = resolve;
    s.onerror = () => {
      console.error('Mapa: falha ao carregar D3');
      resolve();
    };
    document.head.appendChild(s);
  });
}

/* ─── Renderizar SVG com GeoJSON real ───────────────────────── */
async function mapaRenderizarSVG(ufMap, maxTotal) {
  const svgEl   = document.getElementById('mapa-svg');
  const loading = document.getElementById('mapa-svg-loading');
  if (!svgEl) return;

  const geoData = await mapaCarregarGeoJSON();
  if (!geoData) {
    if (loading) loading.innerHTML = '<span style="color:rgba(255,100,100,.6)">Erro ao carregar dados geográficos.</span>';
    return;
  }

  const VW = 700, VH = 580;
  const { pathGen } = mapaProjetarGeoJSON(geoData, VW, VH);
  if (!pathGen) return;

  // Limpar SVG
  svgEl.innerHTML = '';

  // Grupo principal
  const ns = 'http://www.w3.org/2000/svg';
  const gEstados = document.createElementNS(ns, 'g');
  gEstados.setAttribute('id', 'mapa-estados-group');

  geoData.features.forEach(feature => {
    const sigla = (feature.properties.sigla || '').toUpperCase();
    const dados  = ufMap[sigla];
    const count  = dados?.total || 0;
    const fill   = mapaHeatColor(count, maxTotal);
    const stroke = count > 0 ? 'rgba(245,200,66,0.4)' : 'rgba(255,255,255,0.10)';
    const sw     = count > 0 ? '1.2' : '0.5';

    const pathD = pathGen(feature);
    if (!pathD) return;

    // Grupo por estado
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'mapa-estado');
    g.setAttribute('data-uf', sigla);
    g.setAttribute('data-count', count);
    g.style.cursor = count > 0 ? 'pointer' : 'default';

    // Path do estado
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', fill);
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', sw);
    path.setAttribute('stroke-linejoin', 'round');
    path.style.transition = 'filter 0.15s, opacity 0.15s';
    g.appendChild(path);

    // Label com contagem (só se tem colaboradores)
    if (count > 0) {
      const centro = mapaCentroide(pathGen, feature);
      if (centro) {
        // Círculo de fundo para o número
        const circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('cx', centro.x);
        circle.setAttribute('cy', centro.y);
        circle.setAttribute('r', '9');
        circle.setAttribute('fill', 'rgba(0,0,0,0.5)');
        circle.setAttribute('pointer-events', 'none');
        g.appendChild(circle);

        const text = document.createElementNS(ns, 'text');
        text.setAttribute('x', centro.x);
        text.setAttribute('y', centro.y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('font-size', count >= 10 ? '7.5' : '8.5');
        text.setAttribute('font-weight', '700');
        text.setAttribute('fill', '#fff');
        text.setAttribute('pointer-events', 'none');
        text.setAttribute('font-family', "'Outfit', sans-serif");
        text.textContent = count;
        g.appendChild(text);
      }
    }

    // Sigla do estado (sempre visível em pequeno)
    const centro = mapaCentroide(pathGen, feature);
    if (centro && count === 0) {
      const siglaText = document.createElementNS(ns, 'text');
      siglaText.setAttribute('x', centro.x);
      siglaText.setAttribute('y', centro.y);
      siglaText.setAttribute('text-anchor', 'middle');
      siglaText.setAttribute('dominant-baseline', 'central');
      siglaText.setAttribute('font-size', '7');
      siglaText.setAttribute('font-weight', '600');
      siglaText.setAttribute('fill', 'rgba(255,255,255,0.25)');
      siglaText.setAttribute('pointer-events', 'none');
      siglaText.setAttribute('font-family', "'Outfit', sans-serif");
      siglaText.textContent = sigla;
      g.appendChild(siglaText);
    }

    gEstados.appendChild(g);
  });

  svgEl.appendChild(gEstados);

  // Mostrar SVG, esconder loading
  if (loading) loading.style.display = 'none';
  svgEl.style.display = 'block';

  // Bind tooltip no SVG
  mapaBindTooltip(ufMap);
}

/* ─── Bind tooltip ──────────────────────────────────────────── */
function mapaBindTooltip(ufMap) {
  const tooltip   = document.getElementById('mapa-tooltip');
  const svg       = document.getElementById('mapa-svg');
  const container = document.getElementById('mapa-brasil-container');
  if (!svg || !tooltip || !container) return;

  svg.querySelectorAll('.mapa-estado').forEach(g => {
    const uf    = g.dataset.uf;
    const dados = ufMap[uf];

    g.addEventListener('mouseenter', () => {
      const path = g.querySelector('path');
      if (path) path.style.filter = 'brightness(1.5)';
      if (!dados) return;

      const pitNomes = dados.pit.map(c =>
        `<span class="mapa-tt-colab ${c.ativo ? '' : 'inactive'}">${c.nome}</span>`
      ).join('');
      const pevNomes = dados.pev.map(c =>
        `<span class="mapa-tt-colab">${c.nome}</span>`
      ).join('');

      const pitAtivos = dados.pit.filter(c => c.ativo).length;
      const totalTooltip = pitAtivos + dados.pev.length;
      tooltip.innerHTML = `
        <div class="mapa-tt-header">${NOME_ESTADO[uf] || uf} <span class="mapa-tt-uf">${uf}</span></div>
        <div class="mapa-tt-total">${totalTooltip} colaborador${totalTooltip !== 1 ? 'es' : ''} ativo${totalTooltip !== 1 ? 's' : ''}</div>
        ${dados.pev.length > 0 ? `<div class="mapa-tt-sec"><span class="mapa-tt-tag pev">PEV ${dados.pev.length}</span><div class="mapa-tt-names">${pevNomes}</div></div>` : ''}
        ${dados.pit.length > 0 ? `<div class="mapa-tt-sec"><span class="mapa-tt-tag pit">PIT STOP ${dados.pit.length}</span><div class="mapa-tt-names">${pitNomes}</div></div>` : ''}
      `;
      tooltip.style.display = 'block';
    });

    g.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      let tx = e.clientX - rect.left + 14;
      let ty = e.clientY - rect.top  - 10;
      if (tx + 230 > rect.width)  tx = e.clientX - rect.left - 244;
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
}

/* ─── Bind interações gerais ────────────────────────────────── */
function mapaBindInteracoes(ufMap) {
  const svg = document.getElementById('mapa-svg');

  // hover no ranking — highlight no mapa
  document.querySelectorAll('.mapa-rank-item').forEach(item => {
    const uf = item.dataset.uf;
    item.addEventListener('mouseenter', () => {
      if (svg) {
        const g = svg.querySelector(`[data-uf="${uf}"]`);
        if (g) { const p = g.querySelector('path'); if (p) p.style.filter = 'brightness(1.6)'; }
      }
      item.style.background = 'rgba(245,200,66,0.07)';
    });
    item.addEventListener('mouseleave', () => {
      if (svg) {
        const g = svg.querySelector(`[data-uf="${uf}"]`);
        if (g) { const p = g.querySelector('path'); if (p) p.style.filter = ''; }
      }
      item.style.background = '';
    });
  });

  // botão config
  const btnCfg = document.getElementById('mapa-btn-config');
  if (btnCfg) btnCfg.onclick = mapaAbrirConfig;

  // modal fechar
  const btnClose = document.getElementById('mapa-modal-close');
  if (btnClose) btnClose.onclick = mapaFecharConfig;

  const modal = document.getElementById('mapa-modal');
  if (modal) modal.onclick = (e) => { if (e.target === modal) mapaFecharConfig(); };

  // salvar config
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
    NOME_ESTADO[a].localeCompare(NOME_ESTADO[b])
  );

  list.innerHTML = pitstopColabs.map(c => {
    const cur = mapaEstados[c.nome] || '';
    const opts = ufs.map(uf =>
      `<option value="${uf}" ${cur === uf ? 'selected' : ''}>${NOME_ESTADO[uf]} (${uf})</option>`
    ).join('');
    return `
      <div class="mapa-modal-row" data-colab="${c.nome}">
        <div class="mapa-modal-nome">
          <span class="mapa-modal-cargo-dot" style="background:${c.cor || '#60a5fa'}"></span>
          <span class="mapa-modal-nome-text">${c.nome}</span>
          <span class="mapa-modal-cargo">${c.cargo || ''}</span>
        </div>
        <div class="mapa-dd" id="mapa-dd-${c.nome.replace(/\s/g,'_')}">
          <button class="mapa-dd-btn" type="button" data-value="${cur}" data-colab="${c.nome}">
            <span class="mapa-dd-label">${cur ? NOME_ESTADO[cur] + ' (' + cur + ')' : 'Selecionar estado...'}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="mapa-dd-list" style="display:none">
            <div class="mapa-dd-search-wrap">
              <input class="mapa-dd-search" type="text" placeholder="Buscar estado...">
            </div>
            <div class="mapa-dd-options">
              <div class="mapa-dd-opt ${!cur ? 'selected' : ''}" data-value="">— Sem estado —</div>
              ${ufs.map(uf =>
                `<div class="mapa-dd-opt ${cur === uf ? 'selected' : ''}" data-value="${uf}">${NOME_ESTADO[uf]} (${uf})</div>`
              ).join('')}
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  // Bind dropdown customizado
  list.querySelectorAll('.mapa-dd').forEach(dd => {
    const btn   = dd.querySelector('.mapa-dd-btn');
    const dpList = dd.querySelector('.mapa-dd-list');
    const search = dd.querySelector('.mapa-dd-search');
    const opts2  = dd.querySelectorAll('.mapa-dd-opt');

    btn.onclick = (e) => {
      e.stopPropagation();
      const isOpen = dpList.style.display !== 'none';
      // Fechar todos os outros
      document.querySelectorAll('.mapa-dd-list').forEach(dl => dl.style.display = 'none');
      document.querySelectorAll('.mapa-dd-btn').forEach(b => b.classList.remove('open'));
      if (!isOpen) {
        dpList.style.display = 'block';
        btn.classList.add('open');
        // Posicionar acima ou abaixo
        const rect  = btn.getBoundingClientRect();
        const above = rect.top > 250;
        dpList.style.bottom = above ? (btn.offsetHeight + 4) + 'px' : 'auto';
        dpList.style.top    = above ? 'auto' : (btn.offsetHeight + 4) + 'px';
        if (search) search.focus();
      }
    };

    if (search) {
      search.oninput = () => {
        const q = search.value.toLowerCase();
        opts2.forEach(opt => {
          opt.style.display = opt.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      };
    }

    opts2.forEach(opt => {
      opt.onclick = () => {
        const val   = opt.dataset.value;
        const label = val ? `${NOME_ESTADO[val]} (${val})` : 'Selecionar estado...';
        btn.querySelector('.mapa-dd-label').textContent = label;
        btn.dataset.value = val;
        opts2.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        dpList.style.display = 'none';
        btn.classList.remove('open');
      };
    });
  });

  document.addEventListener('click', function fecharDDs(e) {
    if (!e.target.closest('.mapa-dd')) {
      document.querySelectorAll('.mapa-dd-list').forEach(dl => dl.style.display = 'none');
      document.querySelectorAll('.mapa-dd-btn').forEach(b => b.classList.remove('open'));
    }
  }, { once: false, capture: false });

  modal.style.display = 'flex';
}

function mapaFecharConfig() {
  const modal = document.getElementById('mapa-modal');
  if (modal) modal.style.display = 'none';
}

async function mapaAlvarConfig() {
  const list = document.getElementById('mapa-modal-list');
  if (!list) return;

  const mapaEstados = {};
  list.querySelectorAll('.mapa-dd-btn').forEach(btn => {
    const colab = btn.dataset.colab;
    const uf    = btn.dataset.value;
    if (colab && uf) mapaEstados[colab] = uf;
  });

  // 1. Persiste no localStorage (fallback imediato)
  localStorage.setItem('mapa_estados_pitstop', JSON.stringify(mapaEstados));

  // 2. Persiste no Supabase (fonte primária — garante que recarregar a página mantém os dados)
  await mapaSalvarEstadosSupabase(mapaEstados);

  mapaFecharConfig();
  renderMapaBrasil();
  if (typeof toast === 'function') toast('✅ Estados salvos no mapa.');
}

/* ─── CSS injetado ──────────────────────────────────────────── */
function mapaInjetarCSS() {
  if (document.getElementById('mapa-brasil-css')) return;
  const s = document.createElement('style');
  s.id = 'mapa-brasil-css';
  s.textContent = `
@keyframes mapa-spin {
  to { transform: rotate(360deg); }
}
#mapa-brasil-container {
  position: relative;
  background: #1a1d2e;
  border-radius: 16px;
  padding: 22px 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5);
  overflow: hidden;
}
.mapa-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.mapa-header-left { display: flex; flex-direction: column; gap: 10px; }
.mapa-titulo {
  display: flex; align-items: center; gap: 8px;
  font-size: 15px; font-weight: 700; color: #fff;
}
.mapa-kpis {
  display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
}
.mapa-kpi {
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px; padding: 5px 12px;
}
.mapa-kpi-n { font-size: 17px; font-weight: 800; line-height: 1; }
.mapa-kpi-l { font-size: 10px; color: rgba(255,255,255,.4); letter-spacing: .03em; }
.mapa-kpi-sep { width: 1px; height: 28px; background: rgba(255,255,255,.07); margin: 0 2px; }

.mapa-body {
  display: flex; gap: 16px; align-items: flex-start;
}
.mapa-svg-wrap {
  flex: 1; min-width: 0;
  background: rgba(255,255,255,0.02);
  border-radius: 12px;
  padding: 12px;
  display: flex; flex-direction: column; gap: 10px;
}
#mapa-svg path { transition: filter .18s; }

.mapa-legenda {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; color: rgba(255,255,255,.35); padding: 0 4px;
}
.mapa-leg-grad {
  flex: 1; height: 6px; border-radius: 99px;
  background: linear-gradient(90deg, #7a6f47, #c78742, #e05858);
}

/* Sidebar / ranking */
.mapa-sidebar {
  width: 200px; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 10px;
}
.mapa-sidebar-title {
  font-size: 10.5px; font-weight: 700; color: rgba(255,255,255,.4);
  text-transform: uppercase; letter-spacing: .06em;
  display: flex; align-items: center; gap: 5px;
}
.mapa-rank-list { display: flex; flex-direction: column; gap: 4px; }
.mapa-rank-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 8px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,.04);
  transition: background .12s; cursor: default;
}
.mapa-rank-pos {
  font-size: 11px; font-weight: 700; color: rgba(255,255,255,.3);
  min-width: 14px; text-align: center;
}
.mapa-rank-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.mapa-rank-uf {
  font-size: 11.5px; font-weight: 600; color: rgba(255,255,255,.8);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mapa-rank-uf-badge {
  font-size: 9.5px; color: rgba(255,255,255,.3); font-weight: 500;
}
.mapa-rank-bar-wrap {
  height: 3px; background: rgba(255,255,255,.07); border-radius: 99px; overflow: hidden;
}
.mapa-rank-bar { height: 100%; border-radius: 99px; transition: width .4s ease; }
.mapa-rank-count {
  font-size: 13px; font-weight: 800; flex-shrink: 0;
}
.mapa-sidebar-legend {
  display: flex; gap: 10px; flex-wrap: wrap;
  padding-top: 6px; border-top: 1px solid rgba(255,255,255,.06);
}
.mapa-sidleg-item {
  display: flex; align-items: center; gap: 5px;
  font-size: 10.5px; color: rgba(255,255,255,.35);
}
.mapa-sidleg-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }

/* Tooltip */
#mapa-tooltip {
  background: rgba(14,16,32,0.97);
  border: 1px solid rgba(245,200,66,0.35);
  border-radius: 12px; padding: 12px 16px;
  min-width: 180px; max-width: 270px;
  box-shadow: 0 8px 32px rgba(0,0,0,.7);
}
.mapa-tt-header {
  font-size: 13px; font-weight: 700; color: #fff;
  margin-bottom: 3px; display: flex; align-items: center; gap: 7px;
}
.mapa-tt-uf {
  font-size: 9.5px; font-weight: 700;
  background: rgba(245,200,66,.18); color: #f5c842;
  border-radius: 4px; padding: 2px 6px;
}
.mapa-tt-total {
  font-size: 11.5px; color: rgba(255,255,255,.5); margin-bottom: 9px;
}
.mapa-tt-sec { margin-bottom: 7px; }
.mapa-tt-tag {
  font-size: 9.5px; font-weight: 700; border-radius: 4px;
  padding: 2px 7px; display: inline-block; margin-bottom: 5px;
}
.mapa-tt-tag.pev { background: rgba(167,139,250,.22); color: #b4a0ff; }
.mapa-tt-tag.pit { background: rgba(52,211,153,.18); color: #5ae4b8; }
.mapa-tt-names { display: flex; flex-wrap: wrap; gap: 4px; }
.mapa-tt-colab {
  font-size: 11px; background: rgba(255,255,255,.08);
  color: rgba(255,255,255,.82); border-radius: 5px;
  padding: 3px 8px; border: 1px solid rgba(255,255,255,.07);
}
.mapa-tt-colab.inactive { opacity: .35; text-decoration: line-through; }

/* Botão config */
.mapa-btn-config {
  background: rgba(245,200,66,.1); border: 1px solid rgba(245,200,66,.22);
  color: #f5c842; border-radius: 10px; padding: 8px 14px;
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all .18s; display: inline-flex; align-items: center; gap: 6px;
  font-family: inherit;
}
.mapa-btn-config:hover {
  background: rgba(245,200,66,.18); border-color: rgba(245,200,66,.4);
}

/* Modal */
#mapa-modal {
  position: fixed; inset: 0; background: rgba(0,0,0,.6);
  z-index: 99999; display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(4px);
}
.mapa-modal-box {
  background: #14162a; border: 1px solid rgba(255,255,255,.1);
  border-radius: 16px; width: 90%; max-width: 560px;
  max-height: 80vh; display: flex; flex-direction: column;
  box-shadow: 0 24px 64px rgba(0,0,0,.8);
  overflow: hidden;
}
.mapa-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,.07);
  font-size: 14px; font-weight: 700; color: #fff;
}
.mapa-modal-close {
  background: rgba(255,255,255,.07); border: none; color: rgba(255,255,255,.5);
  width: 28px; height: 28px; border-radius: 7px; cursor: pointer;
  font-size: 14px; display: flex; align-items: center; justify-content: center;
  transition: background .12s; font-family: inherit;
}
.mapa-modal-close:hover { background: rgba(255,80,80,.2); color: #ff6b6b; }
.mapa-modal-desc {
  font-size: 12px; color: rgba(255,255,255,.4); padding: 10px 20px 0;
}
.mapa-modal-list {
  flex: 1; overflow-y: auto; padding: 12px 20px; display: flex; flex-direction: column; gap: 6px;
}
.mapa-modal-list::-webkit-scrollbar { width: 4px; }
.mapa-modal-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 99px; }
.mapa-modal-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.04);
}
.mapa-modal-nome {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: rgba(255,255,255,.8);
  min-width: 0; flex: 1; overflow: hidden;
}
.mapa-modal-nome-text {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1; min-width: 0;
}
.mapa-modal-cargo-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.mapa-modal-cargo { font-size: 10.5px; color: rgba(255,255,255,.3); flex-shrink: 0; white-space: nowrap; }
/* Dropdown */
.mapa-dd { position: relative; flex-shrink: 0; min-width: 190px; }
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
  padding: 8px 8px 4px; border-bottom: 1px solid rgba(255,255,255,.07);
}
.mapa-dd-search {
  width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  border-radius: 6px; color: #fff; font-family: inherit; font-size: 12px;
  padding: 5px 8px; outline: none; box-sizing: border-box;
}
.mapa-dd-search:focus { border-color: #f5c842; }
.mapa-dd-search::placeholder { color: rgba(255,255,255,.3); }
.mapa-dd-options { max-height: 220px; overflow-y: auto; padding: 4px; }
.mapa-dd-options::-webkit-scrollbar { width: 4px; }
.mapa-dd-options::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 99px; }
.mapa-dd-opt {
  padding: 7px 10px; border-radius: 6px; font-size: 12px;
  color: rgba(255,255,255,.75); cursor: pointer; transition: background .1s; white-space: nowrap;
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

@media (max-width: 768px) {
  .mapa-body { flex-direction: column; }
  .mapa-sidebar { width: 100%; }
}
  `;
  document.head.appendChild(s);
}

/* ─── Montar no DOM ─────────────────────────────────────────── */
function mapaMontarNoDOM() {
  const page = document.getElementById('page-dashboard');
  if (!page) return;
  if (document.getElementById('mapa-brasil-container')) return;

  const container = document.createElement('div');
  container.id = 'mapa-brasil-container';

  const pausasCard = page.querySelector('.dash-pausas-full-card');
  if (pausasCard) pausasCard.before(container);
  else page.appendChild(container);

  mapaInjetarCSS();
  // waitForMapaDataThenRender já carrega Supabase antes do primeiro render
  waitForMapaDataThenRender();
}

/* ─── Aguardar dados estarem prontos ─────────────────────────── */
async function waitForMapaDataThenRender() {
  // 1. Tenta carregar estados do Supabase ANTES do primeiro render
  //    para garantir que ao recarregar a página os dados apareçam corretamente.
  await mapaCarregarEstadosSupabase();

  let attempts = 0;
  const maxAttempts = 50;

  function checkData() {
    attempts++;
    const pitstopColabs = JSON.parse(localStorage.getItem('pitstop_colaboradores') || '[]');
    const pevColabs     = JSON.parse(localStorage.getItem('pev_colaboradores') || '[]');

    const hasPitStop = pitstopColabs.length > 0;
    const hasPev     = pevColabs.length > 0;

    if (hasPitStop || hasPev) {
      renderMapaBrasil();
      window.addEventListener('pev-data-ready', () => renderMapaBrasil());
    } else if (attempts < maxAttempts) {
      setTimeout(checkData, 100);
    } else {
      renderMapaBrasil(); // renderiza vazio
      window.addEventListener('pev-data-ready', () => renderMapaBrasil());
    }
  }

  checkData();
}

/* ─── Auto-refresh ──────────────────────────────────────────── */
function mapaStartAutoRefresh() {
  window.addEventListener('storage', (e) => {
    if (e.key && [
      'pitstop_colaboradores', 'pev_colaboradores',
      'pitstop_flags', 'mapa_estados_pitstop'
    ].includes(e.key)) {
      renderMapaBrasil();
    }
  });

  window.addEventListener('system-data-ready', (e) => {
    if (e.detail && e.detail.allReady) renderMapaBrasil();
  });

  document.querySelectorAll('.tab[data-tab="dashboard"]').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(renderMapaBrasil, 100));
  });
}

/* ─── Init ──────────────────────────────────────────────────── */
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

// API pública
window.MapaBrasil_refresh = renderMapaBrasil;
