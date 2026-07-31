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
- **Clusterização (performance — dado real ~7k pins):** os markers entram num `L.markerClusterGroup` (Leaflet.markercluster, vendorizado em `vendor/leaflet/markercluster/`). Pins próximos viram uma **bolha com a contagem** (tons de azul da marca); ao aproximar, a bolha abre nos **pins individuais** (estilo normal). Só o que está na **viewport** fica no DOM (`removeOutsideVisibleBounds`) → ~4 nós no zoom nacional em vez de milhares. O `draggable` fica **só no pin em modo mover** (antes era instanciado em todos — desperdício); adição em lote (`addLayers` + `chunkedLoading`) mantém a carga não-bloqueante. O **raio do cluster varia com o zoom** (`maxClusterRadius`: **55→34→40**, mudado em 29/07 — era 55→34→22). *Obs.: markercluster agrupa por **proximidade**, não por contagem — não há teto fixo de N pins/bolha; leads com coordenada idêntica (centroide de zona do snapshot) só separam no spiderfy do zoom máximo (resolve de vez com o geocoding da Fase 4).*
- ⚡ **O zoom era o gargalo restante, e custava ~310 ms por gesto de 4 passos (29/07).** Cada passo criava as bolhas de novo: com raio 22 o zoom 15 gerava **277 divIcons de cluster**. Três ajustes, medidos juntos → **mediana de 72 ms** (variação 49–123):
  - **`animate: false`** no cluster — as bolhas trocam na hora em vez de se transformarem. Sozinho já corta 43% do custo síncrono, e elimina o trabalho por frame da animação de split/merge. O zoom do mapa em si **continua animado**.
  - **`updateWhenZooming: false`** no tile layer — a malha de tiles recalcula no fim do gesto, não a cada frame. Durante o zoom o Leaflet escala os tiles que já tem (borrão breve).
  - **Raio do zoom alto: 22 → 40** — 154 bolhas em vez de 277. Escolhido como **meio-termo**: 60 daria 59 ms, mas deixaria só 54 bolhas e mataria a granularidade fina que esta rampa existe para dar.
  > ⚠️ **A rampa deixou de ser monotônica** (55→34→**40**: desce e depois sobe), então "o raio diminui com o zoom" não descreve mais o código. Funciona, mas é uma incoerência de desenho — vale revisitar a rampa inteira junto com o geocoding da Fase 4, quando a densidade real dos pins mudar.
  > 📌 **Era "não medido": o zoom animado, que é o que o dedo faz** — no Browser pane as animações do Leaflet não completam (§5.2), então os números acima são do caminho síncrono. **Medido em 31/07** por outro caminho (§3.1), e a conclusão é que o caminho síncrono era o piso errado: a pinça custa 3–4× mais por nível de zoom que o botão.
- ⚡ **`disableClusteringAtZoom` subiu de 16 para 19 em 29/07 — ou seja, acima do `maxZoom` 18: na prática a clusterização nunca desliga.** No 16 ela desligava inteira e **2.600 markers entravam no DOM de uma vez: 1.040 ms** medidos com 6.914 pins (≈4 s no Android da Tatiana). Era o "mapa pesa quando dou zoom". Depois: **14 ms**. E o ganho não custou informação — pelo contrário: como o snapshot põe os leads em **centroide de zona**, desagrupar no 16 desenhava os 2.600 **um em cima do outro**, então se pagava um segundo para ver um pin e 2.599 escondidos atrás. A bolha com contagem + spiderfy ao tocar mostra **mais**. No dataset fictício nada muda (61 pontos espalhados já separam pelo raio: zoom 17 dá 6 pins individuais, 0 bolhas). ⚠️ **Voltar para 16 é uma linha, e faz sentido quando o geocoding da Fase 4 der coordenada real** — aí os pins estarão espalhados e desagrupar volta a informar.

### 3.1 A lentidão residual do zoom (31/07) — o que ela é, e o que ela não é

A rodada de 29/07 matou os dois penhascos (o desligamento da clusterização e a animação de split/merge) e ficou uma queixa residual: *"lento ao dar zoom-in e zoom-out"*. Esta rodada foi atrás dela **medindo o gesto**, não o caminho síncrono.

