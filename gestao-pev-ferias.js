/**
 * gestao-pev-ferias.js
 * Sub-aba "Férias & Folgas" dentro da seção PEV
 * — Cadastrar, editar, excluir, alterar datas
 * — Sincronizado via Supabase (tabela: pev_ferias_folgas)
 *   Se a tabela não existir, cai de volta para localStorage
 *
 * SQL para criar a tabela no Supabase:
 *   CREATE TABLE pev_ferias_folgas (
 *     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     colaborador text NOT NULL,
 *     tipo        text NOT NULL CHECK (tipo IN ('folga','ferias')),
 *     data_inicio date NOT NULL,
 *     data_fim    date,
 *     motivo      text,
 *     criado_em   timestamptz DEFAULT now(),
 *     atualizado_em timestamptz DEFAULT now()
 *   );
 */

/* ─── Estado local ─────────────────────────────────────── */
let PEV_FF_records = []; // array de registros em memória
let PEV_FF_editingId = null; // id sendo editado (null = novo)

const PEV_FF_LS_KEY = 'pev_ferias_folgas';
const PEV_FF_TABLE  = 'pev_ferias_folgas';

/* ─── Helpers de data ───────────────────────────────────── */
function PEV_FF_todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function PEV_FF_fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function PEV_FF_diffDays(ini, fim) {
  if (!ini || !fim) return 0;
  const a = new Date(ini), b = new Date(fim);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function PEV_FF_isFutureOrToday(rec) {
  const ref = rec.tipo === 'ferias' ? (rec.data_fim || rec.data_inicio) : rec.data_inicio;
  return ref >= PEV_FF_todayISO();
}

/* ─── Supabase helpers ──────────────────────────────────── */
function PEV_FF_supa() {
  return typeof supa !== 'undefined' ? supa : null;
}

async function PEV_FF_load() {
  const db = PEV_FF_supa();
  if (db) {
    try {
      const { data, error } = await db
        .from(PEV_FF_TABLE)
        .select('*')
        .order('data_inicio', { ascending: true });
      if (error) throw error;
      PEV_FF_records = data ?? [];
      PEV_FF_saveLocal();
      return;
    } catch (e) {
      console.warn('[PEV FF] Supabase load falhou, usando localStorage:', e.message);
    }
  }
  PEV_FF_records = JSON.parse(localStorage.getItem(PEV_FF_LS_KEY) ?? '[]');
}

function PEV_FF_saveLocal() {
  localStorage.setItem(PEV_FF_LS_KEY, JSON.stringify(PEV_FF_records));
}

async function PEV_FF_upsertDB(rec) {
  const db = PEV_FF_supa();
  if (!db) return null;
  const payload = {
    colaborador:  rec.colaborador,
    tipo:         rec.tipo,
    data_inicio:  rec.data_inicio,
    data_fim:     rec.data_fim || null,
    motivo:       rec.motivo || null,
    atualizado_em: new Date().toISOString(),
  };
  if (rec.id) payload.id = rec.id;

  const { data, error } = await db
    .from(PEV_FF_TABLE)
    .upsert(payload, { onConflict: 'id' })
    .select('id')
    .single();
  if (error) throw error;
  return data?.id ?? rec.id;
}

async function PEV_FF_deleteDB(id) {
  const db = PEV_FF_supa();
  if (!db) return;
  const { error } = await db.from(PEV_FF_TABLE).delete().eq('id', id);
  if (error) throw error;
}

/* ─── Modal ─────────────────────────────────────────────── */
function PEV_FF_openModal(id = null) {
  PEV_FF_editingId = id;
  const rec = id ? PEV_FF_records.find(r => r.id === id) : null;

  const modal = document.getElementById('pev-ff-modal');
  const title = document.getElementById('pev-ff-modal-title');
  const btnSave = document.getElementById('pev-ff-btn-save');

  title.textContent = rec ? 'Editar registro' : 'Cadastrar férias / folga';
  btnSave.textContent = rec ? 'Salvar alterações' : 'Cadastrar';

  // Preencher campos
  document.getElementById('pev-ff-tipo').value       = rec?.tipo        ?? 'folga';
  document.getElementById('pev-ff-colab').value      = rec?.colaborador ?? '';
  document.getElementById('pev-ff-data-ini').value   = rec?.data_inicio ?? '';
  document.getElementById('pev-ff-data-fim').value   = rec?.data_fim    ?? '';
  document.getElementById('pev-ff-motivo').value     = rec?.motivo      ?? '';

  PEV_FF_toggleDataFim();
  modal.classList.add('open');
}

function PEV_FF_closeModal() {
  document.getElementById('pev-ff-modal').classList.remove('open');
  PEV_FF_editingId = null;
}

function PEV_FF_toggleDataFim() {
  const tipo = document.getElementById('pev-ff-tipo').value;
  const wrap = document.getElementById('pev-ff-data-fim-wrap');
  if (wrap) wrap.style.display = tipo === 'ferias' ? '' : 'none';
}

/* ─── Salvar ────────────────────────────────────────────── */
async function PEV_FF_save() {
  const tipo     = document.getElementById('pev-ff-tipo').value;
  const colab    = document.getElementById('pev-ff-colab').value.trim();
  const dataIni  = document.getElementById('pev-ff-data-ini').value;
  const dataFim  = tipo === 'ferias' ? document.getElementById('pev-ff-data-fim').value : '';
  const motivo   = document.getElementById('pev-ff-motivo').value.trim();

  if (!colab)   { PEV_FF_toast('Informe o colaborador.'); return; }
  if (!dataIni) { PEV_FF_toast('Informe a data de início.'); return; }
  if (tipo === 'ferias' && !dataFim) { PEV_FF_toast('Informe a data final das férias.'); return; }
  if (dataFim && dataFim < dataIni)  { PEV_FF_toast('Data final não pode ser antes do início.'); return; }

  const btn = document.getElementById('pev-ff-btn-save');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  try {
    let rec = {
      id:          PEV_FF_editingId ?? ('pev_ff_' + Date.now().toString(36)),
      colaborador: colab,
      tipo,
      data_inicio: dataIni,
      data_fim:    dataFim || null,
      motivo:      motivo || null,
    };

    // Tenta upsert no Supabase
    try {
      const newId = await PEV_FF_upsertDB(rec);
      if (newId) rec.id = newId;
    } catch (dbErr) {
      console.warn('[PEV FF] Supabase upsert falhou, salvando local:', dbErr.message);
    }

    if (PEV_FF_editingId) {
      const idx = PEV_FF_records.findIndex(r => r.id === PEV_FF_editingId);
      if (idx >= 0) PEV_FF_records[idx] = rec;
    } else {
      PEV_FF_records.push(rec);
    }

    PEV_FF_saveLocal();
    PEV_FF_closeModal();
    PEV_FF_render();
    PEV_FF_toast(PEV_FF_editingId ? 'Registro atualizado.' : (tipo === 'ferias' ? 'Férias cadastradas.' : 'Folga cadastrada.'));
  } catch (err) {
    console.error('[PEV FF] Erro ao salvar:', err);
    PEV_FF_toast('Erro ao salvar: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = PEV_FF_editingId ? 'Salvar alterações' : 'Cadastrar';
  }
}

/* ─── Excluir ───────────────────────────────────────────── */
async function PEV_FF_delete(id) {
  const rec = PEV_FF_records.find(r => r.id === id);
  if (!rec) return;
  const nome = rec.colaborador;
  const tipo = rec.tipo === 'ferias' ? 'férias' : 'folga';
  if (!confirm(`Excluir ${tipo} de ${nome}? Esta ação não pode ser desfeita.`)) return;

  try {
    await PEV_FF_deleteDB(id);
  } catch (dbErr) {
    console.warn('[PEV FF] Supabase delete falhou, removendo local:', dbErr.message);
  }

  PEV_FF_records = PEV_FF_records.filter(r => r.id !== id);
  PEV_FF_saveLocal();
  PEV_FF_render();
  PEV_FF_toast('Registro excluído.');
}

/* ─── Render ────────────────────────────────────────────── */
function PEV_FF_render() {
  const container = document.getElementById('pev-ff-list');
  if (!container) return;

  const hoje = PEV_FF_todayISO();
  const ativos = PEV_FF_records.filter(PEV_FF_isFutureOrToday)
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  const arquivados = PEV_FF_records.filter(r => !PEV_FF_isFutureOrToday(r))
    .sort((a, b) => {
      const ra = a.tipo === 'ferias' ? (a.data_fim || a.data_inicio) : a.data_inicio;
      const rb = b.tipo === 'ferias' ? (b.data_fim || b.data_inicio) : b.data_inicio;
      return rb.localeCompare(ra);
    });

  const folgas  = ativos.filter(r => r.tipo === 'folga');
  const ferias  = ativos.filter(r => r.tipo === 'ferias');

  // Atualizar contadores da aba
  const badgeFolgas = document.getElementById('pev-ff-badge-folgas');
  const badgeFerias = document.getElementById('pev-ff-badge-ferias');
  if (badgeFolgas) badgeFolgas.textContent = folgas.length;
  if (badgeFerias) badgeFerias.textContent = ferias.length;

  let html = '';

  // ── Seção Folgas ──
  html += `
    <div class="pev-ff-section">
      <div class="pev-ff-section-head">
        <div>
          <strong>📅 Folgas ativas / futuras</strong>
          <small>Folgas de hoje ou próximas</small>
        </div>
        <span class="pausa-turno-count">${folgas.length}</span>
      </div>
      <div class="pev-ff-section-body">
  `;
  if (folgas.length) {
    folgas.forEach(r => { html += PEV_FF_buildCard(r, hoje); });
  } else {
    html += `<div class="pev-ff-empty">Nenhuma folga futura cadastrada.</div>`;
  }
  html += `</div></div>`;

  // ── Seção Férias ──
  html += `
    <div class="pev-ff-section" style="margin-top:1rem">
      <div class="pev-ff-section-head">
        <div>
          <strong>🏖️ Férias ativas / futuras</strong>
          <small>Períodos de hoje em diante</small>
        </div>
        <span class="pausa-turno-count">${ferias.length}</span>
      </div>
      <div class="pev-ff-section-body">
  `;
  if (ferias.length) {
    ferias.forEach(r => { html += PEV_FF_buildCard(r, hoje); });
  } else {
    html += `<div class="pev-ff-empty">Nenhuma férias futura cadastrada.</div>`;
  }
  html += `</div></div>`;

  // ── Arquivo ──
  if (arquivados.length) {
    html += `
      <details class="pev-ff-archive" style="margin-top:1rem">
        <summary>
          <span>📁 Arquivo</span>
          <strong>${arquivados.length} ${arquivados.length === 1 ? 'registro' : 'registros'}</strong>
        </summary>
        <div class="pev-ff-section-body" style="margin-top:.5rem">
    `;
    arquivados.forEach(r => { html += PEV_FF_buildCard(r, hoje, true); });
    html += `</div></details>`;
  }

  container.innerHTML = html;
}

function PEV_FF_buildCard(rec, hoje, arquivado = false) {
  const isFerias = rec.tipo === 'ferias';
  const ini  = PEV_FF_fmtDate(rec.data_inicio);
  const fim  = rec.data_fim ? PEV_FF_fmtDate(rec.data_fim) : null;
  const dias = isFerias && rec.data_fim ? PEV_FF_diffDays(rec.data_inicio, rec.data_fim) : null;

  let statusLabel = 'Futuro';
  let statusCls   = 'gestao';
  if (arquivado) { statusLabel = 'Arquivado'; statusCls = 'arquivada'; }
  else if (rec.data_inicio === hoje || (isFerias && rec.data_inicio <= hoje && (rec.data_fim ?? hoje) >= hoje)) {
    statusLabel = 'Hoje'; statusCls = 'hoje';
  }

  const periodo = isFerias && fim ? `${ini} → ${fim}${dias ? ` <em>(${dias}d)</em>` : ''}` : ini;

  // Iniciais para avatar
  const parts = rec.colaborador.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : rec.colaborador.slice(0, 2).toUpperCase();

  // Gera cor determinística para o avatar
  let h = 0;
  for (let i = 0; i < rec.colaborador.length; i++) h = (h * 31 + rec.colaborador.charCodeAt(i)) & 0xffff;
  const hue = h % 360;

  return `
    <div class="pev-ff-card${arquivado ? ' pev-ff-card-archived' : ''}">
      <div class="team-info" style="flex:1;min-width:0">
        <div class="avatar" style="background:hsl(${hue},55%,38%);font-size:12px;flex-shrink:0">${initials}</div>
        <div style="min-width:0">
          <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${PEV_FF_escapeHtml(rec.colaborador)}</strong>
          <div class="folga-meta">
            <small>${periodo}</small>
            ${rec.motivo ? `<small>· ${PEV_FF_escapeHtml(rec.motivo)}</small>` : ''}
          </div>
        </div>
      </div>
      <div class="folga-badges" style="flex-shrink:0;align-items:center;gap:6px">
        <span class="cargo-badge ${isFerias ? 'ferias' : 'tecnico'}">${isFerias ? '🏖️ Férias' : '📅 Folga'}</span>
        <span class="cargo-badge ${statusCls}">${statusLabel}</span>
        ${!arquivado ? `
          <button
            class="pev-ff-btn-edit"
            onclick="PEV_FF_openModal('${rec.id}')"
            title="Editar"
            type="button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        ` : ''}
        <button
          class="pev-ff-btn-del"
          onclick="PEV_FF_delete('${rec.id}')"
          title="Excluir"
          type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>
  `;
}

/* ─── Toast ──────────────────────────────────────────────── */
function PEV_FF_toast(msg) {
  if (typeof toast === 'function') { toast(msg); return; }
  // fallback simples
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:#f1f5f9;padding:10px 18px;border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4)';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function PEV_FF_escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Injetar HTML na aba PEV ───────────────────────────── */
function PEV_FF_injectHTML() {
  // 1. Adicionar botão na barra de sub-abas PEV (antes da aba de importações)
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
      <span id="pev-ff-tab-badge" style="display:none;background:var(--gold);color:#000;font-size:10px;font-weight:700;border-radius:99px;padding:1px 6px;margin-left:2px">0</span>
    `;
    tabImport.parentNode.insertBefore(btn, tabImport);
  }

  // 2. Adicionar a pev-page
  const importPage = document.getElementById('pev-page-importacoes');
  if (importPage && !document.getElementById('pev-page-ferias-folgas')) {
    const page = document.createElement('div');
    page.className = 'pev-page';
    page.id = 'pev-page-ferias-folgas';
    page.innerHTML = `
      <!-- Cabeçalho -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:1.25rem">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--gold)"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
            Controle de Férias &amp; Folgas — PEV
          </div>
          <div style="font-size:12px;color:var(--muted);margin-top:3px">
            Sincronizado em tempo real · visível para todos os gestores
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="pev-ff-btn-refresh" type="button" title="Recarregar do servidor" style="padding:0 14px;height:38px;display:flex;align-items:center;gap:6px;font-size:13px">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
            Atualizar
          </button>
          <button class="btn btn-gold" id="pev-ff-btn-add" type="button" style="height:38px;display:flex;align-items:center;gap:6px;font-size:13px">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Cadastrar
          </button>
        </div>
      </div>

      <!-- Sumário rápido -->
      <div id="pev-ff-summary" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:1.25rem">
        <div class="metric" style="flex:1;min-width:120px">
          <span>Folgas futuras</span>
          <strong id="pev-ff-badge-folgas">0</strong>
        </div>
        <div class="metric m-ferias" style="flex:1;min-width:120px">
          <span>Férias futuras</span>
          <strong id="pev-ff-badge-ferias">0</strong>
        </div>
      </div>

      <!-- Lista principal -->
      <div class="card" style="padding:1rem">
        <div id="pev-ff-list">
          <div class="pev-ff-empty" style="padding:2rem;text-align:center;color:var(--muted)">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="opacity:.3;margin-bottom:8px"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <p style="margin:0;font-size:13px">Carregando registros…</p>
          </div>
        </div>
      </div>
    `;
    importPage.parentNode.insertBefore(page, importPage);
  }

  // 3. Modal de cadastro/edição
  if (!document.getElementById('pev-ff-modal')) {
    const modal = document.createElement('div');
    modal.id = 'pev-ff-modal';
    modal.className = 'overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'pev-ff-modal-title');
    modal.innerHTML = `
      <div class="modal modal-folga-inner" style="max-width:420px">
        <div class="modal-folga-header">
          <div class="modal-folga-icon" style="background:rgba(250,204,21,0.12);color:var(--gold);border-color:rgba(250,204,21,0.3)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></svg>
          </div>
          <div>
            <h2 id="pev-ff-modal-title" style="font-size:16px;font-weight:700;margin:0">Cadastrar férias / folga</h2>
            <p class="modal-folga-sub">PEV — visível para todos os gestores</p>
          </div>
          <button class="modal-close-btn" id="pev-ff-modal-close" type="button" aria-label="Fechar">✕</button>
        </div>

        <div class="modal-folga-body">
          <div class="modal-field">
            <label for="pev-ff-tipo">Tipo</label>
            <select id="pev-ff-tipo">
              <option value="folga">📅 Folga</option>
              <option value="ferias">🏖️ Férias</option>
            </select>
          </div>

          <div class="modal-field">
            <label for="pev-ff-colab">Colaborador</label>
            <input id="pev-ff-colab" type="text" placeholder="Nome do colaborador" list="pev-ff-colab-list" autocomplete="off" />
            <datalist id="pev-ff-colab-list"></datalist>
          </div>

          <div class="modal-field">
            <label id="pev-ff-data-ini-label" for="pev-ff-data-ini">Data da folga</label>
            <input id="pev-ff-data-ini" type="date" />
          </div>

          <div class="modal-field" id="pev-ff-data-fim-wrap" style="display:none">
            <label for="pev-ff-data-fim">Data final</label>
            <input id="pev-ff-data-fim" type="date" />
          </div>

          <div class="modal-field">
            <label for="pev-ff-motivo">Motivo / observação <span style="color:var(--muted);font-weight:400">(opcional)</span></label>
            <input id="pev-ff-motivo" type="text" placeholder="Ex: férias aprovadas, folga liberada..." />
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn" id="pev-ff-btn-cancel" type="button">Cancelar</button>
          <button class="btn btn-gold" id="pev-ff-btn-save" type="button">Cadastrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 4. Estilos
  if (!document.getElementById('pev-ff-styles')) {
    const style = document.createElement('style');
    style.id = 'pev-ff-styles';
    style.textContent = `
      .pev-ff-section { }
      .pev-ff-section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 0 .6rem;
        border-bottom: 1px solid var(--border);
        margin-bottom: .75rem;
      }
      .pev-ff-section-head strong { font-size:13px; display:block; }
      .pev-ff-section-head small  { font-size:11px; color:var(--muted); }
      .pev-ff-section-body { display:flex; flex-direction:column; gap:.5rem; }
      .pev-ff-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: .65rem .75rem;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface2);
        transition: background .15s;
      }
      .pev-ff-card:hover { background: var(--surface3); }
      .pev-ff-card-archived { opacity: .6; }
      .pev-ff-empty {
        padding: 1.5rem;
        text-align: center;
        color: var(--muted);
        font-size: 13px;
        border: 1px dashed var(--border);
        border-radius: 10px;
      }
      .pev-ff-btn-edit,
      .pev-ff-btn-del {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--surface3);
        color: var(--muted);
        cursor: pointer;
        transition: all .15s;
        flex-shrink: 0;
      }
      .pev-ff-btn-edit:hover { border-color: var(--gold); color: var(--gold); background: rgba(250,204,21,.08); }
      .pev-ff-btn-del:hover  { border-color: var(--red);  color: var(--red);  background: rgba(251,113,133,.08); }
      .pev-ff-archive summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: .6rem .25rem;
        cursor: pointer;
        font-size: 13px;
        color: var(--muted);
        list-style: none;
        border-top: 1px solid var(--border);
      }
      .pev-ff-archive summary::-webkit-details-marker { display:none; }
      .pev-ff-archive summary strong { font-size:12px; color:var(--muted); }
      #pev-ff-modal .modal-folga-header {
        position: relative;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 1.25rem 1.25rem .75rem;
        border-bottom: 1px solid var(--border);
      }
      #pev-ff-modal .modal-folga-body { padding: 1rem 1.25rem; display:flex; flex-direction:column; gap:.85rem; }
      #pev-ff-modal .modal-field label { font-size:12px; color:var(--muted); display:block; margin-bottom:4px; font-weight:500; }
      #pev-ff-modal .modal-field input,
      #pev-ff-modal .modal-field select {
        width: 100%;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: .55rem .75rem;
        font-size: 13px;
        color: var(--text);
        box-sizing: border-box;
        outline: none;
        transition: border-color .15s;
      }
      #pev-ff-modal .modal-field input:focus,
      #pev-ff-modal .modal-field select:focus { border-color: var(--gold); }
      #pev-ff-modal .modal-actions {
        display: flex;
        gap: 8px;
        padding: .75rem 1.25rem 1.25rem;
        justify-content: flex-end;
      }
      #pev-ff-modal .modal-close-btn {
        position: absolute;
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        width: 30px;
        height: 30px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--surface2);
        color: var(--muted);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  }
}

