---
title: "SPEC 01 — Mapa (CRM Externo / Praso Maps)"
tipo: design-spec
herda: "spec-00-design-system"
fase: "Protótipo do Mapa (Fase 1–2)"
status: em-revisao
fonte_de_verdade: "index.html + js/map.js + js/filters.js (o doc espelha o código)"
sources:
  - "js/map.js — Leaflet, markers, legenda, geolocalização"
  - "js/filters.js — filtro combinável + quick filters"
  - "index.html — estrutura da tela"
  - "_bmad-output/specs/spec-crm-externo/SPEC.md — CAP-1,2,4,5,6,8; constraints"
related:
  - "[[spec-00-design-system]]"
  - "[[estabelecimento]]"
  - "[[spec-02-pin-sheet]]"
  - "[[spec-03-filtros]]"
  - "[[spec-04-criar]]"
  - "[[spec-05-intel]]"
---

# SPEC 01 — Mapa

> 🎯 **Objetivo.** A tela principal: o mapa com os pins. **Herda o [[spec-00-design-system]]** — tokens, shell, componentes não são repetidos aqui; esta spec cobre só o que é próprio do Mapa.

**Capabilities cobertas:** CAP-1 (distinguir origem visualmente) · CAP-2 (filtro rápido e combinável) · CAP-4 (criar pin — fluxo em [[spec-04-criar]]) · CAP-5 (mover pin) · CAP-8 (minha localização). *CAP-3 (abrir pin) → [[spec-02-pin-sheet]]; CAP-6 (check-in) → SPEC 02; CAP-10 (lista) → [[spec-05-intel]].*

## 1. Layout

Aplica o shell do SPEC 00 §5: **topbar → quickbar → mapa (tela cheia) → bottom nav**, com FABs e legenda flutuando sobre o mapa. Ver ASCII e pilha de z-index no SPEC 00.

## 2. Base cartográfica

- **Leaflet** sobre **CARTO Positron** (`light_all`), attribution © OpenStreetMap © CARTO. Base **real** (constraint: não é mapa estilizado abstrato). Fundo `#e8ecf1` enquanto os tiles carregam.
- **Zoom:** controle nativo reposicionado no **topo-direito** (o canto inferior-direito é dos FABs). `minZoom 4` (o **Brasil inteiro** cabe na tela), `maxZoom 18` (tiles até 19).
- **Abertura:** centraliza em `MAP_CENTER`/`MAP_ZOOM` e navega até as 3 capitais do dataset fictício — **Recife, Fortaleza, João Pessoa**.

## 3. Pins no mapa

- **Marker** = `divIcon` **36×40px**, âncora `[18,38]` (a ponta toca o solo), corpo circular **28px**. *(Era 42×50 / corpo 34px até 29/07 — com 61 pontos clusterizados o pin dominava a base cartográfica.)*
- **Mostra dois códigos ortogonais** (SPEC 00 §2.3): a **cor** (`--pin`) = **relação comercial** — azul `#2053CE` cliente, lilás `#A78BFA` lead —; e a **pista de forma** = **degrau de origem**: `cnpj` borda **tracejada 1.5px**, `google` badge **`G`**, `validado_campo` badge **`✓`**. Mais o **dot branco** central de 9px.
- **Só a pista do degrau mais alto aparece.** A escada é aditiva (`cnpj` ⊂ `google` ⊂ `validado_campo`): um pin com `✓` também tem CNPJ e Google, e mostrar as três pistas juntas seria ruído. Corolário operacional: **check-in troca a pista, nunca a cor** — promover a `validado_campo` põe o `✓`, e o pin só fica azul quando o ERP disser que virou cliente.
- **Estados:** `is-selected` (escala 1.22 + halo brand), `pin--moving` (halo), `pin--new` (animação `pinPop` para pins criados na sessão), `pin--temp` (pulso roxo — marcador de criação).
- ⚠️ **Discrepância documentada (código × design):** o CSS prevê **emoji de tipologia** dentro do pin, mas o `map.js` atual desenha **só a cor da origem + dot** (marker limpo, diferenciado só por origem). Decisão em aberto: manter origin-only ou passar a renderizar o emoji de tipologia (`iconHtml` em `map.js`).
- **Ao selecionar:** o mapa reposiciona (`panToShow`) deslocando o centro ~18% para cima, para o pin não ficar atrás do bottom sheet.
- **Clusterização (performance — dado real ~7k pins):** os markers entram num `L.markerClusterGroup` (Leaflet.markercluster, vendorizado em `vendor/leaflet/markercluster/`). Pins próximos viram uma **bolha com a contagem** (tons de azul da marca); ao aproximar, a bolha abre nos **pins individuais** (estilo normal). Só o que está na **viewport** fica no DOM (`removeOutsideVisibleBounds`) → ~4 nós no zoom nacional em vez de milhares. O `draggable` fica **só no pin em modo mover** (antes era instanciado em todos — desperdício); adição em lote (`addLayers` + `chunkedLoading`) mantém a carga não-bloqueante. O **raio do cluster diminui com o zoom** (`maxClusterRadius` por zoom: 55→34→22) + `disableClusteringAtZoom: 16` → as bolhas quebram em pins com menos zoom. *Obs.: markercluster agrupa por **proximidade**, não por contagem — não há teto fixo de N pins/bolha; leads com coordenada idêntica (centroide de zona do snapshot) só separam no spiderfy do zoom máximo (resolve de vez com o geocoding da Fase 4).*

