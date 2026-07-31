/* =====================================================================
   build-snapshot.mjs — Transform do snapshot de dado real (Fase 3)
   Lê o export do Metabase (salesforce.lead) e emite data-real.json no
   MESMO shape do pin do protótipo (js/data.js), aplicando:
     - minimização LGPD (remove CPF/CNPJ embutidos em nome/razão)
     - derivações: tipologia (CNAE), origem (escada), porte, status (funil)
   Contrato: docs/snapshot-dado-real.md
   Uso:  node tools/build-snapshot.mjs [entrada.json] [saida.json]
   Saída padrão: private/data-real.json  (fora do Git — ver .gitignore)
   ===================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const IN  = process.argv[2] || 'C:/Users/FS RENTAL/Downloads/Metabase/snapshot_leads_fase3.json';
const OUT = process.argv[3] || 'private/data-real.json';

// Corte do "mês corrente" p/ a régua de visitado (ancorado na data do snapshot).
const MONTH_CUTOFF = new Date('2026-07-01T00:00:00');

/* ---- CNAE → tipologia (só o código; descrição tem variações sujas) ---- */
const CNAE_TIPOLOGIA = {
  '5611201': 'restaurante', '5611202': 'cafeteria',
  '5611203': 'lanchonete',
  '5611204': 'bar', '5611205': 'bar',
  '5612100': 'lanchonete',                                   // ambulante ~ lanchonete
  '5620101': 'marmitaria', '5620102': 'marmitaria',          // fornecimento/bufê ~ marmitaria
  '5620103': 'marmitaria', '5620104': 'marmitaria', '8230002': 'marmitaria',
  '1091101': 'padaria', '1091102': 'padaria', '1092900': 'padaria', '4721102': 'padaria',
  '4721103': 'mercadinho', '4639701': 'mercadinho', '1052000': 'mercadinho',
  '4712100': 'mercadinho', '4724500': 'hortifruti', '4722901': 'acougue',
  '5510801': 'hotel', '5510802': 'hotel', '5510803': 'hotel',
  '1053800': 'sorveteria',
  '1094500': 'restaurante',                                  // massas
  '1096100': 'marmitaria', '1099699': 'outro'                // pratos prontos / outros
};
function cnaeToTipologia(cnae) {
  if (!cnae) return 'outro';
  return CNAE_TIPOLOGIA[String(cnae).trim()] || 'outro';
}

/* ---- Minimização: remove CPF/CNPJ/CEI (runs de ≥8 dígitos) do nome ---- */
function cleanName(s) {
  if (!s) return null;
  const out = String(s)
    .replace(/[\d][\d.\-/]{7,}[\d]/g, ' ')   // sequências longas de dígitos/pontuação
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s.,\-/]+|[\s.,\-/]+$/g, '')
    .trim();
  return out || null;
}

function formatCnpj(c) {
  if (!c) return null;
  const d = String(c).replace(/\D/g, '').padStart(14, '0');
  if (d.length !== 14) return String(c);
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
}

function buildAddress(r) {
  const line1 = [r.street, r.bairro_c].filter(Boolean).join(', ');
  const line2 = [r.city, r.state].filter(Boolean).join('/');
  return [line1, line2].filter(Boolean).join(' — ') || null;
}

/* ---- Coordenada -------------------------------------------------------
   `coord` devolve número FINITO ou null. String vazia virava `0` no `+v` de
   antes (pin no golfo da Guiné) e texto virava `NaN`, que passa pelo teste
   `!= null` do filtro final — pin sem lugar no mapa. Medido no snapshot atual:
   0 casos de sujeira, 0 coordenadas parciais, 0 pares (0,0), 0 fora de faixa.
   A guarda fica porque o snapshot é REGERADO: o dado limpo é o de hoje. ---- */
function coord(v) {
  if (v == null || v === '') return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
}
// Par completo e dentro da faixa, ou nada. Meia coordenada é pior que nenhuma:
// latitude verificada com longitude original põe o pin em lugar nenhum.
function par(lat, lng) {
  const a = coord(lat), b = coord(lng);
  if (a == null || b == null) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: a, lng: b };
}

/* ---- Derivações que espelham js/data.js ---- */

/* Porte: 6 faixas desde 29/07, uma por valor REAL de `porte_c` (conferidos no
   Metabase). O prefixo deixou de bastar — `me-ltda` e `me-ei-nao_mei` são
   faixas distintas agora, e as duas começam com "me". */
const PORTE_SF = {
  'me-ei-mei':     'MEI',
  'me-ltda':       'ME',
  'me-ei-nao_mei': 'ME_EI',
  'epp-ltda':      'EPP',
  'epp-ei':        'EPP_EI',
  'demais':        'DEMAIS'
};
function derivePorte(p) {
  if (!p) return null;
  return PORTE_SF[p] || null;      // valor novo na coluna => nulo, nunca chute
}