**Como foi medido, e por que não deu para medir do jeito anterior.** O Browser pane não compõe frames, então ali não existe `paint`, `raster` nem `transitionend` — o que dá para ver é script e layout forçado. A medição foi para **Edge headless=new + CDP** (que compõe): viewport 375×812 `mobile`, CPU estrangulada em **4×** (≈ Android de médio porte), tiles bloqueados no CDN para o decode de imagem sair da conta, e só os eventos da **main thread** do renderer somados. A pinça é um `Input.dispatchTouchEvent` de dois dedos em 18 frames — o `setZoom` não passa pelo mesmo caminho.
> ⚠️ **Duas armadilhas de método, das caras.** (1) A máquina **deriva**: o mesmo `base` deu 363 ms e, meia hora depois na mesma execução, 689 ms — medir "todas as reps de A, depois de B" confunde efeito com deriva, e foi assim que a delegação de clique "ganhou" 9–15% que não existiam. Correção: **intercalar** as condições e alternar a ordem. (2) Trocar o raio em tempo de execução obriga a reclusterizar, o que descarta ~10 mil objetos, e o **GC** cai dentro da medição seguinte — com isso raio 55 saiu *mais caro* que 40, o que é impossível. Correção: **aba nova por condição**. E, no fim, o ruído por medida ainda é de ±40%, que engole qualquer efeito de 10–25% — então **o que decide é contagem, não cronômetro** (ver abaixo).

**O diagnóstico: a viewport está SATURADA de bolhas, e cada passo de zoom reconstrói todas.**

- Com raio 40 e 6.914 pins, um 375×812 tem **50–56 objetos em tela do zoom 11 ao 15** — uma bolha a cada ~70×70 px, quase ladrilhando. O número quase não muda com o zoom: é o teto geométrico da grade.
- Cada passo de zoom faz ~**200 operações de camada** (entra e sai). Do que sai e volta, só **3–9 por passo** são a *mesma* camada: as bolhas do nível 13 e do 14 são objetos diferentes, então **não há oportunidade de diff** — trocar tudo é inerente ao desenho do plugin.
- O custo é, portanto, **proporcional ao número de bolhas em tela**. Não há bug para remover: há uma densidade escolhida.

**A pinça é o caminho caro, e não era ela que estava sendo medida.** Gesto de 18 frames, z13, 6.914 pins, CPU 4×, mediana de 6:

| gesto | main thread | composição |
|---|---|---|
| pinça abrindo | **838 ms** | script 424 · estilo 154 · layout 165 · pintura 124 |
| pinça fechando | **771 ms** | script 315 · estilo 147 · layout 134 · pintura 115 |
| 4 passos de botão (ida) | ~600 ms | script ~65% |

No `touchZoom` o Leaflet dispara `zoom`/`move` **a cada frame**, e cada marker no DOM tem handler ali (`Marker.update` → `latLngToLayerPoint` + `setPos`): com 55 markers, é 55 reposicionamentos por frame. Daí a inversão de composição — **53% em estilo/layout/pintura na pinça contra ~35% no botão**. Por nível de zoom a pinça sai **3–4× mais caro**.

**O que NÃO é a causa** (as três hipóteses eliminadas, cada uma com o teste que as eliminou):

- **Não é o HTML/CSS do pin.** Esconder **todos** os `.pin-wrap` por CSS não muda o total mensurável; zerar `box-shadow` + `filter: drop-shadow` também não. O ícone de 5 nós não é o gargalo — trocá-lo por 1 nó só saiu igual ou pior. Montar o ícone por `cloneNode` em vez de `innerHTML` também: neutro. *Corolário: não vale mexer na aparência do pin por performance.*
- **Não é trabalho nosso pendurado em `zoomend`/`moveend`.** Verificado em tempo de execução (não por `grep`): dos handlers registrados no mapa, **zero são do app** — todos são Leaflet ou markercluster.
- **Não é a coordenada verificada de 30/07.** Ela espalhou os pins (4.989 → 6.109 coordenadas distintas, +22%), mas os objetos em tela foram de 54 para 55 no Recife z13, e o custo síncrono subiu 5–11%. **Porque a grade já estava saturada:** espalhar pins dentro de células que já estavam todas ocupadas não cria bolhas novas. A pista valia ser checada e está absolvida.

**A correção aplicada (invisível): a passada DUPLA de bolhas por zoom.** A cada zoom o markercluster refaz o agrupamento **duas vezes** — uma no `zoomend` e outra no `moveend` que o Leaflet dispara logo atrás, com os mesmos bounds e o mesmo zoom. O plugin tem guard para isso (`if (this._inZoomAnimation) return`), mas `_inZoomAnimation` só sai de zero no caminho **animado** do cluster: no ramo `_noAnimation` o `_animationStart` é uma função vazia. **Foi o nosso `animate: false` de 29/07 que desarmou o guard** — a passada extra é efeito colateral daquela otimização. E ela não é inócua: em 8 passos (Recife 11↔15, 6.914 pins) a segunda passada **remove 117 camadas que a primeira acabou de pôr e recria 33 ícones**.

