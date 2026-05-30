/**
 * gestao-pev-ferias.js
 * Sub-aba "Férias & Folgas" dentro da seção PEV
 * — Lê da mesma tabela "folgas" do Supabase (usada pelo sistema principal)
 * — Reutiliza o modal-folga e newFolga() já existentes para cadastro
 * — Adiciona edição e exclusão (inexistentes no sistema principal)
 * — Sincronizado: qualquer gestor que abrir vê os mesmos dados
 */

/* ─── Helpers ────────────────────────────────────────────── */
function PEVFF_escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function PEVFF_toast(msg) {
  if (typeof toast === 'function') { toast(msg); return; }
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:#f1f5f9;padding:10px 18px;border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4)';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function PEVFF_todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function PEVFF_fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function PEVFF_diffDays(ini, fim) {
  if (!ini || !fim) return 0;
  return Math.max(1, Math.round((new Date(fim) - new Date(ini)) / 86400000) + 1);
}

function PEVFF_isFutureOrToday(f) {
  const info = (typeof getFolgaInfo === 'function') ? getFolgaInfo(f) : null;
  if (!info) return false;
  const ref = info.tipo === 'ferias' ? (info.dataFim || info.dataInicio) : info.dataInicio;
  return ref >= PEVFF_todayISO();
}

function PEVFF_initials(nome) {
  const p = nome.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : nome.slice(0, 2).toUpperCase();
}

function PEVFF_avatarHue(nome) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) & 0xffff;
  return h % 360;
}

/* ─── Excluir ─────────────────────────────────────────────── */
async function PEVFF_delete(id) {
  if (!confirm('Excluir este registro? Esta ação não pode ser desfeita.')) return;

  try {
    // Remove do array global
    const idx = folgas.findIndex(f => f.id === id);
    if (idx >= 0) folgas.splice(idx, 1);

    // Persiste local
    if (typeof saveLocal === 'function') saveLocal();

    // Remove do Supabase
    if (typeof supa !== 'undefined' && supa) {
      const { error } = await supa.from('folgas').delete().eq('id', id);
      if (error) console.warn('[PEVFF] Supabase delete erro:', error.message);
    }

    // Re-renderiza tudo (métricas, listas, calendários)
    if (typeof renderAll === 'function') renderAll();
    PEVFF_render();
    PEVFF_toast('Registro excluído.');
  } catch (err) {
    console.error('[PEVFF] Erro ao excluir:', err);
    PEVFF_toast('Erro ao excluir: ' + err.message);
  }
}

/* ─── Editar — preenche o modal existente ─────────────────── */
function PEVFF_edit(id) {
  const f = folgas.find(r => r.id === id);
  if (!f) return;

  const info = (typeof getFolgaInfo === 'function') ? getFolgaInfo(f) : null;
  if (!info) return;

  const tipo = info.tipo; // 'folga' | 'ferias'

  // Preenche campos do modal existente
  const elTipo   = document.getElementById('folga-tipo');
  const elMotivo = document.getElementById('folga-motivo');
  const elDataFim= document.getElementById('folga-data-fim');
  const elColabHidden = document.getElementById('folga-colaborador');
  const elColabTrigger = document.getElementById('folga-colaborador-trigger');

  if (elTipo)    elTipo.value = tipo;
  if (elMotivo)  elMotivo.value = f.motivo ?? '';
  if (elDataFim) elDataFim.value = info.dataFim ?? '';

  // Colaborador (select hidden + trigger visual)
  const nome = f.colaborador_nome ?? f.colaborador ?? '';
  if (elColabHidden)  elColabHidden.value = nome;
  if (elColabTrigger) elColabTrigger.textContent = nome;

  // Atualiza campos condicionais (label data, campo data_fim)
  if (typeof toggleFolgaTipoFields === 'function') toggleFolgaTipoFields();

  // Título do modal
  const titleEl = document.getElementById('modal-folga-title');
  if (titleEl) titleEl.textContent = tipo === 'ferias' ? 'Editar férias' : 'Editar folga';
  const labelBtn = document.getElementById('btn-save-folga-label');
  if (labelBtn) labelBtn.textContent = tipo === 'ferias' ? 'Salvar férias' : 'Salvar folga';

  // Guardar ID sendo editado para o saveFolga interceptar
  PEVFF_editingId = id;

  // Preencher data de início via datepicker ou input direto
  // O sistema usa um datepicker customizado; tenta setar o hidden input direto
  const elDataHidden = document.getElementById('folga-data');
  if (elDataHidden) elDataHidden.value = info.dataInicio ?? '';

  // Tentar também atualizar display do datepicker, se existir
  const dpDisplay = document.querySelector('#folga-data-picker .dp-selected-label, .dp-trigger-label');
  if (dpDisplay && info.dataInicio) {
    dpDisplay.textContent = PEVFF_fmtDate(info.dataInicio);
  }

  // Abrir o modal
  if (typeof openModal === 'function') openModal('modal-folga');
}

