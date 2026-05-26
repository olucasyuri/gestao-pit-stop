/**
 * Gestão PEV — Módulo de Importações Discord
 * Com fluxo de aprovação: Pendente → Aprovado / Reprovado
 * Notifica o colaborador via DM no Discord (Hermes) ao aprovar ou reprovar.
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
    const { error } = await supa.from('pev_importacoes').delete().eq('id', id);
    if (error) throw new Error('Erro ao excluir no banco: ' + (error.message || error));
  }
  PEV_importacoes = PEV_importacoes.filter(x => x.id !== id);
  localStorage.setItem(PEV_IMPORT_STORAGE_KEY, JSON.stringify(PEV_importacoes));
}


/* ── Toggle Agendamento com Setor ────────────────────────── */
async function PEV_toggleAgendado(id) {
  const item = PEV_importacoes.find(x => x.id === id);
  if (!item) return;
  const novoValor = (item.agendado === 'sim') ? 'nao' : 'sim';
  const updated = { ...item, agendado: novoValor };
  const saved = await PEV_saveImportacao(updated);
  const idx = PEV_importacoes.findIndex(x => x.id === id);
  if (idx >= 0) PEV_importacoes[idx] = saved || updated;
  PEV_renderImportacoes();
  PEV_updateImportCount();
  const msg = novoValor === 'sim' ? '📅 Marcado como agendado!' : '⏳ Marcado como aguardando agendamento.';
  if (typeof toast === 'function') toast(msg);
}

/* ── Aprovação / Reprovação ──────────────────────────────── */
async function PEV_aprovarImportacao(id) {
  const item = PEV_importacoes.find(x => x.id === id);
  if (!item) return;

  const updated = { ...item, status: 'aprovado', status_em: new Date().toISOString() };
  const saved = await PEV_saveImportacao(updated);
  const idx = PEV_importacoes.findIndex(x => x.id === id);
  if (idx >= 0) PEV_importacoes[idx] = saved || updated;

  PEV_renderImportacoes();
  PEV_updateImportCount();
  if (typeof toast === 'function') toast('✅ Solicitação aprovada!');

  // Notificar colaborador via Discord DM
  await PEV_notificarColaborador(saved || updated, 'aprovado');
}

async function PEV_reprovarImportacao(id) {
  const item = PEV_importacoes.find(x => x.id === id);
  if (!item) return;

  const motivo = prompt('Motivo da reprovação (opcional):') ?? '';

  const updated = { ...item, status: 'reprovado', status_em: new Date().toISOString(), motivo_reprovacao: motivo.trim() };
  const saved = await PEV_saveImportacao(updated);
  const idx = PEV_importacoes.findIndex(x => x.id === id);
  if (idx >= 0) PEV_importacoes[idx] = saved || updated;

  PEV_renderImportacoes();
  PEV_updateImportCount();
  if (typeof toast === 'function') toast('❌ Solicitação reprovada.');

  // Notificar colaborador via Discord DM
  await PEV_notificarColaborador(saved || updated, 'reprovado');
}

