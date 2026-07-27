---
title: "SPEC 07 — Atividades (CRM Externo / Praso Maps)"
tipo: design-spec
herda: "spec-00-design-system"
fase: "Fase 2 (casca) — motor na Fase 3/4/5"
status: em-revisao
fonte_de_verdade: "docs/objetos/tarefa.md (contrato de dados) + spec-00-design-system (tokens/shell). ⚠️ Escrita ANTES do código — quando a implementação existir, este doc passa a espelhar `js/atividades.js`, como a SPEC 06 espelha `js/funil.js`."
sources:
  - "_bmad-output/specs/spec-crm-externo/SPEC.md — CAP-11 (atividade no pin) · CAP-12 (aba) · CAP-13 (visão gerencial) · CAP-14 (desqualificar) · CAP-6 revisada"
  - "docs/objetos/tarefa.md — campos, enums, tabela resultado→funil, requalificação"
  - "KR 1.5 — Notion, Fase 2 item 8 · Fase 3 itens 4, 5 e 6"
related:
  - "[[spec-00-design-system]]"
  - "[[spec-06-funil]]"
  - "[[spec-02-pin-sheet]]"
  - "[[tarefa]]"
  - "[[estabelecimento]]"
---

# SPEC 07 — Atividades

> 🎯 **Objetivo.** A superfície da **[[tarefa]]** — a atividade datada onde **check-in/out é a própria tarefa**. Cobre o **bloco de atividades dentro do pin** (CAP-11), a **aba Atividades** com agenda + realizadas (CAP-12), a **visão gerencial** (CAP-13) e o fluxo de **desqualificar** (CAP-14). **Herda o [[spec-00-design-system]]** — tokens, shell e componentes não se repetem aqui.

> 🧩 **Casca × motor.** **Casca (Fase 2):** criar, agendar, fazer check-in/out, registrar resultado + motivo, desqualificar/requalificar, listar e agregar — **tudo em memória**. **Motor (depois):** persistência + auth/RLS (Fase 4) · SLA/tempo em etapa (Fase 4) · proximidade GPS e fotos (Fase 3/4) · calendário externo (Fase 3) · recorrência automática (Fase 5).

> ⚖️ **Esta spec é dona de toda a superfície de Tarefa**, inclusive do bloco dentro do pin. A [[spec-02-pin-sheet]] (a fazer) **referencia** §2 em vez de redescrever — o objeto é um só, e a 02 não deve nascer com um buraco esperando a 07.

## 1. As três superfícies

| Superfície | CAP | Quem usa | Onde |
|---|---|---|---|
| **Bloco de atividades no sheet do pin** | 11 · 14 | vendedor | dentro do pin-sheet (SPEC 00 §6.7) |
| **Aba Atividades** — agenda + realizadas | 12 | vendedor | 4ª aba, cobre o mapa (z 25) |
| **Visão gerencial** | 13 | **liderança** | sub-visão da aba Atividades |

**Uma coleção só** alimenta as três ([[tarefa]] §2): a agenda é o recorte `status = planejada`, as realizadas e a gerencial são `status = realizada`. Não há dado duplicado entre superfícies.

## 2. Bloco de atividades no sheet do pin (CAP-11)

Bloco no pin-sheet, **abaixo das notas** — as notas seguem sempre visíveis (CAP-3, invariante). Estrutura: **próxima atividade** → **botão de ação** → **histórico**.

- **Próxima atividade** (se houver `status = planejada`): tipo + data + badge **`Atrasada`** quando `atrasada` ([[tarefa]] §5). No máximo uma em destaque; o resto cai no histórico.
- **Botão primário, contextual:**
  - sem atividade aberta → **`＋ Agendar atividade`** (abre §2.1)
  - atividade planejada, sem check-in → **`📍 Check-in`**
  - check-in aberto (`checkin_em` preenchido, `checkout_em` nulo) → **`Check-out`** (abre §3)
  - também disponível: **`Concluir sem check-in`** (atividade remota — [[tarefa]] §5) como ação secundária
- **Histórico** — lista das atividades daquele pin, mais recente primeiro: tipo · data · `resultado` (com cor) · motivo quando houver. É a evolução do `checklist` de check-ins que já existe no pin-sheet; passa a **derivar das tarefas**, não de `pin.checkins`.

> **O botão de check-in do protótipo atual muda de significado, não de lugar.** Hoje ele grava um par `{in, out}` solto no pin; passa a operar sobre uma tarefa (criando uma na hora se não houver planejada). É a CAP-6 revisada.

### 2.1 Agendar atividade (mini-form)

Enxuto, no molde do modal de criação (SPEC 00 §6.8). Pede **só o que é digitado**: `tipo` (3 chips: 1ª visita · Follow-up · Recorrência) + `data` (default hoje) + `notas` opcional. `responsavel_id` **não aparece** — é derivado ([[tarefa]] §5). `estabelecimento_id` vem do pin.

