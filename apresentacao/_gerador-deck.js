/* Deck: Praso Maps — Protótipo do mapa · Apresentação às Supervisões Comerciais
   Paleta e linguagem visual vêm do próprio app (css/styles.css). */
const pptxgen = require('pptxgenjs');
const path = require('path');

const OUT = process.argv[2] || 'Praso-Maps-Prototipo-Supervisao.pptx';
const QR = path.join(__dirname, 'qr.png');   // gerado antes por qrcode (CLI)

const W = 13.333, H = 7.5, M = 0.62;
const C = {
  brand: '2053CE', brand600: '1A44A8', ice: 'E8EFFC', iceDim: 'A9BEE8',
  ink: '0F172A', navy: '16234A', ink2: '334155', muted: '64748B', muted2: '94A3B8',
  line: 'E2E8F0', card: 'F5F7FB', white: 'FFFFFF',
  lilac: 'A78BFA', gold: 'C9971B', amber: 'B45309', teal: '0F766E'
};
const F = { h: 'Calibri', b: 'Calibri' };
const sh = (o = {}) => Object.assign({ type: 'outer', color: '0F172A', blur: 10, offset: 2, angle: 90, opacity: 0.10 }, o);

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Tatiana Aires — RevOps / Planejamento, Praso';
pptx.company = 'Praso';
pptx.title = 'Praso Maps — Protótipo do mapa (apresentação às supervisões comerciais)';

/* ---------- helpers ---------- */
function slideLight() {
  const s = pptx.addSlide();
  s.background = { color: C.white };
  return s;
}
function slideDark() {
  const s = pptx.addSlide();
  s.background = { color: C.ink };
  return s;
}
function kicker(s, text, x, y, color) {
  s.addText(text.toUpperCase(), {
    x, y, w: W - x - M, h: 0.26, margin: 0,
    fontFace: F.b, fontSize: 11, bold: true, charSpacing: 1.6,
    color: color || C.brand, valign: 'middle'
  });
}
function title(s, text, x, y, opts = {}) {
  s.addText(text, {
    x, y, w: opts.w || (W - x - M), h: opts.h || 0.72, margin: 0,
    fontFace: F.h, fontSize: opts.size || 36, bold: true,
    color: opts.color || C.ink, valign: 'middle', lineSpacing: opts.lineSpacing
  });
}
function card(s, x, y, w, h, opts = {}) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: opts.r || 0.10,
    fill: { color: opts.fill || C.card },
    line: opts.line === null ? { type: 'none' } : { color: opts.line || C.line, width: 1 },
    shadow: opts.shadow === false ? undefined : sh(opts.shadowOpts)
  });
}
function chip(s, text, x, y, w, opts = {}) {
  const h = opts.h || 0.34;
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.5,
    fill: { color: opts.fill || C.ice },
    line: opts.line ? { color: opts.line, width: 1 } : { type: 'none' }
  });
  s.addText(text, {
    x, y, w, h, margin: 0, align: 'center', valign: 'middle',
    fontFace: F.b, fontSize: opts.size || 11.5, bold: true, color: opts.color || C.brand
  });
}
function numCircle(s, n, x, y, d, opts = {}) {
  s.addShape(pptx.ShapeType.ellipse, {
    x, y, w: d, h: d, fill: { color: opts.fill || C.brand }, line: { type: 'none' }
  });
  s.addText(String(n), {
    x, y, w: d, h: d, margin: 0, align: 'center', valign: 'middle',
    fontFace: F.b, fontSize: opts.size || 14, bold: true, color: opts.color || C.white
  });
}
function iconCircle(s, emoji, x, y, d, fill) {
  s.addShape(pptx.ShapeType.ellipse, {
    x, y, w: d, h: d, fill: { color: fill || C.ice }, line: { type: 'none' }
  });
  s.addText(emoji, {
    x, y, w: d, h: d, margin: 0, align: 'center', valign: 'middle', fontSize: d * 22
  });
}
function body(s, text, x, y, w, h, opts = {}) {
  s.addText(text, {
    x, y, w, h, margin: 0, valign: opts.valign || 'top',
    fontFace: F.b, fontSize: opts.size || 13, color: opts.color || C.ink2,
    lineSpacing: opts.lineSpacing || (opts.size ? opts.size * 1.32 : 17), bold: opts.bold, italic: opts.italic,
    align: opts.align
  });
}
function bullets(s, items, x, y, w, h, opts = {}) {
  const size = opts.size || 13;
  s.addText(items.map((t, i) => ({
    text: t,
    options: { bullet: { code: '2022' }, breakLine: i < items.length - 1, paraSpaceAfter: opts.gap === undefined ? 7 : opts.gap }
  })), {
    x, y, w, h, margin: 0, valign: 'top',
    fontFace: F.b, fontSize: size, color: opts.color || C.ink2, lineSpacing: size * 1.28, indentLevel: 0
  });
}
function pageNum(s, n, dark) {
  s.addText(`${n}`, {
    x: W - M - 0.5, y: H - 0.52, w: 0.5, h: 0.3, margin: 0, align: 'right',
    fontFace: F.b, fontSize: 10, color: dark ? '46577C' : C.muted2
  });
}
function footNote(s, text, y, dark) {
  s.addText(text, {
    x: M, y, w: W - 2 * M - 0.7, h: 0.34, margin: 0, valign: 'middle',
    fontFace: F.b, fontSize: 11.5, italic: true, color: dark ? C.iceDim : C.muted
  });
}

/* ============================================================ */
let n = 0;
const NAV = ['🗺️ Mapa', '📋 Inteligência', '📊 Funil', '🗓️ Atividades'];

