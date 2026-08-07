---
title: "SPEC 00 — Design System & App Shell (CRM Externo / Praso Maps)"
tipo: design-spec
fase: "Protótipo do Mapa (Fase 1–2)"
status: ratificado
fonte_de_verdade: "css/styles.css (o doc espelha o CSS, não o inverso)"
sources:
  - "css/styles.css — tokens e componentes implementados"
  - "index.html — estrutura do shell"
  - "_bmad-output/specs/spec-crm-externo/SPEC.md (CAP-1..10, constraints)"
  - "origem-confiabilidade.md (as 4 categorias de origem)"
  - "Ref. estética: Marco Polo (Stone), BEES Force (Ambev)"
related:
  - "[[estabelecimento]]"
  - "[[spec-01-mapa]]"
  - "[[spec-02-pin-sheet]]"
---

# SPEC 00 — Design System & App Shell

> 🎯 **Objetivo.** Definir os padrões visuais, tokens, componentes e a estrutura de navegação que **toda tela do Praso Maps herda**. É o alicerce: cada spec de tela (`spec-01`, `spec-02`…) refere a este documento em vez de repetir tokens.
> ⚠️ **Fonte de verdade = `css/styles.css`.** Este doc **transcreve** o que já está implementado no protótipo. Mudou o CSS, atualize aqui (e vice-versa). Não é design aspiracional.

> ✅ **Implementado (27/07).** A §2.6 (8 valores, 3 cores novas) está em `js/data.js` e a nav de 4 abas em `index.html` + `app.js`. O doc voltou a ser espelho do código.

## 1. Princípios de design

1. **Mobile-first, o mapa no centro.** Não é um CRM de mesa com um mapa dentro; é um mapa em tela cheia com os controles flutuando por cima. O alvo é o vendedor de campo no Android.
2. **PWA nativo e offline-friendly.** Fonte do sistema (sem webfont baixada), `100dvh`, scroll do documento travado, `safe-area` respeitada. O app parece nativo e não depende de rede pra ficar bonito.
3. **Reconhecimento visual antes da leitura.** Cor, emoji e badge dizem o essencial *sem clicar* — o pin é lido de relance (CAP-1).
4. **Acessível por mais de um canal.** Nunca só cor: origem também é comunicada por **forma de borda** e **badge** (pista não-cromática para daltônicos).
5. **Mínimo atrito para registrar.** Criar um lead pede só nome + local; classificação é derivada, nunca digitada. Preferir toque/chip a campo de texto.
6. **Referência estética:** apps de field sales (Marco Polo/Stone, BEES Force/Ambev), **não** CRMs de desktop.

## 2. Paleta de cores (tokens `:root`)

### 2.1 Base

| Token | Hex | Uso |
|---|---|---|
| `--brand` | `#2053CE` | Ações principais, FAB, aba ativa, foco |
| `--brand-600` | `#1a44a8` | Press/hover de brand |
| `--brand-050` | `#e8effc` | Fundo suave, ring de foco (3px) |
| `--ink` | `#0f172a` | Texto primário; chips ativos; banners |
| `--ink-2` | `#334155` | Texto secundário forte |
| `--muted` | `#64748b` | Texto terciário, labels, placeholders |
| `--bg` | `#eef1f6` | Fundo do app |
| `--surface` | `#ffffff` | Cards, barras, sheets |
| `--surface-2` | `#f8fafc` | Fundo sutil, botão ghost |
| `--line` | `#e2e8f0` | Bordas de card, divisores |
| `--line-2` | `#cbd5e1` | Bordas de input/chip, handle |

### 2.2 Semânticas

| Papel | Hex | Uso |
|---|---|---|
| Success / check-in | `#10b981` (texto forte `#059669`) | Positivo; botão de check-in; geo validado |
| Warning / check-out | `#f59e0b` | Atenção; botão de check-out; acento de nota |
| Danger | `#dc2626` | Erro de campo, ação destrutiva |
| Hint positivo | `#059669` sobre `#d1fae5` | Selo "validado em campo" no sheet |

### 2.3 Os dois códigos do pin — **load-bearing (CAP-1)**

⚠️ **Mudou em 29/07.** Até então a **cor** do pin era a origem, em 4 categorias. Agora são **dois eixos ortogonais, em canais diferentes**: a **cor** diz a *relação comercial*, a **pista de forma** diz a *origem/confiança*. O ganho é que a origem deixa de depender de distinguir matiz — nenhum degrau é só-cor —, e a leitura mais operacional do campo ("já é cliente?") ganha o canal mais forte. A escala completa e a regra de derivação vivem em [[estabelecimento]] §5.

**Eixo 1 — COR = relação comercial.** Deriva de `cadastrado` (do ERP), logo **continua nunca sendo digitada**.

| Relação | key | Cor | Quando |
|---|---|---|---|
| Cliente | `cliente` | `#2053CE` azul da marca | `cadastrado = true` (é quem está em CSC/Aquisição no funil) |
| Lead | `lead` | `#A78BFA` lilás claro | qualquer outro |

> Azul e lilás foram escolhidos porque o time **já lê lilás como "lead"**. O par carrega contraste forte de **luminosidade** (escuro × claro), então sobrevive em escala de cinza e no daltonismo — a cor não é a única diferença.

**Eixo 2 — PISTA = origem / confiança.** Escada **aditiva** de 3 degraus (`cnpj` ⊂ `google` ⊂ `validado_campo`): todo ponto nasce da base de CNPJ, o Google enriquece, o campo confirma. O pin mostra **só a pista do degrau mais alto** que alcançou.

| Degrau | key CSS | Confiabilidade | Pista (não-cromática) |
|---|---|---|---|
| CNPJ | `cnpj` | Menor | **borda tracejada 1.5px** — e é o único **sem** selo |
| Google | `google` | Média | **badge `G`** no canto |
| Validado em campo | `validado_campo` | Máxima | **badge `✓`** no canto |

> A cor da relação entra via variável `--pin`; o miolo do pin é um dot branco; o selo é um círculo **branco** com anel `--pin` (legível sobre azul e sobre lilás). Os dois códigos se repetem na legenda (que passou a ter duas seções) e nos dots da lista (Inteligência) e do Funil. O **card de origem no sheet** é de propósito **cinza neutro** — tingi-lo com a cor da relação faria a confiança parecer cromática outra vez. *(O emoji de tipologia é previsto no CSS mas **não é renderizado** no `map.js` — o marker é origin-only. Ver [[spec-01-mapa]] §3.)*
>
> ⚠️ **A inversão-tese "Google puro > CNPJá puro" ficou DORMENTE, não revogada** — sem a categoria "só Google", ela não tem sujeito. Se um dia entrar ponto sem CNPJ, ela volta a valer e vira um 4º degrau.

### 2.4 Qualidade (Ouro/Prata/Bronze)

Derivada do CNAE (ver [[cnae_tier]]). Aparece como pill no sheet, badge na lista e chips no filtro.

| Tier | Hex |
|---|---|
| Ouro | `#C9971B` |
| Prata | `#7E8CA0` |
| Bronze | `#B06A3B` |

