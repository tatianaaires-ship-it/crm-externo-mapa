---
title: "Objeto Tarefa — CRM Externo / Praso Maps"
tipo: objeto-dominio
fase: "Fase 2 (casca) — motor na Fase 3/4/5"
status: em-revisao
sources:
  - "KR 1.5 — Notion (39953c3f2db181599030c3cc48c989be), Fase 2 item 8 · Fase 3 itens 4 e 6 · Fase 4 item 2"
  - "_bmad-output/specs/spec-crm-externo/SPEC.md (CAP-6 revisada, CAP-11/12/13)"
  - "Decisões Tatiana (2026-07-27): check-in É a tarefa · uma coleção só · resultado move o funil · recorrência sem geração · responsável derivado · motivo_perda fechado"
related:
  - "[[estabelecimento]]"
  - "[[vendedor]]"
  - "[[rota]]"
  - "[[spec-06-funil]]"
---

# Objeto Tarefa

> **Uma linha:** a **atividade datada** que um vendedor faz (ou vai fazer) num estabelecimento — e **check-in/check-out é a própria tarefa**, não um evento separado.
> **Vizinhos:** [[estabelecimento]] · [[vendedor]] · [[spec-06-funil]]

> 🧩 **Casca × motor.** **Casca (Fase 2, esta fatia):** criar/concluir atividade **em memória**, dentro do pin e numa aba de Atividades, + visão gerencial por período/tipo/vendedor. **Motor (depois):** persistência + auth/RLS (Fase 4) · SLA/tempo em etapa (Fase 4) · check-in por proximidade e fotos (Fase 3/4) · agenda semanal com calendário externo (Fase 3) · recorrência automática e alerta "sem visita há N dias" (Fase 5).

## 1. Conceito

Uma **tarefa** é uma atividade **com data e dono** ligada a **um** estabelecimento. É o registro de campo: o vendedor agenda, vai, faz **check-in**, faz **check-out** e diz **o que resultou**. A **chave de identidade** é o `id` (não há chave natural — o mesmo pin recebe N tarefas ao longo do tempo); a ponte com o resto do modelo é `estabelecimento_id`.

**Tarefa e visita são a mesma coisa.** Decisão Tatiana (27/07): *"o check-in É uma tarefa, são basicamente sinônimos"*. Consequência direta — **não existe objeto `Visita`**: `visita.md` deixa de ser doc próprio e é absorvido aqui, e o array `pin.checkins` do protótipo passa a **derivar** das tarefas daquele pin.

## 2. Decisões-chave

1. **Planejada e realizada são o MESMO objeto.** Uma coleção só; `status` distingue. A **agenda** lê `status = planejada`; a **visão gerencial** lê `status = realizada` com `data` no período. Dois recortes, uma lista — é isso que faz a visão gerencial sair de graça sobre a casca.
2. **A Tarefa dirige o funil de ponta a ponta — até onde o campo alcança.** **Agendar** faz o pin entrar (`visita_planejada`); o **`resultado`** ao concluir move as etapas de campo e as saídas laterais; **`csc` e `aquisicao` vêm do ERP** (cadastro/pedido) e **prevalecem**. O `tipo` diz o *propósito*, o `resultado` diz o *efeito* (§5). O `status` tem três fontes — e nenhuma é digitação.
3. **Recorrência é rótulo, não motor.** Na Fase 2, `tipo = recorrencia` só classifica. **Nada é gerado automaticamente** — nem N ocorrências futuras, nem "concluir cria a próxima" (parking §9).

## 3. Schema-alvo (DDL)

> ⚠️ **Banco a confirmar na Fase 4** — DDL **proposto** (Postgres/PostGIS como alvo provável), **não travado**.

