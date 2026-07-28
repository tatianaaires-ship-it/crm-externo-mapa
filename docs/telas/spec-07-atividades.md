---
title: "SPEC 07 — Atividades (CRM Externo / Praso Maps)"
tipo: design-spec
herda: "spec-00-design-system"
fase: "Fase 2 (casca) — motor na Fase 3/4/5"
status: em-revisao
fonte_de_verdade: "js/atividades.js (aba) + js/state.js (tarefas e rotas) + js/pin.js (bloco e sub-telas do sheet) + js/data.js (seed em rotas) — implementado 27–28/07. ⚠️ PENDÊNCIA de UI: o §3 (sheet de conclusão) e o §2.1 (agendar) seguem em window.prompt, não nos sheets desenhados."
sources:
  - "_bmad-output/specs/spec-crm-externo/SPEC.md — CAP-11 (atividade no pin) · CAP-12 (aba) · CAP-13 (visão gerencial) · CAP-14 (desqualificar) · CAP-6 revisada"
  - "docs/objetos/tarefa.md — campos, enums, tabela resultado→funil, requalificação"
  - "KR 1.5 — Notion, Fase 2 item 8 · Fase 3 itens 4, 5 e 6"
related:
  - "[[spec-00-design-system]]"
  - "[[spec-06-funil]]"
  - "[[spec-02-pin-sheet]]"
  - "[[tarefa]]"
  - "[[rota]]"
  - "[[estabelecimento]]"
---

# SPEC 07 — Atividades

> 🎯 **Objetivo.** A superfície da **[[tarefa]]** — a atividade datada onde **check-in/out é a própria tarefa**. Cobre o **bloco de atividades dentro do pin** (CAP-11), a **aba Atividades** com a agenda do vendedor (CAP-12), a **visão gerencial** (CAP-13) — que absorveu a lista de realizadas — e o fluxo de **desqualificar** (CAP-14). **Herda o [[spec-00-design-system]]** — tokens, shell e componentes não se repetem aqui.

> 🧩 **Casca × motor.** **Casca (Fase 2):** criar, agendar, fazer check-in/out, registrar resultado + motivo, desqualificar/requalificar, listar e agregar — **tudo em memória**. **Motor (depois):** persistência + auth/RLS (Fase 4) · SLA/tempo em etapa (Fase 4) · proximidade GPS e fotos (Fase 3/4) · calendário externo (Fase 3) · recorrência automática (Fase 5).

> ⚖️ **Esta spec é dona de toda a superfície de Tarefa**, inclusive do bloco dentro do pin. A [[spec-02-pin-sheet]] (a fazer) **referencia** §2 em vez de redescrever — o objeto é um só, e a 02 não deve nascer com um buraco esperando a 07.

## 1. As três superfícies

| Superfície | CAP | Quem usa | Onde |
|---|---|---|---|
| **Bloco de atividades no sheet do pin** | 11 · 14 | vendedor | dentro do pin-sheet (SPEC 00 §6.7) |
| **Aba Atividades** — a agenda (o que falta fazer) | 12 | vendedor | 4ª aba, cobre o mapa (z 25) |
| **Visão gerencial** | 13 | **liderança** | sub-visão da aba Atividades |

**Uma coleção só** alimenta as três ([[tarefa]] §2): a agenda é o recorte `status = planejada`, as realizadas e a gerencial são `status = realizada`. Não há dado duplicado entre superfícies.

## 2. Bloco de atividades no sheet do pin (CAP-11)

Bloco no pin-sheet, **abaixo das notas** — as notas seguem sempre visíveis (CAP-3, invariante). Estrutura: **botão de ação** → **histórico (3 últimas)** → **`Ver todas`**. Título do bloco é só `Atividades`: o lembrete *"check-in é a tarefa"* saiu (28/07) — é regra de modelo ([[tarefa]] §2), não legenda de tela, e quem usa o app não precisa dela.

> ⚖️ **A atividade planejada não aparece no bloco** (28/07). O botão de check-in **é** ela — mesma tarefa, e mostrar as duas coisas dizia o mesmo duas vezes num bloco que já briga por altura com as notas. O bloco ficou com duas perguntas só: **o que fazer agora** (botão) e **o que já foi feito** (lista). A planejada segue com detalhe próprio, pela tela de todas as atividades (§2.2) — que passa a contá-la como escondida, e por isso o botão `Ver todas` aparece sempre que houver planejada.
>
> **Preço aceito:** o badge `Atrasada` sumiu do sheet do pin. A dívida vencida continua visível no **detalhe da atividade** (§2.2) e na **tabela da gerencial** (§5.4), mas quem abre só o pin não vê mais que o compromisso venceu. ⚠️ **O preço subiu em 28/07:** o bloco fixo da Agenda, que era a outra porta, também saiu (§4.2) — sobraram duas telas mais fundas.

- **Botão primário, contextual — um só:**
  - sem atividade aberta → **`＋ Agendar atividade`** (abre §2.1)
  - atividade planejada, sem check-in → **`📍 Check-in`**
  - check-in aberto (`checkin_em` preenchido, `checkout_em` nulo) → **`Check-out`** (abre §3)
- **Histórico — as 3 últimas**, cada uma clicável, mais recente primeiro: emoji do tipo · data · `resultado` (com cor) · duração. Deriva das tarefas, não de `pin.checkins`. Abaixo, **`Ver todas as atividades (N) ›`** quando houver alguma que a tela não mostra (a conta inclui o banner da próxima, não só as realizadas).

> ⚖️ **Por que 3 e não todas.** Um ponto de recorrência acumula dezenas de atividades; a lista inteira empurrava as **notas** — que a CAP-3 obriga a manter sempre visíveis — para fora da tela. O bloco vira um resumo, e a lista completa ganha tela própria.