> ℹ️ **O `#C9971B` ganhou um segundo uso em 29/07:** o botão de preset **🏆 Aquisição** na quickbar (§6.2b). A família semântica é a mesma — *alvo de valor* —, e o preset de fato exige Ouro **ou Prata**, então o dourado ali não significa "só ouro". Foi preferido a inventar um segundo dourado quase idêntico.

### 2.5 Ciclo de vida do cliente — 🟡 **chegou como filtro, ainda sem cor**

`status_cliente` **entrou no mesmo dia (29/07)**, com o vocabulário da operação: **`lead` → `csc` → `recorrente` → `churn`** (o doc supunha `ativo/em_risco/inativo/reconquistado` — ver [[estabelecimento]] §5). Entrou como **dimensão de filtro**, rotulada **"Status do cliente"**, e **não** ganhou cor própria: os chips usam o `--ink` padrão como os demais.

**Por que não ganhou cor.** É o mesmo eixo da §2.3 — `lead` é exatamente o lilás e `csc`/`recorrente`/`churn` são exatamente o azul —, então dar paleta própria a ele criaria **dois códigos de cor para a mesma informação**, em granularidades diferentes. A escolha foi manter a **cor binária** e deixar o refinamento no filtro e no sheet.

⚠️ **A dívida continua aberta, só mudou de forma:** abrir o azul de cliente em três tons (`csc` · `recorrente` · `churn`) é o próximo pedido natural — e aí vale a validação de paleta dos 5 checks, porque `churn` provavelmente quer um tom de alerta que não pode colidir com `Perdido` (§2.6) nem com o Danger. **Não foi feito antes do gate de propósito.**

### 2.6 Status do funil e resultado da tarefa

**Status do funil** (`STATUS` em `js/data.js`; colunas e dots vêm daqui — [[spec-06-funil]] §2):

**8 valores, 7 colunas** — `sem_plano` é o default e **não tem coluna** no Kanban (o funil é o pipeline, não a base — [[estabelecimento]] §5), logo **não precisa de cor**.

| Status | Família | Hex |
|---|---|---|
| *(Sem plano)* | fora do board | — |
| **Visita planejada** | entrada | `#94a3b8` |
| Visitado | escada (campo) | `#0ea5e9` |
| **TD encontrado** | escada (campo) | `#f59e0b` |
| **CSC** (cadastrado sem compra) | escada (**ERP**) | `#14b8a6` |
| **Aquisição** | escada (**ERP**) | `#10b981` |
| **Perdido** | saída lateral | `#9f1239` |
| **Desqualificado** | saída lateral | `#475569` |

> **Por que essas três** (aprovadas 27/07):
> - **CSC `#14b8a6`** — teal é o degrau *antes* do verde: cadastrado é conquista, mas não é receita, então não pode usar o verde cheio da Aquisição. Fica na rampa entre o âmbar do TD e o esmeralda.
> - **Perdido `#9f1239`** — vinho. Comunica "morreu" **sem** usar o `#dc2626` de Danger: mais escuro e menos saturado, não dispara leitura de erro do app. Mantém o calor do âmbar de onde a negociação veio — esfriou, não quebrou.
> - **Desqualificado `#475569`** — mesma família do cinza de `Visita planejada`, muito mais escuro. Distingue por **luminosidade**, não matiz, então sobrevive em escala de cinza e para daltônicos.
>
> Nenhuma das três usa o `#dc2626` de Danger — desqualificar e perder não são erro nem ação destrutiva (o pin nunca some). A **ordem** importa: as duas laterais vêm depois da escada e devem parecer um bloco à parte (ver [[spec-06-funil]] §2).
>
> **Dot sempre cheio** nas sete colunas. Cogitou-se anel no CSC (para separá-lo do verde da Aquisição sem depender de cor), mas foi **descartado**: o rótulo está sempre ao lado do dot, e contorno já é a linguagem de `origem_confianca` (§2.3) — dois significados para a mesma pista confundiriam mais do que resolvem.

**Resultado da tarefa** (badge de 4 valores no card de atividade e no histórico do pin — [[spec-07-atividades]] §7): `sem_avanco` · `td_encontrado` · `perdido` · `desqualificado`. **Reaproveita a cor do status homônimo** (`td_encontrado` `#f59e0b`, `perdido` `#9f1239`, `desqualificado` `#475569`); `sem_avanco` usa o `#0ea5e9` de Visitado, que é o seu efeito. Sem escala nova. **Não há `resultado = convertido`:** conversão vem do ERP, não de tarefa.

## 3. Tipografia

**Família:** stack nativa — `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Sem webfont (decisão: app de campo/offline). *(O SPEC 00 do CRM-KA usa Inter; aqui é deliberadamente nativo.)*

| Elemento | Tamanho | Peso | Cor |
|---|---|---|---|
| Título de sheet/modal | 18–19px | 700 | `--ink` |
| Título de bloco/card | 13px | 800 | `--ink` |
| Corpo | 13.5–14px | 400–600 | `--ink` / `--ink-2` |
| Label de grupo | 12px, UPPERCASE, `letter-spacing .04em` | 700 | `--muted` |
| Small / sub | 11–12.5px | 400–600 | `--muted` |
| Badge/pill | 11–12.5px | 700–800 | cor do badge |
| Números (CNPJ, durações) | — | 500 | `--ink-2`, `font-variant-numeric: tabular-nums` |

> **Inputs = 16px** sempre (evita zoom automático do iOS ao focar). Regra travada.

## 4. Tokens de forma, sombra e espaço

- **Raios:** `--r-sm 10px` · `--r-md 14px` · `--r-lg 20px` · `--r-pill 999px`.
- **Sombras:** `--shadow-sm` (cards/barras) · `--shadow-md` (flutuantes: legenda, FAB-locate, toast) · `--shadow-lg` (projeta pra **cima** — sheets e modais).
- **Alturas de barra:** topbar `56px` · quickbar `52px` (**oculta** no Funil e nas Atividades — §5.2) · bottomnav `56px` (todas + safe-area).
- **Safe-area:** `--sat` (topo/notch) e `--sab` (base/barra de gesto) somadas às barras e aos flutuantes ancorados no rodapé (FAB, toast).

## 5. App Shell — estrutura

Layout em coluna, `height: 100dvh`, **`overflow: clip`** (o app não rola; o conteúdo interno rola). O mapa é `flex: 1` e **tudo mais flutua sobre ele**.

> 🔧 **`clip`, não `hidden` (30/07) — e a diferença era um bug.** Os sheets fechados moram **abaixo** do fim do `#app` (`position: absolute` + `transform: translateY(101%)`), e transform **entra na área rolável**: com `overflow: hidden` o `#app` era um contêiner de scroll de `1318px` numa janela de `720px` — ~600px de nada embaixo. O usuário não podia rolar (é isso que `hidden` faz), mas `scrollIntoView`/`focus()` **de dentro do app podia**: o drill da Gerencial (§6, `vaiPraTabela`) rolava o `#app` inteiro, a topbar subia e o **painel de filtros fechado aparecia sob a bottom nav** — sem gesto que desfizesse, só recarregando. `overflow: clip` corta igual e **não cria scroller**, então `scrollTop` fica travado em 0 e o `scrollIntoView` só mexe no contêiner que devia mexer (`.ativ-body`). A linha `overflow: hidden` fica antes, como fallback para navegador sem `clip` (Chrome 90+ / Safari 16+ — dentro do alvo Android PWA).
> ⚖️ **Regra que fica: contêiner que só existe para cortar usa `clip`, não `hidden`.** `hidden` é um scroller que finge não ser — e basta um `focus()` interno para o app inteiro sair de lugar. Só use `hidden` onde o scroll programático é desejado.