```sql
CREATE TABLE tarefa (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id  uuid NOT NULL REFERENCES estabelecimento(id),  -- o vínculo com o pin
  tipo                text NOT NULL,        -- primeira_visita | follow_up | recorrencia
  data                date NOT NULL,        -- planejada (futuro) ou realizada (passado)
  hora                time,                 -- horário MARCADO; NULL = "dia inteiro" (§4)
  status              text NOT NULL DEFAULT 'planejada',  -- planejada | realizada | cancelada
  responsavel_id      uuid REFERENCES usuario(id),        -- DERIVADO (§5) — alvo de RLS
  rota_id             uuid REFERENCES rota(id),           -- NULL = AVULSA (fora de rota, §4)
  -- execução (check-in É a tarefa)
  checkin_em          timestamptz,
  checkout_em         timestamptz,          -- preenchido => status = realizada
  distancia_km        numeric(5,2),         -- DERIVADA no check-in: GPS do vendedor × geo do pin.
                                            -- NULL em atividade remota (sem check-in). Nunca digitada.
  -- desfecho
  resultado           text,                 -- sem_avanco | td_encontrado | perdido | desqualificado
                                            -- NÃO existe 'convertido': conversão vem do ERP, não de tarefa (§5)
  motivo_perda        text,                 -- obrigatório se resultado = 'perdido'
  motivo_desqualificacao text,              -- obrigatório se resultado = 'desqualificado'
  motivo_texto        text,                 -- só quando o motivo escolhido for 'outro'
  -- continuidade
  proxima_acao        text,
  proxima_acao_data   date,
  notas               text,                 -- nota DESTA atividade (≠ nota do pin)
  criado_por          uuid REFERENCES usuario(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (resultado <> 'perdido' OR motivo_perda IS NOT NULL),
  CHECK (resultado <> 'desqualificado' OR motivo_desqualificacao IS NOT NULL)
);
```

## 4. Campos

| # | Campo | Tipo | Obrig. | Origem | Onde aparece | Notas |
|---|---|---|---|---|---|---|
| 1 | `id` | uuid | Sim | auto | — | PK |
| 2 | `estabelecimento_id` | fk → [[estabelecimento]] | **Sim** | auto | — | vem do pin de onde foi criada; **1 tarefa = 1 pin** |
| 3 | `tipo` | enum (3) | **Sim** | `campo` | sheet do pin · aba Atividades · **filtro gerencial** | 1ª visita · follow-up · recorrência |
| 4 | `data` | date | **Sim** | `campo` | sheet do pin · aba Atividades · **filtro gerencial** | futuro = planejada; passado = realizada |
| 4b | `hora` | time | Não | `campo` | **Agenda** (sarjeta de horário) · sheet do pin | horário **marcado**. **Opcional**: sem ela, a atividade é *dia inteiro* e vai no topo do dia ([[spec-07-atividades]] §4.2). ⚠️ **`atrasada` continua sendo por DIA** (§5), nunca por hora |
| 5 | `status` | enum (3) | Sim | **derivado**/fluxo | sheet do pin · aba Atividades | §5 — nasce `planejada` |
| 6 | `responsavel_id` | fk → [[vendedor]] | Não | **derivado** | aba Atividades · **filtro gerencial** | §5 — nunca digitado; alvo de RLS |
| 7 | `checkin_em` | timestamptz | Não | `auto` (fluxo) | sheet do pin | botão de check-in; promove o pin a `validado_campo` |
| 8 | `checkout_em` | timestamptz | Não | `auto` (fluxo) | sheet do pin | fecha a tarefa → `status = realizada` |
| 9 | `resultado` | enum (4) | Não | `campo` (no check-out) | sheet do pin · **filtro gerencial** | move as etapas **de campo** do funil (§5) — nunca CSC/Aquisição |
| 10 | `motivo_perda` | enum (6) | Cond. | `campo` | sheet do pin · **filtro gerencial** | obrigatório se `resultado = perdido`; **fechado** |
| 11 | `motivo_desqualificacao` | enum (6) | Cond. | `campo` | sheet do pin · **filtro gerencial** | obrigatório se `resultado = desqualificado`; **fechado** |
| 12 | `motivo_texto` | text | Cond. | `campo` | sheet do pin | só quando o motivo escolhido for `outro` (serve aos dois enums) |
| 13 | `proxima_acao` | text | Não | `campo` | sheet do pin · **card do Funil** | o que fazer depois, em uma linha |
| 14 | `proxima_acao_data` | date | Não | `campo` | **visão gerencial** (tabela) | ⚠️ **saiu da Agenda em 28/07** ([[spec-07-atividades]] §4.2): sugestão dentro de um calendário lê como compromisso marcado. Continua no modelo, sem virar tarefa |
| 15 | `notas` | text | Não | `campo` | sheet do pin | nota **da atividade** — a nota **do ponto** é `nota_estabelecimento` (§6) |
| 16 | `criado_por` | fk → [[vendedor]] | Não | `auto` | — | fallback de `responsavel_id` |
| 17 | `distancia_km` | numeric(5,2) | Não | **derivado** (no check-in) | **visão gerencial** (tabela) | GPS do vendedor × geo do pin no momento do check-in. `NULL` em atividade remota. **Persiste** — é prova de presença, não pode ser recalculada depois |
| 18 | `atrasada` | boolean | — | **derivado** | **nenhuma superfície destaca** | §5 — não persiste. ⚠️ **saiu da Agenda em 28/07** e a Agenda também **não conta nem aponta** a dívida: o derivado continua existindo no modelo, mas nenhuma tela o exibe como marca. Na tabela da gerencial a tarefa vencida aparece só por ser planejada de data passada |
| 19 | `duracao_min` | numeric | — | **derivado** | visão gerencial | §5 — não persiste |
| 20 | `tipo_checkin` | enum (2) | — | **derivado** | **visão gerencial** (tabela) | `presencial` se `checkin_em` existe, `remoto` se a tarefa foi concluída sem ele (§5). **Não é campo** — não há o que digitar |
| 21 | ~~`nome_rota`~~ | — | — | — | — | ⛔ **Deixou de existir (28/07).** Era rótulo derivado (`Rota (dd/mm/aaaa)`); agora o nome vem do **objeto [[rota]]** via `rota_id`, e a tabela da gerencial mostra `rota.nome` ou **`Avulsa`** |
| 22 | `rota_id` | fk → [[rota]] | Não | `campo` | **Agenda** (agrupa as paradas) · **visão gerencial** (coluna Nome Rota) | a rota de que esta tarefa é **parada**. **`NULL` = avulsa** — o vendedor marcou este compromisso solto. ⚠️ [[rota]] é **rascunho**, não objeto fechado |

