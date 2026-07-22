/* =====================================================================
   CRM Externo — Protótipo do Mapa
   data.js — Dataset 100% FICTÍCIO ancorado em Recife/PE, Fortaleza/CE e
   João Pessoa/PB. Zero integração real (CNPJá, Google Places, Supabase, n8n).

   Fase 2: objeto LEAD estruturado (núcleo do artefato objeto-lead-fase2.md).
   Campos DERIVADOS (nunca digitados): qualidade (via cnae_tier),
   origem_confianca (pela escada de confiança) e is_converted (via status).
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

  /* ---- Qualidade (Ouro/Prata/Bronze) — DERIVADA do cnae_codigo.
          É o "potencial"/priorização de alvo. Nunca digitada. ---- */
  const QUALIDADE = {
    Ouro:   { key: 'Ouro',   label: 'Ouro',   emoji: '🥇', color: '#C9971B', ink: '#6d5200' },
    Prata:  { key: 'Prata',  label: 'Prata',  emoji: '🥈', color: '#7E8CA0', ink: '#3b4657' },
    Bronze: { key: 'Bronze', label: 'Bronze', emoji: '🥉', color: '#B06A3B', ink: '#5c3419' }
  };
  const QUALIDADE_ORDER = ['Ouro', 'Prata', 'Bronze'];

  /* ---- Porte (natureza/tamanho legal) — chega via CNPJá; dimensão de filtro
          própria (a KR pede "filtrar por porte"). Fictício no protótipo. ---- */
  const PORTE = {
    MEI:  { key: 'MEI',  label: 'MEI',  full: 'Microempreendedor individual' },
    ME:   { key: 'ME',   label: 'ME',   full: 'Microempresa' },
    EPP:  { key: 'EPP',  label: 'EPP',  full: 'Empresa de pequeno porte' },
    LTDA: { key: 'LTDA', label: 'LTDA', full: 'Demais (LTDA / S.A.)' }
  };
  const PORTE_ORDER = ['MEI', 'ME', 'EPP', 'LTDA'];

  /* ---- Status (funil do lead). "cliente" → "convertido" (dispara is_converted).
          Só avança por FLUXO/check-in; nunca por toque solto. Sem "desqualificar". ---- */
  const STATUS = {
    nao_visitado:  { key: 'nao_visitado',  label: 'Não visitado',  color: '#94a3b8' },
    visitado:      { key: 'visitado',      label: 'Visitado',      color: '#0ea5e9' },
    em_negociacao: { key: 'em_negociacao', label: 'Em negociação', color: '#f59e0b' },
    convertido:    { key: 'convertido',    label: 'Convertido',    color: '#10b981' }
  };

  /* ---- Tabela de referência cnae_tier (seed do anexo do artefato).
          Vira tabela editável no Admin (sem código) na plataforma real. ---- */
  const CNAE_TIER = {
    // Ouro (8)
    '5620102': 'Ouro', '5510801': 'Ouro', '5510802': 'Ouro', '5510803': 'Ouro',
    '5620101': 'Ouro', '1099699': 'Ouro', '4639701': 'Ouro', '1096100': 'Ouro',
    // Prata (17)
    '1094500': 'Prata', '5620103': 'Prata', '1092900': 'Prata', '1053800': 'Prata',
    '5590603': 'Prata', '1052000': 'Prata', '5612100': 'Prata', '5611201': 'Prata',
    '5611203': 'Prata', '5611204': 'Prata', '5611205': 'Prata', '4721102': 'Prata',
    '4721103': 'Prata', '5620104': 'Prata', '1091101': 'Prata', '1091102': 'Prata',
    '8230002': 'Prata'
    // Qualquer CNAE fora das listas => Bronze (default em deriveQualidade).
  };

  /* ---- Cache de descrição do CNAE (só os códigos usados no protótipo) ---- */
  const CNAE_DESC = {
    '4721102': 'Padaria e confeitaria com predominância de revenda',
    '5611201': 'Restaurantes e similares',
    '5611203': 'Lanchonetes, casas de chá e de sucos',
    '5611204': 'Bares e estabelecimentos que servem bebidas',
    '4712100': 'Minimercados, mercearias e armazéns',
    '4724500': 'Comércio varejista de hortifrutigranjeiros',
    '5611202': 'Cafeterias',
    '5510801': 'Hotéis',
    '4722901': 'Comércio varejista de carnes — açougues',
    '1053800': 'Fabricação de sorvetes e gelados comestíveis',
    '5620104': 'Fornecimento de alimentos prontos p/ consumo domiciliar',
    '4639701': 'Comércio atacadista de produtos alimentícios',
    '5620101': 'Fornecimento de alimentos prontos p/ empresas'
  };

  /* ---- CNAE default por tipologia (o vendedor não digita CNAE;
          no protótipo ele é semeado a partir da tipologia). ---- */
  const TYPOLOGY_CNAE = {
    padaria:     '4721102', // Prata
    restaurante: '5611201', // Prata
    lanchonete:  '5611203', // Prata
    bar:         '5611204', // Prata
    mercadinho:  '4712100', // Bronze
    hortifruti:  '4724500', // Bronze
    pizzaria:    '5611201', // Prata
    cafeteria:   '5611202', // Bronze
    hotel:       '5510801', // Ouro
    acougue:     '4722901', // Bronze
    sorveteria:  '1053800', // Prata
    marmitaria:  '5620104'  // Prata
  };

  /* ---- Centros aproximados de bairros: Recife/PE (+ RMR), Fortaleza/CE e João Pessoa/PB ---- */
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
    'Jaboatão':      [-8.1655, -34.9155],

    /* Fortaleza/CE */
    'Meireles':           [-3.7300, -38.4950],
    'Aldeota':            [-3.7420, -38.4980],
    'Praia de Iracema':   [-3.7205, -38.5120],
    'Cocó':               [-3.7480, -38.4840],
    'Centro (Fortaleza)': [-3.7270, -38.5270],
    'Varjota':            [-3.7360, -38.4890],

    /* João Pessoa/PB */
    'Tambaú':             [-7.1155, -34.8285],
    'Manaíra':            [-7.0980, -34.8360],
    'Cabo Branco':        [-7.1440, -34.7990],
    'Bessa':              [-7.0810, -34.8380],
    'Bancários':          [-7.1400, -34.8420]
  };
  const ZONES = Object.keys(ZONE_CENTERS);

  /* ---- Cidade/UF/DDD por zona (deriva endereço e DDD do telefone fictícios) ---- */
  const REC = { city: 'Recife', uf: 'PE', ddd: '81' };
  const ZONE_META = {
    'Recife Antigo': REC, 'Boa Vista': REC, 'Santo Amaro': REC, 'Derby': REC,
    'Ilha do Leite': REC, 'Espinheiro': REC, 'Aflitos': REC, 'Graças': REC,
    'Casa Forte': REC, 'Casa Amarela': REC, 'Madalena': REC, 'Torre': REC,
    'Pina': REC, 'Boa Viagem': REC, 'Imbiribeira': REC,
    'Olinda':   { city: 'Olinda',   uf: 'PE', ddd: '81' },
    'Jaboatão': { city: 'Jaboatão', uf: 'PE', ddd: '81' },
    'Meireles':           { city: 'Fortaleza', uf: 'CE', ddd: '85' },
    'Aldeota':            { city: 'Fortaleza', uf: 'CE', ddd: '85' },
    'Praia de Iracema':   { city: 'Fortaleza', uf: 'CE', ddd: '85' },
    'Cocó':               { city: 'Fortaleza', uf: 'CE', ddd: '85' },
    'Centro (Fortaleza)': { city: 'Fortaleza', uf: 'CE', ddd: '85' },
    'Varjota':            { city: 'Fortaleza', uf: 'CE', ddd: '85' },
    'Tambaú':             { city: 'João Pessoa', uf: 'PB', ddd: '83' },
    'Manaíra':            { city: 'João Pessoa', uf: 'PB', ddd: '83' },
    'Cabo Branco':        { city: 'João Pessoa', uf: 'PB', ddd: '83' },
    'Bessa':              { city: 'João Pessoa', uf: 'PB', ddd: '83' },
    'Bancários':          { city: 'João Pessoa', uf: 'PB', ddd: '83' }
  };

  /* Abre no Brasil inteiro; pins nas 3 cidades do NE (Recife, Fortaleza, João Pessoa) */
  const MAP_CENTER = [-13.5, -48.0];
  const MAP_ZOOM = 4;

  /* =====================================================================
     Derivações (funções puras). Compartilhadas por seed + state.
     ===================================================================== */

  // qualidade: Ouro/Prata/Bronze a partir do cnae_codigo (tabela cnae_tier).
  function deriveQualidade(cnae) {
    if (!cnae) return 'Bronze';
    return CNAE_TIER[cnae] || 'Bronze';
  }

  // is_converted: coluna gerada — só facilita filtro, não duplica verdade.
  function deriveIsConverted(status) {
    return status === 'convertido';
  }

  // origem_confianca pela ESCADA (na dúvida, arredonda pra BAIXO).
  // sinais: { fieldValidated, hasCnpj, hasGoogle, matchConfirmed }
  //  1) validado em campo (Máxima) — vence tudo e é monotônico.
  //  2) CNPJá + Google (Alta) — exige match confirmado.
  //  3) Google puro (Média)  >  4) CNPJá puro (Menor)  ← a tese do produto.
  function deriveOrigemConfianca(sig) {
    sig = sig || {};
    if (sig.fieldValidated) return 'validado_campo';
    if (sig.hasCnpj && sig.hasGoogle && sig.matchConfirmed) return 'cnpja_google';
    if (sig.hasGoogle) return 'google_puro';
    if (sig.hasCnpj) return 'cnpja_puro';
    return 'cnpja_puro';
  }

  /* ---- Sementes compactas do núcleo do lead.
          Campos: {n:nome_fantasia, t:tipologia, z:zona, o:origem, s:status,
                   lv:última_visita(ISO|null), note?:nota, cnae?:override}
          qualidade/origem/is_converted são DERIVADOS no buildSeed. ---- */
  const SEED = [
    // ===== Boa Viagem =====
    { n: 'Padaria Maré Alta',            t: 'padaria',     z: 'Boa Viagem',    o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-07-10', note: 'Dono pediu tabela de congelados. Voltar 3ª de manhã.' },
    { n: 'Restaurante Peixe na Brasa',   t: 'restaurante', z: 'Boa Viagem',    o: 'validado_campo', s: 'convertido',    lv: '2026-07-14', note: 'Fechou pedido de hortifruti semanal.' },
    { n: 'Empório Setúbal',              t: 'mercadinho',  z: 'Boa Viagem',    o: 'cnpja_puro',     s: 'nao_visitado',  lv: null,         note: 'Endereço do CNPJ parece antigo — confirmar fachada.', cnae: '4639701' },
    { n: 'Sorveteria Polo Sul',          t: 'sorveteria',  z: 'Boa Viagem',    o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Café da Orla',                 t: 'cafeteria',   z: 'Boa Viagem',    o: 'cnpja_google',   s: 'visitado',      lv: '2026-05-12', note: 'Interessado, mas travou no preço. Reabordar.' },
    { n: 'Pizzaria Forno de Boa Viagem', t: 'pizzaria',    z: 'Boa Viagem',    o: 'google_puro',    s: 'nao_visitado',  lv: null },

    // ===== Pina =====
    { n: 'Bar do Pina',                  t: 'bar',         z: 'Pina',          o: 'validado_campo', s: 'convertido',    lv: '2026-07-09', note: 'Compra cerveja e petiscos toda semana.' },
    { n: 'Marmitaria Sabor do Cais',     t: 'marmitaria',  z: 'Pina',          o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-06-28', cnae: '5620101' },
    { n: 'Hortifruti Verde Pina',        t: 'hortifruti',  z: 'Pina',          o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },

    // ===== Recife Antigo =====
    { n: 'Restaurante Marco Zero',       t: 'restaurante', z: 'Recife Antigo', o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-07-02', note: 'Chef quer amostra de defumados.' },
    { n: 'Bar Paço Alfândega',           t: 'bar',         z: 'Recife Antigo', o: 'google_puro',    s: 'visitado',      lv: '2026-04-20' },
    { n: 'Café Cais do Sertão',          t: 'cafeteria',   z: 'Recife Antigo', o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },

    // ===== Boa Vista / Santo Amaro / Derby / Ilha do Leite =====
    { n: 'Padaria Boa Vista Pão',        t: 'padaria',     z: 'Boa Vista',     o: 'cnpja_google',   s: 'visitado',      lv: '2026-05-30', note: 'Comprou farinha 1x. Fazer follow-up mensal.' },
    { n: 'Lanchonete Central',           t: 'lanchonete',  z: 'Boa Vista',     o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Açougue Santo Amaro',          t: 'acougue',     z: 'Santo Amaro',   o: 'cnpja_puro',     s: 'nao_visitado',  lv: null,         note: 'CNPJ sem número — geolocalizar na visita.' },
    { n: 'Restaurante Derby Grill',      t: 'restaurante', z: 'Derby',         o: 'validado_campo', s: 'convertido',    lv: '2026-07-15', note: 'Cliente âncora do bairro.' },
    { n: 'Mercadinho Ilha do Leite',     t: 'mercadinho',  z: 'Ilha do Leite', o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-06-20' },
    { n: 'Cafeteria do Hospital',        t: 'cafeteria',   z: 'Ilha do Leite', o: 'google_puro',    s: 'nao_visitado',  lv: null },

    // ===== Espinheiro / Aflitos / Graças =====
    { n: 'Padaria Espinheiro',           t: 'padaria',     z: 'Espinheiro',    o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-07-11', note: 'Quer testar linha de frios premium.' },
    { n: 'Restaurante Villa Graças',     t: 'restaurante', z: 'Graças',        o: 'validado_campo', s: 'convertido',    lv: '2026-07-08' },
    { n: 'Bar dos Aflitos',              t: 'bar',         z: 'Aflitos',       o: 'google_puro',    s: 'visitado',      lv: '2026-03-15', note: 'Dono viajando, retornar em agosto.' },
    { n: 'Cafeteria Graças',             t: 'cafeteria',   z: 'Graças',        o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },
    { n: 'Hortifruti Aflitos',           t: 'hortifruti',  z: 'Aflitos',       o: 'cnpja_google',   s: 'visitado',      lv: '2026-06-05' },
    { n: 'Pizzaria Espinheiro',          t: 'pizzaria',    z: 'Espinheiro',    o: 'google_puro',    s: 'nao_visitado',  lv: null },

    // ===== Madalena / Torre =====
    { n: 'Padaria Madalena',             t: 'padaria',     z: 'Madalena',      o: 'validado_campo', s: 'convertido',    lv: '2026-07-13', note: 'Pediu antecipar entrega de véspera de feriado.' },
    { n: 'Bar da Torre',                 t: 'bar',         z: 'Torre',         o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-07-01' },
    { n: 'Marmitaria Torre',             t: 'marmitaria',  z: 'Torre',         o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },
    { n: 'Mercadinho Madalena',          t: 'mercadinho',  z: 'Madalena',      o: 'google_puro',    s: 'visitado',      lv: '2026-02-10', note: 'Sem giro no último trimestre. Reavaliar.' },
    { n: 'Sorveteria Madalena Gelato',   t: 'sorveteria',  z: 'Madalena',      o: 'cnpja_google',   s: 'nao_visitado',  lv: null },

    // ===== Casa Forte / Casa Amarela =====
    { n: 'Restaurante Casa Forte',       t: 'restaurante', z: 'Casa Forte',    o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-06-30', note: 'Aguardando aprovação do sócio.' },
    { n: 'Padaria Jardim Casa Forte',    t: 'padaria',     z: 'Casa Forte',    o: 'validado_campo', s: 'convertido',    lv: '2026-07-06' },
    { n: 'Açougue Casa Amarela',         t: 'acougue',     z: 'Casa Amarela',  o: 'cnpja_puro',     s: 'nao_visitado',  lv: null,         note: 'Endereço do CNPJ diverge do Google. Validar.' },
    { n: 'Hortifruti Casa Amarela',      t: 'hortifruti',  z: 'Casa Amarela',  o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Lanchonete Casa Forte',        t: 'lanchonete',  z: 'Casa Forte',    o: 'cnpja_puro',     s: 'visitado',      lv: '2026-05-05' },

    // ===== Imbiribeira =====
    { n: 'Restaurante Imbiribeira',      t: 'restaurante', z: 'Imbiribeira',   o: 'cnpja_google',   s: 'visitado',      lv: '2026-06-25' },
    { n: 'Padaria Imbiribeira Pão Quente', t: 'padaria',   z: 'Imbiribeira',   o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Bar do Aeroporto',             t: 'bar',         z: 'Imbiribeira',   o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },

    // ===== Olinda (metropolitana) =====
    { n: 'Restaurante Alto da Sé',       t: 'restaurante', z: 'Olinda',        o: 'validado_campo', s: 'convertido',    lv: '2026-07-12', note: 'Ponto turístico, alto volume no fim de semana.' },
    { n: 'Bar do Carmo',                 t: 'bar',         z: 'Olinda',        o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-06-29' },
    { n: 'Padaria Quatro Cantos',        t: 'padaria',     z: 'Olinda',        o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Sorveteria Olinda',            t: 'sorveteria',  z: 'Olinda',        o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },
    { n: 'Hotel Pousada dos Milagres',   t: 'hotel',       z: 'Olinda',        o: 'cnpja_google',   s: 'visitado',      lv: '2026-05-20', note: 'Café da manhã do hotel — potencial de padaria + frios.' },

    // ===== Jaboatão (metropolitana) =====
    { n: 'Mercadinho Piedade',           t: 'mercadinho',  z: 'Jaboatão',      o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },
    { n: 'Restaurante Praia de Piedade', t: 'restaurante', z: 'Jaboatão',      o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Hotel Piedade Praia',          t: 'hotel',       z: 'Jaboatão',      o: 'validado_campo', s: 'convertido',    lv: '2026-07-07', note: 'Rede pequena, avaliar as outras 2 unidades.' },

    // ===== Fortaleza / CE =====
    { n: 'Padaria Meireles',             t: 'padaria',     z: 'Meireles',           o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-07-10', note: 'Quer testar linha de frios. Voltar quinta de manhã.' },
    { n: 'Restaurante Beira Mar',        t: 'restaurante', z: 'Meireles',           o: 'validado_campo', s: 'convertido',    lv: '2026-07-13', note: 'Alto volume no fim de semana.' },
    { n: 'Bar Praia de Iracema',         t: 'bar',         z: 'Praia de Iracema',   o: 'cnpja_google',   s: 'visitado',      lv: '2026-06-22' },
    { n: 'Cafeteria Aldeota',            t: 'cafeteria',   z: 'Aldeota',            o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Mercadinho Cocó',              t: 'mercadinho',  z: 'Cocó',               o: 'cnpja_puro',     s: 'nao_visitado',  lv: null,         note: 'Endereço do CNPJ parece antigo — confirmar fachada.' },
    { n: 'Pizzaria Varjota',             t: 'pizzaria',    z: 'Varjota',            o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Hortifruti do Centro',         t: 'hortifruti',  z: 'Centro (Fortaleza)', o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },
    { n: 'Sorveteria Aldeota',           t: 'sorveteria',  z: 'Aldeota',            o: 'cnpja_google',   s: 'visitado',      lv: '2026-05-18' },

    // ===== João Pessoa / PB =====
    { n: 'Restaurante Tambaú Mar',       t: 'restaurante', z: 'Tambaú',             o: 'validado_campo', s: 'convertido',    lv: '2026-07-11', note: 'Fechou hortifruti semanal.' },
    { n: 'Padaria Manaíra',              t: 'padaria',     z: 'Manaíra',            o: 'cnpja_google',   s: 'em_negociacao', lv: '2026-07-03' },
    { n: 'Bar do Cabo Branco',           t: 'bar',         z: 'Cabo Branco',        o: 'google_puro',    s: 'nao_visitado',  lv: null },
    { n: 'Cafeteria Bessa',              t: 'cafeteria',   z: 'Bessa',              o: 'cnpja_google',   s: 'visitado',      lv: '2026-06-14' },
    { n: 'Marmitaria Bancários',         t: 'marmitaria',  z: 'Bancários',          o: 'cnpja_puro',     s: 'nao_visitado',  lv: null },
    { n: 'Mercadinho Manaíra',           t: 'mercadinho',  z: 'Manaíra',            o: 'cnpja_puro',     s: 'nao_visitado',  lv: null,         note: 'CNPJ sem número — geolocalizar na visita.' },
    { n: 'Hotel Tambaú',                 t: 'hotel',       z: 'Tambaú',             o: 'cnpja_google',   s: 'visitado',      lv: '2026-05-25', note: 'Café da manhã — potencial de padaria + frios.' },
    { n: 'Sorveteria Cabo Branco',       t: 'sorveteria',  z: 'Cabo Branco',        o: 'google_puro',    s: 'nao_visitado',  lv: null }
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
  function fakePhone(i, ddd) {
    const n = 90000000 + (i * 12347) % 9999999;
    const s = String(n);
    return `(${ddd || '81'}) 9${s.slice(0, 4)}-${s.slice(4, 8)}`;
  }
  const RAZAO_SUFFIX = [
    ' Comércio de Alimentos LTDA',
    ' Alimentos e Bebidas LTDA',
    ' Com. de Alimentos EIRELI',
    ' Restaurante e Lanchonete LTDA'
  ];
  function fakeRazao(name, i) {
    return name + RAZAO_SUFFIX[i % RAZAO_SUFFIX.length];
  }

  function buildSeed() {
    return SEED.map(function (r, i) {
      const c = ZONE_CENTERS[r.z] || MAP_CENTER;
      const meta = ZONE_META[r.z] || REC;
      const lat = +(c[0] + jitter(i * 3 + 1, 0.014)).toFixed(6);
      const lng = +(c[1] + jitter(i * 5 + 2, 0.014)).toFixed(6);
      const hasCnpj = r.o !== 'google_puro';
      const cnae = r.cnae || TYPOLOGY_CNAE[r.t] || null;
      const status = r.s;
      const isConverted = deriveIsConverted(status);
      const validado = r.o === 'validado_campo';

      const pin = {
        id: 'p' + pad(i + 1),
        // Núcleo do lead (nomes internos = 1:1 dos campos canônicos do artefato)
        name: r.n,                                   // nome_fantasia
        razaoSocial: hasCnpj ? fakeRazao(r.n, i) : null,
        cnpj: hasCnpj ? fakeCnpj(i + 1) : null,
        cnaeCodigo: cnae,
        cnaeDescricao: cnae ? (CNAE_DESC[cnae] || '—') : null,
        typology: r.t,                               // tipologia
        address: `${r.z}, ${meta.city}/${meta.uf} (fictício)`, // endereco
        lat: lat, lng: lng,                          // geo_original
        geoVerificado: validado ? { lat: lat, lng: lng } : null,
        zone: r.z,                                   // zona_id
        origin: r.o,                                 // origem_confianca (derivada; seed = resultado da escada)
        status: status,                              // status (funil)
        motivoStatus: null,
        qualidade: deriveQualidade(cnae),            // DERIVADA do cnae_codigo
        porte: hasCnpj ? PORTE_ORDER[(i * 3 + 1) % 4] : null,
        vendedor: 'Pedro Rocha',
        lastVisit: r.lv || null,                     // ultima_visita
        convertedAt: isConverted ? (r.lv || null) : null,
        contaId: isConverted ? ('c' + pad(i + 1)) : null,
        phone: fakePhone(i + 1, meta.ddd),           // telefone (fictício)
        isConverted: isConverted,                    // coluna gerada
        // Relações / net-new
        notes: [],
        checkins: [],
        createdByUser: false
      };

      if (r.note) pin.notes.push({ text: r.note, ts: (r.lv || '2026-06-01') + 'T10:15:00' });
      // Pins validados em campo carregam um check-in histórico (reforça CAP-6)
      if (validado && r.lv) {
        pin.checkins.push({ in: r.lv + 'T09:30:00', out: r.lv + 'T10:05:00' });
      }
      return pin;
    });
  }

  window.CRM_DATA = {
    ORIGINS: ORIGINS,
    ORIGIN_ORDER: ORIGIN_ORDER,
    TYPOLOGIES: TYPOLOGIES,
    QUALIDADE: QUALIDADE,
    QUALIDADE_ORDER: QUALIDADE_ORDER,
    PORTE: PORTE,
    PORTE_ORDER: PORTE_ORDER,
    STATUS: STATUS,
    CNAE_TIER: CNAE_TIER,
    CNAE_DESC: CNAE_DESC,
    TYPOLOGY_CNAE: TYPOLOGY_CNAE,
    ZONES: ZONES,
    ZONE_CENTERS: ZONE_CENTERS,
    MAP_CENTER: MAP_CENTER,
    MAP_ZOOM: MAP_ZOOM,
    ZONE_META: ZONE_META,
    // Derivações (puras)
    deriveQualidade: deriveQualidade,
    deriveIsConverted: deriveIsConverted,
    deriveOrigemConfianca: deriveOrigemConfianca,
    buildSeed: buildSeed
  };
})();