/* ─── Vincular eventos ──────────────────────────────────── */
function PEV_FF_bindEvents() {
  // Botão + Cadastrar
  document.getElementById('pev-ff-btn-add')?.addEventListener('click', () => PEV_FF_openModal());

  // Botão Atualizar
  document.getElementById('pev-ff-btn-refresh')?.addEventListener('click', async () => {
    const btn = document.getElementById('pev-ff-btn-refresh');
    if (btn) { btn.disabled = true; btn.textContent = 'Atualizando…'; }
    await PEV_FF_load();
    PEV_FF_render();
    if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg> Atualizar`; }
    PEV_FF_toast('Dados atualizados.');
  });

  // Modal – fechar
  document.getElementById('pev-ff-modal-close')?.addEventListener('click', PEV_FF_closeModal);
  document.getElementById('pev-ff-btn-cancel')?.addEventListener('click', PEV_FF_closeModal);
  document.getElementById('pev-ff-modal')?.addEventListener('click', e => {
    if (e.target.id === 'pev-ff-modal') PEV_FF_closeModal();
  });

  // Modal – salvar
  document.getElementById('pev-ff-btn-save')?.addEventListener('click', PEV_FF_save);

  // Tipo muda → mostrar/ocultar data_fim
  document.getElementById('pev-ff-tipo')?.addEventListener('change', () => {
    PEV_FF_toggleDataFim();
    const tipo = document.getElementById('pev-ff-tipo').value;
    const label = document.getElementById('pev-ff-data-ini-label');
    if (label) label.textContent = tipo === 'ferias' ? 'Data de início' : 'Data da folga';
  });

  // Preencher datalist de colaboradores
  const dl = document.getElementById('pev-ff-colab-list');
  if (dl) {
    const nomes = typeof PEV_colabs !== 'undefined'
      ? PEV_colabs.map(c => c.nome)
      : [];
    dl.innerHTML = nomes.map(n => `<option value="${PEV_FF_escapeHtml(n)}">`).join('');
  }

  // Vincular o novo botão ao roteador PEV_goTab (que pode já ter rodado antes deste script)
  const newTabBtn = document.querySelector('.pev-tab[data-pev-tab="ferias-folgas"]');
  if (newTabBtn) {
    newTabBtn.onclick = () => {
      if (typeof PEV_goTab === 'function') {
        PEV_goTab('ferias-folgas');
      } else {
        document.querySelectorAll('.pev-tab').forEach(t => t.classList.remove('active'));
        newTabBtn.classList.add('active');
        document.querySelectorAll('.pev-page').forEach(p => p.classList.remove('active'));
        const page = document.getElementById('pev-page-ferias-folgas');
        if (page) page.classList.add('active');
      }
      PEV_FF_render();
    };
  }
}

/* ─── Init ──────────────────────────────────────────────── */
async function PEV_FF_init() {
  PEV_FF_injectHTML();
  PEV_FF_bindEvents();
  await PEV_FF_load();
  PEV_FF_render();
}

// Aguarda o DOM estar pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', PEV_FF_init);
} else {
  PEV_FF_init();
}
