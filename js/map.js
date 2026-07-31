/* =====================================================================
   map.js — Mapa Leaflet + markers.
   - Base cartográfica real (CARTO Positron, dados © OSM).
   - Marker (29/07) = COR da relação comercial (cliente × lead) + PISTA de
     forma da origem/confiança (tracejado · G · ✓). São dois eixos ortogonais
     em canais diferentes: nenhum depende de distinguir matiz (CAP-1).
   - Drag do marker persiste a nova coordenada (CAP-5).
   - Legenda fixa dos dois eixos (CAP-1).
   ===================================================================== */
(function () {
  'use strict';

  const D = window.CRM_DATA;
  let map = null;
  let tileLayer = null;
  const markersById = {};
  let clusterGroup = null;
  let selectedId = null;
  let moveId = null;
  /* Pin REVELADO (29/07) — o ponto que a busca achou mas os filtros escondem.
     Vive FORA do clusterGroup, como o pin em modo mover: assim ele aparece no
     mapa sem entrar em `matches`/`getFiltered`, então o pill "N locais", o
     badge de filtros, o Funil, a Inteligência e as Atividades continuam
     dizendo a verdade sobre o recorte. É o "pin momentâneo": exceção visível
     no mapa, não mudança no filtro. */
  let revealId = null;
  let onSelectCb = null;
  let youMarker = null, youAccuracy = null;
  let onLocateFoundCb = null, onLocateErrorCb = null;

  // Marker sem emoji de tipologia (decisão em aberto — SPEC 01 §3):
  //   COR   = relação comercial (cliente × lead), via --pin
  //   PISTA = degrau MAIS ALTO da origem: tracejado (cnpj) · G · ✓
  // A pista do degrau alto substitui a do baixo — a escada é cumulativa, então
  // um pin com ✓ também tem CNPJ e Google; mostrar as três seria ruído.
  function iconHtml(pin) {
    // Fallback defensivo: origem inesperada (dado real fora do enum) não pode
    // estourar o render — paridade com intel.js/funil.js.
    const origin = D.ORIGINS[pin.origin] || { cue: '' };
    const rel = D.relacaoDe(pin);
    const badge = (origin.cue && origin.cue !== 'dashed')
      ? '<span class="pin__badge" aria-hidden="true">' + origin.cue + '</span>' : '';
    const created = pin.createdByUser ? ' pin--new' : '';
    const moving = pin.id === moveId ? ' pin--moving' : '';
    // Anel tracejado: pista PERMANENTE de que este ponto está fora do recorte.
    // O toast avisa uma vez e some; o anel fica enquanto a exceção existir.
    const reveal = pin.id === revealId ? ' pin--revelado' : '';
    return (
      '<div class="pin pin--' + pin.origin + created + moving + reveal + '" style="--pin:' + rel.color + ';--pin-ink:' + rel.ink + '">' +
        '<div class="pin__body"><span class="pin__dot"></span>' + badge + '</div>' +
        '<div class="pin__tip"></div>' +
      '</div>'
    );
  }

  // 36×40 (corpo 28px) — era 42×50/34px. Âncora = a ponta do tip toca o solo.
  function makeIcon(pin) {
    return L.divIcon({
      className: 'pin-wrap' + (pin.id === selectedId ? ' is-selected' : ''),
      html: iconHtml(pin),
      iconSize: [36, 40],
      iconAnchor: [18, 38]
    });
  }

  function init() {
    map = L.map('map', {
      center: D.MAP_CENTER,
      zoom: D.MAP_ZOOM,
      zoomControl: false,
      minZoom: 4,   // permite ver o Brasil inteiro
      maxZoom: 18,
      attributionControl: true
    });

    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);

    tileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        subdomains: 'abcd',
        maxZoom: 19,
        /* A malha de tiles recalcula no FIM do zoom, não a cada frame da
           animação (default do Leaflet). Durante o gesto ele escala os tiles
           que já tem — só há um borrão breve, e some no lugar de disputar a
           thread principal com o reagrupamento do cluster. */
        updateWhenZooming: false,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }
    ).addTo(map);

    // Cluster: agrupa pins próximos — essencial p/ milhares de leads sem travar.
    // Só mantém no DOM os clusters/markers dentro da viewport (removeOutsideVisibleBounds).
    clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,        // adiciona milhares de markers sem bloquear a UI
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      /* As bolhas trocam na hora em vez de se transformarem. Com 154 clusters
         em tela a animação de split/merge é trabalho por frame em cima do
         reagrupamento — medido: 43% do custo síncrono de um passo de zoom sai
         só com isso (310ms → 177ms em 4 passos). Visualmente é quase
         imperceptível; o zoom do mapa em si continua animado. */
      animate: false,
      /* 19 = acima do maxZoom (18), então na prática NUNCA desliga — sempre
         bolha com contagem, e o spiderfy abre ao tocar.
         Era 16, e o penhasco custava 1.040ms com 6.914 pins: no zoom 16 a
         clusterização desligava inteira e 2.600 markers entravam no DOM de uma
         vez. Pior: o snapshot põe os pins em CENTROIDES DE ZONA, então esses
         2.600 eram desenhados um em cima do outro — um segundo de espera para
         ver um pin e 2.599 escondidos atrás. A bolha mostra mais, não menos.
         Medido depois: 11ms. Voltar para 16 é uma linha, e faz sentido quando o
         geocoding da Fase 4 espalhar os pins de verdade. */
      disableClusteringAtZoom: 19,
      // Raio (px) menor conforme aproxima → bolhas quebram em pins com MENOS zoom.
      // Obs.: markercluster agrupa por PROXIMIDADE (não por contagem), então "≤10 por
      // bolha" não é garantido; raio menor deixa as bolhas bem menores na prática.
      /* O raio do zoom alto subiu de 22 para 40 em 29/07. Com 22 o zoom 15
         gerava 277 bolhas, e criar esse tanto de divIcon a cada passo custava
         ~85ms só de trabalho síncrono. Com 40 são 154 bolhas e 4 passos caem de
         203ms para 99ms. Ficou no MEIO-TERMO de propósito: 60 seria mais rápido
         (59ms) mas deixaria só 54 bolhas, perdendo a granularidade fina que
         esta rampa existe para dar. */
      maxClusterRadius: function (zoom) {
        return zoom <= 7 ? 55 : zoom <= 11 ? 34 : 40;
      }
    });
    /* Um handler para todos os pins do cluster. O plugin renomeia o clique de
       BOLHA para `clusterclick` (e trata ele por dentro: zoom/spiderfy), então
       aqui só chega clique de pin — o `__pinId` é a confirmação, não a
       triagem. */
    clusterGroup.on('click', function (e) {
      const id = e.layer && e.layer.__pinId;
      if (id != null && onSelectCb) onSelectCb(id);
    });
    map.addLayer(clusterGroup);
    suprimirPassadaRedundante(map, clusterGroup);

    // Zoom no topo-direito: o canto inferior-direito é dos FABs (criar / localizar).
    L.control.zoom({ position: 'topright' }).addTo(map);
    addLegend();
    return map;
  }

  /* ---- A passada DUPLA de bolhas por zoom (31/07) ----
     A cada zoom o markercluster refaz o agrupamento duas vezes: uma no
     `zoomend` e outra no `moveend` que o Leaflet dispara logo atrás — com os
     MESMOS bounds e o MESMO zoom. O plugin tem guard para isso
     (`if (this._inZoomAnimation) return`), mas `_inZoomAnimation` só sai de zero
     no caminho ANIMADO do cluster: no ramo `_noAnimation` o `_animationStart` é
     uma função vazia. Ou seja, foi o nosso `animate: false` (29/07) que desarmou
     o guard — a segunda passada é efeito colateral daquela otimização.
     E ela não é inofensiva: medido com 6.914 pins em 8 passos de zoom
     (Recife, 11↔15), a segunda passada REMOVE 117 camadas que a primeira acabou
     de pôr e recria 33 ícones.
       antes:  720 chamadas de addLayer (360 camadas)   577 remoções   393 ícones
       depois: 360 chamadas de addLayer (360 camadas)   460 remoções   360 ícones
     Contagem, não cronômetro, de propósito: nesta máquina o tempo tem ruído de
     ±40% por medida e engole um efeito desse tamanho — a contagem é exata.
     A supressão é condicional: pan de verdade muda os bounds e a passada roda
     normalmente (verificado — o conjunto de bolhas se refaz ao arrastar). */
  function suprimirPassadaRedundante(mapa, grupo) {
    const original = grupo._moveEnd;
    // Se o plugin for atualizado e estes internos mudarem de nome, não mexe em
    // nada: melhor perder a otimização que suprimir a passada errada.
    if (typeof original !== 'function' || typeof grupo._getExpandedVisibleBounds !== 'function') return;
    const filtrado = function () {
      const alvo = this._getExpandedVisibleBounds();
      if (this._currentShownBounds && this._currentShownBounds.equals(alvo)
          && this._zoom === Math.round(this._map._zoom)) return;
      return original.apply(this, arguments);
    };
    /* O Leaflet guarda a REFERÊNCIA da função no `on`, então trocar
       `grupo._moveEnd` não troca o handler já registrado (foi assim que a
       primeira tentativa desta correção mediu "zero diferença"). Desregistra e
       registra de novo — e deixa o `_moveEnd` do objeto coerente, senão o
       `onRemove` do plugin desregistraria a função errada. */
    mapa.off('moveend', original, grupo);
    mapa.on('moveend', filtrado, grupo);
    grupo._moveEnd = filtrado;
  }

  function addLegend() {
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend');
      // Eixo 1 — a COR: relação comercial (cliente × lead).
      let relRows = '';
      D.RELACAO_ORDER.forEach(function (k) {
        const r = D.RELACAO[k];
        relRows +=
          '<div class="legend__row">' +
            '<span class="legend__dot" style="--pin:' + r.color + '"></span>' +
            '<span class="legend__label">' + r.label + '</span>' +
          '</div>';
      });
      // Eixo 2 — a PISTA: origem/confiança. Amostra em cinza NEUTRO de
      // propósito: se pintasse, leria como se a origem tivesse cor de novo.
      let origRows = '';
      D.ORIGIN_ORDER.forEach(function (k) {
        const o = D.ORIGINS[k];
        const mark = o.cue === 'dashed' ? '' : o.cue;
        origRows +=
          '<div class="legend__row">' +
            '<span class="legend__dot legend__dot--' + k + '" style="--pin:#94a3b8">' + mark + '</span>' +
            '<span class="legend__label">' + o.label + '</span>' +
            '<span class="legend__conf">' + o.confidence + '</span>' +
          '</div>';
      });
      div.innerHTML =
        '<button class="legend__toggle" type="button" aria-expanded="true">' +
          '<span>Legenda</span><span class="legend__chev">▾</span>' +
        '</button>' +
        '<div class="legend__body">' +
          '<div class="legend__sub">Cor · relação</div>' + relRows +
          '<div class="legend__sub">Pista · origem &amp; confiança</div>' + origRows +
          // Procedência dos DOIS códigos, na própria legenda que os ensina.
          // Troca de texto em real-mode em vez de sumir: no dado real esses dois
          // campos são verdadeiros (`status = 'Cadastrado'` e os sinais de
          // geolocalização), e repetir "fictício" ali seria mentira ao contrário.
          '<div class="legend__nota legend__nota--fic">⚠️ <strong>Dados fictícios.</strong> ' +
            'Cor e pista são de demonstração — nenhum é cliente ou validação real.</div>' +
          '<div class="legend__nota legend__nota--real">✔ <strong>Procedência real.</strong> ' +
            'Cor vem de <em>Cadastrado</em> no Salesforce; pista, dos sinais de geolocalização.</div>' +
        '</div>';
      L.DomEvent.disableClickPropagation(div);
      const btn = div.querySelector('.legend__toggle');
      btn.addEventListener('click', function () {
        const collapsed = div.classList.toggle('is-collapsed');
        btn.setAttribute('aria-expanded', String(!collapsed));
      });
      return div;
    };
    legend.addTo(map);
  }

  /* ---- Clique: DELEGADO no grupo, não ligado marker por marker ----
     O grupo do cluster é pai de eventos dos filhos, então um handler só atende
     os 6.914 (ver `init`). O marker só carrega o id.
     ⚠️ Isto NÃO é ganho de velocidade — a primeira medição disse 9–15% e estava
     errada: era deriva da máquina, não efeito. Medido de novo com as condições
     INTERCALADAS (7 repetições), o zoom fica igual: −1%, dentro do ruído.
     O que se sustenta é memória: 6.914 handlers por marker custam ~1,5 MB de
     heap (~223 B cada) num heap de ~30 MB. Fica pela memória e por ser um
     handler em vez de milhares — não porque acelere o zoom.
     Arraste NÃO fica ligado nos markers do cluster (só no pin em modo mover). */
  function attachMarkerEvents(marker, pin) {
    marker.__pinId = pin.id;
  }

  /* Markers FORA do cluster (pin revelado, pin em movimento) vivem direto no
     mapa: não têm o grupo como pai de eventos, então precisam do handler
     próprio. São sempre 0 ou 1 — o custo por marker aqui é irrelevante. */
  function attachMarkerEventsSolto(marker, pin) {
    marker.__pinId = pin.id;
    marker.on('click', function () { if (onSelectCb) onSelectCb(pin.id); });
  }

  /* ---- Reposicionamento: só mexe em quem mudou de lugar ----
     Dentro do clusterGroup, `setLatLng` força remoção + reinserção no índice
     espacial e recálculo de cluster. Chamá-lo em TODO pin a cada render custava
     411ms com 6.914 pins parados — e o render roda a cada `reapply()`, ou seja,
     a cada toque de chip de filtro. Com o guard: 1,2ms.
     A coordenada em cache vive no próprio marker (some junto com ele). Cache
     ausente ⇒ reposiciona: a dúvida sempre erra para o lado de atualizar. */
  function lembrarPos(marker, pin) {
    marker.__lat = pin.lat;
    marker.__lng = pin.lng;
  }

  function posicionar(marker, pin) {
    if (marker.__lat === pin.lat && marker.__lng === pin.lng) return;
    lembrarPos(marker, pin);
    marker.setLatLng([pin.lat, pin.lng]);
  }

  // Render completo do conjunto filtrado (via cluster group).
  function render(pins, selId) {
    if (selId !== undefined) selectedId = selId;
    const keep = {};
    const toAdd = [];
    pins.forEach(function (pin) {
      keep[pin.id] = true;
      if (pin.id === moveId) return; // o pin em movimento tem marker próprio no mapa (startMove)
      /* O pin revelado também tem marker próprio, fora do cluster. Se ele
         VOLTOU a caber no filtro (o usuário limpou/alargou), a revelação perdeu
         a razão de existir: dispensa e deixa o fluxo normal recriá-lo, senão
         ficaria com o anel de exceção sem ser exceção. */
      if (pin.id === revealId) { dispensarRevelado(); }
      let marker = markersById[pin.id];
      if (!marker) {
        // draggable:false por padrão — só o pin em modo mover vira arrastável (startMove).
        marker = L.marker([pin.lat, pin.lng], { icon: makeIcon(pin), draggable: false, keyboard: false });
        lembrarPos(marker, pin);
        attachMarkerEvents(marker, pin);
        markersById[pin.id] = marker;
        toAdd.push(marker);
      } else {
        posicionar(marker, pin);
        // setIcon fica sem cache de propósito: custa 4,6ms com 6.914 pins, e
        // `makeIcon` lê selectedId/moveId/revealId além do pin — um cache por
        // pin daria ícone errado ao selecionar.
        marker.setIcon(makeIcon(pin));
      }
    });
    // Remove markers que saíram do filtro (NÃO é exclusão de pin — só ocultação visual).
    const toRemove = [];
    Object.keys(markersById).forEach(function (id) {
      // `revealId` sobrevive à limpeza: ele existe justamente por NÃO estar no
      // conjunto filtrado, então seria removido a cada render.
      if (!keep[id] && id !== moveId && id !== revealId) {
        toRemove.push(markersById[id]); delete markersById[id];
      }
    });
    if (toRemove.length) clusterGroup.removeLayers(toRemove);
    if (toAdd.length) clusterGroup.addLayers(toAdd);   // lote + chunkedLoading = rápido p/ milhares
  }

  /* ---- Pin revelado: mostrar um ponto que os filtros escondem ----
     Existe para o valor central do mapa: ACHAR o ponto. Uma busca que não mostra
     o que achou porque um filtro está ligado não serve — e mexer no filtro por
     baixo seria pior, destruiria o recorte que a pessoa montou. Então o pin
     entra como EXCEÇÃO VISÍVEL: marker próprio fora do cluster, com anel
     tracejado, sem tocar em `matches` nem nas contagens. */
  function revelar(id) {
    const p = window.CRM_STATE.getById(id);
    if (!p || !map) return false;
    dispensarRevelado();
    revealId = id;
    // Se já havia marker (caso raro: acabou de sair do filtro), tira do cluster
    // para não ficarem dois no mesmo ponto.
    const existente = markersById[id];
    if (existente) { clusterGroup.removeLayer(existente); delete markersById[id]; }
    const mk = L.marker([p.lat, p.lng], { icon: makeIcon(p), draggable: false, keyboard: false });
    lembrarPos(mk, p);
    attachMarkerEventsSolto(mk, p);   // fora do cluster ⇒ sem delegação
    mk.addTo(map);            // direto no mapa: fora do cluster, fora do filtro
    markersById[id] = mk;
    return true;
  }

  // Remove o marker de exceção. Não mexe no pin: ele nunca some do dado.
  function dispensarRevelado() {
    if (!revealId) return;
    const mk = markersById[revealId];
    if (mk) { map.removeLayer(mk); delete markersById[revealId]; }
    revealId = null;
  }
  function getRevelado() { return revealId; }

  // ---- Modo mover (CAP-5, acionado por botão dentro do pin) ----
  function startMove(id) {
    const pin = window.CRM_STATE.getById(id);
    if (!pin) return;
    moveId = id;
    document.body.classList.add('is-moving');
    if (window.CRM_PIN) window.CRM_PIN.close();
    // Tira o pin do cluster e cria um marker próprio, arrastável, direto no mapa
    // (fora do cluster p/ não ser reagrupado; o drag só existe neste marker).
    const existing = markersById[id];
    if (existing) clusterGroup.removeLayer(existing);
    const mv = L.marker([pin.lat, pin.lng], { icon: makeIcon(pin), draggable: true, autoPan: true, keyboard: false });
    lembrarPos(mv, pin);
    attachMarkerEventsSolto(mv, pin);   // fora do cluster ⇒ sem delegação
    mv.on('dragstart', function () { document.body.classList.add('is-dragging-pin'); });
    mv.on('dragend', function (e) {
      document.body.classList.remove('is-dragging-pin');
      const ll = e.target.getLatLng();
      window.CRM_STATE.movePin(id, ll.lat, ll.lng); // persiste (CAP-5)
    });
    mv.addTo(map);
    markersById[id] = mv;
    selectedId = id;
    const banner = document.getElementById('move-banner');
    if (banner) banner.classList.add('is-visible');
    focus(id, Math.max(map.getZoom(), 16));
  }

  function endMove() {
    const id = moveId;
    moveId = null;
    document.body.classList.remove('is-moving');
    const banner = document.getElementById('move-banner');
    if (banner) banner.classList.remove('is-visible');
    // Remove o marker de arraste e recria o marker normal (não-arrastável) no cluster.
    if (id && markersById[id]) {
      map.removeLayer(markersById[id]);
      delete markersById[id];
    }
    const pin = id && window.CRM_STATE.getById(id);
    if (pin) {
      const m = L.marker([pin.lat, pin.lng], { icon: makeIcon(pin), draggable: false, keyboard: false });
      lembrarPos(m, pin);   // nasce já na coordenada nova: o render seguinte não mexe
      attachMarkerEvents(m, pin);
      markersById[id] = m;
      clusterGroup.addLayer(m);
      if (window.CRM_PIN) window.CRM_PIN.open(id); // reabre o pin com a nova posição
    }
  }

  function setSelected(id) {
    /* Fim da exceção — mas NÃO no fechamento do sheet.
       ⚠️ Corrigido: antes qualquer `setSelected` diferente do revelado o
       dispensava, inclusive o `null` que o sheet manda ao fechar. Como o sheet
       ocupa 86dvh e cobre o mapa, fechar é justamente o gesto de "quero VER o
       pin" — e o pin sumia na hora. O ponto de todo o recurso é o contrário
       disso. Então: só troca de pin (id não-nulo e diferente) dispensa. */
    if (revealId && id != null && id !== revealId) dispensarRevelado();
    const prev = selectedId;
    selectedId = id;
    // Atualiza só os dois markers afetados (cluster-safe: a maioria nem está no DOM).
    [prev, id].forEach(function (mid) {
      if (!mid || mid === moveId) return;
      const m = markersById[mid];
      const p = window.CRM_STATE.getById(mid);
      if (m && p) m.setIcon(makeIcon(p));
    });
  }

  /* `animar` é opcional e default TRUE — assim o caminho antigo (abrir lead da
     Inteligência) segue exatamente como era no aparelho. A busca passa `false`:
     escolher da lista é SALTO DE CONTEXTO (o ponto pode estar em outra capital),
     e é o único caminho testável aqui, onde animação do Leaflet não roda. */
  function focus(id, zoom, animar) {
    const p = window.CRM_STATE.getById(id);
    if (!p) return;
    map.setView([p.lat, p.lng], zoom || Math.max(map.getZoom(), 16),
      { animate: animar !== false });
  }

  /* Enquadra o conjunto (usado pela busca — CRM_FILTERS.enquadrarNaBusca).
     Sem isto, buscar filtra pins que podem estar em outra capital e a tela
     fica vazia sem dizer por quê. Um resultado só: centra sem colar no zoom
     máximo, que perderia a vizinhança do ponto. */
  function fitTo(pins) {
    if (!map || !pins || !pins.length) return;
    const pts = pins
      .filter(function (p) { return p && p.lat != null && p.lng != null; })
      .map(function (p) { return [p.lat, p.lng]; });
    if (!pts.length) return;

    /* `animate: false` de propósito, por duas razões independentes:
       1. Busca é SALTO DE CONTEXTO, não navegação contínua — animar um pan de
          Recife a Fortaleza (~430 km) desorienta em vez de situar. Quem buscou
          quer estar lá, não ver o caminho.
       2. É o único caminho VERIFICÁVEL aqui: no Browser pane o `transitionend`
          nunca dispara (o pane não compõe frames — mesma causa de o screenshot
          falhar), então toda animação do Leaflet fica presa no estado inicial.
          Medido: com `animate: true` o mapa não saía do lugar em nenhum dos
          casos; sem animação, acerta sempre.
       ⚠️ Isso é limitação do AMBIENTE, não do Leaflet — o `focus()` abaixo é
       animado desde sempre e funciona no Android. Não mexer nele: não tenho
       como testar, e ele já roda no aparelho. */
    if (pts.length === 1) {
      map.setView(pts[0], Math.max(map.getZoom(), 16), { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(pts), { padding: [56, 56], maxZoom: 16, animate: false });
  }

  function panToShow(id) {
    const p = window.CRM_STATE.getById(id);
    if (!p) return;
    // Desloca o centro pra cima pra não ficar atrás do bottom sheet.
    const pt = map.project([p.lat, p.lng], map.getZoom());
    pt.y += Math.round(map.getSize().y * 0.18);
    map.panTo(map.unproject(pt, map.getZoom()), { animate: true });
  }

  // ---- Minha localização (geolocalização do dispositivo) ----
  function locateMe() {
    if (!map) return;
    map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true, timeout: 12000 });
  }
  function onLocationFound(e) {
    if (!youMarker) {
      youAccuracy = L.circle(e.latlng, {
        radius: e.accuracy, interactive: false,
        color: '#2E7DF6', weight: 1, fillColor: '#2E7DF6', fillOpacity: 0.12
      }).addTo(map);
      youMarker = L.circleMarker(e.latlng, {
        radius: 8, color: '#fff', weight: 3, fillColor: '#2E7DF6', fillOpacity: 1
      }).addTo(map);
    } else {
      youAccuracy.setLatLng(e.latlng).setRadius(e.accuracy);
      youMarker.setLatLng(e.latlng);
    }
    if (onLocateFoundCb) onLocateFoundCb(e.latlng);
  }
  function onLocationError(e) {
    if (onLocateErrorCb) onLocateErrorCb((e && e.message) || 'Localização indisponível.');
  }

  window.CRM_MAP = {
    init: init,
    render: render,
    setSelected: setSelected,
    onSelect: function (fn) { onSelectCb = fn; },
    focus: focus,
    fitTo: fitTo,
    revelar: revelar,
    dispensarRevelado: dispensarRevelado,
    getRevelado: getRevelado,
    panToShow: panToShow,
    startMove: startMove,
    endMove: endMove,
    isMoving: function () { return !!moveId; },
    getMap: function () { return map; },
    locateMe: locateMe,
    onLocateFound: function (fn) { onLocateFoundCb = fn; },
    onLocateError: function (fn) { onLocateErrorCb = fn; }
  };
})();
