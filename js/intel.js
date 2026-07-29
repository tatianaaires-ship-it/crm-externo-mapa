/* =====================================================================
   intel.js — Aba "Inteligência / Leads".
   - Lista os leads do MESMO conjunto filtrado do mapa (state + filtros
     compartilhados via CRM_FILTERS.reapply → CRM_INTEL.refresh).
   - Busca (nome / razão social / CNPJ) — desde 29/07 é DIMENSÃO DE FILTRO
     compartilhada (`CRM_FILTERS.q`), não recorte local: a caixa daqui e a da
     quickbar do mapa escrevem no mesmo lugar, e as 4 abas concordam.
   - Clicar num lead volta pro mapa e abre o pin correspondente.
   ===================================================================== */
(function () {
  'use strict';

  const D = window.CRM_DATA;

  let listEl, searchEl, countEl, emptyEl;
  let lastList = [];        // último conjunto filtrado recebido do mapa
  // (a busca virou dimensão de filtro compartilhada — ver buscaAtual)
  let showMap = function () {}; // callback: volta pra aba do mapa

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // (a normalização acento-insensível mora em CRM_DATA.matchBusca)
  function cityOf(p) {
    const meta = D.BAIRRO_META[p.bairro];
    return meta ? meta.city + '/' + meta.uf : '';
  }
  function qualRank(q) {
    const i = D.QUALIDADE_ORDER.indexOf(q);
    return i < 0 ? 99 : i; // Ouro(0) < Prata(1) < Bronze(2)
  }

  /* A busca desta tela virou DIMENSÃO DE FILTRO em 29/07 (`CRM_FILTERS.q`), em
     vez de recorte local: `lastList` já chega buscado, então não há mais o que
     filtrar aqui. O ganho é o app parar de se contradizer — a Intel prometia o
     "mesmo conjunto filtrado" do mapa e, com busca só dela, mostrava outro.
     Agora digitar aqui filtra o mapa, o Funil e as Atividades também.
     `query` sobrou apenas para a mensagem de vazio, e é lida do filtro. */
  function buscaAtual() {
    return window.CRM_FILTERS ? window.CRM_FILTERS.getBusca() : '';
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
    const shown = sortLeads(lastList);
    const query = buscaAtual();

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

  /* Escreve na dimensão compartilhada — o `reapply` volta para cá via refresh().
     `enquadrar: false`: quem digita aqui está olhando a LISTA, e mexer no
     enquadramento do mapa por trás seria efeito colateral invisível. */
  let deb = null;
  function onSearch() {
    clearTimeout(deb);
    const v = searchEl.value || '';
    deb = setTimeout(function () {
      if (window.CRM_FILTERS) window.CRM_FILTERS.setBusca(v, false);
    }, 220);
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
      // `clearAll` já zera a busca (é dimensão desde 29/07) e chama reapply,
      // que volta aqui via refresh — não precisa limpar o input à mão.
      if (window.CRM_FILTERS) window.CRM_FILTERS.clearAll();
    });
  }

  window.CRM_INTEL = {
    init: init,
    refresh: refresh
  };
})();
