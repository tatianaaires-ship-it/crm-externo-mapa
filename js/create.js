/* =====================================================================
   create.js — Criar pin manual em campo (CAP-4).
   Mínimo: nome + local (toque no mapa). Pin aparece na hora.
   Lead achado na rua => origem "validado em campo".
   ===================================================================== */
(function () {
  'use strict';

  const D = window.CRM_DATA;
  const S = window.CRM_STATE;

  let placing = false;
  let tempMarker = null;
  let banner, modal, form, nameInput, typSel, potSel;

  function nearestZone(lat, lng) {
    let best = 'Recife', bestD = Infinity;
    Object.keys(D.ZONE_CENTERS).forEach(function (z) {
      const c = D.ZONE_CENTERS[z];
      const d = Math.pow(c[0] - lat, 2) + Math.pow(c[1] - lng, 2);
      if (d < bestD) { bestD = d; best = z; }
    });
    return best;
  }

  function tempIcon() {
    return L.divIcon({
      className: 'pin-wrap is-temp',
      html: '<div class="pin pin--temp" style="--pin:#7C3AED;--pin-ink:#4c1d95">' +
              '<div class="pin__body"><span class="pin__emoji">📍</span></div>' +
              '<div class="pin__tip"></div>' +
            '</div>',
      iconSize: [42, 50], iconAnchor: [21, 48]
    });
  }

  function start() {
    if (placing) return;
    if (window.CRM_PIN) window.CRM_PIN.close();
    placing = true;
    document.body.classList.add('is-placing');
    banner.classList.add('is-visible');
    const map = window.CRM_MAP.getMap();
    map.on('click', onMapClick);
  }

  function onMapClick(e) {
    const map = window.CRM_MAP.getMap();
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker(e.latlng, { draggable: true, icon: tempIcon(), zIndexOffset: 1000 }).addTo(map);
    map.off('click', onMapClick); // primeiro toque define; ajuste fino via drag
    banner.classList.remove('is-visible');
    openForm();
  }

  function openForm() {
    nameInput.value = '';
    typSel.value = 'restaurante';
    potSel.value = 'medio';
    modal.classList.add('is-open');
    setTimeout(function () { nameInput.focus(); }, 60);
    validate();
  }

  function validate() {
    const ok = nameInput.value.trim().length > 0;
    form.querySelector('#btn-create-save').disabled = !ok;
    const err = form.querySelector('#create-error');
    if (err) err.classList.toggle('is-visible', !ok && nameInput.value.length > 0);
    return ok;
  }

  function cleanup() {
    const map = window.CRM_MAP.getMap();
    map.off('click', onMapClick);
    if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
    placing = false;
    document.body.classList.remove('is-placing');
    banner.classList.remove('is-visible');
    modal.classList.remove('is-open');
  }

  function cancel() { cleanup(); }

  function save(ev) {
    if (ev) ev.preventDefault();
    if (!validate() || !tempMarker) return;
    const ll = tempMarker.getLatLng();
    const p = S.createPin({
      name: nameInput.value,
      lat: ll.lat, lng: ll.lng,
      typology: typSel.value,
      potential: potSel.value,
      zone: nearestZone(ll.lat, ll.lng)
    });
    cleanup();
    if (p) {
      // Garante que o pin recém-criado apareça mesmo com filtros ativos
      // (AC: "o pin surge no mapa na hora").
      if (window.CRM_FILTERS) window.CRM_FILTERS.clearAll();
      window.CRM_MAP.focus(p.id, Math.max(window.CRM_MAP.getMap().getZoom(), 16));
      if (window.CRM_PIN) window.CRM_PIN.open(p.id);
    }
  }

  function buildSelects() {
    typSel.innerHTML = Object.keys(D.TYPOLOGIES).map(function (k) {
      const t = D.TYPOLOGIES[k];
      return '<option value="' + k + '">' + t.emoji + ' ' + t.label + '</option>';
    }).join('');
    potSel.innerHTML = Object.keys(D.POTENTIALS).map(function (k) {
      return '<option value="' + k + '">' + D.POTENTIALS[k].chip + '</option>';
    }).join('');
  }

  function init() {
    banner = document.getElementById('placing-banner');
    modal = document.getElementById('create-modal');
    form = document.getElementById('create-form');
    nameInput = document.getElementById('create-name');
    typSel = document.getElementById('create-typology');
    potSel = document.getElementById('create-potential');
    buildSelects();

    const fab = document.getElementById('fab-create');
    if (fab) fab.addEventListener('click', start);
    const bcancel = document.getElementById('btn-placing-cancel');
    if (bcancel) bcancel.addEventListener('click', cancel);
    const ccancel = document.getElementById('btn-create-cancel');
    if (ccancel) ccancel.addEventListener('click', cancel);
    if (form) form.addEventListener('submit', save);
    if (nameInput) nameInput.addEventListener('input', validate);
  }

  window.CRM_CREATE = {
    init: init,
    start: start,
    cancel: cancel,
    isPlacing: function () { return placing; }
  };
})();
