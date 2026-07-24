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

> 🧩 **Casca × motor.** Esta é a **casca** (Fase 2): colunas + card + **arrastar em memória**, sobre o `status` que o lead já tem — **sem objeto novo, sem banco**. O **motor** (persistência real, SLA/tempo-em-etapa, sync check-in→funil, visão gerencial) é **Fase 4/5** — ver plano revisado.

## 1. Layout

Aba full-screen que **cobre o mapa** quando ativa (`body.view-funil`, z-index 25 — mesma camada da Inteligência no SPEC 00 §5.1). Estrutura: **cabeçalho** (contagem + dica) → **board horizontal** de colunas → **empty state**. Terceira aba da bottom nav (🗺️ Mapa · **📊 Funil** · 📋 Inteligência); nas abas Funil/Inteligência os controles do mapa (FAB, banners) somem.

## 2. Colunas (o funil)

- **Uma coluna por status**, na ordem de `CRM_DATA.STATUS` (= ordem do funil): **Não visitado → Visitado → Em negociação → Convertido**. As colunas **saem da fonte** (`STATUS`), não são hard-coded — mudou o enum, mudou o board.
- **Cabeçalho da coluna:** dot na **cor do status** + rótulo + **contador**; borda superior de 3px na cor do status.
- **Cores** (do SPEC 00 / `STATUS`): Não visitado `#94a3b8` · Visitado `#0ea5e9` · Em negociação `#f59e0b` · Convertido `#10b981`.
- **Board rola na horizontal** (colunas mais largas que a tela no mobile: `min(78vw, 270px)`); o corpo de cada coluna rola na vertical.

## 3. Card

Compacto, no molde do card de lead ([[spec-05-intel]] §6.9 / SPEC 00 §6.9), mas enxuto:

- **Dot de origem** (cor + pista não-cromática: `cnpja_puro` tracejado, `cnpja_google` 3px, `validado_campo` badge `✓`).
- **Emoji de tipologia + nome** (elipse se estourar).
- **Cidade/UF** + **badge de qualidade** (Ouro/Prata/Bronze).
- **Toque simples (sem arrastar) = abre o pin** no mapa (volta pra aba Mapa, foca e abre o sheet) — mesmo gesto da Inteligência.

## 4. Arrastar card entre colunas (a interação-assinatura)

- **Pointer Events** → funciona em **touch (Android)** e **mouse**. Sem lib.
- **Disambiguação de gesto** via `touch-action`: board `pan-x` (rola horizontal), corpo da coluna e card `pan-y` (rola vertical). Assim: **swipe vertical rola a coluna**; **arrasto horizontal move o card**.
- **Limiar de 8px** antes de iniciar o arraste (abaixo disso é toque → abre o pin). Ao iniciar: **clone flutuante** (`.funil-ghost`) segue o dedo, o card original esmaece (`is-dragging`), a **coluna sob o ponteiro destaca** (`is-drop`).
- **Drop em coluna diferente → `CRM_STATE.setStatus(id, novoStatus)`**. `pointercancel` (ex.: o navegador assumiu o scroll) **aborta** o arraste sem efeito.
- `setStatus` re-renderiza tudo pelo pipeline real (`emit → reapply → refresh`): o card reaparece na coluna nova, contadores atualizam, **mapa e Inteligência ficam em sincronia**. Converter para **Convertido** também marca `isConverted` e grava `convertedAt` (se ainda não houver).

> ⚠️ **Tensão de domínio (decidida como casca).** [[estabelecimento]] §8 diz *"status muda só por fluxo/check-in, nunca por toque solto"*. Aqui o arraste é **afordância de protótipo** (demonstrar a visão de funil, o que a tarefa da Fase 2 pede). No **produto real**, o status avança por **check-in/fluxo** — o `setStatus` do drag é substituível por Kanban só-leitura sem quebrar nada.

## 5. Filtros compartilhados

O Funil consome o **mesmo conjunto filtrado** do mapa e da Inteligência (`filters.reapply` → `CRM_FUNIL.refresh(list)`). Mudar qualquer filtro atualiza as três superfícies. O filtro **oculta** cards — **nunca deleta** (o pin nunca some). Filtrar por `status` restringe **quais colunas têm cards** (não esconde a coluna).

## 6. Dados exibidos (do Estabelecimento)

No card: `status` (a coluna), `nome_fantasia`, `tipologia` (emoji), `origem_confianca` (dot), `qualidade` (badge), `zona`/cidade. Referência cruzada: coluna **"Onde aparece"** em [[estabelecimento]] §4 (linhas com `status` / `sheet` / `lista`). Campos comerciais e notas **não** vão ao card — vivem no pin sheet ([[spec-02-pin-sheet]]).

## 7. Estados

- **Vazio:** bloco central "Nenhum lead com esses filtros" + "Limpar filtros" (mesmo padrão da Inteligência).
- **Arrastando:** card original esmaecido, clone flutuante, coluna-alvo destacada.
- **Loading:** protótipo estático (sem loading) — parking de skeleton no SPEC 00 §10.

## 8. Decisões & casos de borda

- **Colunas derivadas do enum `STATUS`** — não hard-coded.
- **Arraste = casca** (§4): substituível por só-leitura; o motor de status é Fase 4/5.
- **Sobre dado real** (ver [[snapshot-dado-real|snapshot-dado-real.md]]): a régua do snapshot colapsa o funil em **Não visitado / Visitado / Convertido** — logo a coluna **"Em negociação" fica vazia** com dado real (1º/2º/3º contato são do time *inside*, não do campo). Com dado fictício, as 4 colunas têm cards.
- **Card filtrado some do board** se um filtro de `status` o excluir — comportamento esperado (consistente com o mapa).
- **Motor pendente (Fase 4/5):** persistência real do movimento, **SLA/tempo em etapa**, **sync check-in→funil**, **visão gerencial de tarefas** (por período/tipo/vendedor). A casca não os cobre.

## 9. Como o SPEC 06 usa o SPEC 00

Não repete tokens nem componentes: reusa o card de lead (§6.9), os dots de origem (§2.3), badges de qualidade (§2.4) e o shell/nav (§5). Só descreve o que é próprio do Funil (colunas por status, arraste, casca×motor).