/* ---------- 1 · Capa ---------- */
{
  const s = slideDark(); n++;
  // marca
  s.addShape(pptx.ShapeType.roundRect, { x: M, y: 1.05, w: 0.62, h: 0.62, rectRadius: 0.18, fill: { color: C.brand }, line: { type: 'none' } });
  s.addText('◈', { x: M, y: 1.05, w: 0.62, h: 0.62, margin: 0, align: 'center', valign: 'middle', fontFace: F.b, fontSize: 26, color: C.white });

  s.addText('Praso Maps', { x: M, y: 1.95, w: 7.6, h: 1.0, margin: 0, fontFace: F.h, fontSize: 58, bold: true, color: C.white, valign: 'middle' });
  s.addText('Protótipo do mapa · CRM Externo', { x: M, y: 2.95, w: 7.6, h: 0.42, margin: 0, fontFace: F.b, fontSize: 21, color: C.iceDim, valign: 'middle' });
  s.addText('Uma plataforma de gestão comercial de campo — com o mapa no centro.', { x: M, y: 3.45, w: 7.4, h: 0.4, margin: 0, fontFace: F.b, fontSize: 14.5, color: '8FA6D6', valign: 'middle' });

  let cx = M;
  const cw = [1.42, 2.02, 1.32, 1.85];
  NAV.forEach((t, i) => { chip(s, t, cx, 4.15, cw[i], { fill: '1E2C55', color: C.iceDim, size: 11.5 }); cx += cw[i] + 0.14; });

  s.addText('Apresentação às Supervisões Comerciais', { x: M, y: 5.62, w: 7.4, h: 0.36, margin: 0, fontFace: F.b, fontSize: 16, bold: true, color: C.white, valign: 'middle' });
  s.addText('Tatiana Aires · RevOps / Planejamento · 29 de julho de 2026 · KR 1.5, fim da Fase 2', { x: M, y: 5.99, w: 7.6, h: 0.34, margin: 0, fontFace: F.b, fontSize: 12.5, color: '8FA6D6', valign: 'middle' });

  // "celular" ilustrativo
  const px = 9.35, py = 1.05, pw = 3.05, ph = 5.4;
  s.addShape(pptx.ShapeType.roundRect, { x: px, y: py, w: pw, h: ph, rectRadius: 0.09, fill: { color: '1E2C55' }, line: { color: '32447A', width: 1.5 } });
  s.addShape(pptx.ShapeType.roundRect, { x: px + 0.14, y: py + 0.2, w: pw - 0.28, h: ph - 0.4, rectRadius: 0.06, fill: { color: 'E9EDF3' }, line: { type: 'none' } });
  // topbar do app
  s.addShape(pptx.ShapeType.rect, { x: px + 0.14, y: py + 0.2, w: pw - 0.28, h: 0.42, fill: { color: C.white }, line: { type: 'none' } });
  s.addText('◈  CRM Externo', { x: px + 0.26, y: py + 0.2, w: 1.7, h: 0.42, margin: 0, fontFace: F.b, fontSize: 9, bold: true, color: C.ink, valign: 'middle' });
  s.addText('61 locais', { x: px + pw - 1.15, y: py + 0.2, w: 0.9, h: 0.42, margin: 0, align: 'right', fontFace: F.b, fontSize: 8, color: C.brand, valign: 'middle' });
  // quickbar
  chip(s, '🏆 Aquisição', px + 0.26, py + 0.72, 1.05, { fill: 'FBF1D8', color: '8A6A12', size: 7.5, h: 0.26 });
  chip(s, '🏷️ Classificação', px + 1.38, py + 0.72, 1.2, { fill: C.ice, color: C.brand, size: 7.5, h: 0.26 });
  // pins
  const pins = [[0.55, 1.55, C.brand, false], [1.35, 1.25, C.lilac, true], [2.15, 1.75, C.lilac, false], [0.95, 2.35, C.brand, false], [1.95, 2.75, C.lilac, true], [2.45, 2.2, C.brand, false], [0.6, 3.15, C.lilac, false], [1.55, 3.6, C.brand, false], [2.3, 3.35, C.lilac, false]];
  pins.forEach(([dx, dy, col, dash]) => {
    s.addShape(pptx.ShapeType.ellipse, {
      x: px + dx, y: py + dy, w: 0.26, h: 0.26,
      fill: { color: col }, line: { color: C.white, width: dash ? 1 : 2, dashType: dash ? 'dash' : 'solid' }, shadow: sh({ blur: 5, offset: 1, opacity: 0.25 })
    });
    s.addShape(pptx.ShapeType.ellipse, { x: px + dx + 0.093, y: py + dy + 0.093, w: 0.075, h: 0.075, fill: { color: C.white }, line: { type: 'none' } });
  });
  // bottom nav
  s.addShape(pptx.ShapeType.rect, { x: px + 0.14, y: py + ph - 0.85, w: pw - 0.28, h: 0.45, fill: { color: C.white }, line: { type: 'none' } });
  s.addText('🗺️      📋      📊      🗓️', { x: px + 0.14, y: py + ph - 0.85, w: pw - 0.28, h: 0.45, margin: 0, align: 'center', valign: 'middle', fontSize: 11 });

  s.addNotes(`Abertura (1 min). "Praso Maps é o nome do produto; CRM Externo é o nome do projeto/repositório."
Enquadramento: hoje é o GATE do protótipo — fim da Fase 2 das 6 quinzenas do KR 1.5. O objetivo não é aprovar telas bonitas, é decidir se seguimos construindo o produto real.
Dizer de saída: o app já está instalável no celular e por padrão mostra DADO FICTÍCIO; com login @praso.com.br ele passa a mostrar os 6.914 leads reais do Salesforce (só exibição).`);
  pageNum(s, n, true);
}

/* ---------- 2 · O pedido + roteiro ---------- */
{
  const s = slideLight(); n++;
  kicker(s, 'Por que estamos aqui', M, 0.62);
  title(s, 'O que eu preciso de vocês hoje', M, 0.95);

  const items = [
    ['Sentir o produto na mão', 'Instalem no celular e usem durante a demo. Por padrão o app mostra dado fictício; com login @praso.com.br ele mostra o dado real do Salesforce.'],
    ['Dizer se resolve a dor de campo', 'Não quero impressão geral — quero resposta a quatro perguntas dirigidas, que estão no último slide.'],
    ['Dar o sinal verde formal', 'Aprovar seguir para a construção do produto real. Esta aprovação é a métrica de gate do KR 1.5.']
  ];
  let y = 2.02;
  items.forEach(([t, d], i) => {
    card(s, M, y, 7.55, 1.28);
    numCircle(s, i + 1, M + 0.32, y + 0.36, 0.55);
    s.addText(t, { x: M + 1.08, y: y + 0.2, w: 6.2, h: 0.34, margin: 0, fontFace: F.h, fontSize: 17, bold: true, color: C.ink, valign: 'middle' });
    body(s, d, M + 1.08, y + 0.58, 6.25, 0.6, { size: 12.5 });
    y += 1.44;
  });

  card(s, 8.55, 2.02, 4.16, 4.12, { fill: C.ink, line: null });
  s.addText('Roteiro', { x: 8.9, y: 2.28, w: 3.5, h: 0.36, margin: 0, fontFace: F.h, fontSize: 19, bold: true, color: C.white, valign: 'middle' });
  const rot = ['As dores atacadas', 'Pontos de valor (KR 1.5)', 'As perguntas do vendedor', 'O que vai ter e o que não', 'Demo ao vivo no celular'];
  let ry = 2.82;
  rot.forEach((t, i) => {
    numCircle(s, i + 1, 8.9, ry, 0.36, { fill: '1E2C55', color: C.iceDim, size: 11 });
    s.addText(t, { x: 9.4, y: ry - 0.02, w: 2.95, h: 0.4, margin: 0, fontFace: F.b, fontSize: 13, color: C.ice, valign: 'middle' });
    ry += 0.6;
  });
  s.addText('≈ 25 min de conversa + 12 min de demo', { x: 8.9, y: 5.72, w: 3.5, h: 0.3, margin: 0, fontFace: F.b, fontSize: 11, italic: true, color: '8FA6D6', valign: 'middle' });

  s.addNotes(`Deixar explícito o pedido antes de qualquer slide de conteúdo — supervisão precisa saber o que se espera dela no fim.
Se alguém perguntar "isso já é o produto?": não. É protótipo — casca. Tudo que vamos ver funciona, mas ainda em memória do navegador; persistência, login por carteira e automações entram com o banco (Fases 4 e 5).`);
  pageNum(s, n);
}

