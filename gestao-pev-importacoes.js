/**
 * Gestão PEV — Módulo de Importações Discord
 * Tela limpa e profissional: mostra apenas o que o gestor precisa ver.
 */
"use strict";

let PEV_importacoes = [];
const PEV_IMPORT_STORAGE_KEY = 'pev_importacoes_v1';

/* ── Persistência ────────────────────────────────────────── */
function PEV_loadImportacoes() {
  if (typeof supa !== 'undefined' && supa) {
    PEV_loadImportacoesSupabase();
  } else {
    PEV_importacoes = JSON.parse(localStorage.getItem(PEV_IMPORT_STORAGE_KEY) || '[]');
    PEV_renderImportacoes();
    PEV_updateImportCount();
  }
}

async function PEV_loadImportacoesSupabase() {
  try {
    const { data, error } = await supa
      .from('pev_importacoes').select('*').order('criado_em', { ascending: false });
    if (error) throw error;
    PEV_importacoes = data || [];
    localStorage.setItem(PEV_IMPORT_STORAGE_KEY, JSON.stringify(PEV_importacoes));
  } catch(e) {
    PEV_importacoes = JSON.parse(localStorage.getItem(PEV_IMPORT_STORAGE_KEY) || '[]');
  }
  PEV_renderImportacoes();
  PEV_updateImportCount();
}

async function PEV_saveImportacao(item) {
  if (typeof supa !== 'undefined' && supa) {
    try {
      const { data, error } = await supa.from('pev_importacoes')
        .upsert(item, { onConflict: 'id' }).select().single();
      if (error) throw error;
      return data;
    } catch(e) { /* fallback */ }
  }
  const idx = PEV_importacoes.findIndex(x => x.id === item.id);
  if (idx >= 0) PEV_importacoes[idx] = item;
  else PEV_importacoes.unshift(item);
  localStorage.setItem(PEV_IMPORT_STORAGE_KEY, JSON.stringify(PEV_importacoes));
  return item;
}

async function PEV_deleteImportacao(id) {
  if (typeof supa !== 'undefined' && supa) {
    try {
      const { error } = await supa.from('pev_importacoes').delete().eq('id', id);
      if (error) throw error;
    } catch(e) { /* fallback */ }
  }
  PEV_importacoes = PEV_importacoes.filter(x => x.id !== id);
  localStorage.setItem(PEV_IMPORT_STORAGE_KEY, JSON.stringify(PEV_importacoes));
}

/* ── Render ──────────────────────────────────────────────── */
function PEV_renderImportacoes() {
  const list  = document.getElementById('pev-import-list');
  const empty = document.getElementById('pev-import-empty');
  if (!list) return;

  const search = (document.getElementById('pev-import-search')?.value || '').toLowerCase();
  const filter = document.getElementById('pev-import-filter')?.value || '';

  const items = PEV_importacoes.filter(item => {
    const matchSearch = !search || item.empresa?.toLowerCase().includes(search) || item.cnpj?.toLowerCase().includes(search);
    const matchFilter = !filter || item.importacao === filter;
    return matchSearch && matchFilter;
  });

  // Update stats
  PEV_renderImportStats();

  // Remove old cards
  Array.from(list.children).forEach(ch => {
    if (!ch.id) ch.remove();
  });

  if (!items.length) {
    if (empty) {
      empty.style.display = 'flex';
      empty.innerHTML = search || filter
        ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="opacity:.35"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><p>Nenhum resultado encontrado.</p>`
        : `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="opacity:.3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><p>Nenhum registro ainda.<br><small>Os dados chegam quando um colaborador usa <strong>/importação de dados</strong> no Discord.</small></p>`;
    }
    return;
  }

  if (empty) empty.style.display = 'none';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'pev-import-card';
    card.dataset.id = item.id;
    card.dataset.import = item.importacao;

    const dataStr = item.criado_em
      ? new Date(item.criado_em).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : '—';

    const dataViradaStr = item.data_virada
      ? new Date(item.data_virada + 'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })
      : null;

    const discordTag = item.discord_user
      ? `<span class="pev-import-discord-tag">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.082.114 18.1.133 18.112a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
          ${PEV_escHtml(item.discord_user)}
        </span>` : '';

    card.innerHTML = `
      <div class="pev-import-card-body">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
          <span class="pev-import-badge ${item.importacao === 'sim' ? 'sim' : 'nao'}">
            ${item.importacao === 'sim' ? '📥 Com importação' : '📭 Sem importação'}
          </span>
          ${discordTag}
        </div>
        <div class="pev-import-empresa">${PEV_escHtml(item.empresa || '—')}</div>
        <div class="pev-import-cnpj">${PEV_escHtml(item.cnpj || '—')}</div>
        ${dataViradaStr ? `<div class="pev-import-virada">📅 Virada do sistema: <strong>${dataViradaStr}</strong></div>` : ''}
        ${item.obs ? `<div class="pev-import-obs">📝 ${PEV_escHtml(item.obs)}</div>` : ''}
        <div class="pev-import-meta">
          <span>${dataStr}</span>
        </div>
      </div>
      <div class="pev-import-actions">
        <button class="pev-btn-icon" data-edit-import="${item.id}" title="Editar" type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="pev-btn-icon delete" data-del-import="${item.id}" title="Excluir" type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    `;

    card.querySelector('[data-edit-import]').onclick = () => PEV_openEditImportacao(item.id);
    card.querySelector('[data-del-import]').onclick = async () => {
      if (!confirm(`Excluir registro de "${item.empresa}"?`)) return;
      await PEV_deleteImportacao(item.id);
      PEV_renderImportacoes();
      PEV_updateImportCount();
      if (typeof toast === 'function') toast('🗑 Registro excluído.');
    };
    list.appendChild(card);
  });
}