/* Zona: passou a vir de `zona_guardioes_c` (29/07) — vocabulário FECHADO de 15.
   A coluna antiga (`zona_2_c`) tinha OUTRA taxonomia: só 5 dos 13 valores dela
   estão nestes 15, e ela é bem menos preenchida (82k nulos contra 33k). O que
   não estiver no vocabulário — inclusive os 7 residuais da base, tipo
   'CE Eusébio Guararapes' — vira "Sem Zona". Nunca inventa zona. */
const ZONAS_GUARDIOES = [
  'CE Guararapes', 'CE Grande Fortaleza', 'REC Zona Sul', 'PE Interior',
  'PE Litoral Sul', 'JP Sul', 'CE Maracanaú', 'RMR Norte', 'REC Zona Norte',
  'REC Zona Oeste', 'CE Caucaia - Parquelândia', 'CE Aldeota', 'PE Jaboatão',
  'PB João Pessoa Litoral', 'JP Oeste'
];
const SEM_ZONA = 'Sem Zona';
/* O input pode ser um export ANTIGO, tirado antes de 29/07: lá a coluna
   `zona_guardioes_c` não foi selecionada e só existe `zona_2_c`. Sem fallback, o
   transform devolve "Sem Zona" para os 6.914 — pior que o arquivo que ele
   substitui, e em SILÊNCIO. Com fallback, os valores de `zona_2_c` passam pelo
   MESMO vocabulário fechado: os 5 nomes que as duas taxonomias compartilham
   sobrevivem, o resto vira "Sem Zona". Nada é inventado — o porteiro continua
   sendo a lista dos 15 —, e `avisaZonaLegado` grita no fim da execução, porque
   dado velho aceito em silêncio é o que faz um número errado passar por certo.
   O conserto de verdade é rodar a query da §5 no Metabase. */
let zonaLegado = false;
function deriveZona(r) {
  let z = r.zona_guardioes_c;
  if (z === undefined && r.zona_2_c !== undefined) { zonaLegado = true; z = r.zona_2_c; }
  return ZONAS_GUARDIOES.includes(z) ? z : SEM_ZONA;
}
function deriveOrigem(r) {
  // validado_campo = correção humana do pin (coordenadas_corrigidas_c); NÃO a coord verificada
  // automática (essa alimenta só o geoVerificado de exibição).
  const fieldValidated = r.coordenadas_corrigidas_c === true || r.coordenadas_corrigidas_c === 1;
  const hasGoogle = r.localizacao_verificada_google_c === true || r.localizacao_verificada_google_c === 1
                 || (r.gmaps_status_c != null && r.gmaps_status_c !== '');
  // 3 degraus ADITIVOS desde 29/07: todo ponto vem da base de CNPJ, o Google
  // enriquece, o campo confirma. `hasCnpj` e o match saíram da conta porque a
  // categoria "só Google" deixou de existir (docs/objetos/estabelecimento.md §5).
  if (fieldValidated) return 'validado_campo';
  if (hasGoogle) return 'google';
  return 'cnpj';
}
function deriveStatus(r) {
  if (r.status === 'Cadastrado') return 'convertido';
  const lv = r.data_ultima_visita_lead_c ? new Date(r.data_ultima_visita_lead_c) : null;
  if (lv && !isNaN(lv) && lv >= MONTH_CUTOFF) return 'visitado';
  return 'nao_visitado';   // sem visita OU visita antes do mês (inclui Perdido, New, contatos…)
}

/* ---- Pipeline ---- */
const rows = JSON.parse(readFileSync(IN, 'utf8'));
const src = Array.isArray(rows) ? rows : (rows.data || rows.rows || []);

const stats = { tip: {}, status: {}, origin: {}, porte: {}, cleaned: 0, geoVerif: 0,
                geoUsadaVerif: 0, geoSoVerif: 0, semGeo: 0, semTipologia: 0 };
const cnpjSeen = new Map();