> **`Concluir sem check-in` saiu do pin** (28/07). Duas ações primárias competindo, e o caminho de campo é o check-in. ⚠️ **A conclusão remota continua existindo** no modelo (`tipo_checkin = remoto`, [[tarefa]] §4) e no dado semeado — e segue acionável pelo botão `Concluir` do **card da Agenda** (§4). Se a intenção for eliminar a atividade remota do produto, é preciso tirar de lá também e rever o filtro de check-in (§4.1); enquanto os dois existirem, o pin só perdeu o atalho.

### 2.2 Lista e detalhe: as outras duas telas do sheet

O sheet do pin tem **três telas**, não três lugares — tudo dentro do mesmo bottom sheet, com voltar, porque sair do sheet tiraria o vendedor do contexto do ponto:

1. **Pin** — o que já existia, com o histórico enxugado a 3.
2. **Lista** (`Ver todas ›`) — todas as atividades do ponto, em dois grupos: **Planejadas** e **Realizadas**. Cabeçalho com voltar, título `Atividades` e o **nome do ponto** por baixo, para não se perder de quem é a lista.
3. **Detalhe** (toque numa atividade) — a ficha da [[tarefa]]: data · situação · responsável · **rota** · tipo de check-in · check-in/check-out com duração · **distância no check-in** · resultado · motivo · próxima ação · comentário.

- **Ações vivem só no detalhe de atividade aberta** (`Check-in`/`Check-out` + `Cancelar atividade`), e operam sobre **aquela** tarefa — não sobre "a próxima do pin". Atividade realizada é **registro, não formulário**: nenhum botão.
- Cancelar a última planejada avisa que o pin **sai do funil** e volta à lista (§2.1).
- Toda tela nova começa **do topo**; abrir um pin sempre volta para a tela 1.

> **O botão de check-in do protótipo atual muda de significado, não de lugar.** Hoje ele grava um par `{in, out}` solto no pin; passa a operar sobre uma tarefa (criando uma na hora se não houver planejada). É a CAP-6 revisada.

### 2.1 Agendar atividade (mini-form)

Enxuto, no molde do modal de criação (SPEC 00 §6.8). Pede **só o que é digitado**: `tipo` (3 chips: 1ª visita · Follow-up · Recorrência) + `data` (default hoje) + `notas` opcional. `responsavel_id` **não aparece** — é derivado ([[tarefa]] §5). `estabelecimento_id` vem do pin.

> ⚖️ **Agendar já move o funil.** Criar a atividade promove o pin de `sem_plano` para **Visita planejada** — é assim que ele **entra no board** do Funil ([[estabelecimento]] §5). **Cancelar** a última atividade planejada devolve o pin a `sem_plano` e ele sai do board. É a única transição reversível do funil, e vale confirmar no cancelamento por isso.

## 3. Check-out: o fluxo-assinatura (CAP-11 · CAP-14)

> 🚧 **Implementado como `window.prompt`, não como sheet** (27/07). A mecânica está toda correta — resultado obrigatório, motivo obrigatório nos dois desfechos negativos, próxima ação opcional, e o funil se movendo pelo `resultado`. **Mas a apresentação não é a desta spec**, e qualidade visual é critério de aceite do gate. Trocar os três prompts por um sheet de conclusão (chips de resultado → motivo condicional → próxima ação) é a pendência de UI mais visível da fatia.

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
3. **Próxima ação** (opcional, sempre visível): texto de uma linha + data. ⚠️ **Deixou de alimentar a Agenda em 28/07** (§4.2) — sugestão dentro de um calendário lê como compromisso marcado. Continua no registro da atividade e na tabela da gerencial, e **nunca virou tarefa**.

Ao confirmar: `checkout_em`, `status = realizada`, o pin se move pela tabela acima, `ultima_visita` atualiza e `origem_confianca` sobe para `validado_campo`. O **mapa, o Funil e a Inteligência refletem na hora** (mesmo pipeline `emit → reapply → refresh` da SPEC 06 §4).

### 3.1 As duas saídas laterais: Perdido e Desqualificado (CAP-14)

`Perdido` e `Desqualificado` têm **a mesma mecânica** — a diferença vive no **motivo**, não no encanamento (negociação morreu × o ponto não é oportunidade).

- **Não existe botão solto no pin** para nenhum dos dois — a única porta é o resultado do check-out. Constatação de campo tem autor e data.
- O pin **continua no mapa**, com a aparência do estado; o **filtro apenas oculta**. Nunca some.
- **Voltar** = concluir uma nova atividade nesse pin. Ao confirmar, `status_anterior` é restaurado e o novo `resultado` se aplica em cima. O sheet avisa: *"Este ponto está {perdido|desqualificado} (motivo). Concluir uma atividade o devolve a **{status_anterior}**."*
- **Um pedido também tira o pin da lateral**, sem tarefa nenhuma — o ERP prevalece (§3).

## 4. Aba Atividades (CAP-12)

Aba full-screen que **cobre o mapa** (z 25 — mesma camada de Funil e Inteligência, SPEC 00 §5.1). Bottom nav de **4 abas**: 🗺️ Mapa · 📋 Intel. · 📊 Funil · 🗓️ **Atividades** — é a **última**, ao lado do Funil, porque as duas são o pipeline de trabalho (SPEC 00 §5.2). *(com 4 abas o rótulo de Inteligência encurta — ver §9.)* **A quickbar do mapa não aparece aqui** (§6).

**Segmented control** no topo, **dois** recortes da mesma coleção — **a aba abre na Gerencial**:

- **Gerencial** — §5. O retrato do período: KPIs, quebras, gráficos L7D e a **tabela detalhada** no fim. É o default.
- **Agenda** — §4.2. `status = planejada`, **de hoje em diante**, em **calendário**: um bloco por dia, com **rotas** ([[rota]]) e **atividades avulsas**.