```text
┌───────────────────────────────────────────┐
│ TOPBAR (56)   ◈ CRM Externo   [count] [⟲]  │  z 40
├───────────────────────────────────────────┤
│ QUICKBAR (52) [chips de filtro…]  [Filtros]│  z 39
├───────────────────────────────────────────┤
│                                           │
│                 MAPA (flex:1)             │  z 1
│         ◎ (locate)              ＋ (FAB)   │  z 30
│    [legenda]        [banners de modo]     │
│                                           │
├───────────────────────────────────────────┤
│ BOTTOM NAV (56) 🗺️ Mapa|📊 Funil|🗓️ Ativ.|📋 Intel.│  z 41
└───────────────────────────────────────────┘
```

### 5.1 Pilha de z-index (a espinha do shell)

| Camada | z-index |
|---|---|
| Mapa | 1 |
| Abas Funil / Atividades / Inteligência (cobrem o mapa) | 25 |
| FAB criar / FAB localizar | 30 |
| Banners de modo (placing/moving) | 35 |
| Popover de classificação (+backdrop 37) | 38 |
| Quickbar | 39 |
| Topbar | 40 |
| Bottom nav | 41 |
| Install toast | 44 |
| Backdrop de sheet/filtro | 45 |
| Sheet / painel (bottom) | 50 |
| Toast / modal de criação | 60 |

### 5.2 Navegação

Bottom nav de **4 abas**, nesta ordem: **🗺️ Mapa · 📋 Intel. · 📊 Funil · 🗓️ Atividades**. As quatro **compartilham o mesmo conjunto filtrado** (mudar filtro atualiza todas). Não há sidebar (contraste deliberado com o CRM-KA). Aba ativa: cor `--brand` + barrinha de 3px no topo do tab. Com 4 abas o rótulo de Inteligência encurta para `Intel.`; abaixo de 360px o rótulo pode ceder ao ícone. Nas abas que cobrem o mapa (z 25), os controles do mapa (FAB, banners) somem.

> ⚖️ **A ordem agrupa por natureza, não por importância:** **Mapa** e **Intel.** são o *mesmo conjunto* em duas formas (mapa e lista) e mantêm a quickbar; **Funil** e **Atividades** são o *pipeline de trabalho* e **escondem a quickbar** (abaixo). A fronteira cai no meio da nav.

**A quickbar some no Funil e nas Atividades.** Ela é o filtro **do mapa**: nessas duas abas não é útil e custa `52px` de altura, que voltam para o conteúdo. O filtro **continua valendo** — as duas leem o conjunto filtrado —, então, para o filtro não ficar invisível, o *head* da aba mostra um pill **`N filtros do mapa`** quando há algum ativo, e tocá-lo devolve ao Mapa. Ver [[spec-06-funil]] §5 e [[spec-07-atividades]] §6.

**Tela de entrada (porteiro).** Em build com porteiro configurado (`js/config.js`), o app abre numa **tela de login** sobre o shell (`#login-gate`, z 100): login `@praso.com.br` carrega o dado real; **"Seguir sem login"** segue no fictício, com um "Entrar" no topo para logar depois. Sem porteiro, vai direto ao mapa. (Detalhe do fluxo em `porteiro/README.md`.)

## 6. Componentes

### 6.1 Pin (componente-assinatura)
Corpo circular **28px**, borda branca 2.5px, cauda (tip) abaixo; `divIcon` **36×40**, âncora `[18,38]`. *(Era 34px em 42×50 até 29/07 — encolheu porque com 61 pontos clusterizados o pin dominava o mapa.)* `--pin` = **cor da relação** (cliente × lead); dot branco central de 9px; **selo de canto** 15px = pista do degrau de origem (`G` / `✓`). Estados: `is-selected` (escala 1.22 + halo brand), `--moving` (escala + halo), `--new` (animação `pinPop`), `--temp` (pulso roxo `pulse`). Pista do degrau baixo: `cnpj` **borda tracejada 1.5px** — afinada de 2.5px porque em 28px o traço grosso fazia o círculo ler como engrenagem e comia a silhueta de pin. Ver §2.3 e [[spec-01-mapa]] §3.

### 6.2 Chips de filtro / quickbar
Pill com borda `--line-2`; ativo = fundo `--ink` texto branco. Os chips de **origem** deixaram de ter cor própria (29/07) e passaram a **ensinar a pista**: o de CNPJ nasce com a borda tracejada, os outros dois trazem o glifo no rótulo (`G Google`, `✓ Validado em campo`). Os **baldes de vocabulário** — `Sem Zona` e `Sem porte` — vão em *itálico apagado* (`.chip--sem-valor`): são **ausência com nome**, não categoria, e não devem ler como os valores de verdade ao lado. Atalho "Tipologia" abre popover de tipologias; badge numérico mostra quantos ativos.

> ⚖️ **Padrão: o vazio ganha nome em vez de desaparecer** (29/07, duas vezes). Num filtro inclusivo (conjunto vazio = tudo; cheio = só esses), um campo nulo não casa chip nenhum e o pin **sai silenciosamente** de qualquer recorte daquela dimensão. Foi o que aconteceu com a zona e depois com o porte — no segundo caso escondendo justamente o **pin criado em campo**, cujo porte só chega quando o CNPJá responde. A regra que fica: **dimensão que aceita nulo precisa de balde explícito**, com chip próprio e estilo de balde.

### 6.2b Botão de preset (`.quick--aq`) — **dourado**

Variante da quickbar que **não é uma dimensão**: um toque liga **um conjunto** de filtros. Hoje existe um, **🏆 Aquisição** (regra em [[spec-01-mapa]] §5).

- **Dourado `#C9971B`** — o **mesmo** da qualidade Ouro (§2.4), de propósito: um segundo dourado quase igual na tela seria pior que um dourado com dois usos da mesma família semântica — **"alvo de valor"**. Não colidem no mesmo lugar: o chip de Ouro vive no painel, e este botão na quickbar, de onde o "🥇 Ouro" saiu no mesmo dia.
- **Estado por inversão de fundo, não por matiz:** desligado = `#fdf3d7` com borda `#e3c46a` e texto `#6d5200`; ligado = `#C9971B` sólido com texto `#2e2205` e anel `rgba(201,151,27,.22)`. É a mesma gramática claro→sólido dos outros chips. **Texto escuro, não branco** — branco sobre `#C9971B` dá ~2,6:1, insuficiente.
- **Estado derivado, nunca guardado:** aceso ⟺ os conjuntos são exatamente os do preset. Mexer num filtro do preset apaga o botão sozinho; botão de preset que fica aceso depois de o usuário mexer é botão que mente.

### 6.3 Botão Filtros
`.filters-btn` — fundo `--brand`, pill, com badge branco de contagem. Abre o painel de filtros (bottom-sheet).

