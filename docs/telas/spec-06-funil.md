---
title: "SPEC 06 — Funil (CRM Externo / Praso Maps)"
tipo: design-spec
herda: "spec-00-design-system"
fase: "Fase 2 (casca) — motor na Fase 4/5"
status: em-revisao
fonte_de_verdade: "index.html + js/funil.js + js/state.js + js/filters.js (o doc espelha o código)"
sources:
  - "js/funil.js — Kanban por status, arraste (Pointer Events), toque→pin"
  - "js/state.js — setStatus (move em memória); STATUS (funil)"
  - "js/filters.js — mesmo conjunto filtrado do mapa (reapply → refresh)"
  - "index.html — estrutura da aba"
  - "_bmad-output/planning-artifacts/plano-revisado-fases.md — Fase 2 tarefa 5 (casca) + motor Fase 4/5"
related:
  - "[[spec-00-design-system]]"
  - "[[spec-01-mapa]]"
  - "[[spec-05-intel]]"
  - "[[estabelecimento]]"
---

# SPEC 06 — Funil

> 🎯 **Objetivo.** A **visão de funil** — dor-manchete da KR ("falta visão de funil"): um **Kanban** que agrupa os leads pelo campo `status`, para o vendedor planejar e a liderança enxergar o pipeline. **Herda o [[spec-00-design-system]]** — tokens, shell e componentes não se repetem aqui.

> ✅ **Implementado (27/07).** Enum de **8 valores / 7 colunas** em `js/data.js` (`STATUS_BOARD`), board excluindo `sem_plano`, divisor antes das laterais e as três recusas de drop em `js/funil.js` + `js/state.js` (`applyStatus`). O `isConverted` do arraste foi removido — conversão vem do ERP. O doc voltou a ser espelho do código.

> 🧩 **Casca × motor.** Esta é a **casca** (Fase 2): colunas + card + **arrastar em memória**, sobre o `status` que o lead já tem — **sem objeto novo, sem banco**. O **motor** restante (persistência real, SLA/tempo-em-etapa) é **Fase 4**. ℹ️ O **sync check-in→funil** e a **visão gerencial** saíram deste bloco: viraram a fatia de Tarefa ([[spec-07-atividades]], CAP-11 a CAP-14).

## 1. Layout

Aba full-screen que **cobre o mapa** quando ativa (`body.view-funil`, z-index 25 — mesma camada da Inteligência no SPEC 00 §5.1). Estrutura: **cabeçalho** (contagem + dica) → **board horizontal** de colunas → **empty state**. **Terceira** aba da bottom nav (🗺️ Mapa · 📋 Intel. · **📊 Funil** · 🗓️ Atividades — 4 abas desde a [[spec-07-atividades]], agrupadas em base e pipeline: SPEC 00 §5.2); nessas abas os controles do mapa (FAB, banners) somem — **e a quickbar também** (§5).

## 2. Colunas (o funil)

- **Uma coluna por status**, na ordem de `CRM_DATA.STATUS` (= ordem do funil). **7 colunas**, em dois blocos: a **escada** — **Visita planejada → Visitado → TD encontrado → CSC → Aquisição** — e, ao final, as duas **saídas laterais**: **Perdido** · **Desqualificado**. As colunas **saem da fonte** (`STATUS`), não são hard-coded — mudou o enum, mudou o board.
- ⚠️ **`sem_plano` é o 8º valor do enum e NÃO tem coluna.** O funil é o **pipeline de trabalho, não a base** ([[estabelecimento]] §5): o pin entra no board quando ganha uma **visita planejada** (tarefa agendada) e sai dele se o plano for cancelado. Pin sem plano continua no **mapa** e na **Inteligência**.
- **CSC e Aquisição não são movidas por tarefa** ([[estabelecimento]] §5): vêm do **ERP** (cadastro e pedido) e **prevalecem**. No board isso significa que um card pode aparecer em Aquisição sem nenhuma atividade ter sido concluída.
- **Perdido e Desqualificado são saídas laterais, não degraus** ([[tarefa]] §5): o pin só entra nelas por `resultado` de uma tarefa, e guarda `status_anterior`. Visualmente devem ler como um bloco **separado da escada** (ex.: divisor antes delas), senão o board sugere que Desqualificado vem depois de Aquisição.
- **Cabeçalho da coluna:** dot na **cor do status** + rótulo + **contador**; borda superior de 3px na cor do status.
- **Cores** (do SPEC 00 §2.6 / `STATUS`): Visita planejada `#94a3b8` · Visitado `#0ea5e9` · TD encontrado `#f59e0b` · CSC `#14b8a6` · Aquisição `#10b981` · Perdido `#9f1239` · Desqualificado `#475569`. **Dot sempre cheio** — contorno é a linguagem de `origem_confianca`, não de status.
- **Board rola na horizontal** (colunas mais largas que a tela no mobile: `min(78vw, 270px)`); o corpo de cada coluna rola na vertical.