/* ---------- 3 · As dores ---------- */
{
  const s = slideLight(); n++;
  kicker(s, 'Levantado em rota, com vendedor, em PE e CE', M, 0.62);
  title(s, 'As quatro dores que o produto ataca', M, 0.95);

  const cw = 5.95, ch = 1.95, gx = 0.28, gy = 0.3;
  const x2 = M + cw + gx, y1 = 2.0, y2 = y1 + ch + gy;

  // card 1 — destaque escuro com o número
  card(s, M, y1, cw, ch, { fill: C.ink, line: null });
  s.addText('3–4', { x: M + 0.34, y: y1 + 0.28, w: 1.55, h: 0.85, margin: 0, fontFace: F.h, fontSize: 50, bold: true, color: C.white, valign: 'middle' });
  s.addText('de cada 10', { x: M + 0.34, y: y1 + 1.12, w: 1.6, h: 0.3, margin: 0, fontFace: F.b, fontSize: 11.5, bold: true, color: C.iceDim, valign: 'middle' });
  s.addText('Rota que cai em endereço vazio', { x: M + 2.1, y: y1 + 0.3, w: 3.5, h: 0.56, margin: 0, fontFace: F.h, fontSize: 16, bold: true, color: C.white, valign: 'middle' });
  body(s, 'Visitas planejadas pelo Salesforce caíam em endereço vazio, casa ou estabelecimento fechado em definitivo — as melhores rotas eram as feitas por fora, no Google Maps.', M + 2.1, y1 + 0.86, 3.5, 0.92, { size: 11.5, color: '9FB4DF' });

  const dores = [
    ['🔍', 'Pin por pin para achar padaria', 'Não existe filtro simples: para ver o tamanho real da oportunidade numa região é preciso empilhar camadas complementares.', x2, y1],
    ['🗒️', 'Organização por fora do sistema', 'Cada vendedor se organiza em agenda física ou grupo de WhatsApp. Ninguém sabe quem visitou o quê, nem o que está em negociação.', M, y2],
    ['👻', 'Informação que desaparece', 'A nota do pin fica escondida fora da camada ativa — e só se sabe se o estabelecimento já existe na base caçando pela razão social.', x2, y2]
  ];
  dores.forEach(([emo, t, d, x, y]) => {
    card(s, x, y, cw, ch);
    iconCircle(s, emo, x + 0.34, y + 0.32, 0.62);
    s.addText(t, { x: x + 1.12, y: y + 0.3, w: cw - 1.5, h: 0.4, margin: 0, fontFace: F.h, fontSize: 16, bold: true, color: C.ink, valign: 'middle' });
    body(s, d, x + 1.12, y + 0.78, cw - 1.5, 0.95, { size: 12.5 });
  });

  footNote(s, 'Fonte: rotas acompanhadas com vendedores de Pernambuco e Ceará na Fase 1 (jul/2026). O número é estimativa observada em campo, não métrica auditada.', 6.55);
  s.addNotes(`Contar a história da rota do Pedro: saiu frustrado de manhã porque NÃO fez a rota pelo Google. Deixar claro que o problema não é higiene de dado — a higienização do Salesforce foi feita (coordenada, foto, criação de pin pelo celular) e a plataforma continuou não atendendo. É limitação estrutural.
Se Luiz levantar qualidade do dado: é exatamente o risco nº1 e vamos falar dele no fim (slide de riscos).`);
  pageNum(s, n);
}

/* ---------- 4 · Falas ---------- */
{
  const s = slideDark(); n++;
  kicker(s, 'Discovery da Fase 1', M, 0.62, C.iceDim);
  title(s, 'Nas palavras de quem está na rua', M, 0.95, { color: C.white });

  const q = [
    ['“Muitos pinos estão fora do lugar ou apontam para residências, então acabo utilizando o Google Maps e o iFood para localizar os clientes e montar uma rota mais eficiente.”', 'Pedro', 'executivo externo · PE'],
    ['“Temos um volume gigante de dados e oportunidades, mas é extremamente difícil transformar isso em rotas eficientes sem recorrer ao Metabase ou ao Google Maps.”', 'Christian', 'supervisor externo · CE'],
    ['“Ficamos reféns das funcionalidades nativas: não conseguimos adicionar filtros ao mapa, nem atualizar a relação entre zona, vendedor e polígono de forma fácil.”', 'Planejamento', 'RevOps · Praso']
  ];
  const cw = 3.87, gx = 0.29;
  q.forEach(([txt, who, role], i) => {
    const x = M + i * (cw + gx);
    card(s, x, 2.05, cw, 3.35, { fill: '16234A', line: null, shadow: false });
    s.addText('”', { x: x + 0.3, y: 2.1, w: 0.7, h: 0.7, margin: 0, fontFace: F.h, fontSize: 54, bold: true, color: C.brand, valign: 'middle' });
    body(s, txt, x + 0.34, 2.78, cw - 0.68, 1.85, { size: 13, color: C.ice, lineSpacing: 18 });
    s.addText(who, { x: x + 0.34, y: 4.72, w: cw - 0.68, h: 0.28, margin: 0, fontFace: F.b, fontSize: 13, bold: true, color: C.white, valign: 'middle' });
    s.addText(role, { x: x + 0.34, y: 5.0, w: cw - 0.68, h: 0.26, margin: 0, fontFace: F.b, fontSize: 11, color: '8FA6D6', valign: 'middle' });
  });

  footNote(s, 'O padrão é o mesmo em campo e no planejamento: a ferramenta oficial não sustenta a decisão do dia, e a operação migra para fora dela.', 5.95, true);
  s.addNotes(`Ler no máximo uma citação em voz alta — as outras deixar para eles lerem. O ponto que quero que fique: a fuga para o Google Maps não é indisciplina, é sintoma.`);
  pageNum(s, n, true);
}

/* ---------- 5 · Dor → resposta ---------- */
{
  const s = slideLight(); n++;
  kicker(s, 'Dor → resposta do produto', M, 0.62);
  title(s, 'O que muda, dor por dor', M, 0.95);

  const rows = [
    ['Rota que cai em endereço vazio', 'Origem e confiança na cara do pin', 'A cor diz a relação comercial (azul = cliente, lilás = lead) e a pista de forma diz de onde vem o dado: tracejado = base de CNPJ · G = enriquecido pelo Google · ✓ = validado em campo. Quem ocupa o topo da escada é o vendedor.'],
    ['Pin por pin para achar padaria', 'Filtro simples e combinável, com atalhos no mapa', 'Oito dimensões (tipologia, zona, qualidade, porte, origem, fase, status do cliente, última visita) e três atalhos fixos. 🏆 Aquisição liga quatro filtros de uma vez e isola oportunidade real.'],
    ['Organização por fora do sistema', 'Funil, agenda e atividades dentro do app', 'A visita é uma tarefa datada: agendar, check-in, check-out com desfecho. E a fase do funil nunca é digitada — vem da tarefa concluída e do ERP.'],
    ['Informação que desaparece', 'Nota sempre visível e o pin que nunca some', 'As notas do estabelecimento não se escondem atrás de camada. Desqualificar é estado revisável, não exclusão — no protótipo não existe botão de excluir.']
  ];
  let y = 1.95;
  rows.forEach(([dor, resp, det]) => {
    card(s, M, y, W - 2 * M, 1.05, { shadow: false });
    s.addText(dor, { x: M + 0.3, y: y + 0.06, w: 3.05, h: 0.92, margin: 0, fontFace: F.b, fontSize: 13, bold: true, color: C.muted, valign: 'middle' });
    s.addText('→', { x: M + 3.42, y: y + 0.06, w: 0.4, h: 0.92, margin: 0, align: 'center', fontFace: F.b, fontSize: 18, bold: true, color: C.brand, valign: 'middle' });
    s.addText(resp, { x: M + 3.92, y: y + 0.14, w: 8.0, h: 0.32, margin: 0, fontFace: F.h, fontSize: 15, bold: true, color: C.brand, valign: 'middle' });
    body(s, det, M + 3.92, y + 0.48, 7.95, 0.52, { size: 11.5 });
    y += 1.19;
  });
  s.addNotes(`Este é o slide-âncora: se a supervisão só levar um slide na cabeça, que seja este. Cada linha da direita é demonstrável ao vivo — e a demo segue exatamente esta ordem.`);
  pageNum(s, n);
}