> ⚖️ **Agendar já move o funil.** Criar a atividade promove o pin de `sem_plano` para **Visita planejada** — é assim que ele **entra no board** do Funil ([[estabelecimento]] §5). **Cancelar** a última atividade planejada devolve o pin a `sem_plano` e ele sai do board. É a única transição reversível do funil, e vale confirmar no cancelamento por isso.

## 3. Check-out: o fluxo-assinatura (CAP-11 · CAP-14)

O momento em que a atividade **vira dado** e o funil se move. Sheet de conclusão, em até dois passos:

1. **Resultado** — 4 opções, uma escolha obrigatória:

| Opção | Efeito no pin |
|---|---|
| **Sem avanço** | → Visitado |
| **TD (tomador de decisão) encontrado** | → TD encontrado |
| **Perdido** | → Perdido (guarda a etapa de origem) |
| **Desqualificar** | → Desqualificado (guarda a etapa de origem) |

> ⚖️ **Não há "Convertido" no check-out.** Conversão não é fato de campo — o vendedor não decide que alguém virou cliente. **CSC** (cadastrado sem compra) e **Aquisição** são derivados do **ERP** (cadastro e pedido) e **prevalecem** sobre a tarefa: quem tem pedido está em Aquisição mesmo que a última atividade tenha dado `Perdido`. Ver [[estabelecimento]] §5.

2. **Motivo** — aparece **só** para `Perdido` e `Desqualificar`, com o vocabulário fechado do respectivo enum ([[tarefa]] §4); `outro` revela o campo de texto. **Não dá pra concluir sem motivo** nesses dois casos.
3. **Próxima ação** (opcional, sempre visível): texto de uma linha + data. Alimenta a agenda **sem criar tarefa**.

Ao confirmar: `checkout_em`, `status = realizada`, o pin se move pela tabela acima, `ultima_visita` atualiza e `origem_confianca` sobe para `validado_campo`. O **mapa, o Funil e a Inteligência refletem na hora** (mesmo pipeline `emit → reapply → refresh` da SPEC 06 §4).

### 3.1 As duas saídas laterais: Perdido e Desqualificado (CAP-14)

`Perdido` e `Desqualificado` têm **a mesma mecânica** — a diferença vive no **motivo**, não no encanamento (negociação morreu × o ponto não é oportunidade).

- **Não existe botão solto no pin** para nenhum dos dois — a única porta é o resultado do check-out. Constatação de campo tem autor e data.
- O pin **continua no mapa**, com a aparência do estado; o **filtro apenas oculta**. Nunca some.
- **Voltar** = concluir uma nova atividade nesse pin. Ao confirmar, `status_anterior` é restaurado e o novo `resultado` se aplica em cima. O sheet avisa: *"Este ponto está {perdido|desqualificado} (motivo). Concluir uma atividade o devolve a **{status_anterior}**."*
- **Um pedido também tira o pin da lateral**, sem tarefa nenhuma — o ERP prevalece (§3).

## 4. Aba Atividades (CAP-12)

Aba full-screen que **cobre o mapa** (z 25 — mesma camada de Funil e Inteligência, SPEC 00 §5.1). Bottom nav passa a **4 abas**: 🗺️ Mapa · 📊 Funil · 🗓️ Atividades · 📋 Intel. *(com 4 abas o rótulo de Inteligência encurta — ver §9.)*

**Segmented control** no topo, três recortes da mesma coleção:

- **Agenda** — `status = planejada`. **Atrasadas primeiro**, em bloco destacado; depois agrupadas por dia (Hoje · Amanhã · datas). Inclui as `proxima_acao_data` registradas, marcadas como **sugestão** (não são tarefas).
- **Realizadas** — `status = realizada`, mais recente primeiro, com `resultado` visível.
- **Gerencial** — §5.

**Card de atividade** (componente novo, no molde do card de lead, SPEC 00 §6.9): emoji do `tipo` + **nome do estabelecimento** + data · badge de `resultado` (ou `Atrasada`) · responsável. **Toque = abre o pin** no mapa (volta à aba Mapa, foca e abre o sheet) — mesmo gesto do Funil e da Inteligência. **Ação rápida no card:** check-in/check-out sem sair da aba.

**Criar atividade daqui** exige escolher o pin — o FAB da aba abre um seletor buscável (mesma busca da Inteligência). Toda tarefa tem `estabelecimento_id` obrigatório; não há atividade órfã.

## 5. Visão gerencial (CAP-13)

Sub-visão, **não aba própria**: é o mesmo dado com outro recorte ([[tarefa]] §5 — agregação pura), e uma 5ª aba para a única tela de liderança não se paga.