> **Havia um terceiro recorte, "Realizadas"** (cards de `status = realizada`, mais recente primeiro). **Removido em 28/07:** a tabela do §5.4 já é a lista detalhada, com mais colunas e ordenação — manter as duas era manter duas respostas para a mesma pergunta.
>
> ⚖️ **A consequência foi no drill, não na aba.** Todo número da Gerencial navegava para "Realizadas" filtrada; agora **filtra a própria tabela**, ali embaixo, e rola até ela. Vantagem: os agregados de cima **continuam inteiros** enquanto a tabela mostra a fatia — o gráfico vira o controle e a tabela o detalhe, que é a leitura de dashboard. O requisito do Notion (*quantidade **+** lista detalhada*) segue cumprido, na mesma tela.

> ⚖️ **A Gerencial abre por padrão** mesmo ela sendo a visão de liderança (§1). Inverte a leitura da aba: ela deixa de ser "minha agenda com um resumo atrás" e vira "o retrato do período, com o detalhe atrás". Decisão de produto, não do contrato — nada em [[tarefa]] muda. Reversível trocando uma linha.

### 4.1 Barra de filtros da aba

Logo abaixo do segmented control, **um único estado de filtro compartilhado pelos três recortes** — trocar de recorte não perde a seleção. Dois controles:

- **Vendedor** — `<select>` com `Todos os vendedores` (default) + os vendedores; o da sessão vem marcado `(eu)`. Filtra por `responsavel_id` **da tarefa**, não por `vendedor_responsavel_id` do pin.
- **Período** — chips: `Hoje · Ontem · Esta semana · Semana passada · Este mês · Mês passado · 📅 Período`. Default **Este mês**. `📅 Período` revela dois campos `de`/`até` com o **date picker nativo** do sistema (sem calendário próprio: sem build, sem componente novo pra manter). A semana começa na **segunda**; `Esta semana`/`Este mês` vão até o **fim** do período, o que os torna úteis também na Agenda.

Onde cada recorte aplica o período: **Gerencial** em `data` (de planejada e de realizada — §5.1); **Agenda** em `data` da planejada, com o piso extra de **hoje** (§4.2).

**Uma exceção ao período, rotulada na tela** (exceção que não se anuncia é bug): os **gráficos por dia `L7D`** (§5.4). *(Havia duas — o bloco `Atrasadas` da Agenda era a outra, e ele saiu em 28/07: §4.2.)*

**Quatro filtros, todos visíveis**, em grade de 2 colunas (~172px por célula em 375px): **Vendedor** · **Tipo de visita** · **Tipo de check-in** (`Presencial` · `Remoto`) · **CNPJ** (busca por dígitos, com *debounce* — não re-renderiza por tecla). Controle com valor diferente de `Todos` fica **marcado em `--brand`**: com quatro lado a lado, é preciso ver de relance quais estão agindo.

> **Ficaram um tempo recolhidos atrás de um botão `Mais`** com badge de contagem, para poupar altura (a barra ia de 88px para 127px). Revertido em 28/07: **filtro que não se acha não é filtro**, e a economia de 39px não paga o custo de o usuário não saber que o controle existe. A marcação em `--brand` substitui o badge no papel de mostrar o que está ativo.

> **O filtro de check-in esvazia a Agenda de propósito.** `tipo_checkin` só existe em tarefa realizada; com `Presencial` ou `Remoto` ativo, o recorte Agenda fica vazio — não é bug, é a resposta correta ("nenhuma planejada tem check-in ainda").

> ⚠️ **Efeito colateral do filtro único:** com `Este mês` no dia 27, a Agenda esconde o que está marcado para o mês seguinte. É o preço de um estado compartilhado — o vendedor troca para `📅 Período` ou para um preset mais largo. Se incomodar no uso, a saída é dar à Agenda um default próprio (`sem recorte`), não quebrar o compartilhamento.

O filtro **não persiste** entre sessões (nada de `localStorage` até a Fase 4).

### 4.2 A Agenda é um calendário de rotas (28/07)

Antes era uma pilha de cards de atividade agrupada por dia, com `Atrasadas` no topo e `Sugestões` no fim. **O problema era de leitura:** com ~80 planejadas, não se via *o que é de qual dia* — e o que o vendedor planeja não são atividades soltas, é **rota**.

**A forma agora é a do Google Agenda:** um bloco por dia, **data na sarjeta** (`TER 28` + `Hoje` / `Amanhã` / `4 de agosto`, com disco de marca em hoje), cabeçalho do dia **grudado no topo** enquanto o dia rola, e **horário na sarjeta de cada item**. Dentro do dia, duas naturezas:

| Natureza | O que é | Como aparece |
|---|---|---|
| **Rota** ([[rota]]) | conjunto de estabelecimentos de um vendedor no dia; **cada parada é uma tarefa planejada** | bloco com espinha em `--brand`: `🧭 nome · N paradas · faixa de horário · vendedor`, `Cancelar rota`, e as paradas em lista |
| **Avulsa** | o compromisso que o vendedor marcou solto (`rota_id` null) — *"retorno na quinta às 15h"* | card com espinha neutra, com o vendedor no subtítulo |

- **Ordem dentro do dia:** quem **não tem `hora`** vem primeiro, sob o rótulo `DIA INTEIRO` (a `hora` é opcional — [[tarefa]] §4); depois, tudo pelo horário. A rota entra na posição da **sua primeira parada**.
- **O item mostra o que foi combinado, e só:** horário marcado · nome do estabelecimento · tipo · **a anotação do vendedor no agendamento** (`tarefa.notas`) · `✕` cancelar. **Toque no nome abre o pin** no mapa (volta à aba Mapa, foca e abre o sheet) — mesmo gesto do Funil e da Inteligência.
- **Rota encurtada por filtro diz que foi encurtada:** o cabeçalho vira `2 de 5 paradas`. Rota que perde paradas em silêncio lê como rota errada.
- **`Cancelar rota`** cancela **todas** as paradas dela e avisa quantas são e **quantos pins saem do funil** — é a única reversão do board ([[tarefa]] §5). A rota não se deleta; ela apenas fica sem paradas e some da Agenda.