/* ---------- 6 · Pontos de valor ---------- */
{
  const s = slideLight(); n++;
  kicker(s, 'KR 1.5 · §2.1 — a ordem manda no corte', M, 0.62);
  title(s, 'Pontos de valor, por prioridade', M, 0.95);

  const rows = [
    ['Mapa funcional', 'E tudo que orbita a visita: rota, check-in/out, mover e corrigir pin, criar lead, notas e filtros.', 'De pé no protótipo', C.brand],
    ['Visão de Funil', 'Kanban por etapa para o vendedor planejar a semana com critério.', 'Casca de pé', C.brand],
    ['Visão de Inteligência', 'Lista buscável por nome, razão social ou CNPJ, com os mesmos filtros do mapa.', 'Casca de pé', C.brand],
    ['Visão gerencial de Tarefas', 'O plano ao lado da execução, por período, vendedor, tipo e check-in.', 'Casca de pé', C.brand],
    ['Performance do vendedor', 'Meta × realizado, produtividade, conversão por etapa e ranking.', 'Stretch — pode não entrar até 25/09', C.gold]
  ];
  let y = 1.78;
  rows.forEach(([t, d, badge, col], i) => {
    const last = i === 4;
    card(s, M, y, W - 2 * M, 0.82, { fill: last ? 'FDF8EA' : C.card, line: last ? 'EBD9A8' : C.line, shadow: false });
    numCircle(s, i + 1, M + 0.26, y + 0.18, 0.46, { fill: last ? C.gold : C.brand, size: 13 });
    s.addText(t, { x: M + 0.88, y: y + 0.04, w: 3.1, h: 0.74, margin: 0, fontFace: F.h, fontSize: 15.5, bold: true, color: C.ink, valign: 'middle' });
    body(s, d, M + 4.05, y + 0.04, 4.55, 0.74, { size: 12, valign: 'middle' });
    chip(s, badge, W - M - 3.05, y + 0.23, 2.8, { fill: last ? 'F6ECD2' : C.ice, color: last ? '7A5A0E' : C.brand600, size: 10.5, h: 0.36 });
    y += 0.9;
  });
  card(s, M, 6.42, W - 2 * M, 0.62, { fill: C.ink, line: null, shadow: false });
  s.addText([
    { text: 'Se faltar tempo até 25/09, corta-se de baixo para cima. ', options: { bold: true, color: C.white } },
    { text: 'Nada do topo é negociado para caber — e toda aba entra primeiro como casca (exibição) e ganha o motor (persistência e automação) depois do banco.', options: { color: C.iceDim } }
  ], { x: M + 0.3, y: 6.42, w: W - 2 * M - 0.6, h: 0.62, margin: 0, fontFace: F.b, fontSize: 12, valign: 'middle' });

  s.addNotes(`Esta ordem é decisão registrada no KR, não improviso. Pedir concordância explícita: "essa ordem de corte faz sentido para vocês?" — se a supervisão quiser Performance acima de Gerencial, é agora que eu preciso saber.
Explicar casca × motor com uma frase: "hoje você arrasta o card e ele fica onde você deixou; quando o banco subir, ele fica onde você deixou para todo mundo".`);
  pageNum(s, n);
}

/* ---------- 7 · Customer FAQ (1) ---------- */
{
  const s = slideLight(); n++;
  kicker(s, 'Customer FAQ · na voz do vendedor cético', M, 0.62);
  title(s, 'As perguntas que o Pedro vai fazer', M, 0.95);

  const qs = [
    ['Já me prometeram um sistema bom antes. Por que agora vai ser diferente?', 'A desconfiança é merecida. A diferença é método: o produto nasce das dores vistas em rota e chega em fatias — se uma fatia não resolver, isso aparece no piloto, antes de escalar.'],
    ['E se o cruzamento CNPJá × Google errar? Paro na porta errada de novo.', 'Vai errar às vezes. Por isso a incerteza aparece no pin em vez de se disfarçar de certeza — e o cruzamento passa por revisão manual no piloto antes de valer para todos.'],
    ['Por que eu largaria o Google Maps, que eu domino?', 'Você não larga para navegar: a rota abre no Google a partir do pin. O que o Google não sabe é qual ponto é lead, o que você anotou e quem está sem visita há 30 dias.'],
    ['Quanto tempo eu perco para aprender isso? Quero vender, não operar sistema.', 'Se precisar de treinamento longo, o produto falhou. Abrir o mapa da sua zona e filtrar padaria não tem manual — e a instalação é um link.']
  ];
  const cw = 5.95, ch = 2.08, gx = 0.28, gy = 0.28;
  qs.forEach(([q, a], i) => {
    const x = M + (i % 2) * (cw + gx), y = 1.95 + Math.floor(i / 2) * (ch + gy);
    card(s, x, y, cw, ch);
    s.addText('Q', { x: x + 0.3, y: y + 0.24, w: 0.3, h: 0.3, margin: 0, fontFace: F.h, fontSize: 15, bold: true, color: C.brand, valign: 'middle' });
    s.addText(q, { x: x + 0.66, y: y + 0.2, w: cw - 1.0, h: 0.62, margin: 0, fontFace: F.h, fontSize: 14, bold: true, color: C.ink, valign: 'top', lineSpacing: 18 });
    body(s, a, x + 0.66, y + 0.92, cw - 1.0, 1.0, { size: 12 });
  });
  footNote(s, 'As sete perguntas completas estão no PR-FAQ do Praso Maps (Notion · REVOPS).', 6.62);
  s.addNotes(`Não amaciar as respostas. A força do PR-FAQ é admitir o que é verdade: o matching VAI errar às vezes; adoção é o maior risco. Supervisão respeita mais isso do que promessa.
Se perguntarem sobre offline: o app precisa de internet no lançamento — trade-off aceito, medido no piloto (está no slide de riscos).`);
  pageNum(s, n);
}

/* ---------- 8 · Customer FAQ (2) ---------- */
{
  const s = slideLight(); n++;
  kicker(s, 'Customer FAQ · continuação', M, 0.62);
  title(s, '…e as três mais desconfortáveis', M, 0.95);

  const qs = [
    ['Isso vira ferramenta para me ajudar — ou arma de cobrança em cima de mim?', 'Sem enrolação: sim, seu check-in e sua cobertura ficam visíveis para a liderança, porque hoje a gestão cobra no escuro. O que muda são as travas — e elas estão escritas ao lado.'],
    ['Se a classificação ou o pin estiverem errados, eu corrijo na hora ou abro chamado?', 'Na hora. Você reclassifica a tipologia e arrasta o pin para o lugar certo — quem esteve lá é você. A régua é: quem vê, corrige.'],
    ['Um lead que eu desqualifiquei some para sempre? E se o cara reabrir o negócio?', 'Não some nunca. Desqualificar é status, não exclusão: o pin continua no mapa e volta ao jogo com o histórico inteiro — por você, pela liderança ou pelo inside sales.']
  ];
  let y = 1.95;
  qs.forEach(([q, a]) => {
    card(s, M, y, 7.55, 1.35);
    s.addText('Q', { x: M + 0.28, y: y + 0.2, w: 0.3, h: 0.3, margin: 0, fontFace: F.h, fontSize: 15, bold: true, color: C.brand, valign: 'middle' });
    s.addText(q, { x: M + 0.62, y: y + 0.18, w: 6.6, h: 0.36, margin: 0, fontFace: F.h, fontSize: 13.5, bold: true, color: C.ink, valign: 'middle' });
    body(s, a, M + 0.62, y + 0.6, 6.6, 0.66, { size: 12 });
    y += 1.51;
  });

  card(s, 8.55, 1.95, 4.16, 4.35, { fill: C.brand, line: null });
  s.addText('⚖️', { x: 8.9, y: 2.2, w: 0.5, h: 0.5, margin: 0, fontSize: 22, valign: 'middle' });
  s.addText('Princípio escrito do produto', { x: 8.9, y: 2.78, w: 3.5, h: 0.66, margin: 0, fontFace: F.h, fontSize: 19, bold: true, color: C.white, valign: 'top', lineSpacing: 24 });
  bullets(s, [
    'As notas de campo pertencem primeiro ao vendedor.',
    'O check-in por proximidade é prova a favor dele, não vigilância.',
    'O ranking se compara por zona, para não punir quem pega a área mais difícil.'
  ], 8.9, 3.62, 3.5, 1.9, { size: 12.5, color: 'DCE7FB', gap: 10 });
  s.addText('Recurso que violar isso não entra.', { x: 8.9, y: 5.65, w: 3.5, h: 0.4, margin: 0, fontFace: F.b, fontSize: 13, bold: true, italic: true, color: C.white, valign: 'middle' });

  s.addNotes(`A pergunta da "arma de cobrança" é a que decide adoção. Responder olhando para a supervisão: a visibilidade é objetivo do produto, e as travas são o que impedem que ela vire só painel de cobrança.
Estas travas viram requisito no PRD — não são boa intenção.`);
  pageNum(s, n);
}

