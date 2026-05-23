/**
 * Dashboard Rico — Gráficos e Visualizações v2
 * Layout compacto, cards PEV Importações e Pendências, Folgas/Férias enxutos.
 */
"use strict";

/* ─── Paleta ────────────────────────────────────────────── */
const DC = {
  green:  '#4ade80',
  gold:   '#f5c842',
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

/* ─── Helpers ─────────────────────────────────────────── */
function dcEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function lerDados() {
  function tryParse(key, def) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); } catch { return def; }
  }
  return {
    colaboradores: tryParse('pitstop_colaboradores', []),
    folgas:        tryParse('pitstop_folgas', []),
    pausas:        tryParse('pitstop_pausas', {}),
    pendencias:    tryParse('pitstop_pendencias', []),
    flags:         tryParse('pitstop_flags', {}),
    importacoes:   tryParse('pev_importacoes_v1', []),
  };
}

/* ─── Gráfico de Pizza SVG (donut) ───────────────────── */
function buildPie(slices, size) {
  size = size || 100;
  if (!slices || !slices.length) return '';
  var total = slices.reduce(function(s, x) { return s + x.value; }, 0);
  if (total === 0) return '';
  var r = size / 2 - 7;
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
    paths += '<path d="M' + cx + ',' + cy + ' L' + x1 + ',' + y1 + ' A' + r + ',' + r + ' 0 ' + large + ',1 ' + x2 + ',' + y2 + ' Z" fill="' + dcEsc(sl.color) + '" opacity="0.9"/>';
    startAngle += angle;
  });
  paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.55) + '" fill="rgba(10,10,18,0.9)"/>';
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="display:block;flex-shrink:0;filter:drop-shadow(0 2px 10px rgba(0,0,0,0.35))">' + paths + '</svg>';
}

/* ─── Mini barras horizontais ─────────────────────────── */
function buildHorizBar(label, value, max, color, total) {
  var pct = max > 0 ? Math.round((value / max) * 100) : 0;
  var pctOfTotal = total > 0 ? Math.round((value / total) * 100) : 0;
  return '<div class="dc2-hbar-row">' +
    '<div class="dc2-hbar-label">' + dcEsc(label) + '</div>' +
    '<div class="dc2-hbar-track"><div class="dc2-hbar-fill" style="width:' + pct + '%;background:' + dcEsc(color) + '"></div></div>' +
    '<div class="dc2-hbar-val" style="color:' + dcEsc(color) + '">' + value + '<span class="dc2-hbar-pct"> ' + pctOfTotal + '%</span></div>' +
    '</div>';
}

/* ─── Sparkline ─────────────────────────────────────── */
function buildSparkline(values, color, w, h) {
  color = color || DC.green;
  w = w || 100; h = h || 28;
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
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="display:block">' +
    '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + dcEsc(color) + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>' +
    '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.5" fill="' + dcEsc(color) + '"/>' +
    '</svg>';
}

/* ─── Últimos N dias ────────────────────────────────── */
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

/* ─── Ícones SVG inline ────────────────────────────── */
var ICONS = {
  users:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>',
  calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  clock:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  list:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 5a3 3 0 0 1 6 0H9z"/><path d="M9 12h6M9 16h4"/></svg>',
  import:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  activity: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  beach:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/></svg>',
  trend:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
};

