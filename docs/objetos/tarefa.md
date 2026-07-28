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
2. **A Tarefa dirige o funil de ponta a ponta — até onde o campo alcança.** **Agendar** faz o pin entrar (`visita_planejada`) — e, desde 28/07, **o check-in também**, porque a tarefa que ele cria nasce `planejada` (§8); o **`resultado`** ao concluir move as etapas de campo e as saídas laterais; **`csc` e `aquisicao` vêm do ERP** (cadastro/pedido) e **prevalecem**. O `tipo` diz o *propósito*, o `resultado` diz o *efeito* (§5). O `status` tem três fontes — e nenhuma é digitação.
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
                                            -- NULL sem check-in. E ELA que classifica
                                            -- presencial x remoto (§5). Nunca digitada.
  -- desfecho: os QUATRO checkboxes do check-out (§4) …
  td_encontrado       boolean NOT NULL DEFAULT false,  -- falou com o tomador de decisão
  venda_declarada     boolean NOT NULL DEFAULT false,  -- vendeu EM CAMPO (≠ pedido no ERP, §5)
  -- … e o `resultado`, que é DERIVADO deles (§5), não digitado
  resultado           text,                 -- sem_avanco | td_encontrado | vendido | perdido | desqualificado
                                            -- NÃO existe 'convertido': conversão vem do ERP, não de tarefa (§5)
  motivo_nao_venda    text,                 -- obrigatório quando NÃO houve venda nem saída lateral
  motivo_perda        text,                 -- obrigatório se resultado = 'perdido'
  motivo_desqualificacao text,              -- obrigatório se resultado = 'desqualificado'
  motivo_texto        text,                 -- só quando o motivo escolhido for 'outro' (serve aos TRÊS)
  -- continuidade
  proxima_acao        text,
  proxima_acao_data   date,
  notas               text,                 -- nota DESTA atividade (≠ nota do pin)
  criado_por          uuid REFERENCES usuario(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (resultado <> 'perdido' OR motivo_perda IS NOT NULL),
  CHECK (resultado <> 'desqualificado' OR motivo_desqualificacao IS NOT NULL),
  -- Motivo de NÃO VENDA é obrigatório em toda realizada que não vendeu e não
  -- saiu pela lateral — e é PROIBIDO nos outros casos (um motivo por vez, §4).
  CHECK (resultado NOT IN ('sem_avanco','td_encontrado') OR motivo_nao_venda IS NOT NULL),
  CHECK (resultado IN ('sem_avanco','td_encontrado') OR motivo_nao_venda IS NULL),
  -- Vender exige tomador de decisão: não se vende sem falar com quem decide.
  CHECK (venda_declarada = false OR td_encontrado = true),
  CHECK ((resultado = 'vendido') = venda_declarada),
  -- REALIZADA exige os DOIS extremos: sem check-in nao houve presenca, sem
  -- check-out a visita nao fechou. E vale ao contrario: quem tem check-out
  -- esta realizada. Ver §5.
  CHECK (status <> 'realizada' OR (checkin_em IS NOT NULL AND checkout_em IS NOT NULL)),
  CHECK (checkout_em IS NULL OR status = 'realizada'),
  CHECK (checkout_em IS NULL OR checkin_em IS NOT NULL)
);
```

## 4. Campos

| # | Campo | Tipo | Obrig. | Origem | Onde aparece | Notas |
|---|---|---|---|---|---|---|
| 1 | `id` | uuid | Sim | auto | — | PK |
| 2 | `estabelecimento_id` | fk → [[estabelecimento]] | **Sim** | auto | — | vem do pin de onde foi criada; **1 tarefa = 1 pin** |
| 3 | `tipo` | enum (3) | **Sim** | `campo` (com **sugestão**) | **sheet de conclusão** · sheet de agendar · aba Atividades · **filtro gerencial** | 1ª visita · follow-up · recorrência. Digitado em **dois** momentos, os dois em que o propósito é conhecido: ao **agendar** (é o plano) ou ao **concluir** (é o que a visita foi). No check-in não se pergunta — a tarefa nasce com a sugestão do histórico (§5) e o vendedor confirma no fim. **Sugestão ≠ derivação travada** |
| 4 | `data` | date | **Sim** | `campo` | sheet do pin · aba Atividades · **filtro gerencial** | futuro = planejada; passado = realizada |
| 4b | `hora` | time | Não | `campo` | **Agenda** (sarjeta de horário) · sheet do pin | horário **marcado**. **Opcional**: sem ela, a atividade é *dia inteiro* e vai no topo do dia ([[spec-07-atividades]] §4.2). ⚠️ **`atrasada` continua sendo por DIA** (§5), nunca por hora |
| 5 | `status` | enum (3) | Sim | **derivado**/fluxo | sheet do pin · aba Atividades | §5 — nasce `planejada` |
| 6 | `responsavel_id` | fk → [[vendedor]] | Não | **derivado** | aba Atividades · **filtro gerencial** | §5 — nunca digitado; alvo de RLS |
| 7 | `checkin_em` | timestamptz | Não | `auto` (fluxo) | sheet do pin | botão de check-in; promove o pin a `validado_campo` |
| 8 | `checkout_em` | timestamptz | Não | `auto` (fluxo) | sheet do pin | fecha a tarefa → `status = realizada` |
| 9 | `resultado` | enum (5) | Não | **derivado** dos checkboxes | sheet do pin · **filtro gerencial** · **tabela** | move as etapas **de campo** do funil (§5) — nunca CSC/Aquisição. ⚠️ **Deixou de ser digitado em 28/07:** o chip de resultado saiu e o desfecho virou quatro checkboxes (§4b). O enum sobrevive porque é dele que vivem o gráfico "Por resultado", o drill e a tabela que move o funil |
| 9b | `td_encontrado` | boolean | Não | `campo` (checkbox) | **KPI da gerencial** · detalhe da atividade | falou com o tomador de decisão. É **fato guardado à parte do `resultado`**: "perdi tendo falado com o dono" e "perdi sem achar ninguém" são coisas diferentes, e um enum de valor único não cabe as duas. **O KPI de TD conta este campo**, não `resultado = td_encontrado` — senão a taxa cairia no dia em que o time vendesse mais |
| 9c | `venda_declarada` | boolean | Não | `campo` (checkbox) | **KPI da gerencial** · **tag no card do Funil** · detalhe | vendeu **em campo**. Marca `td_encontrado` junto e o trava (§5). **Não move o pin para Aquisição** — ver §5 |
| 10 | `motivo_nao_venda` | enum (14) | Cond. | `campo` | sheet do pin · **tabela da gerencial** | **obrigatório** quando não houve venda nem saída lateral; **fechado** + `outro`. É o motivo do **evento** (esta visita não gerou pedido), não do ponto |
| 11 | `motivo_perda` | enum (6) | Cond. | `campo` | sheet do pin · **tabela da gerencial** | obrigatório se `resultado = perdido`; **fechado** + `outro` |
| 12 | `motivo_desqualificacao` | enum (9) | Cond. | `campo` | sheet do pin · **tabela da gerencial** | obrigatório se `resultado = desqualificado`; **fechado** + `outro` |
| 12b | `motivo_texto` | text | Cond. | `campo` | sheet do pin | só quando o motivo escolhido for `outro` — serve aos **três** enums |
| 13 | `proxima_acao` | text | Não | `campo` | sheet do pin · **card do Funil** | o que fazer depois, em uma linha |
| 14 | `proxima_acao_data` | date | Não | `campo` | **visão gerencial** (tabela) | ⚠️ **saiu da Agenda em 28/07** ([[spec-07-atividades]] §4.2): sugestão dentro de um calendário lê como compromisso marcado. Continua no modelo, sem virar tarefa |
| 15 | `notas` | text | Não | `campo` | sheet do pin · **tabela da gerencial** | nota **da atividade** — a nota **do ponto** é `nota_estabelecimento` (§6). ⚠️ **Até 28/07 só o sheet de agendar a escrevia**, e não havia onde contar o que a visita foi; o check-out passou a pedi-la. Por isso o mesmo campo tem dois sentidos conforme o momento: antes de ir é a **anotação do agendamento**, depois é a **nota da visita** — e o detalhe da atividade rotula conforme o `status` |
| 16 | `criado_por` | fk → [[vendedor]] | Não | `auto` | — | fallback de `responsavel_id` |
| 17 | `distancia_km` | numeric(5,2) | Não | **derivado** (no check-in) | **visão gerencial** (tabela) · detalhe da atividade | GPS do vendedor × geo do pin no momento do check-in. `NULL` **sem check-in**. **Persiste** — é prova de presença e não é recalculável depois (o vendedor já saiu de lá). ⚖️ **É ela que decide `tipo_checkin`** (§5): a distância deixou de ser só informação e passou a classificar a visita |
| 18 | `atrasada` | boolean | — | **derivado** | **nenhuma superfície destaca** | §5 — não persiste. ⚠️ **saiu da Agenda em 28/07** e a Agenda também **não conta nem aponta** a dívida: o derivado continua existindo no modelo, mas nenhuma tela o exibe como marca. Na tabela da gerencial a tarefa vencida aparece só por ser planejada de data passada |
| 19 | `duracao_min` | numeric | — | **derivado** | visão gerencial | §5 — não persiste |
| 20 | `tipo_checkin` | enum (2) + `NULL` | — | **derivado de `distancia_km`** | **visão gerencial** (tabela) · detalhe da atividade | `presencial` perto do pin, `remoto` longe dele, **`NULL` sem check-in** (§5). **Não é campo** — não há o que digitar. ⚠️ **Corrigido em 28/07:** derivava de *ter ou não* check-in, o que fazia "remoto" significar "não fui" |
| 21 | ~~`nome_rota`~~ | — | — | — | — | ⛔ **Deixou de existir (28/07).** Era rótulo derivado (`Rota (dd/mm/aaaa)`); agora o nome vem do **objeto [[rota]]** via `rota_id`, e a tabela da gerencial mostra `rota.nome` ou **`Avulsa`** |
| 22 | `rota_id` | fk → [[rota]] | Não | `campo` | **Agenda** (agrupa as paradas) · **visão gerencial** (coluna Nome Rota) | a rota de que esta tarefa é **parada**. **`NULL` = avulsa** — o vendedor marcou este compromisso solto. ⚠️ [[rota]] é **rascunho**, não objeto fechado |

- **Origem:** `fonte:sf` · `derivado` · `admin` · `campo` (digitado pelo vendedor) · `auto`.
- **Onde aparece:** `sheet do pin` (CAP-11) · `aba Atividades` (CAP-12) · `filtro gerencial` / `visão gerencial` (CAP-13) · `card do Funil` ([[spec-06-funil]]).

### Vocabulários fechados

| Campo | Valores |
|---|---|
| `tipo` | `primeira_visita` · `follow_up` · `recorrencia` |
| `status` | `planejada` · `realizada` · `cancelada` |
| `resultado` | `sem_avanco` · `td_encontrado` · `vendido` · `perdido` · `desqualificado` |
| `motivo_nao_venda` | `cliente_com_divida` · `ja_abastecido` · `ec_fechado` · `credito_nao_liberado` · `nao_trabalha_food_service` · `prazo_limite_insuficiente` · `preco` · `ruptura_de_produto` · `sku_indisponivel` · `td_ausente` · `td_indisponivel` · `sem_objecao` · `fora_do_perfil_praso` · `outro` |
| `motivo_perda` | `preco_alto` · `sem_contato_efetivo` · `ja_tem_fornecedores` · `sem_mix_procurado` · `sem_interesse` · `outro` |
| `motivo_desqualificacao` | `cnpj_baixado` · `ativo_em_outro_cnpj` · `fora_da_area_de_entrega` · `nao_e_food_service` · `fora_de_funcionamento` · `nao_existe_no_endereco` · `contato_invalido` · `ie_denegada` · `outro` |

> ⚠️ **Os três vocabulários foram reescritos em 28/07 pela operação (Tatiana).** Os dois antigos (`preco`/`compra_do_concorrente`/… e `fora_do_perfil`/`endereco_e_residencia`/`duplicado`) **não existem mais** — é o que obriga a chave de estado a subir para **v7** (§9): migrar seria inventar o motivo que o vendedor teria escolhido.
> Três ajustes entraram sobre a lista da operação, e ficam declarados: **`nao_existe_no_endereco` foi devolvido** à desqualificação (nenhuma das novas cobria *"o endereço está errado"*, e fechado ≠ inexistente — é a dor-manchete da KR); **`outro` foi devolvido** a perda e desqualificação (sem escape, quem tem motivo fora da lista marca um errado); e **"venda feita por outro vendedor da Praso" saiu** da perda — se outro vendedor vendeu, o ponto é **cliente**, e marcar `perdido` o jogaria na saída lateral errada quando ele deveria chegar em Aquisição pelo ERP.

> **Não venda ≠ perder ≠ desqualificar** — três perguntas diferentes, por isso três vocabulários:
> · **não venda** = esta **visita** não gerou pedido; a negociação segue viva;
> · **perdido** = a **negociação** morreu, mas o ponto segue oportunidade (reabordar);
> · **desqualificado** = o **ponto** não é oportunidade.
> A visão gerencial precisa responder *"por que não vendi hoje?"*, *"quantas negociações perdi?"* e *"quanto da minha base é lixo?"* separadamente — a última é a dor-manchete da KR (rotas caindo em endereço vazio).
> ⚖️ **Só um aparece por vez na tela.** Marcar Perda ou Desqualificar **esconde** o motivo de não venda: os vocabulários se sobrepõem de propósito (`preço` está em dois), e dois campos de motivo juntos obrigariam o vendedor a escolher qual dos dois responde a mesma coisa.

> `status` (ciclo de vida da tarefa) e `resultado` (desfecho) são **campos separados** de propósito: `perdido` e `desqualificado` são resultado, não status — a tarefa **foi realizada**, e por isso conta na visão gerencial.

## 5. Campos derivados / calculados

- **`status`** — nasce `planejada`. **`realizada` ⟺ tem `checkin_em` E `checkout_em`** — a equivalência vale nos dois sentidos, e está cravada em três `CHECK` do §3:

| Estado da tarefa | `checkin_em` | `checkout_em` | `status` |
|---|---|---|---|
| ainda não fui | — | — | `planejada` (**não realizada**) |
| **visita em andamento** | ✓ | — | `planejada` — ainda não realizada |
| visita fechada | ✓ | ✓ | **`realizada`** |
| cancelada | — | — | `cancelada` (ação explícita; **não há deletar** — §8) |

  Sem check-in não houve presença; sem check-out a visita **não fechou** — e é o check-out que carrega o `resultado`, sem o qual o funil não tem como se mover. Nos dois casos a tarefa fica **não realizada**, e a tabela da gerencial mostra `Realizado = Não`. `cancelada` só por ação explícita.
  > ⚠️ **Isto mudou em 28/07, e reverte a regra anterior.** O doc dizia que *"concluir sem check-in é válido — atividade remota, ex. follow-up por telefone"*. **Não é:** `remoto` não é a ausência de check-in, é o check-in feito **longe** do pin (§5, `tipo_checkin`). Sem check-in nenhum, `tipo_checkin` é **NULL** e não há o que concluir. Decisão Tatiana: *"sem check-in a tarefa não fica nem remota nem presencial, isso ficaria nulo — mas a tarefa ficaria como não realizada"*.
  > ⚖️ **A tarefa pode nascer do próprio check-in** (28/07, CAP-6 revisada): não é preciso planejar para visitar. Se o pin não tem planejada de hoje/atrasada, o check-in **cria** a tarefa datada de hoje e já a abre. Planejada futura **não é reescrita** — a visita de hoje é fato novo, e mexer na data do plano seria decidir pelo vendedor que aquele compromisso morreu. Ver [[spec-07-atividades]] §2.3.
- **`data`, ao fazer check-in numa tarefa ATRASADA, vem para hoje.** Em planejada a data é quando se pretende ir; em realizada é **quando aconteceu** — e é dela que saem a tabela e os gráficos por dia. Manter a data velha poria a visita no dia errado, com `checkin_em` de hoje na coluna ao lado.
- **`responsavel_id`** — herda `vendedor_responsavel_id` do [[estabelecimento]]; se nulo, é o **criador** da atividade. Sem auth por usuário até a Fase 4, "criador" é a identidade única da sessão. **Nunca digitado.**
- **`tipo` sugerido** — não é campo derivado, é **o valor com que a tarefa nasce** quando o check-in a cria: sem visita anterior → `primeira_visita`; pin cliente (`csc`/`aquisicao`) → `recorrencia`; visitado e ainda não cliente → `follow_up`. Existe para que **confirmar** seja o caso comum no sheet de conclusão ([[spec-07-atividades]] §3) — quem chega para visitar não deveria ter que classificar a visita, e o histórico já diz qual ela é.
- **`atrasada`** — `status = planejada` **E** `data < hoje`. Só de exibição. ⚖️ **Por DIA, nunca por hora**, mesmo com `hora` preenchida: uma tarefa marcada para hoje às 15h não vira "atrasada" às 15h05. Numa demo isso significaria a tela mudando de estado no meio de uma reunião, e no campo significaria acusar atraso de quem está a caminho. ⚠️ Desde 28/07 a **Agenda não mostra atrasadas nem fala delas** — sem bloco, badge, contagem ou atalho ([[spec-07-atividades]] §4.2). O derivado segue no modelo; **nenhuma tela o exibe como marca**.
- **`duracao_min`** — `checkout_em − checkin_em`. Insumo da visão gerencial; nulo se a tarefa não teve check-in/out.
- **`resultado` → `status` do [[estabelecimento]]** — a tarefa move **só as etapas de campo**:

| Evento | efeito no `status` do estabelecimento |
|---|---|
| **agendar** — ou **check-in em pin sem plano**, que cria a tarefa (nasce `planejada` nos dois casos) | `sem_plano → visita_planejada` — **entra no funil** |
| **cancelar** a última planejada | `visita_planejada → sem_plano` — sai do board (única reversão) |

| `resultado` (ao concluir) | efeito no `status` do estabelecimento |
|---|---|
| `sem_avanco` | → `visitado` e para aí |
| `td_encontrado` | → `td_encontrado` (achou o tomador de decisão) |
| `vendido` | → `td_encontrado` **e mais nada** — quem vendeu falou com quem decide, e é **até aí que o campo alcança**. O pedido é do ERP; enquanto ele não chega, o pin carrega a **tag `Venda realizada`** (§5b) |
| `perdido` | → `perdido`, **guardando a etapa de origem** em `status_anterior` |
| `desqualificado` | → `desqualificado`, **guardando a etapa de origem** em `status_anterior` |

  **Não existe `resultado = convertido`** — e `vendido` não é ele. ⚠️ **Isto foi refinado em 28/07 e a distinção é o coração da mudança:** **venda declarada** é fato do **vendedor** (ele estava lá, fechou); **conversão** é fato do **ERP** (existe pedido no sistema). São coisas diferentes, acontecem em momentos diferentes, e o app agora registra as duas separadamente em vez de fingir que a segunda não existe até o ERP falar. `csc` e `aquisicao` seguem **derivados do ERP** e **prevalecem** sobre o que a tarefa disser — quem tem pedido está em Aquisição mesmo que a última tarefa tenha dado `perdido`, e quem declarou venda **não** vai para Aquisição sem pedido. Regra completa em [[estabelecimento]] §5.

- **`resultado` é DERIVADO dos checkboxes** (28/07) — não se digita mais. A precedência é *saída lateral > venda > TD > nada*:

| Marcado no check-out | `resultado` |
|---|---|
| Desqualificar | `desqualificado` |
| Perda | `perdido` |
| Vendeu (⇒ TD marcado e travado) | `vendido` |
| só TD encontrado | `td_encontrado` |
| nada | `sem_avanco` |

  **Vendeu, Perda e Desqualificar são desfechos opostos** e se desmarcam entre si; **TD encontrado é o único ortogonal** — combina com qualquer um, e por isso é guardado **à parte** do `resultado` (§4, nº 9b). É o que permite distinguir *perdi tendo falado com o dono* de *perdi sem achar ninguém*, distinção que um enum de valor único não comporta.

- **`venda_declarada` → tag `Venda realizada`** (§5b, derivada no [[estabelecimento]]) — existe enquanto houver venda declarada em campo que o ERP ainda **não** confirmou com pedido, e **some sozinha em Aquisição**, onde não teria mais o que denunciar. Em **CSC ela fica**: cadastrado sem compra com venda declarada é exatamente o furo que a supervisão quer enxergar. O vão entre o KPI *Venda realizada* e a coluna *Aquisição* é a medida desse furo.

  **A Tarefa é o que faz o pin entrar no funil.** `sem_plano` é o default e **não tem coluna** no Kanban ([[estabelecimento]] §5) — o ponto só aparece no board quando ganha uma visita planejada. **Avanço monotônico de `visita_planejada` em diante** (`→ visitado → td_encontrado → csc → aquisicao`): nunca regride. **`perdido` e `desqualificado` não são regressão — são saídas laterais**: estados terminais-mas-revisáveis *fora* da escada. É por isso que ambos guardam a etapa de origem.
  Em todos os casos, concluir a tarefa atualiza `ultima_visita` do pin e — pela regra de check-in já travada — promove `origem_confianca` a `validado_campo` gravando `geo_verificado`.

- **Reabrir uma saída lateral** (voltar de `perdido` ou `desqualificado`) — **exige nova tarefa concluída**, não há toggle. Concluir qualquer tarefa num pin nesses estados **restaura `status_anterior`** e só então aplica o `resultado` novo pela tabela acima. Sair e voltar são simétricos: ambos são constatação de campo, ambos têm autor e data. *(Um pedido chegando pelo ERP também tira o pin da lateral — ERP prevalece.)*

- **Visão gerencial (CAP-13)** — **não é objeto novo**: é agregação pura sobre esta mesma coleção. Agrupamentos: `tipo`, `responsavel_id`, `resultado`, `data`. Cada contagem abre a **lista detalhada** das tarefas por trás dela.
  - O recorte **não é só `realizada`**: a gerencial põe o **plano ao lado da execução**, então `status = planejada` também entra (KPIs de planejadas/atrasadas, gráfico por dia e a tabela detalhada). Ver [[spec-07-atividades]] §5.
  - **"Planejadas do dia" = TODAS as tarefas com aquela data**, não só as que continuam `planejada`. Planejada e realizada são o mesmo objeto: o que foi feito hoje estava no plano de hoje. É o que faz o par de gráficos ler como *"planejei X, executei Y"* — a diferença entre as duas barras é o não-realizado.
- **`tipo_checkin` (presencial × remoto × nulo)** — derivado de **`distancia_km`**, não de ter ou não check-in:

| Situação no check-in | `tipo_checkin` |
|---|---|
| distância **≤ raio** | `presencial` |
| distância **> raio** | `remoto` — registrou a visita de fora (ligou, falou no portão, passou de longe) |
| **sem check-in** | `NULL` — e a tarefa não é realizada |

  O **raio é parâmetro de negócio**, não constante de código: `RAIO_PRESENCIAL_KM = 0,5`. E o valor **não é palpite de protótipo** — **500m é o critério que a operação da Praso já usa hoje** (Tatiana, 28/07), então o app nasce classificando igual ao que o time já pratica. De brinde, 500m dão folga larga ao erro de GPS de celular em rua fechada (~20–50m).

  ⚖️ **Por que fica nomeado e num lugar só:** mexer no raio **reclassifica o histórico** — a mesma visita de 400m era remota com 0,3 e é presencial com 0,5. Isso faz dele regra de supervisão (Admin, Fase 4), não número escondido no meio de uma função.

  ⚖️ **Por que a distância e não a ausência.** Uma tarefa sem check-in não é uma visita de outro tipo — é uma visita que **não aconteceu**. Derivar `remoto` da ausência confundia as duas coisas e produzia o efeito colateral de a gerencial contar como *realizada remota* algo que ninguém tinha feito. Com a distância no comando, `remoto` passa a descrever um fato observado (ele estava a 1,2 km) e `NULL` a descrever a falta de fato.
- **`distancia_km`** — calculada **uma vez**, no check-in, e persistida. Não é recalculável depois (o vendedor já saiu de lá), e é o que dá lastro ao check-in presencial. Enquanto não houver GPS (Fase 3/4), o protótipo **semeia valor fictício**.

## 6. O que NUNCA fica aqui

- **Estado do estabelecimento** (`status`, `ultima_visita`, `geo_verificado`, `origem_confianca`) — vive no [[estabelecimento]]. A tarefa **empurra**, não guarda.
- **Nota do ponto** (`nota_estabelecimento`) — é do estabelecimento e sempre visível no pin. `tarefa.notas` é da **atividade**, e morre com o contexto dela.
- **Fotos e o GPS que mede de verdade** — Fase 3/4 (check-in completo). ⚠️ **Exceção aberta em 28/07:** `distancia_km` (§4) entrou antes, porque a tabela da gerencial precisa da coluna — e desde 28/07 ela faz mais que informar: **classifica** a visita (§5). O **campo** e o **raio** existem e valem; quem preenche a distância de verdade (o GPS) segue na Fase 3/4, e no protótipo o valor é fictício. **Admin do raio** também é Fase 4.
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

- **Check-in não exige plano** (28/07, CAP-6 revisada). Todo pin oferece check-in; sem planejada, ele **cria** a tarefa de hoje. Consequência: **agendar deixou de ser a única porta de entrada no funil** — o check-in também põe o pin em `visita_planejada` (a tarefa nasce `planejada` e é imediatamente aberta), e só o `resultado` do check-out move a etapa dali. Ver [[spec-07-atividades]] §2.3.
- **Tarefa `planejada` é editável no `tipo`; realizada, em nada.** O **check-out é o último instante** dessa janela: o sheet de conclusão grava o tipo confirmado no mesmo ato em que fecha a atividade. Depois disso a tarefa é **registro** — nenhum campo se edita, e corrigir desfecho exige concluir uma nova atividade (§5).
- **Check-in/out é a Tarefa** — sinônimos. Não há objeto `Visita`, e não há caminho alternativo pra registrar uma atividade de campo. ⚠️ **A resposta à pergunta aberta do Notion mudou** (Fase 3, item 4 — *"vale fazer outro tipo de atividade sem ser check-in?"*): era *"sim, é a mesma Tarefa concluída sem `checkin_em`"*; desde 28/07 é **não** — sem check-in a atividade fica **não realizada** (§5). O que existe é visita **remota**, que tem check-in e é feita de longe.
- **Uma coleção só** pra planejado e realizado; `status` distingue.
- **`realizada` ⟺ check-in E check-out** (§5). Não há realizada pela metade: sem presença não houve visita, sem fechamento não houve `resultado` — e sem `resultado` o funil não se move. **Visita em andamento** (check-in aberto) continua `planejada`, e é o único estado com um extremo só.
- **O `resultado` move as etapas de campo do funil**, monotonicamente na escada. **Não move `csc`/`aquisicao`** — esses são derivados do ERP e prevalecem ([[estabelecimento]] §5). O invariante do `status` deixa de ser "muda só por fluxo" e passa a ser **"nunca é digitado"**: ou vem de tarefa concluída, ou vem do ERP.
- **Motivo é obrigatório em TODA realizada que não vendeu** (28/07), de **vocabulário fechado** + `outro` com texto, e **um só por atividade**: `motivo_perda` quando `resultado = perdido`, `motivo_desqualificacao` quando `resultado = desqualificado`, e `motivo_nao_venda` em todo o resto (`sem_avanco` e `td_encontrado`). As duas primeiras movem o pin para a saída lateral correspondente; a terceira não move nada — é o motivo do **evento**, não do estado do ponto, e por isso **não** vira `motivo_status` no pin.
  > ⚠️ **Isto endureceu a regra.** Até 28/07 só os dois desfechos negativos cobravam motivo, e a maioria das visitas era concluída sem dizer por que não saiu pedido. Agora **todo check-out sem venda cobra** — a lista tem `sem_objecao` e `outro` como saída, então sempre há resposta, e a gerencial nasce sem lacuna.
- **Vender exige tomador de decisão.** Marcar `Vendeu` marca `td_encontrado` **e o trava**: não se vende sem falar com quem decide, e deixar desmarcar contradiria a venda registrada na linha de cima.
- **`perdido` e `desqualificado` são estados revisáveis, nunca exclusão** — o pin **segue visível no mapa** e o filtro apenas oculta. Só acontecem **por tarefa concluída** (constatação de campo tem autor e data), nunca por toque solto no pin; e **voltar de lá também exige tarefa** (§5). A diferença entre os dois vive no **motivo**, não na mecânica: `perdido` = a negociação morreu, o ponto segue oportunidade; `desqualificado` = o ponto não é oportunidade.
- **Tarefa não se deleta — cancela-se** (`status = cancelada`). Espelha *"o pin nunca some"*. Cancelar a **rota** cancela todas as paradas dela ([[rota]] §2.3) — é o mesmo cancelamento, N vezes, e só quem perdeu o **último** plano sai do board.
- **Concluir é sempre no pin, nunca na Agenda** (28/07). A Agenda é o **plano**: mostra horário, anotação do agendamento e cancelar, e nada mais. Check-in/check-out e conclusão vivem no sheet do pin. ✅ **A ponta solta da atividade remota fechou junto:** ela deixou de ser "concluir sem check-in" (que não tinha porta de UI) e passou a ser "check-in feito longe do pin" (§5) — que **qualquer** check-in produz, sem tela nova, quando a distância passa do raio. Ver [[spec-07-atividades]] §4.2.
- **Classificação nunca é digitada:** `status`, `responsavel_id`, `atrasada`, `duracao_min` são derivados.
- **Recorrência não gera nada** na Fase 2 (decisão Tatiana): é só um valor de `tipo`.
- **Tudo em memória/sessão** — sem banco, sem persistência entre aberturas do app.
- **LGPD:** a tarefa não carrega dado de pessoa física. `notas` é texto livre do vendedor — no protótipo público, **conteúdo fictício**.

## 9. Anexos / parkings

- **Parkings (motor):** `recorrencia_dias` + geração automática da próxima ocorrência · SLA/tempo em etapa · fotos e check-in por proximidade (PostGIS) · agenda semanal / Google Agenda · persistência + auth/RLS · alerta "cliente sem visita há N dias" · sync completo tarefa→funil · **objeto [[rota]] completo** (sequenciamento, trajeto, ETA, recorrência — §6).
- **Chave de estado subiu para v6** (`js/state.js`): a tarefa ganhou `hora` e `rota_id`, e o estado passou a carregar a coleção `rotas`. Estado v5 não tem rota nenhuma, então a Agenda em calendário nasceria sem rotas em quem já abriu a demo.
- **E para v7 no mesmo dia** (28/07): o check-out virou quatro checkboxes, a tarefa ganhou `td_encontrado`, `venda_declarada` e `motivo_nao_venda`, `resultado` ganhou `vendido`, e os **dois** vocabulários de motivo viraram **três, com chaves novas**. Estado v6 guarda `motivo_perda: 'compra_do_concorrente'` e afins — chaves que não existem mais e que apareceriam **em branco** no detalhe e na tabela da gerencial. Migrar seria inventar o motivo que o vendedor fictício teria escolhido; descartar e resemear é honesto. O seed passou a popular `motivo_nao_venda` em **todo** o histórico realizado (senão o campo estrearia sem dado na reunião de supervisão) e a semear `vendido` onde ele **não mexe no board** — pins já em `td_encontrado` (o `resultado` mapeia para o mesmo status) e em `csc`/`aquisicao` (onde o ERP prevalece). Em `visitado`, não: ali `vendido` promoveria o pin e embaralharia o funil.
- **Resolve um parking do [[estabelecimento]]:** `proximo_contato_agendado` (§9 de estabelecimento.md) passa a ser `proxima_acao` + `proxima_acao_data` **aqui** — não é campo do pin.
- **Implementação do enum de 8 valores / 7 colunas:** `STATUS` em `js/data.js` precisa ganhar `sem_plano` (novo default, **sem coluna**), `visita_planejada` (renomeia `nao_visitado`), `td_encontrado` (renomeia `em_negociacao`), `csc` + `aquisicao` (substituem `convertido`), `perdido` e `desqualificado` — as colunas do Kanban saem daí, então o board se ajusta sozinho ([[spec-06-funil]] §2). **Três cores novas** (`csc`, `perdido`, `desqualificado`): decisão de design, `css/styles.css` é a fonte de verdade (regras em [[spec-00-design-system]] §2.6). O seed fictício precisa popular `data_cadastro`/`data_primeira_compra` para que CSC e Aquisição tenham cards.
- **Divergência de enum com o Notion: RESOLVIDA.** O plano (Fase 4) falava `Novo → Em progresso → CSC → Convertido`; a escada agora é `visita_planejada → visitado → td_encontrado → csc → aquisicao` (com `sem_plano` fora do board) — o `CSC` do plano entrou e "Convertido" virou `aquisicao`. Sobra só diferença de rótulo nas duas primeiras etapas.
- **A resolver:** semear `vendedor_responsavel_id` nos estabelecimentos fictícios (sem isso o recorte "por vendedor" da CAP-13 colapsa num bucket único) · **a régua do snapshot de dado real** precisa distinguir CSC × Aquisição, o que exige uma fonte de *pedido* que o `salesforce.lead` não tem ([[spec-06-funil]] §8).