async function PEV_notificarColaborador(item, statusNovo) {
  let discord_id = item.discord_id || '';
  let nomeColab  = item.discord_nome || item.discord_user || '';

  if (!discord_id) {
    // Monta lista unificada: PEV_colabs + cache localStorage + colaboradores PIT STOP
    const colabsPEV = typeof PEV_colabs !== 'undefined' ? PEV_colabs : [];
    let todasListas = [...colabsPEV];
    try {
      const cache = JSON.parse(localStorage.getItem('pev_colaboradores') || '[]');
      cache.forEach(c => { if (!todasListas.find(x => x.id === c.id)) todasListas.push(c); });
    } catch(_) {}
    if (typeof colaboradores !== 'undefined' && Array.isArray(colaboradores)) {
      colaboradores.forEach(c => { if (!todasListas.find(x => x.id === c.id)) todasListas.push(c); });
    }

    const duLower = (item.discord_user || '').toLowerCase();
    const dnLower = (item.discord_nome || '').toLowerCase();

    const colab = todasListas.find(c => {
      const nL  = (c.nome        || '').toLowerCase();
      const duL = (c.discord_user || '').toLowerCase();
      return (
        (duLower && nL  && (nL === duLower || nL.includes(duLower) || duLower.includes(nL))) ||
        (duLower && duL && duL === duLower) ||
        (dnLower && nL  && (nL === dnLower || nL.includes(dnLower) || dnLower.includes(nL))) ||
        (dnLower && duL && duL === dnLower)
      );
    });

    if (colab && colab.discord_id) {
      discord_id = colab.discord_id;
      nomeColab  = colab.nome || nomeColab;
      console.log('[PEV] discord_id encontrado para', nomeColab, '→', discord_id);
    }
  }

  if (!discord_id) {
    console.warn('[PEV] Colaborador sem discord_id — DM não enviada. discord_user:', item.discord_user, '| discord_nome:', item.discord_nome);
    if (typeof toast === 'function') toast('⚠️ DM não enviada: colaborador sem Discord ID cadastrado na Equipe PEV.');
    return;
  }

  const emoji   = statusNovo === 'aprovado' ? '✅' : '❌';
  const titulo  = statusNovo === 'aprovado'
    ? '✅ Sua solicitação de importação foi APROVADA!'
    : '❌ Sua solicitação de importação foi REPROVADA.';

  let mensagem = `Olá, ${nomeColab}! Sua solicitação de importação de dados foi analisada.\n\n`;
  mensagem += `**Empresa:** ${item.empresa || '—'}\n`;
  mensagem += `**CNPJ:** ${item.cnpj || '—'}\n`;
  if (item.data_virada) {
    const dv = new Date(item.data_virada + 'T00:00:00').toLocaleDateString('pt-BR');
    mensagem += `**Virada do sistema:** ${dv}\n`;
  }
  mensagem += `\n**Status: ${emoji} ${statusNovo === 'aprovado' ? 'APROVADO' : 'REPROVADO'}**`;
  if (statusNovo === 'reprovado' && item.motivo_reprovacao) {
    mensagem += `\n**Motivo:** ${item.motivo_reprovacao}`;
  }
  mensagem += `\n\nQualquer dúvida, fale com a gestão. 🚗`;

  try {
    const fn = typeof sendHermes === 'function' ? sendHermes : PEV_sendHermesLocal;
    await fn('pitstop-mensagem', { discord_id, nome: nomeColab, mensagem });
    if (typeof toast === 'function') toast(`${emoji} DM enviada para ${nomeColab} no Discord.`);
  } catch (e) {
    console.error('[PEV] Erro ao enviar DM via Hermes:', e);
    if (typeof toast === 'function') toast('⚠️ Status salvo, mas DM falhou: ' + e.message);
  }
}