| 8 passos de zoom | chamadas de `addLayer` | remoções | ícones criados |
|---|---|---|---|
| antes | 720 (para 360 camadas) | 577 | 393 |
| depois | **360** (uma por camada) | **460** | **360** |

> ⚖️ **Contagem, não cronômetro — de propósito.** No tempo o efeito é de **~2%**, dentro do ruído de ±40% desta máquina: metade das chamadas eliminadas eram no-ops guardados, e o trabalho real removido (33 ícones, 141 remoções) é de um dígito percentual. **A honestidade aqui é dizer que é trabalho a menos comprovado e aceleração não comprovada** — não vender os 50% de chamadas como 50% de velocidade.
> 🔧 **Detalhe que fez a primeira tentativa medir zero:** o Leaflet guarda a **referência** da função no `on(...)`, então trocar `grupo._moveEnd` depois do registro não troca o handler que roda. Tem que `off` + `on` — e deixar `grupo._moveEnd` coerente, senão o `onRemove` do plugin desregistra a função errada.

**A outra mudança de código (também invisível): o clique virou DELEGADO.** Era um `on('click')` por marker — 6.914 closures e 6.914 registros de listener; agora é **um handler no grupo do cluster**, e o marker só carrega o `__pinId`. O plugin renomeia o clique de *bolha* para `clusterclick` e o trata por dentro (zoom/spiderfy), então no handler do grupo só chega clique de pin. Os markers **fora** do cluster (pin revelado §5.3, pin em modo mover §7) não têm o grupo como pai de eventos e mantêm handler próprio — são sempre 0 ou 1.
> ⚠️ **Não é ganho de velocidade, e a primeira medição mentiu.** Deu "9–15%" na medição em sequência e **−1%** quando as condições foram intercaladas: era deriva da máquina. O que se sustenta é **memória** — os handlers por marker custam ~**1,5 MB** de heap (~223 B cada) num heap de ~30 MB. Fica pela memória e por ser um handler em vez de milhares.

**Duas alavancas com custo visível, medidas e RECUSADAS** (ficam aqui para ninguém remedir):

- **Raio do zoom alto: 40 → 55 / 70 / 90.** É o dial de verdade, porque o custo é proporcional às bolhas. Camadas criadas em 8 passos (Recife): **raio 40 = 357 · 55 = 243 (−32%) · 70 = 179 (−50%) · 90 = 129 (−64%)**; bolhas no z13: 55 · 40 · 26 · 18. **Decisão de 31/07: fica em 40** — a granularidade fina que a rampa existe para dar vale o custo. *(É a mesma escolha de 29/07, quando 60 foi recusado; a densidade nova de 30/07 não a mudou, justamente porque a grade estava saturada antes e depois.)*
- **`markerZoomAnimation: false`.** Corta **23%** da pinça (838→679 abrindo, 771→554 fechando) porque o Leaflet passa a esconder o pane de markers na animação. Custo visual medido no pane, e é mais estreito do que parece: **durante o gesto os pins continuam visíveis e acompanhando**; eles somem por ~250 ms **depois** de soltar o dedo (o *snap* final) e nos 250 ms do toque em `+`/`−`. **Decisão de 31/07: não aplicar** — mapa sem pin nenhum, mesmo por 250 ms, é sintoma pior que a lentidão que resolve.

> 🧹 **O que fica como verdade sobre o zoom:** o custo residual **não é um defeito, é a densidade**. Enquanto forem ~50 bolhas por tela reconstruídas a cada passo, o piso é este; o que muda o piso de patamar é granularidade (recusada) ou sair de markers de DOM para canvas (fora de escopo: perderia o badge `G`/`✓` e a silhueta de pin). O que dá para colher sem custo já foi colhido.

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

- **🔎 Busca** — fechada é uma **lupa**; ao tocar, a barra vira um **campo de largura cheia** (`.quickbar.is-searching` esconde os chips) com `×` para fechar, e um **dropdown de sugestões** abre abaixo. Busca por **nome fantasia · razão social · CNPJ** — ver §5.2.
- **🏆 Aquisição** — **PRESET, não dimensão.** Liga **quatro filtros de uma vez** para isolar *oportunidades reais de aquisição*: `porte ≠ MEI` · `qualidade ∈ {Ouro, Prata}` · `status do cliente ∈ {lead, csc, churn}` · `fase ∉ {perdido, desqualificado}`. **Dourado** (`#C9971B`) para se distinguir dos recortes; detalhe do componente no [[spec-00-design-system]] §6.
- **🏷️ Tipologia** → abre popover com todas as tipologias (multi-seleção); badge com a contagem de selecionadas.
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

