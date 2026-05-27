/**
 * gestao-treinamentos.js
 *
 * Módulo de Treinamentos — Pit Stop e PEV
 * Persiste dados no Supabase via /api/treinamentos
 *
 * Expõe:
 *   Trein.init(setor)          — inicializa a aba (chama ao trocar de tab)
 *   Trein.refresh()            — recarrega do banco
 */

const Trein = (() => {
  /* ── Estado ──────────────────────────────────────────────────── */
  let _setor = 'pitstop';       // 'pitstop' | 'pev'
  let _treinamentos = [];
  let _presencas = [];
  let _mesAtivo = _mesAtual();  // 'YYYY-MM'
  let _editandoId = null;       // null = novo, string = editar
  let _carregado = { pitstop: false, pev: false };

  /* ── Helpers ─────────────────────────────────────────────────── */
  function _mesAtual() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function _fmtMes(mesRef) {
    if (!mesRef) return '';
    const [ano, mes] = mesRef.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[parseInt(mes, 10) - 1]} ${ano}`;
  }

  function _uid() {
    return `trein_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }

  function _presencasDoTreinamento(treinId) {
    return _presencas.filter(p => p.treinamento_id === treinId);
  }

  function _colabsDoSetor() {
    if (_setor === 'pev') {
      return (window.PEV_colabs || []).map(c => c.nome).filter(Boolean).sort();
    }
    // Pit Stop — usa array global `colaboradores`
    return (window.colaboradores || []).map(c => c.nome).filter(Boolean).sort();
  }

  /* ── API ─────────────────────────────────────────────────────── */
  async function _api(method, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);

    const url = method === 'GET'
      ? `/api/treinamentos?setor=${_setor}`
      : '/api/treinamentos';

    const res = await fetch(url, opts);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }

  async function _carregar() {
    const data = await _api('GET');
    _treinamentos = data.treinamentos || [];
    _presencas    = data.presencas    || [];
    _carregado[_setor] = true;
  }

  /* ── Render ──────────────────────────────────────────────────── */
  function _containerId() {
    return `trein-list-${_setor}`;
  }

  function _render() {
    const container = document.getElementById(_containerId());
    if (!container) return;

    const filtrados = _treinamentos.filter(t => t.mes_ref === _mesAtivo && t.setor === _setor);
    filtrados.sort((a, b) => b.criado_em?.localeCompare(a.criado_em || '') || 0);

    if (filtrados.length === 0) {
      container.innerHTML = `
        <div class="trein-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <strong>Nenhum treinamento em ${_fmtMes(_mesAtivo)}</strong>
          Clique em "+ Novo Treinamento" para adicionar.
        </div>`;
      return;
    }

    container.innerHTML = filtrados.map(t => _renderCard(t)).join('');

    // Eventos dos chips de presença
    container.querySelectorAll('.trein-presenca-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        const presencaId = chip.dataset.presencaId;
        const statusAtual = chip.dataset.status;
        const novoStatus = statusAtual === 'assistiu' ? 'pendente' : 'assistiu';
        chip.style.pointerEvents = 'none';
        chip.style.opacity = '0.5';
        try {
          await _api('PATCH', { tipo: 'presenca', presenca_id: presencaId, status: novoStatus });
          const p = _presencas.find(x => x.id === presencaId);
          if (p) p.status = novoStatus;
          _renderCard_update(t.id);
        } catch (e) {
          _toast('❌ Erro ao salvar: ' + e.message);
          chip.style.pointerEvents = '';
          chip.style.opacity = '';
        }
      });
    });

    // Expand/collapse
    container.querySelectorAll('.trein-card-header').forEach(header => {
      header.addEventListener('click', e => {
        if (e.target.closest('.trein-btn-icon')) return;
        const card = header.closest('.trein-card');
        card.classList.toggle('open');
      });
    });

    // Editar
    container.querySelectorAll('.trein-btn-icon.edit').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _abrirModal(btn.dataset.id);
      });
    });

    // Deletar
    container.querySelectorAll('.trein-btn-icon.delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _confirmarDelete(btn.dataset.id);
      });
    });
  }

  function _renderCard(t) {
    const presencas = _presencasDoTreinamento(t.id);
    const total = presencas.length;
    const assistiu = presencas.filter(p => p.status === 'assistiu').length;
    const pct = total > 0 ? Math.round((assistiu / total) * 100) : 0;
    const corBarra = pct === 100 ? '' : pct >= 50 ? 'amarelo' : 'vermelho';

    const chipsHtml = presencas.length === 0
      ? `<p style="font-size:12px;color:var(--text-muted)">Nenhum colaborador vinculado.</p>`
      : presencas.map(p => `
        <button class="trein-presenca-chip ${p.status}" data-presenca-id="${p.id}" data-status="${p.status}" title="Clique para alternar">
          <span class="chip-icon">${p.status === 'assistiu' ? '✓' : '○'}</span>
          ${_esc(p.colaborador)}
        </button>`).join('');

    return `
      <div class="trein-card" id="trein-card-${t.id}">
        <div class="trein-card-header">
          <div class="trein-card-header-left">
            <span class="trein-card-title">${_esc(t.titulo)}</span>
            <div class="trein-card-meta">
              <span class="trein-mes-tag">📅 ${_fmtMes(t.mes_ref)}</span>
              <span class="trein-progress-mini">${total > 0 ? `<strong>${assistiu}</strong>/${total} assistiram` : 'Sem participantes'}</span>
            </div>
          </div>
          <div class="trein-card-actions">
            ${total > 0 ? `
            <div style="display:flex;align-items:center;gap:6px">
              <div class="trein-prog-bar-wrap">
                <div class="trein-prog-bar-fill ${corBarra}" style="width:${pct}%"></div>
              </div>
              <span style="font-size:11px;color:var(--text-muted);min-width:28px">${pct}%</span>
            </div>` : ''}
            <button class="trein-btn-icon edit" data-id="${t.id}" title="Editar">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="trein-btn-icon delete" data-id="${t.id}" title="Excluir">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
            <svg class="trein-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="trein-card-body">
          ${t.descricao ? `<p class="trein-descricao">${_esc(t.descricao)}</p>` : ''}
          <div class="trein-presencas-titulo">Participantes</div>
          <div class="trein-presencas-grid">${chipsHtml}</div>
          ${total > 0 ? `
          <div class="trein-resumo-row">
            <span class="trein-resumo-item">✅ Assistiram: <strong>${assistiu}</strong></span>
            <span class="trein-resumo-item">⏳ Pendentes: <strong>${total - assistiu}</strong></span>
            <span class="trein-resumo-item">👥 Total: <strong>${total}</strong></span>
          </div>` : ''}
        </div>
      </div>`;
  }

  // Atualiza apenas um card (após toggle de presença)
  function _renderCard_update(treinId) {
    const el = document.getElementById(`trein-card-${treinId}`);
    if (!el) return;
    const t = _treinamentos.find(x => x.id === treinId);
    if (!t) return;
    const eraAberto = el.classList.contains('open');
    el.outerHTML = _renderCard(t);
    const novo = document.getElementById(`trein-card-${treinId}`);
    if (!novo) return;
    if (eraAberto) novo.classList.add('open');

    // Re-bind eventos do novo elemento
    novo.querySelectorAll('.trein-presenca-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        const presencaId = chip.dataset.presencaId;
        const statusAtual = chip.dataset.status;
        const novoStatus = statusAtual === 'assistiu' ? 'pendente' : 'assistiu';
        chip.style.pointerEvents = 'none';
        chip.style.opacity = '0.5';
        try {
          await _api('PATCH', { tipo: 'presenca', presenca_id: presencaId, status: novoStatus });
          const p = _presencas.find(x => x.id === presencaId);
          if (p) p.status = novoStatus;
          _renderCard_update(treinId);
        } catch (e) {
          _toast('❌ Erro ao salvar: ' + e.message);
        }
      });
    });
    novo.querySelectorAll('.trein-btn-icon.edit').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); _abrirModal(btn.dataset.id); });
    });
    novo.querySelectorAll('.trein-btn-icon.delete').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); _confirmarDelete(btn.dataset.id); });
    });
    novo.querySelector('.trein-card-header').addEventListener('click', e => {
      if (e.target.closest('.trein-btn-icon')) return;
      novo.classList.toggle('open');
    });
  }

  /* ── Seletor de mês ──────────────────────────────────────────── */
  function _popularMeses() {
    // O <select> nativo fica oculto; usamos um dropdown customizado
    const anchor = document.getElementById(`trein-mes-select-${_setor}`);
    if (!anchor) return;

    // Meses dos treinamentos existentes + mês atual + próximos 3
    const mesesSet = new Set([_mesAtual()]);
    _treinamentos.filter(t => t.setor === _setor).forEach(t => mesesSet.add(t.mes_ref));
    const d = new Date();
    for (let i = 0; i <= 2; i++) {
      const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
      mesesSet.add(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
    }
    const meses = [...mesesSet].sort().reverse();
    if (!meses.includes(_mesAtivo)) _mesAtivo = meses[0];

    // Verifica se o wrapper customizado já existe; se sim, só atualiza
    const wrapId = `trein-mes-wrap-${_setor}`;
    let wrap = document.getElementById(wrapId);

    if (!wrap) {
      // Cria o wrapper no lugar do <select>
      wrap = document.createElement('div');
      wrap.className = 'trein-mes-wrap';
      wrap.id = wrapId;
      anchor.parentNode.insertBefore(wrap, anchor);

      wrap.innerHTML = `
        <button class="trein-mes-btn" type="button" id="trein-mes-btn-${_setor}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          <span id="trein-mes-label-${_setor}">${_fmtMes(_mesAtivo)}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="trein-mes-dropdown" id="trein-mes-dropdown-${_setor}"></div>`;

      const btn = wrap.querySelector(`#trein-mes-btn-${_setor}`);
      const dropdown = wrap.querySelector(`#trein-mes-dropdown-${_setor}`);

      btn.addEventListener('click', e => {
        e.stopPropagation();
        btn.classList.toggle('open');
        dropdown.classList.toggle('open');
      });

      document.addEventListener('click', () => {
        btn.classList.remove('open');
        dropdown.classList.remove('open');
      });
    }

    // Atualiza label e opções
    const label    = document.getElementById(`trein-mes-label-${_setor}`);
    const dropdown = document.getElementById(`trein-mes-dropdown-${_setor}`);
    const btn      = document.getElementById(`trein-mes-btn-${_setor}`);
    if (label) label.textContent = _fmtMes(_mesAtivo);

    if (dropdown) {
      dropdown.innerHTML = meses.map(m => `
        <button class="trein-mes-option ${m === _mesAtivo ? 'active' : ''}" data-mes="${m}" type="button">
          ${_fmtMes(m)}
        </button>`).join('');

      dropdown.querySelectorAll('.trein-mes-option').forEach(opt => {
        opt.addEventListener('click', e => {
          e.stopPropagation();
          _mesAtivo = opt.dataset.mes;
          if (label) label.textContent = _fmtMes(_mesAtivo);
          btn.classList.remove('open');
          dropdown.classList.remove('open');
          dropdown.querySelectorAll('.trein-mes-option').forEach(o => o.classList.toggle('active', o.dataset.mes === _mesAtivo));
          _render();
        });
      });
    }
  }

  /* ── Modal criar/editar ──────────────────────────────────────── */
  function _abrirModal(treinId = null) {
    _editandoId = treinId;
    const overlay = document.getElementById('trein-modal-overlay');
    const modal   = document.getElementById('trein-modal');
    if (!overlay || !modal) return;

    const t = treinId ? _treinamentos.find(x => x.id === treinId) : null;
    const presencasAtuais = treinId ? _presencasDoTreinamento(treinId).map(p => p.colaborador) : [];
    const colabs = _colabsDoSetor();

    modal.innerHTML = `
      <h2>${t ? '✏️ Editar Treinamento' : '📚 Novo Treinamento'}</h2>

      <div class="trein-form-group">
        <label>Título do Treinamento *</label>
        <input id="trein-input-titulo" type="text" placeholder="Ex: Treinamento de Atendimento ao Cliente" value="${_esc(t?.titulo || '')}">
      </div>

      <div class="trein-form-group">
        <label>Descrição (opcional)</label>
        <textarea id="trein-input-descricao" placeholder="Descreva o conteúdo, plataforma, link, etc.">${_esc(t?.descricao || '')}</textarea>
      </div>

      <div class="trein-form-group">
        <label>Mês de Referência *</label>
        <input id="trein-input-mes" type="month" value="${t?.mes_ref || _mesAtual()}">
      </div>

      ${!t ? `
      <div class="trein-form-group">
        <label>Colaboradores participantes</label>
        <div class="trein-colab-grid" id="trein-colab-grid">
          ${colabs.length === 0
            ? `<p style="font-size:12px;color:var(--text-muted)">Nenhum colaborador encontrado. Cadastre colaboradores primeiro.</p>`
            : colabs.map(nome => `
              <label class="trein-colab-check" id="trein-chk-wrap-${_slugify(nome)}">
                <input type="checkbox" value="${_esc(nome)}" ${presencasAtuais.includes(nome) ? 'checked' : ''}>
                ${_esc(nome)}
              </label>`).join('')
          }
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button type="button" class="btn btn-small" id="trein-btn-sel-todos" style="font-size:11px;padding:4px 10px">Todos</button>
          <button type="button" class="btn btn-small" id="trein-btn-des-todos" style="font-size:11px;padding:4px 10px">Nenhum</button>
        </div>
      </div>` : ''}

      <div class="trein-modal-footer">
        <button class="btn" id="trein-modal-cancel" type="button">Cancelar</button>
        <button class="btn btn-gold" id="trein-modal-save" type="button">
          ${t ? 'Salvar alterações' : 'Criar Treinamento'}
        </button>
      </div>`;

    overlay.classList.add('open');

    // Eventos checkboxes
    modal.querySelectorAll('.trein-colab-check input').forEach(chk => {
      chk.parentElement.classList.toggle('checked', chk.checked);
      chk.addEventListener('change', () => chk.parentElement.classList.toggle('checked', chk.checked));
    });
    const btnTodos = modal.querySelector('#trein-btn-sel-todos');
    const btnNenhum = modal.querySelector('#trein-btn-des-todos');
    if (btnTodos) btnTodos.onclick = () => modal.querySelectorAll('.trein-colab-check input').forEach(c => { c.checked = true; c.parentElement.classList.add('checked'); });
    if (btnNenhum) btnNenhum.onclick = () => modal.querySelectorAll('.trein-colab-check input').forEach(c => { c.checked = false; c.parentElement.classList.remove('checked'); });

    modal.querySelector('#trein-modal-cancel').onclick = _fecharModal;
    modal.querySelector('#trein-modal-save').onclick = _salvarModal;
    overlay.onclick = e => { if (e.target === overlay) _fecharModal(); };
  }

  function _fecharModal() {
    document.getElementById('trein-modal-overlay')?.classList.remove('open');
    _editandoId = null;
  }

  async function _salvarModal() {
    const titulo    = document.getElementById('trein-input-titulo')?.value.trim();
    const descricao = document.getElementById('trein-input-descricao')?.value.trim();
    const mes_ref   = document.getElementById('trein-input-mes')?.value;
    if (!titulo) { _toast('⚠️ Informe o título do treinamento.'); return; }
    if (!mes_ref) { _toast('⚠️ Informe o mês de referência.'); return; }

    const btn = document.getElementById('trein-modal-save');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
      if (_editandoId) {
        // Editar
        await _api('PATCH', { tipo: 'treinamento', id: _editandoId, titulo, descricao, mes_ref });
        const t = _treinamentos.find(x => x.id === _editandoId);
        if (t) { t.titulo = titulo; t.descricao = descricao; t.mes_ref = mes_ref; }
        _toast('✅ Treinamento atualizado.');
      } else {
        // Criar
        const colabs = [...document.querySelectorAll('.trein-colab-check input:checked')].map(c => c.value);
        const res = await _api('POST', { titulo, descricao, setor: _setor, mes_ref, colaboradores: colabs });
        _treinamentos.unshift(res.treinamento);
        (res.presencas || []).forEach(p => _presencas.push(p));
        _mesAtivo = mes_ref;
        _toast('✅ Treinamento criado!');
      }
      _fecharModal();
      _popularMeses();
      _render();
    } catch (e) {
      _toast('❌ Erro: ' + e.message);
      btn.disabled = false;
      btn.textContent = _editandoId ? 'Salvar alterações' : 'Criar Treinamento';
    }
  }

  /* ── Deletar ─────────────────────────────────────────────────── */
  async function _confirmarDelete(id) {
    const t = _treinamentos.find(x => x.id === id);
    if (!t) return;
    if (!confirm(`Excluir o treinamento "${t.titulo}"? Todas as presenças serão removidas.`)) return;
    try {
      await _api('DELETE', { id });
      _treinamentos = _treinamentos.filter(x => x.id !== id);
      _presencas    = _presencas.filter(x => x.treinamento_id !== id);
      _render();
      _popularMeses();
      _toast('🗑 Treinamento excluído.');
    } catch (e) {
      _toast('❌ Erro ao excluir: ' + e.message);
    }
  }

  /* ── Toast ───────────────────────────────────────────────────── */
  function _toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._tid);
    el._tid = setTimeout(() => el.classList.remove('show'), 3000);
  }

  /* ── Sanitização ─────────────────────────────────────────────── */
  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _slugify(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  /* ── Public API ──────────────────────────────────────────────── */
  async function init(setor) {
    _setor = setor || 'pitstop';

    // Botão "+ Novo Treinamento"
    const btnNovo = document.getElementById(`trein-btn-novo-${_setor}`);
    if (btnNovo && !btnNovo._treinBound) {
      btnNovo._treinBound = true;
      btnNovo.addEventListener('click', () => _abrirModal(null));
    }

    // Mês selector
    const sel = document.getElementById(`trein-mes-select-${_setor}`);
    if (sel && !sel._treinBound) {
      sel._treinBound = true;
    }

    // Carrega uma vez por setor
    if (!_carregado[_setor]) {
      const container = document.getElementById(_containerId());
      if (container) container.innerHTML = '<div class="trein-empty" style="padding:32px 20px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;opacity:.4;margin-right:6px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Carregando...</div>';
      try {
        await _carregar();
      } catch (e) {
        _toast('⚠️ Erro ao carregar treinamentos: ' + e.message);
      }
    }

    _popularMeses();
    _render();
  }

  async function refresh() {
    _carregado[_setor] = false;
    await init(_setor);
  }

  return { init, refresh };
})();

window.Trein = Trein;
