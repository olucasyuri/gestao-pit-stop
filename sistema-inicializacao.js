/**
 * 🔧 SISTEMA DE INICIALIZAÇÃO — COM SUPABASE
 *
 * Carrega dados do Supabase ao iniciar e sincroniza o localStorage
 * como cache local. Todos os gestores veem os mesmos dados.
 *
 * Ordem de execução:
 *   1. Tenta carregar do Supabase
 *   2. Grava no localStorage (cache)
 *   3. Dispara eventos para o mapa e dashboard renderizarem
 *   4. Fallback para localStorage se Supabase indisponível
 */

"use strict";

(function initializeSystemData() {
  console.group('🚀 Inicialização do Sistema');

  // ═══════════════════════════════════════════════════════════════
  // SISTEMA DE EVENTOS E FLAGS DE PRONTIDÃO
  // ═══════════════════════════════════════════════════════════════

  window.SystemData = {
    ready: { pitstop: false, pev: false, charts: false },

    markReady(module) {
      this.ready[module] = true;
      console.log('✅', module.toUpperCase(), 'pronto');
      window.dispatchEvent(new CustomEvent('system-data-ready', {
        detail: { module, allReady: this.isAllReady() }
      }));
      if (this.isAllReady()) {
        console.log('🎉 TODOS OS MÓDULOS PRONTOS!');
        this.triggerFullRefresh();
      }
    },

    isAllReady() {
      return this.ready.pitstop && this.ready.pev;
    },

    triggerFullRefresh() {
      console.log('🔄 Atualizando todos os componentes...');
      if (typeof window.DC_refreshDashboard === 'function') {
        window.DC_refreshDashboard();
        console.log('  ✓ Dashboard atualizado');
      }
      if (typeof window.MapaBrasil_refresh === 'function') {
        window.MapaBrasil_refresh();
        console.log('  ✓ Mapa atualizado');
      }
    },

    getData() {
      return {
        pitstop: {
          colaboradores: JSON.parse(localStorage.getItem('pitstop_colaboradores') || '[]'),
          folgas:        JSON.parse(localStorage.getItem('pitstop_folgas') || '[]'),
          pausas:        JSON.parse(localStorage.getItem('pitstop_pausas') || '{}'),
          flags:         JSON.parse(localStorage.getItem('pitstop_flags') || '{}'),
        },
        pev: {
          colaboradores: JSON.parse(localStorage.getItem('pev_colaboradores') || '[]'),
          importacoes:   JSON.parse(localStorage.getItem('pev_importacoes_v1') || '[]'),
        },
        mapa: {
          estados: JSON.parse(localStorage.getItem('mapa_estados_pitstop') || '{}'),
        }
      };
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // HELPER: acessa o cliente Supabase (criado pelo gestao-pitstop.js)
  // ═══════════════════════════════════════════════════════════════

  function getSupabase() {
    // O cliente global "supa" é criado pelo arquivo principal do PIT STOP
    return (typeof supa !== 'undefined' && supa) ? supa : null;
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. CARREGAR COLABORADORES PEV DO SUPABASE
  // ═══════════════════════════════════════════════════════════════

  async function carregarPevColaboradores() {
    const sb = getSupabase();
    if (!sb) {
      console.warn('⚠️ Supabase indisponível — usando cache localStorage para PEV');
      return usarCachePevColaboradores();
    }

    try {
      const { data, error } = await sb
        .from('pev_colaboradores')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Normaliza para o formato esperado pelo gestao-pev.js
        const colabs = data.map(c => ({
          id:         c.id,
          nome:       c.nome,
          horario:    c.horario    || '08h - 18h',
          regiao:     c.regiao     || '',
          almoco:     c.almoco     || '12:00',
          discord_id: c.discord_id || '',
        }));
        localStorage.setItem('pev_colaboradores', JSON.stringify(colabs));
        console.log('✅ PEV: carregados', colabs.length, 'colaboradores do Supabase');
        return colabs;
      } else {
        console.warn('⚠️ PEV: tabela pev_colaboradores vazia no Supabase');
        return usarCachePevColaboradores();
      }
    } catch (e) {
      console.error('❌ PEV: erro ao carregar do Supabase:', e.message);
      return usarCachePevColaboradores();
    }
  }

  function usarCachePevColaboradores() {
    const cache = JSON.parse(localStorage.getItem('pev_colaboradores') || '[]');
    if (cache.length > 0) {
      console.log('📦 PEV: usando cache local —', cache.length, 'colaboradores');
      return cache;
    }
    // Último fallback: dados hardcoded
    console.warn('⚠️ PEV: sem cache, usando dados padrão');
    return [];
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. CARREGAR MAPEAMENTO DE ESTADOS PIT STOP DO SUPABASE
  // ═══════════════════════════════════════════════════════════════

  async function carregarMapaEstados() {
    const sb = getSupabase();
    if (!sb) {
      console.warn('⚠️ Supabase indisponível — usando cache localStorage para mapa');
      return usarCacheMapaEstados();
    }

    try {
      const { data, error } = await sb
        .from('mapa_estados_pitstop')
        .select('colaborador_nome, uf');

      if (error) throw error;

      if (data && data.length > 0) {
        // Converte array [{colaborador_nome, uf}] → objeto {nome: uf}
        const mapaEstados = {};
        data.forEach(row => { mapaEstados[row.colaborador_nome] = row.uf; });
        localStorage.setItem('mapa_estados_pitstop', JSON.stringify(mapaEstados));
        console.log('✅ Mapa: carregados', data.length, 'mapeamentos do Supabase');
        return mapaEstados;
      } else {
        return usarCacheMapaEstados();
      }
    } catch (e) {
      console.error('❌ Mapa: erro ao carregar estados:', e.message);
      return usarCacheMapaEstados();
    }
  }

  function usarCacheMapaEstados() {
    const cache = JSON.parse(localStorage.getItem('mapa_estados_pitstop') || '{}');
    if (Object.keys(cache).length > 0) {
      console.log('📦 Mapa: usando cache local —', Object.keys(cache).length, 'mapeamentos');
      return cache;
    }
    return {};
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. INICIALIZAR FLAGS PIT STOP (permanece em localStorage)
  // ═══════════════════════════════════════════════════════════════

  function initializeFlags() {
    const colaboradores = JSON.parse(localStorage.getItem('pitstop_colaboradores') || '[]');
    const currentFlags  = JSON.parse(localStorage.getItem('pitstop_flags') || '{}');
    let updated = false;

    colaboradores.forEach(c => {
      if (!currentFlags[c.nome]) {
        currentFlags[c.nome] = {
          off: false, ferias: false, atestado: false,
          saida_ant: false, atraso: false, atraso_min: 0,
          rodizio: false, chat: false
        };
        updated = true;
      }
    });

    if (updated) {
      localStorage.setItem('pitstop_flags', JSON.stringify(currentFlags));
      console.log('✅ Flags inicializadas para', colaboradores.length, 'colaboradores');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. ORQUESTRADOR PRINCIPAL
  // ═══════════════════════════════════════════════════════════════

  async function inicializar() {
    // Aguarda o Supabase estar disponível (pode demorar alguns ms)
    await esperarSupabase();

    // Carrega em paralelo
    const [pevColabs, mapaEstados] = await Promise.all([
      carregarPevColaboradores(),
      carregarMapaEstados(),
    ]);

    // Inicializa flags (síncrono, usa localStorage do pitstop)
    setTimeout(initializeFlags, 100);

    // Notifica gestao-pev.js para recarregar com os novos dados
    if (pevColabs.length > 0) {
      window.dispatchEvent(new CustomEvent('pev-data-ready', {
        detail: { colaboradores: pevColabs, timestamp: Date.now() }
      }));
    }

    // Notifica mapa
    if (typeof window.MapaBrasil_refresh === 'function') {
      setTimeout(window.MapaBrasil_refresh, 200);
    }

    // Marca módulos como prontos
    window.SystemData.markReady('pitstop');
    setTimeout(() => window.SystemData.markReady('pev'), 150);

    console.log('✅ Sistema de inicialização concluído');
    console.groupEnd();
  }

  // Aguarda até o cliente Supabase aparecer no window (máx 3s)
  function esperarSupabase() {
    return new Promise(resolve => {
      if (typeof supa !== 'undefined' && supa) return resolve();
      let tentativas = 0;
      const timer = setInterval(() => {
        tentativas++;
        if ((typeof supa !== 'undefined' && supa) || tentativas >= 30) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. PAINEL DE DEBUG (CTRL + SHIFT + D)
  // ═══════════════════════════════════════════════════════════════

  function createDebugPanel() {
    if (document.getElementById('system-debug-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'system-debug-panel';
    panel.style.cssText = `
      position:fixed;top:60px;right:20px;width:400px;max-height:80vh;
      background:rgba(13,13,26,0.98);border:1px solid rgba(245,200,66,0.3);
      border-radius:16px;padding:20px;z-index:999999;overflow-y:auto;
      box-shadow:0 12px 48px rgba(0,0,0,0.6);font-family:'DM Sans',sans-serif;
      color:#fff;display:none;
    `;
    const data = window.SystemData.getData();
    const supaOk = !!getSupabase();
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 style="margin:0;font-size:14px;font-weight:700;color:#f5c842">🐛 Painel de Debug</h3>
        <button onclick="this.parentElement.parentElement.style.display='none'"
                style="background:transparent;border:none;color:rgba(255,255,255,0.4);font-size:18px;cursor:pointer">✕</button>
      </div>
      <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:8px">CONEXÃO</div>
        <div style="font-size:12px">
          Supabase: <strong style="color:${supaOk?'#4ade80':'#f87171'}">${supaOk?'✅ Conectado':'❌ Offline (usando cache)'}</strong>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:8px">STATUS DOS MÓDULOS</div>
        ${Object.entries(window.SystemData.ready).map(([k,v])=>`
          <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;margin-bottom:4px">
            <span>${k.toUpperCase()}</span>
            <span style="color:${v?'#4ade80':'#f87171'}">${v?'✅':'❌'}</span>
          </div>`).join('')}
      </div>
      <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:8px">DADOS CARREGADOS</div>
        <div style="font-size:12px;line-height:1.8">
          <div>PIT STOP Colaboradores: <strong>${data.pitstop.colaboradores.length}</strong></div>
          <div>PIT STOP Flags: <strong>${Object.keys(data.pitstop.flags).length}</strong></div>
          <div>PEV Colaboradores: <strong>${data.pev.colaboradores.length}</strong></div>
          <div>PEV Importações: <strong>${data.pev.importacoes.length}</strong></div>
          <div>Mapa Estados: <strong>${Object.keys(data.mapa.estados).length}</strong></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <button onclick="location.reload()"
                style="flex:1;background:#4ade80;color:#000;border:none;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer">
          🔄 Recarregar
        </button>
        <button onclick="if(confirm('Resetar cache local? Os dados do Supabase serão mantidos.')){localStorage.clear();location.reload()}"
                style="flex:1;background:#f87171;color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer">
          🗑️ Limpar Cache
        </button>
      </div>
      <button onclick="console.log('DUMP:', window.SystemData.getData())"
              style="width:100%;background:rgba(245,200,66,0.1);color:#f5c842;border:1px solid rgba(245,200,66,0.2);border-radius:8px;padding:8px 12px;font-size:12px;font-weight:600;cursor:pointer">
        📋 Log Dados Completos
      </button>
    `;
    document.body.appendChild(panel);
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      const panel = document.getElementById('system-debug-panel');
      if (!panel) { createDebugPanel(); document.getElementById('system-debug-panel').style.display = 'block'; }
      else panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. MONITORAMENTO DE ERROS
  // ═══════════════════════════════════════════════════════════════

  window.addEventListener('error', (e) => {
    console.error('🔴 Erro:', e.message, '|', e.filename, 'linha', e.lineno);
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. FUNÇÃO DE TESTE
  // ═══════════════════════════════════════════════════════════════

  window.testSystem = function() {
    console.group('🧪 TESTE DO SISTEMA');
    const data = window.SystemData.getData();
    console.log('Supabase:', getSupabase() ? '✅ Conectado' : '❌ Offline');
    console.log('PIT STOP Colaboradores:', data.pitstop.colaboradores.length);
    console.log('PEV Colaboradores:', data.pev.colaboradores.length);
    console.log('Estados Mapeados:', Object.keys(data.mapa.estados).length);
    console.log('Módulos prontos?', window.SystemData.isAllReady() ? '✅' : '⏳');
    console.groupEnd();
  };

  // ── Inicia ────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }

  console.log('💡 CTRL+SHIFT+D → painel de debug | window.testSystem() → teste rápido');

})();