- **Vale nas quatro abas.** Antes a Intel filtrava a lista por conta própria: ela prometia "o mesmo conjunto filtrado do mapa" e mostrava outro. Agora a busca é uma só, então digitar filtra o mapa, a Intel, o Funil e as Atividades. ⚠️ **É mudança de comportamento na Intel** — o ganho é o app parar de se contradizer. Verificado em 4 termos: mapa e Intel dão a mesma contagem.
- 🔧 **Correção 30/07 — a Intel perdeu a caixa própria: é UMA caixa, não duas.** A quickbar aparece também na aba Inteligência, então abrir a lupa lá empilhava **dois campos de busca** na tela (o da quickbar em cima, o `.intel-search` embaixo) para um controle só. O `.intel-search` saiu do HTML, do CSS e do `intel.js`; a busca da Intel **é** a da quickbar, aberta pela lupa. Consequência colateral: buscando pela Intel o mapa agora **reenquadra** (o `enquadrar: false` daquela caixa morreu com ela) — o que é o certo, já que o toque num resultado leva ao mapa.
- **Conta no badge de Filtros** (+1) e a caixa espelha o valor de `filters.q`, com guarda de valor igual — escrever num input que já tem o texto mata a posição do cursor de quem está digitando.
- **Fechar a barra LIMPA o termo**, e termo ativo **reabre** a barra sozinho: barra fechada com busca ativa seria **filtro invisível** — o mesmo erro da gaveta "Mais" que já foi revertida na aba Atividades.
- **`Esc` fecha e limpa.** O `Limpar` do painel zera a busca junto (é dimensão), mas **deixa a barra aberta e vazia**: o "Limpar filtros" do estado vazio aparece justamente quando a busca não achou nada, e fechar o campo tiraria de baixo do dedo de quem quer corrigir o termo.
- **`debounce` de 220 ms** na caixa — cada tecla re-filtra 4 abas e reenquadra o mapa.

**O mapa REENQUADRA nos resultados** (`CRM_MAP.fitTo`, `padding 56`, `maxZoom 16`). Sem isso a busca-como-filtro é inútil aqui: os casamentos podem estar em Fortaleza enquanto a viewport está no Recife, e a tela fica vazia sem dizer por quê. Só enquadra quem **digitou** (mexer num chip não rouba o enquadramento) e só **com resultado** — nunca desenquadra para o vazio.

#### Sugestões (`.qsug`) — o atalho para UM pin

Enquanto o filtro responde *"quais pins casam"*, a lista responde *"é este"*. As duas coisas convivem: o mapa já filtrou e reenquadrou; tocar num item **leva ao ponto e abre o sheet**.

- **Item:** emoji da tipologia · **nome** · `bairro · cidade/UF · CNPJ` · **dot da relação/origem** (mesma gramática do marker — §3), tudo em uma linha com *ellipsis*.
- **Ranking por relevância:** quem **começa** com o termo vem antes de quem só o contém, e **nome** antes de **razão social**; CNPJ por último. Sem isso, digitar "pad" podia trazer um restaurante cujo nome contém "padaria" antes da "Padaria Maré Alta". Usa a **mesma** normalização do `matchBusca` (`CRM_DATA.norm`, exposta para não haver duas versões divergindo).
- **Teto de 8, nunca silencioso:** o rodapé diz *"Mostrando 8 de N"*. Com 6.914 pins um termo curto casa centenas; mostrar 8 sem dizer quantos sobraram leria como *"só existem estes"*.
- ⭐ **A lista varre TODOS os pins, inclusive os que os filtros escondem** — e é o ponto mais importante desta seção. A primeira versão respeitava o filtro, e isso **matava o valor central do mapa**: com qualquer chip ligado, buscar um ponto conhecido não o achava, e a pessoa não tem como saber que a culpa era de um filtro. **Achar** é função da busca; **filtrar** é função do filtro. O item oculto vem **marcado** (`fora do filtro`, fundo âmbar) e o rodapé conta quantos são.
- **Escolher LIMPA a busca** (fecha a barra, e fechar limpa pela regra acima), depois foca em zoom 17, abre o sheet e aplica `panToShow` para o pin não ficar atrás dele. Limpar é deliberado: você escolheu **um** ponto, e seguir com o mapa filtrado ao termo esconderia justamente a vizinhança que se quer ver ao chegar.

#### Pin REVELADO — a exceção visível (`pin--revelado`)

Escolher um ponto que os filtros escondem faz ele **aparecer no mapa** (`CRM_MAP.revelar`). É o "pin momentâneo": um marker próprio **fora do clusterGroup**, exatamente como o pin em modo mover (§7) já fazia.

