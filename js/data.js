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

  /* ---- Origem / confiança (CAP-1) — 3 degraus, ADITIVOS.
          Decisão 29/07: a origem saiu da COR e passou a viver só em PISTA de
          forma (a cor do pin virou a relação comercial — ver RELACAO abaixo).
          A escada deixou de ter "Google puro": todo ponto nasce da base de CNPJ;
          o Google ENRIQUECE esse cadastro; o campo confirma. Logo é cumulativa
          (cnpj ⊂ google ⊂ validado_campo) e o pin exibe só a pista do degrau
          MAIS ALTO que alcançou.
          ⚠️ A inversão-tese "Google puro > CNPJá puro" fica DORMENTE, não
          revogada: sem a categoria "só Google", ela não tem sujeito. Se um dia
          entrar ponto sem CNPJ, ela volta a valer e vira o 4º degrau. ---- */
  const ORIGINS = {
    cnpj: {
      key: 'cnpj', label: 'CNPJ', short: 'CNPJ',
      level: 1, confidence: 'Menor', cue: 'dashed',
      desc: 'Só base de CNPJ, sem enriquecimento — o endereço pode estar desatualizado.'
    },
    google: {
      key: 'google', label: 'Google', short: 'Google',
      level: 2, confidence: 'Média', cue: 'G',
      desc: 'Cadastro de CNPJ enriquecido com Google — duas fontes concordam sobre a fachada.'
    },
    validado_campo: {
      key: 'validado_campo', label: 'Validado em campo', short: 'Campo',
      level: 3, confidence: 'Máxima', cue: '✓',
      desc: 'Confirmado presencialmente pelo vendedor (check-in / correção).'
    }
  };
  const ORIGIN_ORDER = ['cnpj', 'google', 'validado_campo'];

  /* ---- status_cliente — a RELAÇÃO no tempo (decisão 29/07, filtro próprio).
          É o `status_cliente` que a SPEC 00 §2.5 tinha como buraco marcado,
          chegando com o vocabulário da operação em vez do que o doc supunha
          (era `ativo|em_risco|inativo|reconquistado`).
          Duas diferenças que valem registro:
            · inclui `lead`, então o campo passa a existir para QUEM NÃO É
              cliente — antes o doc dizia "só quando cadastrado";
            · `csc` também é valor de `status` (funil). São a mesma verdade em
              eixos diferentes: no funil é a coluna, aqui é a relação.
          NUNCA digitado: deriva de `cadastrado` + `status`, que já vêm do ERP.
          ⚠️ `churn` não tem fonte: o salesforce.lead não traz compra nem
          pedido (só `cliente_minal*_lead_c` e `faixa_faturamento_c`). O valor
          existe no vocabulário e nasce vazio nas duas bases — quando a
          integração do ERP entrar, `data_ultima_compra` o preenche. ---- */
  const STATUS_CLIENTE = {
    lead:       { key: 'lead',       label: 'Lead',       desc: 'Ainda não é cliente — não existe registro comercial.' },
    csc:        { key: 'csc',        label: 'CSC',        desc: 'Cadastrado sem compra: tem cadastro, a primeira compra não veio.' },
    recorrente: { key: 'recorrente', label: 'Recorrente', desc: 'Cliente comprando — tem primeira compra registrada.' },
    churn:      { key: 'churn',      label: 'Churn',      desc: 'Era cliente e parou de comprar. Depende do ERP (sem fonte hoje).' }
  };
  // Ordem = a progressão da relação, como você descreveu: lead → csc →
  // recorrente → churn (a saída fica no fim, como as laterais do funil).
  const STATUS_CLIENTE_ORDER = ['lead', 'csc', 'recorrente', 'churn'];

  // DERIVADO do que já existe — não é campo novo de entrada.
  //   não cadastrado        -> lead
  //   cadastrado, sem compra-> csc         (status = csc)
  //   cadastrado, com compra-> recorrente  (status = aquisicao)
  // O invariante `status ∈ {csc,aquisicao} ⟺ cadastrado` garante que o
  // fallback abaixo nunca é usado; ele existe porque dado real surpreende.
  function deriveStatusCliente(p) {
    if (!p || !p.cadastrado) return 'lead';
    if (p.status === 'aquisicao' || p.dataPrimeiraCompra) return 'recorrente';
    return 'csc';
  }

  /* ---- Relação comercial — é o que a COR do pin diz (decisão 29/07).
          Deriva de `cadastrado` (existe registro comercial?), que já é derivado
          do ERP — ou seja, a cor continua NUNCA sendo digitada.
          Escolha das cores: azul da marca para cliente, lilás claro para lead
          (é a cor com que o time já lê "lead"). O par carrega contraste de
          LUMINOSIDADE forte (escuro × claro), então sobrevive em escala de
          cinza e no daltonismo — a cor não é a única diferença.
          ⚠️ Quando `status_cliente` (ativo/em risco/inativo) chegar, ele vai
          querer este mesmo canal — ver SPEC 00 §2.5. ---- */
  const RELACAO = {
    cliente: { key: 'cliente', label: 'Cliente', color: '#2053CE', ink: '#12307c' },
    lead:    { key: 'lead',    label: 'Lead',    color: '#A78BFA', ink: '#5b21b6' }
  };
  const RELACAO_ORDER = ['cliente', 'lead'];
  // A cor de UM pin: cadastrado => cliente; senão => lead.
  function relacaoDe(p) { return (p && p.cadastrado) ? RELACAO.cliente : RELACAO.lead; }

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
          própria (a KR pede "filtrar por porte"). Fictício no protótipo.
          29/07: passou de 4 para 6 faixas, espelhando os valores REAIS de
          `porte_c` no salesforce.lead (conferidos no Metabase). `LTDA` morreu —
          era um rótulo nosso; o valor real se chama `demais`. O campo `sf` é a
          string exata da coluna, para o transform da Fase 3 não adivinhar.
          ⚠️ MEI existe no enum mas NUNCA aparece no dado real: o recorte do
          snapshot exclui MEI duas vezes (`porte_c NOT IN ('me-ei-mei')` e
          `optante_mei_c = 'Não'`). No fictício ele é semeado, então o chip
          funciona na demo e fica em 0 no modo real — o que é a verdade. ---- */
  const PORTE = {
    MEI:    { key: 'MEI',    label: 'MEI',           full: 'Microempreendedor individual',            sf: 'me-ei-mei' },
    ME:     { key: 'ME',     label: 'ME',            full: 'Microempresa (LTDA)',                     sf: 'me-ltda' },
    ME_EI:  { key: 'ME_EI',  label: 'ME-EI Não MEI', full: 'Microempresa / EI não optante pelo MEI',  sf: 'me-ei-nao_mei' },
    EPP:    { key: 'EPP',    label: 'EPP',           full: 'Empresa de pequeno porte (LTDA)',         sf: 'epp-ltda' },
    EPP_EI: { key: 'EPP_EI', label: 'EPP-EI',        full: 'Empresa de pequeno porte (EI)',           sf: 'epp-ei' },
    DEMAIS: { key: 'DEMAIS', label: 'DEMAIS',        full: 'Demais (LTDA / S.A.)',                    sf: 'demais' }
  };
  const PORTE_ORDER = ['MEI', 'ME', 'ME_EI', 'EPP', 'EPP_EI', 'DEMAIS'];

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

  /* ---- resultado: 5 valores. `status` aqui É a tabela de mapeamento
          resultado → status do estabelecimento (tarefa.md §5) — mantida como
          DADO para não haver um `switch` escondido em algum lugar.
          Cor = a do status homônimo (SPEC 00 §2.6); só `vendido` tem cor
          própria, porque não tem status homônimo — e não pode ter.

          ⚖️ O `resultado` deixou de ser DIGITADO em 28/07 e passou a ser
          DERIVADO dos quatro checkboxes do check-out (spec-07 §3). O enum
          sobrevive porque é dele que vivem o gráfico "Por resultado", o drill
          da gerencial e a tabela que move o funil. A derivação está em
          `deriveResultado`.

          ⚖️ `vendido` NÃO é "convertido". Venda declarada em campo é fato do
          VENDEDOR; conversão é fato do ERP (cadastro/pedido) e continua
          prevalecendo. Por isso `vendido.status` é `td_encontrado` — quem
          vendeu falou com o tomador de decisão, e é até aí que o campo
          alcança. Aquisição só chega com pedido no sistema; enquanto não
          chega, o pin carrega a tag `Venda realizada`. ---- */
  // `label` é o REGISTRO (histórico, relatório); `acao` é o BOTÃO de escolha no
  // check-out. Sem os dois, a gerencial mostraria "Desqualificar 3" — verbo no
  // imperativo descrevendo fato passado.
  const RESULTADO = {
    sem_avanco:     { key: 'sem_avanco',     label: 'Sem avanço',      acao: 'Sem avanço',     status: 'visitado',       color: STATUS.visitado.color,       motivo: null },
    td_encontrado:  { key: 'td_encontrado',  label: 'TD encontrado',   acao: 'TD encontrado',  status: 'td_encontrado',  color: STATUS.td_encontrado.color,  motivo: null },
    vendido:        { key: 'vendido',        label: 'Venda realizada', acao: 'Vendeu',         status: 'td_encontrado',  color: '#15803d',                   motivo: null },
    perdido:        { key: 'perdido',        label: 'Perdido',         acao: 'Perdido',        status: 'perdido',        color: STATUS.perdido.color,        motivo: 'perda' },
    desqualificado: { key: 'desqualificado', label: 'Desqualificado',  acao: 'Desqualificar',  status: 'desqualificado', color: STATUS.desqualificado.color, motivo: 'desqualificacao' }
  };
  const RESULTADO_ORDER = ['sem_avanco', 'td_encontrado', 'vendido', 'perdido', 'desqualificado'];

  /* ---- Os quatro checkboxes do check-out (spec-07 §3), na ordem da tela.
          `exclui` é a regra de combinação: marcar um desmarca os opostos.
          `TD encontrado` não exclui ninguém — é o único ortogonal. ---- */
  const CHECKOUT_FLAGS = [
    { key: 'tdEncontrado',   label: 'TD encontrado?', exclui: [] },
    { key: 'vendaDeclarada', label: 'Vendeu?',        exclui: ['perda', 'desqualificar'] },
    { key: 'desqualificar',  label: 'Desqualificar',  exclui: ['vendaDeclarada', 'perda'],
      ajuda: 'Desqualificar é dizer que o PONTO não é oportunidade: não existe, não é food-service, está fora da área. O pin continua no mapa, mas sai do pipeline.' },
    { key: 'perda',          label: 'Perda',          exclui: ['vendaDeclarada', 'desqualificar'],
      ajuda: 'Perder é dizer que a NEGOCIAÇÃO morreu, mas o ponto segue sendo oportunidade — dá para reabordar mais tarde.' }
  ];

  /* Venda declarada exige tomador de decisão: não se vende sem falar com quem
     decide. O checkbox de TD marca junto e trava (spec-07 §3). */
  const VENDA_IMPLICA_TD = true;

  /* ---- Motivos: TRÊS vocabulários FECHADOS e separados.
            · não venda    — esta VISITA não gerou pedido (o evento);
            · perda        — a NEGOCIAÇÃO morreu, o ponto segue oportunidade;
            · desqualificação — o PONTO não é oportunidade.
          Os três vieram da operação (Tatiana, 28/07). Só um aparece por vez na
          tela: marcar Perda ou Desqualificar esconde o motivo de não venda,
          senão o vendedor veria "preço" duas vezes, em dois campos, com
          vocabulários diferentes. ---- */
  const MOTIVO_NAO_VENDA = {
    cliente_com_divida:         'Cliente com dívida',
    ja_abastecido:              'Cliente já estava abastecido',
    ec_fechado:                 'EC fechado',
    credito_nao_liberado:       'Não liberou crédito',
    nao_trabalha_food_service:  'Não trabalha mais com food service',
    prazo_limite_insuficiente:  'Prazo/limite insuficiente',
    preco:                      'Preço',
    ruptura_de_produto:         'Ruptura de produto',
    sku_indisponivel:           'Não trabalhamos com o SKU que o cliente queria',
    td_ausente:                 'TD ausente',
    td_indisponivel:            'TD ocupado/indisponível',
    sem_objecao:                'Sem objeção específica',
    fora_do_perfil_praso:       'Cliente não faz o perfil da Praso',
    outro:                      'Outro'
  };
  const MOTIVO_PERDA = {
    preco_alto:              'Preço alto',
    sem_contato_efetivo:     'Não consegui contato efetivo',
    ja_tem_fornecedores:     'Já tem fornecedores',
    sem_mix_procurado:       'Não temos o mix procurado',
    sem_interesse:           'Não tem interesse',
    outro:                   'Outro'
  };
  const MOTIVO_DESQUALIFICACAO = {
    cnpj_baixado:            'CNPJ baixado',
    ativo_em_outro_cnpj:     'Ativo em outro CNPJ',
    fora_da_area_de_entrega: 'Fora da área de entrega',
    nao_e_food_service:      'Não é food-service',
    fora_de_funcionamento:   'Negócio fora de funcionamento',
    // A dor-manchete da KR: rota caindo em endereço onde não há nada. Nenhuma
    // das outras cobre "o endereço está errado" — fechado ≠ inexistente.
    nao_existe_no_endereco:  'Não existe no endereço',
    contato_invalido:        'Contato inválido',
    ie_denegada:             'Inscrição estadual denegada',
    outro:                   'Outro'
  };

  /* ---- `resultado` a partir dos checkboxes (spec-07 §3) --------------------
     Precedência: as saídas laterais mandam (são o desfecho mais decisivo),
     depois a venda, depois o TD, e o default é o "nada aconteceu".
     ⚖️ `tdEncontrado` continua guardado como FATO mesmo quando o resultado é
     `perdido` — falei com o dono e ele disse não é informação que a gerencial
     quer, e o enum de resultado único não caberia as duas coisas. ---- */
  function deriveResultado(f) {
    f = f || {};
    if (f.desqualificar)  return 'desqualificado';
    if (f.perda)          return 'perdido';
    if (f.vendaDeclarada) return 'vendido';
    if (f.tdEncontrado)   return 'td_encontrado';
    return 'sem_avanco';
  }

  /* ---- Regras de combinação dos checkboxes (spec-07 §3) -------------------
     Vendeu, Perda e Desqualificar são desfechos OPOSTOS: marcar um desmarca os
     outros. `mudou` é a chave que o vendedor acabou de tocar — ela ganha, para
     que o toque faça o que o dedo mandou (e não o contrário, que é o que
     acontece quando a precedência é fixa e o checkbox "não obedece").
     Sem `mudou` — é o caso do store validando o que chegou — vale a mesma
     precedência de `deriveResultado`, como rede de segurança.
     Os opostos ficam HABILITADOS na tela: checkbox apagado no Android lê como
     tela travada, e a regra fica mais clara sendo aplicada do que sendo
     proibida. A linha de ajuda embaixo do grupo conta o que aconteceu. ---- */
  function normalizeCheckout(f, mudou) {
    const o = {
      tdEncontrado:   !!(f && f.tdEncontrado),
      vendaDeclarada: !!(f && f.vendaDeclarada),
      desqualificar:  !!(f && f.desqualificar),
      perda:          !!(f && f.perda)
    };
    if (mudou && o[mudou]) {
      const regra = CHECKOUT_FLAGS.filter(function (c) { return c.key === mudou; })[0];
      (regra ? regra.exclui : []).forEach(function (k) { o[k] = false; });
    } else {
      if (o.desqualificar)     { o.vendaDeclarada = false; o.perda = false; }
      else if (o.perda)        { o.vendaDeclarada = false; }
    }
    // Vendeu implica TD encontrado — e o checkbox de TD fica travado marcado.
    if (VENDA_IMPLICA_TD && o.vendaDeclarada) o.tdEncontrado = true;
    return o;
  }

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

  /* =====================================================================
     ZONA (guardiões) × BAIRRO — separados em 29/07.
     Até aqui `zone` era o BAIRRO, e era ele que dava coordenada, cidade/UF,
     DDD e o texto do endereço. A zona de verdade passou a vir da coluna
     `zona_guardioes_c` do salesforce.lead — vocabulário FECHADO de 15 valores
     (conferidos no Metabase: são os 15 maiores e cobrem 99,6% do recorte).
     Então o bairro NÃO podia simplesmente virar zona: ele continua existindo
     como a geografia fictícia do protótipo, e `zone` passou a ser a zona.
     ⚠️ `zona_2_c` (a coluna que usávamos) tem vocabulário DIFERENTE — só 5 dos
     13 valores dela estão nestes 15. Snapshot gerado com a coluna velha cai
     em "Sem Zona"; regerar com o transform novo resolve.
     ===================================================================== */
  const ZONAS_GUARDIOES = [
    'CE Guararapes', 'CE Grande Fortaleza', 'REC Zona Sul', 'PE Interior',
    'PE Litoral Sul', 'JP Sul', 'CE Maracanaú', 'RMR Norte', 'REC Zona Norte',
    'REC Zona Oeste', 'CE Caucaia - Parquelândia', 'CE Aldeota', 'PE Jaboatão',
    'PB João Pessoa Litoral', 'JP Oeste'
  ];
  const SEM_ZONA = 'Sem Zona';
  // Ordem dos chips = a do print + o balde no fim.
  const ZONA_ORDER = ZONAS_GUARDIOES.concat([SEM_ZONA]);

  // Fora do vocabulário fechado (inclusive nulo e os 7 valores residuais da
  // base, como 'CE Eusébio Guararapes') => Sem Zona. Nunca inventa zona.
  function normalizaZona(v) {
    return ZONAS_GUARDIOES.indexOf(v) >= 0 ? v : SEM_ZONA;
  }

  /* Bairro fictício -> zona de guardiões. Mapeamento do PROTÓTIPO (o dado real
     traz a zona pronta na coluna). Geograficamente plausível, mas fictício. */
  const BAIRRO_ZONA = {
    /* Recife/PE */
    'Boa Viagem': 'REC Zona Sul', 'Pina': 'REC Zona Sul', 'Imbiribeira': 'REC Zona Sul',
    'Recife Antigo': 'REC Zona Norte', 'Boa Vista': 'REC Zona Norte',
    'Santo Amaro': 'REC Zona Norte', 'Espinheiro': 'REC Zona Norte',
    'Aflitos': 'REC Zona Norte', 'Graças': 'REC Zona Norte',
    'Casa Forte': 'REC Zona Norte', 'Casa Amarela': 'REC Zona Norte',
    'Madalena': 'REC Zona Oeste', 'Torre': 'REC Zona Oeste',
    'Derby': 'REC Zona Oeste', 'Ilha do Leite': 'REC Zona Oeste',
    'Olinda': 'RMR Norte', 'Jaboatão': 'PE Jaboatão',
    /* Fortaleza/CE */
    'Meireles': 'CE Grande Fortaleza', 'Praia de Iracema': 'CE Grande Fortaleza',
    'Centro (Fortaleza)': 'CE Grande Fortaleza',
    'Aldeota': 'CE Aldeota', 'Varjota': 'CE Aldeota', 'Cocó': 'CE Aldeota',
    /* João Pessoa/PB */
    'Tambaú': 'PB João Pessoa Litoral', 'Manaíra': 'PB João Pessoa Litoral',
    'Cabo Branco': 'PB João Pessoa Litoral', 'Bessa': 'PB João Pessoa Litoral',
    'Bancários': 'JP Sul'
  };
  function zonaDoBairro(b) { return normalizaZona(BAIRRO_ZONA[b]); }

  /* ---- Centros aproximados de BAIRROS: Recife/PE (+ RMR), Fortaleza/CE e João Pessoa/PB ---- */
  const BAIRRO_CENTERS = {
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
  const BAIRROS = Object.keys(BAIRRO_CENTERS);

  /* ---- Cidade/UF/DDD por BAIRRO (deriva endereço e DDD do telefone fictícios) ---- */
  const REC = { city: 'Recife', uf: 'PE', ddd: '81' };
  const BAIRRO_META = {
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

  // origem_confianca pela ESCADA de 3 degraus (na dúvida, arredonda pra BAIXO).
  // sinais: { fieldValidated, hasGoogle }
  //  1) validado em campo (Máxima) — vence tudo e é monotônico.
  //  2) Google (Média) — o cadastro de CNPJ foi enriquecido com Google.
  //  3) CNPJ (Menor) — o piso: todo ponto vem da base de CNPJ.
  // `hasCnpj` e `matchConfirmed` deixaram de entrar na conta (29/07): sem a
  // categoria "só Google" não há mais dois degraus para eles separarem.
  function deriveOrigemConfianca(sig) {
    sig = sig || {};
    if (sig.fieldValidated) return 'validado_campo';
    if (sig.hasGoogle) return 'google';
    return 'cnpj';
  }

  /* ---- Sementes compactas do núcleo do lead.
          Campos: {n:nome_fantasia, t:tipologia, z:zona, o:origem, s:status,
                   lv:última_visita(ISO|null), note?:nota, cnae?:override}
          qualidade/origem/is_converted são DERIVADOS no buildSeed. ---- */
  const SEED = [
    // ===== Boa Viagem =====
    { n: 'Padaria Maré Alta',            t: 'padaria',     z: 'Boa Viagem',    o: 'google',         s: 'td_encontrado', lv: '2026-07-10', note: 'Dono pediu tabela de congelados. Voltar 3ª de manhã.' },
    { n: 'Restaurante Peixe na Brasa',   t: 'restaurante', z: 'Boa Viagem',    o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-14', note: 'Fechou pedido de hortifruti semanal.' },
    { n: 'Empório Setúbal',              t: 'mercadinho',  z: 'Boa Viagem',    o: 'cnpj',           s: 'sem_plano',  lv: null,         note: 'Endereço do CNPJ parece antigo — confirmar fachada.', cnae: '4639701' },
    { n: 'Sorveteria Polo Sul',          t: 'sorveteria',  z: 'Boa Viagem',    o: 'google',         s: 'sem_plano',  lv: null },
    { n: 'Café da Orla',                 t: 'cafeteria',   z: 'Boa Viagem',    o: 'google',         s: 'visitado',      lv: '2026-05-12', note: 'Interessado, mas travou no preço. Reabordar.' },
    { n: 'Pizzaria Forno de Boa Viagem', t: 'pizzaria',    z: 'Boa Viagem',    o: 'google',         s: 'sem_plano',  lv: null },

    // ===== Pina =====
    { n: 'Bar do Pina',                  t: 'bar',         z: 'Pina',          o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-09', note: 'Compra cerveja e petiscos toda semana.' },
    { n: 'Marmitaria Sabor do Cais',     t: 'marmitaria',  z: 'Pina',          o: 'google',         s: 'td_encontrado', lv: '2026-06-28', cnae: '5620101' },
    { n: 'Hortifruti Verde Pina',        t: 'hortifruti',  z: 'Pina',          o: 'cnpj',           s: 'sem_plano',  lv: null },

    // ===== Recife Antigo =====
    { n: 'Restaurante Marco Zero',       t: 'restaurante', z: 'Recife Antigo', o: 'google',         s: 'td_encontrado', lv: '2026-07-02', note: 'Chef quer amostra de defumados.' },
    { n: 'Bar Paço Alfândega',           t: 'bar',         z: 'Recife Antigo', o: 'google',         s: 'visitado',      lv: '2026-04-20' },
    { n: 'Café Cais do Sertão',          t: 'cafeteria',   z: 'Recife Antigo', o: 'cnpj',           s: 'sem_plano',  lv: null },

    // ===== Boa Vista / Santo Amaro / Derby / Ilha do Leite =====
    { n: 'Padaria Boa Vista Pão',        t: 'padaria',     z: 'Boa Vista',     o: 'google',         s: 'visitado',      lv: '2026-05-30', note: 'Comprou farinha 1x. Fazer follow-up mensal.' },
    { n: 'Lanchonete Central',           t: 'lanchonete',  z: 'Boa Vista',     o: 'google',         s: 'sem_plano',  lv: null },
    { n: 'Açougue Santo Amaro',          t: 'acougue',     z: 'Santo Amaro',   o: 'cnpj',           s: 'sem_plano',  lv: null,         note: 'CNPJ sem número — geolocalizar na visita.' },
    { n: 'Restaurante Derby Grill',      t: 'restaurante', z: 'Derby',         o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-15', note: 'Cliente âncora do bairro.' },
    { n: 'Mercadinho Ilha do Leite',     t: 'mercadinho',  z: 'Ilha do Leite', o: 'google',         s: 'td_encontrado', lv: '2026-06-20' },
    { n: 'Cafeteria do Hospital',        t: 'cafeteria',   z: 'Ilha do Leite', o: 'google',         s: 'sem_plano',  lv: null },

    // ===== Espinheiro / Aflitos / Graças =====
    { n: 'Padaria Espinheiro',           t: 'padaria',     z: 'Espinheiro',    o: 'google',         s: 'td_encontrado', lv: '2026-07-11', note: 'Quer testar linha de frios premium.' },
    { n: 'Restaurante Villa Graças',     t: 'restaurante', z: 'Graças',        o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-08' },
    { n: 'Bar dos Aflitos',              t: 'bar',         z: 'Aflitos',       o: 'google',         s: 'visitado',      lv: '2026-03-15', note: 'Dono viajando, retornar em agosto.' },
    { n: 'Cafeteria Graças',             t: 'cafeteria',   z: 'Graças',        o: 'cnpj',           s: 'sem_plano',  lv: null },
    { n: 'Hortifruti Aflitos',           t: 'hortifruti',  z: 'Aflitos',       o: 'google',         s: 'visitado',      lv: '2026-06-05' },
    { n: 'Pizzaria Espinheiro',          t: 'pizzaria',    z: 'Espinheiro',    o: 'google',         s: 'sem_plano',  lv: null },

    // ===== Madalena / Torre =====
    { n: 'Padaria Madalena',             t: 'padaria',     z: 'Madalena',      o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-13', note: 'Pediu antecipar entrega de véspera de feriado.' },
    { n: 'Bar da Torre',                 t: 'bar',         z: 'Torre',         o: 'google',         s: 'td_encontrado', lv: '2026-07-01' },
    { n: 'Marmitaria Torre',             t: 'marmitaria',  z: 'Torre',         o: 'cnpj',           s: 'sem_plano',  lv: null },
    { n: 'Mercadinho Madalena',          t: 'mercadinho',  z: 'Madalena',      o: 'google',         s: 'visitado',      lv: '2026-02-10', note: 'Sem giro no último trimestre. Reavaliar.' },
    { n: 'Sorveteria Madalena Gelato',   t: 'sorveteria',  z: 'Madalena',      o: 'google',         s: 'sem_plano',  lv: null },

    // ===== Casa Forte / Casa Amarela =====
    { n: 'Restaurante Casa Forte',       t: 'restaurante', z: 'Casa Forte',    o: 'google',         s: 'td_encontrado', lv: '2026-06-30', note: 'Aguardando aprovação do sócio.' },
    { n: 'Padaria Jardim Casa Forte',    t: 'padaria',     z: 'Casa Forte',    o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-06' },
    { n: 'Açougue Casa Amarela',         t: 'acougue',     z: 'Casa Amarela',  o: 'cnpj',           s: 'sem_plano',  lv: null,         note: 'Endereço do CNPJ diverge do Google. Validar.' },
    { n: 'Hortifruti Casa Amarela',      t: 'hortifruti',  z: 'Casa Amarela',  o: 'google',         s: 'sem_plano',  lv: null },
    { n: 'Lanchonete Casa Forte',        t: 'lanchonete',  z: 'Casa Forte',    o: 'cnpj',           s: 'visitado',      lv: '2026-05-05' },

    // ===== Imbiribeira =====
    { n: 'Restaurante Imbiribeira',      t: 'restaurante', z: 'Imbiribeira',   o: 'google',         s: 'visitado',      lv: '2026-06-25' },
    { n: 'Padaria Imbiribeira Pão Quente', t: 'padaria',   z: 'Imbiribeira',   o: 'google',         s: 'sem_plano',  lv: null },
    { n: 'Bar do Aeroporto',             t: 'bar',         z: 'Imbiribeira',   o: 'cnpj',           s: 'sem_plano',  lv: null },

    // ===== Olinda (metropolitana) =====
    { n: 'Restaurante Alto da Sé',       t: 'restaurante', z: 'Olinda',        o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-12', note: 'Ponto turístico, alto volume no fim de semana.' },
    { n: 'Bar do Carmo',                 t: 'bar',         z: 'Olinda',        o: 'google',         s: 'td_encontrado', lv: '2026-06-29' },
    { n: 'Padaria Quatro Cantos',        t: 'padaria',     z: 'Olinda',        o: 'google',         s: 'sem_plano',  lv: null },
    { n: 'Sorveteria Olinda',            t: 'sorveteria',  z: 'Olinda',        o: 'cnpj',           s: 'sem_plano',  lv: null },
    { n: 'Hotel Pousada dos Milagres',   t: 'hotel',       z: 'Olinda',        o: 'google',         s: 'visitado',      lv: '2026-05-20', note: 'Café da manhã do hotel — potencial de padaria + frios.' },

    // ===== Jaboatão (metropolitana) =====
    { n: 'Mercadinho Piedade',           t: 'mercadinho',  z: 'Jaboatão',      o: 'cnpj',           s: 'sem_plano',  lv: null },
    { n: 'Restaurante Praia de Piedade', t: 'restaurante', z: 'Jaboatão',      o: 'google',         s: 'sem_plano',  lv: null },
    { n: 'Hotel Piedade Praia',          t: 'hotel',       z: 'Jaboatão',      o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-07', note: 'Rede pequena, avaliar as outras 2 unidades.' },

    // ===== Fortaleza / CE =====
    { n: 'Padaria Meireles',             t: 'padaria',     z: 'Meireles',           o: 'google',         s: 'td_encontrado', lv: '2026-07-10', note: 'Quer testar linha de frios. Voltar quinta de manhã.' },
    { n: 'Restaurante Beira Mar',        t: 'restaurante', z: 'Meireles',           o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-13', note: 'Alto volume no fim de semana.' },
    { n: 'Bar Praia de Iracema',         t: 'bar',         z: 'Praia de Iracema',   o: 'google',         s: 'visitado',      lv: '2026-06-22' },
    { n: 'Cafeteria Aldeota',            t: 'cafeteria',   z: 'Aldeota',            o: 'google',         s: 'sem_plano',  lv: null },
    { n: 'Mercadinho Cocó',              t: 'mercadinho',  z: 'Cocó',               o: 'cnpj',           s: 'sem_plano',  lv: null,         note: 'Endereço do CNPJ parece antigo — confirmar fachada.' },
    { n: 'Pizzaria Varjota',             t: 'pizzaria',    z: 'Varjota',            o: 'google',         s: 'sem_plano',  lv: null },
    { n: 'Hortifruti do Centro',         t: 'hortifruti',  z: 'Centro (Fortaleza)', o: 'cnpj',           s: 'sem_plano',  lv: null },
    { n: 'Sorveteria Aldeota',           t: 'sorveteria',  z: 'Aldeota',            o: 'google',         s: 'visitado',      lv: '2026-05-18' },

    // ===== João Pessoa / PB =====
    { n: 'Restaurante Tambaú Mar',       t: 'restaurante', z: 'Tambaú',             o: 'validado_campo', s: 'td_encontrado', conv: 1,    lv: '2026-07-11', note: 'Fechou hortifruti semanal.' },
    { n: 'Padaria Manaíra',              t: 'padaria',     z: 'Manaíra',            o: 'google',         s: 'td_encontrado', lv: '2026-07-03' },
    { n: 'Bar do Cabo Branco',           t: 'bar',         z: 'Cabo Branco',        o: 'google',         s: 'sem_plano',  lv: null },
    { n: 'Cafeteria Bessa',              t: 'cafeteria',   z: 'Bessa',              o: 'google',         s: 'visitado',      lv: '2026-06-14' },
    { n: 'Marmitaria Bancários',         t: 'marmitaria',  z: 'Bancários',          o: 'cnpj',           s: 'sem_plano',  lv: null },
    { n: 'Mercadinho Manaíra',           t: 'mercadinho',  z: 'Manaíra',            o: 'cnpj',           s: 'sem_plano',  lv: null,         note: 'CNPJ sem número — geolocalizar na visita.' },
    { n: 'Hotel Tambaú',                 t: 'hotel',       z: 'Tambaú',             o: 'google',         s: 'visitado',      lv: '2026-05-25', note: 'Café da manhã — potencial de padaria + frios.' },
    { n: 'Sorveteria Cabo Branco',       t: 'sorveteria',  z: 'Cabo Branco',        o: 'google',         s: 'sem_plano',  lv: null }
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
      // `r.z` da semente é o BAIRRO (dá coordenada, cidade/UF e DDD); a ZONA
      // de guardiões deriva dele pelo mapa BAIRRO_ZONA.
      const c = BAIRRO_CENTERS[r.z] || MAP_CENTER;
      const meta = BAIRRO_META[r.z] || REC;
      const lat = +(c[0] + jitter(i * 3 + 1, 0.014)).toFixed(6);
      const lng = +(c[1] + jitter(i * 5 + 2, 0.014)).toFixed(6);
      // Desde 29/07 TODO ponto nasce da base de CNPJ (a categoria "só Google"
      // deixou de existir), então razão social / CNPJ / porte nunca são nulos no
      // seed. O caminho do nulo continua tratado no sheet — o dado real da
      // Fase 3 pode trazer registro sem CNPJ.
      const hasCnpj = true;
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
        bairro: r.z,                                 // geografia fictícia (endereço/DDD/coordenada)
        zone: zonaDoBairro(r.z),                     // zona_guardioes_c — vocabulário FECHADO
        origin: r.o,                                 // origem_confianca (derivada; seed = resultado da escada)
        status: status,                              // status (funil) — DERIVADO
        statusAnterior: null,                        // etapa antes de uma saída lateral
        motivoStatus: null,                          // cache do motivo da última tarefa
        qualidade: deriveQualidade(cnae),            // DERIVADA do cnae_codigo
        // Passo 5, não 3: o rodízio precisa ser COPRIMO com o nº de faixas para
        // cobrir todas. Com 6 faixas e passo 3 (gcd 3) só saíam os índices 1 e 4
        // — ME e EPP-EI — e os outros quatro chips nasciam mortos na demo.
        porte: hasCnpj ? PORTE_ORDER[(i * 5 + 1) % PORTE_ORDER.length] : null,
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

      // Derivado por último: depende de `cadastrado` + `status` já resolvidos.
      pin.statusCliente = deriveStatusCliente(pin);

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

  /* Anotação do vendedor NO MOMENTO do agendamento (≠ NOTAS_CAMPO, que é o que
     ele escreveu depois de ir). É o único texto que o card da Agenda mostra. */
  const NOTAS_AGENDA = [
    'Cliente pediu retorno neste horário.',
    'Levar a tabela nova e amostra.',
    'Falar com o dono, não com o balcão.',
    'Confirmar por telefone antes de ir.',
    'Passar depois do almoço — abre 14h.',
    'Retomar a proposta que ficou parada.'
  ];

  /* Minutos desde a meia-noite → "HH:MM" (hora é opcional na tarefa — §4). */
  function hhmm(min) { return pad2(Math.floor(min / 60)) + ':' + pad2(min % 60); }

  /* ---- Busca de estabelecimento: nome fantasia · razão social · CNPJ ----
     UMA função para as duas superfícies que buscam pin (Inteligência e a
     barra da aba Atividades) — busca que se comporta diferente em duas telas
     do mesmo app é bug de produto, não variação.
     Acento-insensível nos nomes; no CNPJ compara **só dígitos**, para que
     "14066" ache "14.066.645/0001-46" sem o usuário digitar a pontuação. */
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD')
      .replace(/[̀-ͯ]/g, '').toLowerCase();
  }
  function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }

  /* ---- tipo_checkin: quem decide é a DISTÂNCIA (28/07) --------------------
     `presencial` × `remoto` **não** é "teve check-in × não teve": é **onde o
     vendedor estava** quando fez o check-in. Perto do pin, presencial; longe,
     remoto — ele registrou a visita de fora (ligou, falou no portão, passou
     de carro). Sem check-in nenhum, o campo é **NULL** e a tarefa não é
     realizada: sem presença registrada não há o que classificar.

     ⚠️ O raio é PARÂMETRO DE NEGÓCIO, e este valor não é palpite: **500m é o
     critério que a operação da Praso já usa hoje** (Tatiana, 28/07). Fica
     nomeado e num lugar só porque mexer nele RECLASSIFICA o histórico — não é
     constante de código, é regra que a supervisão vai querer ajustar (Admin,
     Fase 4). De brinde, 500m dão folga larga ao erro de GPS de celular em rua
     fechada (~20–50m). */
  const RAIO_PRESENCIAL_KM = 0.5;

  function deriveTipoCheckin(t) {
    if (!t || !t.checkinEm) return null;               // sem check-in: nulo
    if (t.distanciaKm == null) return 'presencial';    // sem medição, assume presença
    return t.distanciaKm <= RAIO_PRESENCIAL_KM ? 'presencial' : 'remoto';
  }

  /* ---- Tipo de visita SUGERIDO (não digitado, não travado) ----------------
     O check-in existe em todo pin (spec-07 §2), e quem chega para visitar não
     deveria ter que classificar a visita — o histórico já diz qual ela é. Esta
     é a sugestão que o vendedor **confere** nos chips e corrige se quiser:
       · nunca visitado          → 1ª visita
       · cliente (csc/aquisicao) → recorrência (é o tipo que existe pra isso)
       · visitado, não cliente   → follow-up
     Sugestão ≠ derivação travada: `tipo` continua sendo campo digitado
     (tarefa.md §4). Quem manda é o toque no chip. */
  function sugereTipoVisita(pin, tarefasDoPin) {
    if (!pin) return 'primeira_visita';
    const feitas = (tarefasDoPin || []).filter(function (t) { return t.status === 'realizada'; });
    if (!feitas.length) return 'primeira_visita';
    if (pin.status === 'csc' || pin.status === 'aquisicao') return 'recorrencia';
    return 'follow_up';
  }

  function matchBusca(p, query) {
    const q = norm(query).trim();
    if (!q) return true;
    if (!p) return false;
    if (norm(p.name).indexOf(q) >= 0) return true;
    if (norm(p.razaoSocial).indexOf(q) >= 0) return true;
    const d = soDigitos(q);
    return !!d && soDigitos(p.cnpj).indexOf(d) >= 0;
  }

  function buildTarefas(pins, opts) {
    const out = [];
    const rotas = [];          // ⚠️ RASCUNHO do objeto Rota (docs/objetos/rota.md)
    let seq = 0, seqRota = 0;

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
      /* `distancia_km` existe SEMPRE que houve check-in — é ela que decide
         presencial × remoto (deriveTipoCheckin). Sem check-in não há medição
         nem classificação: os dois campos ficam nulos.
         A distribuição: 85% das visitas acontecem na porta (0–300m) e 15% de
         algum lugar mais longe (0,55–4 km) — as duas faixas ficam **fora da
         zona de dúvida** do raio de 500m, para que ajustar o parâmetro não
         reclassifique meio dataset de uma vez. É o que faz a coluna `Remoto`
         da gerencial existir com a razão certa, em vez de vir de tarefa sem
         check-in. Derivada no check-in (GPS × geo do pin), nunca digitada. */
      const temCheckin = !!t.checkinEm;
      /* Os checkboxes do check-out são FATO guardado, não rótulo derivado do
         `resultado` — a gerencial lê os dois. O seed reconstrói o que teria
         sido marcado na tela para produzir este resultado (spec-07 §3):
           · vendeu ⇒ TD encontrado (não se vende sem falar com quem decide);
           · perdeu ⇒ falou com o TD, EXCETO quando o motivo é justamente não
             ter conseguido contato efetivo;
           · desqualificou ⇒ não há TD a encontrar. */
      const res = t.resultado || null;
      const tdEnc = t.tdEncontrado != null ? t.tdEncontrado
        : (res === 'td_encontrado' || res === 'vendido' ||
           (res === 'perdido' && t.motivoPerda !== 'sem_contato_efetivo'));
      /* `motivo_nao_venda` é OBRIGATÓRIO em todo check-out sem venda (§3), e
         só some quando Perda ou Desqualificar toma a tela. Sem semear aqui, a
         coluna nasceria vazia em todo o histórico — o campo estrearia sem
         dado justamente na reunião de supervisão. As duas listas respeitam o
         que a visita foi: quem nem falou com o TD não pode ter recusado por
         preço. */
      const SEM_TD  = ['td_ausente', 'td_indisponivel', 'ec_fechado', 'sem_objecao'];
      const COM_TD  = ['preco', 'ja_abastecido', 'prazo_limite_insuficiente', 'sem_objecao',
                       'cliente_com_divida', 'credito_nao_liberado', 'sku_indisponivel',
                       'ruptura_de_produto', 'fora_do_perfil_praso'];
      const pedeMotivo = res === 'sem_avanco' || res === 'td_encontrado';
      out.push({
        id: 't' + pad(seq),
        estabelecimentoId: pin.id,
        tipo: t.tipo,
        data: t.data,
        status: t.status,
        responsavelId: pin.vendedorId,        // DERIVADO: herda o vendedor do pin
        checkinEm: t.checkinEm || null,
        checkoutEm: t.checkoutEm || null,
        distanciaKm: !temCheckin ? null
          : (t.distanciaKm != null ? t.distanciaKm
            : (rnd() < 0.85 ? Math.round(rnd() * 30) / 100           // até 300m: presencial
                            : Math.round(55 + rnd() * 345) / 100)),  // 0,55–4 km: remoto
        // Hora MARCADA (opcional) e a rota a que a parada pertence (null = avulsa).
        hora: t.hora || null,
        rotaId: t.rotaId || null,
        resultado: res,
        // Os quatro checkboxes do check-out (spec-07 §3).
        tdEncontrado: res ? !!tdEnc : false,
        vendaDeclarada: res === 'vendido',
        motivoNaoVenda: t.motivoNaoVenda ||
          (pedeMotivo ? umDe(tdEnc ? COM_TD : SEM_TD) : null),
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
        motivoNaoVenda: e.motivoNaoVenda, tdEncontrado: e.tdEncontrado,
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
        /* Cliente ativo recebe recorrência — é o tipo que existe pra isso.
           Em um terço dos CSC a recorrência fecha VENDA: cadastrado, vendedor
           declarou o pedido e o ERP ainda não confirmou. É esse pin que carrega
           a tag `Venda realizada` no board — o vão entre o campo e o sistema,
           que é o que a supervisão quer enxergar. */
        realizada(p, 'recorrencia', isoPlus(-(2 + (i % 12))),
          (st === 'csc' && i % 3 === 0) ? 'vendido' : 'sem_avanco',
          { notas: 'Reposição da semana conferida.' });
      } else if (st === 'sem_plano') {
        // A base fora do pipeline. Uma fatia entra por plano, outra saiu pelas laterais.
        if (nPlan < 6) {                       // → Visita planejada AVULSA (futuro)
          nPlan += 1;
          // Avulsa = agendada pelo próprio vendedor, fora de rota (`rotaId` null).
          // Uma em cada três nasce SEM hora — é o caso "dia inteiro" da Agenda.
          add(p, { tipo: nPlan % 2 ? 'primeira_visita' : 'follow_up',
                   data: isoPlus(1 + nPlan), status: 'planejada',
                   hora: nPlan % 3 === 0 ? null : hhmm(14 * 60 + (nPlan % 4) * 45),
                   notas: NOTAS_AGENDA[(nPlan - 1) % NOTAS_AGENDA.length] });
        } else if (nAtras < 2) {               // → Visita planejada, ATRASADA
          nAtras += 1;
          add(p, { tipo: 'primeira_visita', data: isoPlus(-(2 + nAtras)), status: 'planejada',
                   notas: 'Reagendar — não deu tempo na rota.' });
        } else if (nPerd < 4) {                // → Perdido
          nPerd += 1;
          const mot = ['preco_alto', 'ja_tem_fornecedores', 'sem_interesse', 'sem_contato_efetivo'][nPerd - 1];
          realizada(p, 'primeira_visita', isoPlus(-(5 + nPerd * 3)), 'perdido', { motivoPerda: mot });
        } else if (nDesq < 3) {                // → Desqualificado
          nDesq += 1;
          const mot = ['nao_existe_no_endereco', 'cnpj_baixado', 'fora_de_funcionamento'][nDesq - 1];
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
      /* ⚖️ `vendido` cabe aqui sem mexer no board, e a razão é a mesma regra
         de sempre: `RESULTADO.vendido.status` é `td_encontrado`. Num pin que
         JÁ é TD encontrado, a última realizada virar venda não muda a coluna
         — muda só a tag. Em `csc`/`aquisicao` o status vem do ERP e prevalece,
         então o resultado é livre. Em `visitado`, não: `vendido` o promoveria
         e embaralharia o funil (o aviso do bloco acima). */
      function resultadoDe(p) {
        if (p.status === 'visitado')      return 'sem_avanco';
        if (p.status === 'td_encontrado') return rnd() < 0.82 ? 'td_encontrado' : 'vendido';
        const r = rnd();
        return r < 0.45 ? 'sem_avanco' : (r < 0.75 ? 'td_encontrado' : 'vendido');
      }
      function tipoDe(p) {
        if (p.status === 'csc' || p.status === 'aquisicao') return rnd() < 0.75 ? 'recorrencia' : 'follow_up';
        return rnd() < 0.7 ? 'follow_up' : 'primeira_visita';
      }

      /* ---- TODO dia de campo nasce em ROTA (rascunho do objeto Rota) -----
         Regra do rascunho (docs/objetos/rota.md): a rota é um CONJUNTO de
         estabelecimentos de UM vendedor num DIA, e **adicionar estabelecimento
         à rota é o que CRIA a tarefa planejada**. Por isso o seed cria a rota
         primeiro e as paradas depois — não agrupa tarefas soltas por dia.

         Vale para o PASSADO também: a visita realizada era a parada de uma rota
         que foi executada. Sem isso a coluna "Nome Rota" da gerencial diria
         "Avulsa" em ~460 de 545 linhas — o oposto do que a tela mostra.

         Duas amarras vindas do contrato:
           · `responsavel_id` é DERIVADO do pin (tarefa.md §5), então uma rota
             só contém pins do mesmo vendedor;
           · rota é conjunto, NÃO sequência — nenhuma ordem de paradas é
             guardada (sequenciamento segue sendo o objeto Rota da Fase 4). A
             `hora` de cada parada é o horário marcado, e é ela que ordena.
         As paradas saem por PROXIMIDADE: escolhe-se uma âncora (girando, para
         a rota não repetir) e pegam-se os vizinhos mais próximos dela. Agrupar
         por bucket de zona daria rota de uma parada no dataset fictício (cada
         vendedor tem ~1 pin por bairro), e uma janela qualquer daria "Rota Boa
         Viagem" com parada em Casa Forte — nome que é enfeite. Com vizinho mais
         próximo, o bairro dominante do bloco é verdade. */
      const porVend = {};
      emCampo.forEach(function (p) {
        const v = p.vendedorId || VENDEDOR_ORDER[0];
        (porVend[v] = porVend[v] || { pins: [], cursor: 0 }).pins.push(p);
      });

      // Distância só comparativa (grau², sem raiz nem projeção) — serve para
      // ordenar vizinhos, e não é a `distancia_km` do check-in.
      function perto(a, b) {
        const dx = (a.lat - b.lat), dy = (a.lng - b.lng);
        return dx * dx + dy * dy;
      }

      /* Nome da rota = bairro que mais aparece nas paradas. Dois vendedores em
         campo no mesmo dia caem no mesmo bairro com frequência, e duas "Rota
         Boa Viagem" no mesmo dia lê como bug — então o nome é único por DIA:
         cai para o 2º bairro do bloco e, se ainda colidir, leva o vendedor. */
      const nomesUsados = {};
      function nomeDaRota(ps, dia, vendId) {
        const c = {};
        ps.forEach(function (p) {
          const z = p.zone || 'do dia';
          c[z] = (c[z] || 0) + 1;
        });
        const zonas = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; });
        if (!zonas.length) zonas.push('do dia');
        for (let i = 0; i < zonas.length; i++) {
          const cand = 'Rota ' + zonas[i];
          if (!nomesUsados[dia + '|' + cand]) {
            nomesUsados[dia + '|' + cand] = 1;
            return cand;
          }
        }
        const quem = ((VENDEDORES[vendId] || {}).nome || '').split(' ')[0];
        return 'Rota ' + zonas[0] + (quem ? ' · ' + quem : '');
      }

      /* Uma rota por vendedor por dia; paradas espaçadas de 45min.
         `feita = true` gera a rota EXECUTADA (paradas realizadas, com check-in
         no horário marcado e 15% de atividade remota — tarefa.md §5);
         `feita = false` gera o PLANO (paradas planejadas). */
      function rotaDoDia(dia, min, max, inicio, feita) {
        VENDEDOR_ORDER.forEach(function (v) {
          const bag = porVend[v];
          if (!bag || !bag.pins.length) return;
          const n = Math.min(entre(min, max), bag.pins.length);
          const ancora = bag.pins[bag.cursor % bag.pins.length];
          const paradas = bag.pins.slice()
            .sort(function (a, b) { return perto(a, ancora) - perto(b, ancora); })
            .slice(0, n);
          // A âncora do próximo dia anda um passo além do bloco de hoje.
          bag.cursor = (bag.cursor + n) % bag.pins.length;

          seqRota += 1;
          const rota = {
            id: 'r' + pad(seqRota),
            nome: nomeDaRota(paradas, dia, v),
            data: dia,
            responsavelId: v,
            criadaEm: dia + 'T07:00:00'
          };
          rotas.push(rota);

          let hora = inicio;
          paradas.forEach(function (p) {
            const h = hhmm(hora);
            /* Parte do plano NÃO acontece — 12% das paradas de rota passada
               ficam `planejada` em data vencida. É o que dá ao par de gráficos
               L7D o "planejei X, executei Y" com diferença de verdade; duas
               barras coladas não mostram nada.
               ⚠️ Isto substitui as "remotas sem check-in" que o seed gerava
               até 28/07: sem check-in não há realização (tarefa.md §5). */
            const naoFoi = feita && rnd() < 0.12;
            const realizou = feita && !naoFoi;
            add(p, {
              tipo: tipoDe(p), data: dia, rotaId: rota.id, hora: h,
              status: realizou ? 'realizada' : 'planejada',
              checkinEm:  realizou ? dia + 'T' + h + ':00' : null,
              checkoutEm: realizou ? dia + 'T' + hhmm(hora + 40) + ':00' : null,
              resultado: realizou ? resultadoDe(p) : null,
              // Depois de ir, a nota é de campo; antes, é a do agendamento.
              notas: realizou ? (rnd() < 0.35 ? umDe(NOTAS_CAMPO) : null)
                              : (rnd() < 0.3  ? umDe(NOTAS_AGENDA) : null)
            });
            hora += 45;
          });
        });
      }

      // Passado: as rotas que rodaram (3 vendedores × 3–5 paradas por dia útil).
      diasUteis(-44, -1).forEach(function (dia) { rotaDoDia(dia, 3, 5, 8 * 60 + 30, true); });

      /* HOJE, dia em andamento: a rota da manhã já foi executada e a da tarde
         está de pé. É o único dia em que os dois gráficos L7D contam a história
         completa ("planejei, executei parte") — sem isso a última coluna nasce
         vazia, o que a supervisão lê como gráfico quebrado. Planejada não move
         status de pin que já tem realizada (o resultado prevalece). */
      const hj = isoLocal(new Date());
      if (hj === diaUtil(hj, false)) {          // não semeia em fim de semana
        rotaDoDia(hj, 2, 2, 8 * 60 + 30, true);
        rotaDoDia(hj, 2, 3, 13 * 60 + 30, false);
      }

      // Plano da semana que vem.
      diasUteis(1, 8).forEach(function (dia) { rotaDoDia(dia, 3, 5, 8 * 60 + 30, false); });
    }

    /* Promoção opcional a TD encontrado — só o DADO REAL usa (`opts.promoverTd`).
       A régua do snapshot só conhece Cadastrado / visitado / não visitado, então
       sem isto a coluna "TD encontrado" nasce vazia no board mesmo com tarefas
       simuladas. Roda por último e data de HOJE: o `reconcileStatus` é last-wins,
       então esta tarefa é a que manda no pin. No fictício, `opts` vem vazio e
       nada aqui executa — o board fictício não se mexe. */
    const nTd = (opts && opts.promoverTd) || 0;
    if (nTd) {
      const hj = diaUtil(isoLocal(new Date()), false);
      pins.filter(function (p) { return p.status === 'visitado'; })
          .slice(0, nTd)
          .forEach(function (p) {
            realizada(p, 'follow_up', hj, 'td_encontrado',
              { notas: 'Falei com o dono; retomar proposta.' });
          });
    }

    // Devolve as DUAS coleções: a rota é objeto próprio (rascunho), não um
    // rótulo derivado das tarefas — quem agrupa é o `rotaId` da parada.
    return { tarefas: out, rotas: rotas };
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
      /* Tag `Venda realizada` (28/07) — DERIVADA, nunca digitada: existe
         enquanto houver venda declarada em campo que o ERP ainda não confirmou
         com pedido. É o vão entre o que o vendedor viu e o que o sistema sabe,
         e é por isso que ela some sozinha em Aquisição: lá o pedido chegou e a
         tag não teria mais o que denunciar. Em CSC ela FICA — cadastrado sem
         compra com venda declarada é exatamente o furo. */
      p.vendaDeclarada = novo !== 'aquisicao' &&
        feitas.some(function (t) { return t.vendaDeclarada; });
      if (feitas.length) p.lastVisit = feitas[feitas.length - 1].data;
      // `pin.checkins` DERIVA das tarefas (tarefa.md §7) — não é mais fonte.
      p.checkins = feitas.filter(function (t) { return t.checkinEm; })
        .map(function (t) { return { in: t.checkinEm, out: t.checkoutEm }; })
        .reverse();
      // `statusCliente` deriva de `status`, que acabou de ser recalculado aqui —
      // sem esta linha o filtro novo congelaria no valor da carga.
      p.statusCliente = deriveStatusCliente(p);
    });

    return pins;
  }

  window.CRM_DATA = {
    ORIGINS: ORIGINS,
    ORIGIN_ORDER: ORIGIN_ORDER,
    RELACAO: RELACAO,
    RELACAO_ORDER: RELACAO_ORDER,
    relacaoDe: relacaoDe,
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
    CHECKOUT_FLAGS: CHECKOUT_FLAGS,
    VENDA_IMPLICA_TD: VENDA_IMPLICA_TD,
    deriveResultado: deriveResultado,
    normalizeCheckout: normalizeCheckout,
    MOTIVO_NAO_VENDA: MOTIVO_NAO_VENDA,
    MOTIVO_PERDA: MOTIVO_PERDA,
    MOTIVO_DESQUALIFICACAO: MOTIVO_DESQUALIFICACAO,
    CNAE_TIER: CNAE_TIER,
    CNAE_DESC: CNAE_DESC,
    TYPOLOGY_CNAE: TYPOLOGY_CNAE,
    BAIRROS: BAIRROS,
    BAIRRO_CENTERS: BAIRRO_CENTERS,
    BAIRRO_META: BAIRRO_META,
    BAIRRO_ZONA: BAIRRO_ZONA,
    ZONAS_GUARDIOES: ZONAS_GUARDIOES,
    ZONA_ORDER: ZONA_ORDER,
    SEM_ZONA: SEM_ZONA,
    STATUS_CLIENTE: STATUS_CLIENTE,
    STATUS_CLIENTE_ORDER: STATUS_CLIENTE_ORDER,
    MAP_CENTER: MAP_CENTER,
    MAP_ZOOM: MAP_ZOOM,
    // Derivações (puras)
    normalizaZona: normalizaZona,
    zonaDoBairro: zonaDoBairro,
    deriveStatusCliente: deriveStatusCliente,
    deriveQualidade: deriveQualidade,
    deriveCadastrado: deriveCadastrado,
    deriveStatusComercial: deriveStatusComercial,
    resolveStatus: resolveStatus,
    statusAvanca: statusAvanca,
    deriveOrigemConfianca: deriveOrigemConfianca,
    isoPlus: isoPlus,
    matchBusca: matchBusca,
    sugereTipoVisita: sugereTipoVisita,
    RAIO_PRESENCIAL_KM: RAIO_PRESENCIAL_KM,
    deriveTipoCheckin: deriveTipoCheckin,
    buildSeed: buildSeed,
    buildTarefas: buildTarefas,
    reconcileStatus: reconcileStatus
  };
})();
