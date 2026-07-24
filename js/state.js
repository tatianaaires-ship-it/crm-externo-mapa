/* =====================================================================
   state.js — Store em memória + persistência (localStorage).
   Fonte única de verdade dos pins. Emite eventos de mudança.
   Constraint: NUNCA existe operação de excluir pin (o pin nunca some).
   ===================================================================== */
(function () {
  'use strict';

  const KEY = 'crm-externo-map:v3'; // v3: objeto Lead estruturado (20 campos + derivados)
  const D = window.CRM_DATA;

  let pins = [];
  let realMode = false;   // dado real (porteiro) — NUNCA persiste no localStorage
  const listeners = [];

  function emit() {
    persist();
    listeners.forEach(function (fn) { try { fn(pins); } catch (e) { console.error(e); } });
  }
  function onChange(fn) { listeners.push(fn); }

  function persist() {
    if (realMode) return;   // dado real fica só em memória (privacidade)
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 3, pins: pins }));
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
    realMode = false;       // volta ao fictício (e volta a persistir)
    pins = D.buildSeed();
    emit();
  }

  // Troca o dataset para o snapshot real vindo do porteiro (auth.js).
  // Não persiste (privacidade) e não deriva nada — os pins já chegam prontos.
  function useRealData(realPins) {
    if (!Array.isArray(realPins) || !realPins.length) return false;
    realMode = true;
    pins = realPins;
    emit();
    return true;
  }
  function isRealMode() { return realMode; }

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

  // Promove a origem para "validado em campo" (monotônico — nunca regride).
  // Corrigir/confirmar em campo é o sinal mais alto da escada de confiança.
  function promoteToFieldValidated(p) {
    p.origin = D.deriveOrigemConfianca({ fieldValidated: true });
  }

  function movePin(id, lat, lng) {
    const p = getById(id);
    if (!p) return null;
    p.lat = +(+lat).toFixed(6);
    p.lng = +(+lng).toFixed(6);
    // Corrigir localização = coordenada verificada em campo (grava geo_verificado)
    // e sobe o pin na escada de confiança.
    p.geoVerificado = { lat: p.lat, lng: p.lng };
    promoteToFieldValidated(p);
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
    if (p.status === 'nao_visitado') p.status = 'visitado';
    // Presença confirmada => sobe na escada de confiança (monotônico).
    promoteToFieldValidated(p);
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

  // Move o lead entre colunas do funil (casca do Kanban — arrastar em memória).
  // NOTA de domínio: no produto real o status avança por FLUXO/check-in, não por
  // toque solto. Aqui é afordância de protótipo (demonstra a visão de funil).
  function setStatus(id, status) {
    const p = getById(id);
    if (!p || !D.STATUS[status] || p.status === status) return null;
    p.status = status;
    p.isConverted = (status === 'convertido');
    if (status === 'convertido' && !p.convertedAt) p.convertedAt = todayISO();
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

  // Criar pin manual (CAP-4): básico = nome + local; expandir = cnpj, tipologia, telefone.
  // Lead achado na rua pelo vendedor => origem "validado em campo" (derivada).
  // Nasce SEMPRE "nao_visitado" — status só anda por fluxo/check-in (não no form).
  function createPin(data) {
    if (!data || !data.name || !data.name.trim()) return null;
    const meta = (D.ZONE_META && D.ZONE_META[data.zone]) || { city: 'Recife', uf: 'PE' };
    const typology = data.typology || 'restaurante';
    const cnae = D.TYPOLOGY_CNAE[typology] || null;
    const cnpj = (data.cnpj && data.cnpj.trim()) ? data.cnpj.trim() : null;
    const phone = (data.phone && data.phone.trim()) ? data.phone.trim() : null;
    const lat = +(+data.lat).toFixed(6);
    const lng = +(+data.lng).toFixed(6);
    const p = {
      id: nextId(),
      name: data.name.trim(),                       // nome_fantasia
      razaoSocial: null,                            // chega via CNPJá (Fase 3)
      cnpj: cnpj,
      cnaeCodigo: cnae,
      cnaeDescricao: cnae ? (D.CNAE_DESC[cnae] || '—') : null,
      typology: typology,
      address: (data.zone ? data.zone + ', ' : '') + meta.city + '/' + meta.uf + ' (criado em campo)',
      lat: lat, lng: lng,                           // geo_original
      geoVerificado: { lat: lat, lng: lng },        // marcado em campo = já verificado
      zone: data.zone || 'Recife',
      origin: D.deriveOrigemConfianca({ fieldValidated: true }), // validado_campo
      status: 'nao_visitado',
      motivoStatus: null,
      qualidade: D.deriveQualidade(cnae),           // DERIVADA da tipologia (via CNAE default)
      porte: null,                                  // chega via CNPJá (Fase 3)
      vendedor: 'Pedro Rocha',
      lastVisit: null,
      convertedAt: null,
      contaId: null,
      phone: phone,
      isConverted: false,
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
    setStatus: setStatus,
    resetDemo: resetDemo,
    useRealData: useRealData,
    isRealMode: isRealMode
  };
})();