- **Origem:** `fonte:sf` · `derivado` · `admin` · `campo` (digitado pelo vendedor) · `auto`.
- **Onde aparece:** `sheet do pin` (CAP-11) · `aba Atividades` (CAP-12) · `filtro gerencial` / `visão gerencial` (CAP-13) · `card do Funil` ([[spec-06-funil]]).

### Vocabulários fechados

| Campo | Valores |
|---|---|
| `tipo` | `primeira_visita` · `follow_up` · `recorrencia` |
| `status` | `planejada` · `realizada` · `cancelada` |
| `resultado` | `sem_avanco` · `td_encontrado` · `perdido` · `desqualificado` |
| `motivo_perda` | `preco` · `compra_do_concorrente` · `sem_interesse` · `sem_contato_com_decisor` · `credito_reprovado` · `outro` |
| `motivo_desqualificacao` | `nao_existe_no_endereco` · `fora_do_perfil` · `fechado_definitivamente` · `endereco_e_residencia` · `duplicado` · `outro` |

> **Perder ≠ desqualificar.** `perdido` = a **negociação** não fechou, mas o ponto segue oportunidade válida (reabordar). `desqualificado` = o **ponto** não é oportunidade. Por isso os motivos são dois vocabulários e não um: a visão gerencial precisa responder *"quantas negociações perdi?"* separado de *"quanto da minha base é lixo?"* — a segunda é a dor-manchete da KR (rotas caindo em endereço vazio).

> `status` (ciclo de vida da tarefa) e `resultado` (desfecho) são **campos separados** de propósito: `perdido` e `desqualificado` são resultado, não status — a tarefa **foi realizada**, e por isso conta na visão gerencial.

## 5. Campos derivados / calculados

- **`status`** — nasce `planejada`. `checkout_em` preenchido ⇒ `realizada` (caminho normal, presencial). Concluir **sem check-in** também é válido — atividade remota, ex. follow-up por telefone: registra-se `resultado` e a tarefa vira `realizada` com `checkin_em`/`checkout_em` nulos. `cancelada` só por ação explícita (**não há deletar** — §8).
- **`responsavel_id`** — herda `vendedor_responsavel_id` do [[estabelecimento]]; se nulo, é o **criador** da atividade. Sem auth por usuário até a Fase 4, "criador" é a identidade única da sessão. **Nunca digitado.**
- **`atrasada`** — `status = planejada` **E** `data < hoje`. Só de exibição. ⚖️ **Por DIA, nunca por hora**, mesmo com `hora` preenchida: uma tarefa marcada para hoje às 15h não vira "atrasada" às 15h05. Numa demo isso significaria a tela mudando de estado no meio de uma reunião, e no campo significaria acusar atraso de quem está a caminho. ⚠️ Desde 28/07 a **Agenda não mostra atrasadas nem fala delas** — sem bloco, badge, contagem ou atalho ([[spec-07-atividades]] §4.2). O derivado segue no modelo; **nenhuma tela o exibe como marca**.
- **`duracao_min`** — `checkout_em − checkin_em`. Insumo da visão gerencial; nulo se a tarefa não teve check-in/out.
- **`resultado` → `status` do [[estabelecimento]]** — a tarefa move **só as etapas de campo**:

| Evento | efeito no `status` do estabelecimento |
|---|---|
| **agendar** (nasce `planejada`) | `sem_plano → visita_planejada` — **entra no funil** |
| **cancelar** a última planejada | `visita_planejada → sem_plano` — sai do board (única reversão) |

| `resultado` (ao concluir) | efeito no `status` do estabelecimento |
|---|---|
| `sem_avanco` | → `visitado` e para aí |
| `td_encontrado` | → `td_encontrado` (achou o tomador de decisão) |
| `perdido` | → `perdido`, **guardando a etapa de origem** em `status_anterior` |
| `desqualificado` | → `desqualificado`, **guardando a etapa de origem** em `status_anterior` |

  **Não existe `resultado = convertido`.** Conversão não é fato de campo: `csc` e `aquisicao` são **derivados do ERP** (cadastro e pedido) e **prevalecem** sobre o que a tarefa disser — quem tem pedido está em Aquisição, mesmo que a última tarefa tenha dado `perdido`. Regra completa em [[estabelecimento]] §5.

  **A Tarefa é o que faz o pin entrar no funil.** `sem_plano` é o default e **não tem coluna** no Kanban ([[estabelecimento]] §5) — o ponto só aparece no board quando ganha uma visita planejada. **Avanço monotônico de `visita_planejada` em diante** (`→ visitado → td_encontrado → csc → aquisicao`): nunca regride. **`perdido` e `desqualificado` não são regressão — são saídas laterais**: estados terminais-mas-revisáveis *fora* da escada. É por isso que ambos guardam a etapa de origem.
  Em todos os casos, concluir a tarefa atualiza `ultima_visita` do pin e — pela regra de check-in já travada — promove `origem_confianca` a `validado_campo` gravando `geo_verificado`.

- **Reabrir uma saída lateral** (voltar de `perdido` ou `desqualificado`) — **exige nova tarefa concluída**, não há toggle. Concluir qualquer tarefa num pin nesses estados **restaura `status_anterior`** e só então aplica o `resultado` novo pela tabela acima. Sair e voltar são simétricos: ambos são constatação de campo, ambos têm autor e data. *(Um pedido chegando pelo ERP também tira o pin da lateral — ERP prevalece.)*

- **Visão gerencial (CAP-13)** — **não é objeto novo**: é agregação pura sobre esta mesma coleção. Agrupamentos: `tipo`, `responsavel_id`, `resultado`, `data`. Cada contagem abre a **lista detalhada** das tarefas por trás dela.
  - O recorte **não é só `realizada`**: a gerencial põe o **plano ao lado da execução**, então `status = planejada` também entra (KPIs de planejadas/atrasadas, gráfico por dia e a tabela detalhada). Ver [[spec-07-atividades]] §5.
  - **"Planejadas do dia" = TODAS as tarefas com aquela data**, não só as que continuam `planejada`. Planejada e realizada são o mesmo objeto: o que foi feito hoje estava no plano de hoje. É o que faz o par de gráficos ler como *"planejei X, executei Y"* — a diferença entre as duas barras é o não-realizado.
- **`tipo_checkin` (presencial × remoto)** — derivado de `checkin_em`, não é campo. Concluir sem check-in é válido (atividade remota, §5): o check-in prova presença, não cria o registro. ⚠️ Desde 28/07 **não há mais botão para isso em lugar nenhum**: saiu do sheet do pin ([[spec-07-atividades]] §2) e depois saiu do card da Agenda, quando a Agenda deixou de ter ações de execução (§8). A regra do modelo e o dado semeado continuam; o caminho de UI, não.
- **`distancia_km`** — calculada **uma vez**, no check-in, e persistida. Não é recalculável depois (o vendedor já saiu de lá), e é o que dá lastro ao check-in presencial. Enquanto não houver GPS (Fase 3/4), o protótipo **semeia valor fictício**.

## 6. O que NUNCA fica aqui