function PEV_renderImportStats() {
  const el = document.getElementById('pev-import-stats');
  if (!el) return;
  const total = PEV_importacoes.length;
  const sim   = PEV_importacoes.filter(i => i.importacao === 'sim').length;
  const nao   = PEV_importacoes.filter(i => i.importacao === 'nao').length;
  el.innerHTML = `
    <div class="pev-import-stat">
      <span class="pev-import-stat-num">${total}</span>
      <span class="pev-import-stat-lbl">Total</span>
    </div>
    <div class="pev-import-stat sim">
      <span class="pev-import-stat-num">${sim}</span>
      <span class="pev-import-stat-lbl">Com importação</span>
    </div>
    <div class="pev-import-stat nao">
      <span class="pev-import-stat-num">${nao}</span>
      <span class="pev-import-stat-lbl">Sem importação</span>
    </div>
  `;
}

function PEV_updateImportCount() {
  const badge = document.getElementById('pev-import-count');
  if (!badge) return;
  const n = PEV_importacoes.length;
  badge.textContent = n;
  badge.style.display = n > 0 ? 'inline-flex' : 'none';
}

/* ── Modal ───────────────────────────────────────────────── */
function PEV_openNewImportacao() {
  document.getElementById('pev-import-modal-title').textContent = 'Nova Importação';
  document.getElementById('pev-import-editing-id').value = '';
  document.getElementById('pev-import-empresa').value = '';
  document.getElementById('pev-import-cnpj').value = '';
  document.getElementById('pev-import-radio-nao').checked = true;
  document.getElementById('pev-import-data-virada').value = '';
  document.getElementById('pev-import-obs').value = '';
  PEV_openModal('pev-modal-importacao');
}

function PEV_openEditImportacao(id) {
  const item = PEV_importacoes.find(x => x.id === id);
  if (!item) return;
  document.getElementById('pev-import-modal-title').textContent = 'Editar Importação';
  document.getElementById('pev-import-editing-id').value = id;
  document.getElementById('pev-import-empresa').value = item.empresa || '';
  document.getElementById('pev-import-cnpj').value = item.cnpj || '';
  document.getElementById(item.importacao === 'sim' ? 'pev-import-radio-sim' : 'pev-import-radio-nao').checked = true;
  document.getElementById('pev-import-obs').value = item.obs || '';
  document.getElementById('pev-import-data-virada').value = item.data_virada || '';
  PEV_openModal('pev-modal-importacao');
}