### 6.4 Legenda
Card semi-transparente (`backdrop-filter: blur`) colapsável, ancorado no canto do mapa. Repete cor + pista não-cromática + rótulo de confiança das 4 origens.

### 6.5 FAB
Pilha de **três**, no canto inferior-direito, de baixo para cima: `＋` criar (58px, `--brand`, sombra colorida) · `◎` localizar (46px, branco) · **`🧭` montar rota** (46px, branco — 31/07). Todos esmaecem (opacity .3) durante **qualquer** modo do mapa (`placing` · `moving` · `is-rota`), **inclusive o que abriu o modo**: a saída é o banner, não o botão que ligou.

> ⚖️ **O 3º FAB é uma TROCA registrada, não uma adição.** A pilha vai a ~180px dos ~648px de mapa em 375×812 (**28% da borda direita**), e três círculos iguais não têm hierarquia — o `＋` deixa de ser *o* botão do canto. Foi escolhido por **descoberta**, contra uma alternativa de custo permanente zero (entrada pelo pin sheet) que fica descrita em [[spec-01-mapa]] §6.2 para não precisar ser redescoberta se a coluna apertar. **Regra que fica: a 4ª peça nesta coluna precisa tirar uma.**

### 6.6 Sheet / Painel (bottom sliding)
Base comum: sobe de baixo (`translateY`), `border-radius` no topo, `max-height 86dvh`, handle de 40×4px, `--shadow-lg`. Usado por: **pin-sheet** (detalhe do local), **painel de filtros**. Transição `.3s cubic-bezier(.22,.61,.36,1)`. No desktop (≥620px) viram cards flutuantes centralizados.

### 6.7 Pin-sheet (anatomia)
Avatar (cor da origem + emoji) · nome + sub · **origin-card** (badge + escada de confiança em dots) · **info rows** (chave/valor) · **blocos** (atividades, notas) · **notas** (sempre visíveis; nota = cartão âmbar; input inline). Botões check-in (verde) / check-out (âmbar).

**Sub-telas.** O sheet empilha telas em vez de crescer: cabeçalho `.sheet__head--sub` com **`.sheet__back`** (círculo `34px`), título do recorte e o nome do ponto por baixo. Toda tela nova entra com `scrollTop = 0`; reabrir o pin volta à tela raiz. Linha de item navegável = **`.ativ-item`** (emoji · duas linhas de texto · chevron). Usado pela lista e pelo detalhe de atividade ([[spec-07-atividades]] §2.2).

> **Bloco longo dentro do sheet vira sub-tela, não rolagem.** O sheet tem `max-height: 86dvh` e conteúdo obrigatório embaixo (as notas, CAP-3): qualquer lista que cresça sem limite empurra o invariante para fora da tela. Regra: mostra as N primeiras + `Ver todas (N) ›`.

### 6.7.1 Duas ações no bloco de atividades (`.check-actions`)
**Primária** `📍 Check-in` (`flex: 1`) e **secundária** `＋ Agendar` (ghost, largura do conteúdo) — visitar agora e planejar depois são intenções diferentes, e a de campo é a primeira. Com visita em andamento a primária vira `⏱️ Check-out` e entra `.ativ-tipo-atual`: faixa verde-clara com espinha `#10b981`, dizendo o tipo e a hora do check-in.

> ⚖️ **O bloco não pede nada — só age.** Chips de tipo já moraram aqui, acima do botão, e saíram: quem está na porta do cliente não classifica visita. Formulário de campo se resolve **no momento em que a informação existe**, e para o tipo esse momento é o check-out (§6.7.2). O check-in é um gesto único. Ver [[spec-07-atividades]] §2.3.

### 6.7.2 Formulário dentro do sheet (`.sform-*`)
O padrão das duas telas de formulário do pin-sheet — **conclusão** (check-out) e **agendar** —, que em 28/07 substituíram **seis `window.prompt`**. São sub-telas (§6.7), **não sheet sobre sheet**: empilhar dois bottom sheets pediria segundo backdrop e camada nova de z-index para uma tela que sempre pertence a **um** ponto.

Padrão do campo: **label 10.5px caixa-alta** (`.sform-lbl`) + controle + **hint 11px** (`.sform-hint`). A obrigatoriedade vai num `<em>` minúsculo ao lado do label (`obrigatório`/`opcional`) — **sem asterisco**, que exigiria legenda em algum lugar da tela.

- **Chips para escolha fechada e CURTA** (`.sform-chips`, reusa o §6.2) — em três valores o dedo escolhe direto, e o default já é a resposta provável. ⚠️ **Deixaram de servir ao resultado e ao motivo em 28/07** (ver checkbox e select abaixo), e em **03/08 perderam o último caso de uso**: o **tipo da visita** virou derivado em 5 valores e só se lê ([[tarefa]] §4c). **`.sform-chips` fica sem consumidor no padrão** — o componente permanece documentado (a próxima escolha fechada e curta o reusa), mas nenhuma tela o instancia hoje. Registrado para não parecer código morto por descuido.
- **Checkbox** (`.sform-check`, 28/07) — quando as opções **combinam** entre si, e não são uma escolha única. É `button[role=checkbox]` com quadrado desenhado, **não `<input>`**: numa tela toda delegada, o input nativo dispara `click` e `change` no mesmo gesto. Marcado = borda + fundo `--brand-050` e rótulo 700. `is-locked` é a opção que outra implica (opacidade .62, toque sem efeito) — **nunca `disabled`**: checkbox apagado no Android lê como tela travada.
- **Select nativo a 16px** (`.sform-sel`, 28/07) — escolha fechada **longa** (a partir de ~8 valores). O vocabulário de não venda tem 14: em chips vira uma parede que empurra o botão de enviar para fora da tela. `appearance: none` + seta em `data:` SVG, porque a nativa some junto.
- **Textarea** (`.sform-txt`, 28/07) — texto de mais de uma linha (notas da visita). Mesma caixa do input, `min-height: 74px`, `resize: vertical` apenas — horizontal quebraria o sheet.
- **Ajuda inline `(i)`** (`.sform-i` + `.sform-ajuda`, 28/07) — círculo 28px ao lado do rótulo ou da caixa; ao toque abre um parágrafo `--brand-050` **abaixo**, um por vez, e o mesmo toque fecha. **Não é tooltip**: hover não existe no celular, e overlay flutuante dentro de um sheet que rola briga com o scroll. Serve às distinções que não se aprendem olhando — *desqualificar × perder × não venda*.
- **Campo condicional:** no check-out, o campo de motivo depende de qual caixa está marcada, e trocar o desfecho **zera** o motivo — o vocabulário é outro.
- **Grupo revelado por checkbox** (`.sform-sub`, 30/07) — quando marcar uma caixa abre um **mini-formulário** dentro do campo (agendar a próxima visita, no check-out). Recuo de 11px + filete `--line-2` à esquerda: solto, ele leria como mais três campos do formulário, e ninguém saberia que **desmarcar os apaga**. O rascunho **sobrevive ao re-render** — desmarcar e marcar de novo devolve o que já foi digitado, em vez de punir quem tocou errado.
- **Inputs nativos a 16px** (`.sform-inp`), pela regra travada do §3 (sem zoom no iOS): `date`, `time` e texto. Picker de calendário e de relógio são do sistema — sem build, sem componente novo para manter.
- **O botão diz o que falta**, desabilitado, em vez de recusar depois do toque: `Escolha o motivo da não venda` → `Descreva o motivo` → `Escolha o dia da próxima visita` → `✓ Concluir atividade`; `Escolha o dia` / `O dia já passou` → `＋ Agendar visita`. Validação que aparece só depois de tentar obriga a errar primeiro. ⚠️ **Campo opcional que vira obrigatório entra nessa fila:** ligado o agendamento no check-out, o dia passa a ser cobrado — e é o rótulo do botão que conta isso, não um erro depois.
- **Nota de consequência antes do botão** (`.sform-nota`), quando o envio muda estado fora da tela: *"Agendar coloca {ponto} no funil, em Visita planejada"*. Quem está a um toque de mexer no board deve saber **antes** do toque.
- **A faixa do topo diz o estado do check-in em curso** (`.ativ-tipo-atual`, verde): hora e minutos em campo — e, quando a distância passou do raio, `remoto (1,2 km do pin)`. O vendedor fica sabendo **como a visita vai ser classificada antes de fechar**, não depois, na coluna da gerencial. *(Uma faixa âmbar `.conc-remota` existiu aqui por uma hora, avisando que "sem check-in a atividade será remota" — a premissa estava errada e ela saiu: ver [[spec-07-atividades]] §2.)*