- **Estado do estabelecimento** (`status`, `ultima_visita`, `geo_verificado`, `origem_confianca`) — vive no [[estabelecimento]]. A tarefa **empurra**, não guarda.
- **Nota do ponto** (`nota_estabelecimento`) — é do estabelecimento e sempre visível no pin. `tarefa.notas` é da **atividade**, e morre com o contexto dela.
- **Fotos, raio de proximidade, GPS de validação** — Fase 3/4 (check-in completo). ⚠️ **Exceção aberta em 28/07:** `distancia_km` (§4) entrou antes, porque a tabela da visão gerencial precisa da coluna. O **campo** existe e persiste; quem o **preenche de verdade** (o GPS) segue na Fase 3/4 — no protótipo o valor é fictício.
- **SLA / tempo em etapa** — é métrica do **funil** (estado do estabelecimento), não da tarefa. Fase 4.
- **Sequenciamento de paradas, otimização de trajeto, deslocamento, ETA, rota recorrente** — seguem sendo Fase 4, agora dentro de [[rota]] §6.
  > ⚠️ **Esta regra mudou em 28/07, e a mudança é declarada.** Até então dizia *"Rota é objeto próprio da Fase 4; uma tarefa não é uma parada"*, e a coluna "Nome Rota" da gerencial era só um **rótulo derivado** (`responsavel_id` + `data`). Com a Agenda em calendário mostrando **rotas** (decisão Tatiana, 28/07), a tarefa **passou a ser a parada**: ganhou `rota_id` (§4) e o rótulo derivado morreu. O que entrou é o [[rota]] **rascunho** — identidade, nome, dia e dono. **Uma tarefa continua não sendo uma sequência**: nenhuma ordem é guardada, e é isso que mantém o objeto de verdade na Fase 4.
- **Agenda externa** (Google Agenda) — integração a avaliar na Fase 3. A agenda da Fase 2 é a própria coleção de tarefas planejadas; desde 28/07 ela é **apresentada** no formato de calendário ([[spec-07-atividades]] §4.2), o que não é integração nenhuma.

## 7. Relações

```text
 ┌───────────────────┐         ┌──────────────────┐         ┌──────────┐
 │  ESTABELECIMENTO  │◄── N:1 ─┤      TAREFA      ├─ N:1 ──►│   ROTA   │
 │   (o pin)         │         │ atividade datada │  rota_id│ (rascunho)│
 └───────────────────┘         │  = check-in/out  ├─ N:1 ──► VENDEDOR
         ▲                     └──────────────────┘          responsavel_id
         │  resultado empurra o `status` (monotônico, §5)
         └──────────────────────────────────────────┘
```

| Relação | Tipo | Nota |
|---|---|---|
| Estabelecimento → Tarefa | 1:N | um pin acumula N atividades; `pin.checkins` **deriva** daqui |
| [[rota]] → Tarefa | 1:N | `rota_id` — **a tarefa é a parada** da rota. `NULL` = avulsa. ⚠️ rascunho (28/07) |
| Tarefa → Vendedor | N:1 | `responsavel_id` (derivado) — alvo de RLS na Fase 4 |
| Tarefa → `status` do Estabelecimento | efeito | via `resultado`; move as etapas **de campo** e as duas saídas laterais. `csc`/`aquisicao` vêm do **ERP** e prevalecem |

> ~~Tarefa → Visita~~ **não existe** — check-in/out é a própria tarefa (§1).

## 8. Regras de domínio / da fatia

