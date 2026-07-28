/* =====================================================================
   atividades.js — Aba "Atividades" (SPEC 07). Três recortes da MESMA
   coleção de tarefas (uma coleção só — tarefa.md §2), em dois recortes:
     · Gerencial → o retrato do período (CAP-13): KPIs, quebras, gráficos L7D
                   e a TABELA detalhada. Abre por padrão. Todo número da tela
                   filtra essa tabela (drill) em vez de trocar de tela.
     · Agenda    → status = planejada. Atrasadas primeiro, depois por dia.
   (Havia um 3º recorte "Realizadas" em cards; a tabela da Gerencial já é a
    lista detalhada, então ele saiu em 28/07 — spec-07 §4.)
   Respeita o conjunto filtrado do mapa; vendedor/período são filtros DESTA
   aba (valem nos três recortes) e não entram na quickbar (spec-07 §6).
   Quem escreve status é state.js/applyStatus — aqui é só UI.
   ===================================================================== */
(function () {
  'use strict';

  const D = window.CRM_DATA;
  const S = window.CRM_STATE;

  let bodyEl, countEl, hintEl, emptyEl, emptyMsgEl;
  let vendEl, periodoEl, customEl, deEl, ateEl, tipEl;
  let tipoEl, ciEl, cnpjEl;
  let showMap = function () {};
  let recorte = 'gerencial';     // gerencial | agenda
  let drill = null;              // {campos:[], valores:[]} — lista detalhada da gerencial
  let ordem = { col: 'data', dir: 'desc' };   // ordenação da tabela detalhada
  let idsVisiveis = null;        // Set dos pins que passaram no filtro do mapa

  /* Filtro da aba — UM só estado, compartilhado pelos três recortes.
     Não persiste (mock de sessão; nada de localStorage até a Fase 4). */
  const filtro = { vendedor: 'todos', tipo: 'todos', checkin: 'todos', cnpj: '',
                   periodo: 'este_mes', de: null, ate: null };
  const CHECKIN = { presencial: 'Presencial', remoto: 'Remoto' };

  /* Presets de período. Semana começa na SEGUNDA. `esta_semana`/`este_mes`
     vão até o FIM do período (futuro), o que os torna úteis também na Agenda. */
  const PERIODOS = [
    { key: 'hoje',            label: 'Hoje' },
    { key: 'ontem',           label: 'Ontem' },
    { key: 'esta_semana',     label: 'Esta semana' },
    { key: 'semana_passada',  label: 'Semana passada' },
    { key: 'este_mes',        label: 'Este mês' },
    { key: 'mes_passado',     label: 'Mês passado' },
    { key: 'personalizado',   label: '📅 Período' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hoje() { return iso(new Date()); }
  function dias(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function segundaDa(d) { return dias(d, -((d.getDay() + 6) % 7)); }   // dom=6, seg=0
  function fmtDia(s) {
    if (!s) return '—';
    const p = s.split('-');
    return p[2] + '/' + p[1];
  }
  function rotuloDia(s) {
    if (s === hoje()) return 'Hoje';
    if (s === D.isoPlus(1)) return 'Amanhã';
    return fmtDia(s);
  }
  function pinOf(t) { return S.getById(t.estabelecimentoId); }
  function nomeVend(id) { return (D.VENDEDORES[id] || {}).nome || '—'; }

  /* A quickbar não aparece nesta aba — se houver filtro do mapa ativo, o hint
     avisa e leva de volta ao Mapa, onde se mexe nele. Filtro nunca é invisível. */
  function setHint(txt) {
    if (!hintEl) return;
    const nf = window.CRM_FILTERS ? window.CRM_FILTERS.activeCount() : 0;
    hintEl.innerHTML = esc(txt) + (nf
      ? ' <button class="head-filtro" data-act="ir-mapa">' + nf +
        (nf === 1 ? ' filtro' : ' filtros') + ' do mapa</button>' : '');
  }

  /* ---- Período: preset → intervalo ISO inclusivo {de, ate} (null = aberto) ---- */
  function intervalo() {
    const hj = new Date(), k = filtro.periodo;
    if (k === 'personalizado') return { de: filtro.de || null, ate: filtro.ate || null };
    if (k === 'hoje')  return { de: iso(hj), ate: iso(hj) };
    if (k === 'ontem') { const o = dias(hj, -1); return { de: iso(o), ate: iso(o) }; }
    if (k === 'esta_semana' || k === 'semana_passada') {
      const ini = dias(segundaDa(hj), k === 'esta_semana' ? 0 : -7);
      return { de: iso(ini), ate: iso(dias(ini, 6)) };
    }
    const m = hj.getMonth() + (k === 'mes_passado' ? -1 : 0);
    return {
      de:  iso(new Date(hj.getFullYear(), m, 1)),
      ate: iso(new Date(hj.getFullYear(), m + 1, 0))
    };
  }
  function noPeriodo(s) {
    if (!s) return false;
    const r = intervalo();
    return !(r.de && s < r.de) && !(r.ate && s > r.ate);
  }
  function rotuloPeriodo() {
    if (filtro.periodo !== 'personalizado') {
      const p = PERIODOS.filter(function (x) { return x.key === filtro.periodo; })[0];
      return p ? p.label.toLowerCase() : '';
    }
    const r = intervalo();
    if (!r.de && !r.ate) return 'sem recorte de data';
    if (!r.ate) return 'a partir de ' + fmtDia(r.de);
    if (!r.de)  return 'até ' + fmtDia(r.ate);
    return fmtDia(r.de) + ' a ' + fmtDia(r.ate);
  }

  /* Tarefas dos pins do conjunto filtrado do mapa, já recortadas por vendedor.
     O período NÃO entra aqui: cada recorte aplica no campo de data que é dele
     (e a Agenda isenta as atrasadas). */
  function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }

  function tarefasVisiveis() {
    const cnpj = soDigitos(filtro.cnpj);
    return S.getTarefas().filter(function (t) {
      if (idsVisiveis && !idsVisiveis.has(t.estabelecimentoId)) return false;
      if (filtro.vendedor !== 'todos' && t.responsavelId !== filtro.vendedor) return false;
      if (filtro.tipo !== 'todos' && t.tipo !== filtro.tipo) return false;
      // Check-in é DERIVADO: planejada ainda não tem, então some com este filtro.
      if (filtro.checkin !== 'todos') {
        const ci = t.status === 'realizada' ? (t.checkinEm ? 'presencial' : 'remoto') : null;
        if (ci !== filtro.checkin) return false;
      }
      if (cnpj) {
        const p = S.getById(t.estabelecimentoId);
        if (!p || soDigitos(p.cnpj).indexOf(cnpj) < 0) return false;
      }
      return true;
    });
  }

  /* ---- Card de atividade (molde do card de lead — SPEC 00 §6.9) ---- */
  function cardHtml(t) {
    const p = pinOf(t);
    if (!p) return '';
    const tipo = D.TAREFA_TIPO[t.tipo] || { emoji: '📌', label: t.tipo };
    const atrasada = t.status === 'planejada' && t.data < hoje();
    const r = t.resultado ? D.RESULTADO[t.resultado] : null;
    const motivo = t.motivoPerda ? D.MOTIVO_PERDA[t.motivoPerda]
                 : (t.motivoDesqualificacao ? D.MOTIVO_DESQUALIFICACAO[t.motivoDesqualificacao] : null);

    let badge = '';
    if (atrasada) badge = '<span class="ativ-badge ativ-badge--late">Atrasada</span>';
    else if (r) badge = '<span class="ativ-badge" style="--c:' + r.color + '">' + esc(r.label) + '</span>';

    const acoes = t.status === 'planejada'
      ? '<div class="ativ-card__acts">' +
          (t.checkinEm
            ? '<button class="btn btn--sm btn--checkout" data-act="checkout" data-id="' + esc(t.id) + '">Check-out</button>'
            : '<button class="btn btn--sm btn--checkin" data-act="checkin" data-id="' + esc(t.id) + '">📍 Check-in</button>') +
          '<button class="btn btn--sm btn--ghost" data-act="concluir" data-id="' + esc(t.id) + '">Concluir</button>' +
          '<button class="btn btn--sm btn--ghost" data-act="cancelar" data-id="' + esc(t.id) + '">Cancelar</button>' +
        '</div>'
      : '';

    return (
      '<article class="ativ-card' + (atrasada ? ' is-late' : '') + '" data-pin="' + esc(p.id) + '">' +
        '<div class="ativ-card__top">' +
          '<span class="ativ-card__tipo" aria-hidden="true">' + tipo.emoji + '</span>' +
          '<button class="ativ-card__name" data-act="abrir" data-pin="' + esc(p.id) + '">' + esc(p.name || '(sem nome)') + '</button>' +
          badge +
        '</div>' +
        '<div class="ativ-card__sub">' +
          '<span>' + esc(tipo.label) + '</span>' +
          '<span>· ' + fmtDia(t.data) + '</span>' +
          '<span>· ' + esc(nomeVend(t.responsavelId)) + '</span>' +
          (motivo ? '<span class="ativ-card__mot">· ' + esc(motivo) + '</span>' : '') +
        '</div>' +
        (t.proximaAcao ? '<p class="ativ-card__next">➜ ' + esc(t.proximaAcao) +
            (t.proximaAcaoData ? ' <em>(' + fmtDia(t.proximaAcaoData) + ')</em>' : '') + '</p>' : '') +
        acoes +
      '</article>'
    );
  }

  /* ---- Agenda: atrasadas primeiro, depois agrupada por dia.
          ⚖️ As ATRASADAS ignoram o filtro de período (spec-07 §4): dívida
          vencida não pode sumir porque o recorte é "hoje" ou "mês passado".
          O período vale para o resto da agenda. ---- */
  function renderAgenda() {
    const base = tarefasVisiveis().filter(function (t) { return t.status === 'planejada'; });
    const atrasadas = base.filter(function (t) { return t.data < hoje(); });
    const resto = base.filter(function (t) { return t.data >= hoje() && noPeriodo(t.data); });
    const asc = function (a, b) { return a.data < b.data ? -1 : 1; };
    atrasadas.sort(asc); resto.sort(asc);

    const n = atrasadas.length + resto.length;
    countEl.textContent = n + (n === 1 ? ' planejada' : ' planejadas');
    setHint(atrasadas.length
      ? rotuloPeriodo() + ' · atrasadas sempre visíveis'
      : rotuloPeriodo() + ' · agendar põe o pin no funil');
    emptyMsgEl.textContent = 'Nenhuma atividade planejada neste recorte.';
    emptyEl.classList.toggle('is-visible', n === 0);
    if (!n) return (bodyEl.innerHTML = '');

    let html = '';
    if (atrasadas.length) {
      html += '<h3 class="ativ-group ativ-group--late">Atrasadas</h3>' +
              atrasadas.map(cardHtml).join('');
    }
    let grupo = null;
    resto.forEach(function (t) {
      const g = rotuloDia(t.data);
      if (g !== grupo) { grupo = g; html += '<h3 class="ativ-group">' + esc(g) + '</h3>'; }
      html += cardHtml(t);
    });

    // proxima_acao_data aparece na agenda como SUGESTÃO — não é tarefa.
    const sug = tarefasVisiveis().filter(function (t) { return noPeriodo(t.proximaAcaoData); });
    if (sug.length) {
      html += '<h3 class="ativ-group">Sugestões (não são tarefas)</h3>' +
        sug.slice(0, 8).map(function (t) {
          const p = pinOf(t); if (!p) return '';
          return '<div class="ativ-sug"><strong>' + esc(p.name) + '</strong> — ' +
                 esc(t.proximaAcao) + ' <em>' + fmtDia(t.proximaAcaoData) + '</em></div>';
        }).join('');
    }
    bodyEl.innerHTML = html;
  }


  /* ---- Gerencial (CAP-13): quantidade + lista detalhada ---- */
  function valorDe(t, campo) {
    if (campo === 'tipo') return (D.TAREFA_TIPO[t.tipo] || {}).label || t.tipo;
    if (campo === 'vendedor') return nomeVend(t.responsavelId);
    if (campo === 'resultado') return (D.RESULTADO[t.resultado] || {}).label || '—';
    if (campo === 'feito') return t.status === 'realizada' ? 'Sim' : 'Não';
    return '';
  }
  /* O drill aceita mais de um critério (a célula da pivô é vendedor + tipo);
     campos e valores viajam no dataset separados por "|".
     ⚖️ Desde 28/07 o drill filtra a TABELA, não uma aba: os agregados de cima
     continuam inteiros (são o controle) e a tabela mostra a fatia (é o detalhe).
     Drill por `resultado` exclui planejada naturalmente — `valorDe` devolve "—"
     para quem não tem desfecho. */
  function casaDrill(t) {
    if (!drill) return true;
    return drill.campos.every(function (c, i) { return valorDe(t, c) === drill.valores[i]; });
  }
  // "Sim"/"Não" só fazem sentido dentro da coluna Realizado; soltos num chip,
  // não se leem. O chip diz o que a pessoa clicou, não o valor cru.
  function rotuloDrill() {
    if (!drill) return '';
    return drill.valores.map(function (v, i) {
      if (drill.campos[i] !== 'feito') return v;
      return v === 'Sim' ? 'Realizadas' : 'Não realizadas';
    }).join(' · ');
  }

  /* Nome da rota é DERIVADO (vendedor + dia), não campo: `tarefa.md` §9 mantém
     Rota como objeto próprio da Fase 4 e crava que uma tarefa não é uma parada.
     O rótulo dá a coluna do print sem antecipar o objeto. */
  function nomeRota(t) {
    const p = t.data.split('-');
    return 'Rota (' + p[2] + '/' + p[1] + '/' + p[0] + ')';
  }
  function tipoCheckin(t) {
    if (t.status !== 'realizada') return '—';
    return t.checkinEm ? 'Presencial' : 'Remoto';
  }
  function quebra(ts, campo) {
    const acc = {};
    ts.forEach(function (t) { const v = valorDe(t, campo); acc[v] = (acc[v] || 0) + 1; });
    return Object.keys(acc).sort(function (a, b) { return acc[b] - acc[a]; })
      .map(function (k) { return { rotulo: k, n: acc[k] }; });
  }
  function blocoHtml(titulo, campo, linhas, max) {
    return '<section class="ger-bloco"><h3 class="ativ-group">' + esc(titulo) + '</h3>' +
      linhas.map(function (l) {
        const pct = max ? Math.round((l.n / max) * 100) : 0;
        return '<button class="ger-linha" data-act="drill" data-campo="' + campo + '" data-valor="' + esc(l.rotulo) + '">' +
          '<span class="ger-linha__lbl">' + esc(l.rotulo) + '</span>' +
          '<span class="ger-linha__bar"><i style="width:' + pct + '%"></i></span>' +
          '<span class="ger-linha__n">' + l.n + '</span>' +
        '</button>';
      }).join('') + '</section>';
  }
  function realizadasNoPeriodo() {
    return tarefasVisiveis().filter(function (t) {
      return t.status === 'realizada' && noPeriodo(t.data);
    });
  }
  /* Barra empilhada 100% por `resultado` — parte-do-todo. Ordem FIXA do enum
     (nunca por ranking): a cor segue a entidade, não a posição, então o mesmo
     resultado tem a mesma cor em qualquer período. Legenda sempre presente. */
  let serieResultado = null;      // cache do detalhamento da barra empilhada

  function stackHtml(ts) {
    const acc = {};
    ts.forEach(function (t) { acc[t.resultado] = (acc[t.resultado] || 0) + 1; });
    const usados = D.RESULTADO_ORDER.filter(function (k) { return acc[k]; });
    if (!usados.length) return '';
    serieResultado = { acc: acc, total: ts.length };

    /* Segmento MOSTRA (tooltip), legenda LEVA (drill). No celular um toque não
       pode fazer as duas coisas: ou abre o detalhamento ou navega. A porta
       continua existindo, logo abaixo e por categoria. */
    const segs = usados.map(function (k) {
      const r = D.RESULTADO[k];
      return '<div class="ger-stack__seg" style="flex:' + acc[k] + ';--c:' + r.color + '"' +
             ' data-tip="resultado" tabindex="0"' +
             ' aria-label="' + esc(r.label) + ': ' + acc[k] + '"></div>';
    }).join('');

    const leg = usados.map(function (k) {
      const r = D.RESULTADO[k];
      return '<button data-act="drill" data-campo="resultado" data-valor="' + esc(r.label) + '">' +
        '<span class="ger-legenda__dot" style="--c:' + r.color + '"></span>' +
        '<span class="ger-legenda__lbl">' + esc(r.label) + '</span>' +
        '<span class="ger-legenda__n">' + acc[k] + '</span>' +
      '</button>';
    }).join('');

    return '<section class="ger-bloco"><h3 class="ativ-group">Por resultado</h3>' +
           '<div class="ger-stack">' + segs + '</div>' +
           '<div class="ger-legenda">' + leg + '</div></section>';
  }

  /* ---- Pivô vendedor × tipo de visita. Cada célula é uma porta (drill duplo). ---- */
  function pivoHtml(ts) {
    const vends = D.VENDEDOR_ORDER.filter(function (v) {
      return ts.some(function (t) { return t.responsavelId === v; });
    });
    if (!vends.length) return '';
    const tipos = D.TAREFA_TIPO_ORDER;
    const cel = function (v, k) {
      return ts.filter(function (t) { return t.responsavelId === v && t.tipo === k; }).length;
    };
    const totCol = tipos.map(function (k) {
      return ts.filter(function (t) { return t.tipo === k; }).length;
    });

    return '<section class="ger-bloco"><h3 class="ativ-group">Vendedor × tipo de visita</h3>' +
      '<div class="ger-pivo-wrap"><table class="ger-pivo"><thead><tr>' +
        '<th class="ger-pivo__rh">Vendedor</th>' +
        tipos.map(function (k) { return '<th>' + D.TAREFA_TIPO[k].emoji + ' ' + esc(D.TAREFA_TIPO[k].label) + '</th>'; }).join('') +
        '<th class="ger-pivo__tot">Total</th>' +
      '</tr></thead><tbody>' +
      vends.map(function (v) {
        const linha = ts.filter(function (t) { return t.responsavelId === v; }).length;
        return '<tr><th class="ger-pivo__rh">' +
          '<span class="ger-dot" style="--c:' + D.VENDEDORES[v].cor + '"></span>' + esc(nomeVend(v)) + '</th>' +
          tipos.map(function (k) {
            const n = cel(v, k);
            if (!n) return '<td class="is-zero">·</td>';
            return '<td><button data-act="drill" data-campo="vendedor|tipo" data-valor="' +
              esc(nomeVend(v)) + '|' + esc(D.TAREFA_TIPO[k].label) + '">' + n + '</button></td>';
          }).join('') +
          '<td class="ger-pivo__tot"><button data-act="drill" data-campo="vendedor" data-valor="' +
            esc(nomeVend(v)) + '">' + linha + '</button></td></tr>';
      }).join('') +
      '<tr class="ger-pivo__foot"><th class="ger-pivo__rh">Total</th>' +
        tipos.map(function (k, i) {
          return '<td><button data-act="drill" data-campo="tipo" data-valor="' +
            esc(D.TAREFA_TIPO[k].label) + '">' + totCol[i] + '</button></td>';
        }).join('') +
        '<td class="ger-pivo__tot">' + ts.length + '</td></tr>' +
      '</tbody></table></div></section>';
  }

  /* ---- Barras por dia, empilhadas por vendedor.
     "Planejadas do dia" = TODAS as tarefas daquela data. Planejada e realizada
     são o mesmo objeto (tarefa.md §2): o que foi feito hoje estava no plano de
     hoje. O par de gráficos lê como "planejei X, executei Y". ---- */
  // L7D = os 7 dias corridos até hoje. FIXO: estes dois gráficos são os únicos
  // da tela que NÃO seguem o filtro de período — daí o "L7D" no título, que é
  // o que impede a leitura errada. O filtro de vendedor continua valendo.
  function dias7() {
    const out = [];
    for (let k = 6; k >= 0; k--) {
      const d = new Date();
      d.setDate(d.getDate() - k);
      out.push(iso(d));
    }
    return out;
  }

  let serieDia = { feitas: {}, plano: {} };   // cache para o tooltip

  function barrasHtml(titulo, sub, serie, dias, porDia, maxN) {
    const cols = dias.map(function (dia) {
      const seg = porDia[dia] || {};
      const tot = D.VENDEDOR_ORDER.reduce(function (s, v) { return s + (seg[v] || 0); }, 0);
      const pilha = D.VENDEDOR_ORDER.filter(function (v) { return seg[v]; }).map(function (v) {
        return '<i style="height:' + ((seg[v] / maxN) * 100) + '%;--c:' + D.VENDEDORES[v].cor + '"></i>';
      }).join('');
      const p = dia.split('-');
      return '<div class="ger-col" data-dia="' + dia + '" data-serie="' + serie + '" tabindex="0">' +
        '<span class="ger-col__n">' + (tot || '') + '</span>' +
        '<div class="ger-col__pilha">' + pilha + '</div>' +
        '<span class="ger-col__d">' + p[2] + '/' + p[1] + '</span>' +
      '</div>';
    }).join('');
    return '<section class="ger-bloco"><h3 class="ativ-group">' + esc(titulo) +
             ' <span class="ger-l7d">L7D</span></h3>' +
           (sub ? '<p class="ger-nota">' + esc(sub) + '</p>' : '') +
           '<div class="ger-barras">' + cols + '</div></section>';
  }

  function graficosDiaHtml() {
    const dias = dias7();
    const noSet = {};
    dias.forEach(function (d) { noSet[d] = 1; });

    // Fonte é tarefasVisiveis(): pega o filtro de vendedor e o do mapa, mas
    // ignora o de período de propósito (a janela é sempre L7D).
    const feitasPorDia = {}, planoPorDia = {};
    tarefasVisiveis().forEach(function (t) {
      if (!noSet[t.data]) return;
      (planoPorDia[t.data] = planoPorDia[t.data] || {});
      planoPorDia[t.data][t.responsavelId] = (planoPorDia[t.data][t.responsavelId] || 0) + 1;
      if (t.status === 'realizada') {
        (feitasPorDia[t.data] = feitasPorDia[t.data] || {});
        feitasPorDia[t.data][t.responsavelId] = (feitasPorDia[t.data][t.responsavelId] || 0) + 1;
      }
    });
    serieDia = { feitas: feitasPorDia, plano: planoPorDia };

    // Uma escala só para os dois gráficos: alturas comparáveis entre eles.
    let maxN = 1;
    dias.forEach(function (d) {
      [feitasPorDia[d], planoPorDia[d]].forEach(function (s) {
        if (!s) return;
        const tot = D.VENDEDOR_ORDER.reduce(function (a, v) { return a + (s[v] || 0); }, 0);
        if (tot > maxN) maxN = tot;
      });
    });

    const legenda = '<div class="ger-legenda ger-legenda--vend">' +
      D.VENDEDOR_ORDER.filter(function (v) {
        return dias.some(function (d) { return planoPorDia[d] && planoPorDia[d][v]; });
      }).map(function (v) {
        return '<button data-act="drill" data-campo="vendedor" data-valor="' + esc(nomeVend(v)) + '">' +
          '<span class="ger-legenda__dot" style="--c:' + D.VENDEDORES[v].cor + '"></span>' +
          '<span class="ger-legenda__lbl">' + esc(nomeVend(v)) + '</span></button>';
      }).join('') + '</div>';

    return legenda +
      barrasHtml('Realizadas por dia', '', 'feitas', dias, feitasPorDia, maxN) +
      barrasHtml('Planejadas por dia', 'o plano do dia — a realizada de hoje estava no plano de hoje',
                 'plano', dias, planoPorDia, maxN);
  }

  /* ---- Detalhamento ao passar o mouse / tocar numa coluna ---- */
  function fmtPct(n, tot) { return tot ? (Math.round((n / tot) * 10000) / 100).toFixed(2).replace('.', ',') + '%' : '—'; }
  function tipLinha(cor, nome, n, tot, cls) {
    return '<div class="ger-tip__r' + (cls || '') + '">' +
      '<span class="ger-legenda__dot" style="--c:' + cor + '"></span>' +
      '<span class="ger-tip__nome">' + esc(nome) + '</span>' +
      '<span class="ger-tip__n">' + n + '</span>' +
      '<span class="ger-tip__p">' + (tot === n ? '100%' : fmtPct(n, tot)) + '</span></div>';
  }
  function mostraTip(col) {
    if (!tipEl) return;

    if (col.dataset.tip === 'resultado') {
      // Barra empilhada: % de cada desfecho sobre TODAS as realizadas do recorte.
      const s = serieResultado;
      if (!s) return;
      tipEl.innerHTML = '<div class="ger-tip__d">Resultado das realizadas</div>' +
        D.RESULTADO_ORDER.filter(function (k) { return s.acc[k]; }).map(function (k) {
          return tipLinha(D.RESULTADO[k].color, D.RESULTADO[k].label, s.acc[k], s.total);
        }).join('') +
        tipLinha('transparent', 'Total', s.total, s.total, ' ger-tip__r--tot');
    } else {
      const dia = col.dataset.dia;
      const seg = (serieDia[col.dataset.serie] || {})[dia] || {};
      const tot = D.VENDEDOR_ORDER.reduce(function (s, v) { return s + (seg[v] || 0); }, 0);
      const p = dia.split('-');
      tipEl.innerHTML =
        '<div class="ger-tip__d">' + p[2] + '/' + p[1] + '/' + p[0] + '</div>' +
        (tot
          ? D.VENDEDOR_ORDER.filter(function (v) { return seg[v]; }).map(function (v) {
              return tipLinha(D.VENDEDORES[v].cor, nomeVend(v), seg[v], tot);
            }).join('') +
            tipLinha('transparent', 'Total', tot, tot, ' ger-tip__r--tot')
          : '<div class="ger-tip__r ger-tip__vazio">Sem atividade neste dia</div>');
    }

    tipEl.hidden = false;
    // Posiciona acima da coluna e prende dentro da viewport.
    const r = col.getBoundingClientRect();
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    let y = r.top - h - 8;
    if (y < 8) y = r.bottom + 8;             // sem espaço em cima → vai pra baixo
    tipEl.style.left = Math.round(x) + 'px';
    tipEl.style.top = Math.round(y) + 'px';
  }
  function escondeTip() { if (tipEl) tipEl.hidden = true; }

  /* ---- Tabela detalhada: planejadas E realizadas, uma linha por tarefa.
     Ordenável por qualquer coluna (spec-07 §5.4). ---- */
  const COLS = [
    { k: 'vend',  t: 'Vendedor' },
    { k: 'data',  t: 'Data' },
    { k: 'cli',   t: 'Cliente' },
    { k: 'cnpj',  t: 'CNPJ' },
    { k: 'rota',  t: 'Nome Rota' },
    { k: 'tipo',  t: 'Tipo de visita' },
    { k: 'feito', t: 'Realizado' },
    { k: 'ci',    t: 'Tipo Check-in' },
    { k: 'nota',  t: 'Comentário' },
    { k: 'dist',  t: 'Distância' },
    { k: 'end',   t: 'Endereço' }
  ];
  function linhasTabela(ts) {
    return ts.map(function (t) {
      const p = pinOf(t) || {};
      return {
        id: t.id, pin: p.id,
        vend: nomeVend(t.responsavelId),
        data: t.data,
        cli: p.name || '(sem nome)',
        cnpj: p.cnpj || null,                      // pin sem CNPJ existe (lead cru)
        rota: nomeRota(t),
        tipo: (D.TAREFA_TIPO[t.tipo] || {}).label || t.tipo,
        feito: t.status === 'realizada' ? 'Sim' : 'Não',
        ci: tipoCheckin(t),
        nota: t.notas || '',
        dist: t.distanciaKm,                       // number|null — ordena numérico
        end: p.address || ''
      };
    });
  }
  let tabelaTs = [];        // conjunto da tabela, guardado para reordenar sem re-render
  function tabelaHtml(todas) {
    tabelaTs = todas;
    const ts = todas.filter(casaDrill);
    const linhas = linhasTabela(ts);
    linhas.sort(function (a, b) {
      const x = a[ordem.col], y = b[ordem.col];
      const vx = (x == null || x === ''), vy = (y == null || y === '');
      // Vazio vai pro fim nas DUAS direções — fora da inversão, senão inverter
      // a ordem traz um bloco de "—" pro topo e esconde o dado.
      if (vx || vy) return vx && vy ? 0 : (vx ? 1 : -1);
      const c = (typeof x === 'number') ? x - y : String(x).localeCompare(String(y), 'pt-BR');
      return ordem.dir === 'asc' ? c : -c;
    });

    const head = COLS.map(function (c) {
      const on = c.k === ordem.col;
      return '<th><button class="ger-th' + (on ? ' is-on' : '') + '" data-act="ordenar" data-col="' + c.k + '">' +
        esc(c.t) + (on ? (ordem.dir === 'asc' ? ' ▲' : ' ▼') : '') + '</button></th>';
    }).join('');

    /* Teto de linhas: 300+ linhas × 10 células deixavam cada toque de ordenação
       em ~250ms, e ninguém rola 300 linhas no celular — ordena e olha o topo.
       O teto é DITO na tela: corte silencioso vira "cobri tudo" quando não cobriu. */
    const TETO = 150;
    const cortadas = Math.max(0, linhas.length - TETO);
    const visiveis = cortadas ? linhas.slice(0, TETO) : linhas;

    const body = visiveis.map(function (l) {
      return '<tr>' +
        '<td>' + esc(l.vend) + '</td>' +
        '<td class="ger-td--num">' + fmtDia(l.data) + '</td>' +
        '<td><button class="ger-td__pin" data-act="abrir" data-pin="' + esc(l.pin) + '">' + esc(l.cli) + '</button></td>' +
        '<td class="ger-td--num">' + esc(l.cnpj || '—') + '</td>' +
        '<td>' + esc(l.rota) + '</td>' +
        '<td>' + esc(l.tipo) + '</td>' +
        '<td><span class="ger-sim' + (l.feito === 'Sim' ? ' is-sim' : '') + '">' + l.feito + '</span></td>' +
        '<td>' + esc(l.ci) + '</td>' +
        '<td class="ger-td--nota" title="' + esc(l.nota) + '">' + esc(l.nota || '—') + '</td>' +
        '<td class="ger-td--num">' + (l.dist == null ? '—' : l.dist.toFixed(2).replace('.', ',') + ' km') + '</td>' +
        '<td class="ger-td--end" title="' + esc(l.end) + '">' + esc(l.end) + '</td>' +
      '</tr>';
    }).join('');

    // Todo drill da tela desemboca aqui: o chip diz por que a lista encolheu e
    // é a porta de volta. Sem ele, a tabela filtrada parece ter perdido dado.
    const chip = drill
      ? '<button class="ger-drill" data-act="limpar-drill">' + esc(rotuloDrill()) +
        ' <span aria-hidden="true">✕</span></button>'
      : '';

    return '<section class="ger-bloco" id="ger-tabela">' +
      '<h3 class="ativ-group">Atividades do período (' + linhas.length +
        (drill ? ' de ' + todas.length : '') + ')' + chip + '</h3>' +
      '<p class="ger-nota">Planejadas e realizadas na mesma lista — uma linha por atividade. Toque no cabeçalho para ordenar.' +
      (cortadas ? ' <strong>Mostrando as ' + TETO + ' primeiras desta ordenação</strong> (' +
                  cortadas + ' fora da tela — ordene para trazer o que interessa ao topo).' : '') + '</p>' +
      '<div class="ger-tab-wrap"><table class="ger-tab"><thead><tr>' + head + '</tr></thead>' +
      '<tbody>' + body + '</tbody></table></div></section>';
  }

  function renderGerencial() {
    const ts = realizadasNoPeriodo();
    const planejadas = tarefasVisiveis().filter(function (t) {
      return t.status === 'planejada' && noPeriodo(t.data);
    });
    const td = ts.filter(function (t) { return t.resultado === 'td_encontrado'; }).length;
    const taxa = ts.length ? Math.round((td / ts.length) * 100) : 0;

    countEl.textContent = ts.length + (ts.length === 1 ? ' realizada' : ' realizadas');
    setHint(rotuloPeriodo() + ' · toque num número para a lista');
    emptyEl.classList.remove('is-visible');

    /* Os três números são um funil de execução: do plano → executado → com
       resultado. Cada um é % do ANTERIOR, não do total.
       ⚖️ "Planejadas" aqui é o PLANO DO PERÍODO — todas as tarefas com data
       no recorte, realizadas incluídas. Se fosse só quem continua `planejada`,
       os dois conjuntos seriam disjuntos (plano no futuro, feito no passado) e
       "16 de 38" não significaria nada. Mesma leitura dos gráficos L7D. */
    const noPlano = ts.length + planejadas.length;
    const pctExec = noPlano ? Math.round((ts.length / noPlano) * 100) : 0;

    const kpi = function (cls, act, extra, n, rot, sub) {
      return '<button class="ger-kpi' + cls + '" ' + act + extra + '>' +
        '<span class="ger-kpi__n">' + n + '</span>' +
        '<span class="ger-kpi__l">' + rot + '</span>' +
        '<span class="ger-kpi__s">' + sub + '</span></button>';
    };
    const kpis =
      '<div class="ger-kpis">' +
        kpi('', 'data-act="ir-tabela"', '', noPlano, 'Planejadas', 'no período') +
        kpi('', 'data-act="drill" data-campo="feito"', ' data-valor="Sim"',
            ts.length, 'Realizadas', pctExec + '% das planejadas') +
        kpi('', 'data-act="drill" data-campo="resultado"',
            ' data-valor="' + esc(D.RESULTADO.td_encontrado.label) + '"',
            td, 'TD encontrado', taxa + '% das realizadas') +
      '</div>';

    // A contagem já vive no head da aba ("N realizadas") — repetir num
    // número-manchete era dizer a mesma coisa duas vezes na mesma tela.
    if (!ts.length) {
      bodyEl.innerHTML = kpis +
        '<p class="ativ-vazio">Nada realizado neste recorte' +
        (planejadas.length ? ' — mas há ' + planejadas.length + ' planejada' +
          (planejadas.length > 1 ? 's' : '') + '.' : '.') + '</p>' +
        (planejadas.length ? tabelaHtml(planejadas) : '');
      return;
    }

    const porVend = quebra(ts, 'vendedor');
    const maxN = Math.max.apply(null, porVend.map(function (l) { return l.n; }));
    // A tabela e os gráficos por dia cobrem planejadas E realizadas do período.
    const todas = ts.concat(planejadas);

    bodyEl.innerHTML =
      kpis +
      stackHtml(ts) +
      blocoHtml('Por vendedor', 'vendedor', porVend, maxN) +
      pivoHtml(ts) +
      graficosDiaHtml() +
      tabelaHtml(todas);
  }

  function render() {
    if (!bodyEl) return;
    if (recorte === 'agenda') renderAgenda();
    else renderGerencial();
  }

  // Recebe o conjunto filtrado do mapa (mesmo pipeline do Funil/Inteligência).
  function refresh(list) {
    idsVisiveis = new Set((list || []).map(function (p) { return p.id; }));
    render();
  }

  /* ---- Conclusão (check-out): resultado obrigatório; motivo nos negativos ---- */
  function pedirConclusao(t) {
    const opts = D.RESULTADO_ORDER.map(function (k, i) {
      return (i + 1) + ') ' + D.RESULTADO[k].acao;   // `acao` = verbo do botão
    }).join('\n');
    const escolha = window.prompt('Resultado da atividade:\n' + opts +
      '\n\nCSC e Aquisição não entram aqui — conversão vem do cadastro/pedido.', '1');
    if (escolha == null) return;
    const key = D.RESULTADO_ORDER[parseInt(escolha, 10) - 1];
    const r = D.RESULTADO[key];
    if (!r) return window.CRM_TOAST && window.CRM_TOAST('Resultado inválido.');

    let motivo = null;
    if (r.motivo) {
      const tabela = r.motivo === 'perda' ? D.MOTIVO_PERDA : D.MOTIVO_DESQUALIFICACAO;
      const keys = Object.keys(tabela);
      const lista = keys.map(function (k, i) { return (i + 1) + ') ' + tabela[k]; }).join('\n');
      const m = window.prompt('Motivo (obrigatório):\n' + lista, '1');
      if (m == null) return;
      motivo = keys[parseInt(m, 10) - 1];
      if (!motivo) return window.CRM_TOAST && window.CRM_TOAST('Motivo obrigatório — nada foi concluído.');
    }
    const prox = window.prompt('Próxima ação (opcional):', '') || null;

    const ok = S.concluirTarefa(t.id, { resultado: key, motivo: motivo, proximaAcao: prox });
    if (!ok) return window.CRM_TOAST && window.CRM_TOAST('Não foi possível concluir.');
    const p = pinOf(t);
    if (window.CRM_TOAST) {
      window.CRM_TOAST('Atividade concluída — ' + (p ? p.name + ' → ' : '') +
        (D.STATUS[p ? p.status : ''] || {}).label);
    }
  }

  function onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'abrir') {
      const id = btn.dataset.pin;
      showMap();
      setTimeout(function () {
        if (window.CRM_MAP) window.CRM_MAP.focus(id, Math.max(window.CRM_MAP.getMap().getZoom(), 16));
        if (window.CRM_PIN) window.CRM_PIN.open(id);
      }, 60);
      return;
    }
    if (act === 'ir-agenda') { setRecorte('agenda'); return; }
    if (act === 'ir-tabela') { drill = null; render(); vaiPraTabela(); return; }
    if (act === 'ordenar') {
      const c = btn.dataset.col;
      // Mesma coluna inverte; coluna nova começa asc (menos `data`, que a
      // supervisão quer ver do mais recente pro mais antigo).
      ordem = (ordem.col === c)
        ? { col: c, dir: ordem.dir === 'asc' ? 'desc' : 'asc' }
        : { col: c, dir: c === 'data' ? 'desc' : 'asc' };
      // Re-render só da tabela: refazer a gerencial inteira (pivô + 2 gráficos
      // + centenas de linhas) custava ~150ms e o toque parecia travado.
      const sec = btn.closest('.ger-bloco');
      const wrap = sec && sec.querySelector('.ger-tab-wrap');
      if (!sec) { render(); return; }
      const sx = wrap ? wrap.scrollLeft : 0, sy = wrap ? wrap.scrollTop : 0;
      sec.outerHTML = tabelaHtml(tabelaTs);
      const novo = bodyEl.querySelector('.ger-tab-wrap');
      if (novo) { novo.scrollLeft = sx; novo.scrollTop = sy; }
      return;
    }
    if (act === 'drill') {
      drill = { campos: btn.dataset.campo.split('|'), valores: btn.dataset.valor.split('|') };
      render();
      vaiPraTabela();
      return;
    }
    if (act === 'limpar-drill') {
      drill = null;
      const y = bodyEl.scrollTop;
      render();
      bodyEl.scrollTop = y;      // limpar o filtro não pode teleportar a página
      return;
    }

    const t = S.getTarefa(btn.dataset.id);
    if (!t) return;
    if (act === 'checkin') {
      S.checkInTarefa(t.id);
      if (window.CRM_TOAST) window.CRM_TOAST('Check-in registrado.');
    } else if (act === 'checkout' || act === 'concluir') {
      pedirConclusao(t);
    } else if (act === 'cancelar') {
      // Cancelar o último plano tira o pin do board — vale confirmar.
      const p = pinOf(t);
      const unico = p && S.planejadasDoPin(p.id).length === 1;
      const msg = unico
        ? 'Cancelar a última atividade planejada de "' + p.name + '"?\nO pin sai do funil (volta a Sem plano).'
        : 'Cancelar esta atividade?';
      if (!window.confirm(msg)) return;
      S.cancelarTarefa(t.id);
      if (window.CRM_TOAST) window.CRM_TOAST('Atividade cancelada.');
    }
  }

  const SEG = [['seg-ger', 'gerencial'], ['seg-agenda', 'agenda']];

  // O drill mora na tabela da Gerencial; rolar até ela é o que substitui a
  // antiga troca de aba — o usuário precisa VER que a lista respondeu.
  function vaiPraTabela() {
    const alvo = document.getElementById('ger-tabela');
    if (alvo && alvo.scrollIntoView) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setRecorte(r) {
    recorte = r;
    if (r !== 'gerencial') drill = null;
    SEG.forEach(function (pair) {
      const el = document.getElementById(pair[0]);
      if (!el) return;
      const on = pair[1] === r;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    render();
  }

  /* ---- Barra de filtros da aba (spec-07 §6) ---- */
  function pintaChips() {
    if (!periodoEl) return;
    Array.prototype.forEach.call(periodoEl.children, function (el) {
      el.classList.toggle('is-on', el.dataset.p === filtro.periodo);
    });
    if (customEl) customEl.hidden = filtro.periodo !== 'personalizado';
  }
  // Controle com valor diferente de "Todos" fica marcado em --brand: quatro
  // filtros lado a lado precisam dizer, de relance, quais estão agindo.
  function pintaAtivos() {
    [[vendEl, filtro.vendedor !== 'todos'], [tipoEl, filtro.tipo !== 'todos'],
     [ciEl, filtro.checkin !== 'todos'], [cnpjEl, !!soDigitos(filtro.cnpj)]]
      .forEach(function (p) { if (p[0]) p[0].classList.toggle('is-on', p[1]); });
  }
  function montaFiltros() {
    if (vendEl) {
      vendEl.innerHTML = '<option value="todos">Todos os vendedores</option>' +
        D.VENDEDOR_ORDER.map(function (id) {
          return '<option value="' + esc(id) + '">' + esc(D.VENDEDORES[id].nome) +
                 (id === D.VENDEDOR_SESSAO ? ' (eu)' : '') + '</option>';
        }).join('');
      vendEl.value = filtro.vendedor;
      vendEl.addEventListener('change', function () {
        filtro.vendedor = vendEl.value;
        drill = null;                     // o drill pode ser por vendedor — não sobrevive
        pintaAtivos(); render();
      });
    }
    if (tipoEl) {
      tipoEl.innerHTML = '<option value="todos">Todos</option>' +
        D.TAREFA_TIPO_ORDER.map(function (k) {
          return '<option value="' + k + '">' + D.TAREFA_TIPO[k].emoji + ' ' + esc(D.TAREFA_TIPO[k].label) + '</option>';
        }).join('');
      tipoEl.value = filtro.tipo;
      tipoEl.addEventListener('change', function () {
        filtro.tipo = tipoEl.value; drill = null; pintaAtivos(); render();
      });
    }
    if (ciEl) {
      ciEl.innerHTML = '<option value="todos">Todos</option>' +
        Object.keys(CHECKIN).map(function (k) {
          return '<option value="' + k + '">' + esc(CHECKIN[k]) + '</option>';
        }).join('');
      ciEl.value = filtro.checkin;
      ciEl.addEventListener('change', function () {
        filtro.checkin = ciEl.value; drill = null; pintaAtivos(); render();
      });
    }
    if (cnpjEl) {
      let deb;
      cnpjEl.addEventListener('input', function () {
        clearTimeout(deb);
        deb = setTimeout(function () {         // não re-renderiza a cada tecla
          filtro.cnpj = cnpjEl.value; drill = null; pintaAtivos(); render();
        }, 220);
      });
    }
    if (periodoEl) {
      periodoEl.innerHTML = PERIODOS.map(function (p) {
        return '<button class="chip" data-p="' + p.key + '">' + esc(p.label) + '</button>';
      }).join('');
      periodoEl.addEventListener('click', function (e) {
        const b = e.target.closest('[data-p]');
        if (!b) return;
        filtro.periodo = b.dataset.p;
        // Primeiro toque no personalizado: semeia o mês corrente nos campos.
        if (filtro.periodo === 'personalizado' && !filtro.de && !filtro.ate) {
          const hj = new Date();
          filtro.de  = iso(new Date(hj.getFullYear(), hj.getMonth(), 1));
          filtro.ate = hoje();
          if (deEl)  deEl.value  = filtro.de;
          if (ateEl) ateEl.value = filtro.ate;
        }
        pintaChips();
        render();
      });
    }
    [[deEl, 'de'], [ateEl, 'ate']].forEach(function (pair) {
      if (!pair[0]) return;
      pair[0].addEventListener('change', function () {
        filtro[pair[1]] = pair[0].value || null;
        render();
      });
    });
    pintaChips();
    pintaAtivos();
  }

  function init(opts) {
    bodyEl = document.getElementById('ativ-body');
    countEl = document.getElementById('ativ-count');
    hintEl = document.getElementById('ativ-hint');
    emptyEl = document.getElementById('ativ-empty');
    emptyMsgEl = document.getElementById('ativ-empty-msg');
    vendEl = document.getElementById('ativ-vend');
    periodoEl = document.getElementById('ativ-periodo');
    customEl = document.getElementById('ativ-custom');
    deEl = document.getElementById('ativ-de');
    ateEl = document.getElementById('ativ-ate');
    tipoEl = document.getElementById('ativ-tipo');
    ciEl = document.getElementById('ativ-ci');
    cnpjEl = document.getElementById('ativ-cnpj');
    showMap = (opts && opts.showMap) || showMap;

    // Tooltip dos gráficos por dia. Vive fora do body (que rola) e é
    // posicionado em coordenadas de viewport.
    tipEl = document.createElement('div');
    tipEl.className = 'ger-tip';
    tipEl.hidden = true;
    tipEl.setAttribute('role', 'tooltip');
    const view = document.getElementById('ativ-view');
    if (view) view.appendChild(tipEl);

    if (bodyEl) {
      // Mouse no desktop, toque no Android, teclado para quem navega por foco.
      bodyEl.addEventListener('pointerover', function (e) {
        const col = e.target.closest('.ger-col,[data-tip]');
        if (col) mostraTip(col); else escondeTip();
      });
      bodyEl.addEventListener('pointerleave', escondeTip);
      bodyEl.addEventListener('scroll', escondeTip, true);
      bodyEl.addEventListener('focusin', function (e) {
        const col = e.target.closest('.ger-col,[data-tip]');
        if (col) mostraTip(col);
      });
      bodyEl.addEventListener('focusout', escondeTip);
    }

    if (bodyEl) bodyEl.addEventListener('click', onClick);
    if (hintEl) hintEl.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="ir-mapa"]')) showMap();
    });
    SEG.forEach(function (pair) {
      const el = document.getElementById(pair[0]);
      if (el) el.addEventListener('click', function () { setRecorte(pair[1]); });
    });
    montaFiltros();
  }

  /* ---- Agendar (usado pelo pin sheet — SPEC 07 §2.1).
          Agendar já move o funil: o pin ENTRA em Visita planejada. ---- */
  function pedirAgendamento(pinId) {
    const p = S.getById(pinId);
    if (!p) return;
    const lista = D.TAREFA_TIPO_ORDER.map(function (k, i) {
      return (i + 1) + ') ' + D.TAREFA_TIPO[k].label;
    }).join('\n');
    const esc1 = window.prompt('Tipo da atividade:\n' + lista, '1');
    if (esc1 == null) return;
    const tipo = D.TAREFA_TIPO_ORDER[parseInt(esc1, 10) - 1];
    if (!tipo) return window.CRM_TOAST && window.CRM_TOAST('Tipo inválido.');

    const dt = window.prompt('Data (AAAA-MM-DD):', hoje());
    if (dt == null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) return window.CRM_TOAST && window.CRM_TOAST('Data inválida.');

    const notas = window.prompt('Notas (opcional):', '') || null;
    const t = S.agendarTarefa({ pinId: pinId, tipo: tipo, data: dt, notas: notas });
    if (!t) return window.CRM_TOAST && window.CRM_TOAST('Não foi possível agendar.');
    if (window.CRM_TOAST) window.CRM_TOAST('Agendada — o pin entrou no funil (Visita planejada).');
  }

  window.CRM_ATIV = {
    init: init,
    refresh: refresh,
    render: render,
    agendar: pedirAgendamento,
    concluir: pedirConclusao
  };
})();