> ⚖️ **A Agenda perdeu `Check-in` e `Concluir`.** Ela é o **plano**; a execução é no sheet do pin, que já tem o botão contextual (§2). Duas ações de execução num card de agenda competiam com o gesto principal (abrir o pin) e espalhavam o fluxo de conclusão por duas telas.
>
> **Preço aceito, e é o maior desta mudança:** a **atividade remota** (`tipo_checkin = remoto`) ficou **sem nenhuma porta de UI**. O §2 tirou `Concluir sem check-in` do pin em 28/07 e disse que o botão do card da Agenda era a última porta — agora ela fechou também. O modelo mantém o caso ([[tarefa]] §5) e o seed mantém ~14% de realizadas sem check-in, então o filtro `Tipo de check-in → Remoto` continua devolvendo linhas; o que não existe é como **criar** uma. Resolve a ponta solta da fatia com um "sim, some" — e é reversível pelo detalhe da atividade (§2.2), que já é o lugar das ações.

> ⚖️ **A Agenda não mostra atrasadas, e não fala delas.** Era bloco fixo no topo e exceção ao filtro de período. Saiu porque a Agenda passou a ser *"o que vem por aí"*, e dívida vencida no topo de um calendário empurra o dia de hoje para fora da tela.
>
> **Nem o ponteiro sobrou.** Houve, por algumas horas, um pill `N atrasadas na Gerencial` no *hint* — posto ali pela regra de que omissão não deve ser silenciosa. **Removido em 28/07 por decisão de produto:** *"não quero dar atenção às atrasadas"*. Contar a dívida e apontar para onde ela está **é** dar atenção a ela; a rigor, um contador no alto da tela chama mais atenção do que uma lista lá embaixo. Então a Agenda passou a não mencionar atraso em nenhuma forma — sem bloco, sem badge, sem contagem, sem atalho.
>
> ⚠️ **O que isto custa, explicitamente:** a tarefa planejada de data passada **só existe** na tabela da gerencial, e lá **sem marca própria** de atraso — ela aparece porque a tabela lista todas as planejadas do período, não porque a tela sinalize a dívida. A tabela obedece ao filtro de período, então com `Hoje` selecionado a atrasada de ontem não aparece em lugar nenhum do app. **Isso é o comportamento pedido, não uma lacuna a consertar** — e é a razão de estar escrito aqui: um leitor futuro que "descobrir" essa ausência precisa saber que ela é intencional antes de reintroduzir o bloco.

> ⚖️ **As `Sugestões` (`proxima_acao_data`) saíram da Agenda.** Elas eram "não-tarefas" num calendário — exatamente o tipo de item que alguém lê como compromisso marcado. O campo continua no modelo e na tabela da gerencial; a Agenda ficou só com compromisso real.

**Criar rota ou atividade daqui ainda não existe.** O FAB da aba com seletor buscável de pin segue prometido e não implementado (§9) — e agora ele tem duas formas a resolver: criar **avulsa** (um pin) e **montar rota** (N pins, o que cria N tarefas planejadas). Agendar pelo sheet do pin cria sempre uma **avulsa**. Toda tarefa tem `estabelecimento_id` obrigatório; não há atividade órfã.

## 5. Visão gerencial (CAP-13)

Sub-visão, **não aba própria**: é o mesmo dado com outro recorte ([[tarefa]] §5 — agregação pura), e uma 5ª aba para a única tela de liderança não se paga.

- **Seletor de período** — **não vive mais aqui**: subiu para a barra da aba (§4.1) e passou a valer nos três recortes. O vocabulário `7 · 30 · 90 dias` foi substituído por presets de calendário, e o intervalo custom **saiu do parking**.

### 5.1 Hierarquia em três níveis

O problema que esta estrutura resolve não era falta de gráfico — era **falta de hierarquia**: três blocos de barras idênticos davam o mesmo peso a tudo, e o olho não sabia onde pousar. Agora:

1. **KPI row** — três tiles que formam um **funil de execução**, cada um em % do **anterior**, não do total:

| Tile | Número | Terceira linha |
|---|---|---|
| **Planejadas** | tarefas com data no período | `no período` |
| **Realizadas** | as concluídas | `y% das planejadas` — taxa de execução do plano |
| **TD encontrado** | realizadas com `resultado = td_encontrado` | `w% das realizadas` — taxa de eficácia |

> ⚖️ **"Planejadas" é o PLANO DO PERÍODO** — todas as tarefas com data no recorte, **realizadas incluídas**. Tinha que ser: se contasse só quem continua `planejada`, os dois conjuntos seriam **disjuntos** (o plano vive no futuro, o feito no passado) e "16 de 38" não significaria coisa alguma. É a mesma leitura dos gráficos L7D (§5.4), e é o que faz a taxa de execução existir.

> **`Atrasadas hoje` saiu da KPI row** (28/07) — os três tiles agora contam **uma** história encadeada, e a dívida vencida era um quarto assunto no meio dela. Continua no topo da **Agenda**, em bloco fixo e fora do filtro de período (§4.1), que é onde se age sobre ela.
2. **Quebras**, cada uma com a forma que o trabalho pede (§5.2).
3. **Detalhe** — gráficos por dia e a tabela de atividades (§5.4).