- **Check-in/out é a Tarefa** — sinônimos. Não há objeto `Visita`, e não há caminho alternativo pra registrar uma atividade de campo. Responde a pergunta aberta do Notion (Fase 3, item 4 — *"vale fazer outro tipo de atividade sem ser check-in?"*): **sim, mas é a mesma Tarefa** — atividade remota conclui sem `checkin_em` (§5). O check-in é o que prova presença, não o que cria o registro.
- **Uma coleção só** pra planejado e realizado; `status` distingue.
- **O `resultado` move as etapas de campo do funil**, monotonicamente na escada. **Não move `csc`/`aquisicao`** — esses são derivados do ERP e prevalecem ([[estabelecimento]] §5). O invariante do `status` deixa de ser "muda só por fluxo" e passa a ser **"nunca é digitado"**: ou vem de tarefa concluída, ou vem do ERP.
- **Motivo é obrigatório nos dois desfechos negativos**, de **vocabulário fechado** + `outro` com texto: `motivo_perda` quando `resultado = perdido`, `motivo_desqualificacao` quando `resultado = desqualificado`. Ambos movem o pin para a saída lateral correspondente.
- **`perdido` e `desqualificado` são estados revisáveis, nunca exclusão** — o pin **segue visível no mapa** e o filtro apenas oculta. Só acontecem **por tarefa concluída** (constatação de campo tem autor e data), nunca por toque solto no pin; e **voltar de lá também exige tarefa** (§5). A diferença entre os dois vive no **motivo**, não na mecânica: `perdido` = a negociação morreu, o ponto segue oportunidade; `desqualificado` = o ponto não é oportunidade.
- **Tarefa não se deleta — cancela-se** (`status = cancelada`). Espelha *"o pin nunca some"*. Cancelar a **rota** cancela todas as paradas dela ([[rota]] §2.3) — é o mesmo cancelamento, N vezes, e só quem perdeu o **último** plano sai do board.
- **Concluir é sempre no pin, nunca na Agenda** (28/07). A Agenda é o **plano**: mostra horário, anotação do agendamento e cancelar, e nada mais. Check-in/check-out e conclusão vivem no sheet do pin. ⚠️ **Consequência aceita:** a **atividade remota** (`tipo_checkin = remoto`, §5) perdeu a última porta de UI que tinha — a regra do modelo continua e o dado semeado continua tendo remotas, mas **ninguém cria uma** no protótipo. Ver [[spec-07-atividades]] §4.2.
- **Classificação nunca é digitada:** `status`, `responsavel_id`, `atrasada`, `duracao_min` são derivados.
- **Recorrência não gera nada** na Fase 2 (decisão Tatiana): é só um valor de `tipo`.
- **Tudo em memória/sessão** — sem banco, sem persistência entre aberturas do app.
- **LGPD:** a tarefa não carrega dado de pessoa física. `notas` é texto livre do vendedor — no protótipo público, **conteúdo fictício**.

## 9. Anexos / parkings

- **Parkings (motor):** `recorrencia_dias` + geração automática da próxima ocorrência · SLA/tempo em etapa · fotos e check-in por proximidade (PostGIS) · agenda semanal / Google Agenda · persistência + auth/RLS · alerta "cliente sem visita há N dias" · sync completo tarefa→funil · **objeto [[rota]] completo** (sequenciamento, trajeto, ETA, recorrência — §6).
- **Chave de estado subiu para v6** (`js/state.js`): a tarefa ganhou `hora` e `rota_id`, e o estado passou a carregar a coleção `rotas`. Estado v5 não tem rota nenhuma, então a Agenda em calendário nasceria sem rotas em quem já abriu a demo.
- **Resolve um parking do [[estabelecimento]]:** `proximo_contato_agendado` (§9 de estabelecimento.md) passa a ser `proxima_acao` + `proxima_acao_data` **aqui** — não é campo do pin.
- **Implementação do enum de 8 valores / 7 colunas:** `STATUS` em `js/data.js` precisa ganhar `sem_plano` (novo default, **sem coluna**), `visita_planejada` (renomeia `nao_visitado`), `td_encontrado` (renomeia `em_negociacao`), `csc` + `aquisicao` (substituem `convertido`), `perdido` e `desqualificado` — as colunas do Kanban saem daí, então o board se ajusta sozinho ([[spec-06-funil]] §2). **Três cores novas** (`csc`, `perdido`, `desqualificado`): decisão de design, `css/styles.css` é a fonte de verdade (regras em [[spec-00-design-system]] §2.6). O seed fictício precisa popular `data_cadastro`/`data_primeira_compra` para que CSC e Aquisição tenham cards.
- **Divergência de enum com o Notion: RESOLVIDA.** O plano (Fase 4) falava `Novo → Em progresso → CSC → Convertido`; a escada agora é `visita_planejada → visitado → td_encontrado → csc → aquisicao` (com `sem_plano` fora do board) — o `CSC` do plano entrou e "Convertido" virou `aquisicao`. Sobra só diferença de rótulo nas duas primeiras etapas.
- **A resolver:** semear `vendedor_responsavel_id` nos estabelecimentos fictícios (sem isso o recorte "por vendedor" da CAP-13 colapsa num bucket único) · **a régua do snapshot de dado real** precisa distinguir CSC × Aquisição, o que exige uma fonte de *pedido* que o `salesforce.lead` não tem ([[spec-06-funil]] §8).