- **Não toca no filtro.** Não entra em `matches` nem em `getFiltered`, então o pill `N locais`, o badge de Filtros, o Funil, a Inteligência e as Atividades **continuam dizendo a verdade** sobre o recorte. Medido: com `Qualidade = Ouro` ligado, revelar um ponto Prata mantém o pill em `5 locais` e o badge em `1`.
- **Mexer nos chips por baixo seria pior.** Destruiria o recorte que a pessoa montou — e é esse recorte que ela vai querer de volta depois de olhar o ponto.
- **Pista permanente:** anel **âmbar tracejado** em volta do corpo. Âmbar é a linguagem de *aviso de procedência* do app (nunca Danger — não é erro, é ressalva), e o anel fica **externo** de propósito: o tracejado da **borda** já é a pista de origem `cnpj` (§3), e os dois códigos não podem se confundir. Um **toast** avisa uma vez; o anel fica enquanto a exceção existir.
- **Quando termina:** ao **selecionar outro pin** (chega por `setSelected`, que o sheet já chamava) ou quando o ponto **volta a caber no filtro**.
  > ⚠️ **Fechar o sheet NÃO dispensa** — e a primeira versão dispensava, o que anulava o recurso inteiro. **O sheet ocupa `86dvh`:** medido em 390×844, ele cobre de `y=118` até o fim, e topbar+quickbar comem os primeiros 108px — sobram **10px** de mapa livre. Ou seja, **com o sheet aberto o pin é invisível de qualquer forma**, e fechar é justamente o gesto de *"quero ver o pin"*. Dispensar ali fazia o ponto sumir na hora exata em que ele deveria aparecer.
  > ⚠️ **Por isso a busca não chama `panToShow`.** Ele desloca o centro ~18% para o pin escapar do sheet, mas com 10px livres não há posição que funcione — só descentraliza. Deixando o pin no **centro**, ele está no lugar mais natural no instante em que o sheet fecha. (`panToShow` segue valendo para quem **toca** num pin no mapa: lá já se sabe onde ele está.)
  > 📌 **Em aberto:** mostrar pin **e** sheet ao mesmo tempo exigiria o sheet abrir numa primeira parada menor (~55dvh) em vez de 86 — decisão de design, não feita.
- **Se o ponto voltar a caber no filtro** (a pessoa limpou ou alargou), o `render` **dispensa a revelação** e deixa o fluxo normal recriar o marker: senão ele ficaria com o anel de exceção sem ser exceção, e haveria dois markers no mesmo ponto. Verificado — sem duplicata.
- **`Enter` escolhe a primeira** — atalho de quem já sabe o que quer. **Tocar no mapa fecha a lista sem limpar o termo**: quem toca no mapa quer ver o mapa, que já está filtrado.
- ⚙️ **Dois detalhes de implementação que são armadilha:** a lista usa **delegação** (redesenha a cada tecla, e listener por item morreria no render seguinte) e escuta **`pointerdown`, não `click`** — no toque o `blur` do input chega antes do `click`, e o item já teria sido removido: a escolha se perdia. O dropdown vive **dentro da quickbar** para herdar o stacking dela (z 39) e cair sobre mapa, FABs e banners sem z-index próprio.

> ⚠️ **`fitTo` usa `animate: false` de propósito.** Busca é **salto de contexto**, não navegação contínua: animar um pan de ~430 km desorienta em vez de situar. E é o único caminho verificável — no Browser pane o `transitionend` nunca dispara (o pane não compõe frames), então **toda** animação do Leaflet fica presa no estado inicial. Medido: com `animate: true` o mapa não saía do lugar em nenhum dos casos. *Isso é limitação do ambiente de teste, não do Leaflet* — o `focus()` (§7, usado ao abrir um lead da Intel) é animado desde sempre e roda no Android. Ele ganhou um **3º parâmetro opcional `animar`, default `true`**, para o caminho antigo seguir idêntico; só a escolha de sugestão passa `false`, pelo mesmo motivo do `fitTo` (o ponto pode estar em outra capital).
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
- **🧭 Montar rota** (acima do ◎) → liga o **modo de montagem** (§6.2). Entrou em 31/07.
- Todos **esmaecem** (opacity .3) durante placing/moving.

## 6.1 Faixa da visita em andamento (29/07)

Faixa verde no **rodapé** do mapa, à esquerda dos FABs: `⏱️ {ponto} · check-in há {tempo}` + `Check-out ›`. Ela é o **sintoma** do check-in aberto fora do sheet do pin — sem ela, fechar o sheet (ou o app) fazia a visita em curso desaparecer da tela, e ainda dava para abrir uma segunda em outro ponto. Tocar leva ao pin e abre o **sheet de conclusão**; se o filtro esconder esse pin, ele entra como **exceção visível** (`revelar`, §5.2), sem mexer no recorte. Âmbar quando a visita está esquecida (>8h ou de outro dia). Regra completa, invariante e pontas soltas em [[spec-07-atividades]] §2.4; forma em [[spec-00-design-system]] §6.15.

