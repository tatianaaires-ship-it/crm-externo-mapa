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

- **Marker** = `divIcon` 42×50px, âncora `[21,48]` (a ponta toca o solo).
- **Mostra:** a **cor da origem** (`--pin`) + **dot branco** central + **badge `✓`** apenas para `validado_campo`. Pistas não-cromáticas repetidas do SPEC 00: `cnpja_puro` borda **tracejada**, `cnpja_google` borda **3px**.
- **Estados:** `is-selected` (escala 1.22 + halo brand), `pin--moving` (halo), `pin--new` (animação `pinPop` para pins criados na sessão), `pin--temp` (pulso roxo — marcador de criação).
- ⚠️ **Discrepância documentada (código × design):** o CSS prevê **emoji de tipologia** dentro do pin, mas o `map.js` atual desenha **só a cor da origem + dot** (marker limpo, diferenciado só por origem). Decisão em aberto: manter origin-only ou passar a renderizar o emoji de tipologia (`iconHtml` em `map.js`).
- **Ao selecionar:** o mapa reposiciona (`panToShow`) deslocando o centro ~18% para cima, para o pin não ficar atrás do bottom sheet.
- **Clusterização (performance — dado real ~7k pins):** os markers entram num `L.markerClusterGroup` (Leaflet.markercluster, vendorizado em `vendor/leaflet/markercluster/`). Pins próximos viram uma **bolha com a contagem** (tons de azul da marca); ao aproximar, a bolha abre nos **pins individuais** (estilo normal). Só o que está na **viewport** fica no DOM (`removeOutsideVisibleBounds`) → ~4 nós no zoom nacional em vez de milhares. O `draggable` fica **só no pin em modo mover** (antes era instanciado em todos — desperdício); adição em lote (`addLayers` + `chunkedLoading`) mantém a carga não-bloqueante.

## 4. Legenda (CAP-1)

Control fixo no **canto inferior-esquerdo** — card translúcido (`backdrop-filter: blur`) **colapsável** ("Origem & confiança"). Lista as 4 categorias na ordem `ORIGIN_ORDER`, cada uma com **cor + pista não-cromática + rótulo de confiabilidade**. É o componente que garante o CAP-1: distinguir a origem de um pin **sem clicar**.

## 5. Quickbar — filtros rápidos (CAP-2)

- **🏷️ Classificação** → abre popover com todas as tipologias (multi-seleção); badge com a contagem de selecionadas.
- **3 atalhos toggle:** **🥇 Ouro** · **📌 Não visitados 30+** · **✓ Validado em campo** (sincronizados com o painel completo).
- **Filtros** → painel completo com todas as dimensões (detalhe em [[spec-03-filtros]]).
- **Contador:** `result-pill` no topbar mostra "N locais"; badge no botão Filtros mostra nº de filtros ativos.
- **Lógica:** **AND entre dimensões, OR dentro da dimensão** (tipologia, zona, qualidade, porte, origem, status, última visita). O filtro **oculta** pins — **nunca deleta** (o pin nunca some). O **mesmo conjunto filtrado** alimenta a aba Inteligência ([[spec-05-intel]]).

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

No **marker** aparecem apenas: a **posição** (`geo`) e a **origem** (cor + pista + `✓`). Nome, qualidade, porte, notas etc. **não** vão ao marker — vivem no pin sheet ([[spec-02-pin-sheet]]) e na lista ([[spec-05-intel]]). Referência cruzada: coluna **"Onde aparece"** em [[estabelecimento]] §4 (linhas com `mapa` / `cor do pin`).

## 10. Decisões & casos de borda

- **Sem exclusão de pin** (constraint) — filtrar apenas oculta.
- **Zoom no topo-direito** para não colidir com os FABs.
- **Marker origin-only** — emoji de tipologia não renderizado (ver §3); decisão em aberto.
- **Base cartográfica real** (não abstrata) — constraint de aceite (qualidade visual faz parte do gate).
- ✅ **Corrigido (23/07):** o "Limpar" do painel (`clearAll` em `filters.js`) referenciava dimensões antigas (`potential`, `visitStatus`) e lançava erro; agora limpa `qualidade`/`porte`/`status` corretamente.
