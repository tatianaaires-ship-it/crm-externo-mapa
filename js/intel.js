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

  let listEl, countEl, emptyEl;
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

  /* `localeCompare` por comparação custava 82,5ms com 6.914 leads — mais que
     todo o resto da tela somado. A chave normalizada (a MESMA `CRM_DATA.norm`
     da busca) reproduz a colação pt-BR e cai para 12ms; verificado item a item
     nos 6.914: zero divergências de ordem.
     A chave fica no pin e se auto-invalida pelo nome, então renomear ou criar
     um pin em campo não deixa chave velha para trás. */
  function chaveNome(p) {
    const nome = String(p.name == null ? '' : p.name);
    if (p.__skDe !== nome) { p.__skDe = nome; p.__sk = D.norm(nome); }
    return p.__sk;
  }

  /* Decora → ordena → desdecora. Chamar `chaveNome`/`qualRank` DENTRO do
     comparador são ~176 mil chamadas de função com 6.914 leads (53ms medidos);
     com os campos prontos num array auxiliar, a ordenação compara valores
     simples e cai para ~12ms. `qualRank` também sai do laço quente — ele faz
     `indexOf` num array a cada chamada. */
  function sortLeads(list) {
    const dec = new Array(list.length);
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      // nome_fantasia pode chegar null no dado real (higienizado/vazio no snapshot).
      dec[i] = { p: p, r: qualRank(p.qualidade), k: chaveNome(p) };
    }
    dec.sort(function (a, b) {
      if (a.r !== b.r) return a.r - b.r;
      return a.k < b.k ? -1 : a.k > b.k ? 1 : 0;
    });
    const out = new Array(dec.length);
    for (let i = 0; i < dec.length; i++) out[i] = dec[i].p;
    return out;
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

  /* ---- Janela por scroll ----
     Construir os 6.914 de uma vez custava 0,6s no Android (cronometrado 29/07)
     e 172ms no desktop, com 76.054 nós. Com 200 itens: 12ms. A janela só
     CRESCE — nada é reciclado nem removido —, então scroll nativo, arraste e o
     `content-visibility` do card seguem intactos.
     O contador continua dizendo o TOTAL: janela é detalhe de renderização,
     nunca de informação. */
  const LOTE = 200;
  let janela = LOTE;        // quantos itens estão renderizados agora
  let ordenada = [];        // o conjunto ordenado inteiro (a janela fatia daqui)

  function renderList() {
    if (!listEl) return;
    ordenada = sortLeads(lastList);
    const query = buscaAtual();

    if (countEl) countEl.textContent = ordenada.length + (ordenada.length === 1 ? ' lead' : ' leads');

    if (!ordenada.length) {
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
    listEl.innerHTML = ordenada.slice(0, janela).map(cardHtml).join('');
  }

  // Anexa o próximo lote sem reconstruir o que já está na tela — reconstruir
  // mataria a posição do scroll no meio do gesto.
  function crescerJanela() {
    if (janela >= ordenada.length) return;
    const de = janela;
    janela = Math.min(janela + LOTE, ordenada.length);
    listEl.insertAdjacentHTML('beforeend', ordenada.slice(de, janela).map(cardHtml).join(''));
  }

  function onScroll() {
    // 400px de folga: o lote entra antes de a pessoa chegar no fundo.
    if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 400) crescerJanela();
  }

  // Recebe o conjunto já filtrado (mesmos filtros do mapa).
  function refresh(list) {
    lastList = list || [];
    janela = LOTE;                    // conjunto novo ⇒ janela recomeça
    renderList();
    if (listEl) listEl.scrollTop = 0; // e o scroll volta ao topo
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
    countEl = document.getElementById('intel-count');
    emptyEl = document.getElementById('intel-empty');
    showMap = (opts && opts.showMap) || showMap;

    // `listEl` vem do getElementById e é estável — armar uma vez aqui basta.
    if (listEl) listEl.addEventListener('scroll', onScroll, { passive: true });
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