> **Rodapé, não topo.** O topo do mapa é dos banners de modo (§7 e §6): dois absolutos no mesmo `top: 12px` se sobrepõem — e a faixa da visita é **persistente**, então seria ela a estorvar os transientes. No rodapé ela divide espaço com os FABs (que ocupam os 74px da direita) e **cede a vez** ao pin sheet, que é dono daquela área quando está aberto.

## 6.2 Montar rota no mapa (31/07)

> ✅ **Implementado em 31/07** (`js/rota.js` + `CRM_STATE.criarRota`), fechando a **dívida de criar rota** ([[rota]] §9): até aqui as rotas eram **semeadas** e agendar pelo pin criava sempre avulsa. A decisão de UX abaixo foi tomada **antes** do código, porque a escolha de posição é uma **troca de espaço** — e trocas de espaço não devem ser decididas com o dedo já no teclado.

**O problema não era "onde cabe o botão".** Montar rota não é um toque, é **escolher N pins** — ou seja, um **modo**, como `placing` e `moving` (§7). Isso separa duas perguntas que estavam colando:

| Peça | Onde fica | Custo permanente |
|---|---|---|
| **O modo** (montando) | **empresta**: banner no topo (no molde dos banners de modo) + o canto **inferior-esquerdo**, onde a **legenda sai** para dar lugar ao painel | **zero** — modo tem direito de emprestar |
| **A entrada** | o **3º FAB** (`🧭`), acima do ◎ | a coluna direita |

**A entrada foi a única troca real, e ela foi decidida com as opções na mesa.** Escolha de Tatiana: **3º FAB permanente**. As alternativas e o que cada uma custava:

| Opção | A favor | Contra |
|---|---|---|
| **3º FAB `🧭`** ✅ **escolhido** | descoberta máxima — quem quer montar rota vê o botão | a coluna direita vai a ~180px de ~648px (**28%** da borda), e **três círculos iguais não têm hierarquia**: o `＋ Criar pin` (CAP-4, capability-manchete) deixa de ser *o* botão do canto |
| **Entrada pelo pin sheet** (`🧭 Montar rota daqui`) — recomendação da UX | custo permanente **zero**; a 1ª parada é a âncora e os demais pins viram **um toque cada**; lê verdadeiro (rota nasce de um ponto, como o seed) | descoberta baixa no mapa |
| **`＋` vira menu de dois** | nenhum canto novo | cobra **um toque a mais** do `＋ Criar pin`, que hoje é um toque — o mesmo trade que [[spec-07-atividades]] §9 já recusou uma vez |
| **Sem entrada no mapa** | zero custo | o ato principal aconteceria na tela que **esconde o critério** (proximidade) |

> ⚖️ **A recomendação da UX era a entrada pelo pin sheet, e ela foi vencida — de propósito e por escrito.** O argumento contra o FAB permanente segue valendo (dilui o `＋`, come 28% da borda direita), e o argumento a favor que decidiu foi **descoberta**: um modo que ninguém acha é um modo que não existe. Fica registrado porque, se um dia a coluna direita apertar — um 4º controle, ou o `＋` deixando de ser óbvio —, a alternativa de custo zero já está descrita aqui e não precisa ser redescoberta.

> ⚖️ **Duas portas para o mesmo modo, e elas NÃO são equivalentes.** O `＋ Nova rota` da sub-aba Rotas e o FAB `🧭` **ligam o mesmo modo**: são o mesmo fluxo entrado em momentos diferentes — *sentado planejando amanhã* (a aba) e *olhando os pins agora* (o mapa). É o mesmo critério aceito em 30/07 para agendamento (*"duas portas para o mesmo agendamento"*): a porta existe no instante em que a pessoa sabe o que quer. O que **não** existe é uma segunda *mecânica* — nenhuma das duas monta rota por lista de nomes ([[spec-07-atividades]] §4.2).

### O modo, como ficou

**Duas peças, com trabalho dividido** — e a divisão é real, não decoração: elas não podem dizer a mesma coisa duas vezes.

| Peça | O que diz | Por que ali |
|---|---|---|
| **Banner** (topo, `.placing-banner`) | a **instrução**: `🧭 Toque nos pins que entram na rota` + `Cancelar` | é o indicador de modo, no mesmo lugar e na mesma forma de `placing`/`moving` |
| **Painel** (canto inf-esquerdo, `.rota-panel`) | o **estado** (`3 pontos · Pedro Rocha`) e a **saída** (`Concluir rota`) | é onde o polegar chega enquanto a outra mão toca os pins |
| **Sheet** (rodapé, molde do modal de criar) | o **único campo que não é derivado**: o dia | poucos campos, um botão que diz o que falta |