async function PEV_sendHermesLocal(tipo, payload) {
  const response = await fetch('/api/hermes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, ...payload }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  return response.json();
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
    let matchFilter = true;
    if (filter) {
      if (filter === 'agendado')     matchFilter = item.agendado === 'sim';
      else if (filter === 'nao-agendado') matchFilter = (!item.agendado || item.agendado === 'nao') && item.status === 'aprovado';
      else matchFilter = item.importacao === filter || item.status === filter;
    }
    return matchSearch && matchFilter;
  });

  PEV_renderImportStats();

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
    card.dataset.status = item.status || 'pendente';

    const dataStr = item.criado_em
      ? new Date(item.criado_em).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : '—';

    const dataViradaStr = item.data_virada
      ? new Date(item.data_virada + 'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })
      : null;

    // Status badge
    const status = item.status || 'pendente';
    const statusMap = {
      pendente:  { label: '🕐 Pendente',  cls: 'pendente' },
      aprovado:  { label: '✅ Aprovado',  cls: 'aprovado' },
      reprovado: { label: '❌ Reprovado', cls: 'reprovado' },
    };
    const st = statusMap[status] || statusMap.pendente;
    const statusBadge = `<span class="pev-import-status-badge ${st.cls}">${st.label}</span>`;

    // Discord user tag (mostra nome no Discord ou nome encontrado)
    const nomeExibido = item.discord_nome || item.discord_user || '';
    const discordTag = nomeExibido
      ? `<span class="pev-import-discord-tag">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.082.114 18.1.133 18.112a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
          ${PEV_escHtml(nomeExibido)}
        </span>` : '';

    // Botões de aprovação (apenas se pendente)
    const aprovacaoBtns = status === 'pendente' ? `
      <div class="pev-import-aprovacao-btns">
        <button class="pev-btn-aprovar" data-aprovar="${item.id}" title="Aprovar solicitação" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Aprovar
        </button>
        <button class="pev-btn-reprovar" data-reprovar="${item.id}" title="Reprovar solicitação" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Reprovar
        </button>
      </div>` : '';

    // Motivo reprovação
    const motivoHtml = (status === 'reprovado' && item.motivo_reprovacao)
      ? `<div class="pev-import-motivo">💬 Motivo: ${PEV_escHtml(item.motivo_reprovacao)}</div>` : '';

    // Badge de agendamento com o setor
    const agendado = item.agendado || 'nao';
    const agendadoBadge = `<span class="pev-import-agendado-badge ${agendado === 'sim' ? 'sim' : 'nao'}" data-toggle-agendado="${item.id}" title="Clique para alternar" style="cursor:pointer">
      ${agendado === 'sim' ? '📅 Agendado com setor' : '⏳ Aguardando agendamento'}
    </span>`;

    // Status em
    const statusEmStr = item.status_em
      ? new Date(item.status_em).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : null;

    card.innerHTML = `
      <div class="pev-import-card-body">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
          <span class="pev-import-badge ${item.importacao === 'sim' ? 'sim' : 'nao'}">
            ${item.importacao === 'sim' ? '📥 Com importação' : '📭 Sem importação'}
          </span>
          ${statusBadge}
          ${discordTag}
        </div>
        <div class="pev-import-empresa">${PEV_escHtml(item.empresa || '—')}</div>
        <div class="pev-import-cnpj">${PEV_escHtml(item.cnpj || '—')}</div>
        ${dataViradaStr ? `<div class="pev-import-virada">📅 Virada do sistema: <strong>${dataViradaStr}</strong></div>` : ''}
        ${item.obs ? `<div class="pev-import-obs">📝 ${PEV_escHtml(item.obs)}</div>` : ''}
        ${motivoHtml}
        <div style="margin:6px 0 2px;">${agendadoBadge}</div>
        ${aprovacaoBtns}
        <div class="pev-import-meta">
          <span>Solicitado: ${dataStr}</span>
          ${statusEmStr ? `<span>${status === 'aprovado' ? '✅ Aprovado' : '❌ Reprovado'}: ${statusEmStr}</span>` : ''}
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

    // Eventos
    card.querySelector('[data-edit-import]').onclick = () => PEV_openEditImportacao(item.id);
    card.querySelector('[data-del-import]').onclick = async () => {
      if (!confirm(`Excluir registro de "${item.empresa}"?`)) return;
      try {
        await PEV_deleteImportacao(item.id);
        PEV_renderImportacoes();
        PEV_updateImportCount();
        if (typeof toast === 'function') toast('🗑 Registro excluído.');
      } catch(e) {
        console.error('[PEV] Erro ao excluir:', e);
        if (typeof toast === 'function') toast('❌ Erro ao excluir: ' + e.message);
      }
    };

    const btnAprovar  = card.querySelector('[data-aprovar]');
    const btnReprovar = card.querySelector('[data-reprovar]');
    if (btnAprovar)  btnAprovar.onclick  = () => PEV_aprovarImportacao(item.id);
    if (btnReprovar) btnReprovar.onclick = () => PEV_reprovarImportacao(item.id);

    const btnAgendado = card.querySelector('[data-toggle-agendado]');
    if (btnAgendado) btnAgendado.onclick = () => PEV_toggleAgendado(item.id);

    list.appendChild(card);
  });
}

function PEV_renderImportStats() {
  const el = document.getElementById('pev-import-stats');
  if (!el) return;
  const total    = PEV_importacoes.length;
  const sim      = PEV_importacoes.filter(i => i.importacao === 'sim').length;
  const nao      = PEV_importacoes.filter(i => i.importacao === 'nao').length;
  const pendente = PEV_importacoes.filter(i => !i.status || i.status === 'pendente').length;
  const agendados    = PEV_importacoes.filter(i => i.agendado === 'sim').length;
  const naoAgendados = PEV_importacoes.filter(i => (!i.agendado || i.agendado === 'nao') && i.status === 'aprovado').length;
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
    ${pendente > 0 ? `
    <div class="pev-import-stat pendente">
      <span class="pev-import-stat-num">${pendente}</span>
      <span class="pev-import-stat-lbl">Pendentes</span>
    </div>` : ''}
    ${naoAgendados > 0 ? `
    <div class="pev-import-stat nao-agendado">
      <span class="pev-import-stat-num">${naoAgendados}</span>
      <span class="pev-import-stat-lbl">Falta agendar</span>
    </div>` : ''}
    ${agendados > 0 ? `
    <div class="pev-import-stat agendado">
      <span class="pev-import-stat-num">${agendados}</span>
      <span class="pev-import-stat-lbl">Agendados</span>
    </div>` : ''}
  `;
}

