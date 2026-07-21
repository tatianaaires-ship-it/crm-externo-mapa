/* =====================================================================
   state.js — Store em memória + persistência (localStorage).
   Fonte única de verdade dos pins. Emite eventos de mudança.
   Constraint: NUNCA existe operação de excluir pin (o pin nunca some).
   ===================================================================== */
(function () {
  'use strict';

  const KEY = 'crm-externo-map:v2'; // v2: dataset com Recife + Fortaleza + João Pessoa
  const D = window.CRM_DATA;

  let pins = [];
  const listeners = [];

  function emit() {
    persist();
    listeners.forEach(function (fn) { try { fn(pins); } catch (e) { console.error(e); } });
  }
  function onChange(fn) { listeners.push(fn); }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, pins: pins }));
    } catch (e) { console.warn('Persistência indisponível:', e); }
  }

  function load() {
    let restored = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.pins) && parsed.pins.length) restored = parsed.pins;
      }
    } catch (e) { console.warn('Falha ao ler persistência:', e); }
    pins = restored || D.buildSeed();
    if (!restored) persist();
  }

  function resetDemo() {
    pins = D.buildSeed();
    emit();
  }

  /* ---- Leitura ---- */
  function getAll() { return pins.slice(); }
  function getById(id) { return pins.find(function (p) { return p.id === id; }) || null; }

  /* ---- Utilidades de data ---- */
  function nowISO() { return new Date().toISOString(); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  /* ---- Mutações ---- */
  function addNote(id, text) {
    const p = getById(id);
    if (!p || !text || !text.trim()) return null;
    p.notes.unshift({ text: text.trim(), ts: nowISO() });
    emit();
    return p;
  }

  function movePin(id, lat, lng) {
    const p = getById(id);
    if (!p) return null;
    p.lat = +(+lat).toFixed(6);
    p.lng = +(+lng).toFixed(6);
    emit();
    return p;
  }

  function openCheckin(id) {
    const p = getById(id);
    if (!p) return null;
    return p.checkins.find(function (c) { return !c.out; }) || null;
  }

  function checkIn(id) {
    const p = getById(id);
    if (!p) return null;
    if (openCheckin(id)) return p; // já existe um aberto
    p.checkins.unshift({ in: nowISO(), out: null });
    // Um check-in é uma visita: registra e marca como visitado.
    p.lastVisit = todayISO();
    if (p.visitStatus === 'nao_visitado') p.visitStatus = 'visitado';
    emit();
    return p;
  }

  function checkOut(id) {
    const p = getById(id);
    if (!p) return null;
    const open = openCheckin(id);
    if (!open) return p;
    open.out = nowISO();
    emit();
    return p;
  }

  function nextId() {
    let max = 0;
    pins.forEach(function (p) {
      const n = parseInt(String(p.id).replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return 'p' + String(max + 1).padStart(3, '0');
  }

  // Criar pin manual (CAP-4): mínimo = nome + local.
  // Lead achado na rua pelo vendedor => origem "validado em campo".
  function createPin(data) {
    if (!data || !data.name || !data.name.trim()) return null;
    const meta = (D.ZONE_META && D.ZONE_META[data.zone]) || { city: 'Recife', uf: 'PE' };
    const p = {
      id: nextId(),
      name: data.name.trim(),
      typology: data.typology || 'restaurante',
      zone: data.zone || 'Recife',
      potential: data.potential || 'medio',
      origin: 'validado_campo',
      visitStatus: 'nao_visitado',
      lastVisit: null,
      lat: +(+data.lat).toFixed(6),
      lng: +(+data.lng).toFixed(6),
      cnpj: null,
      phone: null,
      address: (data.zone ? data.zone + ', ' : '') + meta.city + '/' + meta.uf + ' (criado em campo)',
      notes: [],
      checkins: [],
      createdByUser: true
    };
    pins.push(p);
    emit();
    return p;
  }

  window.CRM_STATE = {
    load: load,
    onChange: onChange,
    getAll: getAll,
    getById: getById,
    addNote: addNote,
    movePin: movePin,
    checkIn: checkIn,
    checkOut: checkOut,
    openCheckin: openCheckin,
    createPin: createPin,
    resetDemo: resetDemo
  };
})();
