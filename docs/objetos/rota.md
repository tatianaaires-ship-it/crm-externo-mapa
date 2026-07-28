---
title: "Objeto Rota (RASCUNHO) — CRM Externo / Praso Maps"
tipo: objeto-dominio
fase: "Fase 2 (rascunho de casca) — objeto completo na Fase 4"
status: rascunho
fonte_de_verdade: "js/data.js (seed: `rotaDoDia`) + js/state.js (coleção `rotas`, `cancelarRota`) + js/atividades.js (Agenda em calendário) — implementado 28/07"
sources:
  - "Decisão Tatiana (2026-07-28): a Agenda vira calendário e mostra ROTAS, não atividades soltas; adicionar estabelecimento à rota cria a tarefa planejada"
  - "docs/objetos/tarefa.md §6 — Rota era não-escopo até a Fase 4 (esta é a exceção aberta, e ela é rascunho)"
  - "docs/telas/spec-07-atividades.md §4.2 — a superfície"
related:
  - "[[tarefa]]"
  - "[[estabelecimento]]"
  - "[[vendedor]]"
  - "[[spec-07-atividades]]"
---

# Objeto Rota — RASCUNHO

> **Uma linha:** o **conjunto de estabelecimentos** que um vendedor vai visitar **num dia** — e **adicionar um estabelecimento à rota é o que CRIA a [[tarefa]] planejada** daquela parada.
> **Vizinhos:** [[tarefa]] · [[estabelecimento]] · [[vendedor]] · [[spec-07-atividades]]

> 🚧 **Isto é um RASCUNHO, declarado.** A [[tarefa]] §6 mantinha Rota como objeto da **Fase 4** e cravava que *"uma tarefa não é uma parada"*. Em 28/07 a decisão de produto foi mostrar a Agenda **em rotas** — e para isso o objeto precisava existir de alguma forma. O que entrou é o **mínimo** que a tela pede: identidade, nome, dia e dono. O que **não** entrou é justamente o que fazia dele um objeto de Fase 4 — **sequenciamento, otimização de trajeto, tempo de deslocamento, capacidade e recorrência de rota** (§6). Enquanto isso for verdade, este doc fica `rascunho` e o DDL não vale como alvo fechado.

> 🧩 **Casca × motor.** **Casca (Fase 2):** criar/semear rota, listar por dia na Agenda, cancelar rota (cancela as paradas), tudo **em memória**. **Motor (Fase 4):** persistência, sequenciamento e otimização de trajeto, ETA/deslocamento, rota recorrente, rota atribuída pela supervisão com RLS.

## 1. Conceito

Uma **rota** é o plano de campo de **um vendedor** para **um dia**: um conjunto de estabelecimentos a visitar. Ela não guarda o que aconteceu — quem guarda é a [[tarefa]]. A ponte é `tarefa.rota_id`: **cada parada é uma tarefa**, e a rota é só o agrupador com nome.

A **chave de identidade** é o `id`. Não há chave natural: o mesmo vendedor pode ter mais de uma rota no mesmo dia (manhã executada + tarde planejada, por exemplo), então `(responsavel_id, data)` **não** é único.

**O nome é rótulo, não estrutura.** No protótipo ele sai do **bairro dominante das paradas** (`Rota Boa Viagem`), e é **único por dia** — duas "Rota Boa Viagem" no mesmo dia leem como bug, então a segunda cai para o 2º bairro do bloco e, se ainda colidir, leva o primeiro nome do vendedor (`Rota Boa Viagem · Aline`).

## 2. Decisões-chave

1. **Rota é CONJUNTO, não sequência.** Nenhuma ordem de paradas é guardada. O que ordena na tela é a **`hora` de cada parada** ([[tarefa]] §4), não um índice na rota. Sequenciar é o que fica para a Fase 4 — e é por isso que este rascunho não a antecipa de verdade.
2. **Adicionar estabelecimento à rota CRIA a tarefa planejada.** Não existe "parada sem tarefa". Consequência direta: montar uma rota **põe N pins no funil** (`sem_plano → visita_planejada`), e **cancelar a rota** cancela as N paradas e devolve ao funil só quem perdeu o **último** plano ([[tarefa]] §5).
3. **A rota não se deleta — cancela-se**, como a tarefa. Cancelar a rota deixa o registro dela de pé e marca as paradas `cancelada`. Espelha *"o pin nunca some"*.
4. **A rota é de UM vendedor.** `tarefa.responsavel_id` é **derivado do pin** ([[tarefa]] §5), então uma rota só pode conter estabelecimentos do mesmo responsável — senão a rota teria duas gentes dentro.

## 3. Schema-alvo (DDL)

> ⚠️ **Banco a confirmar na Fase 4** — DDL **proposto**, e aqui **duplamente provisório**: o objeto em si é rascunho (§0).

```sql
CREATE TABLE rota (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,        -- rótulo; no protótipo = bairro dominante das paradas
  data            date NOT NULL,        -- o dia da rota
  responsavel_id  uuid REFERENCES usuario(id),   -- UM vendedor por rota
  criada_em       timestamptz NOT NULL DEFAULT now(),
  cancelada_em    timestamptz,          -- rota não se deleta
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- A parada é a própria tarefa (não há tabela de junção):
--   ALTER TABLE tarefa ADD COLUMN rota_id uuid REFERENCES rota(id);   -- NULL = avulsa
-- ⚠️ Nenhuma coluna de ORDEM: rota é conjunto. Sequenciamento é Fase 4.
```

