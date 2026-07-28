/* =====================================================================
   pin.js — Bottom sheet do pin (CAP-3 + CAP-6).
   - Info + NOTAS sempre visíveis ao abrir (nenhum estado esconde as notas).
   - Check-in / check-out simples, sem GPS nem foto.
   - Sem qualquer affordance de excluir pin (constraint).
   ===================================================================== */
(function () {
  'use strict';

  const D = window.CRM_DATA;
  const S = window.CRM_STATE;
  let currentId = null;
  let view = 'pin';          // pin | lista | detalhe — sub-telas do mesmo sheet
  let tarefaAberta = null;
  // Tipo escolhido nos chips ANTES de existir tarefa (pin sem plano). Morre ao
  // trocar de pin: é escolha daquela visita, não preferência do vendedor.
  let tipoEscolhido = null;
  let sheetEl, backdropEl;

  // Ícone de pin padrão (sem emoji de tipologia) para o avatar do sheet.
  const PIN_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" fill="#fff" aria-hidden="true">' +
    '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function relative(iso) {
    const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
    const diff = (new Date() - d) / 1000;
    if (diff < 60) return 'agora';
    if (diff < 3600) return 'há ' + Math.floor(diff / 60) + ' min';
    if (diff < 86400) return 'há ' + Math.floor(diff / 3600) + ' h';
    const days = Math.floor(diff / 86400);
    if (days < 30) return 'há ' + days + (days === 1 ? ' dia' : ' dias');
    return fmtDate(iso);
  }
  function durationMin(a, b) {
    return Math.max(1, Math.round((new Date(b) - new Date(a)) / 60000));
  }

  function infoRow(label, value, cls) {
    return '<div class="info__row"><span class="info__k">' + label + '</span>' +
      '<span class="info__v ' + (cls || '') + '">' + value + '</span></div>';
  }

  /* O sheet tem TRÊS telas, e não três lugares: pin → lista de atividades →
     detalhe de uma atividade. Tudo dentro do mesmo bottom sheet, com voltar —
     abrir uma tela nova por atividade tiraria o vendedor do contexto do ponto. */
  function render() {
    if (!currentId) return;
    if (view === 'lista')   return renderLista();
    if (view === 'detalhe') return renderDetalhe();
    renderPin();
  }

  function irPara(v, tarefaId) {
    view = v;
    tarefaAberta = tarefaId || null;
    render();
    const sc = sheetEl.querySelector('.sheet__scroll');
    if (sc) sc.scrollTop = 0;      // tela nova começa do topo, não onde a outra parou
  }

  // Cabeçalho das sub-telas: volta, título do recorte e o nome do ponto embaixo,
  // para o vendedor nunca perder de vista de quem é a atividade.
  function subHead(titulo, sub, voltarPara) {
    return '<div class="sheet__handle" aria-hidden="true"></div>' +
      '<header class="sheet__head sheet__head--sub">' +
        '<button type="button" class="sheet__back" data-voltar="' + voltarPara + '" aria-label="Voltar">‹</button>' +
        '<div class="sheet__titles">' +
          '<h2 class="sheet__name">' + esc(titulo) + '</h2>' +
          '<div class="sheet__sub">' + esc(sub) + '</div>' +
        '</div>' +
        '<button type="button" class="sheet__close" id="btn-close-sheet" aria-label="Fechar">✕</button>' +
      '</header>';
  }

  function tipoDe(t) { return D.TAREFA_TIPO[t.tipo] || { emoji: '📌', label: t.tipo }; }

  // Linha de atividade, clicável — vale no bloco do pin e na lista completa.
  function linhaAtividade(t) {
    const tp = tipoDe(t);
    const r = t.resultado ? D.RESULTADO[t.resultado] : null;
    const late = t.status === 'planejada' && t.data < new Date().toISOString().slice(0, 10);
    return '<button type="button" class="ativ-item" data-tarefa="' + esc(t.id) + '">' +
      '<span class="ativ-item__ico" aria-hidden="true">' + tp.emoji + '</span>' +
      '<span class="ativ-item__txt">' +
        '<span class="ativ-item__l1">' + fmtDate(t.data) + ' · ' + esc(tp.label) + '</span>' +
        '<span class="ativ-item__l2">' +
          (r ? '<span class="ativ-res" style="--c:' + r.color + '">' + esc(r.label) + '</span>'
             : (late ? '<span class="ativ-badge ativ-badge--late">Atrasada</span>' : 'Planejada')) +
          (t.checkinEm && t.checkoutEm ? ' · ' + durationMin(t.checkinEm, t.checkoutEm) + ' min' : '') +
        '</span>' +
      '</span>' +
      '<span class="ativ-item__seta" aria-hidden="true">›</span>' +
    '</button>';
  }

  /* ---- Tela 2: todas as atividades do ponto ---- */
  function renderLista() {
    const p = S.getById(currentId);
    if (!p) return closeSheet();
    const doPin = S.getTarefasByPin(p.id);
    const plan = doPin.filter(function (t) { return t.status === 'planejada'; })
                      .sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    const feitas = doPin.filter(function (t) { return t.status === 'realizada'; })
                        .sort(function (a, b) { return a.data > b.data ? -1 : 1; });

    sheetEl.querySelector('.sheet__scroll').innerHTML =
      subHead('Atividades', p.name, 'pin') +
      '<p class="ger-nota">' + doPin.length + (doPin.length === 1 ? ' atividade' : ' atividades') +
        ' neste ponto · toque para ver o detalhe</p>' +
      (plan.length ? '<div class="block__title">Planejadas</div>' +
        '<div class="ativ-lista">' + plan.map(linhaAtividade).join('') + '</div>' : '') +
      (feitas.length ? '<div class="block__title">Realizadas</div>' +
        '<div class="ativ-lista">' + feitas.map(linhaAtividade).join('') + '</div>' : '') +
      (doPin.length ? '' : '<p class="ativ-vazio">Nenhuma atividade neste ponto.</p>');
    wireSheet();
  }

  /* ---- Tela 3: detalhe de uma atividade ---- */
  function renderDetalhe() {
    const p = S.getById(currentId);
    const t = S.getTarefa(tarefaAberta);
    if (!p) return closeSheet();
    if (!t) return irPara('lista');

    const tp = tipoDe(t);
    const r = t.resultado ? D.RESULTADO[t.resultado] : null;
    const mot = t.motivoPerda ? D.MOTIVO_PERDA[t.motivoPerda]
              : (t.motivoDesqualificacao ? D.MOTIVO_DESQUALIFICACAO[t.motivoDesqualificacao] : null);
    const vend = (D.VENDEDORES[t.responsavelId] || {}).nome || '—';
    const feita = t.status === 'realizada';
    // Rota vem do rascunho do objeto Rota (docs/objetos/rota.md) — quem não
    // tem `rotaId` foi agendada solta pelo vendedor.
    const r0 = t.rotaId && S.getRota ? S.getRota(t.rotaId) : null;
    // Sob o rótulo "Rota", o nome canônico ("Rota Boa Vista") repetiria a
    // palavra — aqui vai só o bairro; o nome cheio fica na Agenda e na tabela.
    const rota = r0 ? r0.nome.replace(/^Rota\s+/, '') : 'Avulsa (fora de rota)';

    sheetEl.querySelector('.sheet__scroll').innerHTML =
      subHead(tp.emoji + ' ' + tp.label, p.name, 'lista') +
      '<section class="info">' +
        infoRow('Data', fmtDate(t.data) + (t.hora ? ' às ' + esc(t.hora) : '')) +
        infoRow('Situação', feita
          ? '<span class="pill" style="--c:#10b981">Realizada</span>'
          : '<span class="pill" style="--c:' + (t.data < new Date().toISOString().slice(0, 10) ? '#9f1239' : '#94a3b8') + '">' +
            (t.data < new Date().toISOString().slice(0, 10) ? 'Atrasada' : 'Planejada') + '</span>') +
        infoRow('Responsável', esc(vend)) +
        infoRow('Rota', esc(rota)) +
        (feita ? infoRow('Tipo de check-in', t.checkinEm
          ? '<span class="pill" style="--c:#0ea5e9">Presencial</span>'
          : '<span class="pill" style="--c:#64748b">Remoto</span>') : '') +
        (t.checkinEm ? infoRow('Check-in', fmtDate(t.data) + ' às ' + fmtTime(t.checkinEm)) : '') +
        (t.checkoutEm ? infoRow('Check-out', fmtTime(t.checkoutEm) +
          ' <small class="info__desc">' + durationMin(t.checkinEm, t.checkoutEm) + ' min em campo</small>') : '') +
        (t.distanciaKm != null ? infoRow('Distância no check-in',
          String(t.distanciaKm.toFixed(2)).replace('.', ',') + ' km' +
          '<small class="info__desc">entre o vendedor e o pin</small>') : '') +
        (r ? infoRow('Resultado', '<span class="pill" style="--c:' + r.color + '">' + esc(r.label) + '</span>') : '') +
        (mot ? infoRow('Motivo', esc(mot)) : '') +
        (t.proximaAcao ? infoRow('Próxima ação', esc(t.proximaAcao) +
          (t.proximaAcaoData ? '<small class="info__desc">' + fmtDate(t.proximaAcaoData) + '</small>' : '')) : '') +
      '</section>' +
      (t.notas
        ? '<section class="block"><div class="block__title">Comentário</div>' +
          '<p class="note-card">' + esc(t.notas) + '</p></section>'
        : '') +
      // Ações só existem em atividade aberta; realizada é registro, não formulário.
      (!feita
        ? '<div class="check-actions">' +
            (t.checkinEm
              ? '<button type="button" id="btn-det-checkout" class="btn btn--checkout">⏱️ Check-out</button>'
              : '<button type="button" id="btn-det-checkin" class="btn btn--checkin">📍 Check-in</button>') +
            '<button type="button" id="btn-det-cancelar" class="btn btn--ghost">Cancelar atividade</button>' +
          '</div>'
        : '');
    wireSheet();
  }

  function renderPin() {
    const p = S.getById(currentId);
    if (!p) { close(); return; }
    const origin = D.ORIGINS[p.origin];
    const typ = D.TYPOLOGIES[p.typology] || { emoji: '📍', label: p.typology };
    const qual = D.QUALIDADE[p.qualidade] || { label: p.qualidade, emoji: '', color: '#64748b', ink: '#334155' };
    const stat = D.STATUS[p.status] || { label: p.status, color: '#64748b' };
    const porte = p.porte ? (D.PORTE[p.porte] || { label: p.porte }) : null;

    // Escala de confiança (dots)
    let dots = '';
    for (let i = 1; i <= 4; i++) dots += '<span class="conf__dot' + (i <= origin.level ? ' is-on' : '') + '"></span>';

    // Notas — SEMPRE visíveis
    let notesHtml;
    if (p.notes.length === 0) {
      notesHtml = '<p class="notes__empty">Sem notas ainda. Registre o que descobriu na visita.</p>';
    } else {
      notesHtml = p.notes.map(function (n) {
        return '<div class="note"><p class="note__text">' + esc(n.text) + '</p>' +
          '<time class="note__time">' + relative(n.ts) + '</time></div>';
      }).join('');
    }

    /* ---- Bloco de ATIVIDADES (SPEC 07 §2): próxima atividade → botão
           contextual → histórico. Check-in/out É a tarefa: o botão opera
           sobre uma atividade, não sobre um par solto no pin. ---- */
    const doPin = S.getTarefasByPin(p.id);
    const planejadas = doPin.filter(function (t) { return t.status === 'planejada'; })
                            .sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    const feitas = doPin.filter(function (t) { return t.status === 'realizada'; })
                        .sort(function (a, b) { return a.data > b.data ? -1 : 1; });

    /* A atividade planejada NÃO aparece aqui (28/07): o botão de check-in já é
       ela — é a mesma tarefa, e mostrar as duas coisas dizia o mesmo duas vezes.
       O bloco ficou "o que fazer agora" (botão) + "o que já foi feito" (lista).
       A planejada segue acessível pela tela de todas as atividades (§2.2). */

    /* ---- Check-in em TODO pin (CAP-6 revisada) -------------------------
       Não é preciso plano para visitar: o vendedor passou na porta, entrou.
       `📍 Check-in` é sempre o primário; `＋ Agendar` é o secundário (planejar
       para depois é outra intenção). Com visita em andamento, o primário vira
       `⏱️ Check-out` — é assim que o sheet mostra que há check-in aberto.

       Acima do botão, os TRÊS chips de tipo: o vendedor só **confere** se o
       tipo está certo, porque o histórico já sabe qual visita é aquela
       (D.sugereTipoVisita). Quando existe planejada para hoje ou atrasada, o
       chip mostra o tipo DELA e trocar corrige a própria tarefa — conferir
       não cria atividade nova. ---- */
    const aberta = S.tarefaAberta(p.id);
    const hojeISO = new Date().toISOString().slice(0, 10);
    // A planejada sobre a qual o check-in vai agir (hoje ou atrasada).
    const alvo = planejadas.filter(function (t) {
      return t.data <= hojeISO && !t.checkinEm;
    })[0] || null;

    let checkBtn, tipoHtml = '';
    if (aberta) {
      const tpA = tipoDe(aberta);
      checkBtn = '<button type="button" id="btn-checkout" class="btn btn--checkout">⏱️ Check-out</button>';
      tipoHtml = '<p class="ativ-tipo-atual">' + tpA.emoji + ' <strong>' + esc(tpA.label) +
        '</strong> em andamento · check-in às ' + fmtTime(aberta.checkinEm) + '</p>';
    } else {
      const sel = alvo ? alvo.tipo : D.sugereTipoVisita(p, doPin);
      checkBtn = '<button type="button" id="btn-checkin" class="btn btn--checkin">📍 Check-in</button>' +
        '<button type="button" id="btn-agendar" class="btn btn--ghost">＋ Agendar</button>';
      tipoHtml = '<div class="ativ-tipo">' +
        '<span class="ativ-tipo__lbl">Tipo da visita</span>' +
        '<div class="ativ-tipo__chips" role="group" aria-label="Tipo da visita">' +
          D.TAREFA_TIPO_ORDER.map(function (k) {
            const tp = D.TAREFA_TIPO[k];
            return '<button type="button" class="chip' + (k === sel ? ' is-on' : '') +
              '" data-tipo="' + k + '" aria-pressed="' + (k === sel) + '">' +
              tp.emoji + ' ' + esc(tp.label) + '</button>';
          }).join('') +
        '</div>' +
        (alvo ? '<span class="ativ-tipo__hint">confere o plano de ' +
            alvo.data.slice(8) + '/' + alvo.data.slice(5, 7) + '</span>' : '') +
      '</div>';
    }

    /* Histórico: só as 3 últimas. Um ponto de recorrência acumula dezenas de
       atividades, e a lista empurrava as NOTAS (invariante CAP-3) para fora da
       tela. O resto mora na tela cheia. */
    const MOSTRA = 3;
    let historyHtml = '';
    if (feitas.length) {
      historyHtml = '<div class="ativ-lista">' +
        feitas.slice(0, MOSTRA).map(linhaAtividade).join('') + '</div>';
    }
    /* O botão aparece quando existe alguma atividade que esta tela NÃO mostra.
       Sem o banner da próxima, toda planejada conta como escondida — é o que
       mantém o detalhe dela alcançável. */
    const escondidas = doPin.length - Math.min(feitas.length, MOSTRA);
    const verTodas = escondidas > 0
      ? '<button type="button" class="btn btn--ghost btn--block ativ-vertodas" data-ir="lista">' +
        'Ver todas as atividades (' + doPin.length + ') ›</button>'
      : '';

    // Aviso das saídas laterais: diz para onde o pin volta ao concluir (§3.1).
    let lateralHtml = '';
    if (p.status === 'perdido' || p.status === 'desqualificado') {
      const volta = (D.STATUS[p.statusAnterior] || {}).label || 'Sem plano';
      lateralHtml = '<p class="ativ-lateral">Este ponto está <strong>' +
        esc((D.STATUS[p.status] || {}).label) + '</strong>' +
        (p.motivoStatus ? ' (' + esc(p.motivoStatus) + ')' : '') +
        '. Concluir uma atividade o devolve a <strong>' + esc(volta) + '</strong>.</p>';
    }

    sheetEl.querySelector('.sheet__scroll').innerHTML =
      '<div class="sheet__handle" aria-hidden="true"></div>' +
      '<header class="sheet__head">' +
        '<div class="sheet__avatar" style="--pin:' + origin.color + '">' + PIN_SVG + '</div>' +
        '<div class="sheet__titles">' +
          '<h2 class="sheet__name">' + esc(p.name) + '</h2>' +
          '<div class="sheet__sub">' + esc(typ.label) + ' · ' + esc(p.zone) +
            (p.createdByUser ? ' · <span class="tag-new">novo</span>' : '') + '</div>' +
        '</div>' +
        '<button type="button" class="sheet__close" id="btn-close-sheet" aria-label="Fechar">✕</button>' +
      '</header>' +

      '<div class="origin-card" style="--pin:' + origin.color + ';--pin-ink:' + origin.ink + '">' +
        '<div class="origin-card__top">' +
          '<span class="origin-card__badge">' + esc(origin.label) + '</span>' +
          '<span class="conf">' + dots + '</span>' +
        '</div>' +
        '<div class="origin-card__conf">Confiabilidade: <strong>' + origin.confidence + '</strong></div>' +
        '<p class="origin-card__desc">' + esc(origin.desc) + '</p>' +
      '</div>' +

      '<section class="info">' +
        infoRow('Qualidade', '<span class="pill pill--qual" style="--c:' + qual.color + ';--ci:' + qual.ink + '">' + qual.emoji + ' ' + esc(qual.label) + '</span>') +
        infoRow('Porte', porte ? esc(porte.label) : '<em class="muted">—</em>') +
        infoRow('Status', '<span class="pill" style="--c:' + stat.color + '">' + esc(stat.label) + '</span>') +
        infoRow('Última visita', fmtDate(p.lastVisit)) +
        (p.cadastrado ? infoRow('Cadastrado em', fmtDate(p.dataCadastro)) : '') +
        (p.dataPrimeiraCompra ? infoRow('1ª compra', fmtDate(p.dataPrimeiraCompra)) : '') +
        (p.statusAnterior ? infoRow('Etapa de origem', '<em class="muted">' + esc((CRM_DATA.STATUS[p.statusAnterior] || {}).label || p.statusAnterior) + '</em>') : '') +
        infoRow('Razão social', p.razaoSocial ? esc(p.razaoSocial) : '<em class="muted">—</em>') +
        infoRow('CNPJ', p.cnpj ? esc(p.cnpj) : '<em class="muted">sem CNPJ associado</em>') +
        infoRow('CNAE', p.cnaeCodigo
          ? '<span>' + esc(p.cnaeCodigo) + '</span><small class="info__desc">' + esc(p.cnaeDescricao) + '</small>'
          : '<em class="muted">—</em>') +
        infoRow('Telefone', p.phone ? esc(p.phone) : '<em class="muted">—</em>') +
        infoRow('Endereço', esc(p.address)) +
        infoRow('Coordenada', p.lat.toFixed(5) + ', ' + p.lng.toFixed(5) +
          (p.geoVerificado ? ' <span class="geo-ok" title="Coordenada verificada em campo">✓</span>' : ''), 'mono') +
      '</section>' +

      '<button type="button" id="btn-move-pin" class="btn btn--ghost btn--block">✥ Corrigir localização</button>' +

      '<section class="block">' +
        '<div class="block__title">Atividades</div>' +
        lateralHtml +
        tipoHtml +
        '<div class="check-actions">' + checkBtn + '</div>' +
        historyHtml +
        verTodas +
      '</section>' +

      '<section class="block block--notes">' +
        '<div class="block__title">Notas <span class="block__hint">sempre visíveis</span></div>' +
        '<div class="notes">' + notesHtml + '</div>' +
        '<form class="note-form" id="note-form">' +
          '<input type="text" id="note-input" class="note-input" placeholder="Adicionar nota…" autocomplete="off" maxlength="240" />' +
          '<button type="submit" class="btn btn--note">Salvar</button>' +
        '</form>' +
      '</section>';

    wireSheet();
  }

  function wireSheet() {
    const close = sheetEl.querySelector('#btn-close-sheet');
    if (close) close.addEventListener('click', closeSheet);

    // Atividades: o botão opera sobre a TAREFA (check-in é a tarefa).
    const ag = sheetEl.querySelector('#btn-agendar');
    if (ag) ag.addEventListener('click', function () { window.CRM_ATIV.agendar(currentId); });

    /* Chips de tipo: só CONFEREM o tipo antes do check-in. Com planejada de
       hoje/atrasada, corrigem a própria tarefa (nada de criar outra); sem
       planejada, guardam a escolha até o check-in criar a atividade. */
    Array.prototype.forEach.call(sheetEl.querySelectorAll('[data-tipo]'), function (el) {
      el.addEventListener('click', function () {
        tipoEscolhido = el.dataset.tipo;
        const alvo = alvoDoCheckin();
        if (alvo) return S.setTipoTarefa(alvo.id, tipoEscolhido);   // re-renderiza pelo emit
        // Sem tarefa ainda: só pinta a escolha, sem re-render (nada mudou no estado).
        Array.prototype.forEach.call(sheetEl.querySelectorAll('[data-tipo]'), function (c) {
          const on = c === el;
          c.classList.toggle('is-on', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
    });

    // A planejada sobre a qual o check-in age: hoje ou atrasada, sem check-in.
    function alvoDoCheckin() {
      const hoje = new Date().toISOString().slice(0, 10);
      return S.planejadasDoPin(currentId)
        .filter(function (t) { return t.data <= hoje && !t.checkinEm; })
        .sort(function (a, b) { return a.data < b.data ? -1 : 1; })[0] || null;
    }
    const ci = sheetEl.querySelector('#btn-checkin');
    if (ci) ci.addEventListener('click', function () {
      // Check-in em QUALQUER pin: sem plano, o state cria a tarefa de hoje.
      const t = S.checkInAgora(currentId, tipoEscolhido);
      if (!t) return window.CRM_TOAST && window.CRM_TOAST('Não foi possível fazer check-in.');
      tipoEscolhido = null;
      if (window.CRM_TOAST) {
        window.CRM_TOAST('Check-in em ' + tipoDe(t).label.toLowerCase() + ' — feche com o check-out.');
      }
    });
    const co = sheetEl.querySelector('#btn-checkout');
    if (co) co.addEventListener('click', function () {
      const t = S.tarefaAberta(currentId);
      if (t) window.CRM_ATIV.concluir(t);
    });
    // Navegação entre as três telas do sheet.
    const vt = sheetEl.querySelector('[data-ir]');
    if (vt) vt.addEventListener('click', function () { irPara(vt.dataset.ir); });
    const bk = sheetEl.querySelector('.sheet__back');
    if (bk) bk.addEventListener('click', function () { irPara(bk.dataset.voltar); });
    Array.prototype.forEach.call(sheetEl.querySelectorAll('[data-tarefa]'), function (el) {
      el.addEventListener('click', function () { irPara('detalhe', el.dataset.tarefa); });
    });

    // Ações da tela de detalhe: operam sobre AQUELA tarefa, não sobre "a próxima".
    const dci = sheetEl.querySelector('#btn-det-checkin');
    if (dci) dci.addEventListener('click', function () { S.checkInTarefa(tarefaAberta); });
    const dco = sheetEl.querySelector('#btn-det-checkout');
    if (dco) dco.addEventListener('click', function () {
      const t = S.getTarefa(tarefaAberta);
      if (t) window.CRM_ATIV.concluir(t);
    });
    const dcc = sheetEl.querySelector('#btn-det-cancelar');
    if (dcc) dcc.addEventListener('click', function () {
      const t = S.getTarefa(tarefaAberta);
      if (!t) return;
      const unico = S.planejadasDoPin(currentId).length === 1;
      const msg = unico
        ? 'Cancelar a última atividade planejada deste ponto?\nO pin sai do funil (volta a Sem plano).'
        : 'Cancelar esta atividade?';
      if (!window.confirm(msg)) return;
      S.cancelarTarefa(t.id);
      irPara('lista');
    });

    const mv = sheetEl.querySelector('#btn-move-pin');
    if (mv) mv.addEventListener('click', function () { window.CRM_MAP.startMove(currentId); });

    const form = sheetEl.querySelector('#note-form');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      const input = sheetEl.querySelector('#note-input');
      if (input && input.value.trim()) { S.addNote(currentId, input.value); input.value = ''; }
    });
  }

  function open(id) {
    currentId = id;
    view = 'pin';               // abrir um pin sempre começa no pin
    tarefaAberta = null;
    tipoEscolhido = null;       // a escolha de tipo é daquela visita, não do vendedor
    render();
    sheetEl.classList.add('is-open');
    backdropEl.classList.add('is-open');
    document.body.classList.add('sheet-open');
    window.CRM_MAP.setSelected(id);
    window.CRM_MAP.panToShow(id);
  }

  function closeSheet() {
    currentId = null;
    sheetEl.classList.remove('is-open');
    backdropEl.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    window.CRM_MAP.setSelected(null);
  }
  const close = closeSheet;

  // Re-render em mudanças de estado (nota/check-in/mover) sem fechar o sheet.
  function refresh() {
    if (currentId && sheetEl.classList.contains('is-open')) render();
  }

  function init() {
    sheetEl = document.getElementById('pin-sheet');
    backdropEl = document.getElementById('sheet-backdrop');
    if (backdropEl) backdropEl.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && currentId) closeSheet();
    });
  }

  window.CRM_PIN = {
    init: init,
    open: open,
    close: closeSheet,
    refresh: refresh,
    currentId: function () { return currentId; }
  };
})();