function PEV_updateImportCount() {
  const badge = document.getElementById('pev-import-count');
  if (!badge) return;
  const pendentes = PEV_importacoes.filter(i => !i.status || i.status === 'pendente').length;
  badge.textContent = pendentes || PEV_importacoes.length;
  badge.style.display = PEV_importacoes.length > 0 ? 'inline-flex' : 'none';
  // Destaca badge quando há pendentes
  badge.classList.toggle('has-pending', pendentes > 0);
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
  const existing  = editingId ? PEV_importacoes.find(x => x.id === editingId) : null;
  const item = {
    id: editingId || PEV_genId(),
    empresa, cnpj: PEV_formatCNPJ(cnpj), importacao, data_virada, obs,
    discord_user: existing?.discord_user || '',
    discord_nome: existing?.discord_nome || '',
    discord_id:   existing?.discord_id   || '',
    status:       existing?.status       || 'pendente',
    status_em:    existing?.status_em    || null,
    motivo_reprovacao: existing?.motivo_reprovacao || '',
    agendado:     existing?.agendado     || 'nao',
    criado_em: existing?.criado_em || new Date().toISOString(),
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
/**
 * Chamado quando o bot Discord recebe /importação de dados.
 * payload deve incluir:
 *   - empresa, cnpj, importacao, data_virada, obs
 *   - discord_user   : username no Discord (ex: "joao.silva")
 *   - discord_nome   : display name no Discord (ex: "João Silva") — preferido para exibição
 *   - discord_id     : ID numérico do usuário no Discord — necessário para enviar DM
 */
async function PEV_receberDoDiscord(payload) {
  const item = {
    id: PEV_genId(),
    empresa: payload.empresa || '',
    cnpj: PEV_formatCNPJ(payload.cnpj || ''),
    importacao: payload.importacao === 'sim' ? 'sim' : 'nao',
    data_virada: payload.data_virada || '',
    obs: payload.obs || '',
    discord_user: payload.discord_user || '',        // username Discord
    discord_nome: payload.discord_nome || payload.discord_user || '', // display name
    discord_id:   payload.discord_id   || '',        // ID para DM
    status: 'pendente',
    status_em: null,
    motivo_reprovacao: '',
    agendado: 'nao',
    criado_em: new Date().toISOString(),
  };
  await PEV_saveImportacao(item);
  PEV_importacoes.unshift(item);
  PEV_renderImportacoes();
  PEV_updateImportCount();
  const nomeExib = item.discord_nome || item.discord_user || item.empresa;
  if (typeof toast === 'function') toast(`📥 Nova solicitação de ${nomeExib}`);
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
