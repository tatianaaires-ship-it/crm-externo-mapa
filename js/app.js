/* =====================================================================
   app.js — Bootstrap: monta módulos, wiring de UI, PWA (SW + install).
   ===================================================================== */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  let toastTimer = null;
  function showToast(msg) {
    const t = $('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-visible'); }, 3200);
  }
  window.CRM_TOAST = showToast;   // usado por funil.js / atividades.js

  function openFilters() {
    $('filter-panel').classList.add('is-open');
    $('filter-backdrop').classList.add('is-open');
  }
  function closeFilters() {
    $('filter-panel').classList.remove('is-open');
    $('filter-backdrop').classList.remove('is-open');
  }

  /* ---- Abas Mapa / Funil / Atividades / Inteligência (filtros compartilhados).
          4 abas desde a fatia Tarefa (SPEC 00 §5.2 / SPEC 07 §4). ---- */
  function showTab(which) {
    document.body.classList.toggle('view-funil', which === 'funil');
    document.body.classList.toggle('view-ativ', which === 'ativ');
    document.body.classList.toggle('view-intel', which === 'intel');
    [['tab-map', 'map'], ['tab-funil', 'funil'], ['tab-ativ', 'ativ'], ['tab-intel', 'intel']].forEach(function (pair) {
      const el = $(pair[0]); if (!el) return;
      const on = which === pair[1];
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', String(on));
    });
    if (which === 'map') {
      // Volta pro mapa: Leaflet precisa recalcular o tamanho do container.
      setTimeout(function () { window.CRM_MAP.getMap().invalidateSize(); }, 50);
    }
  }

  function wireUI() {
    $('btn-filters').addEventListener('click', openFilters);
    $('btn-close-filters').addEventListener('click', closeFilters);
    $('filter-backdrop').addEventListener('click', closeFilters);

    $('tab-map').addEventListener('click', function () { showTab('map'); });
    $('tab-funil').addEventListener('click', function () { showTab('funil'); });
    $('tab-ativ').addEventListener('click', function () { showTab('ativ'); });
    $('tab-intel').addEventListener('click', function () { showTab('intel'); });

    $('btn-empty-clear').addEventListener('click', function () {
      window.CRM_FILTERS.clearAll();
    });

    $('btn-move-done').addEventListener('click', function () {
      window.CRM_MAP.endMove();
    });

    // Minha localização (geolocalização do dispositivo)
    const locBtn = $('fab-locate');
    if (locBtn) {
      locBtn.addEventListener('click', function () {
        if (!('geolocation' in navigator)) {
          showToast('Este dispositivo não expõe geolocalização.');
          return;
        }
        locBtn.classList.add('is-locating');
        window.CRM_MAP.locateMe();
      });
      window.CRM_MAP.onLocateFound(function () { locBtn.classList.remove('is-locating'); });
      window.CRM_MAP.onLocateError(function () {
        locBtn.classList.remove('is-locating');
        showToast('Não consegui pegar sua localização. Verifique a permissão de GPS.');
      });
    }

    $('btn-reset').addEventListener('click', function () {
      if (window.confirm('Resetar o demo? Isso volta ao conjunto original de locais (perde pins criados, notas e check-ins desta sessão).')) {
        window.CRM_PIN.close();
        window.CRM_STATE.resetDemo();
      }
    });

    // Esc fecha o overlay ativo (modal de criar > painel de filtros).
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if ($('create-modal').classList.contains('is-open')) { window.CRM_CREATE.cancel(); }
      else if ($('filter-panel').classList.contains('is-open')) { closeFilters(); }
    });

    // Swipe-to-dismiss (mobile) nos bottom sheets — "sheet arrastável".
    enableSwipeDown($('pin-sheet'), function () { window.CRM_PIN.close(); });
    enableSwipeDown($('filter-panel'), closeFilters);

    // Recalcula o tamanho do mapa quando o layout muda.
    window.addEventListener('resize', function () { window.CRM_MAP.getMap().invalidateSize(); });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { window.CRM_MAP.getMap().invalidateSize(); }, 300);
    });
  }

  // Arrastar o sheet para baixo (só no layout mobile, onde o transform é translateY puro).
  function enableSwipeDown(el, closeFn) {
    if (!el) return;
    let startY = null, dy = 0, dragging = false;
    function isMobile() { return window.matchMedia('(max-width: 619px)').matches; }
    function down(e) {
      if (!isMobile() || !el.classList.contains('is-open')) return;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const top = el.getBoundingClientRect().top;
      if (y - top > 92) return; // só a faixa do topo (handle/cabeçalho)
      startY = y; dy = 0; dragging = true; el.style.transition = 'none';
    }
    function move(e) {
      if (!dragging) return;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      dy = Math.max(0, y - startY);
      el.style.transform = 'translateY(' + dy + 'px)';
    }
    function up() {
      if (!dragging) return;
      dragging = false; el.style.transition = ''; el.style.transform = '';
      if (dy > 100) closeFn();
    }
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', up);
    el.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  /* ---- PWA: instalação ---- */
  let deferredPrompt = null;
  function wireInstall() {
    const toast = $('install-toast');
    const btn = $('btn-install');
    const dismiss = $('btn-install-dismiss');

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    function showToast() { toast.classList.add('is-visible'); document.body.classList.add('install-open'); }
    function hideToast() { toast.classList.remove('is-visible'); document.body.classList.remove('install-open'); }

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (sessionStorage.getItem('install-dismissed')) return;
      setTimeout(showToast, 1500);
    });

    btn.addEventListener('click', function () {
      hideToast();
      if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; }
    });
    dismiss.addEventListener('click', function () {
      hideToast();
      sessionStorage.setItem('install-dismissed', '1');
    });
    window.addEventListener('appinstalled', hideToast);
  }

  /* ---- PWA: service worker ---- */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) {
        console.warn('SW não registrado:', e);
      });
    });
  }

  function boot() {
    window.CRM_STATE.load();
    window.CRM_MAP.init();
    window.CRM_PIN.init();
    window.CRM_CREATE.init();
    // Inteligência e Funil antes do primeiro reapply (reapply → refresh das abas).
    window.CRM_INTEL.init({ showMap: function () { showTab('map'); } });
    window.CRM_FUNIL.init({ showMap: function () { showTab('map'); } });
    window.CRM_ATIV.init({ showMap: function () { showTab('map'); } });

    window.CRM_MAP.onSelect(function (id) {
      if (window.CRM_CREATE && window.CRM_CREATE.isPlacing()) window.CRM_CREATE.cancel();
      window.CRM_PIN.open(id);
    });
    window.CRM_FILTERS.init({ getSelectedId: window.CRM_PIN.currentId });

    window.CRM_STATE.onChange(function () {
      window.CRM_FILTERS.reapply();
      window.CRM_PIN.refresh();
    });

    window.CRM_FILTERS.reapply();
    wireUI();
    wireInstall();
    registerSW();

    setTimeout(function () { window.CRM_MAP.getMap().invalidateSize(); }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