## 3. Card

Compacto, no molde do card de lead ([[spec-05-intel]] §6.9 / SPEC 00 §6.9), mas enxuto:

- **Dot de origem/relação** — mesma gramática do marker desde 29/07 (SPEC 00 §2.3): a **cor** é a relação comercial (azul cliente × lilás lead) e a **pista** é o degrau de origem (`cnpj` tracejado · `google` glifo `G` · `validado_campo` glifo `✓`). Passou de 11px para **14px** porque agora carrega o glifo — em 11px ele transbordava. Efeito colateral bem-vindo: pelo invariante `status ∈ {csc, aquisicao} ⟺ cadastrado`, o **azul cai exatamente sobre as duas colunas comerciais** e o board mostra de longe onde acaba o esforço e começa o resultado.
- **Emoji de tipologia + nome** (elipse se estourar).
- **Cidade/UF** + **badge de qualidade** (Ouro/Prata/Bronze).
- **Tag `💰 Venda realizada · aguardando pedido`** *(28/07, condicional)* — verde, largura cheia, embaixo de tudo.
- **Toque simples (sem arrastar) = abre o pin** no mapa (volta pra aba Mapa, foca e abre o sheet) — mesmo gesto da Inteligência.

> ⚖️ **A tag existe porque o card NÃO se move quando há venda.** O check-out ganhou um `Vendeu?` ([[spec-07-atividades]] §3), mas **venda declarada em campo não é conversão**: só o pedido no ERP leva o ponto a **Aquisição**. Sem a tag, o card de quem acabou de vender ficaria parado em *TD encontrado* sem nenhuma pista — o board estaria certo e pareceria errado. Com ela, o board mostra as duas verdades ao mesmo tempo: *o vendedor fechou* e *o sistema ainda não sabe*.
>
> **Derivada, nunca digitada** ([[estabelecimento]] §5): existe enquanto houver tarefa realizada com `venda_declarada` e o ponto **não** estiver em `aquisicao`. **Some sozinha quando o pedido chega** — lá ela não teria mais o que denunciar. **Em CSC ela fica**: cadastrado sem compra com venda declarada é exatamente o furo.
>
> ⚖️ **Sem contador de dias** (decisão Tatiana, 28/07). "Venda realizada há 12 dias" transformaria a tag num alerta de SLA, e SLA/tempo em etapa é Fase 4 ([[tarefa]] §6) — a tag responde *"vendeu?"*, não *"há quanto tempo está travado?"*.
>
> ⚖️ **Não aparece no sheet do pin nem na Inteligência** (decisão Tatiana, 28/07): a tag é leitura de **pipeline**, e o Funil é onde se olha pipeline. No pin, o fato continua acessível no **detalhe da atividade**.

## 4. Arrastar card entre colunas (a interação-assinatura)

- **Pointer Events** → funciona em **touch (Android)** e **mouse**. Sem lib.
- **Disambiguação de gesto** via `touch-action`: board `pan-x` (rola horizontal), corpo da coluna e card `pan-y` (rola vertical). Assim: **swipe vertical rola a coluna**; **arrasto horizontal move o card**.
- **Limiar de 8px** antes de iniciar o arraste (abaixo disso é toque → abre o pin). Ao iniciar: **clone flutuante** (`.funil-ghost`) segue o dedo, o card original esmaece (`is-dragging`), a **coluna sob o ponteiro destaca** (`is-drop`).
- **Drop em coluna diferente → `CRM_STATE.setStatus(id, novoStatus)`**, com **três exceções**: **Perdido** e **Desqualificado** exigem motivo (o drop abre o fluxo de tarefa ou é recusado), e **CSC/Aquisição** não são do campo (vêm do ERP — arrastar para lá é recusado). `pointercancel` (ex.: o navegador assumiu o scroll) **aborta** o arraste sem efeito.
- `setStatus` re-renderiza tudo pelo pipeline real (`emit → reapply → refresh`): o card reaparece na coluna nova, contadores atualizam, **mapa e Inteligência ficam em sincronia**. ⚠️ O antigo atalho "arrastar para Convertido marca `isConverted`/`convertedAt`" **deixa de existir**: `csc`/`aquisicao` vêm do ERP (`data_cadastro`/`data_primeira_compra`), não do arraste.
- **Recusa é recusa: nada se move pela metade** *(corrigido em 30/07)*. Arrastar um card **para fora de Perdido/Desqualificado** passa por *restaurar a etapa de origem e então aplicar a coluna alvo* — e até 30/07 o primeiro passo era escrito **antes** de a recusa ser decidida. Efeito: arrastar um `perdido` (origem *TD encontrado*) para *Visitado* mostrava o toast `O funil não regride` **e ainda assim** tirava o pin da lateral, com o `motivo_status` da perda colado num card em TD encontrado. Agora a transição é atômica: ou vale inteira, ou o pin não é tocado. Ver [[estabelecimento]] §5.
- **Sair da lateral por arraste apaga o `motivo_status`** — pela mesma razão de a conclusão apagar: o motivo explica a saída, e num card de volta na escada ele mentiria.