> ⚖️ **Não há número-manchete.** Existiu um (`≥48px`, "N atividades realizadas") e foi **removido em 28/07**: o *head* da aba já mostra `N realizadas` no alto da tela, e a manchete dizia exatamente a mesma coisa dois centímetros abaixo. Ficou a forma menor. Se um dia a gerencial deixar de morar dentro de uma aba que já conta, a manchete volta.

> ⚖️ **A gerencial mostra o plano ao lado da execução.** Deixou de ser recorte só de `realizada`: `Planejadas` e `Atrasadas hoje` vêm de `status = planejada`. É a pergunta real da supervisão — *"está rodando conforme o combinado?"* — que o total de realizadas sozinho não responde.

> ⚖️ **`Atrasadas hoje` ignora o filtro de período**, mesma regra da Agenda (§4.1). Por isso a palavra **"hoje"** está no rótulo: sem ela, em `Mês passado` o número leria como "2 atrasadas no mês passado" quando são as vencidas de agora. O tile leva ao recorte Agenda.

### 5.2 As formas, por trabalho

| Quebra | Forma | Por quê |
|---|---|---|
| **Resultado** | **barra empilhada 100%** + legenda rotulada + detalhamento ao apontar | É parte-do-todo. Em 375px a empilhada é mais precisa e mais compacta que um donut, e fala a mesma língua das barras já na tela. **Ordem fixa do enum, nunca por ranking** — a cor segue a entidade, então o mesmo resultado tem a mesma cor em qualquer período |
| **Vendedor × tipo** | **tabela pivô** com totais de linha e coluna | Cruzamento de duas dimensões nominais — nem barra nem gráfico resolve; a grade é a forma certa. Números à direita e com `tabular-nums` (aqui dígito de largura fixa **ajuda**, ao contrário do texto corrido). **Cada célula é um drill duplo** (vendedor **e** tipo) e a coluna **Total** dá o drill por vendedor |

> **Não há bloco "Por vendedor".** Existiu (barras horizontais) e saiu em 28/07: a pivô já entrega o total por vendedor na coluna `Total` **e** ainda cruza com o tipo. Duas leituras da mesma dimensão, uma delas mais pobre, só custavam altura. A quebra "Por tipo" em chips saiu antes, pelo mesmo motivo — a pivô contém as duas.

- **Cada número filtra a tabela do §5.4** e rola até ela — é o requisito explícito do Notion: *quantidade **+** lista detalhada*. Vale para os três tiles, cada célula da pivô (drill **duplo**: vendedor **e** tipo), a coluna `Total` da pivô e cada item das duas legendas. Um **chip no título da tabela** diz o critério ativo e é a porta de volta — tabela filtrada sem chip parece dado que sumiu. Trocar qualquer filtro da barra **limpa o drill** (ele pode ser justamente pela dimensão que mudou).
- **Drill por `resultado` exclui planejadas sozinho** — quem não tem desfecho não casa com nenhum valor do enum. Não precisou de regra: cai do modelo.
- ⚖️ **Na barra empilhada, o segmento MOSTRA e a legenda LEVA.** Apontar um segmento abre o detalhamento (todos os desfechos com contagem e %, sobre o total de realizadas); o drill fica no item de legenda logo abaixo. No celular um toque não pode fazer as duas coisas — ou abre o detalhamento ou navega. A porta continua existindo, a 8px de distância e por categoria.
- `responsavel_id` **deixou de ser filtro só daqui** e virou filtro da aba (§4.1). `tipo` e `resultado` seguem como parking desta sub-visão — as quebras os mostram e permitem drill, mas não filtram a tela inteira.

### 5.3 Cor: o que foi computado

As 4 cores de `resultado` são as **mesmas do funil** — e isso é correto, não reuso indevido: a cor segue a **entidade**, e a entidade é o mesmo `resultado` que pinta o pin. Rodadas no validador de paleta contra `--surface #ffffff`:

| Check | Veredito |
|---|---|
| Faixa de luminosidade · separação para daltonismo (ΔE 9.6 deutan) · piso de visão normal (ΔE 19.1) | ✅ passam |
| **Piso de croma** | ❌ `#475569` (desqualificado) tem croma 0.037 — **lê como cinza** |
| **Contraste vs. superfície** | ⚠️ `#0ea5e9` (2.77) e `#f59e0b` (2.15) abaixo de 3:1 |

- O **`❌` foi aceito conscientemente**: desqualificado é inerte por definição, e o cinza comunica isso. Manter uma cor só por estado (mapa, funil e gráfico) vale mais do que passar no check.
- O **`⚠️` não é dispensável** e vira requisito: **rótulo + número sempre visíveis** na legenda. Cor nunca carrega o sentido sozinha — mesma disciplina de pistas não-cromáticas do [[spec-00-design-system]] §6.1.

### 5.4 Detalhe: por dia e linha a linha

**Dois gráficos de coluna empilhada por dia, empilhados por vendedor** — *Realizadas por dia* e *Planejadas por dia*. Uma **escala só** para os dois, para que as alturas sejam comparáveis entre eles; a diferença entre as duas barras **é o não-realizado**. Legenda de vendedor acima, compartilhada, com drill.

> ⚖️ **Janela fixa de 7 dias (L7D) — a única coisa da tela fora do filtro de período.** Amarrados ao período eles ficavam ilegíveis: "Este mês" rende 31 colunas de 11px e "Mês passado" vira um campo de buracos. Com 7 colunas de ~47px a leitura volta, e as colunas dividem a largura em vez de rolar. **O filtro de vendedor continua valendo.** O selo `L7D` no título é o que impede a leitura errada — sem ele, trocar o período e ver o gráfico parado seria bug; com ele, é contrato.

