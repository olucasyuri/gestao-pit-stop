/**
 * Gestão PEV — Lógica do setor PEV
 * Sub-abas: Escala, Almoço, Equipe
 * Namespace: PEV_
 */
"use strict";

/* ── Colaboradores padrão ────────────────────────────────── */
const PEV_COLABORADORES_DEFAULT = [
  {nome:"Gabriel Santos",    horario:"08h - 18h",    regiao:"Aracaju",                  almoco:"12:00"},
  {nome:"Michel",            horario:"08h - 18h",    regiao:"Aracaju",                  almoco:"13:12"},
  {nome:"Luan",              horario:"08h - 18h",    regiao:"Aracaju",                  almoco:"11:00"},
  {nome:"Vieira",            horario:"08h - 18h",    regiao:"São Luiz",                 almoco:"13:12"},
  {nome:"Silas",             horario:"08h - 18h",    regiao:"São Luiz",                 almoco:"12:00"},
  {nome:"Pablo Ricardo",     horario:"08h - 14h",    regiao:"São Luiz",                 almoco:"10:30"},
  {nome:"Artur Oliveira",    horario:"08h - 18h",    regiao:"Ipatinga / Teófilo Otoni", almoco:"12:00"},
  {nome:"Lukas Gabriel",     horario:"08h - 18h",    regiao:"Ipatinga / Teófilo Otoni", almoco:"13:12"},
  {nome:"Resende",           horario:"08h - 18h",    regiao:"Ipatinga / Teófilo Otoni", almoco:"11:00"},
  {nome:"Luciano",           horario:"12h - 18h",    regiao:"Ipatinga / Teófilo Otoni", almoco:"15:00"},
  {nome:"Azevedo",           horario:"08h - 18h",    regiao:"Ribeirão Preto",           almoco:"12:00"},
  {nome:"Samuel Shimada",    horario:"08h - 18h",    regiao:"Ribeirão Preto",           almoco:"13:12"},
  {nome:"Assunção",          horario:"08h - 14h",    regiao:"Goiânia",                  almoco:"10:45"},
  {nome:"Matheus Diogo",     horario:"08h - 18h",    regiao:"Goiânia",                  almoco:"12:00"},
  {nome:"Guilherme Ferreira",horario:"12h - 18h",    regiao:"Goiânia",                  almoco:"14:45"},
  {nome:"Glennendy",         horario:"12h - 18h",    regiao:"Juazeiro do Norte",        almoco:"15:30"},
  {nome:"Willy",             horario:"08h - 14h",    regiao:"Juazeiro do Norte",        almoco:"11:30"},
  {nome:"Alvarenga",         horario:"08h - 18h",    regiao:"Cuiabá",                   almoco:"12:00"},
  {nome:"Joadson",           horario:"08h - 18h",    regiao:"Cuiabá",                   almoco:"13:12"},
  {nome:"Firmino",           horario:"14h - 19h",    regiao:"Cuiabá",                   almoco:"15:30"},
  {nome:"Atanael",           horario:"07:30 - 13:30",regiao:"Cuiabá",                   almoco:"10:30"},
];

const PEV_AVATAR_COLORS = [
  ["#f0b429","#0c0c0f"],["#60a5fa","#0a1528"],["#3dd68c","#051a0f"],
  ["#a78bfa","#0d0a1a"],["#fb923c","#1a0b00"],["#22d3ee","#001820"],
  ["#f472b6","#1a0010"],["#e2e8f0","#0c0c0f"]
];

// Region accent colors
const PEV_REGION_COLORS = [
  "#f0b429","#60a5fa","#3dd68c","#a78bfa",
  "#fb923c","#22d3ee","#f472b6","#e879f9"
];

/* ── Estado ──────────────────────────────────────────────── */
let PEV_colabs = JSON.parse(localStorage.getItem('pev_colaboradores') || 'null')
                 || PEV_COLABORADORES_DEFAULT.map(c => ({...c}));
let PEV_escalaState = {};
let PEV_almocoState = {};
let PEV_currentDate = PEV_today();

const DIAS_PT = ['Domingo','Segunda-Feira','Terça-Feira','Quarta-Feira','Quinta-Feira','Sexta-Feira','Sábado'];

/* ── Utilitários ─────────────────────────────────────────── */
function PEV_today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
}
function PEV_saveColabs() {
  localStorage.setItem('pev_colaboradores', JSON.stringify(PEV_colabs));
}