## 4. Legenda (CAP-1)

Control fixo no **canto inferior-esquerdo** — card translúcido (`backdrop-filter: blur`) **colapsável**, titulado **"Legenda"**. Desde 29/07 tem **duas seções**, porque o pin passou a carregar dois códigos:

- **`Cor · relação`** — as 2 entradas de `RELACAO_ORDER` (Cliente, Lead), cada uma com a sua cor.
- **`Pista · origem & confiança`** — os 3 degraus de `ORIGIN_ORDER`, cada um com **pista + rótulo de confiabilidade**. As amostras aqui são desenhadas em **cinza neutro** de propósito: pintá-las faria a origem parecer ter cor de novo.
- **Nota de procedência** (29/07) — rodapé âmbar: *"⚠️ Dados fictícios. Cor e pista são de demonstração — nenhum é cliente ou validação real."* Ela existe porque a cor passou a **parecer** um fato comercial ("este é cliente") e no dataset fictício não é: `cadastrado` vem do marcador `conv: 1` escrito à mão em 10 das 61 sementes.
  **Em `body.real-mode` a nota TROCA de texto, não desaparece** — vira verde: *"✔ Procedência real. Cor vem de Cadastrado no Salesforce; pista, dos sinais de geolocalização."* Ali os dois campos são verdadeiros (177 dos 6.914 pins; ver [snapshot](../snapshot-dado-real.md) §6), e repetir "fictício" seria mentira ao contrário. É a mesma linguagem âmbar da `.sim-banner` — aviso de **procedência**, não de erro —, mas independente dela: a `sim-banner` fala das *atividades* e só existe no modo real.
  ⚠️ A nota vive **dentro** do `legend__body`, então **colapsa junto com a legenda**. Mover para fora do body a deixaria permanente, ao custo de ocupar mapa sempre.

É o componente que garante o CAP-1: distinguir origem **e** relação de um pin **sem clicar** — e agora também dizer **o quanto disso é verdade**.

## 5. Quickbar — filtros rápidos (CAP-2)

- **🏷️ Classificação** → abre popover com todas as tipologias (multi-seleção); badge com a contagem de selecionadas.
- **3 atalhos toggle:** **🥇 Ouro** · **📌 Não visitados 30+** · **✓ Validado em campo** (sincronizados com o painel completo).
- **Filtros** → painel completo com todas as dimensões (detalhe em [[spec-03-filtros]]).
- **Contador:** `result-pill` no topbar mostra "N locais"; badge no botão Filtros mostra nº de filtros ativos.
- **Lógica:** **AND entre dimensões, OR dentro da dimensão**. O filtro **oculta** pins — **nunca deleta** (o pin nunca some). O **mesmo conjunto filtrado** alimenta a aba Inteligência ([[spec-05-intel]]), o Funil e as Atividades.
- **Oito dimensões** (ordem do painel), com três mudanças em 29/07:

  | Grupo | Chips | Nota |
  |---|---|---|
  | Tipologia | 12 | **data-driven** (o real traz `outro`) |
  | Última visita | 2 | `nao_30` · `recente` |
  | Qualidade | 3 | Ouro/Prata/Bronze |
  | **Porte** | **6** | ⬆️ era 4; uma faixa por valor real de `porte_c`, `LTDA`→`DEMAIS` |
  | Origem / confiança | 3 | chips ensinam a **pista** (§3), sem cor |
  | **Fase** | 8 | 🔤 **era "Status"** — renomeado para liberar o nome |
  | **Status do cliente** | **4** | 🆕 `lead` · `csc` · `recorrente` · `churn` |
  | **Zona** | **16** | 🔒 era data-driven; virou **vocabulário fechado** |