> ⚖️ **Tela que se re-renderiza a cada toque pede delegação de evento**, não listener por elemento: o nó que recebeu o listener morre no próximo render. Um `click`/`input`/`change` no container que sobrevive, e o `data-*` diz qual campo mudou. **Texto e textarea não re-renderizam** — refazer o HTML a cada tecla tira o foco do campo; quem reflete o estado é o botão, atualizado à mão. **Select re-renderiza** (escolher `Outro` revela o campo de texto), com guarda de valor igual para o par `input`+`change` não custar dois renders.

> ⚖️ **Escolha única = chip; opções que combinam = checkbox** (28/07). O check-out tinha um chip de `Resultado` de quatro valores e virou quatro caixas, porque *encontrou o TD* e *vendeu* são verdadeiros **ao mesmo tempo** — chip prometia exclusividade que o domínio não tem. E quando algumas caixas **são** mutuamente exclusivas (vendeu × perdeu × desqualificou), marcar uma **desmarca** as outras em vez de desabilitá-las: a regra fica mais clara sendo aplicada do que sendo proibida, e o dedo sempre faz o que mandou. A mesma regra vale nos dois lados — a tela e o store chamam a **mesma** função de normalização, senão a tela promete um desfecho que a gravação desfaz.

### 6.8 Modal de criação
Sobe de baixo, borda superior 3px `--brand`, **sem scrim bloqueante** (o mapa e o marcador roxo seguem arrastáveis por trás). Campo básico (nome) + "Mais detalhes" expansível (tipologia, CNPJ, telefone) + dica de qualidade derivada.

### 6.9 Card de lead (aba Inteligência)
Linha com dot de origem (mesmas pistas do pin), nome, sub, CNPJ e badge de qualidade. Toque foca o pin correspondente no mapa.

> **Busca de estabelecimento — uma só para o produto** (`CRM_DATA.matchBusca`, 28/07): **nome fantasia · razão social · CNPJ**, acento-insensível nos nomes e **por dígitos** no CNPJ (`14066` acha `14.066.645/0001-46`). Usada pela Inteligência **e** pela barra de filtros da aba Atividades (§6.12) — busca que se comporta diferente em duas telas do mesmo app é bug de produto, não variação. Rótulo `Buscar`, placeholder que **nomeia os três campos**: campo de busca que não diz o que aceita faz o usuário testar.
> ✅ **Levada às últimas consequências em 29/07: a busca virou DIMENSÃO DE FILTRO** (`CRM_FILTERS.q`) e ganhou uma caixa na quickbar do Mapa. A busca vale nas **quatro abas** e conta no badge de Filtros. Era o passo que faltava: a Intel prometia "o mesmo conjunto filtrado do mapa" e, buscando por conta própria, mostrava outro. Detalhe em [[spec-01-mapa]] §5.2.
> 🔧 **30/07 — e a Intel deixou de ter caixa própria (`.intel-search` removido).** A quickbar aparece nessa aba, então a lupa aberta dava **duas caixas empilhadas** para um controle só. Regra que fica: **dimensão de filtro compartilhada tem UM controle na tela** — se a barra do controle já está visível na aba, a aba não repete o campo.

### 6.2c Campo de busca da quickbar (`.qsearch`)

Lupa fechada → **campo de largura cheia** que substitui os chips (`.quickbar.is-searching`), com `×` para fechar. Input a **16px** (regra travada da §3: abaixo disso o iOS dá zoom ao focar).

- ⚠️ **Alternância por classe explícita, nunca `[hidden]`** — a quickbar é `flex` e `[hidden]` perde para `display:flex`. Armadilha já paga duas vezes neste CSS.
- A lupa fica **acesa** (`--ink`, como qualquer chip ativo) quando há termo, e **termo ativo reabre a barra sozinho**: barra fechada com busca ativa seria **filtro invisível** — o erro que a gaveta "Mais" da §6.12 cometeu e que foi revertido.
- **Fechar limpa o termo.** `Esc` fecha e limpa. Já o `Limpar` do painel zera a busca mas **deixa a barra aberta e vazia**: o botão de limpar aparece justamente quando a busca não achou nada, e fechar o campo tiraria o teclado de baixo do dedo de quem quer corrigir o termo.

**Dropdown de sugestões** (`.qsug`) — abre abaixo do campo, **dentro da quickbar** para herdar o stacking dela (z 39) e cair sobre mapa, FABs e banners sem z-index próprio. `max-height: 46dvh` com rolagem. Item = emoji da tipologia · nome · `bairro · cidade · CNPJ` · dot da relação/origem (§2.3). Teto de **8** com rodapé *"Mostrando 8 de N"* — **teto silencioso mentiria** sobre o tamanho do resultado. Regra em [[spec-01-mapa]] §5.2.

**Item fora do recorte** (`.qsug__item--oculto` + `.qsug__tag`): fundo `#fffbeb` e etiqueta `fora do filtro` em `#fde68a`/`#7c2d12`. **Âmbar, não Danger** — é ressalva de procedência, como a `.sim-banner` e a nota da legenda, não erro.

**Pin revelado** (`.pin--revelado`): anel externo `#f59e0b` + halo — o ponto está no mapa apesar de os filtros o esconderem. O anel é **externo** de propósito: o tracejado da **borda** já é a pista de origem `cnpj` (§2.3), e dois códigos na mesma superfície se confundiriam.