> ⚠️ **Tensão de domínio (decidida como casca).** [[estabelecimento]] §8 diz *"o `status` nunca é digitado"* — ou vem de tarefa concluída, ou vem do ERP. Aqui o arraste é **afordância de protótipo** (demonstrar a visão de funil, o que a tarefa da Fase 2 pede). No **produto real**, o status avança por **check-in/fluxo** — o `setStatus` do drag é substituível por Kanban só-leitura sem quebrar nada.

## 5. Filtros compartilhados

O Funil consome o mesmo conjunto filtrado do mapa e da Inteligência (`filters.reapply` → `CRM_FUNIL.refresh(list)`), **menos os pins `sem_plano`** — esses não estão no pipeline. Mudar qualquer filtro atualiza as três superfícies. O filtro **oculta** cards — **nunca deleta** (o pin nunca some). Filtrar por `status` restringe **quais colunas têm cards** (não esconde a coluna).

> ⚠️ **Este é o ponto em que o Funil deixa de espelhar o mapa.** Antes o board mostrava todo pin visível; agora mostra só quem entrou no pipeline. A contagem do cabeçalho do Funil vai divergir da do mapa — e isso é o comportamento correto, não bug.

**A quickbar não aparece nesta aba** (SPEC 00 §5.2): o filtro do mapa não é útil sobre um Kanban e custava 52px de altura, que voltam para o board. O filtro segue valendo — daí o pill **`N filtros do mapa`** no cabeçalho quando há algum ativo (SPEC 00 §6.11), que devolve ao Mapa ao toque. O botão `Limpar filtros` do empty state continua onde estava, para o caso extremo de zerar o board.

## 6. Dados exibidos (do Estabelecimento)

No card: `status` (a coluna), `nome_fantasia`, `tipologia` (emoji), `origem_confianca` (dot), `qualidade` (badge), `zona`/cidade. Referência cruzada: coluna **"Onde aparece"** em [[estabelecimento]] §4 (linhas com `status` / `sheet` / `lista`). Campos comerciais e notas **não** vão ao card — vivem no pin sheet ([[spec-02-pin-sheet]]).

## 7. Estados

- **Vazio:** bloco central "Nenhum lead com esses filtros" + "Limpar filtros" (mesmo padrão da Inteligência).
- **Arrastando:** card original esmaecido, clone flutuante, coluna-alvo destacada.
- **Loading:** protótipo estático (sem loading) — parking de skeleton no SPEC 00 §10.

## 8. Decisões & casos de borda

- **Colunas derivadas do enum `STATUS`** — não hard-coded.
- **Arraste = casca** (§4): substituível por só-leitura; o motor de status é Fase 4/5.
- ⚠️ **Sobre dado real — a régua do snapshot precisa ser refeita.** [[snapshot-dado-real|snapshot-dado-real.md]] colapsa o funil em **Não visitado / Visitado / Convertido**, e "Convertido" agora **se divide em CSC × Aquisição** — o que exige saber se houve **pedido**, dado que o snapshot do `salesforce.lead` não traz. Até resolver: todo convertido do snapshot cai em **CSC** (o mais conservador — cadastrado, compra não comprovada). E o "Não visitado" do snapshot vira `sem_plano`, que **fica fora do board**.

> ✅ **As colunas vazias foram resolvidas (28/07).** O snapshot segue sem trazer tarefa, mas `useRealData()` passou a **simular atividades sobre os pins reais** ([[spec-07-atividades]] §5.6) — então `Visita planejada`, `TD encontrado`, `Perdido` e `Desqualificado` deixam de nascer desertas. **`Aquisição` continua vazia com dado real, e isso é correto:** exige saber se houve pedido, e o `salesforce.lead` não tem essa fonte. A régua do snapshot prevalece em `csc`/`aquisicao` e em pin sem tarefa.
>
> ⚠️ **O board em modo real ganha faixa fixa de procedência** (`.sim-banner`): as colunas são populadas por visitas que **não aconteceram**, sobre CNPJs verdadeiros.
- **Card filtrado some do board** se um filtro de `status` o excluir — comportamento esperado (consistente com o mapa).
- **Motor pendente (Fase 4):** persistência real do movimento e **SLA/tempo em etapa**. O **sync check-in→funil** e a **visão gerencial de tarefas** já não são pendência daqui — são a fatia de Tarefa ([[spec-07-atividades]]): concluir uma tarefa move o funil pelo `resultado`, e a gerencial é sub-visão da aba Atividades.

## 9. Como o SPEC 06 usa o SPEC 00

Não repete tokens nem componentes: reusa o card de lead (§6.9), os dots de origem (§2.3), badges de qualidade (§2.4) e o shell/nav (§5). Só descreve o que é próprio do Funil (colunas por status, arraste, casca×motor).
