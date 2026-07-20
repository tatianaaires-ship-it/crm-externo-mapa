/* =====================================================================
   pin.js — Bottom sheet do pin (CAP-3 + CAP-6).
   - Info + NOTAS sempre visíveis ao abrir (nenhum estado esconde as notas).
   - Check-in / check-out simples, sem GPS nem foto.
   - Sem qualquer affordance de excluir pin (constraint).
   ===================================================================== */
(function () {
  'use strict';

  const D = window.CRM_DATA;
  const S = window.CRM_STATE;
  let currentId = null;
  let sheetEl, backdropEl;

  // Ícone de pin padrão (sem emoji de tipologia) para o avatar do sheet.
  const PIN_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" fill="#fff" aria-hidden="true">' +
    '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function relative(iso) {
    const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
    const diff = (new Date() - d) / 1000;
    if (diff < 60) return 'agora';
    if (diff < 3600) return 'há ' + Math.floor(diff / 60) + ' min';
    if (diff < 86400) return 'há ' + Math.floor(diff / 3600) + ' h';
    const days = Math.floor(diff / 86400);
    if (days < 30) return 'há ' + days + (days === 1 ? ' dia' : ' dias');
    return fmtDate(iso);
  }
  function durationMin(a, b) {
    return Math.max(1, Math.round((new Date(b) - new Date(a)) / 60000));
  }

  function infoRow(label, value, cls) {
    return '<div class="info__row"><span class="info__k">' + label + '</span>' +
      '<span class="info__v ' + (cls || '') + '">' + value + '</span></div>';
  }

  function render() {
    const p = S.getById(currentId);
    if (!p) { close(); return; }
    const origin = D.ORIGINS[p.origin];
    const typ = D.TYPOLOGIES[p.typology] || { emoji: '📍', label: p.typology };
    const pot = D.POTENTIALS[p.potential] || { label: p.potential, color: '#64748b' };
    const stat = D.VISIT_STATUS[p.visitStatus] || { label: p.visitStatus, color: '#64748b' };

    // Escala de confiança (dots)
    let dots = '';
    for (let i = 1; i <= 4; i++) dots += '<span class="conf__dot' + (i <= origin.level ? ' is-on' : '') + '"></span>';

    // Notas — SEMPRE visíveis
    let notesHtml;
    if (p.notes.length === 0) {
      notesHtml = '<p class="notes__empty">Sem notas ainda. Registre o que descobriu na visita.</p>';
    } else {
      notesHtml = p.notes.map(function (n) {
        return '<div class="note"><p class="note__text">' + esc(n.text) + '</p>' +
          '<time class="note__time">' + relative(n.ts) + '</time></div>';
      }).join('');
    }

    // Check-ins
    const open = S.openCheckin(p.id);
    let checkBtn;
    if (open) {
      checkBtn = '<button type="button" id="btn-checkout" class="btn btn--checkout">' +
        '⏱️ Check-out <small>(desde ' + fmtTime(open.in) + ')</small></button>';
    } else {
      checkBtn = '<button type="button" id="btn-checkin" class="btn btn--checkin">📍 Check-in</button>';
    }
    let historyHtml = '';
    if (p.checkins.length) {
      historyHtml = '<ul class="checklist">' + p.checkins.map(function (c) {
        const line = fmtDate(c.in) + ' · ' + fmtTime(c.in) +
          (c.out ? ' → ' + fmtTime(c.out) + ' <span class="checklist__dur">(' + durationMin(c.in, c.out) + ' min)</span>'
                 : ' <span class="checklist__open">em andamento</span>');
        return '<li>' + line + '</li>';
      }).join('') + '</ul>';
    }

    sheetEl.querySelector('.sheet__scroll').innerHTML =
      '<div class="sheet__handle" aria-hidden="true"></div>' +
      '<header class="sheet__head">' +
        '<div class="sheet__avatar" style="--pin:' + origin.color + '">' + PIN_SVG + '</div>' +
        '<div class="sheet__titles">' +
          '<h2 class="sheet__name">' + esc(p.name) + '</h2>' +
          '<div class="sheet__sub">' + esc(typ.label) + ' · ' + esc(p.zone) +
            (p.createdByUser ? ' · <span class="tag-new">novo</span>' : '') + '</div>' +
        '</div>' +
        '<button type="button" class="sheet__close" id="btn-close-sheet" aria-label="Fechar">✕</button>' +
      '</header>' +

      '<div class="origin-card" style="--pin:' + origin.color + ';--pin-ink:' + origin.ink + '">' +
        '<div class="origin-card__top">' +
          '<span class="origin-card__badge">' + esc(origin.label) + '</span>' +
          '<span class="conf">' + dots + '</span>' +
        '</div>' +
        '<div class="origin-card__conf">Confiabilidade: <strong>' + origin.confidence + '</strong></div>' +
        '<p class="origin-card__desc">' + esc(origin.desc) + '</p>' +
      '</div>' +

      '<section class="info">' +
        infoRow('Potencial', '<span class="pill" style="--c:' + pot.color + '">' + esc(pot.label) + '</span>') +
        infoRow('Status de visita', '<span class="pill" style="--c:' + stat.color + '">' + esc(stat.label) + '</span>') +
        infoRow('Última visita', fmtDate(p.lastVisit)) +
        infoRow('CNPJ', p.cnpj ? esc(p.cnpj) : '<em class="muted">sem CNPJ associado</em>') +
        infoRow('Telefone', p.phone ? esc(p.phone) : '<em class="muted">—</em>') +
        infoRow('Endereço', esc(p.address)) +
        infoRow('Coordenada', p.lat.toFixed(5) + ', ' + p.lng.toFixed(5), 'mono') +
      '</section>' +

      '<button type="button" id="btn-move-pin" class="btn btn--ghost btn--block">✥ Corrigir localização</button>' +

      '<section class="block">' +
        '<div class="block__title">Check-in / Check-out</div>' +
        '<div class="check-actions">' + checkBtn + '</div>' +
        historyHtml +
      '</section>' +

      '<section class="block block--notes">' +
        '<div class="block__title">Notas <span class="block__hint">sempre visíveis</span></div>' +
        '<div class="notes">' + notesHtml + '</div>' +
        '<form class="note-form" id="note-form">' +
          '<input type="text" id="note-input" class="note-input" placeholder="Adicionar nota…" autocomplete="off" maxlength="240" />' +
          '<button type="submit" class="btn btn--note">Salvar</button>' +
        '</form>' +
      '</section>';

    wireSheet();
  }

  function wireSheet() {
    const close = sheetEl.querySelector('#btn-close-sheet');
    if (close) close.addEventListener('click', closeSheet);

    const ci = sheetEl.querySelector('#btn-checkin');
    if (ci) ci.addEventListener('click', function () { S.checkIn(currentId); });
    const co = sheetEl.querySelector('#btn-checkout');
    if (co) co.addEventListener('click', function () { S.checkOut(currentId); });

    const mv = sheetEl.querySelector('#btn-move-pin');
    if (mv) mv.addEventListener('click', function () { window.CRM_MAP.startMove(currentId); });

    const form = sheetEl.querySelector('#note-form');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      const input = sheetEl.querySelector('#note-input');
      if (input && input.value.trim()) { S.addNote(currentId, input.value); input.value = ''; }
    });
  }

  function open(id) {
    currentId = id;
    render();
    sheetEl.classList.add('is-open');
    backdropEl.classList.add('is-open');
    document.body.classList.add('sheet-open');
    window.CRM_MAP.setSelected(id);
    window.CRM_MAP.panToShow(id);
  }

  function closeSheet() {
    currentId = null;
    sheetEl.classList.remove('is-open');
    backdropEl.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    window.CRM_MAP.setSelected(null);
  }
  const close = closeSheet;

  // Re-render em mudanças de estado (nota/check-in/mover) sem fechar o sheet.
  function refresh() {
    if (currentId && sheetEl.classList.contains('is-open')) render();
  }

  function init() {
    sheetEl = document.getElementById('pin-sheet');
    backdropEl = document.getElementById('sheet-backdrop');
    if (backdropEl) backdropEl.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && currentId) closeSheet();
    });
  }

  window.CRM_PIN = {
    init: init,
    open: open,
    close: closeSheet,
    refresh: refresh,
    currentId: function () { return currentId; }
  };
})();