> ⚖️ **Padrão: revelar em vez de mexer no filtro** (29/07). Quando a tela precisa mostrar algo que o recorte esconde, a saída **não** é alterar os filtros por baixo — isso destrói o recorte que a pessoa montou, que é justamente o que ela quer de volta depois. A saída é uma **exceção visível**: fora do `matches` (para pill, badge e as outras abas seguirem verdadeiros), com pista permanente na tela, e com fim claro — aqui, **trocar de pin** ou o ponto voltar a caber no filtro.
> ⚠️ **O que NÃO pode encerrar a exceção: fechar o sheet.** Com `max-height: 86dvh` o sheet cobre o mapa quase todo (em 390×844 sobram ~10px de mapa livre), então **fechar é o gesto de "quero ver o que achei"**. A primeira versão dispensava ali e o ponto sumia na hora exata em que deveria aparecer — o recurso inteiro virava nada. Regra que fica: **exceção visual não termina no gesto que serve para vê-la.**

> ⚙️ **Lista que se redesenha a cada tecla escuta `pointerdown`, não `click`.** No toque, o `blur` do input dispara antes do `click`, e o item já foi removido do DOM: a escolha se perde. Vale para qualquer autocomplete deste app. E vale a regra geral do §6 — **delegação**, nunca listener por item.

### 6.10 Segmented control (`.seg`)
Trilha de abas internas no topo de uma view full-screen, abaixo de nada e acima de tudo. Botões de largura igual (`flex: 1`), rótulo 12.5px/700 em `--muted`; ativo = cor `--brand` + borda inferior 3px `--brand`. `role="tablist"` + `aria-selected`. Usado pela aba Atividades (**Rotas · Agenda · Gerencial** — [[spec-07-atividades]] §4).

> **Foi de dois para três botões em 31/07**, e em 375px cabe: com `flex: 1` cada alvo fica em ~125px, bem acima do mínimo de toque. **Rótulo de uma palavra é requisito, não estilo** — a quarta palavra é o que quebraria a trilha, e é por isso que "Visão gerencial" se chama `Gerencial` aqui.

### 6.11 Pill de filtro herdado (`.head-filtro`)
Pill pequeno `--brand` sobre `--brand-050`, no *head* das abas que escondem a quickbar (Funil e Atividades). Aparece só quando `CRM_FILTERS.activeCount() > 0`, diz `N filtro(s) do mapa` e, ao toque, volta para o Mapa. Existe para que esconder a quickbar não crie **filtro invisível** — a aba mostra menos dado do que a base e o usuário precisa saber por quê.

### 6.12 Barra de filtros de aba (`.ativ-filtros`)
Faixa `--surface-2` logo abaixo do segmented control, separada por `--line`. Peças: **grade de 2 colunas** (`.ativ-grid`) de **`<select>`/`<input>`** rotulados (`.ativ-sel`) · **trilha de chips rolável na horizontal** (`.ativ-chips` — reusa o chip do §6.2, ativo `is-on`; a trilha sangra o padding lateral com `margin: 0 -12px` para o chip não parecer cortado, e esconde a barra de rolagem) · **par de `input[type="date"]`** (`.ativ-custom`, revelado só no preset personalizado — precisa de `[hidden]{display:none}` explícito porque `display:flex` vence o `[hidden]` do UA).

> **Filtro não se esconde — mas filtro que não age não aparece.** Uma gaveta "Mais" chegou a existir aqui e foi removida: economizava 39px de altura ao custo de o usuário não descobrir os controles. Em vez de esconder, **marcar** — controle com valor diferente de `Todos` ganha `.is-on` e vira `--brand`, para dar de relance a leitura do que está agindo. Mesmo princípio do pill de filtro herdado (§6.11). Busca em campo de texto usa *debounce*, nunca re-render por tecla.
>
> ⚖️ **A barra pode variar por recorte** (28/07): na aba Atividades, três dos cinco controles existem só na Gerencial e a Agenda mostra dois. A regra que continua valendo é o **par indissociável** — o controle desaparece **e** o filtro deixa de ser aplicado. Esconder um controle que continua filtrando é o filtro invisível que esta barra existe para evitar; esconder um que não filtra é só não mentir sobre o que a tela faz. Cada célula oculta usa `[hidden]` + a regra explícita `.ativ-sel[hidden]{display:none}` (`[hidden]` perde para `display:flex`).

> Filtro de **conteúdo da aba**, não do mapa: nunca escreve na quickbar. O `input[type=date]` é **nativo de propósito** (sem build, date picker do sistema no Android) e é o único controle do app fora dos tokens.

### 6.13 Gráficos (visão gerencial)
Sem lib: SVG/CSS puro, coerente com o "sem build" (o Leaflet é vendorizado, não CDN). Três peças, todas com **drill ao toque** — marca que não abre nada é regressão:

- **Número-manchete** (`.ger-hero strong`) — `≥48px`, peso 800, **figuras proporcionais**; nunca `tabular-nums` (afrouxa dígito grande) e nunca serifa/display.
- **KPI tile** (`.ger-kpi`) — grid de 3, número `21px` + rótulo `10px` caixa-alta + **terceira linha com o denominador** (`.ger-kpi__s`). Quando os tiles formam um funil, cada um é % do **anterior**, e a terceira linha diz de quê — percentual sem denominador visível é número solto. Variante `--late` pinta número e borda em `#9f1239`.
- **Barra empilhada 100%** (`.ger-stack`) — a forma de **parte-do-todo** (donut é reservado a "à primeira vista, ≤6 fatias"; em 375px a empilhada é mais precisa). Altura `14px`, cantos `4px` só nas pontas, **respiro de 2px entre segmentos** — que é a superfície aparecendo, não borda —, `min-width: 4px` para fatia mínima nunca sumir. Legenda (`.ger-legenda`) obrigatória, com dot + rótulo + número, alvo de toque `≥24px`. **Segmento mostra, legenda leva:** o segmento é alvo de tooltip e a legenda carrega o drill — no toque, um gesto não pode abrir detalhe *e* navegar.

- **Coluna empilhada por dia** (`.ger-barras` / `.ger-col`) — série temporal com identidade por vendedor. Janela **fixa de 7 dias**: as colunas dividem a largura (`flex: 1`, ~47px) em vez de rolar, respiro de `2px` entre segmentos, total em cima, data embaixo. Quando há dois gráficos irmãos, **uma escala só** para os dois — alturas que não se comparam são pior que nenhum gráfico. Janela fixa dentro de uma tela filtrada exige **selo visível** (`.ger-l7d`): filtro que não age precisa dizer que não age.
- **Tooltip de gráfico** (`.ger-tip`) — painel escuro `#1e293b`, `position: fixed`, preso dentro da viewport (vira para baixo quando não cabe em cima). Linhas com dot · rótulo · valor · **%**, e uma linha de **Total** separada por régua. Disparado por `pointerover` (cobre mouse e toque) e por `focusin` (teclado); some no `scroll`. `pointer-events: none` para não roubar o toque da coluna. Estado vazio é **texto**, nunca ausência.
- **Tabela pivô** (`.ger-pivo`) — cruzamento de duas dimensões nominais, com totais de linha e coluna. Números à direita, `tabular-nums`, célula vazia como `·` discreto. Célula = drill de dois critérios.
- **Tabela detalhada** (`.ger-tab`) — rola nos dois eixos, cabeçalho `sticky`, cada cabeçalho ordena (mesma coluna inverte). **Vazio vai para o fim nas duas direções** e **teto de linhas é declarado na tela**.

