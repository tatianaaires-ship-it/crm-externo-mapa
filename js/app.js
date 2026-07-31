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

  /* ---- Faixa da visita em andamento (SPEC 07 §2.4) ---------------------------
     O check-in aberto só existia DENTRO do sheet do pin: fechado o sheet — ou o
     app, já que o estado persiste no localStorage —, a visita em curso não tinha
     sintoma nenhum na tela. A faixa é o sintoma, e é a saída: tocar leva ao
     check-out. Sem ela, o bloqueio de segundo check-in seria beco sem saída. */
  let checkinTimer = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function hhmm(d) {
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* Rótulo do tempo aberto — e o critério de ESQUECIDO, que é o que pinta a
     faixa de âmbar: passou de 8h, ou o check-in é de outro dia. Nos dois casos a
     duração que o check-out vai gravar já não é tempo de campo, e é ela que a
     Gerencial mostra. De outro dia a faixa diz DESDE QUANDO em vez de "há 19h":
     o que importa não é o número, é que a visita atravessou a virada do dia. */
  const STALE_MIN = 8 * 60;
  function labelAberto(t, agora) {
    const ini = new Date(t.checkinEm);
    const min = Math.max(0, Math.round((agora - ini) / 60000));
    if (ini.toDateString() !== agora.toDateString()) {
      const ontem = new Date(agora.getTime() - 86400000);
      const quando = ini.toDateString() === ontem.toDateString()
        ? 'ontem'
        : String(ini.getDate()).padStart(2, '0') + '/' + String(ini.getMonth() + 1).padStart(2, '0');
      return { txt: 'aberto desde ' + quando + ', ' + hhmm(ini), stale: true };
    }
    const dur = min < 60 ? 'há ' + min + ' min'
      : 'há ' + Math.floor(min / 60) + 'h' + (min % 60 ? String(min % 60).padStart(2, '0') : '');
    return { txt: 'check-in ' + dur, stale: min >= STALE_MIN };
  }

  function renderCheckinBanner() {
    const el = $('checkin-banner'), txt = $('checkin-banner-txt');
    if (!el || !txt) return;
    const t = window.CRM_STATE.checkinAberto();
    if (!t) {
      el.classList.remove('is-visible', 'is-stale');
      document.body.classList.remove('checkin-open');
      if (checkinTimer) { clearInterval(checkinTimer); checkinTimer = null; }
      return;
    }
    const p = window.CRM_STATE.getById(t.estabelecimentoId);
    const info = labelAberto(t, new Date());
    txt.innerHTML = '<strong>' + esc(p ? p.name : 'Ponto') + '</strong> · ' + info.txt;
    el.classList.add('is-visible');
    el.classList.toggle('is-stale', info.stale);
    /* A faixa não cede o rodapé a ninguém (é a única saída do bloqueio de 2º
       check-in), então quem chega depois sobe. Hoje só o painel de montar rota
       divide esse canto — daí a classe no body, que é o que o CSS consegue ler. */
    document.body.classList.add('checkin-open');
    // O minuto tem que andar sozinho: ninguém recarrega a tela para ver o tempo
    // de campo subir, e é justamente ele que faz a faixa envelhecer.
    if (!checkinTimer) checkinTimer = setInterval(renderCheckinBanner, 60000);
  }

  function irParaVisitaAberta() {
    const t = window.CRM_STATE.checkinAberto();
    if (!t) return renderCheckinBanner();      // sumiu no meio do caminho
    showTab('map');
    /* Mesma regra da busca (SPEC 00 §6.2c): filtro que esconde o ponto não é
       mexido — o ponto entra como EXCEÇÃO VISÍVEL. Aqui vale ainda mais: a
       visita está acontecendo, e destruir o recorte de quem está usando o app
       para chegar até ela seria cobrar um preço que ninguém pediu. */
    const p = window.CRM_STATE.getById(t.estabelecimentoId);
    if (p && window.CRM_FILTERS && !window.CRM_FILTERS.matches(p)) {
      window.CRM_MAP.revelar(t.estabelecimentoId);
    }
    window.CRM_MAP.focus(t.estabelecimentoId, 17, false);
    window.CRM_PIN.abrirCheckout(t.estabelecimentoId);
  }

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
    /* Modo do MAPA acaba ao sair do mapa. Deixá-lo de pé por baixo de outra aba
       criava um estado invisível: voltar depois de tocar um card do Funil (que
       abre o pin direto) daria sheet aberto com o modo ligado atrás. */
    if (which !== 'map' && window.CRM_ROTA && window.CRM_ROTA.isMontando()) {
      window.CRM_ROTA.cancel();
    }
    document.body.classList.toggle('view-funil', which === 'funil');
    document.body.classList.toggle('view-ativ', which === 'ativ');
    document.body.classList.toggle('view-intel', which === 'intel');
    [['tab-map', 'map'], ['tab-funil', 'funil'], ['tab-ativ', 'ativ'], ['tab-intel', 'intel']].forEach(function (pair) {
      const el = $(pair[0]); if (!el) return;
      const on = which === pair[1];
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', String(on));
    });
    /* A aba que aparece constrói agora, se estiver suja. Enquanto escondida ela
       não renderiza (filters.js) — é o que tira 155 dos 162ms de cada toque de
       chip com dado real. Vem ANTES do invalidateSize: quem aparece tem que
       estar em dia antes de qualquer medida de layout. */
    if (window.CRM_FILTERS && window.CRM_FILTERS.renderizarSeSuja) {
      window.CRM_FILTERS.renderizarSeSuja(which);
    }

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

    const ckb = $('checkin-banner');
    if (ckb) ckb.addEventListener('click', irParaVisitaAberta);

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

    // Esc fecha o overlay ativo (sheet de rota > modal de criar > filtros) e,
    // por último, sai do modo de montar rota — o modo é o mais externo dos três.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if ($('rota-modal').classList.contains('is-open')) { $('btn-rota-modal-cancel').click(); }
      else if ($('create-modal').classList.contains('is-open')) { window.CRM_CREATE.cancel(); }
      else if ($('filter-panel').classList.contains('is-open')) { closeFilters(); }
      else if (window.CRM_ROTA.isMontando()) { window.CRM_ROTA.cancel(); }
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
    window.CRM_ROTA.init({ showTab: showTab });
    // Inteligência e Funil antes do primeiro reapply (reapply → refresh das abas).
    window.CRM_INTEL.init({ showMap: function () { showTab('map'); } });
    window.CRM_FUNIL.init({ showMap: function () { showTab('map'); } });
    window.CRM_ATIV.init({ showMap: function () { showTab('map'); } });

    window.CRM_MAP.onSelect(function (id) {
      /* Montando rota, o toque no pin ESCOLHE em vez de abrir o sheet — é o que
         faz a montagem ser um toque por parada. Abrir o sheet aqui custaria
         quatro gestos por ponto (abrir, adicionar, fechar, panorâmica). */
      if (window.CRM_ROTA && window.CRM_ROTA.isMontando()) { window.CRM_ROTA.toggle(id); return; }
      if (window.CRM_CREATE && window.CRM_CREATE.isPlacing()) window.CRM_CREATE.cancel();
      window.CRM_PIN.open(id);
    });
    window.CRM_FILTERS.init({ getSelectedId: window.CRM_PIN.currentId });

    window.CRM_STATE.onChange(function () {
      window.CRM_FILTERS.reapply();
      window.CRM_PIN.refresh();
      renderCheckinBanner();
    });

    window.CRM_FILTERS.reapply();
    // Na carga: o estado persiste, então a visita aberta pode ser de outra
    // sessão — de ontem, inclusive. É o caso que motivou a faixa.
    renderCheckinBanner();
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