**Detalhamento ao apontar a coluna** — painel escuro com a data, uma linha por vendedor (cor · nome · quantidade · **%**) e o **Total 100%**. Aparece no `hover` do mouse, no toque (Android) e no foco por teclado; some ao sair, ao rolar e ao tocar fora. Dia sem atividade diz *"Sem atividade neste dia"* em vez de sumir — coluna vazia com tooltip mudo parece quebrada.

> **Nenhuma visita cai em fim de semana.** As tarefas-âncora nasciam de `ultima_visita` e de offsets fixos, e às vezes caíam num sábado; dentro da janela L7D isso virava uma barra de 3 visitas no domingo, que a supervisão lê como erro de sistema. O seed encosta data passada na sexta e joga data futura para a segunda. **Hoje é semeado como dia em andamento** (parte do plano já realizada, o resto de pé) — é o único dia em que o par de gráficos conta a história inteira, e sem isso a última coluna nasce vazia.

> ⚖️ **"Planejadas do dia" = todas as tarefas daquela data**, não só as que continuam `planejada`. Planejada e realizada são o mesmo objeto ([[tarefa]] §2): o que foi feito hoje **estava** no plano de hoje. Contar só o resíduo faria o gráfico do passado ser sempre zero.

**Tabela de atividades do período** — planejadas **e** realizadas, uma linha por atividade, **ordenável por qualquer coluna** (toque no cabeçalho; o mesmo cabeçalho inverte). Colunas: `vendedor` · `data` · `cliente` · **`cnpj`** · `nome da rota` · `tipo de visita` · `realizado` · `tipo de check-in` · `comentário` · `distância` · `endereço`. Rola nos dois eixos, com o cabeçalho fixo no topo. O nome do cliente abre o pin. **`cnpj` sai vazio (`—`) em lead cru** — nem todo ponto do mapa tem CNPJ, e isso é do modelo ([[estabelecimento]]), não falha de dado.

- **Vazio vai sempre para o fim**, nas duas direções: se `—` subisse ao topo ao inverter, ordenar esconderia o dado em vez de revelá-lo.
- **Teto de 150 linhas por ordenação, dito na tela.** Sem teto, cada toque custava ~250ms para reconstruir 300+ linhas × 10 células. O rodapé informa quantas ficaram fora — corte silencioso lê como "cobri tudo" quando não cobriu.
- **`nome da rota` deixou de ser rótulo derivado** (28/07): vem do **objeto [[rota]]** via `tarefa.rota_id`, e mostra **`Avulsa`** para tarefa fora de rota. No seed, ~4 em cada 5 linhas têm rota de verdade (com nome de bairro); as `Avulsa` são as visitas-âncora e as agendadas soltas. *(Era `Rota (dd/mm/aaaa)` a partir de `responsavel_id` + `data` — o rótulo existia justamente para não antecipar o objeto, e o objeto rascunho o substituiu.)*
- **Duas colunas continuam não sendo campos:** `tipo de check-in` deriva de `checkin_em` e `realizado` deriva de `status`. Ver [[tarefa]] §4 e §6.
- **`distancia_km` é campo novo** ([[tarefa]] §4), derivado no check-in e persistido. Exceção consciente ao não-escopo de GPS: o campo entrou, o motor que o preenche não. No protótipo o valor é **fictício**.

### 5.5 O seed precisou crescer

Com uma tarefa por pin, os gráficos por dia davam **pico de 4** e a tela parecia de brinquedo. O seed foi adensado para ritmo de campo: **63 → 538 tarefas**, 9–16 visitas por dia útil, **nenhuma em fim de semana**, e **hoje como dia em andamento** (parte do plano já realizada, o resto de pé).

> ⚖️ **Depois (28/07) o seed passou a nascer em ROTAS, inclusive no passado** — um caminho de código só (`rotaDoDia`) para o dia que já rodou e para o dia que vem: **522 tarefas em 117 rotas**, 3 vendedores × 3–5 paradas por dia útil, paradas espaçadas de 45min. **As paradas de cada rota saem por proximidade** (vizinhos mais próximos de uma âncora que gira), porque foi isso que fez o nome da rota ser verdade: uma janela qualquer dava *"Rota Boa Viagem"* com parada em Casa Forte, que é enfeite. **O passado tinha que virar rota também** — sem isso a coluna `Nome Rota` da tabela diria `Avulsa` em ~460 de 522 linhas, o oposto do que a tela passou a afirmar. **O funil não se moveu:** mesmas 7 colunas e mesmas contagens (verificado — `resultado` de cada parada continua vindo da âncora do pin).

> ✅ **Série temporal saiu do parking (28/07).** Ela tinha sido cortada por falta de dado; com o adensamento, os gráficos por dia passaram a ter forma.

> ⚖️ **O adensamento não move o funil.** `reconcileStatus` é *last-wins* (a última realizada manda), então cada tarefa de volume nasce com o **mesmo `resultado` da tarefa-âncora do seu pin** — o status derivado sai idêntico e o board mantém as mesmas 7 colunas e contagens.

> ⚠️ **O recorte "por vendedor" só demonstra algo se o dataset fictício semear `vendedor_responsavel_id`** nos estabelecimentos. Sem isso, tudo cai num bucket único. Era a dependência crítica desta tela para o gate ([[tarefa]] §9) — ✅ semeado, 3 vendedores.

### 5.6 Dado real também recebe atividades simuladas

O snapshot **não traz atividade nenhuma**. Sem simular, quem entra pelo porteiro vê a aba vazia e o board com quatro colunas desertas ([[spec-06-funil]] §7) — o oposto do que esta fatia existe para demonstrar. Desde 28/07, `useRealData()` roda o **mesmo** `buildTarefas` sobre os pins reais.

