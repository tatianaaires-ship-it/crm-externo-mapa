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
  /* Rascunho do sheet de conclusão (§3). Vive fora do render porque o form tem
     campo condicional (o motivo só aparece depois do resultado) e cada toque
     re-renderiza a tela. `tarefaId` amarra o rascunho à tarefa: trocar de
     atividade zera o formulário em vez de herdar escolha da anterior. */
  let form = { tarefaId: null, tipo: null, resultado: null, motivo: null,
               motivoTexto: '', prox: '', proxData: '' };
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

  /* O sheet tem QUATRO telas, e não quatro lugares: pin → lista de atividades
     → detalhe de uma atividade → conclusão (check-out). Tudo dentro do mesmo
     bottom sheet, com voltar — abrir uma tela nova por atividade tiraria o
     vendedor do contexto do ponto. */
  function render() {
    if (!currentId) return;
    if (view === 'lista')     return renderLista();
    if (view === 'detalhe')   return renderDetalhe();
    if (view === 'conclusao') return renderConclusao();
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
    const ciTipo = D.deriveTipoCheckin(t);   // presencial | remoto | null

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
        // Presencial × remoto vem da DISTÂNCIA no check-in; sem check-in, nem
        // uma nem outra — a linha simplesmente não existe.
        (ciTipo ? infoRow('Tipo de check-in', ciTipo === 'presencial'
          ? '<span class="pill" style="--c:#0ea5e9">Presencial</span>'
          : '<span class="pill" style="--c:#64748b">Remoto</span>') : '') +
        (t.checkinEm ? infoRow('Check-in', fmtDate(t.data) + ' às ' + fmtTime(t.checkinEm)) : '') +
        (t.checkoutEm ? infoRow('Check-out', fmtTime(t.checkoutEm) +
          ' <small class="info__desc">' + durationMin(t.checkinEm, t.checkoutEm) + ' min em campo</small>') : '') +
        (t.distanciaKm != null ? infoRow('Distância no check-in',
          String(t.distanciaKm.toFixed(2)).replace('.', ',') + ' km' +
          '<small class="info__desc">' + (ciTipo === 'remoto'
            ? 'acima de ' + String(D.RAIO_PRESENCIAL_KM).replace('.', ',') + ' km — registrada como remota'
            : 'entre o vendedor e o pin') + '</small>') : '') +
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

  /* ---- Tela 4: CONCLUSÃO (check-out) — SPEC 07 §3 -----------------------
     O momento em que a atividade vira dado e o funil se move. Era três
     `window.prompt` em sequência (a parte mais feia do protótipo); virou sheet
     em 28/07. Quatro campos, nesta ordem:
       1. TIPO da visita — pré-marcado; é aqui que o vendedor confirma o que a
          visita foi, porque agora ele sabe. No check-in ele não sabia (e nem
          devia parar para classificar na porta do cliente).
       2. RESULTADO — obrigatório, 4 chips na ordem fixa do enum.
       3. MOTIVO — aparece só em Perdido/Desqualificar, vocabulário fechado;
          `outro` revela o campo de texto. Não dá pra concluir sem ele.
       4. PRÓXIMA AÇÃO — opcional, texto + data. Não cria tarefa.
     O botão fica desabilitado enquanto falta algo, e diz o que falta: botão
     que recusa em silêncio faz o usuário achar que a tela travou. ---- */
  function renderConclusao() {
    const p = S.getById(currentId);
    const t = S.getTarefa(tarefaAberta);
    if (!p) return closeSheet();
    // Sem check-in não há o que concluir: a atividade fica NÃO REALIZADA.
    if (!t || t.status !== 'planejada' || !t.checkinEm) return irPara('pin');

    // O rascunho começa no tipo que a tarefa já tem (do plano ou da sugestão).
    if (form.tarefaId !== t.id) form = { tarefaId: t.id, tipo: t.tipo, resultado: null,
                                         motivo: null, motivoTexto: '', prox: '', proxData: '' };

    const r = form.resultado ? D.RESULTADO[form.resultado] : null;
    const tabelaMotivo = r && r.motivo
      ? (r.motivo === 'perda' ? D.MOTIVO_PERDA : D.MOTIVO_DESQUALIFICACAO) : null;

    // O que ainda falta — vira o rótulo do botão, não um erro depois do toque.
    let falta = null;
    if (!form.resultado) falta = 'Escolha o resultado';
    else if (tabelaMotivo && !form.motivo) falta = 'Escolha o motivo';
    else if (form.motivo === 'outro' && !form.motivoTexto.trim()) falta = 'Descreva o motivo';

    const chip = function (attr, val, sel, label, cor) {
      return '<button type="button" class="chip' + (cor ? ' chip--res' : '') +
        (sel ? ' is-on' : '') + '" ' + attr + '="' + val + '"' +
        (cor ? ' style="--c:' + cor + '"' : '') +
        ' aria-pressed="' + (sel ? 'true' : 'false') + '">' + label + '</button>';
    };

    // Aviso da saída lateral: é AQUI que ele decide, então é aqui que precisa
    // saber para onde o pin volta (§3.1).
    const volta = (D.STATUS[p.statusAnterior] || {}).label || 'Sem plano';
    const lateral = (p.status === 'perdido' || p.status === 'desqualificado')
      ? '<p class="ativ-lateral">Este ponto está <strong>' +
        esc((D.STATUS[p.status] || {}).label) + '</strong>' +
        (p.motivoStatus ? ' (' + esc(p.motivoStatus) + ')' : '') +
        '. Concluir devolve o pin a <strong>' + esc(volta) + '</strong>, e só então o novo resultado se aplica.</p>'
      : '';

    sheetEl.querySelector('.sheet__scroll').innerHTML =
      subHead('Concluir atividade', p.name, 'pin') +
      lateral +
      // Só se chega aqui com check-in aberto (sem presença não há conclusão —
      // tarefa.md §5), então a faixa é sempre a do check-in em curso.
      '<p class="ativ-tipo-atual">📍 Check-in às ' + fmtTime(t.checkinEm) +
        ' · ' + durationMin(t.checkinEm, new Date().toISOString()) + ' min em campo' +
        (D.deriveTipoCheckin(t) === 'remoto'
          ? ' · <strong>remoto</strong> (' + String(t.distanciaKm).replace('.', ',') + ' km do pin)'
          : '') + '</p>' +

      '<div class="conc-campo">' +
        '<span class="conc-lbl">Tipo da visita</span>' +
        '<div class="conc-chips">' + D.TAREFA_TIPO_ORDER.map(function (k) {
          const tp = D.TAREFA_TIPO[k];
          return chip('data-ctipo', k, k === form.tipo, tp.emoji + ' ' + esc(tp.label));
        }).join('') + '</div>' +
      '</div>' +

      '<div class="conc-campo">' +
        '<span class="conc-lbl">Resultado <em>obrigatório</em></span>' +
        '<div class="conc-chips">' + D.RESULTADO_ORDER.map(function (k) {
          const res = D.RESULTADO[k];
          return chip('data-cres', k, k === form.resultado, esc(res.acao || res.label), res.color);
        }).join('') + '</div>' +
        '<span class="conc-hint">CSC e Aquisição não entram aqui — conversão vem do cadastro/pedido, não do campo.</span>' +
      '</div>' +

      (tabelaMotivo
        ? '<div class="conc-campo">' +
            '<span class="conc-lbl">' + (r.motivo === 'perda' ? 'Motivo da perda' : 'Motivo da desqualificação') +
              ' <em>obrigatório</em></span>' +
            '<div class="conc-chips">' + Object.keys(tabelaMotivo).map(function (k) {
              return chip('data-cmot', k, k === form.motivo, esc(tabelaMotivo[k]));
            }).join('') + '</div>' +
            (form.motivo === 'outro'
              ? '<input type="text" id="conc-mot-txt" class="conc-inp" maxlength="120" ' +
                'placeholder="Qual motivo?" value="' + esc(form.motivoTexto) + '" />'
              : '') +
          '</div>'
        : '') +

      '<div class="conc-campo">' +
        '<span class="conc-lbl">Próxima ação <em>opcional</em></span>' +
        '<input type="text" id="conc-prox" class="conc-inp" maxlength="120" ' +
          'placeholder="Ex.: voltar com a tabela nova" value="' + esc(form.prox) + '" />' +
        '<input type="date" id="conc-prox-data" class="conc-inp conc-inp--data" value="' + esc(form.proxData) + '" />' +
        '<span class="conc-hint">Aparece na gerencial como sugestão — <strong>não cria tarefa</strong>.</span>' +
      '</div>' +

      '<button type="button" id="btn-conc-ok" class="btn btn--checkin btn--block"' +
        (falta ? ' disabled' : '') + '>' +
        (falta ? esc(falta) : '✓ Concluir atividade') + '</button>' +
      '<button type="button" class="btn btn--ghost btn--block ativ-vertodas" data-voltar="pin">Cancelar</button>';
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
       `📍 Check-in` é sempre o primário e é **um toque só**; `＋ Agendar` é o
       secundário (planejar para depois é outra intenção). Com visita em
       andamento, o primário vira `⏱️ Check-out`.

       ⚖️ O TIPO da visita não é escolhido aqui (28/07). Quem está entrando na
       porta não classifica nada: a tarefa nasce com o tipo sugerido pelo
       histórico e o vendedor confirma/corrige **no sheet de conclusão** (§3),
       quando já sabe o que a visita foi. Se ele agenda, o tipo vem do
       mini-form de agendar. ---- */
    const aberta = S.tarefaAberta(p.id);
    let checkBtn, tipoHtml = '';
    if (aberta) {
      const tpA = tipoDe(aberta);
      checkBtn = '<button type="button" id="btn-checkout" class="btn btn--checkout">⏱️ Check-out</button>';
      tipoHtml = '<p class="ativ-tipo-atual">' + tpA.emoji + ' <strong>' + esc(tpA.label) +
        '</strong> em andamento · check-in às ' + fmtTime(aberta.checkinEm) + '</p>';
    } else {
      checkBtn = '<button type="button" id="btn-checkin" class="btn btn--checkin">📍 Check-in</button>' +
        '<button type="button" id="btn-agendar" class="btn btn--ghost">＋ Agendar</button>';
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

    const ci = sheetEl.querySelector('#btn-checkin');
    if (ci) ci.addEventListener('click', function () {
      // Um toque só: sem plano, o state cria a tarefa de hoje com o tipo
      // sugerido — que o vendedor confirma no sheet de conclusão.
      const t = S.checkInAgora(currentId);
      if (!t) return window.CRM_TOAST && window.CRM_TOAST('Não foi possível fazer check-in.');
      if (window.CRM_TOAST) window.CRM_TOAST('Check-in registrado — feche com o check-out.');
    });
    const co = sheetEl.querySelector('#btn-checkout');
    if (co) co.addEventListener('click', function () {
      const t = S.tarefaAberta(currentId);
      if (t) irPara('conclusao', t.id);
    });
    // Navegação entre as três telas do sheet.
    const vt = sheetEl.querySelector('[data-ir]');
    if (vt) vt.addEventListener('click', function () { irPara(vt.dataset.ir); });
    const bk = sheetEl.querySelector('.sheet__back');
    if (bk) bk.addEventListener('click', function () { irPara(bk.dataset.voltar); });
    Array.prototype.forEach.call(sheetEl.querySelectorAll('[data-tarefa]'), function (el) {
      el.addEventListener('click', function () { irPara('detalhe', el.dataset.tarefa); });
    });

    // (A tela de conclusão é toda delegada — ver onSheetClick/onSheetInput.)

    // Ações da tela de detalhe: operam sobre AQUELA tarefa, não sobre "a próxima".
    const dci = sheetEl.querySelector('#btn-det-checkin');
    if (dci) dci.addEventListener('click', function () { S.checkInTarefa(tarefaAberta); });
    const dco = sheetEl.querySelector('#btn-det-checkout');
    if (dco) dco.addEventListener('click', function () { irPara('conclusao', tarefaAberta); });
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
    form.tarefaId = null;       // o rascunho de conclusão é daquela atividade
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

  /* ---- Chips do sheet de conclusão: DELEGAÇÃO, não listener por elemento.
          A tela se re-renderiza a cada toque (o campo de motivo depende do
          resultado), então anexar por elemento é anexar em nó que vai morrer no
          próximo render. Um listener só, no container que sobrevive, e o
          `data-*` diz qual campo mudou. ---- */
  function onSheetClick(e) {
    if (view !== 'conclusao') return;
    if (e.target.closest('#btn-conc-ok')) return concluir();
    const el = e.target.closest('[data-ctipo],[data-cres],[data-cmot]');
    if (!el || !sheetEl.contains(el)) return;
    if (el.dataset.ctipo) form.tipo = el.dataset.ctipo;
    else if (el.dataset.cres) {
      // Trocar de resultado invalida o motivo: o vocabulário é outro.
      form.resultado = el.dataset.cres;
      form.motivo = null;
      form.motivoTexto = '';
    } else if (el.dataset.cmot) form.motivo = el.dataset.cmot;
    render();
  }

  /* Texto e data no rascunho SEM re-render: refazer o innerHTML a cada tecla
     tiraria o foco do campo. Quem reflete o estado é o botão, atualizado à mão. */
  function onSheetInput(e) {
    if (view !== 'conclusao') return;
    const el = e.target;
    if (el.id === 'conc-prox') { form.prox = el.value; return; }
    if (el.id === 'conc-prox-data') { form.proxData = el.value; return; }
    if (el.id !== 'conc-mot-txt') return;
    form.motivoTexto = el.value;
    const ok = sheetEl.querySelector('#btn-conc-ok');
    if (!ok) return;
    const pronto = !!el.value.trim();
    ok.disabled = !pronto;
    ok.textContent = pronto ? '✓ Concluir atividade' : 'Descreva o motivo';
  }

  // Fecha a atividade: o tipo confirmado entra junto, é o mesmo ato.
  function concluir() {
    const t = S.getTarefa(form.tarefaId);
    if (!t) return irPara('pin');
    const feito = S.concluirTarefa(t.id, {
      tipo: form.tipo,
      resultado: form.resultado,
      motivo: form.motivo,
      motivoTexto: form.motivoTexto,
      proximaAcao: form.prox,
      proximaAcaoData: form.proxData || null
    });
    if (!feito) return window.CRM_TOAST && window.CRM_TOAST('Não foi possível concluir.');
    const pin = S.getById(currentId);
    form = { tarefaId: null, tipo: null, resultado: null, motivo: null,
             motivoTexto: '', prox: '', proxData: '' };
    irPara('pin');
    if (window.CRM_TOAST && pin) {
      window.CRM_TOAST('Atividade concluída — ' + pin.name + ' → ' +
        ((D.STATUS[pin.status] || {}).label || pin.status));
    }
  }

  function init() {
    sheetEl = document.getElementById('pin-sheet');
    backdropEl = document.getElementById('sheet-backdrop');
    if (sheetEl) {
      sheetEl.addEventListener('click', onSheetClick);
      sheetEl.addEventListener('input', onSheetInput);
      sheetEl.addEventListener('change', onSheetInput);   // input[type=date]
    }
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
