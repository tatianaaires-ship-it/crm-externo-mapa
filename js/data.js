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

  /* ---- Vendedores fictícios. Não há auth por usuário até a Fase 4: o
          `responsavel` da tarefa é DERIVADO (herda o do pin; se nulo, o criador
          da sessão). Semear isto é o que faz o recorte "por vendedor" da visão
          gerencial (CAP-13) existir de verdade no gate. ---- */
  /* `cor`: paleta CATEGÓRICA de vendedor, usada nos gráficos empilhados por dia.
     Validada nos 5 checks (luminosidade, croma, daltonismo ΔE 11.3, visão
     normal ΔE 27.7, contraste ≥3:1) — nenhum WARN. Não reusa cor de status:
     status é reservado, vendedor é identidade. A cor é presa ao ID, nunca à
     posição na lista — filtrar não pode repintar quem sobrou. */
  const VENDEDORES = {
    v1: { id: 'v1', nome: 'Pedro Rocha',  cor: '#6d28d9' },
    v2: { id: 'v2', nome: 'Aline Souza',  cor: '#db2777' },
    v3: { id: 'v3', nome: 'Caio Bezerra', cor: '#65a30d' }
  };
  const VENDEDOR_ORDER = ['v1', 'v2', 'v3'];
  const VENDEDOR_SESSAO = 'v1';   // "quem sou eu" — mock de sessão até a Fase 4

  /* ---- Status (funil). 8 valores, 7 colunas — `sem_plano` NÃO vai ao board.
          O funil é o PIPELINE DE TRABALHO, não a base: o pin entra quando ganha
          uma visita planejada e sai se o plano for cancelado.
          NUNCA é digitado — três fontes (ver docs/objetos/estabelecimento.md §5):
            entrada  : existe tarefa planejada?      (reversível)
            campo    : resultado de tarefa concluída (monotônico)
            comercial: ERP (cadastro/pedido)         — PREVALECE
          Cores: SPEC 00 §2.6. `sem_plano` não tem cor de board (usa o --muted). ---- */
  const STATUS = {
    sem_plano:        { key: 'sem_plano',        label: 'Sem plano',        color: '#64748b', board: false, family: 'entrada'   },
    visita_planejada: { key: 'visita_planejada', label: 'Visita planejada', color: '#94a3b8', board: true,  family: 'entrada'   },
    visitado:         { key: 'visitado',         label: 'Visitado',         color: '#0ea5e9', board: true,  family: 'campo'     },
    td_encontrado:    { key: 'td_encontrado',    label: 'TD encontrado',    color: '#f59e0b', board: true,  family: 'campo'     },
    csc:              { key: 'csc',              label: 'CSC',              color: '#14b8a6', board: true,  family: 'comercial' },
    aquisicao:        { key: 'aquisicao',        label: 'Aquisição',        color: '#10b981', board: true,  family: 'comercial' },
    perdido:          { key: 'perdido',          label: 'Perdido',          color: '#9f1239', board: true,  family: 'lateral'   },
    desqualificado:   { key: 'desqualificado',   label: 'Desqualificado',   color: '#475569', board: true,  family: 'lateral'   }
  };
  const STATUS_ORDER = ['sem_plano', 'visita_planejada', 'visitado', 'td_encontrado', 'csc', 'aquisicao', 'perdido', 'desqualificado'];
  // Colunas do Kanban (7) — sem_plano fica fora; as laterais vêm por último.
  const STATUS_BOARD = STATUS_ORDER.filter(function (k) { return STATUS[k].board; });
  // Escada monotônica: índice maior nunca regride. Laterais ficam FORA dela.
  const ESCADA = ['sem_plano', 'visita_planejada', 'visitado', 'td_encontrado', 'csc', 'aquisicao'];

  /* =====================================================================
     TAREFA (= atividade datada; check-in/out É a própria tarefa).
     Contrato: docs/objetos/tarefa.md · Tela: docs/telas/spec-07-atividades.md
     ===================================================================== */

  /* ---- tipo: o PROPÓSITO da atividade (o efeito é do `resultado`). ---- */
  const TAREFA_TIPO = {
    primeira_visita: { key: 'primeira_visita', label: '1ª visita',   emoji: '🚩' },
    follow_up:       { key: 'follow_up',       label: 'Follow-up',   emoji: '🔁' },
    recorrencia:     { key: 'recorrencia',     label: 'Recorrência', emoji: '🗓️' }
  };
  const TAREFA_TIPO_ORDER = ['primeira_visita', 'follow_up', 'recorrencia'];

  /* ---- status: ciclo de vida da tarefa (≠ resultado, que é o desfecho).
          Não se deleta tarefa — cancela-se. ---- */
  const TAREFA_STATUS = {
    planejada: { key: 'planejada', label: 'Planejada' },
    realizada: { key: 'realizada', label: 'Realizada' },
    cancelada: { key: 'cancelada', label: 'Cancelada' }
  };

  /* ---- resultado: 4 valores. `status` aqui É a tabela de mapeamento
          resultado → status do estabelecimento (tarefa.md §5) — mantida como
          DADO para não haver um `switch` escondido em algum lugar.
          NÃO existe `convertido`: conversão vem do ERP, não de tarefa.
          Cor = a do status homônimo (SPEC 00 §2.6), sem escala nova. ---- */
  // `label` é o REGISTRO (histórico, relatório); `acao` é o BOTÃO de escolha no
  // check-out. Sem os dois, a gerencial mostraria "Desqualificar 3" — verbo no
  // imperativo descrevendo fato passado.
  const RESULTADO = {
    sem_avanco:     { key: 'sem_avanco',     label: 'Sem avanço',     acao: 'Sem avanço',     status: 'visitado',       color: STATUS.visitado.color,       motivo: null },
    td_encontrado:  { key: 'td_encontrado',  label: 'TD encontrado',  acao: 'TD encontrado',  status: 'td_encontrado',  color: STATUS.td_encontrado.color,  motivo: null },
    perdido:        { key: 'perdido',        label: 'Perdido',        acao: 'Perdido',        status: 'perdido',        color: STATUS.perdido.color,        motivo: 'perda' },
    desqualificado: { key: 'desqualificado', label: 'Desqualificado', acao: 'Desqualificar',  status: 'desqualificado', color: STATUS.desqualificado.color, motivo: 'desqualificacao' }
  };
  const RESULTADO_ORDER = ['sem_avanco', 'td_encontrado', 'perdido', 'desqualificado'];

  /* ---- Motivos: dois vocabulários FECHADOS e separados. Perder é a
          negociação morrer; desqualificar é o ponto não ser oportunidade. ---- */
  const MOTIVO_PERDA = {
    preco:                   'Preço',
    compra_do_concorrente:   'Compra do concorrente',
    sem_interesse:           'Sem interesse',
    sem_contato_com_decisor: 'Sem contato com o decisor',
    credito_reprovado:       'Crédito reprovado',
    outro:                   'Outro'
  };
  const MOTIVO_DESQUALIFICACAO = {
    nao_existe_no_endereco:  'Não existe no endereço',
    fora_do_perfil:          'Fora do perfil',
    fechado_definitivamente: 'Fechado definitivamente',
    endereco_e_residencia:   'Endereço é residência',
    duplicado:               'Duplicado',
    outro:                   'Outro'
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

  // cadastrado: existe registro comercial? A verdade virá do ERP; no protótipo
  // deriva de data_cadastro. Substitui o antigo is_converted como "é cliente?".
  function deriveCadastrado(dataCadastro) {
    return !!dataCadastro;
  }

  // Escada comercial — vem do ERP e PREVALECE sobre o status de campo:
  //   cadastrado sem 1ª compra -> csc ; com 1ª compra -> aquisicao ; senão null.
  // `aquisicao` é sticky (marco, não saúde: quem para de comprar continua nela;
  // a deterioração aparece em statusCliente).
  function deriveStatusComercial(dataCadastro, dataPrimeiraCompra) {
    if (dataPrimeiraCompra) return 'aquisicao';
    if (dataCadastro) return 'csc';
    return null;
  }

  // status final do funil: o ERP vence o campo. Quem tem pedido está em
  // aquisicao mesmo que a última tarefa tenha dado perdido.
  function resolveStatus(statusCampo, dataCadastro, dataPrimeiraCompra) {
    return deriveStatusComercial(dataCadastro, dataPrimeiraCompra) || statusCampo || 'sem_plano';
  }

  // Avanço monotônico DENTRO da escada. Laterais (perdido/desqualificado) ficam
  // fora dela — não são regressão, são saída lateral, e guardam statusAnterior.
  function statusAvanca(atual, novo) {
    const a = ESCADA.indexOf(atual), b = ESCADA.indexOf(novo);
    if (a < 0 || b < 0) return true;   // envolve lateral => quem chama decide
    return b > a;
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
    { n: 'Padaria Maré Alta',            t: 'padaria',     z: 'Boa Viagem',    o: 'cnpja_google',   s: 'td_encontrado', lv: '2026-07-10', note: 'Dono pediu tabela de congelados. Voltar 3ª de manhã.' },
    { n: 'Restaurante Peixe na Brasa',   t: 'restaurante', z: 'Boa Viagem',    o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-14', note: 'Fechou pedido de hortifruti semanal.' },
    { n: 'Empório Setúbal',              t: 'mercadinho',  z: 'Boa Viagem',    o: 'cnpja_puro',     s: 'sem_plano',  lv: null,         note: 'Endereço do CNPJ parece antigo — confirmar fachada.', cnae: '4639701' },
    { n: 'Sorveteria Polo Sul',          t: 'sorveteria',  z: 'Boa Viagem',    o: 'google_puro',    s: 'sem_plano',  lv: null },
    { n: 'Café da Orla',                 t: 'cafeteria',   z: 'Boa Viagem',    o: 'cnpja_google',   s: 'visitado',      lv: '2026-05-12', note: 'Interessado, mas travou no preço. Reabordar.' },
    { n: 'Pizzaria Forno de Boa Viagem', t: 'pizzaria',    z: 'Boa Viagem',    o: 'google_puro',    s: 'sem_plano',  lv: null },

    // ===== Pina =====
    { n: 'Bar do Pina',                  t: 'bar',         z: 'Pina',          o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-09', note: 'Compra cerveja e petiscos toda semana.' },
    { n: 'Marmitaria Sabor do Cais',     t: 'marmitaria',  z: 'Pina',          o: 'cnpja_google',   s: 'td_encontrado', lv: '2026-06-28', cnae: '5620101' },
    { n: 'Hortifruti Verde Pina',        t: 'hortifruti',  z: 'Pina',          o: 'cnpja_puro',     s: 'sem_plano',  lv: null },

    // ===== Recife Antigo =====
    { n: 'Restaurante Marco Zero',       t: 'restaurante', z: 'Recife Antigo', o: 'cnpja_google',   s: 'td_encontrado', lv: '2026-07-02', note: 'Chef quer amostra de defumados.' },
    { n: 'Bar Paço Alfândega',           t: 'bar',         z: 'Recife Antigo', o: 'google_puro',    s: 'visitado',      lv: '2026-04-20' },
    { n: 'Café Cais do Sertão',          t: 'cafeteria',   z: 'Recife Antigo', o: 'cnpja_puro',     s: 'sem_plano',  lv: null },

    // ===== Boa Vista / Santo Amaro / Derby / Ilha do Leite =====
    { n: 'Padaria Boa Vista Pão',        t: 'padaria',     z: 'Boa Vista',     o: 'cnpja_google',   s: 'visitado',      lv: '2026-05-30', note: 'Comprou farinha 1x. Fazer follow-up mensal.' },
    { n: 'Lanchonete Central',           t: 'lanchonete',  z: 'Boa Vista',     o: 'google_puro',    s: 'sem_plano',  lv: null },
    { n: 'Açougue Santo Amaro',          t: 'acougue',     z: 'Santo Amaro',   o: 'cnpja_puro',     s: 'sem_plano',  lv: null,         note: 'CNPJ sem número — geolocalizar na visita.' },
    { n: 'Restaurante Derby Grill',      t: 'restaurante', z: 'Derby',         o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-15', note: 'Cliente âncora do bairro.' },
    { n: 'Mercadinho Ilha do Leite',     t: 'mercadinho',  z: 'Ilha do Leite', o: 'cnpja_google',   s: 'td_encontrado', lv: '2026-06-20' },
    { n: 'Cafeteria do Hospital',        t: 'cafeteria',   z: 'Ilha do Leite', o: 'google_puro',    s: 'sem_plano',  lv: null },

    // ===== Espinheiro / Aflitos / Graças =====
    { n: 'Padaria Espinheiro',           t: 'padaria',     z: 'Espinheiro',    o: 'cnpja_google',   s: 'td_encontrado', lv: '2026-07-11', note: 'Quer testar linha de frios premium.' },
    { n: 'Restaurante Villa Graças',     t: 'restaurante', z: 'Graças',        o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-08' },
    { n: 'Bar dos Aflitos',              t: 'bar',         z: 'Aflitos',       o: 'google_puro',    s: 'visitado',      lv: '2026-03-15', note: 'Dono viajando, retornar em agosto.' },
    { n: 'Cafeteria Graças',             t: 'cafeteria',   z: 'Graças',        o: 'cnpja_puro',     s: 'sem_plano',  lv: null },
    { n: 'Hortifruti Aflitos',           t: 'hortifruti',  z: 'Aflitos',       o: 'cnpja_google',   s: 'visitado',      lv: '2026-06-05' },
    { n: 'Pizzaria Espinheiro',          t: 'pizzaria',    z: 'Espinheiro',    o: 'google_puro',    s: 'sem_plano',  lv: null },

    // ===== Madalena / Torre =====
    { n: 'Padaria Madalena',             t: 'padaria',     z: 'Madalena',      o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-13', note: 'Pediu antecipar entrega de véspera de feriado.' },
    { n: 'Bar da Torre',                 t: 'bar',         z: 'Torre',         o: 'cnpja_google',   s: 'td_encontrado', lv: '2026-07-01' },
    { n: 'Marmitaria Torre',             t: 'marmitaria',  z: 'Torre',         o: 'cnpja_puro',     s: 'sem_plano',  lv: null },
    { n: 'Mercadinho Madalena',          t: 'mercadinho',  z: 'Madalena',      o: 'google_puro',    s: 'visitado',      lv: '2026-02-10', note: 'Sem giro no último trimestre. Reavaliar.' },
    { n: 'Sorveteria Madalena Gelato',   t: 'sorveteria',  z: 'Madalena',      o: 'cnpja_google',   s: 'sem_plano',  lv: null },

    // ===== Casa Forte / Casa Amarela =====
    { n: 'Restaurante Casa Forte',       t: 'restaurante', z: 'Casa Forte',    o: 'cnpja_google',   s: 'td_encontrado', lv: '2026-06-30', note: 'Aguardando aprovação do sócio.' },
    { n: 'Padaria Jardim Casa Forte',    t: 'padaria',     z: 'Casa Forte',    o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-06' },
    { n: 'Açougue Casa Amarela',         t: 'acougue',     z: 'Casa Amarela',  o: 'cnpja_puro',     s: 'sem_plano',  lv: null,         note: 'Endereço do CNPJ diverge do Google. Validar.' },
    { n: 'Hortifruti Casa Amarela',      t: 'hortifruti',  z: 'Casa Amarela',  o: 'google_puro',    s: 'sem_plano',  lv: null },
    { n: 'Lanchonete Casa Forte',        t: 'lanchonete',  z: 'Casa Forte',    o: 'cnpja_puro',     s: 'visitado',      lv: '2026-05-05' },

    // ===== Imbiribeira =====
    { n: 'Restaurante Imbiribeira',      t: 'restaurante', z: 'Imbiribeira',   o: 'cnpja_google',   s: 'visitado',      lv: '2026-06-25' },
    { n: 'Padaria Imbiribeira Pão Quente', t: 'padaria',   z: 'Imbiribeira',   o: 'google_puro',    s: 'sem_plano',  lv: null },
    { n: 'Bar do Aeroporto',             t: 'bar',         z: 'Imbiribeira',   o: 'cnpja_puro',     s: 'sem_plano',  lv: null },

    // ===== Olinda (metropolitana) =====
    { n: 'Restaurante Alto da Sé',       t: 'restaurante', z: 'Olinda',        o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-12', note: 'Ponto turístico, alto volume no fim de semana.' },
    { n: 'Bar do Carmo',                 t: 'bar',         z: 'Olinda',        o: 'cnpja_google',   s: 'td_encontrado', lv: '2026-06-29' },
    { n: 'Padaria Quatro Cantos',        t: 'padaria',     z: 'Olinda',        o: 'google_puro',    s: 'sem_plano',  lv: null },
    { n: 'Sorveteria Olinda',            t: 'sorveteria',  z: 'Olinda',        o: 'cnpja_puro',     s: 'sem_plano',  lv: null },
    { n: 'Hotel Pousada dos Milagres',   t: 'hotel',       z: 'Olinda',        o: 'cnpja_google',   s: 'visitado',      lv: '2026-05-20', note: 'Café da manhã do hotel — potencial de padaria + frios.' },

    // ===== Jaboatão (metropolitana) =====
    { n: 'Mercadinho Piedade',           t: 'mercadinho',  z: 'Jaboatão',      o: 'cnpja_puro',     s: 'sem_plano',  lv: null },
    { n: 'Restaurante Praia de Piedade', t: 'restaurante', z: 'Jaboatão',      o: 'google_puro',    s: 'sem_plano',  lv: null },
    { n: 'Hotel Piedade Praia',          t: 'hotel',       z: 'Jaboatão',      o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-07', note: 'Rede pequena, avaliar as outras 2 unidades.' },

    // ===== Fortaleza / CE =====
    { n: 'Padaria Meireles',             t: 'padaria',     z: 'Meireles',           o: 'cnpja_google',   s: 'td_encontrado', lv: '2026-07-10', note: 'Quer testar linha de frios. Voltar quinta de manhã.' },
    { n: 'Restaurante Beira Mar',        t: 'restaurante', z: 'Meireles',           o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-13', note: 'Alto volume no fim de semana.' },
    { n: 'Bar Praia de Iracema',         t: 'bar',         z: 'Praia de Iracema',   o: 'cnpja_google',   s: 'visitado',      lv: '2026-06-22' },
    { n: 'Cafeteria Aldeota',            t: 'cafeteria',   z: 'Aldeota',            o: 'google_puro',    s: 'sem_plano',  lv: null },
    { n: 'Mercadinho Cocó',              t: 'mercadinho',  z: 'Cocó',               o: 'cnpja_puro',     s: 'sem_plano',  lv: null,         note: 'Endereço do CNPJ parece antigo — confirmar fachada.' },
    { n: 'Pizzaria Varjota',             t: 'pizzaria',    z: 'Varjota',            o: 'google_puro',    s: 'sem_plano',  lv: null },
    { n: 'Hortifruti do Centro',         t: 'hortifruti',  z: 'Centro (Fortaleza)', o: 'cnpja_puro',     s: 'sem_plano',  lv: null },
    { n: 'Sorveteria Aldeota',           t: 'sorveteria',  z: 'Aldeota',            o: 'cnpja_google',   s: 'visitado',      lv: '2026-05-18' },

    // ===== João Pessoa / PB =====
    { n: 'Restaurante Tambaú Mar',       t: 'restaurante', z: 'Tambaú',             o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-11', note: 'Fechou hortifruti semanal.' },
    { n: 'Padaria Manaíra',              t: 'padaria',     z: 'Manaíra',            o: 'cnpja_google',   s: 'td_encontrado', lv: '2026-07-03' },
    { n: 'Bar do Cabo Branco',           t: 'bar',         z: 'Cabo Branco',        o: 'google_puro',    s: 'sem_plano',  lv: null },
    { n: 'Cafeteria Bessa',              t: 'cafeteria',   z: 'Bessa',              o: 'cnpja_google',   s: 'visitado',      lv: '2026-06-14' },
    { n: 'Marmitaria Bancários',         t: 'marmitaria',  z: 'Bancários',          o: 'cnpja_puro',     s: 'sem_plano',  lv: null },
    { n: 'Mercadinho Manaíra',           t: 'mercadinho',  z: 'Manaíra',            o: 'cnpja_puro',     s: 'sem_plano',  lv: null,         note: 'CNPJ sem número — geolocalizar na visita.' },
    { n: 'Hotel Tambaú',                 t: 'hotel',       z: 'Tambaú',             o: 'cnpja_google',   s: 'visitado',      lv: '2026-05-25', note: 'Café da manhã — potencial de padaria + frios.' },
    { n: 'Sorveteria Cabo Branco',       t: 'sorveteria',  z: 'Cabo Branco',        o: 'google_puro',    s: 'sem_plano',  lv: null }
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
      const validado = r.o === 'validado_campo';

      // Escada comercial fictícia (o ERP é quem manda — ver §5 do objeto).
      // 1 em cada 3 clientes fica em CSC (cadastrado, compra não comprovada),
      // para que a coluna CSC tenha cards no board.
      const cliente = !!r.conv;
      const soCadastro = cliente && (i % 3 === 0);
      const dataCadastro = cliente ? (r.lv || '2026-06-01') : null;
      const dataPrimeiraCompra = (cliente && !soCadastro) ? (r.lv || '2026-06-01') : null;
      const cadastrado = deriveCadastrado(dataCadastro);
      // r.s é só o status DE CAMPO; o comercial prevalece quando existe.
      const status = resolveStatus(r.s, dataCadastro, dataPrimeiraCompra);
      const vendId = VENDEDOR_ORDER[i % VENDEDOR_ORDER.length];

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
        status: status,                              // status (funil) — DERIVADO
        statusAnterior: null,                        // etapa antes de uma saída lateral
        motivoStatus: null,                          // cache do motivo da última tarefa
        qualidade: deriveQualidade(cnae),            // DERIVADA do cnae_codigo
        porte: hasCnpj ? PORTE_ORDER[(i * 3 + 1) % 4] : null,
        vendedorId: vendId,                          // vendedor_responsavel_id
        vendedor: VENDEDORES[vendId].nome,           // cache do nome (exibição)
        lastVisit: r.lv || null,                     // ultima_visita
        // ▼ relação comercial (do ERP; nulos enquanto for só lead) ▼
        dataCadastro: dataCadastro,
        dataPrimeiraCompra: dataPrimeiraCompra,
        cadastrado: cadastrado,                      // DERIVADO — "é cliente?"
        phone: fakePhone(i + 1, meta.ddd),           // telefone (fictício)
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

  /* =====================================================================
     Seed de TAREFAS. Sem isto, a aba Atividades, a visão gerencial e três
     colunas do funil (Visita planejada / Perdido / Desqualificado) nascem
     VAZIAS — porque no contrato elas só existem por tarefa.

     As tarefas são geradas de forma consistente com o status de campo que o
     pin já traz, e no fim o status é RECONCILIADO a partir delas (o pin não
     "tem" status próprio: ele deriva). Datas relativas a hoje, para que
     "atrasada" funcione em qualquer dia que a demo abrir.
     ===================================================================== */
  /* Data local (não UTC): `toISOString` desloca o dia em UTC-3 dependendo da
     hora, e "atrasada" não pode depender de que horas a demo abriu. */
  // pad() daqui é de 3 dígitos (serve aos IDs 'p001'); data precisa de 2.
  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoLocal(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function isoPlus(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return isoLocal(d);
  }
  // Dias ÚTEIS no intervalo (offsets relativos a hoje). Fim de semana sem visita
  // é o que faz o gráfico por dia parecer uma operação real, e não ruído.
  function diasUteis(de, ate) {
    const out = [];
    for (let k = de; k <= ate; k++) {
      const d = new Date();
      d.setDate(d.getDate() + k);
      const w = d.getDay();
      if (w !== 0 && w !== 6) out.push(isoLocal(d));
    }
    return out;
  }

  /* Nenhuma visita cai em fim de semana. As tarefas-âncora nasciam de
     `lastVisit`/offsets fixos e às vezes caíam num sábado — na janela L7D isso
     vira uma barra de 3 visitas no domingo, que a supervisão lê como erro.
     Passado encosta na sexta; futuro pula pra segunda. */
  function diaUtil(s, futuro) {
    const d = new Date(s + 'T00:00:00');
    const w = d.getDay();
    if (w === 6) d.setDate(d.getDate() + (futuro ? 2 : -1));
    else if (w === 0) d.setDate(d.getDate() + (futuro ? 1 : -2));
    return isoLocal(d);
  }

  const NOTAS_CAMPO = [
    'Dono não estava; falei com o gerente.',
    'Pediu para voltar depois do dia 10.',
    'Levou tabela de preços impressa.',
    'Reposição da semana conferida.',
    'Interesse em ampliar o mix de bebidas.',
    'Pediu prazo maior de pagamento.',
    'Loja em reforma, atendimento parcial.',
    'Comprou do concorrente esta semana.'
  ];

  function buildTarefas(pins) {
    const out = [];
    let seq = 0;

    /* Aleatório DETERMINÍSTICO (LCG, semente fixa): a demo tem que abrir
       exatamente igual toda vez — Math.random daria um gráfico diferente a
       cada reload e ninguém confia num número que dança. */
    let _rnd = 20260728;
    function rnd() { _rnd = (_rnd * 1103515245 + 12345) % 2147483648; return _rnd / 2147483648; }
    function entre(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
    function umDe(arr) { return arr[Math.floor(rnd() * arr.length)]; }

    function add(pin, t) {
      seq += 1;
      t.data = diaUtil(t.data, t.status === 'planejada');
      // Check-in presencial ⇒ há distância medida; atividade remota ⇒ não há.
      // `distancia_km` é DERIVADA no check-in (GPS × geo do pin) — nunca digitada.
      const presencial = !!t.checkinEm;
      out.push({
        id: 't' + pad(seq),
        estabelecimentoId: pin.id,
        tipo: t.tipo,
        data: t.data,
        status: t.status,
        responsavelId: pin.vendedorId,        // DERIVADO: herda o vendedor do pin
        checkinEm: t.checkinEm || null,
        checkoutEm: t.checkoutEm || null,
        distanciaKm: presencial
          ? (t.distanciaKm != null ? t.distanciaKm : Math.round(rnd() * 250) / 100)
          : null,
        resultado: t.resultado || null,
        motivoPerda: t.motivoPerda || null,
        motivoDesqualificacao: t.motivoDesqualificacao || null,
        motivoTexto: null,
        proximaAcao: t.proximaAcao || null,
        proximaAcaoData: t.proximaAcaoData || null,
        notas: t.notas || null,
        criadoPor: pin.vendedorId
      });
    }
    // Tarefa realizada, com check-in/out no dia (o caminho presencial normal).
    function realizada(pin, tipo, data, resultado, extra) {
      const e = extra || {};
      data = diaUtil(data, false);            // antes de montar checkin/checkout
      add(pin, {
        tipo: tipo, data: data, status: 'realizada',
        checkinEm: data + 'T09:30:00', checkoutEm: data + 'T10:15:00',
        resultado: resultado,
        motivoPerda: e.motivoPerda, motivoDesqualificacao: e.motivoDesqualificacao,
        proximaAcao: e.proximaAcao, proximaAcaoData: e.proximaAcaoData, notas: e.notas
      });
    }

    let nPlan = 0, nAtras = 0, nPerd = 0, nDesq = 0;

    pins.forEach(function (p, i) {
      const st = p.status;

      // Já houve trabalho de campo: gera a atividade que produziu esse estado.
      if (st === 'visitado') {
        realizada(p, 'primeira_visita', p.lastVisit || isoPlus(-20), 'sem_avanco',
          { proximaAcao: 'Levar tabela de preços', proximaAcaoData: isoPlus(3 + (i % 9)) });
      } else if (st === 'td_encontrado') {
        realizada(p, 'primeira_visita', p.lastVisit || isoPlus(-25), 'td_encontrado',
          { proximaAcao: 'Fechar proposta com o dono', proximaAcaoData: isoPlus(2 + (i % 7)) });
        // Follow-up recente reforça o volume da visão gerencial.
        if (i % 2 === 0) realizada(p, 'follow_up', isoPlus(-(3 + (i % 10))), 'td_encontrado');
      } else if (st === 'csc' || st === 'aquisicao') {
        realizada(p, 'primeira_visita', p.lastVisit || isoPlus(-30), 'td_encontrado');
        // Cliente ativo recebe recorrência — é o tipo que existe pra isso.
        realizada(p, 'recorrencia', isoPlus(-(2 + (i % 12))), 'sem_avanco',
          { notas: 'Reposição da semana conferida.' });
      } else if (st === 'sem_plano') {
        // A base fora do pipeline. Uma fatia entra por plano, outra saiu pelas laterais.
        if (nPlan < 6) {                       // → Visita planejada (futuro)
          nPlan += 1;
          add(p, { tipo: nPlan % 2 ? 'primeira_visita' : 'follow_up', data: isoPlus(1 + nPlan), status: 'planejada' });
        } else if (nAtras < 2) {               // → Visita planejada, ATRASADA
          nAtras += 1;
          add(p, { tipo: 'primeira_visita', data: isoPlus(-(2 + nAtras)), status: 'planejada',
                   notas: 'Reagendar — não deu tempo na rota.' });
        } else if (nPerd < 4) {                // → Perdido
          nPerd += 1;
          const mot = ['preco', 'compra_do_concorrente', 'sem_interesse', 'credito_reprovado'][nPerd - 1];
          realizada(p, 'primeira_visita', isoPlus(-(5 + nPerd * 3)), 'perdido', { motivoPerda: mot });
        } else if (nDesq < 3) {                // → Desqualificado
          nDesq += 1;
          const mot = ['nao_existe_no_endereco', 'endereco_e_residencia', 'fechado_definitivamente'][nDesq - 1];
          realizada(p, 'primeira_visita', isoPlus(-(4 + nDesq * 4)), 'desqualificado', { motivoDesqualificacao: mot });
        }
        // O resto fica sem tarefa: existe no mapa, não no funil.
      }
    });

    /* ---- Volume de operação (adensamento, 28/07) -----------------------
       Sem isto a gerencial mostra pico de 4 visitas/dia e parece brinquedo:
       3 vendedores em campo fazem ~3–5 visitas úteis por dia cada.

       ⚖️ O adensamento NÃO PODE mexer no funil. Como `reconcileStatus` é
       last-wins (a ÚLTIMA realizada manda), cada tarefa de volume nasce com o
       MESMO `resultado` da tarefa-âncora do seu pin — aí a ordem das datas
       deixa de importar e o status derivado sai idêntico ao de antes.
       Por isso as saídas laterais (perdido/desqualificado) e os `sem_plano`
       ficam de fora: qualquer tarefa neles mudaria a coluna do board.
       -------------------------------------------------------------------- */
    const ELEGIVEIS = ['visitado', 'td_encontrado', 'csc', 'aquisicao'];
    const emCampo = pins.filter(function (p) { return ELEGIVEIS.indexOf(p.status) >= 0; });

    if (emCampo.length) {
      // `csc`/`aquisicao` têm status vindo do ERP, que PREVALECE — o resultado
      // da tarefa é livre neles. Os demais repetem o resultado da âncora.
      function resultadoDe(p) {
        if (p.status === 'visitado')      return 'sem_avanco';
        if (p.status === 'td_encontrado') return 'td_encontrado';
        return rnd() < 0.62 ? 'sem_avanco' : 'td_encontrado';
      }
      function tipoDe(p) {
        if (p.status === 'csc' || p.status === 'aquisicao') return rnd() < 0.75 ? 'recorrencia' : 'follow_up';
        return rnd() < 0.7 ? 'follow_up' : 'primeira_visita';
      }

      let cur = 0;
      diasUteis(-44, -1).forEach(function (dia) {
        const cota = entre(9, 16);
        for (let k = 0; k < cota; k++) {
          const p = emCampo[cur++ % emCampo.length];
          const remota = rnd() < 0.15;      // atividade sem check-in (tarefa.md §5)
          const hh = 8 + Math.floor(rnd() * 9);
          add(p, {
            tipo: tipoDe(p), data: dia, status: 'realizada',
            checkinEm: remota ? null : dia + 'T' + pad2(hh) + ':' + pad2(entre(0, 5) * 10) + ':00',
            checkoutEm: remota ? null : dia + 'T' + pad2(hh + 1) + ':05:00',
            resultado: resultadoDe(p),
            notas: rnd() < 0.35 ? umDe(NOTAS_CAMPO) : null
          });
        }
      });

      /* HOJE, dia em andamento: parte do plano já virou realizada e o resto
         ainda está de pé. É o único dia em que os dois gráficos L7D contam a
         história completa ("planejei 12, fiz 6") — e sem isso a última coluna
         nasce vazia, o que a supervisão lê como gráfico quebrado. */
      const hj = isoLocal(new Date());
      if (hj === diaUtil(hj, false)) {                 // não semeia em fim de semana
        for (let k = 0; k < 6; k++) {
          const p = emCampo[cur++ % emCampo.length];
          const hh = 8 + k;
          add(p, {
            tipo: tipoDe(p), data: hj, status: 'realizada',
            checkinEm: hj + 'T' + pad2(hh) + ':' + pad2(entre(0, 5) * 10) + ':00',
            checkoutEm: hj + 'T' + pad2(hh + 1) + ':05:00',
            resultado: resultadoDe(p),
            notas: rnd() < 0.35 ? umDe(NOTAS_CAMPO) : null
          });
        }
        for (let k = 0; k < 6; k++) {                  // o que ainda falta hoje
          const p = emCampo[cur++ % emCampo.length];
          add(p, { tipo: tipoDe(p), data: hj, status: 'planejada' });
        }
      }

      // Plano da semana que vem. Planejada não move status quando o pin já tem
      // realizada (o resultado prevalece sobre "existe plano").
      cur = 3;
      diasUteis(1, 8).forEach(function (dia) {
        const cota = entre(7, 13);
        for (let k = 0; k < cota; k++) {
          const p = emCampo[cur++ % emCampo.length];
          add(p, { tipo: tipoDe(p), data: dia, status: 'planejada',
                   notas: rnd() < 0.2 ? umDe(NOTAS_CAMPO) : null });
        }
      });
    }

    return out;
  }

  /* ---- Reconcilia o status do pin A PARTIR das tarefas + ERP.
          Ordem de precedência (estabelecimento.md §5):
            1) ERP (csc/aquisicao) — prevalece sobre tudo
            2) resultado da última tarefa concluída
            3) existe tarefa planejada? → visita_planejada
            4) sem_plano
          Também preenche lastVisit, motivoStatus, statusAnterior e o
          `checkins` derivado (o array do pin deixa de ser fonte). ---- */
  function reconcileStatus(pins, tarefas) {
    const byPin = {};
    tarefas.forEach(function (t) {
      (byPin[t.estabelecimentoId] = byPin[t.estabelecimentoId] || []).push(t);
    });

    pins.forEach(function (p) {
      const ts = byPin[p.id] || [];
      const feitas = ts.filter(function (t) { return t.status === 'realizada'; })
                       .sort(function (a, b) { return a.data < b.data ? -1 : 1; });
      const planejadas = ts.filter(function (t) { return t.status === 'planejada'; });
      const ultima = feitas[feitas.length - 1] || null;

      const comercial = deriveStatusComercial(p.dataCadastro, p.dataPrimeiraCompra);
      let novo, anterior = null, motivo = null;

      if (comercial) {
        novo = comercial;
      } else if (ultima && ultima.resultado) {
        const r = RESULTADO[ultima.resultado];
        novo = r.status;
        if (r.motivo === 'perda')          motivo = MOTIVO_PERDA[ultima.motivoPerda] || null;
        if (r.motivo === 'desqualificacao') motivo = MOTIVO_DESQUALIFICACAO[ultima.motivoDesqualificacao] || null;
        // Saída lateral guarda de onde saiu (aqui: a etapa da penúltima tarefa).
        if (STATUS[novo].family === 'lateral') {
          const antes = feitas[feitas.length - 2];
          anterior = (antes && antes.resultado) ? RESULTADO[antes.resultado].status : 'visita_planejada';
        }
      } else if (planejadas.length) {
        novo = 'visita_planejada';
      } else {
        novo = 'sem_plano';
      }

      p.status = novo;
      p.statusAnterior = anterior;
      p.motivoStatus = motivo;
      if (feitas.length) p.lastVisit = feitas[feitas.length - 1].data;
      // `pin.checkins` DERIVA das tarefas (tarefa.md §7) — não é mais fonte.
      p.checkins = feitas.filter(function (t) { return t.checkinEm; })
        .map(function (t) { return { in: t.checkinEm, out: t.checkoutEm }; })
        .reverse();
    });

    return pins;
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
    STATUS_ORDER: STATUS_ORDER,
    STATUS_BOARD: STATUS_BOARD,
    ESCADA: ESCADA,
    VENDEDORES: VENDEDORES,
    VENDEDOR_ORDER: VENDEDOR_ORDER,
    VENDEDOR_SESSAO: VENDEDOR_SESSAO,
    TAREFA_TIPO: TAREFA_TIPO,
    TAREFA_TIPO_ORDER: TAREFA_TIPO_ORDER,
    TAREFA_STATUS: TAREFA_STATUS,
    RESULTADO: RESULTADO,
    RESULTADO_ORDER: RESULTADO_ORDER,
    MOTIVO_PERDA: MOTIVO_PERDA,
    MOTIVO_DESQUALIFICACAO: MOTIVO_DESQUALIFICACAO,
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
    deriveCadastrado: deriveCadastrado,
    deriveStatusComercial: deriveStatusComercial,
    resolveStatus: resolveStatus,
    statusAvanca: statusAvanca,
    deriveOrigemConfianca: deriveOrigemConfianca,
    isoPlus: isoPlus,
    buildSeed: buildSeed,
    buildTarefas: buildTarefas,
    reconcileStatus: reconcileStatus
  };
})();
