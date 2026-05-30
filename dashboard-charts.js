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

async function carregarFolgasSupabase() {
  try {
    if (typeof supa !== 'undefined' && supa) {
      const { data, error } = await supa
        .from('folgas')
        .select('*')
        .order('data_folga', { ascending: true });
      
      if (error) throw error;
      
      // Mapeia os dados do Supabase para o formato esperado
      // IMPORTANTE: Sua tabela NÃO tem data_fim, usa apenas data_folga
      const folgas = (data || []).map(f => ({
        colaborador_nome: f.colaborador_nome,
        data_folga: f.data_folga,
        data_fim: f.data_folga, // Usa data_folga como data_fim (1 dia apenas)
        status: f.status,
        tipo: f.status, // Compatibilidade
        motivo: f.motivo,
      }));
      
      console.log('✅ Folgas carregadas do Supabase:', folgas.length);
      
      // NÃO salva no localStorage para evitar loop infinito
      // O cache será feito apenas quando necessário
      return folgas;
    }
  } catch (e) {
    console.error('❌ Erro ao carregar folgas do Supabase:', e);
  }
  
  // Fallback para localStorage
  return JSON.parse(localStorage.getItem('pitstop_folgas') || '[]');
}
async function carregarPendenciasSupabase() {
  try {
    if (typeof supa !== 'undefined' && supa) {
      const { data, error } = await supa
        .from('pitstop_pendencias')
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      console.log('\u2705 Pend\u00eancias carregadas do Supabase:', (data||[]).length);
      return data || [];
    }
  } catch (e) {
    console.error('\u274c Erro ao carregar pend\u00eancias do Supabase:', e);
  }
  return JSON.parse(localStorage.getItem('pitstop_pendencias') || '[]');
}

