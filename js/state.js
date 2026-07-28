/* =====================================================================
   state.js — Store em memória + persistência (localStorage).
   Fonte única de verdade dos pins. Emite eventos de mudança.
   Constraint: NUNCA existe operação de excluir pin (o pin nunca some).
   ===================================================================== */
(function () {
  'use strict';

  const KEY = 'crm-externo-map:v6'; // v6: tarefa ganha hora + rotaId; entra a coleção `rotas`
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
     calendário nasceria sem uma única rota em quem já abriu a demo. */
  const STATE_V = 6;

  // Snapshot real e persistência antiga podem trazer o enum velho.
  const STATUS_LEGADO = {
    nao_visitado:  'sem_plano',
    em_negociacao: 'td_encontrado',
    convertido:    'csc'          // conservador: cadastrado, compra não comprovada
  };
  function migrateStatus(p) {
    if (p && STATUS_LEGADO[p.status]) p.status = STATUS_LEGADO[p.status];
    if (p && !D.STATUS[p.status]) p.status = 'sem_plano';
    if (p && p.checkins == null) p.checkins = [];
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
      pins = restored.pins.map(migrateStatus);
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
    pins = realPins.map(migrateStatus);

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
  function applyStatus(p, novo) {
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

    // Voltando de uma lateral: restaura a etapa de origem antes de aplicar.
    if (atualFam === 'lateral') {
      p.status = p.statusAnterior || 'sem_plano';
      p.statusAnterior = null;
      if (p.status === novo) return true;
    }

    // Cancelar o plano é a única reversão permitida na escada.
    const cancelandoPlano = (novo === 'sem_plano' && p.status === 'visita_planejada');
    if (!cancelandoPlano && !D.statusAvanca(p.status, novo)) return false;

    p.status = novo;
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

  // Agendar: o pin ENTRA no funil (sem_plano → visita_planejada).
  function agendarTarefa(data) {
    const p = data && getById(data.pinId);
    if (!p || !D.TAREFA_TIPO[data.tipo]) return null;
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
      resultado: null, motivoPerda: null, motivoDesqualificacao: null, motivoTexto: null,
      proximaAcao: null, proximaAcaoData: null,
      notas: (data.notas && data.notas.trim()) || null,
      criadoPor: D.VENDEDOR_SESSAO
    };
    tarefas.push(t);
    applyStatus(p, 'visita_planejada');
    emit();
    return t;
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
    const hoje = todayISO();
    if (t.data < hoje) t.data = hoje;
    t.checkinEm = nowISO();
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
    if (tarefaAberta(pinId)) return null;          // uma atividade aberta por pin
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

  // Concluir (check-out): é aqui que a atividade vira dado e o funil se move.
  // `resultado` é obrigatório; perdido/desqualificado exigem motivo.
  // Concluir SEM check-in é válido (atividade remota — tarefa.md §5).
  function concluirTarefa(id, out) {
    const t = getTarefa(id);
    out = out || {};
    if (!t || t.status !== 'planejada') return null;
    const r = D.RESULTADO[out.resultado];
    if (!r) return null;
    if (r.motivo === 'perda' && !out.motivo) return null;
    if (r.motivo === 'desqualificacao' && !out.motivo) return null;

    // O tipo confirmado no sheet de conclusão entra no mesmo ato — é a última
    // janela em que a tarefa é `planejada` e, portanto, editável (§8).
    if (out.tipo && D.TAREFA_TIPO[out.tipo]) t.tipo = out.tipo;
    t.status = 'realizada';
    t.checkoutEm = nowISO();
    t.resultado = r.key;
    t.motivoPerda = (r.motivo === 'perda') ? out.motivo : null;
    t.motivoDesqualificacao = (r.motivo === 'desqualificacao') ? out.motivo : null;
    t.motivoTexto = (out.motivo === 'outro' && out.motivoTexto) ? String(out.motivoTexto).trim() : null;
    t.proximaAcao = (out.proximaAcao && out.proximaAcao.trim()) || null;
    t.proximaAcaoData = out.proximaAcaoData || null;

    const p = getById(t.estabelecimentoId);
    if (p) {
      p.lastVisit = t.data;
      // Em `outro`, o pin mostra o TEXTO que o vendedor escreveu — "Outro" não
      // informa nada a quem abre o pin depois.
      p.motivoStatus = t.motivoTexto || (t.motivoPerda
        ? (D.MOTIVO_PERDA[t.motivoPerda] || null)
        : (t.motivoDesqualificacao ? (D.MOTIVO_DESQUALIFICACAO[t.motivoDesqualificacao] || null) : null));
      // A tabela resultado→status vive em CRM_DATA.RESULTADO (é dado, não switch).
      applyStatus(p, r.status);
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
    cancelarRota: cancelarRota,
    checkInTarefa: checkInTarefa,
    checkInAgora: checkInAgora,        // check-in em pin sem plano (CAP-6 revisada)
    setTipoTarefa: setTipoTarefa,
    concluirTarefa: concluirTarefa,
    resetDemo: resetDemo,
    useRealData: useRealData,
    isRealMode: isRealMode
  };
})();