/* ─── Interceptar saveFolga para suportar edição ─────────── */
let PEVFF_editingId = null;
let PEVFF_originalSaveFolga = null;

function PEVFF_patchSaveFolga() {
  if (typeof window.saveFolga !== 'function') return;
  PEVFF_originalSaveFolga = window.saveFolga;

  window.saveFolga = async function() {
    // Se não estamos editando, comportamento padrão
    if (!PEVFF_editingId) {
      await PEVFF_originalSaveFolga.apply(this, arguments);
      PEVFF_render();
      return;
    }

    // Modo edição: atualizar registro existente
    const id = PEVFF_editingId;
    PEVFF_editingId = null;

    const tipo    = document.getElementById('folga-tipo')?.value ?? 'folga';
    const dataFim = tipo === 'ferias' ? (document.getElementById('folga-data-fim')?.value ?? '') : '';
    const nome    = document.getElementById('folga-colaborador')?.value ?? '';
    const dataIni = document.getElementById('folga-data')?.value ?? '';
    const motivo  = document.getElementById('folga-motivo')?.value.trim() ?? '';

    if (!nome || !dataIni) { PEVFF_toast('Informe colaborador e data.'); return; }
    if (tipo === 'ferias' && !dataFim) { PEVFF_toast('Informe a data final.'); return; }
    if (dataFim && dataFim < dataIni)  { PEVFF_toast('Data final não pode ser antes do início.'); return; }

    const status = (typeof serializeFolgaStatus === 'function')
      ? serializeFolgaStatus(tipo, dataFim)
      : (tipo === 'ferias' ? `ferias:${dataFim}` : 'folga');

    const payload = {
      colaborador_nome: nome,
      data_folga: dataIni,
      motivo,
      status,
      tipo,
      data_fim: dataFim || null,
    };

    // Atualiza array local
    const idx = folgas.findIndex(f => f.id === id);
    if (idx >= 0) folgas[idx] = { ...folgas[idx], ...payload };

    if (typeof saveLocal === 'function') saveLocal();

    // Atualiza no Supabase
    try {
      if (typeof supa !== 'undefined' && supa) {
        const { error } = await supa.from('folgas').update({
          colaborador_nome: nome,
          data_folga: dataIni,
          motivo,
          status,
        }).eq('id', id);
        if (error) console.warn('[PEVFF] Supabase update erro:', error.message);
      }
    } catch (err) {
      console.warn('[PEVFF] Supabase update falhou (salvo local):', err.message);
    }

    if (typeof closeModal === 'function') closeModal('modal-folga');
    if (typeof renderAll === 'function') renderAll();
    PEVFF_render();

    // Resetar título do modal
    const titleEl = document.getElementById('modal-folga-title');
    if (titleEl) titleEl.textContent = 'Cadastrar folga';
    const labelBtn = document.getElementById('btn-save-folga-label');
    if (labelBtn) labelBtn.textContent = 'Salvar folga';

    PEVFF_toast('Registro atualizado.');
  };
}