async function PEV_saveImportacaoModal() {
  const empresa     = document.getElementById('pev-import-empresa').value.trim();
  const cnpj        = document.getElementById('pev-import-cnpj').value.trim();
  const importacao  = document.querySelector('input[name="pev-import-radio"]:checked')?.value || 'nao';
  const data_virada = document.getElementById('pev-import-data-virada').value;
  const obs         = document.getElementById('pev-import-obs').value.trim();
  if (!empresa || !cnpj) { alert('Preencha nome da empresa e CNPJ.'); return; }
  if (!data_virada) { alert('Informe a data da virada do sistema.'); return; }

  const editingId = document.getElementById('pev-import-editing-id').value;
  const item = {
    id: editingId || PEV_genId(),
    empresa, cnpj: PEV_formatCNPJ(cnpj), importacao, data_virada, obs,
    discord_user: editingId ? (PEV_importacoes.find(x=>x.id===editingId)?.discord_user || '') : '',
    criado_em: editingId ? (PEV_importacoes.find(x=>x.id===editingId)?.criado_em || new Date().toISOString()) : new Date().toISOString(),
  };

  const saved = await PEV_saveImportacao(item);
  if (!editingId) PEV_importacoes.unshift(saved || item);
  else {
    const idx = PEV_importacoes.findIndex(x => x.id === item.id);
    if (idx >= 0) PEV_importacoes[idx] = saved || item;
  }
  PEV_closeModal('pev-modal-importacao');
  PEV_renderImportacoes();
  PEV_updateImportCount();
  if (typeof toast === 'function') toast('✅ Registro salvo.');
}

/* ── Receber do Discord Bot ──────────────────────────────── */
async function PEV_receberDoDiscord(payload) {
  const item = {
    id: PEV_genId(),
    empresa: payload.empresa || '',
    cnpj: PEV_formatCNPJ(payload.cnpj || ''),
    importacao: payload.importacao === 'sim' ? 'sim' : 'nao',
    data_virada: payload.data_virada || '',
    obs: payload.obs || '',
    discord_user: payload.discord_user || '',
    criado_em: new Date().toISOString(),
  };
  await PEV_saveImportacao(item);
  PEV_importacoes.unshift(item);
  PEV_renderImportacoes();
  PEV_updateImportCount();
  if (typeof toast === 'function') toast(`📥 Nova importação: ${item.empresa}`);
  return item;
}
window.PEV_receberDoDiscord = PEV_receberDoDiscord;

/* ── Helpers ─────────────────────────────────────────────── */
function PEV_genId() {
  return 'pev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function PEV_formatCNPJ(v) {
  const n = v.replace(/\D/g,'');
  if (n.length !== 14) return v;
  return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}
function PEV_escHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function PEV_maskCNPJ(input) {
  let v = input.value.replace(/\D/g,'').slice(0,14);
  if (v.length > 12) v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5');
  else if (v.length > 8) v = v.replace(/(\d{2})(\d{3})(\d{3})(\d+)/,'$1.$2.$3/$4');
  else if (v.length > 5) v = v.replace(/(\d{2})(\d{3})(\d+)/,'$1.$2.$3');
  else if (v.length > 2) v = v.replace(/(\d{2})(\d+)/,'$1.$2');
  input.value = v;
}

/* ── Init ────────────────────────────────────────────────── */
(function PEV_importInit() {
  const search = document.getElementById('pev-import-search');
  const filter = document.getElementById('pev-import-filter');
  if (search) search.oninput = () => PEV_renderImportacoes();
  if (filter) filter.onchange = () => PEV_renderImportacoes();

  const saveBtn = document.getElementById('pev-btn-save-importacao');
  if (saveBtn) saveBtn.onclick = PEV_saveImportacaoModal;

  const addBtn = document.getElementById('pev-btn-add-import');
  if (addBtn) addBtn.onclick = PEV_openNewImportacao;

  const cnpjInput = document.getElementById('pev-import-cnpj');
  if (cnpjInput) cnpjInput.oninput = () => PEV_maskCNPJ(cnpjInput);

  const modalImp = document.getElementById('pev-modal-importacao');
  if (modalImp) modalImp.onclick = (e) => { if (e.target === modalImp) PEV_closeModal('pev-modal-importacao'); };

  PEV_loadImportacoes();
})();