- **Toque no pin escolhe, não abre o sheet** — é o que faz a montagem ser **um toque por parada**. Tocar de novo **tira**: sem isso, errar um ponto obrigaria a recomeçar.
- **O pin escolhido ganha anel de marca + `✓`** no canto de **baixo** (o de cima é do selo de origem `G`/`✓`, e dois selos no mesmo canto se cobrem).
- **O botão diz o que falta**: `Escolha 2 pontos` → `Escolha 1 ponto a mais` → `Concluir rota`. No sheet: `Escolha o dia da rota` / `O dia já passou` → `Criar rota`.
- **`Voltar` no sheet preserva a seleção** — quem abriu o sheet e viu que faltava um ponto não pode perder os outros quatro. `Esc` fecha o sheet; um segundo `Esc` sai do modo.
- **Sair do mapa encerra o modo.** Modo do mapa de pé por baixo de outra aba é estado invisível: voltar depois de tocar um card do Funil (que abre o pin direto) daria sheet aberto com o modo ligado atrás.

> ⚖️ **Mínimo de DOIS pontos, e o botão pede o segundo.** Uma "rota" de um ponto é uma **avulsa com passos a mais** — e a avulsa já tem duas portas, as duas no pin ([[spec-07-atividades]] §2.1 e §3). Aceitar o conjunto de um criaria dois caminhos para o mesmo objeto com nomes diferentes.

> ⚖️ **A recusa de vendedor NOMEIA os dois lados.** Uma rota é de **um** vendedor ([[rota]] §2.4) — `responsavel_id` da tarefa é derivado do **pin**, então pins de donos diferentes fariam uma rota com duas gentes dentro. Tocar num pin de outro dono é recusado com: *"Esta rota é de Pedro Rocha — 'Restaurante Peixe na Brasa' é de Aline Souza. Uma rota é de um vendedor só."* Recusar em silêncio é o pior desfecho — a mesma lição do bloqueio de 2º check-in (§6.1).

> ⛔ **O modo não pede HORÁRIO, e isso é o invariante, não economia de tela.** Hora **ordenaria** as paradas, e rota é **conjunto**, não sequência ([[rota]] §2.1). As paradas nascem `hora = null`, o que a Agenda mostra como **`DIA INTEIRO`** no topo do dia e o cabeçalho da rota como `sem horário`. Dar a todas o mesmo horário seria mentira; dar horários crescentes seria sequenciar por tabela.
> ⛔ **E não numera pin nem desenha trajeto.** O painel **conta** pontos. Um "1, 2, 3" nos pins seria a tela prometendo um sequenciamento que o objeto não guarda — e que é **Fase 4**.

> ⚖️ **O `tipo` de cada parada vem SUGERIDO, não escolhido.** `D.sugereTipoVisita` por pin (1ª visita · follow-up · recorrência — [[tarefa]] §5). Pedir o tipo de N pontos numa tela de seleção espacial seria N escolhas para um gesto que é **um só**; e o tipo tem o check-out como último instante de edição ([[tarefa]] §8).

> ⚖️ **O sheet diz o efeito no FUNIL antes do toque**, como o sheet de agendar (§2.1 da [[spec-07-atividades]]): *"4 paradas — cada uma nasce como visita planejada, e 2 pontos entram no funil"*. E, se houver ponto em saída lateral, uma ressalva âmbar: *"2 pontos estão em Perdido ou Desqualificado e continuam lá — só voltam ao funil quando a visita for concluída"*. Montar rota é **plano**, e voltar de lateral exige tarefa **concluída** ([[tarefa]] §5) — é a promessa que 30/07 corrigiu, e ela não pode ser refeita errado aqui.

> ⚖️ **O nome é derivado e MOSTRADO no sheet.** Zona dominante das paradas, única por dia ([[rota]] §1) — read-only no protótipo. Aparece para ninguém ser surpreendido por ele depois; a unicidade é conferida contra a coleção `rotas` viva, então uma segunda rota na mesma zona e no mesmo dia sai como `Rota REC Zona Sul · Pedro`.

> ⚖️ **Criar leva à sub-aba Rotas, com a rota expandida.** Criar e não mostrar o que foi criado deixaria a pessoa procurando a própria rota numa lista de 118. O toast diz os três fatos (`Rota criada — {nome} · 4 paradas em 31/07`).

> ⚖️ **O banner SAI enquanto o sheet está aberto.** Ele diz "toque nos pins" e o sheet cobre o mapa: instrução que não pode ser seguida é pior que nenhuma. Mesma regra do rodapé cedendo ao pin sheet ([[spec-00-design-system]] §6.15).

