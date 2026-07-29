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

A quickbar tem **busca + três botões + Filtros** desde 29/07, e dois deles não são da mesma natureza dos outros:

- **🔎 Busca** — fechada é uma **lupa**; ao tocar, a barra vira um **campo de largura cheia** (`.quickbar.is-searching` esconde os chips) com `×` para fechar. Busca por **nome fantasia · razão social · CNPJ** — ver §5.2.
- **🏆 Aquisição** — **PRESET, não dimensão.** Liga **quatro filtros de uma vez** para isolar *oportunidades reais de aquisição*: `porte ≠ MEI` · `qualidade ∈ {Ouro, Prata}` · `status do cliente ∈ {lead, csc, churn}` · `fase ∉ {perdido, desqualificado}`. **Dourado** (`#C9971B`) para se distinguir dos recortes; detalhe do componente no [[spec-00-design-system]] §6.
- **🏷️ Classificação** → abre popover com todas as tipologias (multi-seleção); badge com a contagem de selecionadas.
- **📌 Não visitados 30+** — atalho toggle, sincronizado com o painel completo.
- **Filtros** → painel completo com todas as dimensões (detalhe em [[spec-03-filtros]]).

> 🗑️ **Saíram da quickbar em 29/07: "🥇 Ouro" e "✓ Validado em campo".** Ouro foi absorvido pelo preset de Aquisição (ele já exige Ouro ou Prata); a origem é recorte de **procedência**, não de intenção de trabalho — quem quer olhar procedência abre o painel. Os dois **continuam no painel completo**, então nada deixou de ser filtrável.

### 5.1 Como o preset se comporta

- **Aplicar marca os chips do painel**, não esconde nada: dá para ver que `MEI` ficou de fora e mexer em qualquer um depois. O preset **não trava** nenhum filtro.
- **O estado do botão é DERIVADO**, não guardado: ele está aceso se e somente se os quatro conjuntos são exatamente os do preset. Consequência boa — **mexer num chip do preset apaga o destaque sozinho**, em vez de deixar um botão aceso mentindo que o recorte ainda é aquele. Adicionar um filtro de **outra** dimensão (zona, tipologia) **não** apaga: essas não são dele.
- **Desligar limpa só as quatro dimensões do preset.** Tipologia, zona, origem e última visita continuam como estavam — mínima surpresa.
- **O badge de Filtros mostra 16**, não 1, quando o preset está ligado: são 16 chips ativos de verdade (5+2+3+6). Contar como "1" seria mentir sobre o que está aplicado.
- ⚠️ **O modelo de filtro não tem negação** (conjunto vazio = tudo; cheio = só esses), então `≠ MEI` e `∉ {perdido, desqualificado}` são expressos como **lista-branca do complemento**. É justamente isso que faz o preset aparecer nos chips — uma regra de exclusão invisível não mostraria nada.
- ✅ **Porte nulo virou filtrável — chip `Sem porte` (29/07).** A lista-branca escondia o **pin criado em campo**: o porte chega via CNPJá, então nasce nulo, e um lead achado na rua ficava fora de "Aquisição" — exatamente a lista onde ele deveria estar. Não era regra do preset (qualquer filtro de porte já fazia isso), mas o preset a tornou visível. Consertado com a **mesma solução do `Sem Zona`**: o vazio ganha nome e vira valor de primeira classe (`matches` compara `p.porte || 'SEM_PORTE'`). O preset **inclui** `Sem porte`, porque a intenção é *excluir MEI*, não *exigir porte conhecido*. Verificado: o lead da rua entra, e filtrar só `Sem porte` isola exatamente ele.
  > O grupo de Porte tem então **7 chips**: as 6 faixas reais de `porte_c` + o balde. `PORTE_ORDER` (enum de **dado**, o que o seed sorteia) e `PORTE_FILTRO` (vocabulário do **filtro**) são listas separadas em `js/data.js` de propósito — juntá-las faria o seed atribuir "Sem porte" como se fosse uma faixa.
