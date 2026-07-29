/* =====================================================================
   intel.js — Aba "Inteligência / Leads".
   - Lista os leads do MESMO conjunto filtrado do mapa (state + filtros
     compartilhados via CRM_FILTERS.reapply → CRM_INTEL.refresh).
   - Busca local (nome / razão social / CNPJ), acento-insensível.
   - Clicar num lead volta pro mapa e abre o pin correspondente.
   ===================================================================== */
(function () {
  'use strict';

  const D = window.CRM_DATA;

  let listEl, searchEl, countEl, emptyEl;
  let lastList = [];        // último conjunto filtrado recebido do mapa
  let query = '';
  let showMap = function () {}; // callback: volta pra aba do mapa

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // (a normalização acento-insensível mora em CRM_DATA.matchBusca)
  function cityOf(p) {
    const meta = D.ZONE_META[p.zone];
    return meta ? meta.city + '/' + meta.uf : '';
  }
  function qualRank(q) {
    const i = D.QUALIDADE_ORDER.indexOf(q);
    return i < 0 ? 99 : i; // Ouro(0) < Prata(1) < Bronze(2)
  }

  // Nome fantasia · razão social · CNPJ — a MESMA função da barra da aba
  // Atividades (CRM_DATA.matchBusca): busca igual nas duas telas que buscam pin.
  // Ganho para esta tela: o CNPJ passou a casar por dígitos, então "14066"
  // acha "14.066.645/0001-46" — antes exigia digitar a pontuação.
  function applySearch(list) {
    if (!query) return list;
    return list.filter(function (p) { return D.matchBusca(p, query); });
  }

  function sortLeads(list) {
    return list.slice().sort(function (a, b) {
      const dq = qualRank(a.qualidade) - qualRank(b.qualidade);
      if (dq !== 0) return dq;
      // nome_fantasia pode chegar null no dado real (higienizado/vazio no snapshot) —
      // localeCompare estoura em null, então normaliza antes de comparar.
      return String(a.name == null ? '' : a.name)
        .localeCompare(String(b.name == null ? '' : b.name), 'pt-BR');
    });
  }

  function cardHtml(p) {
    const origin = D.ORIGINS[p.origin] || { cue: '' };
    const rel = D.relacaoDe(p);                 // cor = cliente × lead (29/07)
    const typ = D.TYPOLOGIES[p.typology] || { emoji: '📍', label: p.typology };
    const qual = D.QUALIDADE[p.qualidade] || { emoji: '', label: p.qualidade, color: '#64748b', ink: '#334155' };
    const stat = D.STATUS[p.status] || { label: p.status, color: '#64748b' };
    const seal = (origin.cue && origin.cue !== 'dashed') ? origin.cue : '';
    const cnpjLine = p.cnpj ? '<span class="lead__cnpj mono">' + esc(p.cnpj) + '</span>' : '';
    return (
      '<button type="button" class="lead" data-id="' + p.id + '">' +
        '<span class="lead__dot lead__dot--' + p.origin + '" style="--pin:' + rel.color + '" aria-hidden="true">' + seal + '</span>' +
        '<span class="lead__body">' +
          '<span class="lead__top">' +
            '<span class="lead__name">' + typ.emoji + ' ' + esc(p.name) + '</span>' +
            '<span class="badge badge--q-' + p.qualidade + '" style="--c:' + qual.color + ';--ci:' + qual.ink + '">' + qual.emoji + ' ' + esc(qual.label) + '</span>' +
          '</span>' +
          '<span class="lead__bottom">' +
            '<span class="lead__sub">' + esc(p.zone) + ' · ' + esc(cityOf(p)) + '</span>' +
            '<span class="pill pill--sm" style="--c:' + stat.color + '">' + esc(stat.label) + '</span>' +
          '</span>' +
          (cnpjLine ? '<span class="lead__bottom">' + cnpjLine +
            (p.createdByUser ? '<span class="tag-new">novo</span>' : '') + '</span>' : '') +
        '</span>' +
      '</button>'
    );
  }

  function renderList() {
    if (!listEl) return;
    const shown = sortLeads(applySearch(lastList));

    if (countEl) countEl.textContent = shown.length + (shown.length === 1 ? ' lead' : ' leads');

    if (!shown.length) {
      listEl.innerHTML = '';
      if (emptyEl) {
        emptyEl.classList.add('is-visible');
        const msg = emptyEl.querySelector('.intel-empty__msg');
        if (msg) {
          msg.textContent = query
            ? 'Nenhum lead para “' + query + '”.'
            : 'Nenhum lead com esses filtros.';
        }
      }
      return;
    }
    if (emptyEl) emptyEl.classList.remove('is-visible');
    listEl.innerHTML = shown.map(cardHtml).join('');
  }

  // Recebe o conjunto já filtrado (mesmos filtros do mapa).
  function refresh(list) {
    lastList = list || [];
    renderList();
  }

  function onSearch() {
    query = (searchEl.value || '').trim();
    renderList();
  }

  function openLead(id) {
    showMap();                       // volta pra aba do mapa
    // pequeno atraso p/ o mapa recalcular tamanho antes de focar
    setTimeout(function () {
      if (window.CRM_MAP) window.CRM_MAP.focus(id, Math.max(window.CRM_MAP.getMap().getZoom(), 16));
      if (window.CRM_PIN) window.CRM_PIN.open(id);
    }, 60);
  }

  function init(opts) {
    listEl = document.getElementById('intel-list');
    searchEl = document.getElementById('intel-search');
    countEl = document.getElementById('intel-count');
    emptyEl = document.getElementById('intel-empty');
    showMap = (opts && opts.showMap) || showMap;

    if (searchEl) searchEl.addEventListener('input', onSearch);
    if (listEl) listEl.addEventListener('click', function (e) {
      const btn = e.target.closest('.lead');
      if (!btn) return;
      openLead(btn.getAttribute('data-id'));
    });
    const clr = document.getElementById('btn-intel-clear');
    if (clr) clr.addEventListener('click', function () {
      if (window.CRM_FILTERS) window.CRM_FILTERS.clearAll();
      if (searchEl) { searchEl.value = ''; query = ''; }
      renderList();
    });
  }

  window.CRM_INTEL = {
    init: init,
    refresh: refresh
  };
})();