> ⚖️ **O rodapé não entra na conta.** Ele é da **faixa de visita em andamento** (§6.1), que é a única saída do bloqueio de segundo check-in — e é persistente. Por isso o painel do modo mora no canto da **legenda** (que sai enquanto o modo durar) e **sobe para 76px** quando a faixa está na tela: quem chega depois cede, e a faixa não cede a ninguém.

> ⚖️ **Um `emit` só.** `criarRota` grava a rota e as N tarefas e **emite uma vez**: montar 5 paradas chamando `agendarTarefa` 5 vezes custaria 5 `reapply()` + 5 refresh de todas as abas. E a validação inteira acontece **antes** da primeira escrita — *transição recusada não escreve nada*, o padrão de 30/07.

## 7. Mover pin (CAP-5)

Acionado por **botão dentro do pin sheet** (não por toque solto no mapa). `startMove` → modo `is-moving`, banner "✥ arraste o pin", zoom ≥ 16, arraste habilitado **só nesse pin**. O `dragend` **persiste a nova coordenada** (`movePin`). "Concluir" reabre o sheet na posição nova. Correção de posição promove o registro a **"validado em campo"** (regra do objeto — ver [[estabelecimento]] §8).

## 8. Estados

- **Vazio:** card central "Nenhum local com esses filtros" + botão "Limpar filtros".
- **Placing / Moving:** banners no topo do mapa; FABs esmaecidos; cursor crosshair (placing).
- **Visita em andamento:** faixa verde no rodapé (§6.1) — âmbar se esquecida. Some com o pin sheet aberto e nas outras abas.
- **Montando rota** (§6.2): banner de instrução no topo, **legenda fora** dando lugar ao painel `N pontos · vendedor` + `Concluir rota`, e os **três** FABs esmaecidos como nos demais modos. Pins escolhidos com anel de marca e `✓`. Com **menos de 2** pontos o botão pede o que falta em vez de ficar sem função.

## 9. Dados exibidos (do Estabelecimento)

No **marker** aparecem apenas: a **posição** (`geo`), a **origem** (pista de forma) e a **relação comercial** (`cadastrado`, na cor). Nome, qualidade, porte, notas etc. **não** vão ao marker — vivem no pin sheet ([[spec-02-pin-sheet]]) e na lista ([[spec-05-intel]]). Referência cruzada: coluna **"Onde aparece"** em [[estabelecimento]] §4 (linhas com `mapa` / `cor do pin`).

## 10. Decisões & casos de borda

- **Sem exclusão de pin** (constraint) — filtrar apenas oculta. ➕ **E o oculto pode ser trazido de volta pontualmente** (29/07): a busca revela um ponto escondido sem mexer no filtro (§5.2). O invariante continua intacto — o filtro só oculta, e agora dá para furar o véu num ponto por vez, de forma visível.
- **Zoom no topo-direito** para não colidir com os FABs.
- ✅ **Decidido (29/07) — a cor do pin virou a relação comercial, e a origem virou pista de forma.** Antes: cor = origem, 4 categorias. O que se ganhou: nenhum degrau de origem depende de matiz (era o ponto fraco da CAP-1), e "já é cliente?" — a pergunta que o vendedor faz da calçada — ficou com o canal mais forte. O que se pagou: a categoria **"só Google"** deixou de existir (todo ponto vem da base de CNPJ, o Google enriquece), então a **inversão-tese ficou dormente**. Detalhe da escada em [[estabelecimento]] §5.
  > ✅ **A disputa pelo canal da cor já aconteceu — no mesmo dia.** `status_cliente` chegou horas depois (§5) e **não** levou a cor: entrou como filtro de 4 valores, e a cor do pin **segue binária**, porque `lead` é exatamente o lilás e `csc`/`recorrente`/`churn` são exatamente o azul — dar paleta própria criaria dois códigos de cor para a mesma informação. Abrir o azul em três tons continua em aberto ([[spec-00-design-system]] §2.5).
- **Marker origin-only** — emoji de tipologia **ainda não renderizado** (ver §3); **decisão segue em aberto**. Nota de 29/07: com o pin em 28px e um selo de canto ocupado por `G`/`✓`, sobra pouco espaço para um terceiro glifo — o custo de fechar em "sim" subiu.
- **Base cartográfica real** (não abstrata) — constraint de aceite (qualidade visual faz parte do gate).
- ✅ **Corrigido (23/07):** o "Limpar" do painel (`clearAll` em `filters.js`) referenciava dimensões antigas (`potential`, `visitStatus`) e lançava erro; agora limpa `qualidade`/`porte`/`status` corretamente.
