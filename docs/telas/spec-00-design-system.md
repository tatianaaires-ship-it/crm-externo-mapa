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

Layout em coluna, `height: 100dvh`, `overflow: hidden` (o app não rola; o conteúdo interno rola). O mapa é `flex: 1` e **tudo mais flutua sobre ele**.

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
Pill com borda `--line-2`; ativo = fundo `--ink` texto branco. Os chips de **origem** deixaram de ter cor própria (29/07) e passaram a **ensinar a pista**: o de CNPJ nasce com a borda tracejada, os outros dois trazem o glifo no rótulo (`G Google`, `✓ Validado em campo`). Atalho "Classificação" abre popover de tipologias; badge numérico mostra quantos ativos.

### 6.3 Botão Filtros
`.filters-btn` — fundo `--brand`, pill, com badge branco de contagem. Abre o painel de filtros (bottom-sheet).

### 6.4 Legenda
Card semi-transparente (`backdrop-filter: blur`) colapsável, ancorado no canto do mapa. Repete cor + pista não-cromática + rótulo de confiança das 4 origens.

### 6.5 FAB
`＋` criar (58px, `--brand`, sombra colorida) e `◎` localizar (46px, branco). Ambos esmaecem (opacity .3) durante placing/moving.

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

- **Chips para escolha fechada e CURTA** (`.sform-chips`, reusa o §6.2) — em três valores o dedo escolhe direto, e o default já é a resposta provável. ⚠️ **Deixaram de servir ao resultado e ao motivo em 28/07** (ver checkbox e select abaixo); hoje o único chip do padrão é o **tipo da visita**.
- **Checkbox** (`.sform-check`, 28/07) — quando as opções **combinam** entre si, e não são uma escolha única. É `button[role=checkbox]` com quadrado desenhado, **não `<input>`**: numa tela toda delegada, o input nativo dispara `click` e `change` no mesmo gesto. Marcado = borda + fundo `--brand-050` e rótulo 700. `is-locked` é a opção que outra implica (opacidade .62, toque sem efeito) — **nunca `disabled`**: checkbox apagado no Android lê como tela travada.
- **Select nativo a 16px** (`.sform-sel`, 28/07) — escolha fechada **longa** (a partir de ~8 valores). O vocabulário de não venda tem 14: em chips vira uma parede que empurra o botão de enviar para fora da tela. `appearance: none` + seta em `data:` SVG, porque a nativa some junto.
- **Textarea** (`.sform-txt`, 28/07) — texto de mais de uma linha (notas da visita). Mesma caixa do input, `min-height: 74px`, `resize: vertical` apenas — horizontal quebraria o sheet.
- **Ajuda inline `(i)`** (`.sform-i` + `.sform-ajuda`, 28/07) — círculo 28px ao lado do rótulo ou da caixa; ao toque abre um parágrafo `--brand-050` **abaixo**, um por vez, e o mesmo toque fecha. **Não é tooltip**: hover não existe no celular, e overlay flutuante dentro de um sheet que rola briga com o scroll. Serve às distinções que não se aprendem olhando — *desqualificar × perder × não venda*.
- **Campo condicional:** no check-out, o campo de motivo depende de qual caixa está marcada, e trocar o desfecho **zera** o motivo — o vocabulário é outro.
- **Inputs nativos a 16px** (`.sform-inp`), pela regra travada do §3 (sem zoom no iOS): `date`, `time` e texto. Picker de calendário e de relógio são do sistema — sem build, sem componente novo para manter.
- **O botão diz o que falta**, desabilitado, em vez de recusar depois do toque: `Escolha o motivo da não venda` → `Descreva o motivo` → `✓ Concluir atividade`; `Escolha o dia` / `O dia já passou` → `＋ Agendar visita`. Validação que aparece só depois de tentar obriga a errar primeiro.
- **Nota de consequência antes do botão** (`.sform-nota`), quando o envio muda estado fora da tela: *"Agendar coloca {ponto} no funil, em Visita planejada"*. Quem está a um toque de mexer no board deve saber **antes** do toque.
- **A faixa do topo diz o estado do check-in em curso** (`.ativ-tipo-atual`, verde): hora e minutos em campo — e, quando a distância passou do raio, `remoto (1,2 km do pin)`. O vendedor fica sabendo **como a visita vai ser classificada antes de fechar**, não depois, na coluna da gerencial. *(Uma faixa âmbar `.conc-remota` existiu aqui por uma hora, avisando que "sem check-in a atividade será remota" — a premissa estava errada e ela saiu: ver [[spec-07-atividades]] §2.)*

> ⚖️ **Tela que se re-renderiza a cada toque pede delegação de evento**, não listener por elemento: o nó que recebeu o listener morre no próximo render. Um `click`/`input`/`change` no container que sobrevive, e o `data-*` diz qual campo mudou. **Texto e textarea não re-renderizam** — refazer o HTML a cada tecla tira o foco do campo; quem reflete o estado é o botão, atualizado à mão. **Select re-renderiza** (escolher `Outro` revela o campo de texto), com guarda de valor igual para o par `input`+`change` não custar dois renders.