- **O volume é função do TIME, não da base.** Três vendedores fazem ~12 visitas por dia útil tenham eles 61 ou 6.914 pins, e `buildTarefas` já contava assim — o total de tarefas sai da mesma ordem dos dois lados, sem explodir com o tamanho do snapshot. Medido: 2.000 pins reais → 1.122 tarefas em ~105ms.
- **A régua do snapshot prevalece onde sabe mais.** `csc`/`aquisicao` vêm do ERP (o `Cadastrado` do snapshot **é** o sinal comercial) e são restaurados depois do reconcile; pin que não ganhou tarefa mantém o status da régua, em vez de cair para `sem_plano`.
- **`TD encontrado` precisa de empurrão.** A régua só conhece Cadastrado / visitado / não visitado, então a coluna nasceria vazia mesmo com tarefas. `buildTarefas(pins, {promoverTd: n})` promove ~15% dos visitados (teto 30) com uma tarefa datada de **hoje** — como o reconcile é *last-wins*, ela manda. **No fictício `opts` vem vazio e nada disso executa**: o board fictício não se mexe (verificado — 538 tarefas e as mesmas 7 contagens).
- **`Aquisição` continua vazia com dado real, e isso é correto** — exige saber se houve **pedido**, dado que o `salesforce.lead` não tem. Régua provisória mantida: todo convertido do snapshot cai em CSC.
- **Nada persiste.** `persist()` já sai cedo em `realMode`, então as tarefas simuladas morrem no reload junto com os pins. Verificado: o `localStorage` contém só o dataset fictício, sem um nome ou CNPJ real.

> ⚠️ **Faixa fixa de procedência, nas duas abas.** Isto é razão social, CNPJ e endereço **verdadeiros** com visitas, check-ins, distâncias e **motivos** que não aconteceram — inclusive as saídas laterais, com frases como *"não existe no endereço"* sobre um CNPJ real. Uma faixa âmbar (`.sim-banner`, só em `body.real-mode`) fica no topo da aba Atividades **e do Funil**, fora da área que rola, para sobreviver a print recortado: *"Dado real com atividades simuladas — nenhuma visita aconteceu."* O Funil entrou junto porque as colunas dele passaram a ser populadas pelas mesmas tarefas.

> **O vendedor real é descartado de propósito.** O snapshot traz `vendedor_rota_lead_c` → nome de gente de verdade, e as tarefas são atribuídas aos **três vendedores fictícios** mesmo assim. Número de desempenho inventado não vai no nome de uma pessoa real, na frente da liderança dela. Efeito colateral bem-vindo: dispensa registro dinâmico de vendedor e resolve a paleta — ela tem 3 cores e o campo teria N.

## 6. Filtros — o que compartilha e o que não

- **Compartilha:** a aba Atividades respeita o conjunto filtrado do mapa (só atividades de pins visíveis), como o Funil e a Inteligência. Filtro **oculta**, nunca deleta. Mas **a quickbar não aparece nesta aba** (SPEC 00 §5.2): o filtro do mapa não é útil aqui e custava 52px. Para ele não virar filtro invisível, o head mostra o pill `N filtros do mapa` (SPEC 00 §6.11) quando há algum ativo, e tocá-lo volta ao Mapa — o único lugar onde se mexe nele.
- **Não compartilha:** `período`, `vendedor`, `tipo` e `resultado` são filtros **da própria aba** (§4.1) — não entram na quickbar do mapa. Um filtro de tarefa não deve mexer nos pins. O mapa **não tem** filtro de vendedor, então não há dois seletores concorrentes: o da aba é o único, e é de tarefa.

## 7. Dados exibidos

Da [[tarefa]]: `tipo`, `data`, `status`, `resultado`, `motivo_perda`/`motivo_desqualificacao`, `proxima_acao`(+data), `responsavel_id`, `atrasada`, `duracao_min` (só na gerencial). Do [[estabelecimento]]: `nome_fantasia`, `tipologia` (emoji), cidade/zona — o suficiente para identificar o pin no card. Referência cruzada: coluna **"Onde aparece"** em [[tarefa]] §4.

## 8. Estados

- **Agenda vazia:** "Nada planejado neste recorte." — e nada mais. A frase **não** menciona atraso (§4.2), mesmo havendo dívida vencida escondida.
- **Rota sem parada planejada:** não é renderizada. Cancelar todas as paradas faz a rota sair da Agenda (o registro dela fica — nada se deleta).
- **Gerencial sem realizadas:** os KPIs continuam (o plano existe), as quebras somem — não se renderiza barra vazia — e o texto diz quantas planejadas há no recorte. A **tabela ainda aparece**, com as planejadas.
- **Tabela com drill que não casa nada:** o chip do critério continua visível, para o vazio ter explicação e ter saída.
- **Pin sem atividade:** o bloco do §2 mostra só o botão `＋ Agendar atividade`.
- **Pin só com planejada:** botão contextual + `Ver todas as atividades (1) ›`. Sem histórico, e sem banner (§2).
- **Check-in aberto:** o botão do pin vira `Check-out` — é assim que o sheet mostra que há visita em andamento, já que a planejada não tem mais linha própria. ⚠️ **A Agenda não marca mais isso** (não tem ação de execução, §4.2): a visita em andamento se vê no pin.
- **Loading:** protótipo estático (sem loading) — parking de skeleton no SPEC 00 §10.

## 9. Decisões & casos de borda