- **Seletor de período** — chips `7 dias · 30 dias · Este mês` (+ intervalo custom como parking).
- **Número-manchete:** total de atividades **realizadas** no período.
- **Três quebras**, cada linha com rótulo + contagem + barra proporcional: por **tipo** · por **vendedor** · por **resultado**.
- **Cada número abre a lista detalhada** por trás dele (drill-down para o recorte "Realizadas" já filtrado) — é o requisito explícito do Notion: *quantidade **+** lista detalhada*.
- Filtros por `tipo`, `responsavel_id` e `resultado` são **próprios desta sub-visão** (não são os filtros do mapa — §6).

> ⚠️ **O recorte "por vendedor" só demonstra algo se o dataset fictício semear `vendedor_responsavel_id`** nos estabelecimentos. Sem isso, tudo cai num bucket único. É a dependência crítica desta tela para o gate ([[tarefa]] §9).

## 6. Filtros — o que compartilha e o que não

- **Compartilha:** a aba Atividades respeita o conjunto filtrado do mapa (só atividades de pins visíveis), como o Funil e a Inteligência. Filtro **oculta**, nunca deleta.
- **Não compartilha:** `período`, `tipo` e `resultado` são filtros **da própria aba** — não entram na quickbar do mapa. Um filtro de tarefa não deve mexer nos pins.

## 7. Dados exibidos

Da [[tarefa]]: `tipo`, `data`, `status`, `resultado`, `motivo_perda`/`motivo_desqualificacao`, `proxima_acao`(+data), `responsavel_id`, `atrasada`, `duracao_min` (só na gerencial). Do [[estabelecimento]]: `nome_fantasia`, `tipologia` (emoji), cidade/zona — o suficiente para identificar o pin no card. Referência cruzada: coluna **"Onde aparece"** em [[tarefa]] §4.

## 8. Estados

- **Agenda vazia:** "Nenhuma atividade planejada" + `＋ Agendar`.
- **Realizadas vazio:** "Nada realizado neste período".
- **Gerencial sem dado:** o número-manchete mostra `0` e as quebras somem (não renderiza barra vazia).
- **Pin sem atividade:** o bloco do §2 mostra só o botão `＋ Agendar atividade`.
- **Check-in aberto:** estado persistente e visível — o pin e o card mostram que há uma visita em andamento.
- **Loading:** protótipo estático (sem loading) — parking de skeleton no SPEC 00 §10.

## 9. Decisões & casos de borda

- **4ª aba, separada do Funil.** Atividade é objeto datado; funil é estado do estabelecimento — a fronteira travada em [[tarefa]] §2. Compartilhar tela reintroduziria a confusão que o contrato desfez. ⚠️ **Divergência consciente com o Notion** (Fase 3 item 6 agrupa "funil + agenda + gerencial" numa aba só): o agrupamento do Notion é rótulo de *plano*, escrito antes da fronteira de objeto existir. Reversível — fundir depois é envolver os dois num segmented control.
- **Bottom nav de 3 → 4 abas** altera o [[spec-00-design-system]] §5/§5.2. Com 4 abas os rótulos encurtam (`Intel.`); abaixo de 360px o rótulo pode ceder ao ícone.
- **Visão gerencial é sub-visão**, não aba (§5).
- **Perdido e Desqualificado só pelo check-out** (§3.1) — nunca botão solto, nunca arraste. A [[spec-06-funil]] recusa o drop nessas duas colunas (exigem motivo) e também em CSC/Aquisição (vêm do ERP).
- **Conversão não passa pelo check-out** (§3): `csc`/`aquisicao` vêm do ERP e prevalecem. Um card pode aparecer em Aquisição sem nenhuma atividade concluída.
- **Agendar é o que põe o pin no funil** (§2.1). Consequência de produto: o Funil deixa de mostrar a base inteira e passa a mostrar só o pipeline — a contagem dele divergir da do mapa é o comportamento correto ([[spec-06-funil]] §5).
- **Concluir sem check-in é válido** (atividade remota) — o check-in prova presença, não cria o registro.
- **Recorrência não gera nada** na Fase 2: é só um valor de `tipo`. A agenda não se autopreenche.
- **`proxima_acao_data` aparece na agenda mas não é tarefa** — é sugestão. Vira tarefa só quando o vendedor agenda de fato.
- **Uma atividade aberta por pin** (com check-in sem check-out). Tentar abrir outra oferece fechar a anterior.
- **Sobre dado real:** o snapshot não traz atividades — a aba nasce **vazia** com dado real e cheia com dado fictício. Semear tarefas fictícias é o que faz a gerencial existir no gate.

## 10. Como o SPEC 07 usa o SPEC 00

Não repete tokens nem componentes: reusa o pin-sheet (§6.7), o sheet/painel bottom (§6.6), o modal de criação (§6.8), o card de lead como molde do card de atividade (§6.9), os transientes (§6.10) e o shell/nav (§5). **Pede ao SPEC 00:** a 4ª aba na navegação (§5.2), **três cores novas** de status (`csc`, `perdido`, `desqualificado`) e um badge de `resultado` (4 valores) — ambas em §2.6.