async function carregarImportacoesSupabase() {
  try {
    if (typeof supa !== 'undefined' && supa) {
      const { data, error } = await supa
        .from('pev_importacoes')
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      console.log('\u2705 Importa\u00e7\u00f5es carregadas do Supabase:', (data||[]).length);
      return data || [];
    }
  } catch (e) {
    console.error('\u274c Erro ao carregar importa\u00e7\u00f5es do Supabase:', e);
  }
  return JSON.parse(localStorage.getItem('pev_importacoes_v1') || '[]');
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

/* ─── Helper: detecta se um registro é férias ───────────────
   O status é salvo como "ferias:YYYY-MM-DD" ou "ferias",
   e o campo tipo pode ser "ferias". Qualquer um basta.       */
function dcIsFerias(f) {
  var s = String(f.status || '').toLowerCase();
  return s === 'ferias' || s.startsWith('ferias:') || s.includes('férias') ||
         f.tipo === 'ferias';
}

/* ─── Helper: data de fim das férias ───────────────────────── */
function dcFeriasFim(f) {
  var s = String(f.status || '');
  var m = s.match(/(?:ferias|férias):(\d{4}-\d{2}-\d{2})/i);
  return f.data_fim || f.data_final || (m ? m[1] : null) || f.data_folga;
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


/* ─── Skeleton de carregamento ──────────────────────────── */
function _dcSkeletonHTML() {
  var pulse = 'animation:dc-pulse 1.4s ease-in-out infinite;';
  var bar = function(w, h, r) {
    r = r || 8;
    return '<div style="background:rgba(255,255,255,.07);border-radius:' + r + 'px;width:' + w + ';height:' + h + 'px;' + pulse + '"></div>';
  };
  var kpi = '<div style="background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:13px 14px;display:flex;flex-direction:column;gap:8px;">' +
    bar('40%', 9) + bar('55%', 22) + bar('70%', 8) + '</div>';
  var kpiRow = '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:14px;">' + kpi.repeat(6) + '</div>';
  var card = '<div style="background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;">' +
    bar('50%', 10) + bar('100%', 60) + bar('80%', 8) + '</div>';
  var row3 = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px;">' + card.repeat(3) + '</div>';
  return '<style>@keyframes dc-pulse{0%,100%{opacity:.4}50%{opacity:.9}}</style>' +
    '<div class="dc2-skeleton">' + kpiRow + row3 + row3 + '</div>';
}

/* ─── Render principal ──────────────────────────────── */
async function renderDashboardCharts() {
  // Evita renderização simultânea
  if (dashboardIsRendering) {
    console.log('⏭️ Dashboard: Já está renderizando, pulando...');
    return;
  }
  
  dashboardIsRendering = true;
  lastRenderTime = Date.now();
  
  var container = document.getElementById('dc-dashboard-charts');
  if (!container) {
    dashboardIsRendering = false;
    return;
  }

  // Mostra skeleton imediatamente enquanto dados carregam
  if (!container.querySelector('.dc2-skeleton')) {
    container.innerHTML = _dcSkeletonHTML();
  }

  // Se o boot() já carregou os dados, reutiliza — evita 3 round-trips extras
  var _pre = window._dcPreloadedData || {};
  var folgas, pendencias, importacoes;

  if (_pre.folgas && _pre.pendencias && _pre.importacoes) {
    folgas      = _pre.folgas;
    pendencias  = _pre.pendencias;
    importacoes = _pre.importacoes;
  } else {
    var folgasSupabase      = await carregarFolgasSupabase();
    var pendenciasSupabase  = await carregarPendenciasSupabase();
    var importacoesSupabase = await carregarImportacoesSupabase();
    var _d = lerDados();
    folgas      = folgasSupabase.length > 0 ? folgasSupabase : _d.folgas;
    pendencias  = pendenciasSupabase.length > 0 ? pendenciasSupabase : _d.pendencias;
    importacoes = importacoesSupabase.length > 0 ? importacoesSupabase : _d.importacoes;
  }

  var dados = lerDados();
  var colaboradores = dados.colaboradores;
  var pausas        = dados.pausas;
  var flags         = dados.flags;
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
  var folgasAtivas  = folgas.filter(function(f) { return !dcIsFerias(f) && new Date(f.data_folga + 'T00:00:00') >= hoje; });
  var feriasAtivas  = folgas.filter(function(f) {
    return dcIsFerias(f) && new Date(dcFeriasFim(f) + 'T00:00:00') >= hoje;
  });
  
  // Debug: log de férias encontradas
  console.log('📊 Dashboard - Folgas totais:', folgas.length);
  console.log('📊 Dashboard - Férias ativas:', feriasAtivas.length, feriasAtivas);

  /* Inclui colaboradores com flag ferias=true que não têm registro na tabela folgas */
  var nomesNaTabela = feriasAtivas.map(function(f) {
    return (f.colaborador_nome || f.nome || '').toLowerCase();
  });
  colaboradores.forEach(function(c) {
    var f = (flags || {})[c.nome] || {};
    if (f.ferias && nomesNaTabela.indexOf(c.nome.toLowerCase()) === -1) {
      feriasAtivas.push({
        colaborador_nome: c.nome,
        nome: c.nome,
        data_folga: today,
        data_fim: today,
        status: 'ferias',
        tipo: 'ferias',
        _flag_only: true,
      });
    }
  });

  var folgasHoje    = folgas.filter(function(f) { return f.data_folga === today && !dcIsFerias(f); });
  var feriasHoje    = feriasAtivas.filter(function(f) {
    return today >= f.data_folga && today <= dcFeriasFim(f);
  });
  var proxFolgas    = folgasAtivas.slice(0, 4);
  var proxFerias    = feriasAtivas.slice(0, 4);

  /* Pendências — inclui concluídas do localStorage separado */
  var pendConcluidas = (function() { try { return JSON.parse(localStorage.getItem('pitstop_pend_concl') || '[]'); } catch(e) { return []; } })();
  var pendEmAnalise  = pendencias.filter(function(p) { return !p.caso_aberto && !p._concluida; });
  var pendCasoAb     = pendencias.filter(function(p) { return p.caso_aberto  && !p._concluida; });
  var pendAbertas    = pendEmAnalise.length + pendCasoAb.length;
  var pendFechadas   = pendConcluidas.length;
  var pendTotal      = pendAbertas + pendFechadas;
  var pendPercent    = pendTotal > 0 ? Math.round(pendAbertas / pendTotal * 100) : 0;
  var pendRecentes   = pendencias.slice(-4).reverse();

  /* Importações */
  var impSim      = importacoes.filter(function(i) { return i.importacao === 'sim'; }).length;
  var impNao      = importacoes.length - impSim;
  var impPercent  = importacoes.length > 0 ? Math.round(impSim / importacoes.length * 100) : 0;
  var impRecentes = importacoes.slice(0, 5);

  /* Séries 7 dias */
  var folgasSerie     = dias.map(function(d) { return folgas.filter(function(f) { return f.data_folga === d.iso && !dcIsFerias(f); }).length; });
  var feriasSerie     = dias.map(function(d) { return folgas.filter(function(f) { if(!dcIsFerias(f)) return false; return d.iso >= f.data_folga && d.iso <= dcFeriasFim(f); }).length; });
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
  /* Salva snapshot dos dados para uso nos modais */
  dcSalvarSnapshot({ colaboradores: colaboradores, folgas: folgas, flags: flags, pendencias: pendencias, pendConcluidas: pendConcluidas, pendEmAnalise: pendEmAnalise, pendCasoAb: pendCasoAb, importacoes: importacoes });

  var kpiRow = '<div class="dc2-kpi-row">' +
    dcKpi('Presentes', presentesHoje, presColor, buildSparkline(presenteSerie, presColor), presPercent + '% da equipe', ICONS.users, 'presentes') +
    dcKpi('Ausentes hoje', ausentesHoje, DC.red, buildSparkline(folgasSerie.map(function(v,i){return v+feriasSerie[i];}), DC.red), ausentesHoje === 0 ? 'Equipe completa 🎉' : ausentesHoje + ' fora hoje', ICONS.beach, 'ausentes') +
    dcKpi('Folgas futuras', folgasAtivas.length, DC.gold, buildSparkline(folgasSerie, DC.gold), folgasHoje.length + ' hoje · ' + folgasAtivas.length + ' agendadas', ICONS.calendar, 'folgas') +
    dcKpi('Férias ativas', feriasAtivas.length, DC.blue, buildSparkline(feriasSerie, DC.blue), feriasHoje.length + ' hoje · ' + feriasAtivas.length + ' agendadas', ICONS.beach, 'ferias') +
    dcKpi('Pendências', pendTotal, DC.orange, buildSparkline(pendSerie, DC.orange), pendAbertas + ' em aberto · ' + pendFechadas + ' concluídas', ICONS.list, 'pendencias') +
    dcKpi('Importações PEV', importacoes.length, DC.purple, buildSparkline(importSerie, DC.purple), impSim + ' com importação · ' + impNao + ' sem', ICONS.import, 'importacoes') +
  '</div>';

  /* === ROW 2: Folgas+Férias | Equipe | Pausas === */
  /* Card Folgas e Férias — compacto, lado a lado */
  var proxFolgasHtml = proxFolgas.length > 0
    ? proxFolgas.map(function(f) {
        var nome = f.colaborador_nome || f.nome || '?'; // Tenta colaborador_nome primeiro, depois nome
        var dt = f.data_folga ? new Date(f.data_folga + 'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : '';
        return '<div class="dc2-aus-row"><div class="dc2-aus-av" style="background:rgba(245,200,66,0.12);color:' + DC.gold + '">' + dcEsc(nome.charAt(0).toUpperCase()) + '</div><div class="dc2-aus-info"><strong>' + dcEsc(nome) + '</strong><span>' + dt + '</span></div><div class="dc2-aus-badge" style="color:' + DC.gold + '">📅</div></div>';
      }).join('')
    : '<div class="dc2-empty-xs">Nenhuma folga futura</div>';

  var proxFeriasHtml = proxFerias.length > 0
    ? proxFerias.map(function(f) {
        var nome = f.colaborador_nome || f.nome || '?'; // Tenta colaborador_nome primeiro, depois nome
        var ini = f.data_folga ? new Date(f.data_folga + 'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : '';
        var fim = f.data_fim   ? new Date(f.data_fim   + 'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : ini;
        return '<div class="dc2-aus-row"><div class="dc2-aus-av" style="background:rgba(96,165,250,0.12);color:' + DC.blue + '">' + dcEsc(nome.charAt(0).toUpperCase()) + '</div><div class="dc2-aus-info"><strong>' + dcEsc(nome) + '</strong><span>' + ini + ' → ' + fim + '</span></div><div class="dc2-aus-badge" style="color:' + DC.blue + '">🏖</div></div>';
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

  /* Card Pendências — usa todas as categorias do Kanban */
  var pendTodasAtivas = pendEmAnalise.concat(pendCasoAb); // Em Análise + Caso Aberto
  var pendStatusBar = pendTotal > 0
    ? '<div class="dc2-status-bar-track" title="' + pendAbertas + ' em aberto, ' + pendFechadas + ' concluídas">' +
        '<div class="dc2-status-bar-fill" style="width:' + (100-pendPercent) + '%;background:' + DC.green + '"></div>' +
        '<div class="dc2-status-bar-fill" style="width:' + pendPercent + '%;background:' + DC.orange + '"></div>' +
      '</div>'
    : '';
  // Lista recente: combina ativas (mais novas primeiro) + até 2 concluídas
  var pendListItens = pendTodasAtivas.slice(0,3).concat(pendConcluidas.slice(0,2));
  var pendListHtml = pendListItens.length > 0
    ? pendListItens.map(function(p) {
        var motivo = (p.motivo || '').slice(0, 35) + ((p.motivo||'').length > 35 ? '…' : '');
        var isConcluida = !!p._concluida;
        var isCasoAberto = p.caso_aberto && !isConcluida;
        var cor = isConcluida ? DC.teal : isCasoAberto ? DC.orange : DC.gold;
        var label = isConcluida ? '✅ Concluída' : isCasoAberto ? '🔴 Caso aberto' : '🔍 Análise';
        return '<div class="dc2-pend-item"><div class="dc2-pend-dot" style="background:' + cor + ';box-shadow:0 0 5px ' + cor + '30"></div>' +
          '<div class="dc2-aus-info" style="flex:1"><strong>' + dcEsc(p.cliente||'—') + '</strong><span>' + dcEsc(motivo||'—') + '</span></div>' +
          '<span class="dc2-pill" style="font-size:10px;padding:2px 7px;background:' + cor + '15;color:' + cor + ';border-color:' + cor + '30">' + label + '</span></div>';
      }).join('')
    : '<div class="dc2-empty-xs">Nenhuma pendência registrada.</div>';
  var cardPendencias = '<div class="dc2-card">' +
    '<div class="dc2-card-header">' + ICONS.list + '<span>Pendências</span>' +
    '<div class="dc2-header-pills"><span class="dc2-pill" style="background:rgba(251,146,60,.12);color:' + DC.orange + ';border-color:rgba(251,146,60,.2)">' + pendAbertas + ' abertas</span>' +
    '<span class="dc2-pill" style="background:rgba(74,222,128,.1);color:' + DC.teal + ';border-color:rgba(74,222,128,.18)">' + pendFechadas + ' fechadas</span></div></div>' +
    (pendStatusBar ? '<div style="margin-bottom:12px">' + pendStatusBar + '<div style="display:flex;justify-content:space-between;margin-top:5px;font-size:10.5px;color:rgba(255,255,255,.35)"><span>Concluídas ' + (100-pendPercent) + '%</span><span>Em aberto ' + pendPercent + '%</span></div></div>' : '') +
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

  /* ── Card Mapa de Pendências por Região ── */
  // Agrupa pendências abertas por estado
  var pendAbertas_arr = pendencias.filter(function(p){ return !p._concluida && p.status !== 'concluida'; });
  var porEstado = {};
  pendAbertas_arr.forEach(function(p) {
    if (p.estado) {
      porEstado[p.estado] = (porEstado[p.estado] || 0) + 1;
    }
  });
  var semEstado = pendAbertas_arr.filter(function(p){ return !p.estado; }).length;

  // Mapa de regiões do Brasil
  var regioes = {
    'Norte':     ['AM','PA','AC','RO','RR','AP','TO'],
    'Nordeste':  ['MA','PI','CE','RN','PB','PE','AL','SE','BA'],
    'Centro-Oeste': ['MT','MS','GO','DF'],
    'Sudeste':   ['SP','RJ','MG','ES'],
    'Sul':       ['PR','SC','RS']
  };
  var coresRegiao = {
    'Norte': '#4ade80',
    'Nordeste': '#f59e0b',
    'Centro-Oeste': '#a78bfa',
    'Sudeste': '#fb923c',
    'Sul': '#38bdf8'
  };
  var porRegiao = {};
  Object.keys(regioes).forEach(function(reg) {
    porRegiao[reg] = regioes[reg].reduce(function(acc, uf) { return acc + (porEstado[uf] || 0); }, 0);
  });
  var totalComLoc = Object.keys(porEstado).reduce(function(acc, k){ return acc + porEstado[k]; }, 0);
  var maxRegiao = Math.max.apply(null, Object.keys(porRegiao).map(function(r){ return porRegiao[r]; }).concat([1]));

  // Ranking top estados
  var rankEstados = Object.keys(porEstado).map(function(uf){ return { uf: uf, n: porEstado[uf] }; })
    .sort(function(a,b){ return b.n - a.n; }).slice(0, 5);

  // Build bar rows for regiões
  var regiaoRows = Object.keys(regioes).map(function(reg) {
    var n = porRegiao[reg];
    var cor = coresRegiao[reg];
    var pct = n > 0 ? Math.max(4, Math.round((n / maxRegiao) * 100)) : 0;
    var estados_lista = regioes[reg].filter(function(uf){ return porEstado[uf] > 0; })
      .map(function(uf){ return uf + '(' + porEstado[uf] + ')'; }).join(', ');
    return '<div style="margin-bottom:9px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
        '<span style="font-size:12px;font-weight:600;color:rgba(255,255,255,.85)">' + reg + '</span>' +
        '<span style="font-size:13px;font-weight:700;color:' + cor + '">' + n + '</span>' +
      '</div>' +
      '<div style="background:rgba(255,255,255,.07);border-radius:4px;height:8px;overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:' + cor + ';border-radius:4px;transition:width .4s ease;box-shadow:0 0 8px ' + cor + '50"></div>' +
      '</div>' +
      (estados_lista ? '<div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:3px">' + dcEsc(estados_lista) + '</div>' : '') +
    '</div>';
  }).join('');

  // Top estados ranking
  var topEstadosHtml = rankEstados.length > 0
    ? rankEstados.map(function(item, i) {
        var reg = Object.keys(regioes).find(function(r){ return regioes[r].indexOf(item.uf) !== -1; }) || '';
        var cor = coresRegiao[reg] || DC.orange;
        return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">' +
          '<span style="font-size:11px;color:rgba(255,255,255,.3);min-width:14px">' + (i+1) + 'º</span>' +
          '<div style="width:28px;height:28px;border-radius:6px;background:' + cor + '20;border:1px solid ' + cor + '40;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:' + cor + '">' + dcEsc(item.uf) + '</div>' +
          '<span style="flex:1;font-size:12px;color:rgba(255,255,255,.8)">' + dcEsc(item.uf) + '</span>' +
          '<span style="font-size:13px;font-weight:700;color:' + cor + '">' + item.n + '</span>' +
        '</div>';
      }).join('')
    : '<div style="font-size:12px;color:rgba(255,255,255,.3);padding:8px 0">Nenhuma pendência com localização</div>';

  var mapaNota = semEstado > 0
    ? '<div style="font-size:10.5px;color:rgba(255,255,255,.3);margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06)">⚠ ' + semEstado + ' pendência(s) sem localização cadastrada</div>'
    : '';

  var cardMapaRegiao = '<div class="dc2-card" style="grid-column:span 2">' +
    '<div class="dc2-card-header">📍<span>Pendências por Região</span>' +
    '<div class="dc2-header-pills"><span class="dc2-pill" style="background:rgba(251,146,60,.12);color:' + DC.orange + ';border-color:rgba(251,146,60,.2)">' + totalComLoc + ' localizadas</span></div></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:4px">' +
      '<div>' +
        '<div style="font-size:10.5px;font-weight:600;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Por Região</div>' +
        regiaoRows +
      '</div>' +
      '<div>' +
        '<div style="font-size:10.5px;font-weight:600;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Top Estados</div>' +
        topEstadosHtml +
      '</div>' +
    '</div>' +
    mapaNota +
    '<button class="dc2-link-btn" onclick="document.querySelector('[data-tab=pendencias]').click()" type="button">Ver todas as pendências →</button>' +
  '</div>';

  /* ── Montagem final ── */
  container.innerHTML =
    kpiRow +
    '<div class="dc2-row-3">' + cardFolgasFerias + cardEquipe + cardPausas + '</div>' +
    '<div class="dc2-row-3">' + cardPendencias + cardImportacoes + cardAtividade + '</div>' +
    '<div class="dc2-row-mapa">' + cardMapaRegiao + '</div>';
  
  // Libera flag de renderização
  dashboardIsRendering = false;
}

/* ─── Helper KPI card ──────────────────────────────── */
function dcKpi(label, value, color, spark, sub, icon, cardId) {
  var clickAttr = cardId
    ? ' role="button" tabindex="0" title="Ver detalhes" style="cursor:pointer;"'
      + ' onclick="dcAbrirModal(\'' + cardId + '\')"'
      + ' onkeydown="if(event.key===\'Enter\'||event.key===\' \')dcAbrirModal(\'' + cardId + '\')"'
    : '';
  return '<div class="dc2-kpi-card"' + clickAttr + '>' +
    '<div class="dc2-kpi-top">' +
      '<div class="dc2-kpi-icon" style="color:' + color + '">' + (icon||'') + '</div>' +
      '<div class="dc2-kpi-spark">' + (spark||'') + '</div>' +
    '</div>' +
    '<div class="dc2-kpi-value" style="color:' + color + '">' + value + '</div>' +
    '<div class="dc2-kpi-label">' + dcEsc(label) + '</div>' +
    '<div class="dc2-kpi-sub">' + dcEsc(sub) + '</div>' +
    (cardId ? '<div style="font-size:9px;opacity:.4;margin-top:3px;text-align:right;">ver detalhes →</div>' : '') +
  '</div>';
}

/* ─── Modal de Drill-Down dos KPI cards ─────────────── */
var _dcSnapshot = {};

function dcSalvarSnapshot(dados) { _dcSnapshot = dados; }

function dcAbrirModal(cardId) {
  var d = _dcSnapshot;
  if (!d || !d.colaboradores) return;

  var titulo = '', subtitulo = '', cor = DC.green, conteudo = '';
  var hoje = new Date().toISOString().slice(0,10);

  if (cardId === 'presentes') {
    cor = DC.green; titulo = '✅ Presentes hoje';
    var lista = d.colaboradores.filter(function(c) {
      var f = (d.flags||{})[c.nome]||{};
      return !f.off && !f.ferias && !f.atestado;
    });
    subtitulo = lista.length + ' colaborador' + (lista.length!==1?'es':'') + ' presente' + (lista.length!==1?'s':'');
    conteudo = lista.length === 0
      ? '<div class="dcm-empty">Nenhum colaborador presente</div>'
      : lista.map(function(c) {
          return '<div class="dcm-row">' +
            '<div class="dcm-av" style="background:rgba(74,222,128,.12);color:' + DC.green + '">' + dcEsc((c.nome||'?').charAt(0).toUpperCase()) + '</div>' +
            '<div class="dcm-info"><strong>' + dcEsc(c.nome||'?') + '</strong><span>' + dcEsc(c.cargo||'Sem cargo') + '</span></div>' +
            '<div class="dcm-badge" style="color:' + DC.green + '">✅</div>' +
          '</div>';
        }).join('');
  }
  else if (cardId === 'ausentes') {
    cor = DC.red; titulo = '⛔ Ausentes hoje';
    var lista = d.colaboradores.map(function(c) {
      var f = (d.flags||{})[c.nome]||{};
      var motivo = null, detalhe = '';
      if (f.ferias)   { motivo='🌴'; detalhe='Férias'; }
      if (f.atestado) { motivo='🩺'; detalhe='Atestado'; }
      if (f.off)      { motivo='🔴'; detalhe='Day off'; }
      return motivo ? {nome:c.nome, cargo:c.cargo, motivo:motivo, detalhe:detalhe} : null;
    }).filter(Boolean);
    subtitulo = lista.length===0 ? 'Equipe completa hoje! 🎉' : lista.length + ' fora hoje';
    conteudo = lista.length === 0
      ? '<div class="dcm-empty" style="text-align:center;padding:28px 0"><div style="font-size:36px">✅</div><p>Equipe completa hoje!</p></div>'
      : lista.map(function(p) {
          var c2 = p.detalhe==='Férias'?DC.teal : p.detalhe==='Atestado'?DC.gold : DC.red;
          return '<div class="dcm-row">' +
            '<div class="dcm-av" style="background:rgba(248,113,113,.12);color:' + c2 + '">' + dcEsc((p.nome||'?').charAt(0).toUpperCase()) + '</div>' +
            '<div class="dcm-info"><strong>' + dcEsc(p.nome) + '</strong><span>' + dcEsc(p.cargo||'') + '</span></div>' +
            '<div class="dcm-badge" style="color:' + c2 + '">' + p.motivo + ' ' + dcEsc(p.detalhe) + '</div>' +
          '</div>';
        }).join('');
  }
  else if (cardId === 'folgas') {
    cor = DC.gold; titulo = '📅 Folgas futuras';
    var hd = new Date(); hd.setHours(0,0,0,0);
    var lista = d.folgas.filter(function(f) {
      return !dcIsFerias(f) && new Date(f.data_folga+'T00:00:00')>=hd;
    }).sort(function(a,b){ return a.data_folga.localeCompare(b.data_folga); });
    var hc = lista.filter(function(f){ return f.data_folga===hoje; }).length;
    subtitulo = hc + ' hoje · ' + lista.length + ' agendadas';
    conteudo = lista.length===0
      ? '<div class="dcm-empty">Nenhuma folga agendada</div>'
      : lista.map(function(f) {
          var nome = f.colaborador_nome||f.nome||'?';
          var dt = f.data_folga ? new Date(f.data_folga+'T00:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}) : '';
          return '<div class="dcm-row">' +
            '<div class="dcm-av" style="background:rgba(245,200,66,.12);color:' + DC.gold + '">' + dcEsc(nome.charAt(0).toUpperCase()) + '</div>' +
            '<div class="dcm-info"><strong>' + dcEsc(nome) + '</strong><span>' + dcEsc(dt) + (f.motivo?' · '+dcEsc(f.motivo):'') + '</span></div>' +
            '<div class="dcm-badge" style="color:' + DC.gold + '">' + (f.data_folga===hoje?'📅 Hoje':'📅') + '</div>' +
          '</div>';
        }).join('');
  }
  else if (cardId === 'ferias') {
    cor = DC.blue; titulo = '🏖 Férias ativas';
    var hd = new Date(); hd.setHours(0,0,0,0);
    var lista = d.folgas.filter(function(f) {
      return dcIsFerias(f) && new Date(dcFeriasFim(f)+'T00:00:00')>=hd;
    }).sort(function(a,b){ return a.data_folga.localeCompare(b.data_folga); });
    var hc = lista.filter(function(f){ return hoje>=f.data_folga && hoje<=dcFeriasFim(f); }).length;
    subtitulo = hc + ' hoje · ' + lista.length + ' agendadas';
    conteudo = lista.length===0
      ? '<div class="dcm-empty">Nenhuma férias ativa</div>'
      : lista.map(function(f) {
          var nome = f.colaborador_nome||f.nome||'?';
          var ini = f.data_folga ? new Date(f.data_folga+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
          var fim = f.data_fim   ? new Date(f.data_fim+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) : ini;
          var now = hoje>=f.data_folga && hoje<=dcFeriasFim(f);
          return '<div class="dcm-row">' +
            '<div class="dcm-av" style="background:rgba(96,165,250,.12);color:' + DC.blue + '">' + dcEsc(nome.charAt(0).toUpperCase()) + '</div>' +
            '<div class="dcm-info"><strong>' + dcEsc(nome) + '</strong><span>' + ini + ' → ' + fim + '</span></div>' +
            '<div class="dcm-badge" style="color:' + DC.blue + '">' + (now?'🏖 Agora':'🏖') + '</div>' +
          '</div>';
        }).join('');
  }
  else if (cardId === 'pendencias') {
    cor = DC.orange; titulo = '📋 Pendências';
    var emAnalise   = d.pendEmAnalise  || d.pendencias.filter(function(p){ return !p.caso_aberto && !p._concluida; });
    var comCaso     = d.pendCasoAb     || d.pendencias.filter(function(p){ return p.caso_aberto  && !p._concluida; });
    var concluidas  = d.pendConcluidas || [];
    var totalAb = emAnalise.length + comCaso.length;
    subtitulo = totalAb + ' em aberto · ' + concluidas.length + ' concluídas';
    var rPend = function(lst, cor2, badge) {
      if (!lst.length) return '<div class="dcm-empty">Nenhum registro</div>';
      return lst.map(function(p) {
        var nome = p.cliente||p.nome||p.colaborador||'Pendência';
        var dt = p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
        var dtConc = p._concluidaEm ? ' · Concluída ' + new Date(p._concluidaEm).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
        var locStr = (p.cidade || p.estado) ? ' · 📍' + [p.cidade, p.estado].filter(Boolean).join(', ') : '';
        return '<div class="dcm-row">' +
          '<div class="dcm-av" style="background:rgba(251,146,60,.12);color:' + DC.orange + '">' + dcEsc(nome.charAt(0).toUpperCase()) + '</div>' +
          '<div class="dcm-info"><strong>' + dcEsc(nome) + '</strong><span>' + (p.cnpj?'CNPJ '+dcEsc(p.cnpj)+' ':'')+dt+dtConc+dcEsc(locStr) + '</span></div>' +
          '<div class="dcm-badge" style="color:' + cor2 + '">' + badge + '</div>' +
        '</div>';
      }).join('');
    };
    conteudo =
      '<div style="margin-bottom:12px"><div class="dcm-section-title" style="color:#f5c842">🔍 Em Análise (' + emAnalise.length + ')</div>' + rPend(emAnalise, DC.gold, '🔍 Análise') + '</div>' +
      '<div style="margin-bottom:12px"><div class="dcm-section-title" style="color:' + DC.orange + '">🔴 Caso Aberto (' + comCaso.length + ')</div>' + rPend(comCaso, DC.orange, '🔴 Caso aberto') + '</div>' +
      '<div><div class="dcm-section-title" style="color:' + DC.teal + '">✅ Concluídas (' + concluidas.length + ')</div>' + rPend(concluidas, DC.teal, '✅ Concluída') + '</div>';
  }
  else if (cardId === 'importacoes') {
    cor = DC.purple; titulo = '📥 Importações PEV';
    var comImp = d.importacoes.filter(function(i){ return i.importacao==='sim'; });
    var semImp = d.importacoes.filter(function(i){ return i.importacao!=='sim'; });
    subtitulo = comImp.length + ' com importação · ' + semImp.length + ' sem';
    var rImp = function(lst) {
      if (!lst.length) return '<div class="dcm-empty">Nenhum registro</div>';
      return lst.map(function(i) {
        var placa = i.placa||i.veiculo||'Veículo';
        var dt = i.criado_em ? new Date(i.criado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
        var bc = i.importacao==='sim'?DC.teal:DC.red;
        return '<div class="dcm-row">' +
          '<div class="dcm-av" style="background:rgba(167,139,250,.12);color:' + DC.purple + '">' + dcEsc(placa.charAt(0).toUpperCase()) + '</div>' +
          '<div class="dcm-info"><strong>' + dcEsc(placa) + '</strong><span>' + dt + (i.tecnico?' · '+dcEsc(i.tecnico):'') + '</span></div>' +
          '<div class="dcm-badge" style="color:' + bc + '">' + (i.importacao==='sim'?'✅ Importado':'❌ Sem import.') + '</div>' +
        '</div>';
      }).join('');
    };
    conteudo = '<div style="margin-bottom:12px"><div class="dcm-section-title" style="color:' + DC.teal + '">✅ Com importação (' + comImp.length + ')</div>' + rImp(comImp) + '</div>' +
               '<div><div class="dcm-section-title" style="color:' + DC.red + '">❌ Sem importação (' + semImp.length + ')</div>' + rImp(semImp) + '</div>';
  }

  /* Cria/reutiliza overlay */
  var overlay = document.getElementById('dcm-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'dcm-modal-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2000;align-items:center;justify-content:center;';
    overlay.innerHTML =
      '<div id="dcm-modal" style="background:#1a1a2e;border:1px solid rgba(255,255,255,.1);border-radius:16px;width:min(460px,94vw);max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 50px rgba(0,0,0,.55);">' +
        '<div id="dcm-header" style="padding:18px 20px 14px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between;">' +
          '<div><h3 id="dcm-titulo" style="margin:0;font-size:15px;font-weight:700;"></h3>' +
          '<p id="dcm-sub" style="margin:3px 0 0;font-size:11px;opacity:.55;"></p></div>' +
          '<button onclick="document.getElementById(\'dcm-modal-overlay\').style.display=\'none\'" style="background:none;border:none;font-size:18px;cursor:pointer;color:rgba(255,255,255,.5);line-height:1;padding:4px 6px;border-radius:6px;" onmouseover="this.style.background=\'rgba(255,255,255,.08)\'" onmouseout="this.style.background=\'none\'">✕</button>' +
        '</div>' +
        '<div id="dcm-body" style="overflow-y:auto;padding:14px 16px 18px;flex:1;"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.style.display='none'; });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') overlay.style.display='none'; });
  }

  document.getElementById('dcm-header').style.borderBottomColor = cor + '33';
  document.getElementById('dcm-titulo').textContent = titulo;
  document.getElementById('dcm-titulo').style.color = cor;
  document.getElementById('dcm-sub').textContent = subtitulo;
  document.getElementById('dcm-body').innerHTML = conteudo;
  overlay.style.display = 'flex';
}
window.dcAbrirModal = dcAbrirModal;

/* ─── CSS injetado ─────────────────────────────────── */
function injectDcCSS() {
  if (document.getElementById('dc-styles')) return;
  var style = document.createElement('style');
  style.id = 'dc-styles';
  style.textContent = `
#dc-dashboard-charts { margin-bottom: 1.5rem; }

/* KPI row — 6 colunas, sempre ocupa toda a largura */
.dc2-kpi-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
@media(max-width:1200px) { .dc2-kpi-row { grid-template-columns: repeat(3,1fr); } }
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

/* ─── Modal KPI drill-down rows ─────────────── */
.dcm-row { display:flex; align-items:center; gap:12px; padding:9px 10px; border-radius:10px; margin-bottom:4px; transition:background .15s; }
.dcm-row:hover { background:rgba(255,255,255,.04); }
.dcm-av { width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; flex-shrink:0; }
.dcm-info { flex:1; min-width:0; }
.dcm-info strong { display:block; font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dcm-info span   { display:block; font-size:11px; opacity:.5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dcm-badge { font-size:11px; font-weight:600; white-space:nowrap; flex-shrink:0; }
.dcm-empty { text-align:center; padding:20px 0; font-size:12px; opacity:.4; }
.dcm-section-title { font-size:11px; font-weight:700; letter-spacing:.3px; text-transform:uppercase; margin-bottom:6px; padding:0 2px; opacity:.8; }

/* Rows de 3 colunas */
.dc2-row-mapa {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.dc2-row-3 {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}
@media(max-width:1200px) { .dc2-row-3 { grid-template-columns: 1fr 1fr; } }
@media(max-width:680px)  { .dc2-row-3 { grid-template-columns: 1fr; } }
@media(max-width:680px)  {
  .dc2-kpi-sub { white-space: normal; }
  .dc2-aus-cols { flex-direction: column; }
  .dc2-act-grid { gap: 4px; }
}

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

/* ─── Montagem no DOM (VERSÃO CORRIGIDA) ─────────────────────────── */
function mountDashboardCharts() {
  var page = document.getElementById('page-dashboard');
  if (!page) return;

  /* Ocultar painel-indicadores e barra-ocupacao originais */
  var painelInd = document.getElementById('painel-indicadores');
  var barraOc   = document.getElementById('barra-ocupacao');
  if (painelInd) painelInd.style.display = 'none';
  if (barraOc)   barraOc.style.display   = 'none';

  var container = document.getElementById('dc-dashboard-charts');
  if (!container) {
    container = document.createElement('div');
    container.id = 'dc-dashboard-charts';
    var grid4 = page.querySelector('.grid4, .grid5');
    if (grid4) grid4.after(container);
    else page.appendChild(container);
  }
  
  injectDcCSS();
  
  // ✅ CORREÇÃO: Aguardar dados antes de renderizar
  waitForDataThenRender();
}

/* ─── Aguardar dados estarem prontos ─────────────────────────── */
function waitForDataThenRender() {
  var attempts = 0;
  var maxAttempts = 50; // 5 segundos máximo
  
  function checkData() {
    attempts++;
    
    // Verifica se dados básicos existem
    var pitstopColabs = JSON.parse(localStorage.getItem('pitstop_colaboradores') || '[]');
    var pevColabs = JSON.parse(localStorage.getItem('pev_colaboradores') || '[]');
    
    var hasData = pitstopColabs.length > 0;
    
    if (hasData) {
      console.log('✅ Dashboard: Dados prontos, renderizando...');
      renderDashboardCharts();
      
      // Se PEV ainda não tem dados, escuta evento
      if (pevColabs.length === 0) {
        console.log('⏳ Dashboard: Aguardando dados PEV...');
        window.addEventListener('pev-data-ready', function() {
          console.log('🔄 Dashboard: PEV chegou, re-renderizando...');
          renderDashboardCharts();
        }, { once: true });
      }
    } else if (attempts < maxAttempts) {
      // Tenta novamente em 100ms
      setTimeout(checkData, 100);
    } else {
      console.error('❌ Dashboard: Timeout aguardando dados');
      // Renderiza mesmo assim (mostrará empty states)
      renderDashboardCharts();
    }
  }
  
  checkData();
}

/* ─── Auto-refresh (VERSÃO CORRIGIDA - SEM LOOP) ────────────────────────── */
var dashboardIsRendering = false;
var lastRenderTime = 0;

function startDashboardAutoRefresh() {
  // Escuta mudanças de localStorage de OUTRAS abas
  // IMPORTANTE: storage event só dispara em outras abas, não na mesma
  window.addEventListener('storage', function(e) {
    if (e.key && (e.key.indexOf('pitstop_') === 0 || e.key.indexOf('pev_') === 0)) {
      // Evita re-render muito frequente (debounce de 1 segundo)
      var now = Date.now();
      if (now - lastRenderTime > 1000 && !dashboardIsRendering) {
        console.log('🔄 Dashboard: Storage mudou em outra aba, atualizando...');
        renderDashboardCharts();
      }
    }
  });
  
  // Escuta eventos customizados
  window.addEventListener('system-data-ready', function(e) {
    if (e.detail && e.detail.allReady && !dashboardIsRendering) {
      console.log('🎉 Dashboard: Todos dados prontos, renderizando...');
      renderDashboardCharts();
    }
  });
  
  // Atualiza quando clica no tab dashboard
  var tabClickHandlerAdded = false;
  document.querySelectorAll('.tab[data-tab="dashboard"]').forEach(function(btn) {
    if (!tabClickHandlerAdded) {
      btn.addEventListener('click', function() {
        if (!dashboardIsRendering) {
          setTimeout(renderDashboardCharts, 80);
        }
      });
      tabClickHandlerAdded = true;
    }
  });
  
  // Auto-refresh periódico (5 minutos) - aumentado para evitar sobrecarga
  setInterval(function() {
    if (!dashboardIsRendering) {
      renderDashboardCharts();
    }
  }, 300000); // 5 minutos
  
  console.log('✅ Dashboard: Auto-refresh configurado (sem loops)');
}

/* ─── Init (VERSÃO MELHORADA) ────────────────────────────────── */
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

// API pública para refresh manual
window.DC_refreshDashboard = renderDashboardCharts;