/* ─── Render principal ──────────────────────────────── */
function renderDashboardCharts() {
  var container = document.getElementById('dc-dashboard-charts');
  if (!container) return;

  var dados = lerDados();
  var colaboradores = dados.colaboradores;
  var folgas        = dados.folgas;
  var pausas        = dados.pausas;
  var pendencias    = dados.pendencias;
  var flags         = dados.flags;
  var importacoes   = dados.importacoes;
  var dias          = ultimosDias(7);
  var today         = new Date().toISOString().slice(0, 10);

  /* ── Cálculos base ── */
  var total    = colaboradores.length;
  var tecnicos = colaboradores.filter(function(c) { return c.cargo === 'Técnicos'; }).length;
  var gestao   = colaboradores.filter(function(c) { return c.cargo === 'Gestão Pit Stop'; }).length;
  var outros   = total - tecnicos - gestao;

  var ausentesHoje  = colaboradores.filter(function(c) { var f = (flags||{})[c.nome]||{}; return f.off||f.ferias||f.atestado; }).length;
  var presentesHoje = total - ausentesHoje;
  var presPercent   = total > 0 ? Math.round(presentesHoje / total * 100) : 0;

  var comPausa    = colaboradores.filter(function(c) { return pausas[c.nome] && pausas[c.nome].entrada; }).length;
  var pausaPercent = total > 0 ? Math.round(comPausa / total * 100) : 0;

  /* Folgas e Férias */
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var folgasAtivas  = folgas.filter(function(f) { return f.status !== 'ferias' && f.tipo !== 'ferias' && new Date(f.data_folga + 'T00:00:00') >= hoje; });
  var feriasAtivas  = folgas.filter(function(f) {
    return (f.status === 'ferias' || f.tipo === 'ferias') && new Date((f.data_fim||f.data_folga) + 'T00:00:00') >= hoje;
  });
  var folgasHoje    = folgas.filter(function(f) { return f.data_folga === today && f.status !== 'ferias' && f.tipo !== 'ferias'; });
  var feriasHoje    = folgas.filter(function(f) {
    if (f.status !== 'ferias' && f.tipo !== 'ferias') return false;
    return today >= f.data_folga && today <= (f.data_fim || f.data_folga);
  });
  var proxFolgas    = folgasAtivas.slice(0, 4);
  var proxFerias    = feriasAtivas.slice(0, 4);

  /* Pendências */
  var pendAbertas  = pendencias.filter(function(p) { return p.caso_aberto; }).length;
  var pendCasoAb   = pendencias.filter(function(p) { return p.caso_aberto; }).length;
  var pendFechadas = pendencias.length - pendAbertas;
  var pendPercent  = pendencias.length > 0 ? Math.round(pendAbertas / pendencias.length * 100) : 0;
  var pendRecentes = pendencias.slice(-4).reverse();

  /* Importações */
  var impSim      = importacoes.filter(function(i) { return i.importacao === 'sim'; }).length;
  var impNao      = importacoes.length - impSim;
  var impPercent  = importacoes.length > 0 ? Math.round(impSim / importacoes.length * 100) : 0;
  var impRecentes = importacoes.slice(0, 5);

  /* Séries 7 dias */
  var folgasSerie     = dias.map(function(d) { return folgas.filter(function(f) { return f.data_folga === d.iso && f.status !== 'ferias' && f.tipo !== 'ferias'; }).length; });
  var feriasSerie     = dias.map(function(d) { return folgas.filter(function(f) { if(f.status !== 'ferias'&&f.tipo !== 'ferias') return false; return d.iso >= f.data_folga && d.iso <= (f.data_fim||f.data_folga); }).length; });
  var pendSerie       = dias.map(function(d) { return pendencias.filter(function(p) { return p.criado_em && p.criado_em.slice(0,10) === d.iso; }).length; });
  var importSerie     = dias.map(function(d) { return importacoes.filter(function(i) { return i.criado_em && i.criado_em.slice(0,10) === d.iso; }).length; });
  var presenteSerie   = dias.map(function(d) {
    var ausNoDia = folgas.filter(function(f) { return f.data_folga === d.iso || (d.iso >= f.data_folga && d.iso <= (f.data_fim||f.data_folga)); }).length;
    return Math.max(0, total - ausNoDia);
  });

  /* Cor presença */
  var presColor = presPercent >= 80 ? DC.green : presPercent >= 60 ? DC.gold : DC.red;
  var pausaColor = pausaPercent >= 80 ? DC.green : pausaPercent >= 60 ? DC.gold : DC.red;

  /* ── Construção do HTML ── */

  /* === ROW 1: KPI compactos (6 colunas) === */
  var kpiRow = '<div class="dc2-kpi-row">' +
    dcKpi('Presentes', presentesHoje, presColor, buildSparkline(presenteSerie, presColor), presPercent + '% da equipe', ICONS.users) +
    dcKpi('Ausentes hoje', ausentesHoje, DC.red, buildSparkline(folgasSerie.map(function(v,i){return v+feriasSerie[i];}), DC.red), ausentesHoje === 0 ? 'Equipe completa 🎉' : ausentesHoje + ' fora hoje', ICONS.beach) +
    dcKpi('Folgas futuras', folgasAtivas.length, DC.gold, buildSparkline(folgasSerie, DC.gold), folgasHoje.length + ' hoje · ' + folgasAtivas.length + ' agendadas', ICONS.calendar) +
    dcKpi('Férias ativas', feriasAtivas.length, DC.blue, buildSparkline(feriasSerie, DC.blue), feriasHoje.length + ' hoje · ' + feriasAtivas.length + ' agendadas', ICONS.beach) +
    dcKpi('Pendências', pendencias.length, DC.orange, buildSparkline(pendSerie, DC.orange), pendAbertas + ' em aberto · ' + pendFechadas + ' resolvidas', ICONS.list) +
    dcKpi('Importações PEV', importacoes.length, DC.purple, buildSparkline(importSerie, DC.purple), impSim + ' com importação · ' + impNao + ' sem', ICONS.import) +
  '</div>';

  /* === ROW 2: Folgas+Férias | Equipe | Pausas === */
  /* Card Folgas e Férias — compacto, lado a lado */
  var proxFolgasHtml = proxFolgas.length > 0
    ? proxFolgas.map(function(f) {
        var dt = f.data_folga ? new Date(f.data_folga + 'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : '';
        return '<div class="dc2-aus-row"><div class="dc2-aus-av" style="background:rgba(245,200,66,0.12);color:' + DC.gold + '">' + dcEsc((f.nome||'?').charAt(0).toUpperCase()) + '</div><div class="dc2-aus-info"><strong>' + dcEsc(f.nome||'—') + '</strong><span>' + dt + '</span></div><div class="dc2-aus-badge" style="color:' + DC.gold + '">📅</div></div>';
      }).join('')
    : '<div class="dc2-empty-xs">Nenhuma folga futura</div>';

  var proxFeriasHtml = proxFerias.length > 0
    ? proxFerias.map(function(f) {
        var ini = f.data_folga ? new Date(f.data_folga + 'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : '';
        var fim = f.data_fim   ? new Date(f.data_fim   + 'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : ini;
        return '<div class="dc2-aus-row"><div class="dc2-aus-av" style="background:rgba(96,165,250,0.12);color:' + DC.blue + '">' + dcEsc((f.nome||'?').charAt(0).toUpperCase()) + '</div><div class="dc2-aus-info"><strong>' + dcEsc(f.nome||'—') + '</strong><span>' + ini + ' → ' + fim + '</span></div><div class="dc2-aus-badge" style="color:' + DC.blue + '">🏖</div></div>';
      }).join('')
    : '<div class="dc2-empty-xs">Nenhuma férias futura</div>';

  var cardFolgasFerias = '<div class="dc2-card">' +
    '<div class="dc2-card-header">' + ICONS.calendar + '<span>Folgas &amp; Férias</span>' +
    '<div class="dc2-header-pills"><span class="dc2-pill" style="background:rgba(245,200,66,.1);color:' + DC.gold + ';border-color:rgba(245,200,66,.2)">' + folgasHoje.length + ' hoje</span>' +
    '<span class="dc2-pill" style="background:rgba(96,165,250,.1);color:' + DC.blue + ';border-color:rgba(96,165,250,.2)">' + feriasHoje.length + ' férias</span></div></div>' +
    '<div class="dc2-aus-split">' +
      '<div class="dc2-aus-col"><div class="dc2-aus-col-label" style="color:' + DC.gold + '">📅 Próximas folgas</div>' + proxFolgasHtml + '</div>' +
      '<div class="dc2-aus-divider"></div>' +
      '<div class="dc2-aus-col"><div class="dc2-aus-col-label" style="color:' + DC.blue + '">🏖 Próximas férias</div>' + proxFeriasHtml + '</div>' +
    '</div></div>';

  /* Card Equipe — pizza compacta */
  var pieEquipe = buildPie([
    { value: tecnicos, color: DC.blue },
    { value: gestao,   color: DC.gold },
    { value: outros > 0 ? outros : 0, color: 'rgba(255,255,255,0.15)' },
  ], 88);
  var cardEquipe = '<div class="dc2-card">' +
    '<div class="dc2-card-header">' + ICONS.users + '<span>Equipe</span></div>' +
    '<div class="dc2-pie-layout">' + (pieEquipe || '<div class="dc2-empty-xs">Sem dados</div>') +
    '<div class="dc2-pie-legend">' +
      '<div class="dc2-leg-item"><span class="dc2-leg-dot" style="background:' + DC.blue + '"></span><span>Técnicos</span><strong>' + tecnicos + '</strong></div>' +
      '<div class="dc2-leg-item"><span class="dc2-leg-dot" style="background:' + DC.gold + '"></span><span>Gestão</span><strong>' + gestao + '</strong></div>' +
      (outros > 0 ? '<div class="dc2-leg-item"><span class="dc2-leg-dot" style="background:rgba(255,255,255,.2)"></span><span>Outros</span><strong>' + outros + '</strong></div>' : '') +
      '<div class="dc2-leg-divider"></div>' +
      '<div class="dc2-leg-item"><span class="dc2-leg-dot" style="background:' + DC.green + '"></span><span>Presentes</span><strong style="color:' + DC.green + '">' + presentesHoje + '</strong></div>' +
      '<div class="dc2-leg-item"><span class="dc2-leg-dot" style="background:' + DC.red + '"></span><span>Ausentes</span><strong style="color:' + DC.red + '">' + ausentesHoje + '</strong></div>' +
    '</div></div>' +
    '<div class="dc2-mini-bar-wrap" style="margin-top:12px">' +
      buildHorizBar('Presença', presentesHoje, total, presColor, total) +
      buildHorizBar('Pausas config.', comPausa, total, DC.teal, total) +
    '</div></div>';

  /* Card Pausas — donut + lista */
  var pausaList = colaboradores.filter(function(c) { return pausas[c.nome] && pausas[c.nome].entrada; }).slice(0,5).map(function(c) {
    var p = pausas[c.nome];
    var av = c.nome.split(' ').map(function(w){return w[0]||'';}).slice(0,2).join('').toUpperCase();
    return '<div class="dc2-aus-row"><div class="dc2-aus-av" style="background:rgba(52,211,153,.1);color:' + DC.teal + '">' + dcEsc(av) + '</div><div class="dc2-aus-info"><strong>' + dcEsc(c.nome) + '</strong><span>' + dcEsc(p.entrada||'--') + ' → ' + dcEsc(p.saida||'--') + '</span></div><span style="font-size:12px;color:' + DC.teal + '">⏱</span></div>';
  }).join('');
  var piePausas = buildPie([
    { value: comPausa, color: DC.teal },
    { value: Math.max(0, total - comPausa), color: 'rgba(255,255,255,0.06)' },
  ], 72);
  var cardPausas = '<div class="dc2-card">' +
    '<div class="dc2-card-header">' + ICONS.clock + '<span>Pausas</span>' +
    '<span class="dc2-pill" style="background:rgba(52,211,153,.1);color:' + DC.teal + ';border-color:rgba(52,211,153,.2)">' + pausaPercent + '% config.</span></div>' +
    '<div class="dc2-pause-top">' +
      '<div class="dc2-pause-donut">' + (piePausas || '') +
        '<div class="dc2-ring-center"><strong>' + comPausa + '</strong><span>/' + total + '</span></div>' +
      '</div>' +
      '<div class="dc2-pause-stats">' +
        '<div class="dc2-stat-item"><span class="dc2-stat-num" style="color:' + DC.teal + '">' + comPausa + '</span><span class="dc2-stat-lbl">Configurados</span></div>' +
        '<div class="dc2-stat-item"><span class="dc2-stat-num" style="color:rgba(255,255,255,.35)">' + (total - comPausa) + '</span><span class="dc2-stat-lbl">Pendentes</span></div>' +
      '</div>' +
    '</div>' +
    '<div style="margin-top:10px">' + (pausaList || '<div class="dc2-empty-xs">Use "Gerar automático" na aba Pausas.</div>') + '</div>' +
  '</div>';

  /* === ROW 3: Pendências | Importações PEV | Atividade === */

  /* Card Pendências */
  var pendStatusBar = pendencias.length > 0
    ? '<div class="dc2-status-bar-track" title="' + pendAbertas + ' aberto, ' + pendFechadas + ' fechadas">' +
        '<div class="dc2-status-bar-fill" style="width:' + (100-pendPercent) + '%;background:' + DC.green + '"></div>' +
        '<div class="dc2-status-bar-fill" style="width:' + pendPercent + '%;background:' + DC.orange + '"></div>' +
      '</div>'
    : '';
  var pendListHtml = pendRecentes.length > 0
    ? pendRecentes.map(function(p) {
        var motivo = (p.motivo || '').slice(0, 35) + ((p.motivo||'').length > 35 ? '…' : '');
        var cor = p.caso_aberto ? DC.orange : DC.green;
        var label = p.caso_aberto ? 'Aberto' : 'Fechado';
        return '<div class="dc2-pend-item"><div class="dc2-pend-dot" style="background:' + cor + ';box-shadow:0 0 5px ' + cor + '30"></div>' +
          '<div class="dc2-aus-info" style="flex:1"><strong>' + dcEsc(p.cliente||'—') + '</strong><span>' + dcEsc(motivo||'—') + '</span></div>' +
          '<span class="dc2-pill" style="font-size:10px;padding:2px 7px;background:' + cor + '15;color:' + cor + ';border-color:' + cor + '30">' + label + '</span></div>';
      }).join('')
    : '<div class="dc2-empty-xs">Nenhuma pendência registrada.</div>';
  var cardPendencias = '<div class="dc2-card">' +
    '<div class="dc2-card-header">' + ICONS.list + '<span>Pendências</span>' +
    '<div class="dc2-header-pills"><span class="dc2-pill" style="background:rgba(251,146,60,.12);color:' + DC.orange + ';border-color:rgba(251,146,60,.2)">' + pendAbertas + ' abertas</span>' +
    '<span class="dc2-pill" style="background:rgba(74,222,128,.1);color:' + DC.green + ';border-color:rgba(74,222,128,.18)">' + pendFechadas + ' fechadas</span></div></div>' +
    (pendStatusBar ? '<div style="margin-bottom:12px">' + pendStatusBar + '<div style="display:flex;justify-content:space-between;margin-top:5px;font-size:10.5px;color:rgba(255,255,255,.35)"><span>Resolvidas ' + (100-pendPercent) + '%</span><span>Em aberto ' + pendPercent + '%</span></div></div>' : '') +
    '<div class="dc2-pend-list">' + pendListHtml + '</div>' +
    '<button class="dc2-link-btn" onclick="document.querySelector(\'[data-tab=pendencias]\').click()" type="button">Ver todas as pendências →</button>' +
  '</div>';

  /* Card Importações PEV */
  var piImp = buildPie(importacoes.length > 0 ? [
    { value: impSim, color: DC.purple },
    { value: impNao, color: DC.orange },
  ] : [{ value: 1, color: 'rgba(255,255,255,0.08)' }], 80);

  var impListHtml = impRecentes.length > 0
    ? impRecentes.map(function(imp) {
        var hasBadge = imp.importacao === 'sim';
        var cor = hasBadge ? DC.purple : DC.orange;
        var dt = imp.criado_em ? new Date(imp.criado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : '';
        return '<div class="dc2-pend-item"><div class="dc2-pend-dot" style="background:' + cor + '"></div>' +
          '<div class="dc2-aus-info" style="flex:1"><strong>' + dcEsc(imp.empresa||'—') + '</strong><span>' + dcEsc(imp.cnpj||'') + (dt ? ' · ' + dt : '') + '</span></div>' +
          '<span class="dc2-pill" style="font-size:10px;padding:2px 7px;background:' + cor + '15;color:' + cor + ';border-color:' + cor + '30">' + (hasBadge ? '📥 Sim' : '📭 Não') + '</span></div>';
      }).join('')
    : '<div class="dc2-empty-xs">Dados chegam via <strong>/importação de dados</strong> no Discord.</div>';

  var cardImportacoes = '<div class="dc2-card">' +
    '<div class="dc2-card-header">' + ICONS.import + '<span>Importações PEV</span>' +
    '<div class="dc2-header-pills"><span class="dc2-pill" style="background:rgba(167,139,250,.12);color:' + DC.purple + ';border-color:rgba(167,139,250,.2)">' + impSim + ' com</span>' +
    '<span class="dc2-pill" style="background:rgba(251,146,60,.1);color:' + DC.orange + ';border-color:rgba(251,146,60,.18)">' + impNao + ' sem</span></div></div>' +
    '<div class="dc2-pie-layout" style="margin-bottom:12px">' + piImp +
    '<div class="dc2-pie-legend">' +
      '<div class="dc2-leg-item"><span class="dc2-leg-dot" style="background:' + DC.purple + '"></span><span>Com importação</span><strong style="color:' + DC.purple + '">' + impSim + '</strong></div>' +
      '<div class="dc2-leg-item"><span class="dc2-leg-dot" style="background:' + DC.orange + '"></span><span>Sem importação</span><strong style="color:' + DC.orange + '">' + impNao + '</strong></div>' +
      '<div class="dc2-leg-divider"></div>' +
      '<div class="dc2-leg-item"><span class="dc2-leg-dot" style="background:rgba(255,255,255,.2)"></span><span>Total</span><strong>' + importacoes.length + '</strong></div>' +
    '</div></div>' +
    '<div class="dc2-pend-list">' + impListHtml + '</div>' +
    '<button class="dc2-link-btn" onclick="document.querySelector(\'[data-tab=pev]\').click()" type="button">Ver setor PEV →</button>' +
  '</div>';

  /* Card Atividade 7 dias */
  var maxAct = Math.max.apply(null, dias.map(function(d,i) {
    return folgasSerie[i] + feriasSerie[i] + pendSerie[i] + importSerie[i];
  }).concat([1]));

  var actBars = dias.map(function(d, i) {
    var isToday = d.iso === today;
    var tot = folgasSerie[i] + feriasSerie[i] + pendSerie[i] + importSerie[i];
    var h = tot > 0 ? Math.max(6, Math.round((tot / maxAct) * 56)) : 3;
    var parts = '';
    var yOff = 0;
    if (folgasSerie[i] > 0)  { var ph = Math.round((folgasSerie[i]/Math.max(tot,1))*h); parts += '<rect x="0" y="' + (56-yOff-ph) + '" width="100%" height="' + ph + '" fill="' + DC.gold + '" rx="2"/>'; yOff += ph; }
    if (feriasSerie[i] > 0)  { var ph2 = Math.round((feriasSerie[i]/Math.max(tot,1))*h); parts += '<rect x="0" y="' + (56-yOff-ph2) + '" width="100%" height="' + ph2 + '" fill="' + DC.blue + '"/>'; yOff += ph2; }
    if (pendSerie[i] > 0)    { var ph3 = Math.round((pendSerie[i]/Math.max(tot,1))*h); parts += '<rect x="0" y="' + (56-yOff-ph3) + '" width="100%" height="' + ph3 + '" fill="' + DC.orange + '"/>'; yOff += ph3; }
    if (importSerie[i] > 0)  { var ph4 = Math.round((importSerie[i]/Math.max(tot,1))*h); parts += '<rect x="0" y="' + (56-yOff-ph4) + '" width="100%" height="' + ph4 + '" fill="' + DC.purple + '"/>'; yOff += ph4; }
    if (tot === 0) parts = '<rect x="15%" y="53" width="70%" height="3" fill="rgba(255,255,255,.07)" rx="1.5"/>';
    return '<div class="dc2-act-col' + (isToday ? ' today' : '') + '">' +
      '<svg width="28" height="56" viewBox="0 0 28 56" style="display:block">' + parts + '</svg>' +
      '<span class="dc2-act-label">' + dcEsc(d.label) + '</span>' +
      (isToday ? '<span class="dc2-act-today"></span>' : '') +
    '</div>';
  }).join('');

  var cardAtividade = '<div class="dc2-card">' +
    '<div class="dc2-card-header">' + ICONS.activity + '<span>Atividade — 7 dias</span></div>' +
    '<div class="dc2-act-grid">' + actBars + '</div>' +
    '<div class="dc2-act-legend">' +
      '<span><span class="dc2-leg-dot" style="background:' + DC.gold + ';display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px"></span>Folgas</span>' +
      '<span><span class="dc2-leg-dot" style="background:' + DC.blue + ';display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px"></span>Férias</span>' +
      '<span><span class="dc2-leg-dot" style="background:' + DC.orange + ';display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px"></span>Pendências</span>' +
      '<span><span class="dc2-leg-dot" style="background:' + DC.purple + ';display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px"></span>Importações</span>' +
    '</div>' +
  '</div>';

  /* ── Montagem final ── */
  container.innerHTML =
    kpiRow +
    '<div class="dc2-row-3">' + cardFolgasFerias + cardEquipe + cardPausas + '</div>' +
    '<div class="dc2-row-3">' + cardPendencias + cardImportacoes + cardAtividade + '</div>';
}

/* ─── Helper KPI card ──────────────────────────────── */
function dcKpi(label, value, color, spark, sub, icon) {
  return '<div class="dc2-kpi-card">' +
    '<div class="dc2-kpi-top">' +
      '<div class="dc2-kpi-icon" style="color:' + color + '">' + (icon||'') + '</div>' +
      '<div class="dc2-kpi-spark">' + (spark||'') + '</div>' +
    '</div>' +
    '<div class="dc2-kpi-value" style="color:' + color + '">' + value + '</div>' +
    '<div class="dc2-kpi-label">' + dcEsc(label) + '</div>' +
    '<div class="dc2-kpi-sub">' + dcEsc(sub) + '</div>' +
  '</div>';
}

/* ─── CSS injetado ─────────────────────────────────── */
function injectDcCSS() {
  if (document.getElementById('dc-styles')) return;
  var style = document.createElement('style');
  style.id = 'dc-styles';
  style.textContent = `
#dc-dashboard-charts { margin-bottom: 1.5rem; }

/* KPI row — 6 colunas compactas */
.dc2-kpi-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
@media(max-width:1100px) { .dc2-kpi-row { grid-template-columns: repeat(3,1fr); } }
@media(max-width:680px)  { .dc2-kpi-row { grid-template-columns: repeat(2,1fr); } }

.dc2-kpi-card {
  background: rgba(255,255,255,0.035);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  padding: 13px 14px 11px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color .2s, background .2s;
  cursor: default;
}
.dc2-kpi-card:hover { border-color: rgba(255,255,255,0.13); background: rgba(255,255,255,0.05); }
.dc2-kpi-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.dc2-kpi-icon { opacity: .8; }
.dc2-kpi-spark { opacity: .75; }
.dc2-kpi-value { font-family: "Outfit","Syne",sans-serif; font-size: 1.65rem; font-weight: 700; line-height: 1; letter-spacing: -.5px; }
.dc2-kpi-label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,.45); letter-spacing: .2px; }
.dc2-kpi-sub   { font-size: 10.5px; color: rgba(255,255,255,.28); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Rows de 3 colunas */
.dc2-row-3 {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
@media(max-width:1100px) { .dc2-row-3 { grid-template-columns: 1fr 1fr; } }
@media(max-width:680px)  { .dc2-row-3 { grid-template-columns: 1fr; } }

/* Card base */
.dc2-card {
  background: rgba(255,255,255,0.035);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 0;
  transition: border-color .2s;
}
.dc2-card:hover { border-color: rgba(255,255,255,0.12); }

/* Card header */
.dc2-card-header {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  font-weight: 700;
  color: rgba(255,255,255,.45);
  text-transform: uppercase;
  letter-spacing: .6px;
  margin-bottom: 14px;
}
.dc2-card-header svg { opacity: .7; flex-shrink: 0; }
.dc2-card-header span { flex: 1; }
.dc2-header-pills { display: flex; gap: 5px; flex-wrap: wrap; }

/* Pill badge */
.dc2-pill {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 99px;
  border: 1px solid transparent;
  white-space: nowrap;
  letter-spacing: .1px;
}

/* Ausências split (folgas + férias lado a lado) */
.dc2-aus-split {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0;
  align-items: start;
}
.dc2-aus-divider {
  width: 1px;
  background: rgba(255,255,255,.07);
  align-self: stretch;
  margin: 0 14px;
}
.dc2-aus-col { display: flex; flex-direction: column; gap: 6px; }
.dc2-aus-col-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .4px;
  margin-bottom: 6px;
  opacity: .8;
}

/* Linhas de colaborador */
.dc2-aus-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 7px;
  border-radius: 9px;
  background: rgba(255,255,255,.025);
  border: 1px solid rgba(255,255,255,.04);
}
.dc2-aus-av {
  width: 26px; height: 26px;
  border-radius: 7px;
  font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.dc2-aus-info { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dc2-aus-info strong { font-size: 11.5px; color: rgba(255,255,255,.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dc2-aus-info span   { font-size: 10.5px; color: rgba(255,255,255,.35); }
.dc2-aus-badge { font-size: 12px; flex-shrink: 0; }

/* Pendências */
.dc2-pend-item {
  display: flex; align-items: center; gap: 9px;
  padding: 6px 8px;
  border-radius: 9px;
  background: rgba(255,255,255,.025);
  border: 1px solid rgba(255,255,255,.04);
  margin-bottom: 5px;
}
.dc2-pend-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dc2-pend-list { display: flex; flex-direction: column; }

/* Pizza layout */
.dc2-pie-layout { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.dc2-pie-legend { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 90px; }
.dc2-leg-item  { display: flex; align-items: center; gap: 7px; font-size: 12px; color: rgba(255,255,255,.6); }
.dc2-leg-item span { flex: 1; font-size: 11.5px; }
.dc2-leg-item strong { font-size: 13px; color: #fff; }
.dc2-leg-dot   { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dc2-leg-divider { height: 1px; background: rgba(255,255,255,.06); margin: 3px 0; }

/* Mini barras horizontais */
.dc2-mini-bar-wrap { display: flex; flex-direction: column; gap: 7px; }
.dc2-hbar-row  { display: flex; align-items: center; gap: 8px; }
.dc2-hbar-label { font-size: 11px; color: rgba(255,255,255,.4); min-width: 88px; white-space: nowrap; }
.dc2-hbar-track { flex: 1; height: 5px; background: rgba(255,255,255,.07); border-radius: 99px; overflow: hidden; }
.dc2-hbar-fill  { height: 100%; border-radius: 99px; transition: width .6s ease; }
.dc2-hbar-val   { font-size: 12px; font-weight: 700; min-width: 30px; text-align: right; }
.dc2-hbar-pct   { font-size: 10px; color: rgba(255,255,255,.3); font-weight: 400; }

/* Pausas donut */
.dc2-pause-top  { display: flex; align-items: center; gap: 14px; }
.dc2-pause-donut { position: relative; flex-shrink: 0; }
.dc2-ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.dc2-ring-center strong { font-size: 17px; font-weight: 700; color: #fff; line-height: 1; }
.dc2-ring-center span   { font-size: 10px; color: rgba(255,255,255,.35); }
.dc2-pause-stats { display: flex; flex-direction: column; gap: 10px; }
.dc2-stat-item  { display: flex; flex-direction: column; }
.dc2-stat-num   { font-family: "Outfit",sans-serif; font-size: 1.4rem; font-weight: 700; line-height: 1; }
.dc2-stat-lbl   { font-size: 10.5px; color: rgba(255,255,255,.35); margin-top: 2px; }

/* Barra de status bicolor */
.dc2-status-bar-track { display: flex; height: 5px; border-radius: 99px; overflow: hidden; gap: 1px; }
.dc2-status-bar-fill  { height: 100%; border-radius: 99px; }

/* Atividade grid */
.dc2-act-grid {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: 4px;
  height: 80px;
  margin-bottom: 10px;
  padding: 0 2px;
}
.dc2-act-col { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; position: relative; }
.dc2-act-col.today .dc2-act-label { color: #fff; font-weight: 700; }
.dc2-act-label  { font-size: 9.5px; color: rgba(255,255,255,.35); text-transform: capitalize; }
.dc2-act-today  { width: 4px; height: 4px; border-radius: 50%; background: #60a5fa; display: block; }
.dc2-act-legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 10.5px; color: rgba(255,255,255,.38); align-items: center; margin-top: 4px; }
.dc2-act-legend span { display: flex; align-items: center; gap: 5px; }

/* Link button */
.dc2-link-btn {
  background: transparent; border: none;
  color: rgba(255,255,255,.3); font-size: 11px; font-family: inherit;
  cursor: pointer; padding: 8px 0 0; text-align: left;
  transition: color .15s;
}
.dc2-link-btn:hover { color: rgba(255,255,255,.65); }

/* Empty state */
.dc2-empty-xs { font-size: 11.5px; color: rgba(255,255,255,.25); padding: 8px 4px; }
  `;
  document.head.appendChild(style);
}

/* ─── Montagem no DOM ─────────────────────────────── */
function mountDashboardCharts() {
  var page = document.getElementById('page-dashboard');
  if (!page) return;

  /* Ocultar painel-indicadores e barra-ocupacao originais — substituídos pelos cards abaixo */
  var painelInd = document.getElementById('painel-indicadores');
  var barraOc   = document.getElementById('barra-ocupacao');
  if (painelInd) painelInd.style.display = 'none';
  if (barraOc)   barraOc.style.display   = 'none';

  var container = document.getElementById('dc-dashboard-charts');
  if (!container) {
    container = document.createElement('div');
    container.id = 'dc-dashboard-charts';
    var grid4 = page.querySelector('.grid4');
    if (grid4) grid4.after(container);
    else page.appendChild(container);
  }
  injectDcCSS();
  renderDashboardCharts();
}

/* ─── Auto-refresh ────────────────────────────────── */
function startDashboardAutoRefresh() {
  window.addEventListener('storage', function(e) {
    if (e.key && (e.key.indexOf('pitstop_') === 0 || e.key.indexOf('pev_') === 0)) {
      renderDashboardCharts();
    }
  });
  document.querySelectorAll('.tab[data-tab="dashboard"]').forEach(function(btn) {
    btn.addEventListener('click', function() { setTimeout(renderDashboardCharts, 80); });
  });
  setInterval(renderDashboardCharts, 120000);
}

/* ─── Init ────────────────────────────────────────── */
(function initDashboardCharts() {
  function doMount() {
    setTimeout(function() { mountDashboardCharts(); startDashboardAutoRefresh(); }, 450);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doMount);
  } else {
    doMount();
  }
})();

window.DC_refreshDashboard = renderDashboardCharts;