/* ─── Render ──────────────────────────────────────────────── */
function PEVFF_render() {
  const container = document.getElementById('pev-ff-list');
  if (!container) return;

  // Usa o array global `folgas` (já carregado pelo sistema principal via Supabase)
  const todos = typeof folgas !== 'undefined' ? folgas : [];

  const ativos    = todos.filter(PEVFF_isFutureOrToday)
    .sort((a, b) => {
      const ia = typeof getFolgaInfo === 'function' ? getFolgaInfo(a) : {};
      const ib = typeof getFolgaInfo === 'function' ? getFolgaInfo(b) : {};
      return (ia.dataInicio ?? '').localeCompare(ib.dataInicio ?? '');
    });

  const arquivados = todos.filter(f => !PEVFF_isFutureOrToday(f))
    .sort((a, b) => {
      const ga = typeof getFolgaArchiveDate === 'function' ? getFolgaArchiveDate(a) : '';
      const gb = typeof getFolgaArchiveDate === 'function' ? getFolgaArchiveDate(b) : '';
      return gb.localeCompare(ga);
    });

  const folgasAtivas = ativos.filter(f => {
    const info = typeof getFolgaInfo === 'function' ? getFolgaInfo(f) : {};
    return info.tipo !== 'ferias';
  });
  const feriasAtivas = ativos.filter(f => {
    const info = typeof getFolgaInfo === 'function' ? getFolgaInfo(f) : {};
    return info.tipo === 'ferias';
  });

  // Atualizar badges
  const bF = document.getElementById('pev-ff-badge-folgas');
  const bFe = document.getElementById('pev-ff-badge-ferias');
  if (bF)  bF.textContent  = folgasAtivas.length;
  if (bFe) bFe.textContent = feriasAtivas.length;

  let html = '';

  // ── Folgas ──
  html += PEVFF_buildSection('📅 Folgas ativas / futuras', 'Folgas de hoje ou próximas', folgasAtivas, 'Nenhuma folga futura cadastrada.');

  // ── Férias ──
  html += `<div style="margin-top:1rem">`;
  html += PEVFF_buildSection('🏖️ Férias ativas / futuras', 'Períodos de hoje em diante', feriasAtivas, 'Nenhuma férias futura cadastrada.');
  html += `</div>`;

  // ── Arquivo ──
  if (arquivados.length) {
    html += `
      <details class="pev-ff-archive" style="margin-top:1rem">
        <summary>
          <span>📁 Arquivo</span>
          <strong>${arquivados.length} ${arquivados.length === 1 ? 'registro' : 'registros'}</strong>
        </summary>
        <div class="pev-ff-section-body" style="margin-top:.5rem">
          ${arquivados.map(f => PEVFF_buildCard(f, true)).join('')}
        </div>
      </details>`;
  }

  container.innerHTML = html;
}

function PEVFF_buildSection(titulo, subtitulo, items, emptyText) {
  const cards = items.length
    ? items.map(f => PEVFF_buildCard(f, false)).join('')
    : `<div class="pev-ff-empty">${emptyText}</div>`;

  return `
    <div class="pev-ff-section">
      <div class="pev-ff-section-head">
        <div>
          <strong>${titulo}</strong>
          <small>${subtitulo}</small>
        </div>
        <span class="pausa-turno-count">${items.length}</span>
      </div>
      <div class="pev-ff-section-body">${cards}</div>
    </div>`;
}