> ⚖️ **Escolha única = chip; opções que combinam = checkbox** (28/07). O check-out tinha um chip de `Resultado` de quatro valores e virou quatro caixas, porque *encontrou o TD* e *vendeu* são verdadeiros **ao mesmo tempo** — chip prometia exclusividade que o domínio não tem. E quando algumas caixas **são** mutuamente exclusivas (vendeu × perdeu × desqualificou), marcar uma **desmarca** as outras em vez de desabilitá-las: a regra fica mais clara sendo aplicada do que sendo proibida, e o dedo sempre faz o que mandou. A mesma regra vale nos dois lados — a tela e o store chamam a **mesma** função de normalização, senão a tela promete um desfecho que a gravação desfaz.

### 6.8 Modal de criação
Sobe de baixo, borda superior 3px `--brand`, **sem scrim bloqueante** (o mapa e o marcador roxo seguem arrastáveis por trás). Campo básico (nome) + "Mais detalhes" expansível (tipologia, CNPJ, telefone) + dica de qualidade derivada.

### 6.9 Card de lead (aba Inteligência)
Linha com dot de origem (mesmas pistas do pin), nome, sub, CNPJ e badge de qualidade. Toque foca o pin correspondente no mapa.

> **Busca de estabelecimento — uma só para o produto** (`CRM_DATA.matchBusca`, 28/07): **nome fantasia · razão social · CNPJ**, acento-insensível nos nomes e **por dígitos** no CNPJ (`14066` acha `14.066.645/0001-46`). Usada pela Inteligência **e** pela barra de filtros da aba Atividades (§6.12) — busca que se comporta diferente em duas telas do mesmo app é bug de produto, não variação. Rótulo `Buscar`, placeholder que **nomeia os três campos**: campo de busca que não diz o que aceita faz o usuário testar.

### 6.10 Segmented control (`.seg`)
Trilha de abas internas no topo de uma view full-screen, abaixo de nada e acima de tudo. Botões de largura igual (`flex: 1`), rótulo 12.5px/700 em `--muted`; ativo = cor `--brand` + borda inferior 3px `--brand`. `role="tablist"` + `aria-selected`. Usado pela aba Atividades (Gerencial · Agenda — [[spec-07-atividades]] §4).

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

### 6.16 Calendário da Agenda (`.ag-*`)
Formato de agenda-lista (molde do Google Agenda), na aba Atividades — [[spec-07-atividades]] §4.2. Uma variável de sarjeta (`--gut: 52px`) governa as três peças, e é ela que faz a coluna da esquerda existir como coluna:

- **Bloco de dia** (`.ag-dia` + `.ag-dia__h`) — cabeçalho `position: sticky` sobre `--bg` com borda inferior: **dia de calendário na sarjeta** (`DOW` 9.5px/800 caixa-alta + número 19px `tabular-nums`) e, à direita, título (`Hoje` · `Amanhã` · `4 de agosto`) com contagem em `small`. **Hoje ganha disco `--brand`** com número branco — é a âncora visual da lista.
- **Item** (`.ag-item`) — `flex` de três partes: sarjeta de **horário** (`.ag-h`, 12.5px/800 `tabular-nums`) · corpo (nome como `button`, subtítulo, e a anotação do agendamento em `.ag-nota`) · botão redondo de 28px para cancelar (`.ag-x`). Sem horário, a sarjeta diz **`dia inteiro`** (`.ag-h--all`, 9.5px caixa-alta) e o item vai para o topo do dia: sarjeta vazia lê como dado faltando.
- **Bloco de rota** (`.ag-rota`) — cartão com **espinha de 3px `--brand`** à esquerda e cabeçalho em grade de 3 colunas (ícone · nome · ação), com a linha de meta ocupando as colunas 2–3. As paradas ficam em `<ul>` (`.ag-paradas`) separadas por `1px dashed` — **`ul` e não `ol` de propósito**: rota é conjunto, não sequência ([[rota]] §2). A variante **avulsa** (`.ag-item--avulsa`) é o mesmo item em cartão com espinha `--line-2`: mesma forma, hierarquia menor, sem espinha de marca.

> A espinha é o que faz N paradas lerem como **um** compromisso. Sem ela, uma rota de 5 paradas parecia 5 itens soltos — que era exatamente o problema que este formato veio resolver.

> **O card de atividade saiu.** A Agenda usava o card de lead (§6.9) como molde, com badge de `resultado`/`Atrasada` e botões de check-in/concluir. Ele foi **substituído** por estas peças em 28/07 ([[spec-07-atividades]] §4.2): o `.ativ-card` não existe mais, e do bloco antigo sobrou só o **badge** (`.ativ-badge`), ainda usado no histórico do pin.

## 7. Ícones

Hoje **baseados em emoji/glifos** (vanilla, sem lib): `◈` marca · `＋` criar · `◎` localizar · `⟲` reset · `≡`/`🎛` filtros · `🗺️`/`📋` nav · `🔎` busca · `👆`/`✥` banners · `✓` validado. *(O CRM-KA usa Lucide via React.)* **Parking:** se o produto real for React, migrar para um set consistente (ex. Lucide) e mapear os emojis atuais.

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
