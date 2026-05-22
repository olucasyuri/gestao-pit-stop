/**
 * Dashboard Rico — Gráficos e Visualizações
 * Módulo de gráficos nativos SVG para o painel operacional.
 * Injeta conteúdo adicional no #page-dashboard sem alterar a lógica original.
 */
"use strict";

/* ─── Paleta ────────────────────────────────────────────── */
const DC = {
  green:  '#4ade80',
  gold:   '#fbbf24',
  blue:   '#60a5fa',
  purple: '#a78bfa',
  red:    '#f87171',
  orange: '#fb923c',
  teal:   '#34d399',
  pink:   '#f472b6',
  muted:  'rgba(255,255,255,0.35)',
  border: 'rgba(255,255,255,0.07)',
  card:   'rgba(255,255,255,0.04)',
};

/* ─── Helpers ────────────────────────────────────────────── */
function dcEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function lerDados() {
  const colaboradores = (() => {
    try { return JSON.parse(localStorage.getItem('pitstop_colaboradores') || '[]'); } catch { return []; }
  })();
  const folgas = (() => {
    try { return JSON.parse(localStorage.getItem('pitstop_folgas') || '[]'); } catch { return []; }
  })();
  const pausas = (() => {
    try { return JSON.parse(localStorage.getItem('pitstop_pausas') || '{}'); } catch { return {}; }
  })();
  const pendencias = (() => {
    try { return JSON.parse(localStorage.getItem('pitstop_pendencias') || '[]'); } catch { return []; }
  })();
  const flags = (() => {
    try { return JSON.parse(localStorage.getItem('pitstop_flags') || '{}'); } catch { return {}; }
  })();
  const importacoes = (() => {
    try { return JSON.parse(localStorage.getItem('pev_importacoes_v1') || '[]'); } catch { return []; }
  })();
  return { colaboradores, folgas, pausas, pendencias, flags, importacoes };
}

/* ─── Gráfico de Pizza SVG ───────────────────────────────── */
function buildPie(slices, size) {
  size = size || 110;
  if (!slices || !slices.length) return '';
  var total = slices.reduce(function(s, x) { return s + x.value; }, 0);
  if (total === 0) return '';
  var r = size / 2 - 8;
  var cx = size / 2, cy = size / 2;
  var startAngle = -Math.PI / 2;
  var paths = '';
  slices.forEach(function(sl) {
    var angle = (sl.value / total) * 2 * Math.PI;
    var x1 = cx + r * Math.cos(startAngle);
    var y1 = cy + r * Math.sin(startAngle);
    var x2 = cx + r * Math.cos(startAngle + angle);
    var y2 = cy + r * Math.sin(startAngle + angle);
    var large = angle > Math.PI ? 1 : 0;
    paths += '<path d="M' + cx + ',' + cy + ' L' + x1 + ',' + y1 + ' A' + r + ',' + r + ' 0 ' + large + ',1 ' + x2 + ',' + y2 + ' Z" fill="' + dcEsc(sl.color) + '" opacity="0.92"/>';
    startAngle += angle;
  });
  paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.52) + '" fill="rgba(10,10,18,0.85)"/>';
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="display:block;filter:drop-shadow(0 2px 12px rgba(0,0,0,0.4))">' + paths + '</svg>';
}

/* ─── Gráfico de Barras ─────────────────────────────────── */
function buildBarChart(labels, values, color, maxH, w) {
  color = color || DC.blue;
  maxH = maxH || 60;
  w = w || 280;
  if (!labels || !labels.length) return '';
  var max = Math.max.apply(null, values.concat([1]));
  var barW = Math.max(14, Math.floor((w - labels.length * 4) / labels.length));
  var gap = Math.floor((w - barW * labels.length) / (labels.length + 1));
  var bars = '', texts = '';
  labels.forEach(function(lbl, i) {
    var h = Math.max(3, Math.round((values[i] / max) * maxH));
    var x = gap + i * (barW + gap);
    var y = maxH - h;
    bars += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + h + '" rx="4" fill="' + dcEsc(color) + '" opacity="0.85"/>';
    bars += '<text x="' + (x + barW / 2) + '" y="' + (y - 4) + '" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="9" font-family="Outfit,sans-serif">' + (values[i] > 0 ? values[i] : '') + '</text>';
    texts += '<text x="' + (x + barW / 2) + '" y="' + (maxH + 14) + '" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="8.5" font-family="Outfit,sans-serif">' + dcEsc(lbl) + '</text>';
  });
  return '<svg width="' + w + '" height="' + (maxH + 22) + '" viewBox="0 0 ' + w + ' ' + (maxH + 22) + '" style="display:block;overflow:visible">' + bars + texts + '</svg>';
}

