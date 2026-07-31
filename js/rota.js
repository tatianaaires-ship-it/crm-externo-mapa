/* =====================================================================
   rota.js — MONTAR ROTA no mapa (SPEC 01 §6.2, decidido em 31/07).

   Montar rota não é um toque, é um MODO: escolher N pins. Por isso ele se
   parece com `placing`/`moving` — banner de instrução no topo, FABs
   esmaecidos — e não com um botão que faz algo na hora.

   Onde cada peça mora, e por que não dizem a mesma coisa duas vezes:
     · BANNER (topo)  → a instrução: "toque nos pins que entram na rota".
     · PAINEL (canto inf-esquerdo, onde a legenda sai) → o estado (quantos
       pontos, de quem) e a SAÍDA (`Concluir rota`), perto do polegar.
     · SHEET (rodapé) → o único campo que não é derivado: o DIA.

   Duas portas ligam este mesmo modo (spec-07 §4.2): o FAB 🧭 do mapa e o
   `＋ Nova rota` da sub-aba Rotas. Não são duas mecânicas — é o mesmo fluxo
   entrado em dois momentos.

   ⚠️ Rota é CONJUNTO, não sequência (rota.md §2.1): aqui não se numera pin,
   não se desenha trajeto e não se pede horário. Quem escreve é
   `CRM_STATE.criarRota` — este arquivo é UI.
   ===================================================================== */
