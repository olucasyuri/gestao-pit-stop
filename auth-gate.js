/* ==========================================================================
   auth-gate.js — Porteiro de acesso (Supabase Auth)
   --------------------------------------------------------------------------
   • Mostra uma tela de login em tela cheia e bloqueia o app até autenticar.
   • Compartilha a MESMA sessão do cliente Supabase do app (mesmo projeto),
     então depois de logar, todas as chamadas .from(...) passam a ser
     autenticadas e o RLS libera o acesso.
   • Faz um wrapper em window.fetch: anexa automaticamente o token de sessão
     (Authorization: Bearer ...) em TODA chamada para /api/*, sem precisar
     editar as centenas de fetch() espalhados pelo código.

   IMPORTANTE: este script DEVE ser carregado DEPOIS do supabase-js (CDN) e
   ANTES de gestao-pitstop.js. Veja o index.html.
   ========================================================================== */
(function () {
  "use strict";

  // Mesmas credenciais públicas do app (a chave anon pode ser pública).
  var SUPABASE_URL = "https://ffzzkjkhwylbskfxwmfc.supabase.co";
  var SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmenpramtod3lsYnNrZnh3bWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MjYxMTQsImV4cCI6MjA5MzQwMjExNH0._J7yVV2_0IQbz5quIt-nIrH5-Wej9tVCDIed3DKxBhE";

  if (!window.supabase || !window.supabase.createClient) {
    console.error("[auth-gate] supabase-js não carregou antes do auth-gate.");
    return;
  }

  // Cliente próprio do gate. Como a URL do projeto é a mesma, a sessão é
  // gravada na MESMA chave do localStorage que o cliente do app usa — eles
  // compartilham o login automaticamente.
  var gate = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Token em memória, atualizado a cada mudança de sessão. Usado pelo wrapper
  // de fetch para anexar Authorization nas chamadas /api/*.
  var currentToken = null;

  /* ---- Wrapper de fetch: injeta o Bearer token em chamadas /api/* ---- */
  var _origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var isApi =
        url.indexOf("/api/") === 0 ||
        url.indexOf(window.location.origin + "/api/") === 0;

      if (isApi && currentToken) {
        init = init || {};
        var headers = new Headers((init && init.headers) || (typeof input !== "string" && input.headers) || {});
        // Não sobrescreve um secret/bearer já definido manualmente.
        if (!headers.has("Authorization") && !headers.has("x-api-secret")) {
          headers.set("Authorization", "Bearer " + currentToken);
        }
        init.headers = headers;
      }
    } catch (e) {
      /* se algo der errado, segue a chamada original sem alterar */
    }
    return _origFetch(input, init);
  };

  /* ---- UI: overlay de login ---- */
  function montarOverlay() {
    if (document.getElementById("ps-auth-overlay")) return;
    var el = document.createElement("div");
    el.id = "ps-auth-overlay";
    el.innerHTML = [
      '<style>',
      '#ps-auth-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;',
      'align-items:center;justify-content:center;background:#0e1116;',
      "font-family:'DM Sans',system-ui,sans-serif;}",
      '#ps-auth-card{width:min(92vw,380px);background:#171b22;border:1px solid #262c36;',
      'border-radius:16px;padding:32px 28px;box-shadow:0 20px 60px rgba(0,0,0,.5);}',
      '#ps-auth-card h1{margin:0 0 4px;font-size:20px;color:#f2f5f9;font-weight:700;',
      "font-family:'Outfit',sans-serif;}",
      '#ps-auth-card p{margin:0 0 22px;font-size:13px;color:#8b93a1;}',
      '#ps-auth-card label{display:block;font-size:12px;color:#aab2bf;margin:14px 0 6px;}',
      '#ps-auth-card input{width:100%;box-sizing:border-box;padding:11px 13px;border-radius:10px;',
      'border:1px solid #2c333f;background:#0e1116;color:#f2f5f9;font-size:14px;outline:none;}',
      '#ps-auth-card input:focus{border-color:#4f8cff;}',
      '#ps-auth-btn{width:100%;margin-top:22px;padding:12px;border:0;border-radius:10px;',
      'background:#4f8cff;color:#fff;font-size:14px;font-weight:600;cursor:pointer;}',
      '#ps-auth-btn:disabled{opacity:.6;cursor:default;}',
      '#ps-auth-msg{min-height:18px;margin-top:14px;font-size:12.5px;color:#ff6b6b;text-align:center;}',
      '</style>',
      '<div id="ps-auth-card" role="dialog" aria-modal="true">',
      '  <h1>Gestão PIT STOP</h1>',
      '  <p>Acesso restrito. Entre com suas credenciais.</p>',
      '  <label for="ps-auth-email">E-mail</label>',
      '  <input id="ps-auth-email" type="email" autocomplete="username" placeholder="voce@empresa.com" />',
      '  <label for="ps-auth-pass">Senha</label>',
      '  <input id="ps-auth-pass" type="password" autocomplete="current-password" placeholder="••••••••" />',
      '  <button id="ps-auth-btn" type="button">Entrar</button>',
      '  <div id="ps-auth-msg"></div>',
      '</div>'
    ].join("");
    document.documentElement.appendChild(el);

    var email = el.querySelector("#ps-auth-email");
    var pass = el.querySelector("#ps-auth-pass");
    var btn = el.querySelector("#ps-auth-btn");
    var msg = el.querySelector("#ps-auth-msg");

    function entrar() {
      msg.style.color = "#ff6b6b";
      msg.textContent = "";
      var e = (email.value || "").trim();
      var p = pass.value || "";
      if (!e || !p) { msg.textContent = "Preencha e-mail e senha."; return; }
      btn.disabled = true;
      btn.textContent = "Entrando…";
      gate.auth.signInWithPassword({ email: e, password: p }).then(function (r) {
        if (r.error) {
          btn.disabled = false;
          btn.textContent = "Entrar";
          msg.textContent =
            r.error.message && /invalid/i.test(r.error.message)
              ? "E-mail ou senha incorretos."
              : (r.error.message || "Falha ao entrar.");
          return;
        }
        msg.style.color = "#37d67a";
        msg.textContent = "Acesso liberado. Carregando…";
        // Recarrega para o app inicializar já autenticado (sessão no storage).
        setTimeout(function () { window.location.reload(); }, 350);
      });
    }

    btn.addEventListener("click", entrar);
    pass.addEventListener("keydown", function (ev) { if (ev.key === "Enter") entrar(); });
    email.addEventListener("keydown", function (ev) { if (ev.key === "Enter") pass.focus(); });
    setTimeout(function () { email.focus(); }, 60);
  }

  function removerOverlay() {
    var el = document.getElementById("ps-auth-overlay");
    if (el) el.remove();
  }

  /* ---- Botão "Sair" injetado no canto ---- */
  function montarBotaoSair() {
    if (document.getElementById("ps-logout-btn")) return;
    var b = document.createElement("button");
    b.id = "ps-logout-btn";
    b.type = "button";
    b.textContent = "Sair";
    b.style.cssText =
      "position:fixed;bottom:16px;right:16px;z-index:2147483000;padding:8px 14px;" +
      "border:1px solid #2c333f;border-radius:10px;background:#171b22;color:#aab2bf;" +
      "font:600 12px 'DM Sans',sans-serif;cursor:pointer;opacity:.85;";
    b.addEventListener("click", function () {
      gate.auth.signOut().then(function () { window.location.reload(); });
    });
    document.body.appendChild(b);
  }

  /* ---- Boot: decide entre login e app ---- */
  function ready(fn) {
    if (document.body) fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  gate.auth.getSession().then(function (r) {
    var session = r && r.data ? r.data.session : null;
    currentToken = session ? session.access_token : null;

    if (!session) {
      ready(montarOverlay);
    } else {
      ready(montarBotaoSair);
    }
  });

  // Mantém o token atualizado (refresh automático do Supabase).
  gate.auth.onAuthStateChange(function (_event, session) {
    currentToken = session ? session.access_token : null;
  });
})();