/* ---------- 9 · Vai ter × não vai ter ---------- */
{
  const s = slideLight(); n++;
  kicker(s, 'Escopo do produto real · até 25/09/2026', M, 0.62);
  title(s, 'O que vai ter — e o que não vai ter', M, 0.95);

  const cw = 6.06, x2 = M + cw + 0.35;
  card(s, M, 1.9, cw, 4.35, { fill: 'F2F6FF', line: 'D3E0FA' });
  s.addText('✅  Vai ter', { x: M + 0.32, y: 2.08, w: cw - 0.64, h: 0.4, margin: 0, fontFace: F.h, fontSize: 19, bold: true, color: C.brand600, valign: 'middle' });
  bullets(s, [
    'Pins de CNPJá e Google mesclados, com origem e confiança visíveis',
    'Filtro simples combinável + atalhos fixos no mapa',
    'Pin com ficha, notas sempre visíveis e histórico de interações',
    'Criar e corrigir pin com log de quem mudou, quando e de onde para onde',
    'Check-in/out com validação por proximidade e fotos (fachada, cardápio)',
    'Funil (kanban + lista) e agenda de planejamento semanal',
    'Visão gerencial: o plano ao lado da execução, por vendedor e período',
    'Rota do dia simples: paradas, reordenar à mão e abrir no Google Maps',
    'Banco próprio com acesso por carteira (RLS) e automações via n8n'
  ], M + 0.32, 2.56, cw - 0.64, 3.55, { size: 12, color: C.ink2, gap: 8 });

  card(s, x2, 1.9, cw, 4.35, { fill: C.card, line: C.line });
  s.addText('⛔  Não vai ter nesta KR', { x: x2 + 0.32, y: 2.08, w: cw - 0.64, h: 0.4, margin: 0, fontFace: F.h, fontSize: 19, bold: true, color: C.ink2, valign: 'middle' });
  bullets(s, [
    'Otimização e sequenciamento automático de rota — só rota simples e manual',
    'Camadas e polígonos de território: heatmap e cobertura por zona',
    'Painel de Admin (usuários por tela, campos sem código) — adiado para depois da KR',
    'Performance do vendedor: meta × realizado e ranking — stretch, pode não entrar',
    'Modo offline: o app precisa de internet — trade-off aceito, medido no piloto',
    'Score de crédito e probabilidade de conversão',
    'Revisão em lote dos desqualificados (fila de reenriquecimento)'
  ], x2 + 0.32, 2.56, cw - 0.64, 3.55, { size: 12, color: C.muted, gap: 11 });

  card(s, M, 6.42, W - 2 * M, 0.62, { fill: C.ink, line: null, shadow: false });
  s.addText([
    { text: 'Nada da coluna da direita é “nunca” — é “não nesta KR”. ', options: { bold: true, color: C.white } },
    { text: 'O que fica de fora entra no backlog priorizado do relatório de piloto (25/09).', options: { color: C.iceDim } }
  ], { x: M + 0.3, y: 6.42, w: W - 2 * M - 0.6, h: 0.62, margin: 0, fontFace: F.b, fontSize: 12, valign: 'middle' });

  s.addNotes(`Slide de expectativa — é aqui que se evita frustração em setembro. Ler em voz alta os dois itens que mais costumam ser pedidos: otimização de rota e Performance do vendedor.
Sobre rota: a decisão consciente é handoff para o Google (navegação é dele); nós decidimos PARA ONDE ir, ele leva.
Sobre Admin: adiado pós-KR; RLS/papéis seguem no banco como segurança, o que falta é a tela de configuração.`);
  pageNum(s, n);
}

/* ---------- 10 · O que já está de pé ---------- */
{
  const s = slideLight(); n++;
  kicker(s, 'Fim da Fase 2 · o que a demo vai mostrar', M, 0.62);
  title(s, 'O que já está de pé — hoje, no protótipo', M, 0.95);

  const feats = [
    ['🗺️', 'Mapa real, com cluster', '61 pins fictícios em Recife, Fortaleza e João Pessoa — e 6.914 leads reais do Salesforce quando há login.'],
    ['🏆', 'Filtro e atalhos', 'Oito dimensões combináveis, três atalhos no mapa e o preset Aquisição, que isola 29 dos 61 pins.'],
    ['📌', 'O pin completo', 'Ficha, notas sempre visíveis, check-in/out com desfecho, mover pin e criar lead na rua.'],
    ['📊', 'Funil kanban', 'Sete colunas, arrastar card entre etapas e duas saídas laterais: perdido e desqualificado.'],
    ['📋', 'Inteligência', 'Busca por nome, razão social ou CNPJ, sobre o mesmo conjunto filtrado do mapa.'],
    ['🗓️', 'Atividades', 'Agenda do vendedor com atrasadas no topo, e visão gerencial com gráficos e tabela detalhada.']
  ];
  const cw = 3.92, ch = 1.86, gx = 0.28, gy = 0.28;
  feats.forEach(([emo, t, d], i) => {
    const x = M + (i % 3) * (cw + gx), y = 1.9 + Math.floor(i / 3) * (ch + gy);
    card(s, x, y, cw, ch);
    iconCircle(s, emo, x + 0.28, y + 0.26, 0.52);
    s.addText(t, { x: x + 0.92, y: y + 0.26, w: cw - 1.2, h: 0.52, margin: 0, fontFace: F.h, fontSize: 14.5, bold: true, color: C.ink, valign: 'middle' });
    body(s, d, x + 0.28, y + 0.9, cw - 0.56, 0.86, { size: 11.5 });
  });

  card(s, M, 6.05, W - 2 * M, 0.95, { fill: 'FDF8EA', line: 'EBD9A8', shadow: false });
  s.addText([
    { text: '⚠️  Casca × motor.  ', options: { bold: true, color: '7A5A0E' } },
    { text: 'Tudo isso já se vê e se opera, mas o estado vive na memória do navegador — o app é protótipo, não produto. Persistência real, login por carteira (RLS), proximidade de GPS, fotos e automações entram com o banco, nas Fases 4 e 5. No modo real, as atividades são simuladas: nenhuma visita aconteceu (o próprio app avisa em faixa âmbar).', options: { color: '6B5310' } }
  ], { x: M + 0.32, y: 6.05, w: W - 2 * M - 0.64, h: 0.95, margin: 0, fontFace: F.b, fontSize: 11.5, valign: 'middle', lineSpacing: 15 });

  s.addNotes(`Este slide existe para a demo não ser confundida com produto pronto. Dizer a frase: "nada disso está gravado em banco ainda — é casca; o que estamos aprovando é a forma, não a persistência".`);
  pageNum(s, n);
}

