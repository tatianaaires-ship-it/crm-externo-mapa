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
    return (
      '<div class="pin pin--' + pin.origin + created + moving + '" style="--pin:' + rel.color + ';--pin-ink:' + rel.ink + '">' +
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
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }
    ).addTo(map);

    // Cluster: agrupa pins próximos — essencial p/ milhares de leads sem travar.
    // Só mantém no DOM os clusters/markers dentro da viewport (removeOutsideVisibleBounds).
    clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,        // adiciona milhares de markers sem bloquear a UI
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16, // zoom alto → pins sempre individuais
      // Raio (px) menor conforme aproxima → bolhas quebram em pins com MENOS zoom.
      // Obs.: markercluster agrupa por PROXIMIDADE (não por contagem), então "≤10 por
      // bolha" não é garantido; raio menor deixa as bolhas bem menores na prática.
      maxClusterRadius: function (zoom) {
        return zoom <= 7 ? 55 : zoom <= 11 ? 34 : 22;
      }
    });
    map.addLayer(clusterGroup);

    // Zoom no topo-direito: o canto inferior-direito é dos FABs (criar / localizar).
    L.control.zoom({ position: 'topright' }).addTo(map);
    addLegend();
    return map;
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

  function attachMarkerEvents(marker, pin) {
    marker.on('click', function () { if (onSelectCb) onSelectCb(pin.id); });
    // Arraste NÃO fica ligado nos markers do cluster (só no pin em modo mover — startMove).
  }

  // Render completo do conjunto filtrado (via cluster group).
  function render(pins, selId) {
    if (selId !== undefined) selectedId = selId;
    const keep = {};
    const toAdd = [];
    pins.forEach(function (pin) {
      keep[pin.id] = true;
      if (pin.id === moveId) return; // o pin em movimento tem marker próprio no mapa (startMove)
      let marker = markersById[pin.id];
      if (!marker) {
        // draggable:false por padrão — só o pin em modo mover vira arrastável (startMove).
        marker = L.marker([pin.lat, pin.lng], { icon: makeIcon(pin), draggable: false, keyboard: false });
        attachMarkerEvents(marker, pin);
        markersById[pin.id] = marker;
        toAdd.push(marker);
      } else {
        marker.setLatLng([pin.lat, pin.lng]);
        marker.setIcon(makeIcon(pin));
      }
    });
    // Remove markers que saíram do filtro (NÃO é exclusão de pin — só ocultação visual).
    const toRemove = [];
    Object.keys(markersById).forEach(function (id) {
      if (!keep[id] && id !== moveId) { toRemove.push(markersById[id]); delete markersById[id]; }
    });
    if (toRemove.length) clusterGroup.removeLayers(toRemove);
    if (toAdd.length) clusterGroup.addLayers(toAdd);   // lote + chunkedLoading = rápido p/ milhares
  }

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
    mv.on('click', function () { if (onSelectCb) onSelectCb(id); });
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
      attachMarkerEvents(m, pin);
      markersById[id] = m;
      clusterGroup.addLayer(m);
      if (window.CRM_PIN) window.CRM_PIN.open(id); // reabre o pin com a nova posição
    }
  }

  function setSelected(id) {
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

  function focus(id, zoom) {
    const p = window.CRM_STATE.getById(id);
    if (!p) return;
    map.setView([p.lat, p.lng], zoom || Math.max(map.getZoom(), 16), { animate: true });
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
