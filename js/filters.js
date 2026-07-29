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
    zone: new Set(),        // zona_guardioes_c — 15 fixas + "Sem Zona"
    qualidade: new Set(),   // Ouro/Prata/Bronze (derivada do CNAE)
    porte: new Set(),       // 6 faixas de porte_c (29/07)
    origin: new Set(),
    status: new Set(),      // FUNIL — rotulado "Fase" na tela desde 29/07
    statusCliente: new Set(), // lead/csc/recorrente/churn (29/07)
    lastVisit: 'todos',     // todos | nao_30 | recente
    /* Busca por texto (29/07) — dimensão de filtro como as outras, então vale
       nas QUATRO abas. É a mesma `CRM_DATA.matchBusca` (nome fantasia · razão
       social · CNPJ por dígitos) que a Inteligência e a barra de Atividades já
       usavam: uma busca só para o produto. A caixa da Intel passou a escrever
       AQUI em vez de filtrar a lista por conta própria — antes, digitar lá não
       mexia no mapa, e as duas telas mostravam conjuntos diferentes apesar de
       prometerem o mesmo. */
    q: ''
  };

  let getSelectedId = function () { return null; };

  /* =====================================================================
     PRESET "Aquisição" (29/07) — oportunidades reais de aquisição.
     Não é uma dimensão nova: é um ATALHO que liga QUATRO de uma vez. Depois de
     aplicado, os chips do painel ficam marcados normalmente e podem ser
     mexidos — o preset não trava nada.

     ⚠️ O modelo de filtro é INCLUSIVO (conjunto vazio = tudo; conjunto cheio =
     só esses) e não tem negação. Então "porte diferente de MEI" e "fase
     diferente de perdido/desqualificado" são expressos como LISTA-BRANCA do
     complemento — 5 dos 6 portes, 6 das 8 fases. É o que faz o preset aparecer
     nos chips: dá para ver que MEI ficou de fora, o que uma regra de exclusão
     invisível não mostraria.

     Consequência de usar lista-branca: pin com `porte: null` sai do conjunto.
     Isso atinge o pin CRIADO EM CAMPO (o porte chega via CNPJá, então nasce
     nulo) — mas é o mesmo comportamento de qualquer filtro de porte hoje, não
     uma regra nova do preset.
     ===================================================================== */
  function presetAquisicao() {
    return {
      // porte ≠ MEI — inclui `Sem porte`, porque a intenção é EXCLUIR MEI, não
      // exigir que o porte já seja conhecido. É o que faz o lead criado na rua
      // (porte nulo até o CNPJá responder) entrar na lista de aquisição.
      porte: D.PORTE_FILTRO.filter(function (k) { return k !== 'MEI'; }),
      // qualidade ∈ {Ouro, Prata}
      qualidade: ['Ouro', 'Prata'],
      // status do cliente ∈ {lead, csc, churn} — ou seja, quem ainda não é recorrente
      statusCliente: ['lead', 'csc', 'churn'],
      // fase ∉ {perdido, desqualificado}
      status: D.STATUS_ORDER.filter(function (k) {
        return k !== 'perdido' && k !== 'desqualificado';
      })
    };
  }
  const PRESET_DIMS = ['porte', 'qualidade', 'statusCliente', 'status'];

  function mesmoConjunto(set, arr) {
    if (set.size !== arr.length) return false;
    return arr.every(function (v) { return set.has(v); });
  }

  /* O botão não guarda estado próprio: "ligado" é DERIVADO dos quatro
     conjuntos. Assim, mexer num chip do painel apaga o destaque sozinho — sem
     ficar um botão aceso mentindo que o recorte ainda é o do preset. */
  function aquisicaoAtiva() {
    const p = presetAquisicao();
    return PRESET_DIMS.every(function (d) { return mesmoConjunto(filters[d], p[d]); });
  }

  /* ---- Abrir/fechar a barra de busca do mapa ---- */
  function abrirBusca(focar) {
    const qb = document.getElementById('quickbar');
    if (!qb) return;
    qb.classList.add('is-searching');
    if (focar) {
      const el = document.getElementById('map-search');
      if (el) el.focus();
    }
  }
  function fecharBusca() {
    const qb = document.getElementById('quickbar');
    if (qb) qb.classList.remove('is-searching');
    // Fechar LIMPA o termo — barra fechada com filtro ativo seria filtro
    // invisível, o mesmo erro que a gaveta "Mais" da aba Atividades cometeu.
    setBusca('', false);
  }

  function toggleAquisicao() {
    const ligar = !aquisicaoAtiva();
    const p = presetAquisicao();
    PRESET_DIMS.forEach(function (d) {
      filters[d].clear();
      if (ligar) p[d].forEach(function (v) { filters[d].add(v); });
    });
    // Desligar limpa SÓ as quatro dimensões do preset — tipologia, zona, origem
    // e última visita continuam como estavam. Mínima surpresa.
    reapply();
  }

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
    // Porte nulo é um VALOR filtrável desde 29/07 (`SEM_PORTE`), não uma
    // ausência que some do filtro — senão o pin criado em campo desaparecia.
    if (!setMatch(filters.porte, p.porte || D.SEM_PORTE)) return false;
    if (!setMatch(filters.origin, p.origin)) return false;
    if (!setMatch(filters.status, p.status)) return false;
    // `statusCliente` é derivado; se um pin chegar sem ele (dado real cru),
    // deriva na hora em vez de sumir do filtro.
    if (!setMatch(filters.statusCliente, p.statusCliente || D.deriveStatusCliente(p))) return false;
    if (filters.lastVisit === 'nao_30' && daysSince(p.lastVisit) < 30) return false;
    if (filters.lastVisit === 'recente' && daysSince(p.lastVisit) >= 30) return false;
    if (!D.matchBusca(p, filters.q)) return false;   // busca = dimensão (29/07)
    return true;
  }

  function activeCount() {
    let n = filters.typology.size + filters.zone.size + filters.qualidade.size +
            filters.porte.size + filters.origin.size + filters.status.size +
            filters.statusCliente.size;
    if (filters.lastVisit !== 'todos') n += 1;
    if (filters.q.trim()) n += 1;   // busca conta como filtro: nunca é invisível
    return n;
  }

  // Conjunto filtrado, compartilhado com a aba Inteligência (mesmos dados + filtros).
  function getFiltered() { return S.getAll().filter(matches); }

  /* ---- Chips data-driven: reconstroem quando a taxonomia do dataset muda ---- */
  let lastTaxoSig = null;
  // Desde 29/07 só a TIPOLOGIA é data-driven — a Zona virou vocabulário fechado
  // (`ZONA_ORDER`), então não entra mais na assinatura: ela nunca muda com o
  // dataset. Zona continua no painel porque `buildPanel` a redesenha inteira.
  function taxoSignature() {
    return typologyEntries().map(function (e) { return e.key; }).join(',');
  }
  // Tipologia sai dos valores PRESENTES no dataset (o fictício e o real têm
  // taxonomias diferentes: o real traz tipologia "outro").
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
    /* As DUAS caixas de busca refletem o mesmo `filters.q`. Guarda de valor
       igual: escrever num input que já tem o valor mata a posição do cursor
       enquanto a pessoa digita. */
    ['map-search', 'intel-search'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el && el.value !== filters.q) el.value = filters.q;
    });
    const lupa = document.getElementById('btn-busca');
    if (lupa) {
      const on = !!filters.q.trim();
      lupa.classList.toggle('is-on', on);
      // Termo buscado com a barra fechada seria filtro invisível: mantém aberta.
      if (on) abrirBusca(false);
    }
    renderSug();   // as sugestões acompanham o conjunto filtrado
    // Botão "Aquisição": estado DERIVADO dos quatro conjuntos (ver toggleAquisicao).
    const aq = document.getElementById('btn-aquisicao');
    if (aq) {
      const on = aquisicaoAtiva();
      aq.classList.toggle('is-on', on);
      aq.setAttribute('aria-pressed', String(on));
    }
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
    filters.statusCliente.clear();
    filters.lastVisit = 'todos';
    filters.q = '';
    reapply();
  }

  /* ---- Busca (dimensão compartilhada) ---- */
  // Escrita pelas DUAS caixas: a da quickbar do mapa e a da Inteligência.
  // `enquadrar` só é pedido por quem digitou: reenquadrar o mapa a cada toque
  // em chip seria roubar o enquadramento do usuário.
  function setBusca(q, enquadrar) {
    const novo = String(q == null ? '' : q);
    if (novo === filters.q) return;
    filters.q = novo;
    reapply();
    if (enquadrar) enquadrarNaBusca();
  }

  /* Sem isto a busca-como-filtro é inútil no mapa: os casamentos podem estar em
     Fortaleza enquanto a viewport está no Recife, e a tela fica vazia sem dizer
     por quê. Só enquadra com termo digitado e resultado — nunca "desenquadra". */
  function enquadrarNaBusca() {
    if (!filters.q.trim() || !window.CRM_MAP || !window.CRM_MAP.fitTo) return;
    window.CRM_MAP.fitTo(getFiltered());
  }

  /* =====================================================================
     SUGESTÕES da busca (29/07) — o atalho para UM pin.
     Enquanto o filtro responde "quais pins casam", a lista responde "é este".
     As duas coisas convivem: o mapa já filtrou e reenquadrou; tocar num item
     leva ao ponto e abre o sheet.

     ⚠️ **A lista varre TODOS os pins, não o conjunto filtrado** (corrigido no
     mesmo dia). A primeira versão respeitava os filtros, e isso matava o valor
     central do mapa: com qualquer chip ligado, buscar um ponto conhecido não o
     achava — e a pessoa não tem como saber que a culpa era de um filtro. ACHAR
     é função da busca; FILTRAR é função do filtro.
     O ponto fora do recorte vem marcado na lista e, ao ser escolhido, entra no
     mapa como **exceção visível** (`CRM_MAP.revelar`): marker fora do cluster,
     com anel tracejado. Nada disso mexe em `matches` — o pill, o badge e as
     outras três abas continuam dizendo a verdade sobre o recorte.
     ===================================================================== */
  const SUG_TETO = 8;

  // Relevância: quem começa com o termo vem antes de quem só o contém, e nome
  // vem antes de razão social. É o que a pessoa espera ao digitar as primeiras
  // letras; sem isso "Padaria Maré" pode aparecer depois de "Restaurante ... Padaria".
  function scoreSug(p, q) {
    const nome = D.norm(p.name), rz = D.norm(p.razaoSocial);
    if (nome.indexOf(q) === 0) return 0;
    if (nome.indexOf(q) > 0) return 1;
    if (rz.indexOf(q) === 0) return 2;
    if (rz.indexOf(q) > 0) return 3;
    return 4;                       // casou por CNPJ
  }

  function sugestoes() {
    const q = D.norm(filters.q).trim();
    if (!q) return { itens: [], total: 0, ocultos: 0 };
    // TODOS os pins — só o termo decide quem entra na lista.
    const todos = S.getAll().filter(function (p) { return D.matchBusca(p, filters.q); });
    /* Ordena SÓ por relevância, sem empurrar os ocultos para o fim: se eles
       fossem para baixo, cairiam abaixo do teto de 8 e a correção não teria
       servido para nada — o ponto que a pessoa procura costuma ser exatamente
       o que o filtro escondeu. */
    todos.sort(function (a, b) {
      const d = scoreSug(a, q) - scoreSug(b, q);
      if (d !== 0) return d;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
    const itens = todos.slice(0, SUG_TETO);
    return {
      itens: itens,
      total: todos.length,
      ocultos: todos.filter(function (p) { return !matches(p); }).length
    };
  }

  function renderSug() {
    const host = document.getElementById('qsug');
    if (!host) return;
    const aberta = document.getElementById('quickbar');
    if (!aberta || !aberta.classList.contains('is-searching') || !filters.q.trim()) {
      host.classList.remove('is-open');
      host.innerHTML = '';
      return;
    }
    // UMA chamada só: `sugestoes()` varre os 6.914 pins do dado real, e isso
    // roda a cada tecla — chamar duas vezes no mesmo render dobrava o trabalho.
    const { itens, total, ocultos } = sugestoes();
    if (!total) {
      host.innerHTML = '<div class="qsug__vazio">Nenhum estabelecimento para ' +
        '“' + escAttr(filters.q) + '”.</div>';
      host.classList.add('is-open');
      return;
    }
    let html = '';
    itens.forEach(function (p) {
      const typ = D.TYPOLOGIES[p.typology] || { emoji: '📍' };
      const origin = D.ORIGINS[p.origin] || { cue: '' };
      const rel = D.relacaoDe(p);
      const glifo = (origin.cue && origin.cue !== 'dashed') ? origin.cue : '';
      const meta = D.BAIRRO_META[p.bairro];
      const cidade = meta ? meta.city + '/' + meta.uf : (p.zone || '');
      const sub = [p.bairro || p.zone, cidade, p.cnpj].filter(Boolean).join(' · ');
      // Marca quem os filtros escondem: a pessoa precisa saber que aquele ponto
      // não está no mapa AGORA, senão o resultado da escolha surpreende.
      const oculto = !matches(p);
      html +=
        '<button type="button" class="qsug__item' + (oculto ? ' qsug__item--oculto' : '') +
          '" role="option" data-sug="' + escAttr(p.id) + '">' +
          '<span class="qsug__emoji" aria-hidden="true">' + typ.emoji + '</span>' +
          '<span class="qsug__body">' +
            '<span class="qsug__nome">' + escAttr(p.name) +
              (oculto ? '<span class="qsug__tag">fora do filtro</span>' : '') + '</span>' +
            '<span class="qsug__sub">' + escAttr(sub) + '</span>' +
          '</span>' +
          '<span class="qsug__dot qsug__dot--' + escAttr(p.origin) + '" style="--pin:' +
            rel.color + '" aria-hidden="true">' + glifo + '</span>' +
        '</button>';
    });
    // Teto NUNCA silencioso: com 6.914 pins um termo curto casa centenas, e
    // mostrar 8 sem dizer quantos sobraram leria como "só existem estes".
    if (total > itens.length || ocultos) {
      let rod = '';
      if (total > itens.length) {
        rod = 'Mostrando ' + itens.length + ' de <strong>' + total + '</strong>';
      }
      if (ocultos) {
        rod += (rod ? ' · ' : '') + '<strong>' + ocultos + '</strong> fora do filtro atual';
      }
      html += '<div class="qsug__mais">' + rod + '</div>';
    }
    host.innerHTML = html;
    host.classList.add('is-open');
  }

  /* Escolher: fecha a busca (o que LIMPA o termo, pela regra da barra), e só
     depois foca e abre. Limpar de propósito — você escolheu UM ponto, e
     continuar com o mapa filtrado ao termo esconderia a vizinhança dele, que é
     justamente o que se quer ver ao chegar. */
  function escolherSug(id) {
    const p = S.getById(id);
    // Precisa ser lido ANTES de fechar a busca: fechar limpa o termo, e sem o
    // termo o ponto pode voltar a caber no filtro — a pergunta mudaria.
    const oculto = p && !matches(p);

    fecharBusca();

    /* Ponto que os filtros escondem entra como EXCEÇÃO VISÍVEL, sem tocar no
       filtro: mexer nos chips por baixo destruiria o recorte que a pessoa
       montou, e é o recorte que ela vai querer de volta depois. */
    if (oculto && window.CRM_MAP && window.CRM_MAP.revelar) {
      window.CRM_MAP.revelar(id);
      if (window.CRM_TOAST) {
        window.CRM_TOAST('Fora dos filtros atuais — mostrando só este ponto.');
      }
    }
    // `false` = sem animação: pode ser outra capital, e salto longo animado
    // desorienta (mesmo argumento do fitTo).
    if (window.CRM_MAP) window.CRM_MAP.focus(id, 17, false);
    if (window.CRM_PIN) window.CRM_PIN.open(id);
    // Desloca o centro para o pin não ficar atrás do sheet que acabou de subir.
    if (window.CRM_MAP && window.CRM_MAP.panToShow) window.CRM_MAP.panToShow(id);
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
  /* Zona virou taxonomia FECHADA em 29/07 (`zona_guardioes_c`): as 15 do
     vocabulário, na ordem em que a operação as lista, + "Sem Zona" no fim.
     Deixou de ser data-driven de propósito — o painel mostra as 16 mesmo que o
     dataset carregado não tenha pin em algumas. Com dado real isso quase não
     acontece (as 15 cobrem 99,6% do recorte); no fictício, sim, e é o preço de
     a supervisão ver a lista de zonas inteira em vez de só o que sobrou. */
  function zoneEntries() {
    return D.ZONA_ORDER.map(function (z) {
      return { key: z, label: z, cls: z === D.SEM_ZONA ? 'chip--sem-valor' : '' };
    });
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
    // PORTE_FILTRO, não PORTE_ORDER: o painel inclui o balde `Sem porte`.
    const porteEntries = D.PORTE_FILTRO.map(function (k) {
      return { key: k, label: D.PORTE[k].label,
               cls: k === D.SEM_PORTE ? 'chip--sem-valor' : '' };
    });
    const stCliEntries = D.STATUS_CLIENTE_ORDER.map(function (k) {
      return { key: k, label: D.STATUS_CLIENTE[k].label, cls: 'chip--stcli chip--sc-' + k };
    });
    // O chip ensina a PISTA, não a cor: o de CNPJ nasce tracejado (CSS) e os
    // outros dois trazem o glifo no rótulo — mesma gramática do marker.
    const origEntries = D.ORIGIN_ORDER.map(function (k) {
      const o = D.ORIGINS[k];
      const glifo = (o.cue && o.cue !== 'dashed') ? o.cue + ' ' : '';
      return { key: k, label: glifo + o.label, cls: 'chip--origin chip--o-' + k };
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
      // "Fase" = o funil. Renomeado em 29/07 para o nome "Status" ficar livre
      // para a relação do cliente, que é o grupo seguinte.
      group('Fase', 'status', statEntries) +
      group('Status do cliente', 'statusCliente', stCliEntries) +
      group('Zona', 'zone', zoneEnts);
    // Listener delegado fica em init() (persiste entre re-renders do innerHTML).
  }

  function buildQuick() {
    const host = document.getElementById('quick-filters');
    if (!host) return;
    // "Aquisição" é PRESET, não dimensão: liga quatro de uma vez (ver PRESET_AQUISICAO).
    // Vem primeiro e em dourado porque é o atalho de intenção, não um recorte.
    let html =
      '<button type="button" class="quick quick--aq" id="btn-aquisicao" aria-pressed="false" ' +
        'title="Oportunidades reais de aquisição — aplica quatro filtros de uma vez">' +
        '🏆 Aquisição' +
      '</button>';
    // Botão "Classificação" abre um popover com todas as tipologias (multi-seleção).
    html +=
      '<button type="button" class="quick quick--class" id="btn-class" aria-expanded="false" aria-haspopup="true">' +
        '<span>🏷️ Classificação</span>' +
        '<span class="quick__badge" id="class-badge"></span>' +
        '<span class="quick__chev" aria-hidden="true">▾</span>' +
      '</button>';
    // 29/07: "🥇 Ouro" e "✓ Validado em campo" saíram da quickbar (seguem no
    // painel completo). Ouro virou parte do preset de Aquisição, e a origem é
    // recorte de procedência — não de intenção de trabalho.
    const quicks = [
      { dim: 'lastVisit', val: 'nao_30', label: '📌 Não visitados 30+' }
    ];
    quicks.forEach(function (q) {
      html += '<button type="button" class="quick" data-quick="1" data-qdim="' + q.dim +
        '" data-qval="' + q.val + '" aria-pressed="false">' + q.label + '</button>';
    });
    host.innerHTML = html;
    host.addEventListener('click', function (ev) {
      if (ev.target.closest('#btn-aquisicao')) { toggleAquisicao(); return; }
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

    /* Busca do mapa. O input NÃO é re-renderizado (isso tiraria o foco a cada
       tecla — armadilha registrada no SPEC 00 §6), então listener direto serve.
       `debounce` porque cada tecla re-filtra as 4 abas e reenquadra o mapa. */
    const lupa = document.getElementById('btn-busca');
    if (lupa) lupa.addEventListener('click', function () { abrirBusca(true); });
    const fechar = document.getElementById('btn-busca-fechar');
    if (fechar) fechar.addEventListener('click', fecharBusca);
    const inp = document.getElementById('map-search');
    if (inp) {
      let t = null;
      inp.addEventListener('input', function () {
        clearTimeout(t);
        const v = inp.value;
        t = setTimeout(function () { setBusca(v, true); }, 220);
      });
      // Enter escolhe a primeira sugestão — o atalho de quem já sabe o que quer.
      inp.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const primeira = sugestoes().itens[0];
        if (primeira) escolherSug(primeira.id);
      });
    }
    /* Lista de sugestões: DELEGAÇÃO, porque ela se redesenha a cada tecla e um
       listener por item morreria no próximo render (regra do SPEC 00 §6).
       `pointerdown` e não `click`: no toque, o `blur` do input chega antes do
       click e o item já teria sido removido — a escolha se perdia. */
    const sug = document.getElementById('qsug');
    if (sug) sug.addEventListener('pointerdown', function (ev) {
      const it = ev.target.closest('[data-sug]');
      if (!it) return;
      ev.preventDefault();
      escolherSug(it.getAttribute('data-sug'));
    });
    /* Tocar no mapa fecha a lista, mas NÃO limpa o termo: quem toca no mapa
       quer ver o mapa (que já está filtrado), não perder a busca. */
    const mapEl = document.getElementById('map');
    if (mapEl) mapEl.addEventListener('pointerdown', function () {
      const s = document.getElementById('qsug');
      if (s) s.classList.remove('is-open');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      closeClass();
      const qb = document.getElementById('quickbar');
      if (qb && qb.classList.contains('is-searching')) fecharBusca();
    });
  }

  window.CRM_FILTERS = {
    init: init,
    reapply: reapply,
    clearAll: clearAll,
    activeCount: activeCount,
    getFiltered: getFiltered,
    matches: matches,
    closeClass: closeClass,
    setBusca: setBusca,
    getBusca: function () { return filters.q; }
  };
})();