**Duas paletas categóricas, validadas por script:** `resultado` reusa as cores de status (a cor segue a **entidade** — é o mesmo `resultado` que pinta o pin) · **vendedor** tem paleta própria — `#6d28d9` · `#db2777` · `#65a30d` — presa ao **id**, nunca à posição, e que **não toca** nas cores de status.

**Regras de cor que valem para qualquer gráfico daqui em diante:** hue categórico em **ordem fixa do enum, nunca por ranking** (a cor segue a entidade — filtrar não pode repintar quem sobrou) · **uma cor só** para todas as barras de uma mesma série (colorir por tamanho duplica o comprimento) · paleta categórica **validada por script antes de subir**, nunca no olho · cor **nunca sozinha**: rótulo + número sempre presentes · e **`tabular-nums` só onde número alinha na vertical** (coluna de tabela, tick de eixo), nunca em número grande solto. Ver o laudo das cores de `resultado` em [[spec-07-atividades]] §5.3.

### 6.14 Faixa de procedência (`.sim-banner`)
Faixa âmbar (`#fef3c7` sobre texto `#7c2d12`, borda `#f59e0b`) presa ao topo de uma aba, **fora da área que rola**. Só existe sob `body.real-mode`. Avisa que o que está abaixo é **dado verdadeiro com atividade simulada** ([[spec-07-atividades]] §5.6) — hoje nas abas Atividades e Funil.

> **Âmbar, não Danger.** Não é erro nem ação destrutiva: é aviso de **procedência**. E fica fora do scroll de propósito — um print recortado do gráfico tem que sair com o aviso junto, senão o número circula sozinho como se fosse real.

### 6.15 Transientes
**Toast** (pill escuro, rodapé, acima da nav) · **banners de modo** (`placing`/`moving`, faixa escura no topo do mapa) · **install-toast** (Android, "Adicionar à tela inicial") · **empty states** (mapa e lista, com CTA "Limpar filtros").

**E uma faixa que NÃO é transiente: a visita em andamento** (`.checkin-banner`, 29/07 — [[spec-07-atividades]] §2.4). Mora aqui porque compartilha a forma dos banners de modo (faixa de 14px de raio presa ao container do mapa), mas é o oposto deles em três pontos: **fica enquanto o estado durar** (não é aviso de um gesto), **é um `<button>` inteiro** (levar ao check-out é a função dela, não um botão dentro da faixa) e **veste a cor do domínio** — verde `#10b981` do `.btn--checkin`, âmbar `#f59e0b` do `.btn--checkout` quando a visita está esquecida. Fica no **rodapé** (`bottom: 20px`, à esquerda dos FABs) porque o topo já é dos dois banners de modo, que se sobreporiam.

> **Padrão que fica: faixa persistente de estado = cor do domínio; faixa de modo = `--ink`.** Escuro diz *"você está num modo, e ele acaba"*; a cor do domínio diz *"existe um registro aberto"*. Somar as duas linguagens num elemento só faria a visita em curso parecer um modo do mapa, que é o que ela não é. E, sendo persistente, a faixa **cede o rodapé** a quem manda ali: some com `body.sheet-open` e nas abas que não são o mapa.

### 6.16 Calendário da Agenda (`.ag-*`)
Formato de agenda-lista (molde do Google Agenda), na aba Atividades — [[spec-07-atividades]] §4.2. Uma variável de sarjeta (`--gut: 52px`) governa as três peças, e é ela que faz a coluna da esquerda existir como coluna:

- **Bloco de dia** (`.ag-dia` + `.ag-dia__h`) — cabeçalho `position: sticky` sobre `--bg` com borda inferior: **dia de calendário na sarjeta** (`DOW` 9.5px/800 caixa-alta + número 19px `tabular-nums`) e, à direita, título (`Hoje` · `Amanhã` · `4 de agosto`) com contagem em `small`. **Hoje ganha disco `--brand`** com número branco — é a âncora visual da lista.
- **Item** (`.ag-item`) — `flex` de três partes: sarjeta de **horário** (`.ag-h`, 12.5px/800 `tabular-nums`) · corpo (nome como `button`, subtítulo, e a anotação do agendamento em `.ag-nota`) · botão redondo de 28px para cancelar (`.ag-x`). Sem horário, a sarjeta diz **`dia inteiro`** (`.ag-h--all`, 9.5px caixa-alta) e o item vai para o topo do dia: sarjeta vazia lê como dado faltando.
- **Bloco de rota** (`.ag-rota`) — cartão com **espinha de 3px `--brand`** à esquerda e cabeçalho em grade de 3 colunas (ícone · nome · ação), com a linha de meta ocupando as colunas 2–3. As paradas ficam em `<ul>` (`.ag-paradas`) separadas por `1px dashed` — **`ul` e não `ol` de propósito**: rota é conjunto, não sequência ([[rota]] §2). A variante **avulsa** (`.ag-item--avulsa`) é o mesmo item em cartão com espinha `--line-2`: mesma forma, hierarquia menor, sem espinha de marca.

> A espinha é o que faz N paradas lerem como **um** compromisso. Sem ela, uma rota de 5 paradas parecia 5 itens soltos — que era exatamente o problema que este formato veio resolver.

> **O card de atividade saiu.** A Agenda usava o card de lead (§6.9) como molde, com badge de `resultado`/`Atrasada` e botões de check-in/concluir. Ele foi **substituído** por estas peças em 28/07 ([[spec-07-atividades]] §4.2): o `.ativ-card` não existe mais, e do bloco antigo sobrou só o **badge** (`.ativ-badge`), ainda usado no histórico do pin **e na parada realizada do registro de rota** (§6.17).

### 6.17 Registro de rota (`.rt*`) — 31/07
A linha de rota **expansível** da sub-aba Rotas ([[spec-07-atividades]] §4.3). Três peças num cartão só:

- **Cartão** (`.rt`) — `--surface`, borda `--line` e **espinha de 3px `--brand`** à esquerda: a **mesma** do bloco de rota da Agenda (§6.16), porque é a mesma entidade vista de outro ângulo — trocar a cor faria parecer outra coisa. `overflow: hidden` para o rodapé de cancelar respeitar o raio.
- **Cabeçalho** (`.rt__h`) — um `<button>` de largura cheia em grade de 3 colunas (ícone · nome · chevron `›`/`▾`), com **duas linhas de meta** ocupando as colunas 2–3: `DOW dd/mm · vendedor` em `--muted` e a linha de **execução** em `--ink-2`/700 (`N paradas · 3 realizadas · 2 de pé`). A execução é a mais escura das duas porque é o que este recorte tem e a Agenda não.
- **Paradas** (`.rt__paradas` / `.rt__p`) — `<ul>` **sem marcador**, separadas por `1px dashed`: sarjeta de hora de 42px (`tabular-nums`) · nome como `button` · situação à direita. ⚠️ **`ul` e nunca `ol`**, e nenhum índice: rota é conjunto ([[rota]] §2).
- **Cancelar** (`.rt__x`) — faixa `--surface-2` no pé do cartão, largura cheia. Só renderiza quando há parada planejada.

> **Situação só ganha cor quando há desfecho.** Parada realizada usa o `.ativ-badge` na cor do `resultado` (a cor segue a **entidade** — §6.13); `planejada` e `cancelada` são texto cinza (`.rt-sit`), porque são **ausência** de desfecho e um badge colorido as faria parecer um estado conquistado.