function PEVFF_buildCard(f, arquivado) {
  const info = (typeof getFolgaInfo === 'function') ? getFolgaInfo(f) : {};
  const nome = f.colaborador_nome ?? f.colaborador ?? '?';
  const isFerias = info.tipo === 'ferias';
  const hoje = PEVFF_todayISO();

  const ini = PEVFF_fmtDate(info.dataInicio);
  const fim = info.dataFim ? PEVFF_fmtDate(info.dataFim) : null;
  const dias = isFerias && info.dataFim ? PEVFF_diffDays(info.dataInicio, info.dataFim) : null;
  const periodo = (isFerias && fim)
    ? `${ini} → ${fim}${dias ? ` <em style="color:var(--muted)">(${dias}d)</em>` : ''}`
    : ini;

  let statusLabel = 'Futuro', statusCls = 'gestao';
  if (arquivado) { statusLabel = 'Arquivado'; statusCls = 'arquivada'; }
  else if (info.dataInicio === hoje || (isFerias && info.dataInicio <= hoje && (info.dataFim ?? hoje) >= hoje)) {
    statusLabel = 'Hoje'; statusCls = 'hoje';
  }

  const hue = PEVFF_avatarHue(nome);
  const initials = PEVFF_initials(nome);
  const id = f.id;

  return `
    <div class="pev-ff-card${arquivado ? ' pev-ff-card-archived' : ''}">
      <div class="team-info" style="flex:1;min-width:0">
        <div class="avatar" style="background:hsl(${hue},50%,36%);font-size:12px;flex-shrink:0">${initials}</div>
        <div style="min-width:0">
          <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${PEVFF_escapeHtml(nome)}</strong>
          <div class="folga-meta">
            <small>${periodo}</small>
            ${f.motivo ? `<small>· ${PEVFF_escapeHtml(f.motivo)}</small>` : ''}
          </div>
        </div>
      </div>
      <div class="folga-badges" style="flex-shrink:0;align-items:center;gap:6px">
        <span class="cargo-badge ${isFerias ? 'ferias' : 'tecnico'}">${isFerias ? '🏖️ Férias' : '📅 Folga'}</span>
        <span class="cargo-badge ${statusCls}">${statusLabel}</span>
        ${!arquivado && id ? `
          <button class="pev-ff-btn-edit" onclick="PEVFF_edit('${id}')" title="Editar" type="button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>` : ''}
        ${id ? `
          <button class="pev-ff-btn-del" onclick="PEVFF_delete('${id}')" title="Excluir" type="button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>` : ''}
      </div>
    </div>`;
}

/* ─── Injetar HTML na seção PEV ───────────────────────────── */
function PEVFF_injectHTML() {
  // 1. Botão na barra de sub-abas
  const tabImport = document.querySelector('.pev-tab[data-pev-tab="importacoes"]');
  if (tabImport && !document.querySelector('.pev-tab[data-pev-tab="ferias-folgas"]')) {
    const btn = document.createElement('button');
    btn.className = 'pev-tab';
    btn.dataset.pevTab = 'ferias-folgas';
    btn.type = 'button';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
      </svg>
      Férias &amp; Folgas
    `;
    tabImport.parentNode.insertBefore(btn, tabImport);
  }

  // 2. Página da sub-aba
  const importPage = document.getElementById('pev-page-importacoes');
  if (importPage && !document.getElementById('pev-page-ferias-folgas')) {
    const page = document.createElement('div');
    page.className = 'pev-page';
    page.id = 'pev-page-ferias-folgas';
    page.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:1.25rem">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--gold)"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
            Controle de Férias &amp; Folgas — PEV
          </div>
          <div style="font-size:12px;color:var(--muted);margin-top:3px">Sincronizado · visível para todos os gestores</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="pev-ff-btn-refresh" type="button" style="padding:0 14px;height:36px;display:flex;align-items:center;gap:6px;font-size:13px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
            Atualizar
          </button>
          <button class="btn" id="pev-ff-btn-add-folga" type="button" style="padding:0 14px;height:36px;display:flex;align-items:center;gap:6px;font-size:13px">
            + Folga
          </button>
          <button class="btn btn-gold" id="pev-ff-btn-add-ferias" type="button" style="height:36px;display:flex;align-items:center;gap:6px;font-size:13px">
            + Férias
          </button>
        </div>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:1.25rem">
        <div class="metric" style="flex:1;min-width:120px">
          <span>Folgas futuras</span>
          <strong id="pev-ff-badge-folgas">—</strong>
        </div>
        <div class="metric m-ferias" style="flex:1;min-width:120px">
          <span>Férias futuras</span>
          <strong id="pev-ff-badge-ferias">—</strong>
        </div>
      </div>

      <div class="card" style="padding:1rem">
        <div id="pev-ff-list">
          <div class="pev-ff-empty" style="padding:2rem;text-align:center;color:var(--muted);font-size:13px">Carregando…</div>
        </div>
      </div>
    `;
    importPage.parentNode.insertBefore(page, importPage);
  }

  // 3. Estilos
  if (!document.getElementById('pev-ff-styles')) {
    const style = document.createElement('style');
    style.id = 'pev-ff-styles';
    style.textContent = `
      .pev-ff-section { }
      .pev-ff-section-head {
        display:flex; align-items:center; justify-content:space-between;
        padding:0 0 .6rem; border-bottom:1px solid var(--border); margin-bottom:.75rem;
      }
      .pev-ff-section-head strong { font-size:13px; display:block; }
      .pev-ff-section-head small  { font-size:11px; color:var(--muted); }
      .pev-ff-section-body { display:flex; flex-direction:column; gap:.5rem; }
      .pev-ff-card {
        display:flex; align-items:center; justify-content:space-between; gap:10px;
        padding:.65rem .75rem; border:1px solid var(--border); border-radius:10px;
        background:var(--surface2); transition:background .15s;
      }
      .pev-ff-card:hover { background:var(--surface3); }
      .pev-ff-card-archived { opacity:.6; }
      .pev-ff-empty {
        padding:1.5rem; text-align:center; color:var(--muted); font-size:13px;
        border:1px dashed var(--border); border-radius:10px;
      }
      .pev-ff-btn-edit, .pev-ff-btn-del {
        display:flex; align-items:center; justify-content:center;
        width:30px; height:30px; border-radius:8px; border:1px solid var(--border);
        background:var(--surface3); color:var(--muted); cursor:pointer;
        transition:all .15s; flex-shrink:0;
      }
      .pev-ff-btn-edit:hover { border-color:var(--gold); color:var(--gold); background:rgba(250,204,21,.08); }
      .pev-ff-btn-del:hover  { border-color:var(--red);  color:var(--red);  background:rgba(251,113,133,.08); }
      .pev-ff-archive summary {
        display:flex; align-items:center; justify-content:space-between;
        padding:.6rem .25rem; cursor:pointer; font-size:13px; color:var(--muted);
        list-style:none; border-top:1px solid var(--border);
      }
      .pev-ff-archive summary::-webkit-details-marker { display:none; }
      .pev-ff-archive summary strong { font-size:12px; }
    `;
    document.head.appendChild(style);
  }
}

/* ─── Vincular eventos ────────────────────────────────────── */
function PEVFF_bindEvents() {
  // Botão + Folga → abre modal existente no modo folga
  document.getElementById('pev-ff-btn-add-folga')?.addEventListener('click', () => {
    PEVFF_editingId = null;
    if (typeof newFolga === 'function') newFolga('folga');
  });

  // Botão + Férias → abre modal existente no modo férias
  document.getElementById('pev-ff-btn-add-ferias')?.addEventListener('click', () => {
    PEVFF_editingId = null;
    if (typeof newFolga === 'function') newFolga('ferias');
  });

  // Botão Atualizar
  document.getElementById('pev-ff-btn-refresh')?.addEventListener('click', async () => {
    const btn = document.getElementById('pev-ff-btn-refresh');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      if (typeof loadSupabase === 'function') await loadSupabase();
      if (typeof renderAll === 'function') renderAll();
      PEVFF_render();
      PEVFF_toast('Dados atualizados.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg> Atualizar`;
      }
    }
  });

  // Ao fechar o modal-folga, re-renderiza a aba PEV (para refletir novo registro)
  const modalFolga = document.getElementById('modal-folga');
  if (modalFolga) {
    const observer = new MutationObserver(() => {
      if (!modalFolga.classList.contains('open')) {
        // Modal foi fechado — re-render com pequeno delay para dar tempo ao save
        setTimeout(PEVFF_render, 300);
      }
    });
    observer.observe(modalFolga, { attributes: true, attributeFilter: ['class'] });
  }

  // Vincular o botão de tab ao roteador PEV
  const newTabBtn = document.querySelector('.pev-tab[data-pev-tab="ferias-folgas"]');
  if (newTabBtn) {
    newTabBtn.onclick = () => {
      if (typeof PEV_goTab === 'function') {
        PEV_goTab('ferias-folgas');
      } else {
        document.querySelectorAll('.pev-tab').forEach(t => t.classList.remove('active'));
        newTabBtn.classList.add('active');
        document.querySelectorAll('.pev-page').forEach(p => p.classList.remove('active'));
        document.getElementById('pev-page-ferias-folgas')?.classList.add('active');
      }
      PEVFF_render();
    };
  }
}

/* ─── Init ────────────────────────────────────────────────── */
function PEVFF_init() {
  PEVFF_injectHTML();
  PEVFF_bindEvents();
  PEVFF_patchSaveFolga();

  // Renderiza se o sistema já carregou os dados
  if (typeof folgas !== 'undefined') {
    PEVFF_render();
  } else {
    // Aguarda o loadSupabase terminar (pode ser chamado com delay)
    setTimeout(PEVFF_render, 1500);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', PEVFF_init);
} else {
  PEVFF_init();
}