/* ─── Sparkline ─────────────────────────────────────────── */
function buildSparkline(values, color, w, h) {
  color = color || DC.green;
  w = w || 120; h = h || 32;
  if (!values || values.length < 2) return '';
  var max = Math.max.apply(null, values.concat([1]));
  var min = Math.min.apply(null, values.concat([0]));
  var range = max - min || 1;
  var pts = values.map(function(v, i) {
    var x = (i / (values.length - 1)) * w;
    var y = h - ((v - min) / range) * h * 0.85 - 2;
    return x + ',' + y;
  });
  var last = pts[pts.length - 1].split(',');
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="display:block"><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + dcEsc(color) + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/><circle cx="' + last[0] + '" cy="' + last[1] + '" r="3" fill="' + dcEsc(color) + '"/></svg>';
}

/* ─── Dados dos últimos N dias ──────────────────────────── */
function ultimosDias(n) {
  n = n || 7;
  var dias = [];
  for (var i = n - 1; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var iso = d.toISOString().slice(0, 10);
    var label = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    dias.push({ iso: iso, label: label });
  }
  return dias;
}

/* ─── Render principal ──────────────────────────────────── */
function renderDashboardCharts() {
  var container = document.getElementById('dc-dashboard-charts');
  if (!container) return;

  var dados = lerDados();
  var colaboradores = dados.colaboradores;
  var folgas = dados.folgas;
  var pausas = dados.pausas;
  var pendencias = dados.pendencias;
  var flags = dados.flags;
  var importacoes = dados.importacoes;

  var dias = ultimosDias(7);
  var total = colaboradores.length;
  var tecnicos = colaboradores.filter(function(c) { return c.cargo === 'Técnicos'; }).length;
  var gestao   = colaboradores.filter(function(c) { return c.cargo === 'Gestão Pit Stop'; }).length;
  var outros   = total - tecnicos - gestao;
  var today = new Date().toISOString().slice(0, 10);

  var ausentesHoje = colaboradores.filter(function(c) {
    var f = (flags || {})[c.nome] || {};
    return f.off || f.ferias || f.atestado;
  }).length;
  var presentesHoje = total - ausentesHoje;

  var folgasPorDia = dias.map(function(d) {
    return folgas.filter(function(f) { return f.data_folga === d.iso && f.status !== 'ferias'; }).length;
  });
  var feriasPorDia = dias.map(function(d) {
    return folgas.filter(function(f) {
      if (f.status !== 'ferias' && f.tipo !== 'ferias') return false;
      var ini = f.data_folga, fim = f.data_fim || f.data_folga;
      return d.iso >= ini && d.iso <= fim;
    }).length;
  });
  var pendenciasPorDia = dias.map(function(d) {
    return pendencias.filter(function(p) { return p.criado_em && p.criado_em.slice(0,10) === d.iso; }).length;
  });
  var importacoesPorDia = dias.map(function(d) {
    return importacoes.filter(function(i) { return i.criado_em && i.criado_em.slice(0,10) === d.iso; }).length;
  });

  var impSim = importacoes.filter(function(i) { return i.importacao === 'sim'; }).length;
  var impNao = importacoes.length - impSim;
  var comPausa = colaboradores.filter(function(c) { return pausas[c.nome] && pausas[c.nome].entrada; }).length;
  var pendAbertas  = pendencias.filter(function(p) { return p.caso_aberto; }).length;
  var pendFechadas = pendencias.length - pendAbertas;

  var presPercent = total > 0 ? Math.round(presentesHoje/total*100) : 0;
  var ausPercent  = total > 0 ? Math.round(ausentesHoje/total*100)  : 0;
  var pendPercent = pendencias.length > 0 ? Math.round(pendAbertas/pendencias.length*100) : 0;
  var impPercent  = importacoes.length > 0 ? Math.round(impSim/importacoes.length*100) : 0;
  var pausaPercent = total > 0 ? Math.round(comPausa/total*100) : 0;

  /* ── Colunas de atividade ── */
  var actCols = dias.map(function(d, i) {
    var tot = folgasPorDia[i] + feriasPorDia[i] + pendenciasPorDia[i] + importacoesPorDia[i];
    var isToday = d.iso === today;
    var segs = '';
    if (folgasPorDia[i] > 0)     segs += '<div class="dc-act-seg" style="height:' + Math.min(folgasPorDia[i]*14,56) + 'px;background:' + DC.gold + ';border-radius:3px 3px 0 0"></div>';
    if (feriasPorDia[i] > 0)     segs += '<div class="dc-act-seg" style="height:' + Math.min(feriasPorDia[i]*14,56) + 'px;background:' + DC.blue + '"></div>';
    if (pendenciasPorDia[i] > 0) segs += '<div class="dc-act-seg" style="height:' + Math.min(pendenciasPorDia[i]*14,56) + 'px;background:' + DC.orange + '"></div>';
    if (importacoesPorDia[i] > 0) segs += '<div class="dc-act-seg" style="height:' + Math.min(importacoesPorDia[i]*14,56) + 'px;background:' + DC.purple + '"></div>';
    if (tot === 0) segs += '<div class="dc-act-empty"></div>';
    return '<div class="dc-act-col' + (isToday ? ' today' : '') + '"><div class="dc-act-bars">' + segs + '</div><span class="dc-act-label">' + dcEsc(d.label) + '</span>' + (isToday ? '<span class="dc-act-today-dot">●</span>' : '') + '</div>';
  }).join('');

  /* ── Lista pendências ── */
  var pendList = '';
  if (pendencias.length > 0) {
    pendList = '<div class="dc-pend-list">' + pendencias.slice(-3).reverse().map(function(p) {
      var motivo = (p.motivo || '').slice(0,40);
      if ((p.motivo||'').length > 40) motivo += '…';
      return '<div class="dc-pend-item"><span class="dc-pend-dot ' + (p.caso_aberto ? 'open' : 'closed') + '"></span><div class="dc-pend-info"><strong>' + dcEsc(p.cliente||'—') + '</strong><span>' + dcEsc(motivo||'—') + '</span></div></div>';
    }).join('') + '</div>';
  } else {
    pendList = '<div class="dc-empty-state">Nenhuma pendência registrada ainda.</div>';
  }

  /* ── Lista pausas ── */
  var pausaList = colaboradores.filter(function(c) { return pausas[c.nome] && pausas[c.nome].entrada; }).slice(0,6).map(function(c) {
    var p = pausas[c.nome];
    var av = c.nome.split(' ').map(function(w){return w[0];}).slice(0,2).join('').toUpperCase();
    return '<div class="dc-colab-row"><div class="dc-colab-av">' + dcEsc(av) + '</div><div class="dc-colab-info"><strong>' + dcEsc(c.nome) + '</strong><span>' + dcEsc(p.entrada||'--') + ' → ' + dcEsc(p.saida||'--') + '</span></div><span class="dc-colab-badge">⏱</span></div>';
  }).join('');

  /* ── Pizza pie ── */
  var piePrincFatias = [
    { value: tecnicos, color: DC.blue },
    { value: gestao,   color: DC.gold }
  ];
  if (outros > 0) piePrincFatias.push({ value: outros, color: 'rgba(255,255,255,0.2)' });

  var pieImpFatias = importacoes.length > 0
    ? [{ value: impSim, color: DC.purple }, { value: impNao, color: DC.orange }]
    : [];

  var emptyPie = '<div class="dc-empty-pie"><svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg></div>';

  container.innerHTML =
    /* KPIs */
    '<div class="dc-kpi-row">' +
      '<div class="dc-kpi-card"><div class="dc-kpi-top"><div><div class="dc-kpi-value">' + presentesHoje + '</div><div class="dc-kpi-label">Presentes hoje</div></div><div class="dc-kpi-spark">' + buildSparkline(folgasPorDia.map(function(v){return Math.max(0,total/7-v);}), DC.green) + '</div></div><div class="dc-kpi-bar-wrap"><div class="dc-kpi-bar" style="width:' + presPercent + '%;background:' + DC.green + '"></div></div><div class="dc-kpi-sub">' + presPercent + '% da equipe</div></div>' +
      '<div class="dc-kpi-card"><div class="dc-kpi-top"><div><div class="dc-kpi-value">' + ausentesHoje + '</div><div class="dc-kpi-label">Ausentes hoje</div></div><div class="dc-kpi-spark">' + buildSparkline(folgasPorDia, DC.red) + '</div></div><div class="dc-kpi-bar-wrap"><div class="dc-kpi-bar" style="width:' + ausPercent + '%;background:' + DC.red + '"></div></div><div class="dc-kpi-sub">' + (ausentesHoje === 0 ? 'Equipe completa 🎉' : ausentesHoje + ' colaborador' + (ausentesHoje > 1 ? 'es' : '') + ' fora') + '</div></div>' +
      '<div class="dc-kpi-card"><div class="dc-kpi-top"><div><div class="dc-kpi-value">' + pendencias.length + '</div><div class="dc-kpi-label">Pendências</div></div><div class="dc-kpi-spark">' + buildSparkline(pendenciasPorDia, DC.gold) + '</div></div><div class="dc-kpi-bar-wrap"><div class="dc-kpi-bar" style="width:' + pendPercent + '%;background:' + DC.gold + '"></div></div><div class="dc-kpi-sub">' + pendAbertas + ' em aberto · ' + pendFechadas + ' resolvidas</div></div>' +
      '<div class="dc-kpi-card"><div class="dc-kpi-top"><div><div class="dc-kpi-value">' + importacoes.length + '</div><div class="dc-kpi-label">Importações PEV</div></div><div class="dc-kpi-spark">' + buildSparkline(importacoesPorDia, DC.purple) + '</div></div><div class="dc-kpi-bar-wrap"><div class="dc-kpi-bar" style="width:' + impPercent + '%;background:' + DC.purple + '"></div></div><div class="dc-kpi-sub">' + impSim + ' com importação · ' + impNao + ' sem</div></div>' +
    '</div>' +

    /* Gráficos principais */
    '<div class="dc-charts-row">' +
      /* Pizza equipe */
      '<div class="dc-chart-card"><div class="dc-chart-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>Composição da Equipe</div><div class="dc-pie-layout">' + buildPie(piePrincFatias) + '<div class="dc-pie-legend"><div class="dc-legend-item"><span class="dc-legend-dot" style="background:' + DC.blue + '"></span><span class="dc-legend-lbl">Técnicos</span><strong>' + tecnicos + '</strong></div><div class="dc-legend-item"><span class="dc-legend-dot" style="background:' + DC.gold + '"></span><span class="dc-legend-lbl">Gestão</span><strong>' + gestao + '</strong></div>' + (outros > 0 ? '<div class="dc-legend-item"><span class="dc-legend-dot" style="background:rgba(255,255,255,0.2)"></span><span class="dc-legend-lbl">Outros</span><strong>' + outros + '</strong></div>' : '') + '<div class="dc-legend-divider"></div><div class="dc-legend-item"><span class="dc-legend-dot" style="background:' + DC.green + '"></span><span class="dc-legend-lbl">Presentes</span><strong>' + presentesHoje + '</strong></div><div class="dc-legend-item"><span class="dc-legend-dot" style="background:' + DC.red + '"></span><span class="dc-legend-lbl">Ausentes</span><strong>' + ausentesHoje + '</strong></div></div></div></div>' +

      /* Pizza importações */
      '<div class="dc-chart-card"><div class="dc-chart-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="#5865f2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.082.114 18.1.133 18.112a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>Importações PEV</div><div class="dc-pie-layout">' + (importacoes.length > 0 ? buildPie(pieImpFatias) : emptyPie) + '<div class="dc-pie-legend"><div class="dc-legend-item"><span class="dc-legend-dot" style="background:' + DC.purple + '"></span><span class="dc-legend-lbl">Com importação</span><strong>' + impSim + '</strong></div><div class="dc-legend-item"><span class="dc-legend-dot" style="background:' + DC.orange + '"></span><span class="dc-legend-lbl">Sem importação</span><strong>' + impNao + '</strong></div><div class="dc-legend-divider"></div><div class="dc-legend-item"><span class="dc-legend-dot" style="background:rgba(255,255,255,0.2)"></span><span class="dc-legend-lbl">Total</span><strong>' + importacoes.length + '</strong></div></div></div></div>' +

      /* Barras ausências */
      '<div class="dc-chart-card"><div class="dc-chart-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>Ausências — Últimos 7 dias</div><div class="dc-bar-area"><div class="dc-bar-chart-wrap"><div class="dc-bar-legend"><span style="color:' + DC.gold + '">■</span> Folgas</div>' + buildBarChart(dias.map(function(d){return d.label;}), folgasPorDia, DC.gold) + '</div><div class="dc-bar-separator"></div><div class="dc-bar-chart-wrap"><div class="dc-bar-legend"><span style="color:' + DC.blue + '">■</span> Férias</div>' + buildBarChart(dias.map(function(d){return d.label;}), feriasPorDia, DC.blue) + '</div></div></div>' +
    '</div>' +

    /* Linha inferior */
    '<div class="dc-bottom-row">' +
      /* Pendências */
      '<div class="dc-chart-card"><div class="dc-chart-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 5a3 3 0 0 1 6 0H9z"/></svg>Pendências — Últimos 7 dias</div>' + buildBarChart(dias.map(function(d){return d.label;}), pendenciasPorDia, DC.gold, 48, 220) + '<div style="margin-bottom:10px"></div><div class="dc-pendencias-summary"><div class="dc-pend-pill open"><strong>' + pendAbertas + '</strong> Em aberto</div><div class="dc-pend-pill closed"><strong>' + pendFechadas + '</strong> Fechadas</div><div class="dc-pend-pill total"><strong>' + pendencias.length + '</strong> Total</div></div>' + pendList + '</div>' +

      /* Anel pausas */
      '<div class="dc-chart-card"><div class="dc-chart-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>Pausas Configuradas</div><div class="dc-pause-ring-wrap"><div class="dc-pause-ring">' + buildPie([{value:comPausa,color:DC.teal},{value:Math.max(0,total-comPausa),color:'rgba(255,255,255,0.06)'}], 100) + '<div class="dc-ring-center"><strong>' + comPausa + '</strong><span>/ ' + total + '</span></div></div><div class="dc-pause-stats"><div class="dc-pause-stat"><span class="dc-pause-stat-num" style="color:' + DC.teal + '">' + comPausa + '</span><span class="dc-pause-stat-lbl">Configurados</span></div><div class="dc-pause-stat"><span class="dc-pause-stat-num" style="color:rgba(255,255,255,0.35)">' + (total - comPausa) + '</span><span class="dc-pause-stat-lbl">Pendentes</span></div><div class="dc-pause-stat"><span class="dc-pause-stat-num" style="color:' + DC.gold + '">' + pausaPercent + '%</span><span class="dc-pause-stat-lbl">Cobertura</span></div></div></div><div class="dc-colabs-com-pausa">' + (pausaList || '<div class="dc-empty-state">Use "Gerar automático" na aba Pausas.</div>') + '</div></div>' +

      /* Atividade */
      '<div class="dc-chart-card"><div class="dc-chart-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Atividade Geral — 7 dias</div><div class="dc-activity-grid">' + actCols + '</div><div class="dc-activity-legend"><span><span class="dc-legend-dot" style="background:' + DC.gold + '"></span>Folgas</span><span><span class="dc-legend-dot" style="background:' + DC.blue + '"></span>Férias</span><span><span class="dc-legend-dot" style="background:' + DC.orange + '"></span>Pendências</span><span><span class="dc-legend-dot" style="background:' + DC.purple + '"></span>Importações</span></div></div>' +
    '</div>';
}

