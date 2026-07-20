/* =====================================================================
   CRM Externo — Protótipo do Mapa
   data.js — Dataset 100% FICTÍCIO ancorado em Recife/PE.
   Zero integração real (CNPJá, Google Places, Supabase, n8n).
   ===================================================================== */
(function () {
  'use strict';

  /* ---- Categorias de origem/confiança (companion origem-confiabilidade) ---- */
  // Ordem = confiabilidade crescente (nível 1..4).
  const ORIGINS = {
    cnpja_puro: {
      key: 'cnpja_puro', label: 'CNPJá puro', short: 'CNPJá',
      level: 1, confidence: 'Menor', color: '#8A94A6', ink: '#3d434f',
      desc: 'Só base de CNPJ, sem cruzamento — endereço pode estar desatualizado.'
    },
    google_puro: {
      key: 'google_puro', label: 'Google puro', short: 'Google',
      level: 2, confidence: 'Média', color: '#2E7DF6', ink: '#0b3a86',
      desc: 'Só Google, sem CNPJ associado — localização provável, cadastro incompleto.'
    },
    cnpja_google: {
      key: 'cnpja_google', label: 'CNPJá + Google', short: 'Cruzado',
      level: 3, confidence: 'Alta', color: '#12B981', ink: '#065f42',
      desc: 'CNPJ cruzado com Google — dois cruzamentos concordam.'
    },
    validado_campo: {
      key: 'validado_campo', label: 'Validado em campo', short: 'Campo',
      level: 4, confidence: 'Máxima', color: '#7C3AED', ink: '#4c1d95',
      desc: 'Confirmado presencialmente pelo vendedor (check-in / correção).'
    }
  };
  const ORIGIN_ORDER = ['cnpja_puro', 'google_puro', 'cnpja_google', 'validado_campo'];

  /* ---- Tipologias (buyers de food service — contexto Praso) ---- */
  const TYPOLOGIES = {
    padaria:     { key: 'padaria',     label: 'Padaria',     emoji: '🥖' },
    restaurante: { key: 'restaurante', label: 'Restaurante', emoji: '🍽️' },
    lanchonete:  { key: 'lanchonete',  label: 'Lanchonete',  emoji: '🍔' },
    bar:         { key: 'bar',         label: 'Bar',         emoji: '🍺' },
    mercadinho:  { key: 'mercadinho',  label: 'Mercadinho',  emoji: '🛒' },
    hortifruti:  { key: 'hortifruti',  label: 'Hortifruti',  emoji: '🥬' },
    pizzaria:    { key: 'pizzaria',    label: 'Pizzaria',    emoji: '🍕' },
    cafeteria:   { key: 'cafeteria',   label: 'Cafeteria',   emoji: '☕' },
    hotel:       { key: 'hotel',       label: 'Hotel',       emoji: '🏨' },
    acougue:     { key: 'acougue',     label: 'Açougue',     emoji: '🥩' },
    sorveteria:  { key: 'sorveteria',  label: 'Sorveteria',  emoji: '🍦' },
    marmitaria:  { key: 'marmitaria',  label: 'Marmitaria',  emoji: '🍱' }
  };

  const POTENTIALS = {
    alto:  { key: 'alto',  label: 'Alto potencial',  chip: 'Alto',  color: '#e11d48' },
    medio: { key: 'medio', label: 'Médio potencial', chip: 'Médio', color: '#d97706' },
    baixo: { key: 'baixo', label: 'Baixo potencial', chip: 'Baixo', color: '#64748b' }
  };

  const VISIT_STATUS = {
    nao_visitado:  { key: 'nao_visitado',  label: 'Não visitado',  color: '#94a3b8' },
    visitado:      { key: 'visitado',      label: 'Visitado',      color: '#0ea5e9' },
    em_negociacao: { key: 'em_negociacao', label: 'Em negociação', color: '#f59e0b' },
    cliente:       { key: 'cliente',       label: 'Cliente',       color: '#10b981' }
  };

  /* ---- Centros aproximados de bairros de Recife/PE + região metropolitana ---- */
  const ZONE_CENTERS = {
    'Recife Antigo': [-8.0630, -34.8712],
    'Boa Vista':     [-8.0575, -34.8880],
    'Santo Amaro':   [-8.0470, -34.8815],
    'Derby':         [-8.0560, -34.8945],
    'Ilha do Leite': [-8.0655, -34.8955],
    'Espinheiro':    [-8.0430, -34.8965],
    'Aflitos':       [-8.0400, -34.9000],
    'Graças':        [-8.0470, -34.9010],
    'Casa Forte':    [-8.0330, -34.9180],
    'Casa Amarela':  [-8.0235, -34.9210],
    'Madalena':      [-8.0540, -34.9110],
    'Torre':         [-8.0480, -34.9130],
    'Pina':          [-8.0910, -34.8830],
    'Boa Viagem':    [-8.1235, -34.9010],
    'Imbiribeira':   [-8.1105, -34.9200],
    'Olinda':        [-7.9990, -34.8425],
    'Jaboatão':      [-8.1655, -34.9155]
  };
  const ZONES = Object.keys(ZONE_CENTERS);

  /* Recife como centro do mapa */
  const MAP_CENTER = [-8.0680, -34.8930];
  const MAP_ZOOM = 13;
  const MAP_BOUNDS = [[-8.22, -35.02], [-7.94, -34.80]]; // aprox. RMR p/ conter o drag

  /* ---- Sementes compactas: {n:nome, t:tipologia, z:zona, p:potencial,
          o:origem, s:status, lv:últVisita(ISO|null), note?:nota} ---- */
  const SEED = [
    // Boa Viagem
    { n: 'Padaria Maré Alta',        t: 'padaria',     z: 'Boa Viagem',    p: 'alto',  o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-07-10', note: 'Dono pediu tabela de congelados. Voltar 3ª de manhã.' },
    { n: 'Restaurante Peixe na Brasa', t: 'restaurante', z: 'Boa Viagem',  p: 'alto',  o: 'validado_campo', s: 'cliente',       lv: '2026-07-14', note: 'Fechou pedido de hortifruti semanal.' },
    { n: 'Empório Setúbal',          t: 'mercadinho',  z: 'Boa Viagem',    p: 'medio', o: 'cnpja_puro',     s: 'nao_visitado',  lv: null,         note: 'Endereço do CNPJ parece antigo — confirmar fachada.' },
    { n: 'Sorveteria Polo Sul',      t: 'sorveteria',  z: 'Boa Viagem',    p: 'baixo', o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Café da Orla',             t: 'cafeteria',   z: 'Boa Viagem',    p: 'medio', o: 'cnpja_google',   s: 'visitado',      lv: '2026-05-12', note: 'Interessado, mas travou no preço. Reabordar.' },
    { n: 'Pizzaria Forno de Boa Viagem', t: 'pizzaria', z: 'Boa Viagem',  p: 'alto',  o: 'google_puro',    s: 'nao_visitado',  lv: null },

    // Pina
    { n: 'Bar do Pina',              t: 'bar',         z: 'Pina',          p: 'alto',  o: 'validado_campo', s: 'cliente',       lv: '2026-07-09', note: 'Compra cerveja e petiscos toda semana.' },
    { n: 'Marmitaria Sabor do Cais', t: 'marmitaria',  z: 'Pina',          p: 'medio', o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-06-28' },
    { n: 'Hortifruti Verde Pina',    t: 'hortifruti',  z: 'Pina',          p: 'medio', o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },

    // Recife Antigo
    { n: 'Restaurante Marco Zero',   t: 'restaurante', z: 'Recife Antigo', p: 'alto',  o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-07-02', note: 'Chef quer amostra de defumados.' },
    { n: 'Bar Paço Alfândega',       t: 'bar',         z: 'Recife Antigo', p: 'medio', o: 'google_puro',    s: 'visitado',      lv: '2026-04-20' },
    { n: 'Café Cais do Sertão',      t: 'cafeteria',   z: 'Recife Antigo', p: 'baixo', o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },

    // Boa Vista / Santo Amaro / Derby / Ilha do Leite
    { n: 'Padaria Boa Vista Pão',    t: 'padaria',     z: 'Boa Vista',     p: 'alto',  o: 'cnpja_google',   s: 'visitado',      lv: '2026-05-30', note: 'Comprou farinha 1x. Fazer follow-up mensal.' },
    { n: 'Lanchonete Central',       t: 'lanchonete',  z: 'Boa Vista',     p: 'medio', o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Açougue Santo Amaro',      t: 'acougue',     z: 'Santo Amaro',   p: 'medio', o: 'cnpja_puro',     s: 'nao_visitado',  lv: null,         note: 'CNPJ sem número — geolocalizar na visita.' },
    { n: 'Restaurante Derby Grill',  t: 'restaurante', z: 'Derby',         p: 'alto',  o: 'validado_campo', s: 'cliente',       lv: '2026-07-15', note: 'Cliente âncora do bairro.' },
    { n: 'Mercadinho Ilha do Leite', t: 'mercadinho',  z: 'Ilha do Leite', p: 'medio', o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-06-20' },
    { n: 'Cafeteria do Hospital',    t: 'cafeteria',   z: 'Ilha do Leite', p: 'baixo', o: 'google_puro',    s: 'nao_visitado',  lv: null },

    // Espinheiro / Aflitos / Graças
    { n: 'Padaria Espinheiro',       t: 'padaria',     z: 'Espinheiro',    p: 'alto',  o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-07-11', note: 'Quer testar linha de frios premium.' },
    { n: 'Restaurante Villa Graças', t: 'restaurante', z: 'Graças',        p: 'alto',  o: 'validado_campo', s: 'cliente',       lv: '2026-07-08' },
    { n: 'Bar dos Aflitos',          t: 'bar',         z: 'Aflitos',       p: 'medio', o: 'google_puro',    s: 'visitado',      lv: '2026-03-15', note: 'Dono viajando, retornar em agosto.' },
    { n: 'Cafeteria Graças',         t: 'cafeteria',   z: 'Graças',        p: 'medio', o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },
    { n: 'Hortifruti Aflitos',       t: 'hortifruti',  z: 'Aflitos',       p: 'baixo', o: 'cnpja_google',   s: 'visitado',      lv: '2026-06-05' },
    { n: 'Pizzaria Espinheiro',      t: 'pizzaria',    z: 'Espinheiro',    p: 'medio', o: 'google_puro',    s: 'nao_visitado',  lv: null },

    // Madalena / Torre
    { n: 'Padaria Madalena',         t: 'padaria',     z: 'Madalena',      p: 'alto',  o: 'validado_campo', s: 'cliente',       lv: '2026-07-13', note: 'Pediu antecipar entrega de véspera de feriado.' },
    { n: 'Bar da Torre',             t: 'bar',         z: 'Torre',         p: 'alto',  o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-07-01' },
    { n: 'Marmitaria Torre',         t: 'marmitaria',  z: 'Torre',         p: 'medio', o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },
    { n: 'Mercadinho Madalena',      t: 'mercadinho',  z: 'Madalena',      p: 'medio', o: 'google_puro',    s: 'visitado',      lv: '2026-02-10', note: 'Sem giro no último trimestre. Reavaliar.' },
    { n: 'Sorveteria Madalena Gelato', t: 'sorveteria', z: 'Madalena',    p: 'baixo', o: 'cnpja_google',   s: 'nao_visitado',  lv: null },

    // Casa Forte / Casa Amarela
    { n: 'Restaurante Casa Forte',   t: 'restaurante', z: 'Casa Forte',    p: 'alto',  o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-06-30', note: 'Aguardando aprovação do sócio.' },
    { n: 'Padaria Jardim Casa Forte', t: 'padaria',    z: 'Casa Forte',    p: 'medio', o: 'validado_campo', s: 'cliente',       lv: '2026-07-06' },
    { n: 'Açougue Casa Amarela',     t: 'acougue',     z: 'Casa Amarela',  p: 'medio', o: 'cnpja_puro',     s: 'nao_visitado',  lv: null,         note: 'Endereço do CNPJ diverge do Google. Validar.' },
    { n: 'Hortifruti Casa Amarela',  t: 'hortifruti',  z: 'Casa Amarela',  p: 'baixo', o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Lanchonete Casa Forte',    t: 'lanchonete',  z: 'Casa Forte',    p: 'baixo', o: 'cnpja_puro',     s: 'visitado',      lv: '2026-05-05' },

    // Imbiribeira
    { n: 'Restaurante Imbiribeira',  t: 'restaurante', z: 'Imbiribeira',   p: 'medio', o: 'cnpja_google',   s: 'visitado',      lv: '2026-06-25' },
    { n: 'Padaria Imbiribeira Pão Quente', t: 'padaria', z: 'Imbiribeira', p: 'alto',  o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Bar do Aeroporto',         t: 'bar',         z: 'Imbiribeira',   p: 'medio', o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },

    // Olinda (metropolitana)
    { n: 'Restaurante Alto da Sé',   t: 'restaurante', z: 'Olinda',        p: 'alto',  o: 'validado_campo', s: 'cliente',       lv: '2026-07-12', note: 'Ponto turístico, alto volume no fim de semana.' },
    { n: 'Bar do Carmo',             t: 'bar',         z: 'Olinda',        p: 'alto',  o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-06-29' },
    { n: 'Padaria Quatro Cantos',    t: 'padaria',     z: 'Olinda',        p: 'medio', o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Sorveteria Olinda',        t: 'sorveteria',  z: 'Olinda',        p: 'baixo', o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },
    { n: 'Hotel Pousada dos Milagres', t: 'hotel',     z: 'Olinda',        p: 'alto',  o: 'cnpja_google',   s: 'visitado',      lv: '2026-05-20', note: 'Café da manhã do hotel — potencial de padaria + frios.' },

    // Jaboatão (metropolitana)
    { n: 'Mercadinho Piedade',       t: 'mercadinho',  z: 'Jaboatão',      p: 'medio', o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },
    { n: 'Restaurante Praia de Piedade', t: 'restaurante', z: 'Jaboatão',  p: 'alto',  o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Hotel Piedade Praia',      t: 'hotel',       z: 'Jaboatão',      p: 'alto',  o: 'validado_campo', s: 'cliente',       lv: '2026-07-07', note: 'Rede pequena, avaliar as outras 2 unidades.' }
  ];

  /* ---- Expansão determinística: coords jitteradas + campos derivados ---- */
  function pad(n) { return String(n).padStart(3, '0'); }
  function jitter(i, span) {
    // pseudo-aleatório determinístico por índice (sem Math.random p/ estabilidade)
    const a = ((i * 2654435761) % 1000) / 1000 - 0.5;
    return a * span;
  }
  function fakeCnpj(i) {
    const base = 10000000 + (i * 73939) % 89999999;
    const s = String(base).padStart(8, '0');
    return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/0001-${String((i * 7 + 11) % 90 + 10)}`;
  }
  function fakePhone(i) {
    const n = 90000000 + (i * 12347) % 9999999;
    const s = String(n);
    return `(81) 9${s.slice(0, 4)}-${s.slice(4, 8)}`;
  }

  function buildSeed() {
    return SEED.map(function (r, i) {
      const c = ZONE_CENTERS[r.z] || MAP_CENTER;
      const lat = +(c[0] + jitter(i * 3 + 1, 0.014)).toFixed(6);
      const lng = +(c[1] + jitter(i * 5 + 2, 0.014)).toFixed(6);
      const hasCnpj = r.o !== 'google_puro';
      const pin = {
        id: 'p' + pad(i + 1),
        name: r.n,
        typology: r.t,
        zone: r.z,
        potential: r.p,
        origin: r.o,
        visitStatus: r.s,
        lastVisit: r.lv || null,
        lat: lat, lng: lng,
        cnpj: hasCnpj ? fakeCnpj(i + 1) : null,
        phone: fakePhone(i + 1),
        address: `${r.z}, Recife/PE (fictício)`,
        notes: [],
        checkins: [],
        createdByUser: false
      };
      if (r.note) pin.notes.push({ text: r.note, ts: (r.lv || '2026-06-01') + 'T10:15:00' });
      // Pins validados em campo carregam um check-in histórico (reforça CAP-6)
      if (r.o === 'validado_campo' && r.lv) {
        pin.checkins.push({ in: r.lv + 'T09:30:00', out: r.lv + 'T10:05:00' });
      }
      return pin;
    });
  }

  window.CRM_DATA = {
    ORIGINS: ORIGINS,
    ORIGIN_ORDER: ORIGIN_ORDER,
    TYPOLOGIES: TYPOLOGIES,
    POTENTIALS: POTENTIALS,
    VISIT_STATUS: VISIT_STATUS,
    ZONES: ZONES,
    ZONE_CENTERS: ZONE_CENTERS,
    MAP_CENTER: MAP_CENTER,
    MAP_ZOOM: MAP_ZOOM,
    MAP_BOUNDS: MAP_BOUNDS,
    buildSeed: buildSeed
  };
})();