/* ---------- 11 · Linha do tempo ---------- */
{
  const s = slideLight(); n++;
  kicker(s, 'KR 1.5 · uma fatia funcional por quinzena', M, 0.62);
  title(s, 'Como chegamos até 25 de setembro', M, 0.95);

  const fases = [
    ['Fase 1', '06–17/07', 'Discovery em campo, benchmarks e o protótipo do mapa', 'concluída'],
    ['Fase 2', '20–31/07', 'Gate + Lead, Tarefa, Funil, Inteligência e dado real (exibição)', 'agora'],
    ['Fase 3', '03–14/08', 'Check-in completo (proximidade e fotos) + decisão de banco', ''],
    ['Fase 4', '17–28/08', 'Banco de pé, rotas simples e a versão na mão de um vendedor', ''],
    ['Fase 5', '31/08–11/09', 'Motor de funil e tarefas, automações n8n e piloto PE/CE', ''],
    ['Fase 6', '14–25/09', 'Piloto de campo real (2º gate) e relatório com backlog', '']
  ];
  const cw = 1.93, gx = 0.14;
  fases.forEach(([f, d, t, st], i) => {
    const x = M + i * (cw + gx);
    const now = st === 'agora', done = st === 'concluída';
    card(s, x, 2.3, cw, 3.35, {
      fill: now ? C.ink : (done ? 'F2F6FF' : C.card),
      line: now ? null : (done ? 'D3E0FA' : C.line),
      shadow: now ? undefined : false
    });
    s.addText(f, { x: x + 0.18, y: 2.48, w: cw - 0.36, h: 0.3, margin: 0, fontFace: F.h, fontSize: 15, bold: true, color: now ? C.white : (done ? C.brand600 : C.ink), valign: 'middle' });
    s.addText(d, { x: x + 0.18, y: 2.78, w: cw - 0.36, h: 0.26, margin: 0, fontFace: F.b, fontSize: 10.5, bold: true, color: now ? C.iceDim : C.muted, valign: 'middle' });
    body(s, t, x + 0.18, 3.2, cw - 0.36, 1.7, { size: 11, color: now ? C.ice : C.ink2, lineSpacing: 14.5 });
    if (done) chip(s, '✓ concluída', x + 0.18, 5.12, cw - 0.36, { fill: C.ice, color: C.brand600, size: 9.5, h: 0.3 });
    if (now) chip(s, '● estamos aqui', x + 0.18, 5.12, cw - 0.36, { fill: C.brand, color: C.white, size: 9.5, h: 0.3 });
  });

  footNote(s, 'A documentação é escrita junto com cada fatia, não depois — é o que impede o conhecimento de ficar preso numa cabeça só.', 6.18);
  card(s, M, 6.55, W - 2 * M, 0.55, { fill: C.card, line: C.line, shadow: false });
  s.addText([
    { text: 'Depois do gate de hoje: ', options: { bold: true, color: C.ink } },
    { text: 'Fase 3 fecha a decisão de banco · Fase 4 põe a versão na mão de um vendedor de verdade · Fase 6 é o segundo gate, com vocês, em campo.', options: { color: C.ink2 } }
  ], { x: M + 0.3, y: 6.55, w: W - 2 * M - 0.6, h: 0.55, margin: 0, fontFace: F.b, fontSize: 11.5, valign: 'middle' });

  s.addNotes(`Se a supervisão quiser mudar a ordem, a janela é a Fase 3 — depois do banco de pé, mexer em prioridade custa mais.
Pedir aqui o compromisso da Fase 4: um vendedor por zona (PE e CE) para usar de verdade, não para testar.`);
  pageNum(s, n);
}

/* ---------- 12 · AO VIVO ---------- */
{
  const s = slideDark(); n++;
  kicker(s, 'Parte interativa', M, 0.7, C.iceDim);
  s.addText('Agora, ao vivo', { x: M, y: 1.0, w: 7.6, h: 0.9, margin: 0, fontFace: F.h, fontSize: 46, bold: true, color: C.white, valign: 'middle' });
  s.addText('Cinco momentos, ~12 minutos — cada um mata uma das dores.', { x: M, y: 1.92, w: 7.6, h: 0.4, margin: 0, fontFace: F.b, fontSize: 15, color: C.iceDim, valign: 'middle' });

  const mom = [
    'O mapa e em quem confiar',
    'Dois toques para a rota da manhã',
    'O pin: ficha, notas e a visita',
    'Funil e Inteligência: um dado, três formas',
    'A visão da liderança — e desqualificar sem perder o pin'
  ];
  let y = 2.62;
  mom.forEach((t, i) => {
    card(s, M, y, 7.55, 0.68, { fill: '16234A', line: null, shadow: false });
    numCircle(s, i + 1, M + 0.22, y + 0.16, 0.36, { fill: C.brand, size: 12 });
    s.addText(t, { x: M + 0.72, y, w: 6.6, h: 0.68, margin: 0, fontFace: F.b, fontSize: 14.5, bold: true, color: C.white, valign: 'middle' });
    y += 0.78;
  });

  card(s, 8.75, 1.55, 3.98, 4.45, { fill: C.white, line: null });
  s.addImage({ path: QR, x: 9.62, y: 1.85, w: 2.25, h: 2.25 });
  s.addText('Abra no seu celular', { x: 8.95, y: 4.2, w: 3.58, h: 0.34, margin: 0, align: 'center', fontFace: F.h, fontSize: 15, bold: true, color: C.ink, valign: 'middle' });
  s.addText('tatianaaires-ship-it.github.io/\ncrm-externo-mapa', { x: 8.95, y: 4.56, w: 3.58, h: 0.62, margin: 0, align: 'center', fontFace: F.b, fontSize: 11.5, color: C.brand, valign: 'top', lineSpacing: 15 });
  s.addText('Instale como app: ⋮ → Adicionar à tela inicial', { x: 8.95, y: 5.3, w: 3.58, h: 0.5, margin: 0, align: 'center', fontFace: F.b, fontSize: 11, italic: true, color: C.muted, valign: 'middle' });
  s.addText('Sem login o app mostra dados fictícios. Com a conta @praso.com.br, ele passa a mostrar os 6.914 leads reais do Salesforce (só exibição).', { x: 8.75, y: 6.1, w: 3.98, h: 0.7, margin: 0, align: 'center', fontFace: F.b, fontSize: 10.5, color: '8FA6D6', valign: 'top', lineSpacing: 14 });

  s.addNotes(`ANTES DE COMEÇAR — checklist:
· Celular carregado, espelhado na tela, brilho alto, rotação travada em retrato.
· Abrir o app instalado (não o navegador) para mostrar que é PWA.
· Tocar em ⟲ (topo direito) para resetar o estado da demo e começar limpo.
· Decidir o modo: comece no FICTÍCIO (61 pins, tudo coerente) e deixe o dado real para o momento 5.
· Deixar este slide projetado enquanto eles instalam pelo QR (~1 min).

CUIDADOS no modo real (se abrir):
· Não abra o filtro de Zona — o snapshot em disco ainda foi gerado com a coluna antiga (zona_2_c) e joga 5.183 dos 6.914 pins em "Sem Zona".
· Os chips MEI e churn aparecem zerados de propósito: MEI está fora do recorte do snapshot e churn não tem fonte no salesforce.lead.
· As atividades do modo real são simuladas — o app avisa em faixa âmbar. Diga isso antes que alguém pergunte.`);
  pageNum(s, n, true);
}

