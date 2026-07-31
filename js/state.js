/* =====================================================================
   state.js — Store em memória + persistência (localStorage).
   Fonte única de verdade dos pins. Emite eventos de mudança.
   Constraint: NUNCA existe operação de excluir pin (o pin nunca some).
   ===================================================================== */
(function () {
  'use strict';

  const KEY = 'crm-externo-map:v9'; // v9: zona de guardioes x bairro, porte com 6 faixas, statusCliente
  const D = window.CRM_DATA;

  let pins = [];
  let tarefas = [];       // atividades datadas (check-in/out É a tarefa)
  let rotas = [];         // RASCUNHO do objeto Rota (docs/objetos/rota.md)
  let realMode = false;   // dado real (porteiro) — NUNCA persiste no localStorage
  const listeners = [];

  function emit() {
    persist();
    listeners.forEach(function (fn) { try { fn(pins); } catch (e) { console.error(e); } });
  }
  function onChange(fn) { listeners.push(fn); }

  /* v4: enum do funil foi de 4 para 8 valores (fatia Tarefa, 27/07) e o estado
     passou a carregar `tarefas`. Estado v3 no localStorage tem status que já não
     existem (nao_visitado / em_negociacao / convertido) — descartar é mais
     seguro do que migrar meia-boca.
     v5 (28/07): a tarefa ganhou `distancia_km` e o seed foi adensado para ritmo
     de campo real. Estado v4 tem tarefas sem o campo e volume antigo — os
     gráficos por dia nasceriam ralos em quem já abriu a demo.
     v6 (28/07): a tarefa ganhou `hora` e `rotaId`, e o estado passou a carregar
     a coleção `rotas`. Estado v5 tem planejadas sem rota nenhuma — a Agenda em
     calendário nasceria sem uma única rota em quem já abriu a demo.
     v7 (28/07): o check-out virou quatro checkboxes e a tarefa ganhou
     `tdEncontrado`, `vendaDeclarada` e `motivoNaoVenda`; `resultado` ganhou
     `vendido`; e os DOIS vocabulários de motivo foram trocados por TRÊS, com
     chaves novas. Estado v6 tem tarefas com `motivoPerda: 'compra_do_
     concorrente'` e afins — chaves que não existem mais, e que apareceriam
     como motivo em branco no detalhe e na gerencial. Migrar meia-boca seria
     inventar o motivo que o vendedor fictício teria escolhido; descartar e
     resemear é honesto.
     v8 (29/07): `origem_confianca` caiu de 4 para 3 valores e as CHAVES mudaram
     (cnpja_puro→cnpj, cnpja_google→google, e "só Google" deixou de existir).
     Estado v7 tem pins com `origin: 'cnpja_google'` — chave fora do enum, que
     cairia no fallback e deixaria o pin sem pista nenhuma no mapa. Aqui migrar
     é honesto (é renomeação, não invenção), e a tabela abaixo faz isso; a
     versão sobe porque o shape do pin mudou de vocabulário.
     v9 (29/07): três mexidas de shape na mesma fatia de filtros. (1) `zone`
     deixou de ser o BAIRRO e passou a ser a zona de `zona_guardioes_c`
     (vocabulário fechado de 15 + "Sem Zona"); o bairro virou o campo `bairro`,
     que é quem ainda dá coordenada, endereço e DDD. (2) `porte` foi de 4 para 6
     faixas e `LTDA` virou `DEMAIS`. (3) nasceu `statusCliente`
     (lead/csc/recorrente/churn), derivado. Estado v8 tem `zone: 'Boa Viagem'`,
     `porte: 'LTDA'` e nenhum `bairro` — migrável, e é o que a tabela abaixo
     faz; a versão sobe porque o significado de um campo existente mudou, que é
     pior que campo novo: silenciosamente, todo pin cairia em "Sem Zona". */
  const STATE_V = 9;

  // Snapshot real e persistência antiga podem trazer o enum velho.
  const STATUS_LEGADO = {
    nao_visitado:  'sem_plano',
    em_negociacao: 'td_encontrado',
    convertido:    'csc'          // conservador: cadastrado, compra não comprovada
  };
  // Origem: renomeação de 29/07. `google_puro` não tem para onde ir sem perder
  // ou inventar — cai em `google` porque o sinal do Google existia (o que se
  // perde é "não tinha CNPJ", e essa categoria deixou de existir por decisão).
  const ORIGIN_LEGADO = {
    cnpja_puro:   'cnpj',
    cnpja_google: 'google',
    google_puro:  'google'
  };
  /* `cadastrado` no vocabulário ANTIGO. O snapshot real em `private/data-real.json`
     foi gerado antes da fatia de Tarefa: ele traz `isConverted`/`convertedAt`
     (o antigo is_converted) e NÃO traz `cadastrado`/`dataCadastro`.
     Sem reconstruir aqui, `cadastrado` ficava `undefined` em todos os 6.914 pins
     — e desde 29/07 isso é a COR do pin, então o mapa real sairia 100% lilás com
     os "Cadastrado" do Salesforce pintados de lead, violando o invariante
     `status ∈ {csc, aquisicao} ⟺ cadastrado` ([[estabelecimento]] §5).
     A informação é REAL, só está com outro nome — três fontes, em ordem:
       1. `cadastrado` já preenchido (fictício e estado v8) — não mexe;
       2. `isConverted` — vem de `status = 'Cadastrado'` no `salesforce.lead`;
       3. o próprio status comercial, para dado de qualquer outra procedência.
     `dataCadastro` só vem se o snapshot tiver `convertedAt` (nele é null): o
     sheet então diz que é cliente sem afirmar desde quando — em vez de inventar
     uma data. E `dataPrimeiraCompra` continua nulo de propósito: o
     `salesforce.lead` não tem fonte de PEDIDO, então todo convertido para em
     CSC (régua provisória — ver docs/snapshot-dado-real.md §6). */
  function migrarRelacao(p) {
    if (p.dataCadastro == null && p.convertedAt) p.dataCadastro = p.convertedAt;
    if (p.cadastrado == null) {
      p.cadastrado = !!(p.dataCadastro || p.isConverted ||
        p.status === 'csc' || p.status === 'aquisicao');
    }
    if (p.dataPrimeiraCompra === undefined) p.dataPrimeiraCompra = null;
  }

  // Porte: 4 -> 6 faixas em 29/07. `LTDA` era rótulo nosso; o valor real da
  // coluna se chama `demais`. As chaves cruas do salesforce.lead também entram,
  // porque o transform da Fase 3 pode entregá-las direto.
  const PORTE_LEGADO = {
    LTDA: 'DEMAIS',
    'me-ei-mei': 'MEI', 'me-ltda': 'ME', 'me-ei-nao_mei': 'ME_EI',
    'epp-ltda': 'EPP', 'epp-ei': 'EPP_EI', 'demais': 'DEMAIS'
  };

  /* Zona/bairro (29/07). O campo `zone` trocou de SIGNIFICADO — era bairro,
     virou zona de guardiões —, então migrar é obrigatório: sem isto todo pin
     antigo cai em "Sem Zona" sem avisar. Duas procedências:
       · estado v8 e seed antigo: `zone` guardava BAIRRO ('Boa Viagem') → move
         para `bairro` e deriva a zona pelo mapa BAIRRO_ZONA;
       · snapshot real: `zone` já é uma zona, mas pode vir de `zona_2_c`, cuja
         taxonomia é OUTRA (só 5 dos 13 valores dela estão nos 15) → o que não
         estiver no vocabulário fechado vira "Sem Zona", sem inventar. */
  function migrarZona(p) {
    if (p.bairro == null && p.zone && D.BAIRRO_ZONA[p.zone]) {
      p.bairro = p.zone;                  // era bairro disfarçado de zona
      p.zone = D.zonaDoBairro(p.bairro);
      return;
    }
    if (p.bairro == null) p.bairro = null; // dado real não tem bairro
    p.zone = D.normalizaZona(p.zone);
  }

  function migratePin(p) {
    if (!p) return p;
    if (STATUS_LEGADO[p.status]) p.status = STATUS_LEGADO[p.status];
    if (!D.STATUS[p.status]) p.status = 'sem_plano';
    if (ORIGIN_LEGADO[p.origin]) p.origin = ORIGIN_LEGADO[p.origin];
    if (!D.ORIGINS[p.origin]) p.origin = 'cnpj';        // arredonda pra BAIXO
    if (PORTE_LEGADO[p.porte]) p.porte = PORTE_LEGADO[p.porte];
    if (p.porte && !D.PORTE[p.porte]) p.porte = null;   // porte desconhecido é nulo, não chute
    migrarZona(p);
    migrarRelacao(p);                                   // roda DEPOIS do status
    p.statusCliente = D.deriveStatusCliente(p);         // e DEPOIS de migrarRelacao
    if (p.checkins == null) p.checkins = [];
    return p;
  }

  function persist() {
    if (realMode) return;   // dado real fica só em memória (privacidade)
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: STATE_V, pins: pins, tarefas: tarefas, rotas: rotas
      }));
    } catch (e) { console.warn('Persistência indisponível:', e); }
  }

  function seedFicticio() {
    pins = D.buildSeed();
    const seed = D.buildTarefas(pins);   // devolve as duas coleções
    tarefas = seed.tarefas;
    rotas = seed.rotas;
    D.reconcileStatus(pins, tarefas);   // o status DERIVA das tarefas + ERP
  }

  function load() {
    let restored = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Só aceita estado da versão corrente — v3 tem enum incompatível.
        if (parsed && parsed.v === STATE_V && Array.isArray(parsed.pins) && parsed.pins.length) {
          restored = parsed;
        }
      }
    } catch (e) { console.warn('Falha ao ler persistência:', e); }

    if (restored) {
      pins = restored.pins.map(migratePin);
      tarefas = Array.isArray(restored.tarefas) ? restored.tarefas : [];
      rotas = Array.isArray(restored.rotas) ? restored.rotas : [];
    } else {
      seedFicticio();
      persist();
    }
  }

  function resetDemo() {
    realMode = false;       // volta ao fictício (e volta a persistir)
    document.body.classList.remove('real-mode');
    seedFicticio();
    emit();
  }

  /* Troca o dataset para o snapshot real vindo do porteiro (auth.js).
     Não persiste (privacidade) — e as tarefas simuladas abaixo também não,
     porque `persist()` já sai cedo em `realMode`: morrem no reload.

     ⚠️ O snapshot NÃO traz atividade nenhuma. Sem simular, a aba Atividades
     nasce vazia e o board mostra só Visitado/CSC — quatro das sete colunas
     ficam desertas (spec-06 §7). Então geramos as MESMAS tarefas fictícias do
     seed sobre os pins reais.

     Duas travas para isso não corromper a leitura do dado real:
       1. O volume é função do TIME, não da base: 3 vendedores fazem ~12 visitas
          por dia útil, tenham eles 61 ou 6.914 pins. `buildTarefas` já limita
          assim, então o número de tarefas é o mesmo dos dois lados.
       2. A régua do snapshot PREVALECE onde ela sabe mais que a tarefa
          inventada — `csc`/`aquisicao` vêm do ERP, e pin sem tarefa mantém o
          status que o snapshot deu. Ver spec-07 §5.6.

     A honestidade fica com a faixa fixa nas abas (`body.real-mode`): estes são
     CNPJs e endereços de verdade com visitas que não aconteceram. */
  function useRealData(realPins) {
    if (!Array.isArray(realPins) || !realPins.length) return false;
    realMode = true;
    pins = realPins.map(migratePin);

    // O snapshot traz o NOME do vendedor, não um id da nossa tabela. Como a
    // decisão foi atribuir aos 3 fictícios, o nome real é descartado de
    // propósito: número de desempenho inventado não vai no nome de gente real.
    pins.forEach(function (p, i) {
      p.vendedorId = D.VENDEDOR_ORDER[i % D.VENDEDOR_ORDER.length];
      p.vendedor = D.VENDEDORES[p.vendedorId].nome;
    });

    const daRegua = {};
    let nVisitado = 0;
    pins.forEach(function (p) {
      daRegua[p.id] = p.status;
      if (p.status === 'visitado') nVisitado += 1;
    });

    // A régua do snapshot não conhece "TD encontrado" — sem promover alguns, a
    // coluna nasce vazia no board (spec-06 §7).
    const sim = D.buildTarefas(pins, { promoverTd: Math.min(30, Math.round(nVisitado * 0.15)) });
    tarefas = sim.tarefas;
    rotas = sim.rotas;          // as rotas simuladas também morrem no reload
    D.reconcileStatus(pins, tarefas);

    const comTarefa = {};
    tarefas.forEach(function (t) { comTarefa[t.estabelecimentoId] = 1; });
    pins.forEach(function (p) {
      const antes = daRegua[p.id];
      // ERP prevalece (o "Cadastrado" do snapshot É o sinal comercial), e quem
      // não ganhou tarefa nenhuma não pode ser rebaixado a `sem_plano` por isso.
      if (antes === 'csc' || antes === 'aquisicao' || !comTarefa[p.id]) p.status = antes;
    });

    document.body.classList.add('real-mode');
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

  /* ---- Escrita do status do funil — o ÚNICO lugar que mexe em p.status.
          Contrato (docs/objetos/estabelecimento.md §5): o comercial (ERP)
          prevalece; o avanço na escada é monotônico; as laterais guardam a
          etapa de origem; e a única reversão é visita_planejada → sem_plano
          (cancelar o plano). Devolve true se mudou. ---- */
  /* `statusCliente` deriva de `status` + `cadastrado`, então TODO caminho que
     move o status precisa rederivar. Envolver o corpo é mais seguro que espalhar
     a linha pelos três `return true` — o próximo caminho novo já nasce coberto. */
  function applyStatus(p, novo) {
    const mudou = applyStatusRaw(p, novo);
    if (mudou) p.statusCliente = D.deriveStatusCliente(p);
    return mudou;
  }

  function applyStatusRaw(p, novo) {
    if (!p || !D.STATUS[novo] || p.status === novo) return false;
    const atualFam = D.STATUS[p.status] ? D.STATUS[p.status].family : 'entrada';

    // O ERP vence o campo: quem tem cadastro/pedido não sai de csc/aquisicao.
    const comercial = D.deriveStatusComercial(p.dataCadastro, p.dataPrimeiraCompra);
    if (comercial && D.STATUS[novo].family !== 'comercial') return false;

    // Saída lateral: guarda de onde saiu (só se não estava já numa lateral).
    if (D.STATUS[novo].family === 'lateral') {
      if (atualFam !== 'lateral') p.statusAnterior = p.status;
      p.status = novo;
      return true;
    }

    /* Voltando de uma lateral, quem vale na comparação é a ETAPA DE ORIGEM — mas
       nada é escrito antes de saber que a transição vale.
       ⚠️ **Corrigido em 30/07.** A restauração acontecia aqui e o `return false`
       vinha depois, então uma transição RECUSADA já tinha mexido no pin: agendar
       num `perdido` (que não avança para `visita_planejada`) tirava o pin da
       lateral pela metade — status de volta em `visitado`, `motivo_status` da
       perda ainda colado, `statusAnterior` perdido, e a função dizendo que nada
       mudou (logo `statusCliente` nem era rederivado). Escrita só depois da
       decisão: ou a transição inteira acontece, ou nada acontece. */
    const base = (atualFam === 'lateral') ? (p.statusAnterior || 'sem_plano') : p.status;

    // Cancelar o plano é a única reversão permitida na escada.
    const cancelandoPlano = (novo === 'sem_plano' && base === 'visita_planejada');
    // `base === novo` é a volta pura para a etapa de origem: nada a avançar.
    if (base !== novo && !cancelandoPlano && !D.statusAvanca(base, novo)) return false;

    p.status = novo;
    /* Sair da lateral apaga o que só explicava a lateral. `motivo_status` é o
       motivo da SAÍDA (estabelecimento.md §5): num pin de volta ao funil ele
       vira mentira — "Perdido (preço)" escrito num ponto em Visitado. Mora aqui
       porque este é o único lugar que escreve `status`, e as duas portas de
       volta (tarefa concluída e arraste no Funil) passam por dentro. */
    if (atualFam === 'lateral') { p.statusAnterior = null; p.motivoStatus = null; }
    return true;
  }

  function checkIn(id) {
    const p = getById(id);
    if (!p) return null;
    if (openCheckin(id)) return p; // já existe um aberto
    p.checkins.unshift({ in: nowISO(), out: null });
    // Um check-in é uma visita: registra e marca como visitado.
    p.lastVisit = todayISO();
    applyStatus(p, 'visitado');
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
  // NOTA de domínio: o status nunca é digitado; no produto real anda por tarefa
  // ou pelo ERP. Aqui o arraste é afordância de protótipo, com TRÊS RECUSAS
  // (SPEC 06 §4): as laterais exigem motivo (só por tarefa concluída) e
  // csc/aquisicao vêm do ERP. Devolve null quando recusa.
  function setStatus(id, status) {
    const p = getById(id);
    if (!p || !D.STATUS[status] || p.status === status) return null;
    const fam = D.STATUS[status].family;
    if (fam === 'lateral' || fam === 'comercial') return null;
    if (!applyStatus(p, status)) return null;
    emit();
    return p;
  }

  /* =====================================================================
     TAREFAS — a Tarefa dirige o funil: agendar faz o pin ENTRAR, concluir
     move a etapa pelo `resultado`, cancelar o último plano faz SAIR.
     Contrato: docs/objetos/tarefa.md §5
     ===================================================================== */

  function getTarefas() { return tarefas.slice(); }
  function getTarefa(id) { return tarefas.find(function (t) { return t.id === id; }) || null; }
  function getTarefasByPin(pinId) {
    return tarefas.filter(function (t) { return t.estabelecimentoId === pinId; });
  }
  function planejadasDoPin(pinId) {
    return tarefas.filter(function (t) {
      return t.estabelecimentoId === pinId && t.status === 'planejada';
    });
  }
  function tarefaAberta(pinId) {   // check-in feito e check-out pendente
    return tarefas.find(function (t) {
      return t.estabelecimentoId === pinId && t.status === 'planejada' && t.checkinEm && !t.checkoutEm;
    }) || null;
  }

  /* A visita em andamento é UMA, no app inteiro (29/07). `tarefaAberta` responde
     *"este pin tem visita aberta?"*; esta responde *"existe visita aberta em
     ALGUM pin?"* — a pergunta que o mapa faz para mostrar a faixa e a que barra
     um segundo check-in.
     ⚠️ **Não filtra por vendedor, de propósito.** `responsavelId` é DERIVADO do
     dono do pin (`agendarTarefa`), não de quem tocou o botão: filtrar por
     `VENDEDOR_SESSAO` deixaria o bloqueio vazar justo no caso que importa —
     check-in num pin de outro vendedor abriria a segunda visita aberta. Com
     sessão de verdade (auth/RLS, Fase 4) isto passa a ser por vendedor.
     O seed nunca deixa check-in aberto (`checkinEm` e `checkoutEm` andam
     juntos), então a faixa só aparece por ação de quem está usando. */
  function checkinAberto() {
    return tarefas.find(function (t) {
      return t.status === 'planejada' && t.checkinEm && !t.checkoutEm;
    }) || null;
  }
  function nextTarefaId() {
    let max = 0;
    tarefas.forEach(function (t) {
      const n = parseInt(String(t.id).replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return 't' + String(max + 1).padStart(3, '0');
  }

  /* ---- ROTA (rascunho — docs/objetos/rota.md) -------------------------
     A rota é um CONJUNTO de estabelecimentos de um vendedor num dia; cada
     estabelecimento adicionado É uma tarefa planejada (a parada). Não há
     ordem guardada — sequenciamento continua sendo o objeto Rota da Fase 4.
     Tarefa sem `rotaId` é AVULSA (o vendedor marcou aquele compromisso). ---- */
  function getRotas() { return rotas.slice(); }
  function getRota(id) { return rotas.find(function (r) { return r.id === id; }) || null; }
  function paradasDaRota(id) {
    return tarefas.filter(function (t) { return t.rotaId === id && t.status === 'planejada'; });
  }
  /* Todas as paradas, em qualquer situação — é o que a sub-aba Rotas lê
     (31/07). `paradasDaRota` devolve só as `planejada` porque a Agenda é o
     PLANO; o registro da rota precisa das realizadas e das canceladas, senão
     uma rota que já rodou aparece com "0 paradas" e a que foi cancelada
     desaparece. Ver docs/objetos/rota.md §5 e spec-07 §4.3. */
  function paradasTodasDaRota(id) {
    return tarefas.filter(function (t) { return t.rotaId === id; });
  }

  // Cancelar a rota = cancelar todas as paradas dela. Nada se deleta (nem a
  // rota, nem as tarefas), e cada pin que perde o último plano SAI do board.
  function cancelarRota(id) {
    const r = getRota(id);
    if (!r) return null;
    const paradas = paradasDaRota(id);
    paradas.forEach(function (t) {
      t.status = 'cancelada';
      const p = getById(t.estabelecimentoId);
      if (p && !planejadasDoPin(p.id).length && p.status === 'visita_planejada') {
        applyStatus(p, 'sem_plano');
      }
    });
    if (paradas.length) emit();
    return paradas.length;
  }

  /* A tarefa planejada, sem emitir — o pedaço comum de `agendarTarefa` (uma
     tarefa, um emit) e de `criarRota` (N tarefas, UM emit). Extraído em 31/07
     porque montar uma rota de 5 paradas chamando `agendarTarefa` 5 vezes
     custaria 5 `reapply()` + 5 refresh de todas as abas. */
  function novaTarefaPlanejada(p, data) {
    const t = {
      id: nextTarefaId(),
      estabelecimentoId: p.id,
      tipo: data.tipo,
      data: data.data || todayISO(),
      // Hora é OPCIONAL (tarefa.md §4): sem ela a parada é "dia inteiro".
      hora: /^\d{2}:\d{2}$/.test(data.hora || '') ? data.hora : null,
      rotaId: data.rotaId || null,          // null = avulsa, fora de rota
      status: 'planejada',
      responsavelId: p.vendedorId || D.VENDEDOR_SESSAO,  // DERIVADO, nunca digitado
      checkinEm: null, checkoutEm: null,
      // Desfecho — tudo nasce vazio e só o check-out preenche (spec-07 §3).
      resultado: null, tdEncontrado: false, vendaDeclarada: false,
      motivoNaoVenda: null, motivoPerda: null, motivoDesqualificacao: null, motivoTexto: null,
      notas: (data.notas && data.notas.trim()) || null,
      criadoPor: D.VENDEDOR_SESSAO
    };
    tarefas.push(t);
    /* Agendar NÃO tira o pin da lateral (tarefa.md §5): voltar de `perdido`/
       `desqualificado` exige tarefa CONCLUÍDA — constatação de campo, com autor e
       data. Um plano não constata nada, e a tarefa fica lá, planejada, esperando
       o check-out que vai mover o pin. A guarda é EXPLÍCITA em vez de confiar na
       escada: um lateral sem `statusAnterior` (dado antigo, snapshot real) cairia
       em `sem_plano`, de onde `visita_planejada` é avanço legítimo — e o pin
       voltaria ao funil por um agendamento.
       ⚖️ Vale igual para a PARADA DE ROTA: montar rota é plano, não constatação. */
    if ((D.STATUS[p.status] || {}).family !== 'lateral') applyStatus(p, 'visita_planejada');
    return t;
  }

  // Agendar: o pin ENTRA no funil (sem_plano → visita_planejada).
  function agendarTarefa(data) {
    const p = data && getById(data.pinId);
    if (!p || !D.TAREFA_TIPO[data.tipo]) return null;
    const t = novaTarefaPlanejada(p, data);
    emit();
    return t;
  }

  function nextRotaId() {
    let max = 0;
    rotas.forEach(function (r) {
      const n = parseInt(String(r.id).replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return 'r' + String(max + 1).padStart(3, '0');
  }

  /* ---- Montar rota (31/07) --------------------------------------------------
     A rota é o CONJUNTO; **adicionar um estabelecimento à rota é o que cria a
     tarefa planejada** daquela parada (rota.md §2.2). Então criar rota é: um
     registro de rota + N tarefas `planejada`, e **N pins entram no funil**.
     Três coisas que esta função garante, e que a UI só repete:
       · **uma rota, um vendedor** (rota.md §2.4) — `responsavelId` da tarefa é
         derivado do PIN, então pins de donos diferentes fariam uma rota com
         duas gentes dentro. Recusa em bloco, sem gravar nada;
       · **nenhuma HORA** — a hora ordenaria as paradas, e rota é conjunto, não
         sequência (rota.md §2.1). As paradas nascem "dia inteiro";
       · **um `emit` só** no fim: 5 paradas não são 5 re-renders do app.
     ⚖️ Transição recusada não escreve nada (o padrão de 30/07): a validação
     inteira acontece antes da primeira escrita. */
  function criarRota(dados) {
    const dia = /^\d{4}-\d{2}-\d{2}$/.test(dados && dados.data) ? dados.data : todayISO();
    const pins = ((dados && dados.pinIds) || []).map(getById).filter(Boolean);
    if (pins.length < 2) return null;

    const donoDe = function (p) { return p.vendedorId || D.VENDEDOR_SESSAO; };
    const vend = donoDe(pins[0]);
    if (pins.some(function (p) { return donoDe(p) !== vend; })) return null;

    const rota = {
      id: nextRotaId(),
      nome: D.nomeDeRota(pins, dia, vend, function (cand) {
        return rotas.some(function (r) { return r.data === dia && r.nome === cand; });
      }),
      data: dia,
      responsavelId: vend,
      criadaEm: new Date().toISOString(),
      canceladaEm: null
    };
    rotas.push(rota);

    const paradas = pins.map(function (p) {
      return novaTarefaPlanejada(p, {
        // O tipo vem SUGERIDO pelo histórico do ponto, não escolhido na
        // montagem: pedir o tipo de N pontos numa tela de seleção espacial
        // seria N escolhas para um gesto que é um só (tarefa.md §5).
        tipo: D.sugereTipoVisita(p, getTarefasByPin(p.id)),
        data: dia,
        rotaId: rota.id
      });
    });
    emit();
    return { rota: rota, paradas: paradas };
  }

  // Cancelar: não se deleta tarefa. Se era o último plano, o pin SAI do board.
  function cancelarTarefa(id) {
    const t = getTarefa(id);
    if (!t || t.status !== 'planejada') return null;
    t.status = 'cancelada';
    const p = getById(t.estabelecimentoId);
    if (p && !planejadasDoPin(p.id).length && p.status === 'visita_planejada') {
      applyStatus(p, 'sem_plano');
    }
    emit();
    return t;
  }

  /* Check-in: marca presença na tarefa e promove a origem (monotônico).
     ⚖️ Se a tarefa estava ATRASADA, a `data` vem para hoje. Em planejada a
     data é quando se pretende ir; em realizada é **quando aconteceu**, e é
     dela que saem a tabela e os gráficos por dia. Fazer check-in hoje numa
     tarefa de ontem e deixar a data velha poria a visita no dia errado, com
     `checkin_em` de hoje ao lado — dado que se contradiz na mesma linha. */
  function checkInTarefa(id) {
    const t = getTarefa(id);
    if (!t || t.status !== 'planejada' || t.checkinEm) return null;
    /* Invariante: UMA visita aberta no app (29/07). A guarda vive aqui porque
       este é o único lugar que abre check-in — as duas portas de UI (botão do
       pin e detalhe da atividade) passam por dentro. Quem recusa explica: a UI
       consulta `checkinAberto()` antes e oferece o check-out de lá. */
    if (checkinAberto()) return null;
    const hoje = todayISO();
    if (t.data < hoje) t.data = hoje;
    t.checkinEm = nowISO();
    /* A distância é medida AGORA e persiste — é ela que classifica a visita em
       presencial × remoto (D.deriveTipoCheckin) e não é recalculável depois (o
       vendedor já saiu de lá). Sem GPS até a Fase 3/4, o protótipo semeia um
       valor dentro do raio: quem toca o botão estando no sheet do ponto está,
       para todos os efeitos da demo, na porta. */
    if (t.distanciaKm == null) t.distanciaKm = Math.round(Math.random() * 18) / 100;
    const p = getById(t.estabelecimentoId);
    if (p) { promoteToFieldValidated(p); p.geoVerificado = { lat: p.lat, lng: p.lng }; }
    emit();
    return t;
  }

  /* Corrigir o TIPO de uma tarefa — só enquanto ela é `planejada`.
     É o que o botão de check-in pede ao vendedor: conferir se o tipo está
     certo. Tarefa realizada é REGISTRO, não formulário (tarefa.md §8): nada
     de edição retroativa, nem aqui nem em lugar nenhum. */
  function setTipoTarefa(id, tipo) {
    const t = getTarefa(id);
    if (!t || t.status !== 'planejada' || !D.TAREFA_TIPO[tipo]) return null;
    if (t.tipo === tipo) return t;
    t.tipo = tipo;
    emit();
    return t;
  }

  /* ---- CHECK-IN EM QUALQUER PIN (CAP-6 revisada) ----------------------
     O vendedor não precisa de plano para visitar: passou na porta, entrou.
     Se existe planejada para HOJE ou ATRASADA, o check-in é nela — é a mesma
     visita, e criar outra duplicaria o compromisso. Se a próxima planejada é
     FUTURA, não se toca nela: nasce uma tarefa de hoje e o plano segue de pé
     (reescrever a data do plano seria decidir pelo vendedor que aquele
     compromisso morreu). Sem planejada nenhuma, também nasce uma de hoje.
     Devolve a tarefa com check-in aberto. */
  function checkInAgora(pinId, tipo) {
    const p = getById(pinId);
    if (!p) return null;
    // Uma visita aberta no app inteiro — e a guarda é ANTES de agendar, senão a
    // recusa deixaria para trás uma planejada de hoje que ninguém pediu.
    if (checkinAberto()) return null;
    const hoje = todayISO();
    const doDia = planejadasDoPin(pinId)
      .filter(function (t) { return t.data <= hoje && !t.checkinEm; })
      .sort(function (a, b) { return a.data < b.data ? -1 : 1; })[0] || null;

    if (doDia) {
      if (tipo && D.TAREFA_TIPO[tipo] && doDia.tipo !== tipo) doDia.tipo = tipo;
      return checkInTarefa(doDia.id);              // emite lá dentro
    }
    const nova = agendarTarefa({
      pinId: pinId,
      tipo: (tipo && D.TAREFA_TIPO[tipo]) ? tipo : D.sugereTipoVisita(p, getTarefasByPin(pinId)),
      data: hoje
    });
    return nova ? checkInTarefa(nova.id) : null;
  }

  /* Concluir (check-out): é aqui que a atividade vira dado e o funil se move.
     `resultado` é obrigatório; perdido/desqualificado exigem motivo.
     ⚖️ **Exige check-in** (28/07): sem presença registrada a tarefa não vira
     realizada — fica não realizada, e `tipo_checkin` fica nulo. O que separa
     `presencial` de `remoto` é a DISTÂNCIA no check-in, não a ausência dele
     (tarefa.md §5). */
  function concluirTarefa(id, out) {
    const t = getTarefa(id);
    out = out || {};
    if (!t || t.status !== 'planejada') return null;
    if (!t.checkinEm) return null;          // sem check-in não há conclusão

    /* O `resultado` não vem mais digitado: vem dos quatro checkboxes (§3).
       `normalizeCheckout` aplica as regras de combinação ANTES da derivação,
       para que o que é gravado seja exatamente o que a tela mostrava. */
    const f = D.normalizeCheckout(out);
    const r = D.RESULTADO[D.deriveResultado(f)];
    if (!r) return null;

    // Motivo é obrigatório nas duas laterais E na não venda (§3). O motivo de
    // não venda SOME quando há lateral: vale só o da saída.
    const motLateral = r.motivo ? out.motivo : null;
    if (r.motivo && !motLateral) return null;
    const pedeNaoVenda = !r.motivo && !f.vendaDeclarada;
    const motNaoVenda = pedeNaoVenda ? (out.motivoNaoVenda || null) : null;
    if (pedeNaoVenda && !motNaoVenda) return null;
    // `outro` vale nos três vocabulários; o texto acompanha o motivo efetivo.
    const motEfetivo = motLateral || motNaoVenda;
    if (motEfetivo === 'outro' && !(out.motivoTexto && out.motivoTexto.trim())) return null;

    // O tipo confirmado no sheet de conclusão entra no mesmo ato — é a última
    // janela em que a tarefa é `planejada` e, portanto, editável (§8).
    if (out.tipo && D.TAREFA_TIPO[out.tipo]) t.tipo = out.tipo;
    t.status = 'realizada';
    t.checkoutEm = nowISO();
    t.resultado = r.key;
    // Os checkboxes viram FATO guardado, não só o rótulo derivado: `perdido`
    // com TD encontrado é diferente de `perdido` sem falar com ninguém, e o
    // enum de resultado único não caberia as duas coisas.
    t.tdEncontrado = !!f.tdEncontrado;
    t.vendaDeclarada = !!f.vendaDeclarada;
    t.motivoNaoVenda = motNaoVenda;
    t.motivoPerda = (r.motivo === 'perda') ? motLateral : null;
    t.motivoDesqualificacao = (r.motivo === 'desqualificacao') ? motLateral : null;
    t.motivoTexto = (motEfetivo === 'outro') ? String(out.motivoTexto).trim() : null;
    /* `proxima_acao` (+ data) morreu em 30/07: era texto que não virava tarefa e
       cuja única superfície (as Sugestões da Agenda) saiu em 28/07. A
       continuidade agora é uma TAREFA de verdade, agendada pelo mesmo sheet de
       check-out — quem chama concluir e quer marcar a volta chama
       `agendarTarefa` depois (js/pin.js). */
    // A nota da ATIVIDADE (≠ nota do ponto). Até 28/07 só o agendar a escrevia;
    // o check-out é o momento em que há o que contar.
    if (out.notas != null) t.notas = (String(out.notas).trim() || null);

    const p = getById(t.estabelecimentoId);
    if (p) {
      p.lastVisit = t.data;
      /* `motivoStatus` explica a SAÍDA LATERAL no pin — só existe quando há
         uma. O motivo de não venda não entra aqui: ele é do evento, não do
         estado do ponto, e "Sem objeção específica" colado no pin não diria
         nada a quem o abrir depois.
         Em `outro`, mostra o TEXTO que o vendedor escreveu — a palavra "Outro"
         também não informa nada. */
      p.motivoStatus = !r.motivo ? null : (t.motivoTexto || (t.motivoPerda
        ? (D.MOTIVO_PERDA[t.motivoPerda] || null)
        : (D.MOTIVO_DESQUALIFICACAO[t.motivoDesqualificacao] || null)));
      // A tabela resultado→status vive em CRM_DATA.RESULTADO (é dado, não switch).
      applyStatus(p, r.status);
      /* Tag `Venda realizada`: venda declarada que o ERP ainda não confirmou.
         Some sozinha em Aquisição — lá o pedido chegou e não há mais furo a
         denunciar. Em CSC ela FICA. Mesma regra de `reconcileStatus`. */
      p.vendaDeclarada = p.status !== 'aquisicao' &&
        getTarefasByPin(p.id).some(function (x) {
          return x.status === 'realizada' && x.vendaDeclarada;
        });
      // Concluir é constatação de campo: sobe na escada de confiança.
      if (t.checkinEm) promoteToFieldValidated(p);
      p.checkins = getTarefasByPin(p.id)
        .filter(function (x) { return x.checkinEm; })
        .map(function (x) { return { in: x.checkinEm, out: x.checkoutEm }; })
        .reverse();
    }
    emit();
    return t;
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
  // Nasce SEMPRE "sem_plano" — fora do funil até ganhar uma visita planejada.
  // O status nunca é digitado nem entra no form.
  function createPin(data) {
    if (!data || !data.name || !data.name.trim()) return null;
    // `data.zone` vem do form, mas é o BAIRRO mais próximo do toque no mapa
    // (create.js/nearestZone) — a ZONA é derivada dele, nunca digitada.
    const bairro = data.bairro || data.zone || null;
    const meta = (D.BAIRRO_META && D.BAIRRO_META[bairro]) || { city: 'Recife', uf: 'PE' };
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
      address: (bairro ? bairro + ', ' : '') + meta.city + '/' + meta.uf + ' (criado em campo)',
      lat: lat, lng: lng,                           // geo_original
      geoVerificado: { lat: lat, lng: lng },        // marcado em campo = já verificado
      bairro: bairro,                               // geografia (do toque no mapa)
      zone: D.zonaDoBairro(bairro),                 // DERIVADA do bairro — nunca digitada
      origin: D.deriveOrigemConfianca({ fieldValidated: true }), // validado_campo
      status: 'sem_plano',                          // fora do funil até ganhar um plano
      statusAnterior: null,
      motivoStatus: null,
      qualidade: D.deriveQualidade(cnae),           // DERIVADA da tipologia (via CNAE default)
      porte: null,                                  // chega via CNPJá (Fase 3)
      vendedorId: D.VENDEDOR_SESSAO,
      vendedor: D.VENDEDORES[D.VENDEDOR_SESSAO].nome,
      lastVisit: null,
      dataCadastro: null,                           // vem do ERP
      dataPrimeiraCompra: null,                     // vem do ERP
      cadastrado: false,                            // DERIVADO
      statusCliente: 'lead',                        // DERIVADO — nasce lead, sem cadastro
      phone: phone,
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
    // Tarefas (a Tarefa dirige o funil — tarefa.md §5)
    getTarefas: getTarefas,
    getTarefa: getTarefa,
    getTarefasByPin: getTarefasByPin,
    planejadasDoPin: planejadasDoPin,
    tarefaAberta: tarefaAberta,
    agendarTarefa: agendarTarefa,
    cancelarTarefa: cancelarTarefa,
    // Rota (rascunho — docs/objetos/rota.md)
    getRotas: getRotas,
    getRota: getRota,
    paradasDaRota: paradasDaRota,
    paradasTodasDaRota: paradasTodasDaRota,
    criarRota: criarRota,
    cancelarRota: cancelarRota,
    checkInTarefa: checkInTarefa,
    checkInAgora: checkInAgora,        // check-in em pin sem plano (CAP-6 revisada)
    checkinAberto: checkinAberto,      // a visita em andamento — uma só no app
    setTipoTarefa: setTipoTarefa,
    concluirTarefa: concluirTarefa,
    resetDemo: resetDemo,
    useRealData: useRealData,
    isRealMode: isRealMode
  };
})();
