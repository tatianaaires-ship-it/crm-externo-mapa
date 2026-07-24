/* =====================================================================
   auth.js — Porteiro (cliente). Tela de entrada (#login-gate) com login
   Google (@praso.com.br) → busca o snapshot real no Worker → troca o
   dataset do mapa. "Seguir sem login" segue no fictício (público).
   Sem config preenchida, a tela não aparece (app 100% fictício).
   Contrato: docs/snapshot-dado-real.md · backend: porteiro/worker.js
   ===================================================================== */
(function () {
  'use strict';

  const cfg = window.CRM_CONFIG || {};
  const CLIENT_ID = (cfg.GOOGLE_CLIENT_ID || '').trim();
  const WORKER_URL = (cfg.WORKER_URL || '').trim();
  const GIS_SRC = 'https://accounts.google.com/gsi/client';
  const SKIP_KEY = 'praso-gate-skip';
  const configured = !!(CLIENT_ID && WORKER_URL);

  let gisReady = false;

  function $(id) { return document.getElementById(id); }
  function gate() { return $('login-gate'); }

  function toast(msg) {
    const t = $('toast');
    if (!t) { console.log(msg); return; }
    t.textContent = msg; t.classList.add('is-visible');
    setTimeout(function () { t.classList.remove('is-visible'); }, 3600);
  }

  function emailFromToken(jwt) {
    try {
      const p = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(p)))).email || '';
    } catch (e) { return ''; }
  }

  function openGate() { const g = gate(); if (g) g.classList.remove('is-hidden'); renderGoogleButton(); }
  function closeGate() { const g = gate(); if (g) g.classList.add('is-hidden'); }

  /* ---- Slot no topo: badge "Dados reais" ou botão "Entrar" ---- */
  function topbarSlot() {
    let slot = $('auth-slot');
    if (slot) return slot;
    const actions = document.querySelector('.topbar__actions');
    if (!actions) return null;
    slot = document.createElement('span');
    slot.id = 'auth-slot'; slot.className = 'auth-slot';
    actions.insertBefore(slot, actions.firstChild);
    return slot;
  }
  function showEntrar() {
    const slot = topbarSlot(); if (!slot) return;
    slot.innerHTML = '';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'auth-entrar'; b.textContent = 'Entrar';
    b.addEventListener('click', openGate);
    slot.appendChild(b);
  }
  function showBadge(email) {
    const slot = topbarSlot(); if (!slot) return;
    slot.innerHTML = '';
    const b = document.createElement('span');
    b.className = 'auth-badge';
    b.title = 'Dados reais — ' + email;
    b.textContent = '● Dados reais';
    slot.appendChild(b);
  }

  /* ---- Google Identity Services ---- */
  function renderGoogleButton() {
    if (!gisReady) return;                       // será chamado de novo no initGis
    const host = $('login-gate-btn'); if (!host) return;
    const g = gate();
    if (g && g.classList.contains('is-hidden')) return; // só renderiza quando visível
    google.accounts.id.renderButton(host, {
      type: 'standard', theme: 'filled_blue', size: 'large',
      text: 'signin_with', shape: 'pill', logo_alignment: 'center'
    });
  }

  async function onCredential(resp) {
    const idToken = resp && resp.credential;
    if (!idToken) { toast('Login não retornou credencial.'); return; }
    toast('Carregando dados reais…');
    try {
      const r = await fetch(WORKER_URL, { headers: { Authorization: 'Bearer ' + idToken } });
      if (r.status === 401) { toast('Acesso negado — use uma conta @praso.com.br.'); return; }
      if (!r.ok) { toast('Falha ao carregar (' + r.status + ').'); return; }
      const pins = await r.json();
      if (!Array.isArray(pins) || !pins.length) { toast('Snapshot vazio.'); return; }
      window.CRM_STATE.useRealData(pins);
      try { sessionStorage.removeItem(SKIP_KEY); } catch (e) {}
      closeGate();
      showBadge(emailFromToken(idToken));
      toast(pins.length + ' locais reais carregados.');
    } catch (e) {
      toast('Erro de rede ao falar com o porteiro.');
      console.error(e);
    }
  }

  function initGis() {
    if (!(window.google && google.accounts && google.accounts.id)) return;
    google.accounts.id.initialize({
      client_id: CLIENT_ID, callback: onCredential, auto_select: false, hd: 'praso.com.br'
    });
    gisReady = true;
    renderGoogleButton();
  }
  function loadGis() {
    const s = document.createElement('script');
    s.src = GIS_SRC; s.async = true; s.defer = true;
    s.onload = initGis;
    s.onerror = function () { toast('Não consegui carregar o login do Google.'); };
    document.head.appendChild(s);
  }

  function skip() {
    try { sessionStorage.setItem(SKIP_KEY, '1'); } catch (e) {}
    closeGate();
    showEntrar();
  }

  function start() {
    // "Seguir sem login" é ligado ANTES de tudo (nunca deixa o usuário preso na tela).
    const sb = $('btn-skip-login');
    if (sb) sb.addEventListener('click', skip);

    if (!configured) { closeGate(); return; }   // build sem porteiro → direto ao fictício

    loadGis();
    let skipped = false;
    try { skipped = sessionStorage.getItem(SKIP_KEY) === '1'; } catch (e) {}
    if (skipped) { closeGate(); showEntrar(); }  // já escolheu demo nesta sessão
    else { openGate(); }                          // abre já na tela de login
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