/* ---------- 13–17 · cue cards da demo ---------- */
const demos = [
  {
    kick: 'Demo · momento 1',
    t: 'O mapa e em quem confiar',
    steps: [
      'Abrir o app instalado — o mapa abre no Brasil inteiro e navega até Recife.',
      'Aproximar: as bolhas de cluster quebram em pins individuais.',
      'Abrir a Legenda (canto inferior esquerdo): cor = relação comercial (azul cliente, lilás lead).',
      'Mostrar a pista de forma: tracejado = base de CNPJ · G = enriquecido pelo Google · ✓ = validado em campo.',
      'Ler a nota de procedência da legenda: no fictício ela é âmbar; no dado real, verde.'
    ],
    dor: 'Rota que cai em endereço vazio',
    dorTxt: 'O pin diz o quanto ele merece confiança antes de eu sair de casa — em dois códigos independentes, sem depender de cor para tudo.',
    frase: '“O pin não finge certeza: ele mostra de onde veio o dado — e quem confirma no topo da escada é o vendedor.”',
    notes: `Só a pista do degrau MAIS ALTO aparece: um pin com ✓ também tem CNPJ e Google. A escada é aditiva.
Corolário que a supervisão gosta: check-in troca a PISTA, nunca a cor. O pin só fica azul quando o ERP disser que virou cliente — vendedor não decide conversão.
Se perguntarem "por que a cor mudou de significado?": antes a cor era a origem; percebemos que o degrau de origem não pode depender de matiz (e a pergunta que se faz da calçada é "já é cliente?").`
  },
  {
    kick: 'Demo · momento 2',
    t: 'Dois toques para a rota da manhã',
    steps: [
      'Tocar em 🏆 Aquisição: liga quatro filtros de uma vez e sobram 29 dos 61 pins.',
      'Abrir o painel Filtros: os chips do preset aparecem marcados — a regra fica visível, não escondida.',
      'Tocar em 🏷️ Classificação → Padaria: o caso real "quero só padarias agora".',
      'Somar 📌 Não visitados 30+ e acompanhar o contador no topo.',
      'Mexer num chip do preset: o destaque dourado se apaga sozinho, porque o estado é derivado.'
    ],
    dor: 'Abrir pin por pin para achar padaria',
    dorTxt: 'É filtro, não camada empilhada: AND entre dimensões, OR dentro de cada uma. O mesmo conjunto filtrado alimenta o mapa, a Inteligência, o Funil e as Atividades.',
    frase: '“O preset não esconde a regra — ele marca os chips. Você vê que MEI ficou de fora e pode desfazer.”',
    notes: `O preset Aquisição = porte ≠ MEI · qualidade Ouro ou Prata · status do cliente lead/csc/churn · fora de perdido e desqualificado.
O badge de Filtros mostra 17, não 1: são 17 chips ativos de verdade (2 de qualidade + 3 de status do cliente + 6 de fase + 6 de porte). Contar 1 seria mentir sobre o que está aplicado.
Detalhe que vale contar: o pin criado na rua nasce sem porte (o porte chega via CNPJá) e estava escapando da lista de aquisição — entrou o chip "Sem porte". Regra que ficou: dimensão que aceita vazio precisa de balde com nome, senão o pin sai do recorte em silêncio.
Zona é vocabulário fechado: as 15 zonas da operação + Sem Zona, e os 16 chips aparecem sempre, mesmo vazios — vocês veem a lista inteira.`
  },
  {
    kick: 'Demo · momento 3',
    t: 'O pin: ficha, notas e a visita',
    steps: [
      'Tocar num pin: ficha com qualidade e porte — nenhum deles digitado, todos derivados.',
      'Mostrar as notas do estabelecimento: sempre visíveis, nenhuma camada as esconde.',
      '📍 Check-in em um toque — existe em todo pin, com plano ou sem.',
      'Check-out: desfecho, "Vendeu?", motivo de não venda e notas da visita.',
      'Histórico das 3 últimas atividades e "Ver todas". Depois: mover o pin (arrastar) → vira validado em campo.',
      'FAB ＋ → criar um lead novo com o mínimo: nome + local no mapa.'
    ],
    dor: 'Nota que desaparece e informação sem lugar para morar',
    dorTxt: 'A nota é invariante do produto: nenhum estado a esconde. E a visita não é um registro solto — o check-in é a própria tarefa sendo executada.',
    frase: '“Corrigir a posição do pin promove o ponto a validado em campo. Quem vê, corrige.”',
    notes: `Classificação nunca é digitada: qualidade vem do CNAE (tabela cnae_tier), porte vem do CNPJá, status do cliente é derivado. O formulário de criação pede só nome + local, com um "mais detalhes" opcional (tipologia, CNPJ, telefone).
Não existe botão de excluir — de propósito.
Se pedirem foto: fotos (fachada, cardápio, comprovação) e proximidade por GPS entram na Fase 3. Hoje o check-in não valida distância.`
  },
  {
    kick: 'Demo · momento 4',
    t: 'Funil e Inteligência: um dado, três formas',
    steps: [
      'Aba 📋 Intel.: buscar por nome, razão social ou CNPJ; tocar num lead foca e abre o pin no mapa.',
      'Mostrar que os filtros do mapa continuam valendo na lista — é o mesmo conjunto.',
      'Aba 📊 Funil: sete colunas, arrastar um card entre etapas.',
      'Explicar as duas saídas laterais: perdido e desqualificado — terminais, mas revisáveis.',
      'Dizer a regra: a fase nunca é digitada. Ela vem da tarefa concluída e do ERP.'
    ],
    dor: 'Falta visão de funil para planejar a semana',
    dorTxt: 'O vendedor passa a ver onde cada ponto está no trabalho, e a liderança passa a ver o pipeline sem pedir print no grupo.',
    frase: '“Conversão não é fato de campo: o vendedor não decide que alguém virou cliente — cadastro e pedido decidem.”',
    notes: `O Funil é o pipeline de TRABALHO, não a base: o pin entra no board quando ganha visita planejada e sai se o plano for cancelado. Por isso a contagem do Funil DIVERGE da do mapa — é o comportamento correto, não bug. Vale avisar antes que alguém aponte: no dataset fictício o mapa mostra 61 locais e o board mostra "48 no pipeline · 13 sem plano".
Etapas: sem plano (fora do board) ⇄ visita planejada → visitado → TD encontrado → CSC → aquisição, + perdido e desqualificado como saídas laterais.
Aquisição é sticky: depois dela, a saúde do cliente vive no status do cliente (lead, csc, recorrente, churn).`
  },
  {
    kick: 'Demo · momento 5',
    t: 'A visão da liderança — e desqualificar sem perder o pin',
    steps: [
      'Aba 🗓️ Atividades → Gerencial: funil de execução (planejadas → realizadas → TD encontrado).',
      'Resultado em barra empilhada, quebra por vendedor e pivô vendedor × tipo.',
      'Colunas por dia nos últimos 7 dias — o ritmo de campo do time.',
      'Tocar em qualquer número: ele filtra a tabela detalhada embaixo, ordenável por qualquer coluna.',
      'Agenda: atrasadas em bloco fixo no topo, fora do filtro de período; depois, agrupadas por dia.',
      'Concluir uma tarefa como desqualificado, com motivo → o pin segue visível no mapa.'
    ],
    dor: 'A gestão não vê nada e acaba cobrando no escuro',
    dorTxt: 'O plano ao lado da execução, por período, vendedor, tipo e check-in — com a lista detalhada atrás de cada agregado.',
    frase: '“O pin nunca some. Desqualificar é estado revisável, e voltar também exige tarefa — não é um toque solto.”',
    notes: `Fechar a demo aqui e, se houver tempo, mostrar o modo REAL: login @praso.com.br → 6.914 leads do Salesforce, 177 marcados como cadastrados. Só exibição, campos minimizados por LGPD (sem decisor, sócios ou telefone de pessoa física).
Cuidados do modo real: não abrir o filtro de Zona (snapshot gerado com a coluna antiga); MEI e churn zerados de propósito; as atividades são simuladas e o app avisa em faixa âmbar.
Perder ≠ desqualificar: mesma mecânica, dois vocabulários fechados de motivo. A negociação morreu × o ponto não é oportunidade. A diferença vive no motivo, e é o que permite reenriquecer depois.`
  }
];

demos.forEach((d, idx) => {
  const s = slideLight(); n++;
  kicker(s, d.kick, M, 0.62);
  title(s, d.t, M, 0.95, { size: 32 });

  card(s, M, 1.92, 7.55, 4.45);
  s.addText('O que eu mostro', { x: M + 0.34, y: 2.12, w: 6.9, h: 0.34, margin: 0, fontFace: F.h, fontSize: 15.5, bold: true, color: C.brand, valign: 'middle' });
  let y = 2.62;
  const step = d.steps.length > 5 ? 0.6 : 0.7;
  d.steps.forEach((t, i) => {
    numCircle(s, i + 1, M + 0.34, y + 0.04, 0.32, { fill: C.ice, color: C.brand600, size: 11 });
    body(s, t, M + 0.82, y, 6.4, step, { size: 12.5, valign: 'top' });
    y += step;
  });

  card(s, 8.55, 1.92, 4.16, 2.3, { fill: C.ink, line: null });
  s.addText('A dor que isso mata', { x: 8.87, y: 2.1, w: 3.55, h: 0.3, margin: 0, fontFace: F.b, fontSize: 10.5, bold: true, charSpacing: 1.2, color: C.iceDim, valign: 'middle' });
  s.addText(d.dor, { x: 8.87, y: 2.42, w: 3.55, h: 0.62, margin: 0, fontFace: F.h, fontSize: 15, bold: true, color: C.white, valign: 'top', lineSpacing: 19 });
  body(s, d.dorTxt, 8.87, 3.1, 3.55, 1.0, { size: 11.5, color: '9FB4DF', lineSpacing: 15 });

  card(s, 8.55, 4.4, 4.16, 1.97, { fill: 'F2F6FF', line: 'D3E0FA', shadow: false });
  s.addText('Frase-chave', { x: 8.87, y: 4.58, w: 3.55, h: 0.3, margin: 0, fontFace: F.b, fontSize: 10.5, bold: true, charSpacing: 1.2, color: C.brand600, valign: 'middle' });
  body(s, d.frase, 8.87, 4.92, 3.55, 1.3, { size: 12.5, italic: true, color: C.ink, lineSpacing: 17 });

  footNote(s, `Momento ${idx + 1} de 5 · o roteiro completo, com os cuidados, está nas notas deste slide.`, 6.6);
  s.addNotes(d.notes);
  pageNum(s, n);
});

