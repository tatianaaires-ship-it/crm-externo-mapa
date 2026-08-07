---
title: "Objeto Rota (RASCUNHO) — CRM Externo / Praso Maps"
tipo: objeto-dominio
fase: "Fase 2 (rascunho de casca) — objeto completo na Fase 4"
status: rascunho
fonte_de_verdade: "js/data.js (seed: `rotaDoDia`, nome: `nomeDeRota`) + js/state.js (coleção `rotas`, `criarRota`, `cancelarRota`, `paradasTodasDaRota`) + js/rota.js (o modo de MONTAR rota no mapa) + js/atividades.js (Agenda em calendário **e a sub-aba Rotas**) — implementado 28/07; o registro do objeto e a criação entraram em 31/07"
sources:
  - "Decisão Tatiana (2026-07-28): a Agenda vira calendário e mostra ROTAS, não atividades soltas; adicionar estabelecimento à rota cria a tarefa planejada"
  - "Decisão Tatiana (2026-07-31): o objeto ganha superfície própria (sub-aba Rotas, o primeiro recorte da aba Atividades) e o atalho de montar rota fica no MAPA, como 3º FAB"
  - "docs/objetos/tarefa.md §6 — Rota era não-escopo até a Fase 4 (esta é a exceção aberta, e ela é rascunho)"
  - "docs/telas/spec-07-atividades.md §4.2 e §4.3 — as superfícies"
  - "docs/telas/spec-01-mapa.md §6.2 — a decisão do atalho de montar rota"
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

**O nome é rótulo, não estrutura.** No protótipo ele sai da **zona dominante das paradas** (`Rota REC Zona Sul`), e é **único por dia** — duas "Rota REC Zona Sul" no mesmo dia leem como bug, então a segunda cai para a 2ª zona do bloco e, se ainda colidir, leva o primeiro nome do vendedor (`Rota REC Zona Sul · Aline`).

> 🔧 **Correção de doc (31/07): é a ZONA, não o bairro.** Esta linha dizia *"bairro dominante"* desde 28/07, e o código sempre leu `pin.zone` — que **deixou de guardar bairro em 29/07**, quando a zona virou vocabulário fechado e o bairro ganhou campo próprio ([[estabelecimento]] §5). Ninguém tinha reparado porque o nome continuou plausível. **Ficou a zona de propósito:** as paradas saem por proximidade e um bloco de 4–5 pins cruza vários bairros (o vendedor tem ~1 pin por bairro), então *"Rota Boa Viagem"* com parada em Casa Forte seria enfeite — a zona é o rótulo que continua verdadeiro para o bloco todo. A regra virou uma função só (`CRM_DATA.nomeDeRota`), usada pelo seed **e** pela criação no app; o que cada um injeta é só o *"já usei este nome hoje?"*.

## 2. Decisões-chave

1. **Rota é CONJUNTO, não sequência.** Nenhuma ordem de paradas é guardada. O que ordena na tela é a **`hora` de cada parada** ([[tarefa]] §4), não um índice na rota. Sequenciar é o que fica para a Fase 4 — e é por isso que este rascunho não a antecipa de verdade.
   > ⚖️ **Foi isto que decidiu o modo de montar rota não pedir HORÁRIO** (31/07): a rota criada no app nasce com todas as paradas `hora = null` (*dia inteiro*). Hora **ordenaria** as paradas — dar horários crescentes seria sequenciar por tabela, e dar o mesmo horário a todas seria mentira. Só as rotas **semeadas** têm hora, porque o seed as espaça de 45min para dar forma aos gráficos; é uma diferença declarada, não um bug ([[spec-01-mapa]] §6.2).
   > ⚖️ **E é por isso que a UI não numera pin nem desenha trajeto** — nem na montagem, nem no registro (§4.3 da [[spec-07-atividades]]). A lista de paradas é `<ul>`, nunca `<ol>` (§8).