/* ─── CSS injetado ─────────────────────────────────────── */
function injectDcCSS() {
  if (document.getElementById('dc-styles')) return;
  var style = document.createElement('style');
  style.id = 'dc-styles';
  style.textContent = [
    '#dc-dashboard-charts{margin-bottom:1.5rem}',
    '.dc-kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}',
    '@media(max-width:900px){.dc-kpi-row{grid-template-columns:repeat(2,1fr)}}',
    '@media(max-width:540px){.dc-kpi-row{grid-template-columns:1fr}}',
    '.dc-kpi-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px 18px 14px;display:flex;flex-direction:column;gap:10px;transition:border-color .2s}',
    '.dc-kpi-card:hover{border-color:rgba(255,255,255,0.14)}',
    '.dc-kpi-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}',
    '.dc-kpi-value{font-family:"Outfit",sans-serif;font-size:2rem;font-weight:700;line-height:1;color:#fff;letter-spacing:-.5px}',
    '.dc-kpi-label{font-size:11.5px;color:rgba(255,255,255,0.45);margin-top:4px;font-weight:500;letter-spacing:.3px}',
    '.dc-kpi-spark{align-self:center;opacity:.85}',
    '.dc-kpi-bar-wrap{height:3px;background:rgba(255,255,255,0.07);border-radius:99px;overflow:hidden}',
    '.dc-kpi-bar{height:100%;border-radius:99px;transition:width .6s ease}',
    '.dc-kpi-sub{font-size:11px;color:rgba(255,255,255,0.35)}',
    '.dc-charts-row{display:grid;grid-template-columns:1fr 1fr 1.6fr;gap:12px;margin-bottom:14px}',
    '@media(max-width:1100px){.dc-charts-row{grid-template-columns:1fr 1fr}}',
    '@media(max-width:700px){.dc-charts-row{grid-template-columns:1fr}}',
    '.dc-bottom-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}',
    '@media(max-width:1100px){.dc-bottom-row{grid-template-columns:1fr 1fr}}',
    '@media(max-width:700px){.dc-bottom-row{grid-template-columns:1fr}}',
    '.dc-chart-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:18px;transition:border-color .2s}',
    '.dc-chart-card:hover{border-color:rgba(255,255,255,0.12)}',
    '.dc-chart-title{display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.7px;margin-bottom:14px}',
    '.dc-pie-layout{display:flex;align-items:center;gap:16px;flex-wrap:wrap}',
    '.dc-pie-legend{display:flex;flex-direction:column;gap:6px;flex:1;min-width:100px}',
    '.dc-legend-item{display:flex;align-items:center;gap:7px;font-size:12px;color:rgba(255,255,255,0.65)}',
    '.dc-legend-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
    '.dc-legend-lbl{flex:1}',
    '.dc-legend-item strong{color:#fff;font-size:13px}',
    '.dc-legend-divider{height:1px;background:rgba(255,255,255,0.06);margin:2px 0}',
    '.dc-empty-pie{display:flex;align-items:center;justify-content:center;width:110px;height:110px}',
    '.dc-bar-area{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}',
    '.dc-bar-chart-wrap{display:flex;flex-direction:column;gap:4px}',
    '.dc-bar-legend{font-size:10.5px;color:rgba(255,255,255,0.4);margin-bottom:4px}',
    '.dc-bar-separator{width:1px;height:70px;background:rgba(255,255,255,0.06);align-self:center}',
    '.dc-pendencias-summary{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}',
    '.dc-pend-pill{font-size:11.5px;padding:4px 10px;border-radius:99px;display:flex;align-items:center;gap:5px}',
    '.dc-pend-pill.open{background:rgba(251,113,133,.12);color:#f87171;border:1px solid rgba(251,113,133,.2)}',
    '.dc-pend-pill.closed{background:rgba(74,222,128,.10);color:#4ade80;border:1px solid rgba(74,222,128,.18)}',
    '.dc-pend-pill.total{background:rgba(255,255,255,.05);color:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.08)}',
    '.dc-pend-list{display:flex;flex-direction:column;gap:6px}',
    '.dc-pend-item{display:flex;align-items:flex-start;gap:8px;padding:8px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}',
    '.dc-pend-dot{width:7px;height:7px;border-radius:50%;margin-top:4px;flex-shrink:0}',
    '.dc-pend-dot.open{background:#f87171;box-shadow:0 0 6px #f87171}',
    '.dc-pend-dot.closed{background:#4ade80}',
    '.dc-pend-info{display:flex;flex-direction:column;gap:2px}',
    '.dc-pend-info strong{font-size:12.5px;color:rgba(255,255,255,.8)}',
    '.dc-pend-info span{font-size:11px;color:rgba(255,255,255,.38)}',
    '.dc-pause-ring-wrap{display:flex;align-items:center;gap:16px;margin-bottom:14px}',
    '.dc-pause-ring{position:relative;width:100px;height:100px;flex-shrink:0}',
    '.dc-ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}',
    '.dc-ring-center strong{font-size:20px;font-weight:700;color:#fff;line-height:1}',
    '.dc-ring-center span{font-size:11px;color:rgba(255,255,255,.4)}',
    '.dc-pause-stats{display:flex;flex-direction:column;gap:8px}',
    '.dc-pause-stat{display:flex;align-items:center;gap:8px}',
    '.dc-pause-stat-num{font-size:20px;font-weight:700;font-family:"Outfit",sans-serif;min-width:32px}',
    '.dc-pause-stat-lbl{font-size:11px;color:rgba(255,255,255,.4)}',
    '.dc-colabs-com-pausa{display:flex;flex-direction:column;gap:6px}',
    '.dc-colab-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.03)}',
    '.dc-colab-av{width:28px;height:28px;border-radius:8px;background:rgba(96,165,250,0.18);color:#60a5fa;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.dc-colab-info{flex:1;display:flex;flex-direction:column;gap:1px}',
    '.dc-colab-info strong{font-size:12px;color:rgba(255,255,255,.75)}',
    '.dc-colab-info span{font-size:10.5px;color:rgba(255,255,255,.35)}',
    '.dc-colab-badge{font-size:12px;color:rgba(255,255,255,.3)}',
    '.dc-activity-grid{display:flex;align-items:flex-end;gap:6px;height:80px;margin-bottom:10px;padding:0 4px}',
    '.dc-act-col{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;position:relative}',
    '.dc-act-col.today .dc-act-label{color:#fff;font-weight:600}',
    '.dc-act-bars{display:flex;flex-direction:column-reverse;align-items:stretch;width:100%;gap:1px;min-height:56px;justify-content:flex-start}',
    '.dc-act-seg{width:100%;transition:opacity .2s;cursor:default}',
    '.dc-act-seg:hover{opacity:.75}',
    '.dc-act-empty{height:4px;background:rgba(255,255,255,.05);border-radius:2px;align-self:flex-end}',
    '.dc-act-label{font-size:9.5px;color:rgba(255,255,255,.35);text-transform:capitalize}',
    '.dc-act-today-dot{font-size:6px;color:#60a5fa;position:absolute;bottom:-10px}',
    '.dc-activity-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:10.5px;color:rgba(255,255,255,.4);align-items:center;margin-top:8px}',
    '.dc-activity-legend span{display:flex;align-items:center;gap:4px}',
    '.dc-empty-state{font-size:12px;color:rgba(255,255,255,.3);text-align:center;padding:16px 0}',
  ].join('\n');
  document.head.appendChild(style);
}