const pins = src.map((r, i) => {
  const cnae = r.cnae_principal_c ? String(r.cnae_principal_c).trim() : null;
  const typology = cnaeToTipologia(cnae);
  const origin = deriveOrigem(r);
  const status = deriveStatus(r);
  const porte = derivePorte(r.porte_c);
  const rawName = r.nome_fantasia ?? r.name ?? null;
  const name = cleanName(rawName);
  if (name !== rawName) stats.cleaned++;
  /* ONDE O PIN FICA (30/07): a coordenada VERIFICADA manda; a original é o
     fallback. `latitude_verificada_lead_c` é o endereço que o Google achou
     (fluxo 3 do n8n); a `latitude` crua do Salesforce é, em boa parte da base,
     o CENTROIDE do bairro ou da cidade — e é essa a raiz de check-in
     classificado como remoto ([[fluxos-n8n-salesforce]] §3).
     Medido nos 6.914: 2.110 têm verificada, e TODAS as 2.110 mudam de lugar —
     mediana de 2,5 km de deslocamento, 1.404 acima dos 500 m do raio
     presencial. Não é ajuste fino: é o pin saindo do centro do bairro e indo
     para a porta do estabelecimento. */
  const geoVerif = par(r.latitude_verificada_lead_c, r.longitude_verificada_lead_c);
  const geoOrig  = par(r.latitude, r.longitude);
  const geo = geoVerif || geoOrig;
  if (geoVerif) stats.geoVerif++;
  if (geoVerif && geoOrig) stats.geoUsadaVerif++;      // trocou de lugar
  if (geoVerif && !geoOrig) stats.geoSoVerif++;        // só existe por causa dela
  if (!geo) stats.semGeo++;
  if (typology === 'outro') stats.semTipologia++;

  stats.tip[typology] = (stats.tip[typology] || 0) + 1;
  stats.status[status] = (stats.status[status] || 0) + 1;
  stats.origin[origin] = (stats.origin[origin] || 0) + 1;
  stats.porte[porte] = (stats.porte[porte] || 0) + 1;
  if (r.cnpj_c) cnpjSeen.set(r.cnpj_c, (cnpjSeen.get(r.cnpj_c) || 0) + 1);

  return {
    id: r.id,
    name,
    razaoSocial: cleanName(r.razao_social_c),
    cnpj: formatCnpj(r.cnpj_c),
    cnaeCodigo: cnae,
    cnaeDescricao: r.atividade_cnae_principal_c || null,
    typology,
    address: buildAddress(r),
    lat: geo ? geo.lat : null,
    lng: geo ? geo.lng : null,
    // A auditoria continua separada: `geoVerificado` diz que a coordenada FOI
    // verificada, e é ela que o sheet mostra como tal. Guardar só o resultado
    // do coalesce apagaria a diferença entre "verificada" e "original".
    geoVerificado: geoVerif,
    bairro: r.bairro_c || null,      // geografia; a ZONA é outra coisa (29/07)
    zone: deriveZona(r),             // zona_guardioes_c, vocabulário fechado
    origin,
    status,
    motivoStatus: r.motivo_perda_c || r.motivo_desqualifica_o_c || null,
    qualidade: r.qualidade_c || null,
    porte,
    vendedor: r.vendedor_nome || null,
    lastVisit: r.data_ultima_visita_lead_c || null,
    // Relação comercial no vocabulário ATUAL (29/07). `cadastrado` é a COR do
    // pin, então emitir só o `isConverted` antigo obrigava o cliente a
    // reconstruir na carga. `dataPrimeiraCompra` fica nulo de propósito: o
    // salesforce.lead não tem fonte de PEDIDO, e é por isso que todo convertido
    // para em CSC. `statusCliente` é derivado — não vai no arquivo.
    cadastrado: status === 'convertido',
    dataCadastro: status === 'convertido' ? (r.data_ultima_visita_lead_c || null) : null,
    dataPrimeiraCompra: null,
    convertedAt: status === 'convertido' ? (r.data_ultima_visita_lead_c || null) : null,
    contaId: null,
    phone: null,                 // dropado (minimização)
    isConverted: status === 'convertido',
    notes: [],
    checkins: [],
    createdByUser: false
  };
}).filter(p => p.lat != null && p.lng != null);   // pin exige coordenada

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(pins, null, 0), 'utf8');

const dupCnpj = [...cnpjSeen.values()].filter(n => n > 1).length;
console.log(`OK — ${pins.length} pins escritos em ${OUT}`);
console.log(`nomes higienizados (CPF/CNPJ removido): ${stats.cleaned}`);
console.log(`com geoVerificado: ${stats.geoVerif} | sem tipologia (outro): ${stats.semTipologia} | CNPJs duplicados: ${dupCnpj}`);
// A coordenada exibida vem da verificada quando existe — quantos pins isso move
// é o número que importa para presencial × remoto, então ele é dito, não deduzido.
console.log(`pin posicionado pela coordenada VERIFICADA: ${stats.geoUsadaVerif} (+${stats.geoSoVerif} que só têm ela) | descartados sem coordenada: ${stats.semGeo}`);
console.log('tipologia:', JSON.stringify(stats.tip));
console.log('status  :', JSON.stringify(stats.status));
console.log('origem  :', JSON.stringify(stats.origin));
console.log('porte   :', JSON.stringify(stats.porte));

// Contagem de zona SEMPRE visível: é a dimensão que já passou 75% em branco sem
// ninguém notar (docs/snapshot-dado-real.md §3).
const semZona = pins.filter(p => p.zone === SEM_ZONA).length;
console.log(`zona    : ${pins.length - semZona} com zona | ${semZona} em "${SEM_ZONA}"`);
if (zonaLegado) {
  console.warn(`\n⚠️  ENTRADA ANTIGA: o export não tem \`zona_guardioes_c\` — a zona saiu de \`zona_2_c\`.`);
  console.warn(`   As taxonomias são diferentes: só os 5 nomes em comum sobrevivem, o resto virou "${SEM_ZONA}".`);
  console.warn(`   Para corrigir de verdade, rode a query da §5 de docs/snapshot-dado-real.md no Metabase.`);
}
