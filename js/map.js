/* =====================================================================
   map.js — Mapa Leaflet + markers estilizados por origem/confiança.
   - Base cartográfica real (CARTO Positron, dados © OSM).
   - Marker = cor (origem) + emoji (tipologia) + selo ✓ (validado em campo).
     Distinção reforçada por cor + estilo de borda (colorblind-friendly).
   - Drag do marker persiste a nova coordenada (CAP-5).
   - Legenda fixa das 4 categorias (CAP-1).
   ===================================================================== */
(function () {
  'use strict';

  const D = window.CRM_DATA;
  let map = null;
  let tileLayer = null;
  const markersById = {};
  let selectedId = null;
  let moveId = null;
  let onSelectCb = null;

  // Marker em formato padrão (sem emoji): diferenciação só pela ORIGEM
  // (cor + estilo de borda + selo ✓), reforçada de forma não-cromática.
  function iconHtml(pin) {
    const origin = D.ORIGINS[pin.origin];
    const badge = pin.origin === 'validado_campo'
      ? '<span class="pin__badge" aria-hidden="true">✓</span>' : '';
    const created = pin.createdByUser ? ' pin--new' : '';
    const moving = pin.id === moveId ? ' pin--moving' : '';
    return (
      '<div class="pin pin--' + pin.origin + created + moving + '" style="--pin:' + origin.color + ';--pin-ink:' + origin.ink + '">' +
        '<div class="pin__body"><span class="pin__dot"></span>' + badge + '</div>' +
        '<div class="pin__tip"></div>' +
      '</div>'
    );
  }

  function makeIcon(pin) {
    return L.divIcon({
      className: 'pin-wrap' + (pin.id === selectedId ? ' is-selected' : ''),
      html: iconHtml(pin),
      iconSize: [42, 50],
      iconAnchor: [21, 48]
    });
  }

  function init() {
    map = L.map('map', {
      center: D.MAP_CENTER,
      zoom: D.MAP_ZOOM,
      zoomControl: false,
      maxBounds: D.MAP_BOUNDS,
      maxBoundsViscosity: 0.7,
      minZoom: 11,
      maxZoom: 18,
      attributionControl: true
    });

    tileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        subdomains: 'abcd',
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }
    ).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    addLegend();
    return map;
  }

  function addLegend() {
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend');
      let rows = '';
      D.ORIGIN_ORDER.forEach(function (k) {
        const o = D.ORIGINS[k];
        const mark = k === 'validado_campo' ? '✓' : '';
        rows +=
          '<div class="legend__row">' +
            '<span class="legend__dot legend__dot--' + k + '" style="--pin:' + o.color + '">' + mark + '</span>' +
            '<span class="legend__label">' + o.label + '</span>' +
            '<span class="legend__conf">' + o.confidence + '</span>' +
          '</div>';
      });
      div.innerHTML =
        '<button class="legend__toggle" type="button" aria-expanded="true">' +
          '<span>Origem &amp; confiança</span><span class="legend__chev">▾</span>' +
        '</button>' +
        '<div class="legend__body">' + rows + '</div>';
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
    marker.on('dragstart', function () {
      document.body.classList.add('is-dragging-pin');
    });
    marker.on('dragend', function (e) {
      document.body.classList.remove('is-dragging-pin');
      const ll = e.target.getLatLng();
      window.CRM_STATE.movePin(pin.id, ll.lat, ll.lng); // persiste (CAP-5)
    });
  }

  // Garante que o modo de arraste do marker reflita o estado (só o pin em edição).
  function applyDrag(marker, pin) {
    if (!marker.dragging) return;
    if (pin.id === moveId) marker.dragging.enable();
    else marker.dragging.disable();
  }

  // Render completo do conjunto filtrado.
  function render(pins, selId) {
    if (selId !== undefined) selectedId = selId;
    const keep = {};
    pins.forEach(function (pin) {
      keep[pin.id] = true;
      let marker = markersById[pin.id];
      if (!marker) {
        // draggable só liga no modo mover (CAP-5 é acionada por botão no pin).
        marker = L.marker([pin.lat, pin.lng], { icon: makeIcon(pin), draggable: true, autoPan: true, keyboard: false });
        marker.addTo(map);
        attachMarkerEvents(marker, pin);
        markersById[pin.id] = marker;
      } else {
        marker.setLatLng([pin.lat, pin.lng]);
        marker.setIcon(makeIcon(pin));
      }
      applyDrag(markersById[pin.id], pin);
    });
    // Remove markers que saíram do filtro (NÃO é exclusão de pin — só ocultação visual).
    Object.keys(markersById).forEach(function (id) {
      if (!keep[id]) { map.removeLayer(markersById[id]); delete markersById[id]; }
    });
  }

  // ---- Modo mover (CAP-5, acionado por botão dentro do pin) ----
  function startMove(id) {
    const marker = markersById[id];
    if (!marker) return;
    moveId = id;
    document.body.classList.add('is-moving');
    if (window.CRM_PIN) window.CRM_PIN.close();
    marker.setIcon(makeIcon(window.CRM_STATE.getById(id)));
    applyDrag(marker, { id: id });
    const banner = document.getElementById('move-banner');
    if (banner) banner.classList.add('is-visible');
    setSelected(id);
    focus(id, Math.max(map.getZoom(), 16));
  }

  function endMove() {
    const id = moveId;
    moveId = null;
    document.body.classList.remove('is-moving');
    const banner = document.getElementById('move-banner');
    if (banner) banner.classList.remove('is-visible');
    if (id && markersById[id]) {
      markersById[id].setIcon(makeIcon(window.CRM_STATE.getById(id)));
      applyDrag(markersById[id], { id: null });
      if (window.CRM_PIN) window.CRM_PIN.open(id); // reabre o pin com a nova posição
    }
  }

  function setSelected(id) {
    selectedId = id;
    Object.keys(markersById).forEach(function (mid) {
      const el = markersById[mid].getElement();
      if (!el) return;
      el.classList.toggle('is-selected', mid === id);
    });
  }

  function focus(id, zoom) {
    const p = window.CRM_STATE.getById(id);
    if (!p) return;
    map.setView([p.lat, p.lng], zoom || Math.max(map.getZoom(), 16), { animate: true });
  }

  function panToShow(id) {
    const p = window.CRM_STATE.getById(id);
    if (!p) return;
    // Desloca o centro pra cima pra não ficar atrás do bottom sheet.
    const pt = map.project([p.lat, p.lng], map.getZoom());
    pt.y += Math.round(map.getSize().y * 0.18);
    map.panTo(map.unproject(pt, map.getZoom()), { animate: true });
  }

  window.CRM_MAP = {
    init: init,
    render: render,
    setSelected: setSelected,
    onSelect: function (fn) { onSelectCb = fn; },
    focus: focus,
    panToShow: panToShow,
    startMove: startMove,
    endMove: endMove,
    isMoving: function () { return !!moveId; },
    getMap: function () { return map; }
  };
})();