/* ---------- 18 · Riscos ---------- */
{
  const s = slideLight(); n++;
  kicker(s, 'Honestidade do projeto', M, 0.62);
  title(s, 'O que ainda não está resolvido — e está nomeado', M, 0.95);

  const riscos = [
    ['⚠️', 'Matching CNPJá × Google é o risco nº 1', 'Se o cruzamento gerar falso positivo, o produto piora a desconfiança em vez de curar. Defesa dupla: mostrar a confiança na cara do pin e validar o matching com revisão manual no piloto — é gate de expansão, não detalhe.', true],
    ['📉', 'Adesão do vendedor', 'O hábito hoje é não confiar no sistema. Mitigação: a versão vai para a mão de um vendedor já na Fase 4, e o atrito que ele apontar é corrigido antes de espalhar.', false],
    ['🗄️', 'Banco operacional em aberto', 'Supabase próprio × warehouse do time de tech. Afeta RLS, PostGIS e velocidade de iteração. Gate na Fase 3: decidir antes de subir na Fase 4.', false],
    ['📶', 'Sem modo offline', 'O app precisa de internet no lançamento — trade-off aceito. Se a falta de sinal deixar o vendedor na mão no piloto, offline entra no roadmap com prioridade.', false]
  ];
  const cw = 6.06, ch = 1.98, gx = 0.35, gy = 0.28;
  riscos.forEach(([emo, t, d, hot], i) => {
    const x = M + (i % 2) * (cw + gx), y = 1.9 + Math.floor(i / 2) * (ch + gy);
    card(s, x, y, cw, ch, { fill: hot ? 'FDF4EC' : C.card, line: hot ? 'F0D6BC' : C.line });
    iconCircle(s, emo, x + 0.3, y + 0.28, 0.55, hot ? 'F7E4D3' : C.ice);
    s.addText(t, { x: x + 0.98, y: y + 0.26, w: cw - 1.3, h: 0.6, margin: 0, fontFace: F.h, fontSize: 15, bold: true, color: hot ? '8A4A16' : C.ink, valign: 'middle' });
    body(s, d, x + 0.3, y + 0.94, cw - 0.6, 0.95, { size: 11.5, color: hot ? '7A4A20' : C.ink2 });
  });

  card(s, M, 6.28, W - 2 * M, 0.75, { fill: C.ink, line: null, shadow: false });
  s.addText([
    { text: '🕒  E um prazo que não é nosso: ', options: { bold: true, color: C.white } },
    { text: 'o Salesforce sai em fev/2027 e leva com ele o geocoding (endereço → coordenada) e a regra de atribuição de zona. Nenhum substituto contratado — o plano é geocoding via API e atribuição por fluxo n8n sob nosso controle.', options: { color: C.iceDim } }
  ], { x: M + 0.32, y: 6.28, w: W - 2 * M - 0.64, h: 0.75, margin: 0, fontFace: F.b, fontSize: 11.5, valign: 'middle', lineSpacing: 15 });

  s.addNotes(`Colocar os riscos na mesa antes que a supervisão os encontre — é o que sustenta a credibilidade do resto.
Se Luiz puxar qualidade do dado: o critério de aceite do matching (qual taxa de falso positivo barra a expansão, quem revisa) é uma decisão que precisa fechar ANTES da Fase 3. Pedir a opinião dele ali mesmo.`);
  pageNum(s, n);
}

/* ---------- 19 · Fechamento ---------- */
{
  const s = slideDark(); n++;
  kicker(s, 'Fechamento', M, 0.7, C.iceDim);
  s.addText('O que eu levo daqui', { x: M, y: 1.0, w: 7.6, h: 0.85, margin: 0, fontFace: F.h, fontSize: 42, bold: true, color: C.white, valign: 'middle' });

  const asks = [
    ['Sinal verde formal', 'Aprovação de Planejamento e Supervisão para seguir na construção do produto real.'],
    ['Resposta às quatro perguntas', 'Ao lado — são elas que viram ajuste de escopo nas próximas fatias.'],
    ['Um vendedor por zona (PE e CE)', 'Para usar de verdade a partir da Fase 4, não para testar.']
  ];
  let y = 2.1;
  asks.forEach(([t, d], i) => {
    card(s, M, y, 6.5, 1.12, { fill: '16234A', line: null, shadow: false });
    numCircle(s, i + 1, M + 0.28, y + 0.32, 0.48, { fill: C.brand, size: 13 });
    s.addText(t, { x: M + 0.94, y: y + 0.16, w: 5.3, h: 0.34, margin: 0, fontFace: F.h, fontSize: 16, bold: true, color: C.white, valign: 'middle' });
    body(s, d, M + 0.94, y + 0.52, 5.3, 0.5, { size: 11.5, color: '9FB4DF' });
    y += 1.24;
  });

  card(s, 7.55, 2.1, 5.16, 3.5, { fill: C.brand, line: null });
  s.addText('As quatro perguntas', { x: 7.9, y: 2.3, w: 4.5, h: 0.4, margin: 0, fontFace: F.h, fontSize: 19, bold: true, color: C.white, valign: 'middle' });
  bullets(s, [
    'O filtro resolve o “quero só padarias agora” do jeito que vocês pediriam?',
    'A escada de origem (tracejado · G · ✓) diz o que vocês precisam saber antes de mandar o time para a rua?',
    'Falta alguma coluna na visão gerencial para vocês pararem de pedir print no grupo?',
    'Se faltar tempo até 25/09, vocês cortariam de baixo para cima como está no slide de prioridade?'
  ], 7.9, 2.82, 4.5, 2.6, { size: 12.5, color: 'DCE7FB', gap: 11 });

  s.addImage({ path: QR, x: M, y: 5.95, w: 0.95, h: 0.95 });
  s.addText('tatianaaires-ship-it.github.io/crm-externo-mapa', { x: M + 1.15, y: 6.05, w: 5.4, h: 0.32, margin: 0, fontFace: F.b, fontSize: 12.5, bold: true, color: C.white, valign: 'middle' });
  s.addText('Instalável no Android · dado fictício por padrão · dado real com conta @praso.com.br', { x: M + 1.15, y: 6.38, w: 5.6, h: 0.42, margin: 0, fontFace: F.b, fontSize: 11, color: '8FA6D6', valign: 'top', lineSpacing: 14 });
  s.addText('Documentação: Levantamento de Necessidades · Product Brief · PR-FAQ · SPEC · Modelo de dados  (Notion · REVOPS)', { x: 7.55, y: 5.95, w: 5.16, h: 0.85, margin: 0, fontFace: F.b, fontSize: 10.5, italic: true, color: '8FA6D6', valign: 'top', lineSpacing: 14 });

  s.addNotes(`Não terminar em "obrigada" — terminar pedindo a decisão. Se não houver decisão na sala, marcar data: o gate é a métrica de sucesso da Fase 2 e ele trava a Fase 3.
Se a resposta for "sim, mas": anotar o "mas" como item de backlog com dono e fase, na frente deles.`);
  pageNum(s, n, true);
}

/* ---------- write ---------- */
pptx.writeFile({ fileName: OUT }).then(f => console.log('OK:', f, '·', n, 'slides'));