### 6.18 Modo montar rota (`.rota-panel` + `.pin-wrap.is-na-rota`) — 31/07
As peças do 3º modo do mapa ([[spec-01-mapa]] §6.2). O **banner** reusa `.placing-banner` sem mudança — modo é modo, e a forma escura de `--ink` já significa *"você está num modo, e ele acaba"* (§6.15). O que é novo:

- **Painel** (`.rota-panel`) — cartão claro no canto **inferior-esquerdo**, com **espinha de 3px `--brand`** (a mesma do bloco de rota, §6.16 — é a mesma entidade). Contagem grande + dono numa **linha só**, e o botão embaixo. Mora onde a **legenda** estava, e ela sai por CSS (`body.is-rota .legend { display: none }`) enquanto o modo durar.
- **Pin escolhido** (`.pin-wrap.is-na-rota`) — anel `--brand` cheio + `✓` de 14px no canto **inferior-esquerdo**. O canto superior-direito é do selo de origem (`G`/`✓`, §6.1), e dois selos no mesmo canto se cobrem. ⚠️ **Marca, nunca número:** rota é conjunto, e "1, 2, 3" nos pins prometeria um sequenciamento que o objeto não guarda.
- **Sheet de nova rota** — reusa o **modal de criação** (§6.8) e ganha duas caixas de texto: `.rota-resumo` (fundo `--surface-2`, diz o efeito no funil **antes** do toque) e `.rota-aviso` (âmbar de procedência, §6.14 — a ressalva de ponto em saída lateral).

> ⚠️ **`flex: 0 0 auto` no `.rt` é obrigatório, e a falta dele é um bug bonito de ver.** O container (`.ativ-body`) é um flex column de altura definida, e **`overflow: hidden` desliga o tamanho mínimo automático do item flex** (`min-height: auto` só vale com overflow visível). Sem a linha, os 117 cartões encolhem para ~0px e a lista vira um monte de riscos horizontais — foi exatamente o que a primeira captura mostrou. O `.ag-rota` da Agenda nunca sofreu disso porque não tem `overflow`.
> ⚖️ **Regra que fica: filho de flex column com `overflow` precisa de `flex: 0 0 auto` explícito.** A propriedade que você pôs para arredondar o canto é a que tira a proteção de altura.

> **A porta de criar** (`.rt-nova`) — botão de largura cheia no **topo** da lista, `--brand-050` com borda **tracejada** `--brand`: tracejado porque é *criar*, não um item da lista. O subtítulo diz onde a escolha acontece (`escolher os pontos no mapa`) — botão que troca de tela sem avisar parece que não funcionou. Aparece também no estado vazio.

### 6.18 Modo montar rota (`.rota-panel` + `.pin-wrap.is-na-rota`) — 31/07
As peças do 3º modo do mapa ([[spec-01-mapa]] §6.2). O **banner** reusa `.placing-banner` sem mudança — modo é modo, e a forma escura de `--ink` já significa *"você está num modo, e ele acaba"* (§6.15). O que é novo:

- **Painel** (`.rota-panel`) — cartão claro no canto **inferior-esquerdo**, com **espinha de 3px `--brand`** (a mesma do bloco de rota, §6.16 — é a mesma entidade). Contagem grande + dono numa **linha só** (cada linha de altura ali é mapa coberto, e o painel fica justamente onde os pins escolhidos costumam estar), e o botão embaixo. Mora onde a **legenda** estava, e ela sai por CSS (`body.is-rota .legend { display: none }`) enquanto o modo durar.
- **Pin escolhido** (`.pin-wrap.is-na-rota`) — anel `--brand` cheio + `✓` de 14px no canto **inferior-esquerdo**. O canto superior-direito é do selo de origem (`G`/`✓`, §6.1), e dois selos no mesmo canto se cobrem. ⚠️ **Marca, nunca número:** rota é conjunto, e "1, 2, 3" nos pins prometeria um sequenciamento que o objeto não guarda.
- **Sheet de nova rota** — reusa o **modal de criação** (§6.8) e ganha duas caixas de texto: `.rota-resumo` (fundo `--surface-2`, diz o efeito no funil **antes** do toque) e `.rota-aviso` (âmbar de procedência, §6.14 — a ressalva de ponto em saída lateral).

> ⚖️ **Três coisas dividem o canto inferior, e a ordem de precedência agora está escrita:** a **faixa de visita em andamento** não cede a ninguém (é a única saída do bloqueio de 2º check-in, §6.15) · o **painel do modo** sobe para 76px quando ela está na tela (`body.checkin-open`) · a **legenda** sai inteira. Quem chega depois cede. É a primeira vez que três elementos disputam esse canto, e sem uma ordem declarada o próximo se sobrepõe a um deles em silêncio.

> ⚖️ **Banner e painel não dizem a mesma coisa** — a divisão é requisito, não estética: o banner é a **instrução**, o painel é o **estado + a saída**. E o banner **sai enquanto o sheet está aberto**: ele manda tocar nos pins com o mapa coberto, e instrução que não pode ser seguida é pior que nenhuma.

## 7. Ícones

Hoje **baseados em emoji/glifos** (vanilla, sem lib): `◈` marca · `＋` criar · `◎` localizar · `🧭` rota · `⟲` reset · `≡`/`🎛` filtros · `🗺️`/`📋` nav · `🔎` busca · `👆`/`✥` banners · `✓` validado. *(O CRM-KA usa Lucide via React.)* **Parking:** se o produto real for React, migrar para um set consistente (ex. Lucide) e mapear os emojis atuais.

## 8. Responsividade

Mobile-first com **um único breakpoint**: `@media (min-width: 620px)` — sheets/painéis viram cards flutuantes centralizados, modal centraliza, lista ganha `max-width`. Não há layout de desktop dedicado (sem sidebar). Alvo: **Android PWA**; desktop é "abre e funciona", não otimizado.

## 9. Movimento

- Transições curtas: `.1–.15s` (toques/press: `scale .94–.97`), `.2s` (aparições), `.3s` (sheets).
- Keyframes: `pinPop` (pin novo), `pulse` (pin temporário roxo), `slideUp` (modal), `dropIn` (banners/install).
- Curva das sheets: `cubic-bezier(.22,.61,.36,1)`.

## 10. Estados

- **Placing** (`body.is-placing`): cursor crosshair, banner "toque no mapa", FABs esmaecidos.
- **Moving** (`body.is-moving`): banner "arraste o pin", FABs esmaecidos, pin em halo.
- **Empty:** card central no mapa / bloco na lista, ambos com "Limpar filtros".
- **Loading:** o protótipo é estático (sem loading). **Parking:** no produto real, usar *skeleton screens* (não spinners), à la SPEC 00 do CRM-KA.

---

## Como cada spec de tela usa este documento

Uma spec de tela (`spec-01-mapa`, `spec-02-pin-sheet`…) **não repete** tokens nem componentes: referencia este SPEC 00 e descreve só o que é próprio da tela (layout específico, dados exibidos — ver a coluna "Onde aparece" de [[estabelecimento]] —, fluxos e casos de borda).