2. **Adicionar estabelecimento à rota CRIA a tarefa planejada.** Não existe "parada sem tarefa". Consequência direta: montar uma rota **põe N pins no funil** (`sem_plano → visita_planejada`), e **cancelar a rota** cancela as N paradas e devolve ao funil só quem perdeu o **último** plano ([[tarefa]] §5).
3. **A rota não se deleta — cancela-se**, como a tarefa. Cancelar a rota deixa o registro dela de pé e marca as paradas `cancelada`. Espelha *"o pin nunca some"*.
4. **A rota é de UM vendedor.** `tarefa.responsavel_id` é **derivado do pin** ([[tarefa]] §5), então uma rota só pode conter estabelecimentos do mesmo responsável — senão a rota teria duas gentes dentro.
   > ⚖️ **Onde isso é aplicado (31/07):** o **1º ponto escolhido trava o dono** da rota, e tocar num pin de outro vendedor é recusado **nomeando os dois lados** — recusar em silêncio faria o vendedor tocar e nada mudar. `CRM_STATE.criarRota` recusa o conjunto misto de novo, em bloco e sem gravar nada: a UI barra, o store é a última linha.
5. **Mínimo de DUAS paradas** (31/07). Uma "rota" de um ponto é uma **avulsa com passos a mais**, e a avulsa já tem duas portas, as duas no pin ([[spec-07-atividades]] §2.1 e §3). O botão do modo pede o segundo ponto em vez de aceitar o conjunto de um. Não é regra de banco — é regra do fluxo de criação.

## 3. Schema-alvo (DDL)

> ✅ **A tabela EXISTE desde 06/08** (migration `20260805200457_init_praso_maps.sql`), **e isso não promove o objeto.** Mesma régua de 31/07, quando ele ganhou tela: *ganhar tabela não promove o objeto*. Enquanto §6 continuar verdadeira — sem ordem, sem trajeto, sem ETA —, este doc segue `rascunho`.
>
> ⛔ **A ausência é o contrato, e ela está no schema:** a tabela **não tem coluna de ordem**, e a migration diz por quê no comentário. Rota é conjunto.
>
> 🔧 **Uma divergência: `criada_em` saiu.** Ele era redundante com `created_at`, que a tabela já tem. O campo #5 de §4 deixou de existir.