/* ─── Montagem no DOM ────────────────────────────────────── */
function mountDashboardCharts() {
  var page = document.getElementById('page-dashboard');
  if (!page) return;
  var container = document.getElementById('dc-dashboard-charts');
  if (!container) {
    container = document.createElement('div');
    container.id = 'dc-dashboard-charts';
    var grid4 = page.querySelector('.grid4');
    if (grid4) {
      grid4.after(container);
    } else {
      page.appendChild(container);
    }
  }
  injectDcCSS();
  renderDashboardCharts();
}

/* ─── Auto-refresh ───────────────────────────────────────── */
function startDashboardAutoRefresh() {
  window.addEventListener('storage', function(e) {
    if (e.key && (e.key.indexOf('pitstop_') === 0 || e.key.indexOf('pev_') === 0)) {
      renderDashboardCharts();
    }
  });
  document.querySelectorAll('.tab[data-tab="dashboard"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setTimeout(renderDashboardCharts, 80);
    });
  });
  setInterval(renderDashboardCharts, 120000);
}

/* ─── Init ───────────────────────────────────────────────── */
(function initDashboardCharts() {
  function doMount() {
    setTimeout(function() {
      mountDashboardCharts();
      startDashboardAutoRefresh();
    }, 450);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doMount);
  } else {
    doMount();
  }
})();

window.DC_refreshDashboard = renderDashboardCharts;