/* Salva/atualiza colaborador no Supabase (upsert) */
async function PEV_saveColabSupabase(colab) {
  if (typeof supa === 'undefined' || !supa) return;
  try {
    if (!colab.id) {
      colab.id = 'pev_colab_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }
    const { error } = await supa
      .from('pev_colaboradores')
      .upsert({ id: colab.id, nome: colab.nome, horario: colab.horario, regiao: colab.regiao, almoco: colab.almoco, ativo: true }, { onConflict: 'id' });
    if (error) throw error;
    console.log('✅ PEV Supabase: colaborador salvo —', colab.nome);
  } catch (e) {
    console.error('❌ PEV Supabase: erro ao salvar —', e.message);
  }
}

/* Desativa colaborador no Supabase (soft delete) */
async function PEV_deleteColabSupabase(colab) {
  if (typeof supa === 'undefined' || !supa || !colab.id) return;
  try {
    const { error } = await supa
      .from('pev_colaboradores')
      .update({ ativo: false })
      .eq('id', colab.id);
    if (error) throw error;
    console.log('✅ PEV Supabase: colaborador desativado —', colab.nome);
  } catch (e) {
    console.error('❌ PEV Supabase: erro ao desativar —', e.message);
  }
}

function PEV_initState() {
  PEV_colabs.forEach(c => {
    if (!PEV_escalaState[c.nome]) PEV_escalaState[c.nome] = {status:'none', ext:'dia', obs:''};
    if (!PEV_almocoState[c.nome]) PEV_almocoState[c.nome] = {horario:c.almoco, done:false};
  });
}
PEV_initState();

function PEV_avatarColor(nome) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) & 0xffff;
  return PEV_AVATAR_COLORS[h % PEV_AVATAR_COLORS.length];
}
function PEV_initials(nome) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}
function PEV_parseDateDisplay(iso) {
  const [y,m,d] = iso.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y} — <span>${DIAS_PT[dt.getDay()]}</span>`;
}
function PEV_updateDateDisplays() {
  const html = PEV_parseDateDisplay(PEV_currentDate);
  const ed = document.getElementById('pev-escala-date-display');
  const ad = document.getElementById('pev-almoco-date-display');
  if (ed) ed.innerHTML = html;
  if (ad) ad.innerHTML = html;
}

/* ── Sub-abas ────────────────────────────────────────────── */
function PEV_goTab(id) {
  document.querySelectorAll('.pev-tab').forEach(t => t.classList.toggle('active', t.dataset.pevTab === id));
  document.querySelectorAll('.pev-page').forEach(p => {
    const isActive = p.id === 'pev-page-' + id;
    if (isActive) {
      p.classList.remove('active');
      // Force reflow to restart animation
      void p.offsetWidth;
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });
}

/* ── Escala — status definitions ────────────────────────── */
const PEV_STATUSES = [
  { key: 'int',   label: 'Interno',    icon: '🏢', cls: 's-int' },
  { key: 'ext',   label: 'Externo',    icon: '🚗', cls: 's-ext' },
  { key: 'folga', label: 'Folga',      icon: '📅', cls: 's-folga' },
  { key: 'ferias',label: 'Férias',     icon: '🏖',  cls: 's-ferias' },
  { key: 'off',   label: 'OFF',        icon: '✕',   cls: 's-off' },
];
const PEV_EXT_OPTS = [
  { key: 'dia',   label: 'Dia todo' },
  { key: 'manha', label: 'Manhã' },
  { key: 'tarde', label: 'Tarde' },
];

/* ── Escala — render por regiões ─────────────────────────── */
function PEV_getRegioes() {
  const seen = new Set();
  const regioes = [];
  PEV_colabs.forEach(c => { if (!seen.has(c.regiao)) { seen.add(c.regiao); regioes.push(c.regiao); } });
  return regioes;
}

function PEV_regionColor(regiao) {
  let h = 0;
  for (let i = 0; i < regiao.length; i++) h = (h * 31 + regiao.charCodeAt(i)) & 0xffff;
  return PEV_REGION_COLORS[h % PEV_REGION_COLORS.length];
}

function PEV_renderEscalaList() {
  const list = document.getElementById('pev-escala-list');
  if (!list) return;
  list.innerHTML = '';

  const regioes = PEV_getRegioes();

  // Empty state when no colabs have status yet
  const anyStatus = PEV_colabs.some(c => (PEV_escalaState[c.nome]?.status || 'none') !== 'none');
  if (!anyStatus && PEV_colabs.length > 0) {
    // Still render the list but note the tip — just add a tip above
  }

  regioes.forEach(regiao => {
    const colabsRegiao = PEV_colabs.filter(c => c.regiao === regiao);
    const color = PEV_regionColor(regiao);

    const block = document.createElement('div');
    block.className = 'pev-region-block';

    // Calcular progresso da região
    const feitos = colabsRegiao.filter(c => (PEV_escalaState[c.nome]?.status || 'none') !== 'none').length;
    const total  = colabsRegiao.length;

    // Counts por status para a mini-barra
    const cInt    = colabsRegiao.filter(c => PEV_escalaState[c.nome]?.status === 'int').length;
    const cExt    = colabsRegiao.filter(c => PEV_escalaState[c.nome]?.status === 'ext').length;
    const cOff    = colabsRegiao.filter(c => PEV_escalaState[c.nome]?.status === 'off').length;
    const cAus    = colabsRegiao.filter(c => ['folga','ferias'].includes(PEV_escalaState[c.nome]?.status)).length;
    const cNone   = colabsRegiao.filter(c => (PEV_escalaState[c.nome]?.status || 'none') === 'none').length;

    // Mini-bar segments (só mostra se houver algum status)
    const miniBarSegs = [];
    if (cInt)  miniBarSegs.push(`<div class="pev-region-mini-bar-seg" style="background:var(--gold);flex:${cInt}"></div>`);
    if (cExt)  miniBarSegs.push(`<div class="pev-region-mini-bar-seg" style="background:var(--blue);flex:${cExt}"></div>`);
    if (cOff)  miniBarSegs.push(`<div class="pev-region-mini-bar-seg" style="background:var(--red);flex:${cOff}"></div>`);
    if (cAus)  miniBarSegs.push(`<div class="pev-region-mini-bar-seg" style="background:var(--purple);flex:${cAus}"></div>`);
    if (cNone) miniBarSegs.push(`<div class="pev-region-mini-bar-seg" style="background:var(--surface4);flex:${cNone}"></div>`);
    const miniBarHtml = `<div class="pev-region-mini-bar" title="${cInt} Int · ${cExt} Ext · ${cOff} OFF · ${cAus} Aus">${miniBarSegs.join('')}</div>`;

    // Header da região
    const header = document.createElement('div');
    header.className = 'pev-region-header';
    header.innerHTML = `
      <div class="pev-region-left">
        <span class="pev-region-color" style="background:${color}"></span>
        <span class="pev-region-name">${regiao}</span>
        <span class="pev-region-badge">${colabsRegiao.length}</span>
        <span class="pev-region-progress">${feitos}/${total}</span>
        ${miniBarHtml}
      </div>
      <div class="pev-region-mass">
        <button class="pev-mbtn mint" data-reg="${regiao}" data-mass="int" type="button">Interno</button>
        <button class="pev-mbtn mext" data-reg="${regiao}" data-mass="ext" type="button">Externo</button>
        <button class="pev-mbtn moff" data-reg="${regiao}" data-mass="off" type="button">OFF</button>
        <button class="pev-mbtn mfol" data-reg="${regiao}" data-mass="folga" type="button">Folga</button>
      </div>
      <span class="pev-collapse-icon">▼</span>
    `;

    const rows = document.createElement('div');
    rows.className = 'pev-region-rows';

    header.querySelector('.pev-region-left').onclick = () => {
      header.classList.toggle('collapsed');
      rows.classList.toggle('collapsed');
    };

    // Mass action buttons
    header.querySelectorAll('[data-mass]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const status = btn.dataset.mass;
        colabsRegiao.forEach(c => {
          PEV_escalaState[c.nome] = { ...PEV_escalaState[c.nome], status, ext: 'dia' };
        });
        PEV_saveEscala();
        PEV_renderEscalaList();
        PEV_renderEscalaOutput();
        PEV_renderProgressBar();
      };
    });

    // Individual rows
    colabsRegiao.forEach(c => {
      const st = PEV_escalaState[c.nome] || { status: 'none', ext: 'dia' };
      const [bg, fg] = PEV_avatarColor(c.nome);
      const row = document.createElement('div');
      row.className = `pev-status-row${st.status !== 'none' ? ' is-' + st.status : ''}`;

      // Status buttons HTML
      const statusBtns = PEV_STATUSES.map(s => {
        const active = st.status === s.key ? s.cls : '';
        return `<button class="pev-sbtn ${active}" data-nome="${c.nome}" data-status="${s.key}" type="button">${s.icon} ${s.label}</button>`;
      }).join('');

      // External sub-options (shown when ext active)
      const extOptsHtml = PEV_EXT_OPTS.map(o =>
        `<button class="pev-ext-opt ${st.status === 'ext' && st.ext === o.key ? 'active' : ''}" data-nome="${c.nome}" data-ext="${o.key}" type="button">${o.label}</button>`
      ).join('');
      const extVisible = st.status === 'ext' ? '' : 'display:none';

      row.innerHTML = `
        <div class="pev-avatar" style="background:${bg};color:${fg}">${PEV_initials(c.nome)}</div>
        <div class="pev-colab-info">
          <div class="pev-colab-name">${c.nome}</div>
          <div class="pev-colab-sub">${c.horario}</div>
        </div>
        <span class="pev-horario-badge">${c.horario}</span>
        <div class="pev-status-btns">
          ${statusBtns}
          <div class="pev-ext-options" style="${extVisible}">
            ${extOptsHtml}
          </div>
        </div>
      `;

      // Status button clicks
      row.querySelectorAll('[data-status]').forEach(btn => {
        btn.onclick = () => {
          PEV_escalaState[btn.dataset.nome] = {
            ...PEV_escalaState[btn.dataset.nome],
            status: btn.dataset.status,
            ext: 'dia'
          };
          PEV_saveEscala();
          PEV_renderEscalaList();
          PEV_renderEscalaOutput();
          PEV_renderProgressBar();
        };
      });

      // Externo sub-option clicks
      row.querySelectorAll('[data-ext]').forEach(btn => {
        btn.onclick = () => {
          PEV_escalaState[btn.dataset.nome] = {
            ...PEV_escalaState[btn.dataset.nome],
            status: 'ext',
            ext: btn.dataset.ext
          };
          PEV_saveEscala();
          PEV_renderEscalaList();
          PEV_renderEscalaOutput();
          PEV_renderProgressBar();
        };
      });

      rows.appendChild(row);
    });

    block.appendChild(header);
    block.appendChild(rows);
    list.appendChild(block);
  });

  PEV_renderProgressBar();
}

function PEV_saveEscala() {
  localStorage.setItem('pev_escala_'+PEV_currentDate, JSON.stringify(PEV_escalaState));
}

function PEV_renderProgressBar() {
  const total = PEV_colabs.length;
  const feitos = PEV_colabs.filter(c => (PEV_escalaState[c.nome]?.status || 'none') !== 'none').length;
  const pct = total ? Math.round(feitos/total*100) : 0;
  const fill  = document.getElementById('pev-progress-fill');
  const count = document.getElementById('pev-progress-count');
  const stats = document.getElementById('pev-escala-stats');
  if (fill) {
    fill.style.width = pct + '%';
    fill.classList.toggle('complete', pct === 100);
  }
  if (count) count.innerHTML = `<strong>${feitos}</strong> / ${total}`;

  const p = PEV_colabs.filter(c => PEV_escalaState[c.nome]?.status === 'int').length;
  const e = PEV_colabs.filter(c => PEV_escalaState[c.nome]?.status === 'ext').length;
  const f = PEV_colabs.filter(c => PEV_escalaState[c.nome]?.status === 'off').length;
  const o = PEV_colabs.filter(c => ['folga','ferias'].includes(PEV_escalaState[c.nome]?.status)).length;

  if (stats) {
    stats.innerHTML = `
      <span class="pev-stat-chip presente">🏢 ${p} Interno</span>
      <span class="pev-stat-chip presente" style="color:var(--blue);border-color:var(--blue-border);background:var(--blue-bg)">🚗 ${e} Externo</span>
      <span class="pev-stat-chip falta">✕ ${f} OFF</span>
      ${o ? `<span class="pev-stat-chip outros">📅 ${o} Ausente</span>` : ''}
    `;
  }

  // Dashboard strip — 4 células grandes no topo
  const strip = document.getElementById('pev-escala-dash');
  if (strip) {
    strip.innerHTML = `
      <div class="pev-dash-cell d-int">
        <span class="pev-dash-num">${p}</span>
        <span class="pev-dash-lbl">🏢 Internos</span>
      </div>
      <div class="pev-dash-cell d-ext">
        <span class="pev-dash-num">${e}</span>
        <span class="pev-dash-lbl">🚗 Externos</span>
      </div>
      <div class="pev-dash-cell d-off">
        <span class="pev-dash-num">${f}</span>
        <span class="pev-dash-lbl">✕ OFF</span>
      </div>
      <div class="pev-dash-cell d-aus">
        <span class="pev-dash-num">${o}</span>
        <span class="pev-dash-lbl">📅 Ausentes</span>
      </div>
    `;
  }
}

function PEV_renderEscalaOutput() {
  const out = document.getElementById('pev-escala-output');
  if (!out) return;
  const [y,m,d] = PEV_currentDate.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  const dia = DIAS_PT[dt.getDay()];

  const internos = [], externos = [], offs = [], ausencias = [];

  PEV_colabs.forEach(c => {
    const st = PEV_escalaState[c.nome] || { status: 'none', ext: 'dia' };
    const linha = `• ${c.nome} (${c.regiao})`;
    switch (st.status) {
      case 'int':    internos.push(linha); break;
      case 'ext': {
        const turno = st.ext && st.ext !== 'dia' ? ` — Externo ${st.ext === 'manha' ? 'manhã' : 'tarde'}` : ' — Externo (dia todo)';
        externos.push(linha + turno); break;
      }
      case 'off':    offs.push(linha); break;
      case 'folga':  ausencias.push(linha + ' — Folga'); break;
      case 'ferias': ausencias.push(linha + ' — Férias'); break;
    }
  });

  let msg = `📋 Escala PEV — ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y} (${dia})\n\n`;
  if (internos.length) msg += `🏢 Internos (${internos.length}):\n${internos.join('\n')}\n\n`;
  if (externos.length) msg += `🚗 Externos (${externos.length}):\n${externos.join('\n')}\n\n`;
  if (offs.length)     msg += `✕ OFF (${offs.length}):\n${offs.join('\n')}\n\n`;
  if (ausencias.length) msg += `📅 Ausências (${ausencias.length}):\n${ausencias.join('\n')}\n\n`;
  msg = msg.trim();

  out.textContent = msg || '';
  if (!msg) out.innerHTML = '<em>Configure a escala acima para gerar a mensagem...</em>';
}

/* ── Almoço ──────────────────────────────────────────────── */
function PEV_renderAlmocoList() {
  const list = document.getElementById('pev-almoco-list');
  if (!list) return;
  list.innerHTML = '';
  PEV_colabs.forEach(c => {
    const st = PEV_almocoState[c.nome] || {horario:c.almoco, done:false};
    const [bg, fg] = PEV_avatarColor(c.nome);
    const row = document.createElement('div');
    row.className = 'pev-almoco-row' + (st.done ? ' done-row' : '');
    row.innerHTML = `
      <div class="pev-almoco-check ${st.done ? 'done' : ''}" data-nome="${c.nome}" title="${st.done ? 'Desfazer' : 'Marcar saída'}">
        ${st.done ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
      </div>
      <div class="pev-avatar" style="background:${bg};color:${fg};width:28px;height:28px;font-size:10px">${PEV_initials(c.nome)}</div>
      <div class="pev-colab-info" style="flex:1">
        <div class="pev-colab-name" style="${st.done ? 'text-decoration:line-through;opacity:.45' : ''}">${c.nome}</div>
        <div class="pev-almoco-region">${c.regiao}</div>
      </div>
      <input class="pev-almoco-time" type="time" value="${st.horario}" data-nome="${c.nome}">
    `;
    row.querySelector('.pev-almoco-check').onclick = () => {
      PEV_almocoState[c.nome] = {...st, done: !st.done};
      PEV_saveAlmocoState();
      PEV_renderAlmocoList();
      PEV_renderAlmocoOutput();
    };
    row.querySelector('.pev-almoco-time').onchange = (e) => {
      PEV_almocoState[c.nome] = {...(PEV_almocoState[c.nome] || {}), horario: e.target.value};
      PEV_saveAlmocoState();
      PEV_renderAlmocoOutput();
    };
    list.appendChild(row);
  });
  PEV_renderAlmocoOutput();
}
function PEV_saveAlmocoState() {
  localStorage.setItem('pev_almoco_'+PEV_currentDate, JSON.stringify(PEV_almocoState));
}
function PEV_renderAlmocoOutput() {
  const out = document.getElementById('pev-almoco-output');
  if (!out) return;
  const saidos = PEV_colabs.filter(c => PEV_almocoState[c.nome]?.done);
  if (!saidos.length) { out.innerHTML = '<em>Marque os almoços acima para gerar a mensagem...</em>'; return; }
  const [y,m,d] = PEV_currentDate.split('-').map(Number);
  let msg = `🍽️ Horários de Almoço — PEV\n${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}\n\n`;
  saidos.forEach(c => {
    const h = PEV_almocoState[c.nome]?.horario || c.almoco;
    msg += `• ${c.nome} — ${h}\n`;
  });
  out.textContent = msg.trim();
}

/* ── Equipe ──────────────────────────────────────────────── */
let PEV_editingColabIdx = null;

function PEV_renderEquipe() {
  const list = document.getElementById('pev-team-list');
  if (!list) return;
  if (!PEV_colabs.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:24px">Nenhum colaborador cadastrado.</p>';
    return;
  }
  list.innerHTML = '';
  PEV_colabs.forEach((c, i) => {
    const [bg, fg] = PEV_avatarColor(c.nome);
    const row = document.createElement('div');
    row.className = 'pev-team-row';
    row.innerHTML = `
      <div class="pev-avatar" style="background:${bg};color:${fg}">${PEV_initials(c.nome)}</div>
      <div class="pev-colab-info">
        <div class="pev-colab-name">${c.nome}</div>
        <div class="pev-colab-sub">${c.horario} · ${c.regiao} · Almoço: ${c.almoco}</div>
      </div>
      <div class="pev-team-actions">
        <button class="pev-btn-icon" data-edit="${i}" title="Editar" type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="pev-btn-icon delete" data-del="${i}" title="Remover" type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    `;
    row.querySelector('[data-edit]').onclick = () => PEV_openEditColab(i);
    row.querySelector('[data-del]').onclick = () => {
      if (confirm(`Remover "${c.nome}" da equipe PEV?`)) {
        const colab = PEV_colabs[i];
        PEV_deleteColabSupabase(colab);
        PEV_colabs.splice(i, 1);
        PEV_saveColabs();
        PEV_renderEquipe();
        PEV_renderEscalaList();
        PEV_renderAlmocoList();
        // Atualiza mapa de distribuição geográfica
        if (typeof window.MapaBrasil_refresh === 'function') {
          setTimeout(window.MapaBrasil_refresh, 100);
        }
      }
    };
    list.appendChild(row);
  });
}

function PEV_openEditColab(idx) {
  PEV_editingColabIdx = idx;
  const c = PEV_colabs[idx];
  document.getElementById('pev-colab-modal-title').textContent = 'Editar Colaborador';
  document.getElementById('pev-colab-nome').value = c.nome;
  document.getElementById('pev-colab-horario').value = c.horario;
  document.getElementById('pev-colab-almoco').value = c.almoco;
  document.getElementById('pev-colab-regiao').value = c.regiao;
  PEV_openModal('pev-modal-colab');
}
function PEV_openAddColab() {
  PEV_editingColabIdx = null;
  document.getElementById('pev-colab-modal-title').textContent = 'Adicionar Colaborador';
  ['pev-colab-nome','pev-colab-horario','pev-colab-regiao'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pev-colab-almoco').value = '12:00';
  PEV_openModal('pev-modal-colab');
}
function PEV_saveColab() {
  const nome    = document.getElementById('pev-colab-nome').value.trim();
  const horario = document.getElementById('pev-colab-horario').value.trim();
  const almoco  = document.getElementById('pev-colab-almoco').value;
  const regiao  = document.getElementById('pev-colab-regiao').value.trim();
  if (!nome || !horario) { alert('Preencha nome e horário.'); return; }

  if (PEV_editingColabIdx !== null) {
    // Edição: preserva o id existente para o upsert funcionar
    const idExistente = PEV_colabs[PEV_editingColabIdx].id;
    const obj = { id: idExistente, nome, horario, almoco, regiao };
    PEV_colabs[PEV_editingColabIdx] = obj;
    PEV_saveColabSupabase(obj);
  } else {
    // Novo: gera id local (Supabase vai confirmar/substituir pelo upsert)
    const obj = {
      id: 'pev_colab_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nome, horario, almoco, regiao,
    };
    PEV_colabs.push(obj);
    PEV_escalaState[nome] = {status:'none', ext:'dia', obs:''};
    PEV_almocoState[nome] = {horario: almoco, done:false};
    PEV_saveColabSupabase(obj);
  }

  PEV_saveColabs();
  PEV_closeModal('pev-modal-colab');
  PEV_renderEquipe();
  PEV_renderEscalaList();
  PEV_renderAlmocoList();
  // Atualiza mapa de distribuição geográfica
  if (typeof window.MapaBrasil_refresh === 'function') {
    setTimeout(window.MapaBrasil_refresh, 100);
  }
}

/* ── Discord / Hermes ────────────────────────────────────── */
async function PEV_sendHermes(tipo, payload) {
  if (typeof sendHermes === 'function') {
    return sendHermes(tipo, payload);
  }

  const response = await fetch('/api/hermes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, ...payload }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.details || `HTTP ${response.status}`);
  }
  return data;
}

function PEV_getDestinatariosHermes() {
  // Usa a mesma base de colaboradores já utilizada pelos botões funcionais do PIT STOP.
  // Importante: o Hermes só consegue disparar privado quando recebe discord_id.
  if (Array.isArray(window.colaboradores) && window.colaboradores.length) {
    return window.colaboradores.filter(c => c && c.ativo !== false && c.discord_id);
  }

  if (Array.isArray(colaboradores) && colaboradores.length) {
    return colaboradores.filter(c => c && c.ativo !== false && c.discord_id);
  }

  if (typeof getDestinatariosAviso === 'function') {
    return getDestinatariosAviso().filter(c => c && c.discord_id);
  }

  return [];
}

async function PEV_sendDiscord(tipo) {
  const out = tipo === 'escala' ? document.getElementById('pev-escala-output') : document.getElementById('pev-almoco-output');
  const content = out?.textContent?.trim();

  if (!content || content.startsWith('Configure') || content.startsWith('Marque')) {
    alert('Gere a mensagem antes de enviar.');
    return;
  }

  const btn = tipo === 'escala'
    ? document.getElementById('pev-btn-send-escala')
    : document.getElementById('pev-btn-send-almoco');

  const originalText = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Enviando...';
  }

  try {
    // Tipos dedicados: pev-escala / pev-almoco
    // O Hermes envia diretamente para o canal configurado (CHANNEL_PEV_ESCALA / CHANNEL_PEV_ALMOCO).
    // Não requer destinatários com discord_id — basta o bot ter acesso ao canal.
    const hermesTopo = tipo === 'escala' ? 'pev-escala' : 'pev-almoco';

    await PEV_sendHermes(hermesTopo, {
      mensagem: content,
      content,
      data: PEV_currentDate,
      setor: 'PEV',
      origem: 'gestao-pev',
    });

    if (typeof toast === 'function') toast(`✅ Escala PEV enviada para o Discord com sucesso!`);
    else alert(`Escala PEV enviada para o Discord com sucesso!`);
  } catch(e) {
    alert('Erro ao enviar pelo Hermes: ' + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

function PEV_openDiscordConfig() {
  const res = document.getElementById('pev-discord-test-result');
  if (res) {
    res.style.display = 'block';
    res.style.background = 'rgba(88,101,242,.08)';
    res.textContent = 'Os envios do PEV agora usam o Hermes via /api/hermes. Não é necessário configurar webhook nesta tela.';
  }
  PEV_openModal('pev-modal-discord');
}
function PEV_saveDiscordConfig() {
  PEV_closeModal('pev-modal-discord');
  if (typeof toast === 'function') toast('✅ PEV configurado para envio via Hermes.');
}
async function PEV_testDiscord() {
  const res = document.getElementById('pev-discord-test-result');
  if (res) {
    res.style.display = 'block';
    res.style.background = 'rgba(240,180,41,.08)';
    res.textContent = 'Testando conexão com Hermes...';
  }
  try {
    await PEV_sendHermes('health-check', {});
    if (res) {
      res.style.background = 'rgba(61,214,140,.08)';
      res.textContent = '✅ Hermes conectado!';
    }
  } catch(e) {
    if (res) {
      res.style.background = 'rgba(248,113,113,.08)';
      res.textContent = '❌ Erro: ' + e.message;
    } else {
      alert('Erro: ' + e.message);
    }
  }
}

/* ── Modal utils ─────────────────────────────────────────── */
function PEV_openModal(id) { const el = document.getElementById(id); if (el) el.classList.add('open'); }
function PEV_closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }

/* ── Init ────────────────────────────────────────────────── */
(function PEV_init() {
  document.querySelectorAll('.pev-tab').forEach(btn => {
    btn.onclick = () => PEV_goTab(btn.dataset.pevTab);
  });

  const dateInput = document.getElementById('pev-date-input');
  if (dateInput) {
    dateInput.value = PEV_currentDate;
    dateInput.onchange = (e) => {
      PEV_currentDate = e.target.value;
      PEV_escalaState = JSON.parse(localStorage.getItem('pev_escala_'+PEV_currentDate) || '{}');
      PEV_almocoState = JSON.parse(localStorage.getItem('pev_almoco_'+PEV_currentDate) || '{}');
      PEV_initState();
      PEV_updateDateDisplays();
      PEV_renderEscalaList();
      PEV_renderAlmocoList();
      PEV_renderEscalaOutput();
    };
  }

  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  bind('pev-btn-copy-escala', () => {
    const t = document.getElementById('pev-escala-output')?.textContent;
    if (t && !t.startsWith('Configure')) navigator.clipboard.writeText(t).then(() => { if (typeof toast === 'function') toast('📋 Copiado!'); });
  });
  bind('pev-btn-send-escala', () => PEV_sendDiscord('escala'));
  bind('pev-btn-clear-escala', () => {
    if (!confirm('Limpar escala PEV do dia?')) return;
    PEV_colabs.forEach(c => { PEV_escalaState[c.nome] = {status:'none',ext:'dia',obs:''}; });
    localStorage.removeItem('pev_escala_'+PEV_currentDate);
    PEV_renderEscalaList(); PEV_renderEscalaOutput();
  });
  bind('pev-btn-copy-almoco', () => {
    const t = document.getElementById('pev-almoco-output')?.textContent;
    if (t && !t.startsWith('Marque')) navigator.clipboard.writeText(t).then(() => { if (typeof toast === 'function') toast('📋 Copiado!'); });
  });
  bind('pev-btn-send-almoco', () => PEV_sendDiscord('almoco'));
  bind('pev-btn-update-almoco', () => { PEV_renderAlmocoList(); PEV_renderAlmocoOutput(); });
  bind('pev-btn-clear-almoco', () => {
    if (!confirm('Limpar almoço PEV do dia?')) return;
    PEV_colabs.forEach(c => { PEV_almocoState[c.nome] = {horario:c.almoco, done:false}; });
    localStorage.removeItem('pev_almoco_'+PEV_currentDate);
    PEV_renderAlmocoList();
  });
  bind('pev-btn-add-colab', PEV_openAddColab);
  bind('pev-btn-save-colab', PEV_saveColab);
  bind('pev-discord-config-btn', PEV_openDiscordConfig);
  bind('pev-btn-save-discord', PEV_saveDiscordConfig);
  bind('pev-btn-test-discord', PEV_testDiscord);

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.close;
      if (id && id.startsWith('pev-')) PEV_closeModal(id);
    });
  });
  document.querySelectorAll('#pev-modal-colab, #pev-modal-discord, #pev-modal-importacao').forEach(overlay => {
    overlay.onclick = (e) => { if (e.target === overlay) PEV_closeModal(overlay.id); };
  });

  PEV_escalaState = JSON.parse(localStorage.getItem('pev_escala_'+PEV_currentDate) || '{}');
  PEV_almocoState = JSON.parse(localStorage.getItem('pev_almoco_'+PEV_currentDate) || '{}');
  PEV_initState();
  PEV_updateDateDisplays();
  PEV_renderEscalaList();
  PEV_renderAlmocoList();
  PEV_renderEquipe();
  PEV_renderEscalaOutput();
})();

// ═══════════════════════════════════════════════════════════════
// ✅ CORREÇÃO: Evento de data ready
// ═══════════════════════════════════════════════════════════════

(function notifyPevReady() {
  // Aguarda carregamento completo dos dados PEV
  function checkAndNotify() {
    const pevColabs = JSON.parse(localStorage.getItem('pev_colaboradores') || '[]');
    
    if (pevColabs.length > 0) {
      // Notifica sistema que PEV está pronto
      if (window.SystemData) {
        window.SystemData.markReady('pev');
      }
      
      // Evento customizado para outros componentes
      window.dispatchEvent(new CustomEvent('pev-data-ready', {
        detail: { 
          colaboradores: pevColabs,
          timestamp: Date.now()
        }
      }));
      
      console.log('✅ PEV: Dados prontos,', pevColabs.length, 'colaboradores');
    } else {
      console.warn('⚠️ PEV: Nenhum colaborador encontrado');
    }
  }
  
  // Espera DOM carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkAndNotify, 100);
    });
  } else {
    setTimeout(checkAndNotify, 100);
  }
})();
