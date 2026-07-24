/* =====================================================================
   funil.js — Aba "Funil" (Kanban por status).
   - Colunas = os 4 status do lead (CRM_DATA.STATUS), na ordem do funil.
   - Recebe o MESMO conjunto filtrado do mapa (CRM_FILTERS.reapply → refresh).
   - Arrastar card entre colunas move o status EM MEMÓRIA (casca — ver
     nota de domínio em state.js: no produto real o status anda por fluxo).
   - Tocar (sem arrastar) num card foca o pin no mapa.
   - Drag por Pointer Events → funciona em touch (Android) e mouse.
   ===================================================================== */
(function () {
  'use strict';

  const D = window.CRM_DATA;
  const S = window.CRM_STATE;

  let boardEl, countEl, emptyEl;
  let lastList = [];
  let showMap = function () {};

  // Ordem do funil = ordem de inserção em CRM_DATA.STATUS.
  const ORDER = Object.keys(D.STATUS);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cityOf(p) {
    const meta = D.ZONE_META[p.zone];
    return meta ? meta.city + '/' + meta.uf : (p.zone || '');
  }

  function cardHtml(p) {
    const origin = D.ORIGINS[p.origin] || { color: '#94a3b8' };
    const typ = D.TYPOLOGIES[p.typology] || { emoji: '📍', label: p.typology };
    const qual = D.QUALIDADE[p.qualidade] || { emoji: '', label: p.qualidade, color: '#64748b', ink: '#334155' };
    const seal = p.origin === 'validado_campo' ? '✓' : '';
    return (
      '<div class="funil-card" draggable="false" data-id="' + esc(p.id) + '" data-status="' + esc(p.status) + '">' +
        '<div class="funil-card__top">' +
          '<span class="funil-card__dot funil-card__dot--' + esc(p.origin) + '" style="--pin:' + origin.color + '" aria-hidden="true">' + seal + '</span>' +
          '<span class="funil-card__name">' + typ.emoji + ' ' + esc(p.name) + '</span>' +
        '</div>' +
        '<div class="funil-card__sub">' +
          '<span class="funil-card__zone">' + esc(cityOf(p)) + '</span>' +
          '<span class="badge badge--q-' + esc(p.qualidade) + '" style="--c:' + qual.color + ';--ci:' + qual.ink + '">' + qual.emoji + ' ' + esc(qual.label) + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  function render() {
    if (!boardEl) return;
    const byStatus = {};
    ORDER.forEach(function (k) { byStatus[k] = []; });
    lastList.forEach(function (p) { (byStatus[p.status] || (byStatus[p.status] = [])).push(p); });

    if (countEl) countEl.textContent = lastList.length + (lastList.length === 1 ? ' lead' : ' leads');
    if (emptyEl) emptyEl.classList.toggle('is-visible', lastList.length === 0);

    boardEl.innerHTML = ORDER.map(function (k) {
      const st = D.STATUS[k];
      const items = byStatus[k] || [];
      return (
        '<section class="funil-col" data-status="' + k + '" style="--sc:' + st.color + '">' +
          '<div class="funil-col__head">' +
            '<span class="funil-col__dot"></span>' +
            '<span class="funil-col__title">' + esc(st.label) + '</span>' +
            '<span class="funil-col__count">' + items.length + '</span>' +
          '</div>' +
          '<div class="funil-col__body" data-status="' + k + '">' +
            items.map(cardHtml).join('') +
          '</div>' +
        '</section>'
      );
    }).join('');
  }

  function refresh(list) {
    lastList = list || [];
    render();
  }

  /* ---- Drag por Pointer Events (touch + mouse) ---- */
  let drag = null;
  const THRESH = 8;

  function colUnder(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.funil-col') : null;
  }
  function clearDrop() {
    boardEl.querySelectorAll('.funil-col.is-drop').forEach(function (c) { c.classList.remove('is-drop'); });
  }

  function onDown(e) {
    const card = e.target.closest('.funil-card');
    if (!card || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: card.dataset.id, from: card.dataset.status, card: card,
             x0: e.clientX, y0: e.clientY, moved: false, ghost: null, offX: 0, offY: 0 };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  function startGhost(e) {
    const r = drag.card.getBoundingClientRect();
    drag.offX = e.clientX - r.left;
    drag.offY = e.clientY - r.top;
    const g = drag.card.cloneNode(true);
    g.classList.add('funil-ghost');
    g.style.width = r.width + 'px';
    document.body.appendChild(g);
    drag.ghost = g;
    drag.card.classList.add('is-dragging');
    moveGhost(e);
  }
  function moveGhost(e) {
    if (drag.ghost) {
      drag.ghost.style.left = (e.clientX - drag.offX) + 'px';
      drag.ghost.style.top = (e.clientY - drag.offY) + 'px';
    }
  }

  function onMove(e) {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < THRESH) return;
      drag.moved = true;
      startGhost(e);
    }
    e.preventDefault();
    moveGhost(e);
    clearDrop();
    const col = colUnder(e.clientX, e.clientY);
    if (col && col.dataset.status !== drag.from) col.classList.add('is-drop');
  }

  function finish() {
    window.removeEventListener('pointermove', onMove, { passive: false });
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    if (drag && drag.ghost) drag.ghost.remove();
    if (drag && drag.card) drag.card.classList.remove('is-dragging');
    if (boardEl) clearDrop();
    drag = null;
  }

  function onUp(e) {
    if (!drag) return finish();
    if (drag.moved) {
      const col = colUnder(e.clientX, e.clientY);
      if (col && col.dataset.status !== drag.from) {
        S.setStatus(drag.id, col.dataset.status);   // reapply re-renderiza o board
      }
    } else {
      openLead(drag.id);                             // toque simples = abre o pin
    }
    finish();
  }
  function onCancel() { finish(); }

  function openLead(id) {
    showMap();
    setTimeout(function () {
      if (window.CRM_MAP) window.CRM_MAP.focus(id, Math.max(window.CRM_MAP.getMap().getZoom(), 16));
      if (window.CRM_PIN) window.CRM_PIN.open(id);
    }, 60);
  }

  function init(opts) {
    boardEl = document.getElementById('funil-board');
    countEl = document.getElementById('funil-count');
    emptyEl = document.getElementById('funil-empty');
    showMap = (opts && opts.showMap) || showMap;

    if (boardEl) boardEl.addEventListener('pointerdown', onDown);
    const clr = document.getElementById('btn-funil-clear');
    if (clr) clr.addEventListener('click', function () {
      if (window.CRM_FILTERS) window.CRM_FILTERS.clearAll();
    });
  }

  window.CRM_FUNIL = {
    init: init,
    refresh: refresh
  };
})();
