/* =====================================================================
   filters.js — Filtro combinável e simples (CAP-2).
   - Dimensões combinam por AND; múltiplos valores na mesma dimensão = OR.
   - Botões de acesso rápido = atalhos toggle sincronizados com o painel.
   - Atualização imediata dos pins no mapa.
   ===================================================================== */
(function () {
  'use strict';

  const D = window.CRM_DATA;
  const S = window.CRM_STATE;

  const filters = {
    typology: new Set(),
    zone: new Set(),
    qualidade: new Set(),   // Ouro/Prata/Bronze (derivada do CNAE)
    porte: new Set(),       // MEI/ME/EPP/LTDA
    origin: new Set(),
    status: new Set(),      // funil (antes visitStatus)
    lastVisit: 'todos'      // todos | nao_30 | recente
  };

  let getSelectedId = function () { return null; };

  /* ---- Matching ---- */
  function daysSince(iso) {
    if (!iso) return Infinity;
    const d = new Date(iso + 'T00:00:00');
    const now = new Date();
    return (now - d) / 86400000;
  }
  function setMatch(set, val) { return set.size === 0 || set.has(val); }

  function matches(p) {
    if (!setMatch(filters.typology, p.typology)) return false;
    if (!setMatch(filters.zone, p.zone)) return false;
    if (!setMatch(filters.qualidade, p.qualidade)) return false;
    if (!setMatch(filters.porte, p.porte)) return false;
    if (!setMatch(filters.origin, p.origin)) return false;
    if (!setMatch(filters.status, p.status)) return false;
    if (filters.lastVisit === 'nao_30' && daysSince(p.lastVisit) < 30) return false;
    if (filters.lastVisit === 'recente' && daysSince(p.lastVisit) >= 30) return false;
    return true;
  }

  function activeCount() {
    let n = filters.typology.size + filters.zone.size + filters.qualidade.size +
            filters.porte.size + filters.origin.size + filters.status.size;
    if (filters.lastVisit !== 'todos') n += 1;
    return n;
  }

  // Conjunto filtrado, compartilhado com a aba Inteligência (mesmos dados + filtros).
  function getFiltered() { return S.getAll().filter(matches); }

  /* ---- Chips data-driven: reconstroem quando a taxonomia do dataset muda ---- */
  let lastTaxoSig = null;
  function taxoSignature() {
    return typologyEntries().map(function (e) { return e.key; }).join(',') +
      '||' + zoneEntries().map(function (e) { return e.key; }).join(',');
  }
  // Zona/Tipologia saem dos valores PRESENTES no dataset (o fictício e o real têm
  // taxonomias diferentes: real traz zona="REC Zona Oeste" e tipologia "outro").
  // Reconstrói só quando o conjunto de valores muda (fictício→real, criar pin…).
  function ensureTaxonomyChips() {
    const sig = taxoSignature();
    if (sig === lastTaxoSig) return;
    lastTaxoSig = sig;
    buildPanel();
    buildClassPopover();
  }

  /* ---- Aplicar + renderizar ---- */
  function reapply() {
    const all = S.getAll();
    const list = all.filter(matches);

    ensureTaxonomyChips();

    // UI derivada do MODELO de filtros (barata) vem ANTES dos renders pesados:
    // assim uma exceção de render nunca deixa os chips/contadores dessincronizados
    // — era a causa de "chip não marca/desmarca" e "não fecha o aviso de filtros".
    syncControls();

    const total = all.length;
    const count = list.length;
    const pill = document.getElementById('result-count');
    if (pill) pill.textContent = count + (count === 1 ? ' local' : ' locais');

    const empty = document.getElementById('map-empty');
    if (empty) empty.classList.toggle('is-visible', count === 0);

    const badge = document.getElementById('filter-count');
    const ac = activeCount();
    if (badge) {
      badge.textContent = ac;
      badge.classList.toggle('is-visible', ac > 0);
    }
    const resCount = document.getElementById('filter-result-count');
    if (resCount) resCount.textContent = count + ' de ' + total + ' locais';

    // Renders pesados por último e ISOLADOS: um que falhe (dado real inesperado)
    // não derruba os outros nem a sincronização de controles acima.
    // Abas Inteligência e Funil compartilham o MESMO conjunto filtrado.
    try { window.CRM_MAP.render(list, getSelectedId()); }
    catch (e) { console.error('[filtros] falha ao renderizar o mapa:', e); }
    try { if (window.CRM_INTEL) window.CRM_INTEL.refresh(list); }
    catch (e) { console.error('[filtros] falha ao atualizar Inteligência:', e); }
    try { if (window.CRM_FUNIL) window.CRM_FUNIL.refresh(list); }
    catch (e) { console.error('[filtros] falha ao atualizar Funil:', e); }
    try { if (window.CRM_ATIV) window.CRM_ATIV.refresh(list); }
    catch (e) { console.error('[filtros] falha ao atualizar Atividades:', e); }
  }

  /* ---- Sincroniza estado visual dos chips (painel + atalhos) ---- */
  function syncControls() {
    document.querySelectorAll('[data-fdim]').forEach(function (el) {
      const dim = el.getAttribute('data-fdim');
      const val = el.getAttribute('data-fval');
      let on;
      if (dim === 'lastVisit') on = filters.lastVisit === val;
      else on = filters[dim].has(val);
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('[data-quick]').forEach(function (el) {
      const dim = el.getAttribute('data-qdim');
      const val = el.getAttribute('data-qval');
      let on;
      if (dim === 'lastVisit') on = filters.lastVisit === val;
      else on = filters[dim].has(val);
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', String(on));
    });
    // Botão "Classificação": ativo se houver tipologia selecionada, com contador.
    const cb = document.getElementById('btn-class');
    if (cb) {
      const n = filters.typology.size;
      cb.classList.toggle('is-on', n > 0);
      const badge = document.getElementById('class-badge');
      if (badge) { badge.textContent = n || ''; badge.classList.toggle('is-visible', n > 0); }
    }
  }

  /* ---- Toggling ---- */
  function toggle(dim, val) {
    if (dim === 'lastVisit') {
      filters.lastVisit = (filters.lastVisit === val) ? 'todos' : val;
    } else {
      const set = filters[dim];
      if (set.has(val)) set.delete(val); else set.add(val);
    }
    reapply();
  }

  function clearAll() {
    filters.typology.clear(); filters.zone.clear(); filters.qualidade.clear();
    filters.porte.clear(); filters.origin.clear(); filters.status.clear();
    filters.lastVisit = 'todos';
    reapply();
  }

  /* ---- Construção da UI ---- */
  // Escapa valores que vão pra atributo/HTML (zona do dado real pode ter & < > ").
  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function humanize(k) {
    const s = String(k == null ? '' : k);
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
  // Valores DISTINTOS de um campo presentes no dataset atual (base dos chips).
  function distinctValues(field) {
    const seen = Object.create(null);
    const out = [];
    S.getAll().forEach(function (p) {
      const v = p[field];
      if (v == null || v === '' || seen[v]) return;
      seen[v] = true; out.push(v);
    });
    return out;
  }
  // Tipologia: conhecidas (na ordem de D.TYPOLOGIES) que ESTÃO no dataset +
  // presentes desconhecidas (ex.: "outro" do dado real). Só chips que casam com algo.
  function typologyEntries() {
    const present = distinctValues('typology');
    const inSet = {};
    present.forEach(function (k) { inSet[k] = true; });
    const known = Object.keys(D.TYPOLOGIES).filter(function (k) { return inSet[k]; });
    const extra = present.filter(function (k) { return !D.TYPOLOGIES[k]; })
      .sort(function (a, b) { return String(a).localeCompare(String(b), 'pt-BR'); });
    return known.concat(extra).map(function (k) {
      const t = D.TYPOLOGIES[k];
      return t ? { key: k, label: t.emoji + ' ' + t.label } : { key: k, label: '📍 ' + humanize(k) };
    });
  }
  // Zona: valores reais presentes ("REC Zona Oeste"…), ordenados. Nulos não viram
  // chip (o pin segue no mapa; zona é filtro parcial — snapshot-dado-real.md §6).
  function zoneEntries() {
    return distinctValues('zone')
      .sort(function (a, b) { return String(a).localeCompare(String(b), 'pt-BR'); })
      .map(function (z) { return { key: z, label: z }; });
  }

  function chip(dim, val, label, extraClass) {
    return '<button type="button" class="chip ' + (extraClass || '') + '" data-fdim="' + escAttr(dim) +
      '" data-fval="' + escAttr(val) + '" aria-pressed="false">' + escAttr(label) + '</button>';
  }

  function group(title, dim, entries) {
    let chips = '';
    entries.forEach(function (e) { chips += chip(dim, e.key, e.label, e.cls); });
    return '<div class="fgroup"><div class="fgroup__title">' + title + '</div>' +
      '<div class="fgroup__chips">' + chips + '</div></div>';
  }

  function buildPanel() {
    const host = document.getElementById('filter-groups');
    if (!host) return;

    const typEntries = typologyEntries();
    const zoneEnts = zoneEntries();
    const qualEntries = D.QUALIDADE_ORDER.map(function (k) {
      const q = D.QUALIDADE[k];
      return { key: k, label: q.emoji + ' ' + q.label, cls: 'chip--qual chip--q-' + k };
    });
    const porteEntries = D.PORTE_ORDER.map(function (k) {
      return { key: k, label: D.PORTE[k].label };
    });
    const origEntries = D.ORIGIN_ORDER.map(function (k) {
      return { key: k, label: D.ORIGINS[k].label, cls: 'chip--origin chip--o-' + k };
    });
    const statEntries = Object.keys(D.STATUS).map(function (k) {
      return { key: k, label: D.STATUS[k].label };
    });
    const lvEntries = [
      { key: 'nao_30', label: 'Não visitado 30+ dias' },
      { key: 'recente', label: 'Visitado recente' }
    ];

    host.innerHTML =
      group('Tipologia', 'typology', typEntries) +
      group('Última visita', 'lastVisit', lvEntries) +
      group('Qualidade', 'qualidade', qualEntries) +
      group('Porte', 'porte', porteEntries) +
      group('Origem / confiança', 'origin', origEntries) +
      group('Status', 'status', statEntries) +
      group('Zona', 'zone', zoneEnts);
    // Listener delegado fica em init() (persiste entre re-renders do innerHTML).
  }

  function buildQuick() {
    const host = document.getElementById('quick-filters');
    if (!host) return;
    // Botão "Classificação" abre um popover com todas as tipologias (multi-seleção).
    let html =
      '<button type="button" class="quick quick--class" id="btn-class" aria-expanded="false" aria-haspopup="true">' +
        '<span>🏷️ Classificação</span>' +
        '<span class="quick__badge" id="class-badge"></span>' +
        '<span class="quick__chev" aria-hidden="true">▾</span>' +
      '</button>';
    const quicks = [
      { dim: 'qualidade', val: 'Ouro', label: '🥇 Ouro' },
      { dim: 'lastVisit', val: 'nao_30', label: '📌 Não visitados 30+' },
      { dim: 'origin', val: 'validado_campo', label: '✓ Validado em campo' }
    ];
    quicks.forEach(function (q) {
      html += '<button type="button" class="quick" data-quick="1" data-qdim="' + q.dim +
        '" data-qval="' + q.val + '" aria-pressed="false">' + q.label + '</button>';
    });
    host.innerHTML = html;
    host.addEventListener('click', function (ev) {
      if (ev.target.closest('#btn-class')) { toggleClass(); return; }
      const btn = ev.target.closest('[data-quick]');
      if (!btn) return;
      toggle(btn.getAttribute('data-qdim'), btn.getAttribute('data-qval'));
    });
    buildClassPopover();
  }

  /* ---- Popover de classificação (tipologias) ---- */
  function buildClassPopover() {
    const pop = document.getElementById('class-popover');
    if (!pop) return;
    let chips = '';
    typologyEntries().forEach(function (e) {
      chips += chip('typology', e.key, e.label);
    });
    pop.innerHTML =
      '<div class="class-popover__head">' +
        '<span class="class-popover__title">Classificação</span>' +
        '<button type="button" class="btn btn--ghost btn--sm" id="btn-class-clear">Limpar</button>' +
      '</div>' +
      '<div class="class-popover__chips">' + chips + '</div>';
    // Listener delegado fica em init() (persiste entre re-renders do innerHTML).
  }

  function openClass() {
    const pop = document.getElementById('class-popover');
    const bd = document.getElementById('class-backdrop');
    if (pop) pop.classList.add('is-open');
    if (bd) bd.classList.add('is-open');
    const b = document.getElementById('btn-class');
    if (b) b.setAttribute('aria-expanded', 'true');
  }
  function closeClass() {
    const pop = document.getElementById('class-popover');
    const bd = document.getElementById('class-backdrop');
    if (pop) pop.classList.remove('is-open');
    if (bd) bd.classList.remove('is-open');
    const b = document.getElementById('btn-class');
    if (b) b.setAttribute('aria-expanded', 'false');
  }
  function toggleClass() {
    const pop = document.getElementById('class-popover');
    if (pop && pop.classList.contains('is-open')) closeClass(); else openClass();
  }

  /* ---- Handlers delegados (anexados 1x; sobrevivem ao re-render dos chips) ---- */
  function onPanelClick(ev) {
    const btn = ev.target.closest('[data-fdim]');
    if (!btn) return;
    toggle(btn.getAttribute('data-fdim'), btn.getAttribute('data-fval'));
  }
  function onPopoverClick(ev) {
    if (ev.target.closest('#btn-class-clear')) { filters.typology.clear(); reapply(); return; }
    const btn = ev.target.closest('[data-fdim]');
    if (!btn) return;
    toggle(btn.getAttribute('data-fdim'), btn.getAttribute('data-fval'));
  }

  function init(opts) {
    getSelectedId = (opts && opts.getSelectedId) || getSelectedId;
    buildPanel();
    buildQuick();
    // Delegação anexada UMA vez ao host — ensureTaxonomyChips() troca o innerHTML
    // dos chips (fictício→real) sem re-anexar (evita toggle duplicado).
    const groupsHost = document.getElementById('filter-groups');
    if (groupsHost) groupsHost.addEventListener('click', onPanelClick);
    const pop = document.getElementById('class-popover');
    if (pop) pop.addEventListener('click', onPopoverClick);
    const clearBtn = document.getElementById('btn-clear-filters');
    if (clearBtn) clearBtn.addEventListener('click', clearAll);
    const classBd = document.getElementById('class-backdrop');
    if (classBd) classBd.addEventListener('click', closeClass);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeClass();
    });
  }

  window.CRM_FILTERS = {
    init: init,
    reapply: reapply,
    clearAll: clearAll,
    activeCount: activeCount,
    getFiltered: getFiltered,
    matches: matches,
    closeClass: closeClass
  };
})();