- **4ª aba, separada do Funil.** Atividade é objeto datado; funil é estado do estabelecimento — a fronteira travada em [[tarefa]] §2. Compartilhar tela reintroduziria a confusão que o contrato desfez. ⚠️ **Divergência consciente com o Notion** (Fase 3 item 6 agrupa "funil + agenda + gerencial" numa aba só): o agrupamento do Notion é rótulo de *plano*, escrito antes da fronteira de objeto existir. Reversível — fundir depois é envolver os dois num segmented control.
- **Bottom nav de 3 → 4 abas** altera o [[spec-00-design-system]] §5/§5.2. Com 4 abas os rótulos encurtam (`Intel.`); abaixo de 360px o rótulo pode ceder ao ícone. A ordem final agrupa por natureza — base (Mapa · Intel.) e depois pipeline (Funil · Atividades).
- **A quickbar some no Funil e nas Atividades**, não na Inteligência. Intel. é a *mesma base* do mapa em forma de lista, onde o filtro de pin é a ferramenta principal; Funil e Atividades são recortes de trabalho, onde ele é ruído. Consequência aceita: o filtro do mapa fica menos evidente nessas duas — mitigado pelo pill do head (§6), não eliminado.
- **Visão gerencial é sub-visão**, não aba (§5) — **e é a que abre por padrão** (§4). As duas coisas convivem: continua não valendo uma 5ª aba, mas é ela que dá o contexto de entrada.
- **Um filtro só para os três recortes** (§4.1), não um por sub-aba. Trocar de recorte mantém a pergunta ("este vendedor, neste período") e muda só a lente. O custo é o efeito colateral do §4.1.
- **A Agenda é calendário de rotas, de hoje em diante** (§4.2) — sem atrasadas, sem sugestões, sem check-in e sem concluir. A alternativa (manter tudo e só reagrupar por dia) devolvia a pilha que não deixava ver de qual dia era cada coisa.
- **Atraso não é assunto da Agenda, nem por referência** (§4.2). Decisão de produto de 28/07: nem bloco, nem badge, nem contagem, nem atalho. É a única "omissão não anunciada" aceita na aba — e é aceita porque anunciar já seria dar o destaque que se quis remover.
- **[[rota]] entrou como RASCUNHO declarado**, contra o que a [[tarefa]] §6 dizia (Rota é Fase 4, tarefa não é parada). O que entrou é identidade + nome + dia + dono; **sequenciamento continua fora**, e é ele que faz o objeto da Fase 4. Alternativa recusada: agrupar por `(vendedor, dia)` derivado — não distinguia rota de avulsa, e era justamente a distinção pedida.
- **Cancelar rota é cancelamento em lote, não exclusão** — N paradas viram `cancelada` e a rota fica sem paradas. Espelha *"tarefa não se deleta"*.
- **Calendário = `input type="date"` nativo**, não componente próprio. Sem build, sem 150 linhas novas para manter, e o Android já entrega o date picker do sistema. O preço é que esse controle não usa os tokens do [[spec-00-design-system]].
- **Perdido e Desqualificado só pelo check-out** (§3.1) — nunca botão solto, nunca arraste. A [[spec-06-funil]] recusa o drop nessas duas colunas (exigem motivo) e também em CSC/Aquisição (vêm do ERP).
- **Conversão não passa pelo check-out** (§3): `csc`/`aquisicao` vêm do ERP e prevalecem. Um card pode aparecer em Aquisição sem nenhuma atividade concluída.
- **Agendar é o que põe o pin no funil** (§2.1). Consequência de produto: o Funil deixa de mostrar a base inteira e passa a mostrar só o pipeline — a contagem dele divergir da do mapa é o comportamento correto ([[spec-06-funil]] §5).
- **Concluir sem check-in é válido** (atividade remota) — o check-in prova presença, não cria o registro. **Mas não tem botão em lugar nenhum** desde 28/07: saiu do pin (§2) e depois da Agenda (§4.2). A regra do modelo não mudou; o caminho de UI acabou.
- **`proxima_acao_data` não tem mais superfície na Agenda** (§4.2) — segue no modelo e na tabela da gerencial. Sugestão dentro de um calendário lê como compromisso.
- **O sheet do pin virou três telas** (§2.2), não uma tela longa. Empilhar lista completa + detalhe dentro do sheet mantém o vendedor no contexto do ponto; abrir tela cheia por atividade perderia o pin de vista.
- **Atividade realizada não tem ação** — é registro. Corrigir um desfecho errado exige concluir uma **nova** atividade, que é o mesmo caminho da requalificação (§3.1). Não há edição retroativa.
- **Recorrência não gera nada** na Fase 2: é só um valor de `tipo`. A agenda não se autopreenche.
- **Uma atividade aberta por pin** (com check-in sem check-out). Tentar abrir outra oferece fechar a anterior.
- **Sobre dado real:** o snapshot não traz atividades. Até 28/07 a aba nascia **vazia** com dado real; agora ela recebe as **mesmas tarefas simuladas** do fictício, com faixa fixa de procedência (§5.6). A alternativa era demonstrar a fatia só em dado fictício — o que tornaria o login no porteiro um caminho pior que o de demonstração.

## 10. Como o SPEC 07 usa o SPEC 00

Não repete tokens nem componentes: reusa o pin-sheet (§6.7), o sheet/painel bottom (§6.6), o modal de criação (§6.8), os transientes (§6.15), o shell/nav (§5) e o **chip** (§6.2) nos presets de período. **Pede ao SPEC 00:** a 4ª aba na navegação (§5.2), **três cores novas** de status (`csc`, `perdido`, `desqualificado`) e um badge de `resultado` (4 valores) — ambas em §2.6 — mais **seis componentes novos**: o **segmented control** (§6.10), o **pill de filtro herdado** (§6.11), a **barra de filtros de aba** (§6.12), os **gráficos da gerencial** (§6.13, com as regras de cor que passam a valer para qualquer gráfico do produto), a **faixa de procedência** (§6.14) e o **calendário da Agenda** (§6.16: bloco de dia com sarjeta e cabeçalho grudado, item com sarjeta de horário, bloco de rota com espinha). *(O card de atividade no molde do card de lead saiu junto com os cards da Agenda — §4.2.)*
