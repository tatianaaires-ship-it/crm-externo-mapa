/* =====================================================================
   auth.js — Porteiro (cliente). Login Google (@praso.com.br) → busca o
   snapshot real no Worker → troca o dataset do mapa (via CRM_STATE).
   Sem config preenchida, não faz nada (app segue fictício e público).
   Contrato: docs/snapshot-dado-real.md · backend: porteiro/worker.js
   ===================================================================== */
(function () {
  'use strict';

  const cfg = window.CRM_CONFIG || {};
  const CLIENT_ID = (cfg.GOOGLE_CLIENT_ID || '').trim();
  const WORKER_URL = (cfg.WORKER_URL || '').trim();
  const GIS_SRC = 'https://accounts.google.com/gsi/client';

  // Sem porteiro configurado → mantém o protótipo fictício, sem UI de login.
  if (!CLIENT_ID || !WORKER_URL) return;

  function toast(msg) {
    const t = document.getElementById('toast');
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

  function makeSlot() {
    const actions = document.querySelector('.topbar__actions');
    if (!actions) return null;
    const slot = document.createElement('span');
    slot.id = 'auth-slot';
    slot.className = 'auth-slot';
    actions.insertBefore(slot, actions.firstChild);
    return slot;
  }

  function showBadge(slot, email) {
    slot.innerHTML = '';
    const b = document.createElement('span');
    b.className = 'auth-badge';
    b.title = 'Dados reais — ' + email;
    b.textContent = '● Dados reais';
    slot.appendChild(b);
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
      const slot = document.getElementById('auth-slot');
      if (slot) showBadge(slot, emailFromToken(idToken));
      toast(pins.length + ' locais reais carregados.');
    } catch (e) {
      toast('Erro de rede ao falar com o porteiro.');
      console.error(e);
    }
  }

  function initGis(slot) {
    if (!window.google || !google.accounts || !google.accounts.id) return;
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: onCredential,
      auto_select: false,
      hd: 'praso.com.br'
    });
    google.accounts.id.renderButton(slot, {
      type: 'standard', theme: 'outline', size: 'small',
      text: 'signin', shape: 'pill'
    });
  }

  function loadGis(slot) {
    const s = document.createElement('script');
    s.src = GIS_SRC; s.async = true; s.defer = true;
    s.onload = function () { initGis(slot); };
    s.onerror = function () { toast('Não consegui carregar o login do Google.'); };
    document.head.appendChild(s);
  }

  function start() {
    const slot = makeSlot();
    if (slot) loadGis(slot);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