## 4. Campos

| # | Campo | Tipo | Obrig. | Origem | Onde aparece | Notas |
|---|---|---|---|---|---|---|
| 1 | `id` | uuid | Sim | auto | — | PK |
| 2 | `nome` | text | **Sim** | `derivado` (protótipo) / `campo` (produto) | aba Atividades (Agenda) · **tabela da gerencial** | bairro dominante das paradas; **único por dia** |
| 3 | `data` | date | **Sim** | `campo` | Agenda (o dia em que o bloco aparece) | |
| 4 | `responsavel_id` | fk → [[vendedor]] | Não | **derivado** | Agenda (cabeçalho da rota) | herda do pin das paradas; alvo de RLS na Fase 4 |
| 5 | `criada_em` | timestamptz | Sim | auto | — | |
| 6 | `cancelada_em` | timestamptz | Não | `auto` (fluxo) | — | rota não se deleta |

- **Origem:** `derivado` · `campo` (digitado) · `auto`.
- As **paradas não são campo desta tabela**: são as [[tarefa]]s com `rota_id` apontando para cá.

## 5. Campos derivados / calculados

- **`paradas`** — as tarefas com este `rota_id`. Na Agenda, só as `planejada` contam (é o plano); a parada concluída passa a ser história da [[tarefa]].
- **`faixa_horaria`** — `min(hora)`–`max(hora)` das paradas visíveis. Só exibição.
- **`nome`** (no protótipo) — bairro que mais aparece nas paradas, desempatado por unicidade no dia (§1). No produto, o vendedor/supervisão digita.
- **Posição da rota no dia** — a `hora` da sua primeira parada. Não é campo.

## 6. O que NUNCA fica aqui (por enquanto)

O que faz Rota ser objeto de **Fase 4**, e que este rascunho **não** tem:

- **Ordem/sequência das paradas**, otimização de trajeto, tempo e distância de deslocamento entre paradas.
- **ETA por parada**, capacidade do dia, janela de atendimento do cliente.
- **Rota recorrente / template de rota** (visitar este conjunto toda terça).
- **Rota atribuída pela supervisão** com RLS — hoje o dono é derivado do pin.
- **Estado da rota** (em andamento / concluída). Quem tem estado é a [[tarefa]]; a rota é o agrupador.
- **O que aconteceu na visita** — check-in/out, resultado, motivo, distância: tudo isso é [[tarefa]], e continua sendo. A rota **agrupa**, não registra.

## 7. Relações

```text
 ┌──────────┐                         ┌──────────────────┐
 │   ROTA   │◄── 1:N (rota_id) ───────┤      TAREFA      ├── N:1 ──► ESTABELECIMENTO
 │ dia+dono │   parada = tarefa       │ atividade datada │            (o pin)
 └────┬─────┘   (NULL = avulsa)       └──────────────────┘
      │ N:1
      ▼
   VENDEDOR
```

| Relação | Tipo | Nota |
|---|---|---|
| Rota → Tarefa | 1:N | via `tarefa.rota_id`; **`NULL` = tarefa avulsa**, agendada solta pelo vendedor |
| Rota → Vendedor | N:1 | `responsavel_id`, derivado do pin das paradas |
| Rota → Estabelecimento | — | **não existe direto**: sempre pela tarefa. Não há tabela de junção rota×estabelecimento |

## 8. Regras de domínio / da fatia

- **Parada é tarefa.** Não há parada sem [[tarefa]] planejada, e não há tarefa em duas rotas.
- **Rota é conjunto, não sequência** (§2.1). Na UI a lista de paradas é `<ul>`, não `<ol>`, de propósito.
- **Montar rota move o funil**; cancelar rota é a **única reversão**, e só para quem perdeu o último plano ([[tarefa]] §5).
- **Uma rota, um vendedor** (§2.4).
- **Nome único por dia** (§1) — não é constraint de banco no rascunho, é regra do gerador.
- **Tudo em memória.** A coleção `rotas` vive no estado (chave `localStorage` v6) e, em **dado real**, não persiste — como as tarefas simuladas ([[spec-07-atividades]] §5.6).
- **LGPD:** a rota não carrega dado de pessoa física. O nome é bairro.

## 9. Anexos / parkings

- **Parkings (o objeto de verdade, Fase 4):** sequenciamento e otimização · ETA/deslocamento · rota recorrente/template · atribuição pela supervisão + RLS · estado da rota · rota multi-dia.
- **Dívida de UI:** **não existe tela para criar rota** no protótipo. As rotas são **semeadas**; agendar pelo sheet do pin cria sempre uma **avulsa** (`rota_id` null). O FAB com seletor buscável de pin ([[spec-07-atividades]] §4) segue prometido e não implementado — e é ele que fecharia o ciclo "adicionar estabelecimento à rota".
- **O que este objeto tirou da [[tarefa]]:** o campo derivado `nome_rota` (rótulo `Rota (dd/mm/aaaa)` a partir de `responsavel_id` + `data`) **deixou de ser derivado** e passou a vir daqui. A coluna da tabela da gerencial mostra `rota.nome` ou **`Avulsa`**.