(function () {
  'use strict';

  const D = window.CRM_DATA;
  const S = window.CRM_STATE;

  // Set, não array: a ordem do toque não é dado da rota. Guardar a ordem aqui
  // é o primeiro passo para ela vazar para a tela como número de parada.
  let sel = new Set();
  let montando = false;
  let vendedorDaRota = null;      // travado pelo 1º ponto (rota.md §2.4)
  let banner, panel, nEl, lblEl, vendEl, doneBtn;
  let modal, form, diaEl, resumoEl, avisoEl, saveBtn;
  let showTab = function () {};

  // MÍNIMO DE PONTOS. Uma "rota" de um ponto é uma avulsa com passos a mais —
  // e a avulsa já tem duas portas, as duas no pin (spec-07 §2.1 e §3). Então o
  // botão pede o segundo ponto em vez de aceitar um conjunto de um.
  const MIN = 2;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hojeISO() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fmtDia(iso) {
    const p = String(iso || '').split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : '—';
  }
  function plural(n, s, p) { return n + ' ' + (n === 1 ? s : p); }
  function toast(m) { if (window.CRM_TOAST) window.CRM_TOAST(m); }
  function nomeVend(id) { return ((D.VENDEDORES[id] || {}).nome) || '—'; }
  function donoDe(p) { return (p && p.vendedorId) || D.VENDEDOR_SESSAO; }
  function pinsSel() {
    return Array.from(sel).map(S.getById).filter(Boolean);
  }

  /* ---- Entrar e sair do modo ---- */
  function start() {
    if (montando) return;
    // O modo é do mapa: se outro modo está de pé, ele cede. Nunca dois banners
    // no mesmo `top: 12px` (spec-01 §6.1).
    if (window.CRM_CREATE && window.CRM_CREATE.isPlacing()) window.CRM_CREATE.cancel();
    if (window.CRM_MAP.isMoving()) window.CRM_MAP.endMove();
    if (window.CRM_PIN) window.CRM_PIN.close();

    montando = true;
    sel = new Set();
    vendedorDaRota = null;
    document.body.classList.add('is-rota');
    banner.classList.add('is-visible');
    panel.classList.add('is-visible');
    window.CRM_MAP.setRotaSel(sel);
    pinta();
  }

  function cancel() {
    if (!montando) return;
    montando = false;
    document.body.classList.remove('is-rota');
    banner.classList.remove('is-visible');
    panel.classList.remove('is-visible');
    modal.classList.remove('is-open');
    window.CRM_MAP.setRotaSel(null);   // limpa a marca de quem estava escolhido
    sel = new Set();
    vendedorDaRota = null;
  }

  /* ---- O toque no pin: entra ou sai do conjunto ----
     Em modo de montagem o toque NÃO abre o sheet do pin (app.js desvia para
     cá). Tocar de novo tira — sem isso, errar um ponto obrigaria a recomeçar. */
  function toggle(id) {
    const p = S.getById(id);
    if (!p) return;

    if (sel.has(id)) {
      sel.delete(id);
      if (!sel.size) vendedorDaRota = null;      // o conjunto vazio destrava o dono
      window.CRM_MAP.redesenhar([id]);
      pinta();
      return;
    }

    /* Uma rota, um vendedor (rota.md §2.4). A recusa NOMEIA os dois lados: um
       toque que não faz nada e não explica é o pior desfecho possível — foi a
       mesma lição do bloqueio de 2º check-in (spec-07 §2.4). */
    const dono = donoDe(p);
    if (vendedorDaRota && dono !== vendedorDaRota) {
      toast('Esta rota é de ' + nomeVend(vendedorDaRota) + ' — "' + p.name +
            '" é de ' + nomeVend(dono) + '. Uma rota é de um vendedor só.');
      return;
    }
    if (!vendedorDaRota) vendedorDaRota = dono;
    sel.add(id);
    window.CRM_MAP.redesenhar([id]);
    pinta();
  }

  /* O painel diz o estado, e o botão diz O QUE FALTA em vez de recusar depois
     do toque (mesmo padrão dos sheets — spec-07 §3). */
  function pinta() {
    const n = sel.size;
    nEl.textContent = n;
    lblEl.textContent = n === 1 ? 'ponto' : 'pontos';
    vendEl.textContent = vendedorDaRota ? nomeVend(vendedorDaRota) : 'toque no primeiro ponto';
    doneBtn.disabled = n < MIN;
    doneBtn.textContent = n < MIN
      ? (n === 0 ? 'Escolha 2 pontos' : 'Escolha 1 ponto a mais')
      : 'Concluir rota';
  }

  /* ---- O sheet: só o dia, porque só ele não é derivado ---- */
  function abrirModal() {
    if (sel.size < MIN) return;
    diaEl.value = hojeISO();
    diaEl.min = hojeISO();
    pintaResumo();
    modal.classList.add('is-open');
    /* O banner sai enquanto o sheet está aberto. Ele diz "toque nos pins" e o
       sheet cobre o mapa — instrução que não pode ser seguida é pior que
       nenhuma. Mesma regra do rodapé cedendo ao pin sheet (spec-00 §6.15). */
    banner.classList.remove('is-visible');
  }

  // "Voltar" devolve ao modo com a seleção intacta — quem abriu o sheet e
  // percebeu que faltava um ponto não deve perder os outros quatro.
  function fecharModal() {
    modal.classList.remove('is-open');
    if (montando) banner.classList.add('is-visible');
  }

  function pintaResumo() {
    const pins = pinsSel();
    const dia = diaEl.value;
    // O nome é DERIVADO (zona dominante) — mostrado para ninguém ser
    // surpreendido por ele depois, mas não editável no protótipo (rota.md §4).
    const nome = D.nomeDeRota(pins, dia, vendedorDaRota, function (cand) {
      return S.getRotas().some(function (r) { return r.data === dia && r.nome === cand; });
    });

    resumoEl.innerHTML =
      '<strong>' + esc(nome) + '</strong> · ' + esc(nomeVend(vendedorDaRota)) + '<br>' +
      plural(pins.length, 'parada', 'paradas') +
      ' — cada uma nasce como <strong>visita planejada</strong>' +
      // O efeito no funil se diz ANTES do toque, nunca se descobre pelo board
      // depois (mesma regra do sheet de agendar — spec-07 §2.1).
      (entramNoFunil(pins) ? ', e ' + plural(entramNoFunil(pins), 'ponto entra', 'pontos entram') + ' no funil' : '') +
      '.<br><small>Sem horário: as paradas entram como <b>dia inteiro</b> — rota é conjunto, não sequência.</small>';

    /* Ponto em saída lateral CONTINUA lá: montar rota é plano, e voltar de
       `perdido`/`desqualificado` exige tarefa concluída (tarefa.md §5). Dizer
       isso aqui é o que evita a promessa errada de 30/07. */
    const lat = pins.filter(function (p) {
      return (D.STATUS[p.status] || {}).family === 'lateral';
    });
    avisoEl.hidden = !lat.length;
    if (lat.length) {
      avisoEl.innerHTML = '⚖️ ' + plural(lat.length, 'ponto está', 'pontos estão') +
        ' em <b>Perdido</b> ou <b>Desqualificado</b> e <b>continua' + (lat.length > 1 ? 'm' : '') +
        ' lá</b> — só volta' + (lat.length > 1 ? 'm' : '') + ' ao funil quando a visita for concluída.';
    }

    const passou = dia && dia < hojeISO();
    saveBtn.disabled = !dia || passou;
    saveBtn.textContent = !dia ? 'Escolha o dia da rota'
      : passou ? 'O dia já passou' : 'Criar rota';
  }

  function salvar(ev) {
    if (ev) ev.preventDefault();
    const dia = diaEl.value;
    if (!dia || dia < hojeISO() || sel.size < MIN) return;

    const r = S.criarRota({ pinIds: Array.from(sel), data: dia });
    if (!r) {
      // O store é a última linha de defesa; se ele recusou, a UI deixou passar
      // algo — e recusar em silêncio seria o pior desfecho.
      toast('Não consegui criar a rota. Confira se todos os pontos são do mesmo vendedor.');
      return;
    }
    const n = r.paradas.length;
    cancel();
    toast('Rota criada — ' + r.rota.nome + ' · ' + plural(n, 'parada', 'paradas') +
          ' em ' + fmtDia(dia) + '.');
    // Fecha o ciclo onde a rota mora: a sub-aba Rotas, já expandida. Criar e
    // não mostrar o que foi criado deixaria a pessoa procurando.
    showTab('ativ');
    if (window.CRM_ATIV && window.CRM_ATIV.abrirRota) window.CRM_ATIV.abrirRota(r.rota.id);
  }

  function init(opts) {
    banner = document.getElementById('rota-banner');
    panel = document.getElementById('rota-panel');
    nEl = document.getElementById('rota-panel-n');
    lblEl = document.getElementById('rota-panel-lbl');
    vendEl = document.getElementById('rota-panel-vend');
    doneBtn = document.getElementById('btn-rota-done');
    modal = document.getElementById('rota-modal');
    form = document.getElementById('rota-form');
    diaEl = document.getElementById('rota-dia');
    resumoEl = document.getElementById('rota-resumo');
    avisoEl = document.getElementById('rota-aviso');
    saveBtn = document.getElementById('btn-rota-save');
    showTab = (opts && opts.showTab) || showTab;

    const fab = document.getElementById('fab-rota');
    if (fab) fab.addEventListener('click', start);
    const bc = document.getElementById('btn-rota-cancel');
    if (bc) bc.addEventListener('click', cancel);
    if (doneBtn) doneBtn.addEventListener('click', abrirModal);
    const mc = document.getElementById('btn-rota-modal-cancel');
    if (mc) mc.addEventListener('click', fecharModal);
    if (form) form.addEventListener('submit', salvar);
    if (diaEl) diaEl.addEventListener('change', pintaResumo);
  }

  function entramNoFunil(pins) {
    return pins.filter(function (p) { return p.status === 'sem_plano'; }).length;
  }

  window.CRM_ROTA = {
    init: init,
    start: start,
    cancel: cancel,
    toggle: toggle,
    isMontando: function () { return montando; }
  };
})();