```sql
CREATE TABLE rota (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,        -- rótulo; no protótipo = ZONA dominante das paradas (§1)
  data            date NOT NULL,        -- o dia da rota
  responsavel_id  uuid REFERENCES usuario(id),   -- UM vendedor por rota
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
| 2 | `nome` | text | **Sim** | `derivado` (protótipo) / `campo` (produto) | aba Atividades (**Rotas** · Agenda) · **tabela da gerencial** · sheet de criar (read-only) | **zona** dominante das paradas; **único por dia** |
| 3 | `data` | date | **Sim** | `campo` | **Rotas** (agrupa em Hoje/Próximas/Já rodaram) · Agenda (o dia do bloco) | o **único** campo digitado na criação: `min = hoje`, default hoje |
| 4 | `responsavel_id` | fk → [[vendedor]] | Não | **derivado** | **Rotas** e Agenda (cabeçalho da rota) | herda do pin das paradas; alvo de RLS na Fase 4 |
| 6 | `cancelada_em` | timestamptz | Não | `auto` (fluxo) | — | rota não se deleta |

- **Origem:** `derivado` · `campo` (digitado) · `auto`.
- As **paradas não são campo desta tabela**: são as [[tarefa]]s com `rota_id` apontando para cá.

## 5. Campos derivados / calculados

- **`paradas`** — as tarefas com este `rota_id`. **Duas leituras, e a diferença é a superfície** (31/07): na **Agenda** só as `planejada` contam, porque ela é o *plano* (`paradasDaRota`); na **sub-aba Rotas** contam **todas**, em qualquer situação (`paradasTodasDaRota`), porque ela é o *registro do objeto*. Sem a segunda, uma rota que já rodou apareceria com "0 paradas" e a cancelada não apareceria.
- **Execução** (só exibição, [[spec-07-atividades]] §4.3) — quantas paradas estão `realizada` · `planejada` · `cancelada`. **Não é estado da rota** (§6): é contagem das paradas, feita na hora. A rota continua sem saber se foi concluída.
- **`faixa_horaria`** — `min(hora)`–`max(hora)` das paradas visíveis. Só exibição.
- **`nome`** (no protótipo) — **zona** que mais aparece nas paradas, desempatada por unicidade no dia (§1). No produto, o vendedor/supervisão digita. No sheet de criar, ele aparece **read-only**: mostrado para ninguém ser surpreendido por ele depois, não editável porque é derivado.
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
- **Montar rota move o funil**; cancelar rota é a **única reversão**, e só para quem perdeu o último plano ([[tarefa]] §5). ⚖️ **Mas não tira ninguém de saída lateral** (31/07): parada de rota é plano, não constatação, então pin `perdido`/`desqualificado` **fica onde está** e volta ao funil no check-out. O sheet de criar avisa isso em âmbar **antes** do toque — é a promessa que 30/07 corrigiu, e refazê-la errada aqui seria repetir o bug em outra porta. **Verificado no ciclo completo:** criar com 2 `sem_plano` + 2 laterais moveu só os dois primeiros; cancelar devolveu só eles.
- **Não se monta rota no passado.** `min = hoje` no sheet, e o botão vira `O dia já passou`. Mesma razão do agendar ([[spec-07-atividades]] §2.1): parada planejada em data vencida não aparece na Agenda, então a rota nasceria com N compromissos invisíveis.
- **Uma rota, um vendedor** (§2.4).
- **Nome único por dia** (§1) — não é constraint de banco no rascunho, é regra do gerador.
- **Tudo em memória.** A coleção `rotas` vive no estado (chave `localStorage` **v9** — ela entrou na v6 e a chave subiu depois por outros motivos) e, em **dado real**, não persiste — como as tarefas simuladas ([[spec-07-atividades]] §5.6). ⚠️ **A fatia de 31/07 não subiu a chave**, nem para ler nem para criar: nenhum campo novo entrou no objeto, e a rota criada no app tem o mesmo shape da semeada. **Verificado:** rota criada sobrevive ao reload no modo fictício.
- **LGPD:** a rota não carrega dado de pessoa física. O nome é bairro.

## 9. Anexos / parkings

- **Parkings (o objeto de verdade, Fase 4):** sequenciamento e otimização · ETA/deslocamento · rota recorrente/template · atribuição pela supervisão + RLS · estado da rota · rota multi-dia.
- **Dívida de UI — FECHADA em 31/07, nas duas metades:**
  - ✅ **Ler o objeto.** O objeto ganhou superfície própria — a sub-aba **Rotas**, primeiro recorte da aba Atividades ([[spec-07-atividades]] §4.3): lista todas as rotas de qualquer data, expande as paradas, mostra a execução e cancela. Fecha o buraco mais silencioso do rascunho: **62 das 117 rotas do seed não tinham parada planejada** e por isso **não existiam em tela nenhuma** — *"a rota não se deleta"* (§2.3) estava valendo como *"a rota fica invisível"*.
  - ✅ **Criar o objeto.** Montar rota é um **modo no mapa** (`js/rota.js` + `CRM_STATE.criarRota`): escolher N pins, um toque cada, e um sheet que pede **só o dia**. Duas portas ligam o mesmo modo — o **3º FAB `🧭`** e o `＋ Nova rota` da sub-aba ([[spec-01-mapa]] §6.2). **As rotas deixaram de ser só semeadas**; agendar pelo sheet do pin continua criando **avulsa** (`rota_id` null), como deve.
  - ⛔ **O "seletor buscável de pin" prometido em [[spec-07-atividades]] §4 está recusado** para montar rota: o critério de uma rota é **proximidade** (é assim que o próprio seed a monta), e um campo de texto obriga a digitar nomes que ninguém sabe de cabeça para formar um conjunto geográfico.
- **O que a superfície nova NÃO passou a prometer:** nenhuma ordem de paradas, nenhum trajeto, nenhum ETA, nada de "otimizar" — a lista é `<ul>` sem índice, de propósito (§2.1). Enquanto §6 continuar verdadeira, este doc segue `rascunho`: ganhar tela não promove o objeto.
- **O que este objeto tirou da [[tarefa]]:** o campo derivado `nome_rota` (rótulo `Rota (dd/mm/aaaa)` a partir de `responsavel_id` + `data`) **deixou de ser derivado** e passou a vir daqui. A coluna da tabela da gerencial mostra `rota.nome` ou **`Avulsa`**.