- **Zona virou taxonomia fechada.** As 15 de `zona_guardioes_c` **na ordem da operação** + `Sem Zona` (itálico apagado — é o balde, não uma zona). Os 16 chips aparecem **sempre**, mesmo vazios: no fictício 6 ficam sem pin, e é o preço de a supervisão ver a lista inteira. Só a Tipologia continua saindo dos valores presentes, então `taxoSignature` deixou de olhar a zona.
- **"Fase" × "Status do cliente" são eixos diferentes.** Fase = onde o trabalho está (o funil, 8 valores). Status do cliente = o que o ponto é na relação (4 valores). `csc` aparece nos dois de propósito — ver [[estabelecimento]] §5.
- ⚠️ **`churn` e `MEI` nascem em 0** e isso é a verdade, não bug: `churn` não tem fonte no `salesforce.lead`, e MEI está fora do recorte do snapshot. Chip zerado informa; chip escondido mentiria.

## 6. FABs

- **＋ Criar** (canto inf-direito) → inicia o fluxo de criação (CAP-4, detalhe em [[spec-04-criar]]): entra em modo *placing*, mostra banner "toque no mapa", cursor crosshair.
- **◎ Localizar** (acima do ＋) → CAP-8: `map.locate` (`setView`, `maxZoom 16`, alta precisão, timeout 12s). **Sucesso:** ponto azul (`#2E7DF6`) + **círculo de precisão** (raio = accuracy). **Erro/negado:** toast com mensagem clara, **sem travar**. É apenas "onde estou" — **não valida check-in** (non-goal explícito).
- Ambos **esmaecem** (opacity .3) durante placing/moving.

## 7. Mover pin (CAP-5)

Acionado por **botão dentro do pin sheet** (não por toque solto no mapa). `startMove` → modo `is-moving`, banner "✥ arraste o pin", zoom ≥ 16, arraste habilitado **só nesse pin**. O `dragend` **persiste a nova coordenada** (`movePin`). "Concluir" reabre o sheet na posição nova. Correção de posição promove o registro a **"validado em campo"** (regra do objeto — ver [[estabelecimento]] §8).

## 8. Estados

- **Vazio:** card central "Nenhum local com esses filtros" + botão "Limpar filtros".
- **Placing / Moving:** banners no topo do mapa; FABs esmaecidos; cursor crosshair (placing).

## 9. Dados exibidos (do Estabelecimento)

No **marker** aparecem apenas: a **posição** (`geo`), a **origem** (pista de forma) e a **relação comercial** (`cadastrado`, na cor). Nome, qualidade, porte, notas etc. **não** vão ao marker — vivem no pin sheet ([[spec-02-pin-sheet]]) e na lista ([[spec-05-intel]]). Referência cruzada: coluna **"Onde aparece"** em [[estabelecimento]] §4 (linhas com `mapa` / `cor do pin`).

## 10. Decisões & casos de borda

- **Sem exclusão de pin** (constraint) — filtrar apenas oculta.
- **Zoom no topo-direito** para não colidir com os FABs.
- ✅ **Decidido (29/07) — a cor do pin virou a relação comercial, e a origem virou pista de forma.** Antes: cor = origem, 4 categorias. O que se ganhou: nenhum degrau de origem depende de matiz (era o ponto fraco da CAP-1), e "já é cliente?" — a pergunta que o vendedor faz da calçada — ficou com o canal mais forte. O que se pagou: a categoria **"só Google"** deixou de existir (todo ponto vem da base de CNPJ, o Google enriquece), então a **inversão-tese ficou dormente**. Detalhe da escada em [[estabelecimento]] §5.
  > ✅ **A disputa pelo canal da cor já aconteceu — no mesmo dia.** `status_cliente` chegou horas depois (§5) e **não** levou a cor: entrou como filtro de 4 valores, e a cor do pin **segue binária**, porque `lead` é exatamente o lilás e `csc`/`recorrente`/`churn` são exatamente o azul — dar paleta própria criaria dois códigos de cor para a mesma informação. Abrir o azul em três tons continua em aberto ([[spec-00-design-system]] §2.5).
- **Marker origin-only** — emoji de tipologia **ainda não renderizado** (ver §3); **decisão segue em aberto**. Nota de 29/07: com o pin em 28px e um selo de canto ocupado por `G`/`✓`, sobra pouco espaço para um terceiro glifo — o custo de fechar em "sim" subiu.
- **Base cartográfica real** (não abstrata) — constraint de aceite (qualidade visual faz parte do gate).
- ✅ **Corrigido (23/07):** o "Limpar" do painel (`clearAll` em `filters.js`) referenciava dimensões antigas (`potential`, `visitStatus`) e lançava erro; agora limpa `qualidade`/`porte`/`status` corretamente.