- ℹ️ `fase` inclui `aquisicao` na lista-branca (a regra é "≠ perdido e ≠ desqualificado"), mas na prática nenhum pin em `aquisicao` passa: o filtro de status do cliente já corta `recorrente`, e pelo invariante `aquisicao ⟹ recorrente`. Redundante, não errado.

### 5.2 Busca (29/07) — **uma só, compartilhada pelas 4 abas**

Campos: **nome fantasia · razão social · CNPJ** (por dígitos, então `14066` acha `14.066.645/0001-46`), acento-insensível nos nomes. É a **mesma** `CRM_DATA.matchBusca` que a Inteligência e a barra de Atividades já usavam — o SPEC 00 §6 já dizia que *"busca que se comporta diferente em duas telas do mesmo app é bug de produto"*.

**A busca é uma DIMENSÃO DE FILTRO** (`CRM_FILTERS.q`), não um recorte local. Consequências, todas deliberadas:

- **Vale nas quatro abas.** Antes a Intel filtrava a lista por conta própria: ela prometia "o mesmo conjunto filtrado do mapa" e mostrava outro. Agora a caixa da Intel **escreve na mesma dimensão**, então digitar lá filtra o mapa, o Funil e as Atividades. ⚠️ **É mudança de comportamento na Intel** — o ganho é o app parar de se contradizer. Verificado em 4 termos: mapa e Intel dão a mesma contagem.
- **Conta no badge de Filtros** (+1) e as duas caixas espelham o mesmo valor, com guarda de valor igual — escrever num input que já tem o texto mata a posição do cursor de quem está digitando.
- **Fechar a barra LIMPA o termo**, e termo ativo **reabre** a barra sozinho: barra fechada com busca ativa seria **filtro invisível** — o mesmo erro da gaveta "Mais" que já foi revertida na aba Atividades.
- **`Esc` fecha e limpa.** O `Limpar` do painel zera a busca junto (é dimensão), mas **deixa a barra aberta e vazia**: o "Limpar filtros" do estado vazio aparece justamente quando a busca não achou nada, e fechar o campo tiraria de baixo do dedo de quem quer corrigir o termo.
- **`debounce` de 220 ms** nas duas caixas — cada tecla re-filtra 4 abas e reenquadra o mapa.

**O mapa REENQUADRA nos resultados** (`CRM_MAP.fitTo`, `padding 56`, `maxZoom 16`). Sem isso a busca-como-filtro é inútil aqui: os casamentos podem estar em Fortaleza enquanto a viewport está no Recife, e a tela fica vazia sem dizer por quê. Só enquadra quem **digitou** (mexer num chip não rouba o enquadramento) e só **com resultado** — nunca desenquadra para o vazio.

> ⚠️ **`fitTo` usa `animate: false` de propósito.** Busca é **salto de contexto**, não navegação contínua: animar um pan de ~430 km desorienta em vez de situar. E é o único caminho verificável — no Browser pane o `transitionend` nunca dispara (o pane não compõe frames), então **toda** animação do Leaflet fica presa no estado inicial. Medido: com `animate: true` o mapa não saía do lugar em nenhum dos casos. *Isso é limitação do ambiente de teste, não do Leaflet* — o `focus()` (§7, usado ao abrir um lead da Intel) é animado desde sempre e roda no Android; **não foi tocado** justamente porque não há como testá-lo aqui.
- **Contador:** `result-pill` no topbar mostra "N locais"; badge no botão Filtros mostra nº de filtros ativos.
- **Lógica:** **AND entre dimensões, OR dentro da dimensão**. O filtro **oculta** pins — **nunca deleta** (o pin nunca some). O **mesmo conjunto filtrado** alimenta a aba Inteligência ([[spec-05-intel]]), o Funil e as Atividades.
- **Oito dimensões** (ordem do painel), com três mudanças em 29/07:

  | Grupo | Chips | Nota |
  |---|---|---|
  | Tipologia | 12 | **data-driven** (o real traz `outro`) |
  | Última visita | 2 | `nao_30` · `recente` |
  | Qualidade | 3 | Ouro/Prata/Bronze |
  | **Porte** | **7** | ⬆️ era 4; 6 faixas reais de `porte_c` (`LTDA`→`DEMAIS`) + balde `Sem porte` |
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
