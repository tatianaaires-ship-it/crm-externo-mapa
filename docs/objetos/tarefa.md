---
title: "Objeto Tarefa — CRM Externo / Praso Maps"
tipo: objeto-dominio
fase: "Fase 2 (casca) — motor na Fase 3/4/5"
status: em-revisao
sources:
  - "KR 1.5 — Notion (39953c3f2db181599030c3cc48c989be), Fase 2 item 8 · Fase 3 itens 4 e 6 · Fase 4 item 2"
  - "_bmad-output/specs/spec-crm-externo/SPEC.md (CAP-6 revisada, CAP-11/12/13)"
  - "Decisões Tatiana (2026-07-27): check-in É a tarefa · uma coleção só · resultado move o funil · recorrência sem geração · responsável derivado · motivo_perda fechado"
  - "Decisão Tatiana (2026-08-03): sete tipos de visita em duas bandas (fluxo desenhado no Miro pela Tatiana), DERIVADOS do estado comercial do pin (o vendedor vê, não escolhe) · um formulário por tipo (conteúdo a detalhar) — §4c"
related:
  - "[[estabelecimento]]"
  - "[[vendedor]]"
  - "[[rota]]"
  - "[[spec-06-funil]]"
  - "[[spec-07-atividades]]"
  - "[[fluxos-n8n-salesforce]]"
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

> ✅ **O banco EXISTE desde 06/08** — Supabase `wfm-externo-tati`, migration `20260805200457_init_praso_maps.sql`. O DDL abaixo foi aplicado, e os invariantes de §5 e §8 viraram `CHECK` de verdade: `realizada ⟺ tem check-in E check-out` (nos dois sentidos), venda exige TD, motivo obrigatório em cada lateral e na não venda, e **um motivo por vez**.
>
> ⚠️ **Uma divergência de contrato, e ela é de fundo: `tipo` é NULO enquanto a tarefa é `planejada`.** O DDL abaixo propunha `NOT NULL`. Mas §4c.3 diz que o tipo é **vivo** até o check-out e §4c.5 **proíbe cachear** a janela de 45 dias do `Status_funil__c` — gravar o tipo no plano seria exatamente esse cache. O banco impõe o par: `CHECK ((tipo is not null) = (status = 'realizada'))`. Ou seja, **planejada não pode ter tipo e realizada não pode ficar sem**.
>
> ⏱️ **E o invariante global de 29/07 saiu do código:** *"uma visita aberta no app inteiro"* é um **índice único parcial** — `unique (responsavel_id) where checkin_em is not null and checkout_em is null`. ⚠️ Com `responsavel_id` nulo o índice não protege (NULLs são distintos num unique), e é por isso que ele hoje vale *por vendedor* e não *por app*: a leitura de §5 muda quando o auth entrar.
>
> 🔴 **O que a tabela AINDA não sustenta:** a derivação dos 7 tipos (§4c.2) só resolve a **banda de aquisição**. Os três degraus de recorrência exigem o `Status_funil__c` e a coorte, que não existem no schema — o app cai no fallback `relacionamento` que §4c.2 propõe. Efeito visível: a pivô *vendedor × tipo* da gerencial estreou com **quatro das sete colunas em zero**, porque as tarefas semeadas trazem os 3 tipos antigos. É o que esta decisão previu ao pedir a subida da chave para v10.

```sql
CREATE TABLE tarefa (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id  uuid NOT NULL REFERENCES estabelecimento(id),  -- o vínculo com o pin
  tipo                text,                 -- DERIVADO (§4c), nunca digitado. NULO enquanto planejada:
                                            --   CHECK ((tipo IS NOT NULL) = (status = 'realizada'))
                                            -- Duas bandas:
                                            -- aquisicao:   primeira_visita | follow_up | reaquisicao
                                            -- recorrencia: recorrencia | relacionamento | expansao | retencao.
                                            -- Vivo enquanto `planejada`, CONGELADO no check-out (§4c.3)
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
  -- continuidade: NÃO há campo. `proxima_acao`/`proxima_acao_data` MORRERAM em
  -- 30/07 — a volta é uma TAREFA nova, agendada no próprio check-out (§4).
  -- ▼ QUALIFICAÇÃO: a inteligência comercial colhida NESTA visita (§4d) ▼
  -- Fica na TAREFA e não no pin: inteligência envelhece, e aqui ela tem autor e data.
  -- O pin exibe a mais recente; o histórico nunca é sobrescrito.
  skus_mais_comprados   text,               -- TEXTO LIVRE por enquanto (06/08) — obrigatório* p/ liberar Fechamento
  fornecedores_atuais   text[],             -- vocabulário fechado de 5 (§4) — obrigatório*
  preferencia_marca     text,               -- texto livre curto, OPCIONAL (não existe catálogo de marca)
  potencial_compra      text,               -- faixa; vocabulário fechado, OPCIONAL
  motivo_churn          text,               -- vocabulário fechado; obrigatório na qualificação de REAQUISIÇÃO (§4d)
  notas               text,                 -- nota da VISITA (check-out); ≠ nota do pin
  notas_plano         text,                 -- anotação do AGENDAMENTO; o check-out não a reescreve
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
  CHECK (checkout_em IS NULL OR checkin_em IS NOT NULL),
  -- Campos de QUALIFICAÇÃO só existem em visita que chegou à qualificação — e como o
  -- `tipo` guarda o estágio MAIS FUNDO (§4c.3), 'fechamento' também os aceita.
  -- ⚠️ Bidirecional de propósito: proíbe o dado FORA do estágio, nunca exige que ele exista
  -- DENTRO dele — a obrigatoriedade dos `*` não é de gravação, é de derivação (§4d).
  CHECK (motivo_churn IS NULL OR tipo IN ('qualificacao','fechamento')),
  CHECK (skus_mais_comprados IS NULL OR tipo IN ('qualificacao','fechamento')),
  CHECK (fornecedores_atuais IS NULL OR tipo IN ('qualificacao','fechamento')),
  CHECK (preferencia_marca IS NULL OR tipo IN ('qualificacao','fechamento')),
  CHECK (potencial_compra IS NULL OR tipo IN ('qualificacao','fechamento'))
);
```

## 4. Campos

| # | Campo | Tipo | Obrig. | Origem | Onde aparece | Notas |
|---|---|---|---|---|---|---|
| 1 | `id` | uuid | Sim | auto | — | PK |
| 2 | `estabelecimento_id` | fk → [[estabelecimento]] | **Sim** | auto | — | vem do pin de onde foi criada; **1 tarefa = 1 pin** |
| 3 | `tipo` | enum (**7**) | **Sim** | **derivado** | **sheet de conclusão** (só leitura, com o porquê) · aba Atividades · **filtro gerencial** | 1ª visita · follow-up · reaquisição · recorrência · **relacionamento** · expansão · **retenção** — §4c, em duas bandas. ⚠️ **Deixou de ser digitado em 03/08:** o tipo é **pré-determinado pelo estado comercial do pin**, não escolhido pelo vendedor. Saiu do sheet de agendar e virou **linha de leitura** no check-out. Cada tipo tem **formulário próprio** (§4c.4) |
| 4 | `data` | date | **Sim** | `campo` | sheet do pin · aba Atividades · **filtro gerencial** | futuro = planejada; passado = realizada |
| 4b | `hora` | time | Não | `campo` | **Agenda** (sarjeta de horário) · **sub-aba Rotas** · sheet do pin | horário **marcado**. **Opcional**: sem ela, a atividade é *dia inteiro* e vai no topo do dia ([[spec-07-atividades]] §4.2). ⚠️ **`atrasada` continua sendo por DIA** (§5), nunca por hora. ⚖️ **Parada de rota montada no app nasce SEM hora** (31/07): hora ordenaria as paradas, e rota é conjunto, não sequência ([[rota]] §2.1). Só as rotas **semeadas** têm hora — o seed as espaça de 45min para dar forma aos gráficos, e a diferença é declarada |
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
| 13 | ~~`proxima_acao`~~ | — | — | — | — | ⛔ **Deixou de existir (30/07).** Era "o que fazer depois, em uma linha" e **não criava tarefa** |
| 14 | ~~`proxima_acao_data`~~ | — | — | — | — | ⛔ **Deixou de existir (30/07).** Tirado da Agenda em 28/07 (sugestão dentro de calendário lê como compromisso), ficou **sem leitor nenhum**: a tela prometia a tabela da gerencial, que nunca mostrou a coluna. **A continuidade virou uma TAREFA de verdade** — o check-out agenda a próxima visita ([[spec-07-atividades]] §3 item 4), com `tipo` · `data` · `hora` · `notas`, que a Agenda exibe porque é compromisso. Campo sem superfície não é registro, é escrita que ninguém lê |
| 15 | `notas` | text | Não | `campo` | sheet do pin · **tabela da gerencial** | nota **da VISITA**, escrita no check-out — a nota **do ponto** é `nota_estabelecimento` (§6). ⚠️ **Até 28/07 só o sheet de agendar a escrevia**, e não havia onde contar o que a visita foi; o check-out passou a pedi-la |
| 15b | `notas_plano` | text | Não | `campo` | sheet do pin (agendar) · Agenda | **anotação escrita AO AGENDAR** — *por que* esta visita foi marcada. O check-out **não** a reescreve. 🆕 **Nasceu em 06/08, numa revisão de código.** O campo 15 tinha **dois sentidos conforme o momento** (*"antes de ir é a anotação do agendamento, depois é a nota da visita"*), e o port levou isso ao pé da letra: as duas telas gravavam na **mesma coluna**, então concluir a visita **destruía, sem aviso, o motivo pelo qual ela havia sido marcada**. ⚖️ Um campo com dois sentidos é um campo que perde um deles na primeira escrita — e o sentido perdido era o único que a gerencial **não** lê, logo ninguém notaria. Migration `20260806140000_notas_plano.sql` |
| 16 | `criado_por` | fk → [[vendedor]] | Não | `auto` | — | fallback de `responsavel_id` |
| 17 | `distancia_km` | numeric(5,2) | Não | **derivado** (no check-in) | **visão gerencial** (tabela) · detalhe da atividade | GPS do vendedor × geo do pin no momento do check-in. `NULL` **sem check-in**. **Persiste** — é prova de presença e não é recalculável depois (o vendedor já saiu de lá). ⚖️ **É ela que decide `tipo_checkin`** (§5): a distância deixou de ser só informação e passou a classificar a visita |
| 18 | `atrasada` | boolean | — | **derivado** | **nenhuma superfície destaca** | §5 — não persiste. ⚠️ **saiu da Agenda em 28/07** e a Agenda também **não conta nem aponta** a dívida: o derivado continua existindo no modelo, mas nenhuma tela o exibe como marca. Na tabela da gerencial a tarefa vencida aparece só por ser planejada de data passada |
| 19 | `duracao_min` | numeric | — | **derivado** | visão gerencial | §5 — não persiste |
| 20 | `tipo_checkin` | enum (2) + `NULL` | — | **derivado de `distancia_km`** | **visão gerencial** (tabela) · detalhe da atividade | `presencial` perto do pin, `remoto` longe dele, **`NULL` sem check-in** (§5). **Não é campo** — não há o que digitar. ⚠️ **Corrigido em 28/07:** derivava de *ter ou não* check-in, o que fazia "remoto" significar "não fui" |
| 21 | ~~`nome_rota`~~ | — | — | — | — | ⛔ **Deixou de existir (28/07).** Era rótulo derivado (`Rota (dd/mm/aaaa)`); agora o nome vem do **objeto [[rota]]** via `rota_id`, e a tabela da gerencial mostra `rota.nome` ou **`Avulsa`** |
| 22 | `rota_id` | fk → [[rota]] | Não | `campo` | **sub-aba Rotas** (agrupa a tarefa sob a rota, em qualquer situação) · **Agenda** (agrupa as paradas planejadas) · **visão gerencial** (coluna Nome Rota) | a rota de que esta tarefa é **parada**. **`NULL` = avulsa** — o vendedor marcou este compromisso solto, e a avulsa **não aparece** na sub-aba Rotas ([[spec-07-atividades]] §4.3). ⚠️ [[rota]] é **rascunho**, não objeto fechado |

- **Origem:** `fonte:sf` · `derivado` · `admin` · `campo` (digitado pelo vendedor) · `auto`.
- **Onde aparece:** `sheet do pin` (CAP-11) · `aba Atividades` (CAP-12) · `filtro gerencial` / `visão gerencial` (CAP-13) · `card do Funil` ([[spec-06-funil]]).

### Vocabulários fechados

| Campo | Valores |
|---|---|
| `tipo` | **banda de aquisição:** `primeira_visita` · `follow_up` · `reaquisicao` — **banda de recorrência:** `recorrencia` · `relacionamento` · `expansao` · `retencao`. Sete valores, **derivados** (§4c) |
| `status` | `planejada` · `realizada` · `cancelada` |
| `resultado` | `sem_avanco` · `td_encontrado` · `vendido` · `perdido` · `desqualificado` |
| `motivo_nao_venda` | `cliente_com_divida` · `ja_abastecido` · `ec_fechado` · `credito_nao_liberado` · `nao_trabalha_food_service` · `prazo_limite_insuficiente` · `preco` · `ruptura_de_produto` · `sku_indisponivel` · `td_ausente` · `td_indisponivel` · `sem_objecao` · `fora_do_perfil_praso` · `outro` |
| `motivo_perda` | `preco_alto` · `sem_contato_efetivo` · `ja_tem_fornecedores` · `sem_mix_procurado` · `sem_interesse` · `outro` |
| `motivo_desqualificacao` | `cnpj_baixado` · `ativo_em_outro_cnpj` · `fora_da_area_de_entrega` · `nao_e_food_service` · `fora_de_funcionamento` · `nao_existe_no_endereco` · `contato_invalido` · `ie_denegada` · `outro` |

**Os quatro vocabulários que nasceram com o funil de aquisição (06/08 — §4d):**

| Campo | Valores | Régua |
|---|---|---|
| `fornecedores_atuais` *(multi)* | `distribuidor` · `ceasa` · `atacarejo` · `industria` · `outro` | ✅ **ditado pela operação em 06/08.** *"Seasa"* do doc **é CEASA**, confirmado |
| `potencial_compra` | `ate_1k` · `de_1k_a_5k` · `de_5k_a_15k` · `de_15k_a_50k` · `acima_50k` · `nao_sei` | ✅ **fechado em 06/08** — faixas próprias, em R$/mês de compra na Praso (§4d.4) |
| `motivo_churn` | `preco` · `foi_para_concorrente` · `problema_entrega` · `ruptura_produto` · `qualidade_produto` · `atendimento` · `divida_credito` · `ec_fechou_ou_mudou_dono` · `mudou_operacao` · `sem_motivo_claro` · `outro` | ⭐ **novo no mundo** — não existe fonte para comparar (§4d.3) |

E um no [[estabelecimento]], porque é atributo do ponto:

| Campo | Valores |
|---|---|
| `decisor_melhor_dias` *(multi)* | `todo_dia` · `segunda` · `terca` · `quarta` · `quinta` · `sexta` · `sabado` · `domingo` |

> ⚖️ **`outro` nos dois fechados, e `nao_sei` no potencial.** Sem escape, quem tem resposta fora da lista marca uma errada — e a gerencial passa a contar mentira com precisão. `potencial_compra` ganha `nao_sei` em vez de `outro` porque a pergunta é de estimativa: *"não sei"* é resposta legítima, *"outro"* não significaria nada numa escala.
> ⚠️ **DOIS campos da qualificação NÃO têm vocabulário e a gerencial não os conta:** `skus_mais_comprados` (texto livre desde 06/08) e `preferencia_marca`. Estão declarados aqui para que a ausência seja lida como intencional, não como esquecimento — ver §4d.4.
> ⚠️ **`fornecedores_atuais` não tem valor para "não compra de ninguém"**, e isso interage com a regra dos `*` (§4d.2): o campo é **obrigatório para liberar o Fechamento**, então o EC que hoje não compra de ninguém — que é o mais fácil de converter — deixaria o campo vazio e **nunca completaria a qualificação**. Enquanto não houver valor próprio, **`outro` é o escape declarado** para esse caso. ⚖️ Custo aceito: `outro` passa a significar duas coisas (*outro tipo de fornecedor* e *nenhum*), e a contagem dele não distingue as duas.

> ⚠️ **Os três vocabulários foram reescritos em 28/07 pela operação (Tatiana).** Os dois antigos (`preco`/`compra_do_concorrente`/… e `fora_do_perfil`/`endereco_e_residencia`/`duplicado`) **não existem mais** — é o que obriga a chave de estado a subir para **v7** (§9): migrar seria inventar o motivo que o vendedor teria escolhido.
> Três ajustes entraram sobre a lista da operação, e ficam declarados: **`nao_existe_no_endereco` foi devolvido** à desqualificação (nenhuma das novas cobria *"o endereço está errado"*, e fechado ≠ inexistente — é a dor-manchete da KR); **`outro` foi devolvido** a perda e desqualificação (sem escape, quem tem motivo fora da lista marca um errado); e **"venda feita por outro vendedor da Praso" saiu** da perda — se outro vendedor vendeu, o ponto é **cliente**, e marcar `perdido` o jogaria na saída lateral errada quando ele deveria chegar em Aquisição pelo ERP.

> **Não venda ≠ perder ≠ desqualificar** — três perguntas diferentes, por isso três vocabulários:
> · **não venda** = esta **visita** não gerou pedido; a negociação segue viva;
> · **perdido** = a **negociação** morreu, mas o ponto segue oportunidade (reabordar);
> · **desqualificado** = o **ponto** não é oportunidade.
> A visão gerencial precisa responder *"por que não vendi hoje?"*, *"quantas negociações perdi?"* e *"quanto da minha base é lixo?"* separadamente — a última é a dor-manchete da KR (rotas caindo em endereço vazio).
> ⚖️ **Só um aparece por vez na tela.** Marcar Perda ou Desqualificar **esconde** o motivo de não venda: os vocabulários se sobrepõem de propósito (`preço` está em dois), e dois campos de motivo juntos obrigariam o vendedor a escolher qual dos dois responde a mesma coisa.

> `status` (ciclo de vida da tarefa) e `resultado` (desfecho) são **campos separados** de propósito: `perdido` e `desqualificado` são resultado, não status — a tarefa **foi realizada**, e por isso conta na visão gerencial.

### 4c. Os sete tipos de visita, em duas bandas (03/08)

> 🎯 **A decisão em uma linha:** eram **3 tipos digitados**, viraram **7 tipos derivados** em **duas bandas**. O tipo de visita é **pré-determinado pelo estado comercial do estabelecimento** — o vendedor **não escolhe**, ele **vê** no check-out. E **cada tipo tem formulário próprio** (§4c.4), porque as sete visitas fazem perguntas diferentes.
>
> 🗺️ **A primeira pergunta não é sobre a visita, é sobre a BANDA:** *este ponto é oportunidade de aquisição, ou é um cliente que compra?* Tudo o mais é subdivisão dentro de uma das duas. Fluxo desenhado por Tatiana no Miro (03/08) e espelhado em [[jornada-tipos-de-visita]].

#### 4c.1 Os sete

> 🔴 **A banda de AQUISIÇÃO foi REESTRUTURADA em 06/08 e as três linhas abaixo estão SUPERADAS** — não as implemente. O doc *"Tipos de check-in Atlas Praso"* (Notion) + o fluxo do Miro trocaram os três tipos por **três estágios de funil** — 🔍 **Prospecção** → 🎯 **Qualificação** → 🤝 **Fechamento** —, que **avançam dentro da própria visita** (*"pode acontecer tudo em uma visita só"*). Efeitos: `primeira_visita` → **`prospeccao`** (e a régua vira **90 dias**, não 120), `follow_up` **dissolve** em *"volta para onde parou"*, e `reaquisicao` deixa de ser tipo irmão para virar **sabor da qualificação**. Contrato novo, com 9 pontos de reconciliação e 4 decisões abertas, em **[[jornada-funil-aquisicao]]**. Este §4c só volta a ser espelho quando aquelas decisões fecharem. ⚠️ **A banda de RECORRÊNCIA (tipos 4–7) segue valendo** como está.

**Banda de AQUISIÇÃO** — o trabalho é conquistar a próxima *primeira* compra:

| # | Tipo | Emoji | O propósito da visita | Quem é o ponto |
|---|---|---|---|---|
| 1 | `primeira_visita` | 🚩 | **Mapear o estabelecimento** — conhecer o ponto e abrir a conversa | nunca comprou · **sem visita há 4 meses** (ou nunca visitado) |
| 2 | `follow_up` | 🔁 | ***"O que falta para a compra?"*** — a conversa está em andamento e o pedido não saiu | **qualquer** ponto da banda **com visita nos últimos 4 meses** — nunca comprou **ou** parou de comprar |
| 3 | `reaquisicao` | ♻️ | ***"Por que parou de comprar?"*** — retomar quem sumiu | já comprou, está **4 meses sem comprar** **e sem visita há 4 meses** |

**Banda de RECORRÊNCIA** — o ponto é cliente e está comprando:

| # | Tipo | Emoji | O propósito da visita | Quem é o ponto |
|---|---|---|---|---|
| 4 | `recorrencia` | 🗓️ | **Fechar o onboarding** — fazer sair a 2ª/3ª compra dentro da janela | está em `Disponível 2ª`/`Disponível 3ª` — **dentro dos 45 dias** da 1ª compra |
| 5 | `relacionamento` | 🤝 | **Acompanhar o cliente** — manter a relação de quem comprou e não engatou | comprou, **a janela de 45 dias venceu** e o ciclo de recorrência **não fechou** |
| 6 | `expansao` | 📈 | **Complemento de mix e aumento de receita** | **recorrente** (ciclo fechado), comprando — ou parado sem ser do mês anterior |
| 7 | `retencao` | 🛡️ | *(a definir — §4c.4)* segurar antes de perder | **recorrente** que comprou no **mês anterior** e **não** no mês corrente |

> ⚖️ **A ordem do enum é POR BANDA, não uma escada só** — e isso é escolha, não acidente. Gráfico, pivô e filtro seguem esta ordem, **nunca ranking** (mesma regra de `resultado`, [[spec-07-atividades]] §5.2). A vantagem prática: a pivô *vendedor × tipo* passa a somar **subtotal por banda**, que é a leitura que a supervisão quer — *quanto do mês foi aquisição e quanto foi carteira*. `reaquisicao` fica **na banda de aquisição**, e não no fim de uma escada, porque é exatamente onde a operação a põe: *"o ponto entra na base de aquisição novamente"*.
>
> ⭐ **`follow_up` mudou de significado e ficou MAIOR.** Ele era *"lead trabalhado, ainda sem comprar"*; agora é **o estado "conversa em andamento" de toda a banda de aquisição** — vale para quem nunca comprou **e** para quem parou de comprar. É o que faz sentido: se o vendedor esteve lá nos últimos 4 meses, a pergunta é *"o que falta para a compra?"*, não *"por que você parou?"* — essa já foi feita na visita anterior. ⚠️ **Consequência para o formulário:** o mesmo `follow_up` atende um ponto que nunca comprou e um ex-cliente de dois anos, então a tela precisa **mostrar o histórico de compra** para a pergunta não sair no vácuo (§4c.4).
>
> ⚠️ **A palavra "aquisição" tem DOIS sentidos no produto, e agora ela está no desenho.** No funil (`status` do [[estabelecimento]]) **`aquisicao` = já comprou** — a última coluna do Kanban, o marco do pedido. Aqui, **banda de aquisição = ainda tem uma primeira compra a conquistar** — o oposto. **Nenhum tipo se chama `aquisicao`**, então nada colide em tela; o que não se pode é escrever *"aquisição"* sem dizer qual. 🔴 **Isto subiu de anotação para pendência real**, porque a banda tornou a palavra estrutural: renomear a coluna do funil (candidato: `comprou`) **precisa ser decidido**.
>
> ⚠️ **🔁 e ♻️ são parecidos a 12px.** O rótulo **sempre** acompanha o emoji (badge, chip, pivô), pela mesma disciplina de §5.3 da [[spec-07-atividades]]: o canal decorativo nunca carrega o sentido sozinho. Se ainda assim colidirem em tela, quem arbitra é a [[spec-00-design-system]].

#### 4c.2 A derivação — uma ÁRVORE, não uma lista de precedência

**Entradas** (todas já existem no [[estabelecimento]], exceto duas): `data_primeira_compra` · `data_ultima_compra` · `ultima_visita` · **estágio no funil de recorrência** ⚠️ *(`Status_funil__c` — §4c.5)* · **coorte de recorrência** ⚠️ *(não existe hoje — §4c.5)*. **`cadastrado` não entra** (é cadastro, não compra), e o **`status` do funil também não**.

```text
OPORTUNIDADE DE AQUISIÇÃO?   (sem 1ª compra  OU  +120 dias sem comprar)
│
├─ SIM ── banda de AQUISIÇÃO ── já comprou na Praso?
│         │
│         ├─ não ── visita nos últimos 120 dias?
│         │         ├─ não / nunca ............ 🚩 1ª VISITA
│         │         └─ sim .................... 🔁 FOLLOW-UP
│         │
│         └─ sim ── visita nos últimos 120 dias?
│                   ├─ não / nunca ............ ♻️ REAQUISIÇÃO
│                   └─ sim .................... 🔁 FOLLOW-UP
│
└─ NÃO ─── banda de RECORRÊNCIA ── estágio no funil de recorrência
           ├─ Disponível 2ª/3ª · dentro dos 45 dias ...... 🗓️ RECORRÊNCIA
           ├─ não recorrente · +45 dias ................. 🤝 RELACIONAMENTO
           └─ recorrente ── comprou no mês corrente?
                            ├─ sim ....................... 📈 EXPANSÃO
                            └─ não ── comprou no mês anterior?
                                      ├─ sim ............. 🛡️ RETENÇÃO
                                      └─ não ............. 📈 EXPANSÃO
```

> ⭐ **A mudança de forma é a maior desta versão: a derivação deixou de ser "primeiro que casa vence" e virou ÁRVORE.** Antes eram 6 regras planas numa ordem de precedência, e a exaustividade dependia de existir um **piso** no fim da lista — foi assim que o buraco 2 nasceu. Numa árvore, **toda pergunta é binária ou tem os ramos nomeados**, então cobrir tudo é estrutural: não há como um pin não chegar a uma folha. **Precedência deixou de ser ordinal e passou a ser topológica** — a régua de 120 dias vem antes de tudo porque é a **raiz**, não porque está na linha 1.
>
> ⚠️ **A raiz precisa de definição, e esta é a leitura que assumi:** `oportunidade de aquisição = sem 1ª compra OU mais de 120 dias sem comprar`. É o que faz a árvore fechar (a segunda pergunta, *"já comprou na Praso?"*, então só separa **quem nunca comprou** de **quem parou**). ⚠️ **Se a banda for uma régua da operação** — uma lista de aquisição que exclui, digamos, fora-de-ICP ou ponto de outro time —, ela deixa de ser derivável do pin e passa a ser **campo que chega pronto**, o que muda a dependência de dado. **Confirmar.**
>
> ✅ **`reaquisicao` ficou mais estreita, e isto é mudança de contrato (03/08):** ela agora exige **também** *sem visita nos últimos 120 dias*. Um ex-cliente visitado no mês passado é **`follow_up`**, não reaquisição — porque *"por que você parou de comprar?"* já foi perguntado naquela visita, e repetir a pergunta é a tela ignorando o que o próprio vendedor registrou. A pergunta que sobra é *"o que falta para a compra?"*.
>
> ⚖️ **A banda vem da COMPRA; dentro da banda de aquisição, o tipo vem da VISITA.** Isto substitui o *"compra ganha de visita"* da versão anterior, que era verdade pela metade: a recência da visita **decide os dois ramos** da banda de aquisição, e **não entra** na banda de recorrência — o **recorrente nunca visitado** é `expansao`, nunca `primeira_visita`, porque apresentar a Praso a quem já compra sozinho seria a tela ignorando o pedido.
>
> ✅ **`retencao` é subconjunto de `expansao`, e só ela é perguntada depois** — os dois degraus vizinhos do recorrente. Quem parou e **não** foi no mês anterior volta a `expansao`; quem passou dos 120 dias **sai da banda** pela raiz e vira `reaquisicao`.
>
> 📏 **A régua de 4 meses aparece TRÊS vezes, e é a mesma ideia nas três:** sem **compra** (a raiz, que muda de banda) e sem **visita** (os dois ramos da aquisição). Grandezas diferentes — pedido × visita —, mesmo número, mesmo princípio: passados 4 meses, o que havia antes não conta mais como conversa em andamento.
> ⚖️ **`retencao` é sinal ESTREITO, e não se alarga** (decisão Tatiana, 03/08): *"só é de retenção se é recorrente **e** comprou no mês anterior"*. Ela é a falha **fresca** — a anomalia de um mês em quem estava comprando. **O recorrente que parou há 2 ou 3 meses é `expansao`**, não retenção: a condição do mês anterior não casa, e aos 120 dias ele vira `reaquisicao`. ⛔ **Recusado alargar a retenção** para toda a faixa até 120 dias — o sinal viraria *"cliente que não comprou"*, quase toda a base num mês qualquer, e formulário de retenção sem alvo não serve para nada (mesma disciplina que faz o `Status_funil__c` valer: sinal quente vale por ser pequeno). ⚠️ **Preço declarado:** o app trata o afastamento em **duas** janelas — 1 mês e 4 meses — e no meio delas confia no vendedor.
> ⚠️ **A operação não tem o balde de retenção.** `Status__c` só conhece `Recorrente` (≤60d) e `Churn` (>60d), então `retencao` **não é derivável de campo pronto** — exige comparar `data_ultima_compra` com o **mês corrente**. É a terceira dependência de dado desta decisão (§4c.5).

- ✅ **Todo pin chega a uma folha — e agora por CONSTRUÇÃO, não por piso.** O buraco 2 (*pin com compra e sem tipo*) **deixou de existir na forma**: a pergunta *"estágio no funil de recorrência"* tem os três ramos nomeados, e a raiz é binária. O que resta é **dado**, não estrutura: sem `Status_funil__c` e sem coorte, a pergunta do estágio **não tem resposta** e é preciso escolher um ramo de fallback.
  > ⚖️ **O fallback mudou de lugar e melhorou** (03/08). Era `follow_up` — que na árvore nova está na **banda errada** (aquisição), e perguntaria *"o que falta para a compra?"* a um cliente que compra. O fallback certo é **`relacionamento`**: é o ramo genérico *"acompanhar o cliente"* da própria banda, e é o menos errado quando não se sabe o degrau. **Proposto, a confirmar.**
  > ⚖️ **Fallback declarado ≠ valor de escape.** `tipo` continua **sem** `indefinido`, de propósito: nulo silencioso é o problema de `Sem porte`/`Sem Zona` outra vez ([[spec-00-design-system]] §6.2). O balde de sobra tem de ser um **tipo de verdade, com formulário** — a incerteza fica no doc, não na tela.
- 🔴 **`recorrencia` passou a ser delimitada por um campo que EXPIRA sozinho, e isso é uma restrição de implementação, não um detalhe.** A janela de 45 dias vem do `Status_funil__c` ([[fluxos-n8n-salesforce]] §3e), cujo próprio fluxo **apaga o valor** quando ela fecha. Antes ele era só *sinal quente* dentro do tipo; agora é a **fronteira** entre `recorrencia` e `relacionamento`. Consequência: **é proibido cachear ou recalcular esse campo** — quem cachear vai abrir o formulário de *"fechar o onboarding"* para uma janela que já venceu. Ler sempre da fonte.
- **O funil (`status`) não entra na derivação.** `perdido` e `desqualificado` são **resultado** (o que saiu), não **propósito** (por que vou): um ponto desqualificado que receba visita nova recebe o tipo do seu estado comercial, e é assim que ele volta ([[spec-07-atividades]] §3.1). O `tipo` diz o *propósito*, o `resultado` diz o *efeito* — a fronteira de §2, agora com sete valores de um lado.
- ❓ **Pergunta aberta que veio no quadro (post-it da Tatiana):** *"cliente que tá no funil de recorrência — inside/growth? Relacionamento?"* Não é sobre o tipo, é sobre **de quem é o trabalho**: se a banda de recorrência (ou parte dela) for de inside sales/growth e não do campo, então esses tipos existem no modelo mas **não** no check-out do vendedor externo — e a pivô da gerencial nasceria com colunas que o time externo nunca preenche. **Decidir antes de construir os formulários.**

> ✅ **"Visita do vendedor da zona" fica como "visita neste pin" — decidido em 03/08 (Tatiana).** A definição diz *"não teve visita **do vendedor da zona**"*, e o app **não sabe** distinguir isso: não existe tabela zona → vendedor ([[zona]] e [[vendedor]] são ⬜ a fazer), o dono do pin vem de `vendedor_rota_lead_c` e a atribuição de território vem do **assignment rule do Salesforce Maps** — a ferramenta que o Praso Maps substitui ([[fluxos-n8n-salesforce]] §8, C3). **Régua provisória: qualquer tarefa realizada no pin conta**, de qualquer vendedor. Diverge da definição quando o território troca de mão ou quando outro vendedor passou no ponto; some quando a regra de território tiver dono.

#### 4c.3 Vivo enquanto planejada, congelado no check-out

| Situação da tarefa | O `tipo` |
|---|---|
| `planejada` | **derivado na hora de mostrar** — se o pedido entrar entre o agendamento e a visita, a visita muda de propósito sozinha |
| `realizada` | **congelado** no check-out, exatamente como foi exibido ao vendedor |
| `cancelada` | irrelevante (não houve visita) |

⚖️ **Por que congelar.** A tarefa realizada é **registro** (§8), e é dela que vivem a pivô *vendedor × tipo* e o filtro da gerencial. Se o tipo continuasse derivando, **o histórico se reescreveria a cada pedido novo** — a visita de junho viraria "expansão" em agosto, e a supervisão veria o retrato do mês passado mudar sozinho. É o espelho da regra do raio presencial (§5): lá se **nomeia** o parâmetro porque mexer nele reclassifica o histórico; aqui se **congela** o valor pelo mesmo medo.

⚖️ **Por que não congelar a planejada.** Um plano de terça carrega o propósito de terça; se o pedido chegar na quarta, o vendedor tem de chegar lá com o formulário de **recorrência**, não com o de follow-up que o plano fossilizou. Congelar no agendamento poria o vendedor a fazer a visita errada com o app concordando.

#### 4c.4 Sete tipos, sete formulários

**Decidido:** o check-out deixa de ser um formulário só. Cada tipo tem o **seu**, porque as sete visitas fazem perguntas diferentes — *"tem interesse?"* não é *"por que não recomprou?"* não é *"o que mais posso te vender?"*. **O conteúdo de cada um se detalha na próxima fatia**, e é isso que fica travado desde já:

- ⛔ **O que NÃO pode variar entre os sete**, senão a gerencial se parte: o `resultado` derivado dos quatro checkboxes (§5), a obrigatoriedade de **motivo** em toda realizada sem venda, `notas`, `td_encontrado`/`venda_declarada`, o agendamento da próxima visita e o padrão visual `.sform-*` ([[spec-00-design-system]] §6.7.2). A tabela e os gráficos da gerencial têm **as mesmas colunas para os sete tipos**.
- ✅ **O que varia:** as perguntas próprias de cada propósito, e possivelmente o **vocabulário de motivo** por tipo (`ruptura_de_produto` faz sentido em recorrência e nenhum em 1ª visita). ⚠️ Recortar os 14 motivos por tipo é **mudança de contrato**, não de tela — se for por aí, entra em §4 e no seed.
- ⚠️ **O custo, dito antes de construir:** sete formulários são sete superfícies para manter, e o check-out é a tela mais usada do app. O que os mantém honestos é o **tronco comum** acima — se cada um reinventar o desfecho, o `resultado` deixa de ser comparável entre tipos e a pivô perde o sentido.

#### 4c.5 O que a derivação ainda não tem — e é dependência, não parking

1. 🔴 **A granularidade que falta é exatamente onde os tipos precisam cortar** — e **é ela que sustenta o piso provisório de `follow_up`** (§4c.2): sem coorte, `recorrencia` × `expansao` não se separam e o pin cai no piso. `status_cliente` ([[estabelecimento]] §5) tem 4 valores e os tipos precisam de **6 distinções**: `recorrente` é **um** balde e tem de virar **dois** (`recorrencia` × `expansao`), o que exige a **coorte de recorrência** — `rank1/rank2/rank3` de `comercial.regras_de_funil_2025`, ou `Status__c` da `salesforce.account` (junção por **`id_praso_c`**, não CNPJ). **Sem isso, `expansao` não é derivável** e o tipo 4 nasce vazio no dado real. ✅ **Consequência boa:** a granularidade fina que 29/07 colapsou *"até o ERP trazer `data_ultima_compra`"* agora tem **leitor** — deixou de ser refinamento sem uso e virou requisito de um formulário.
2. ✅ **`reaquisicao` usa 120 dias — DECIDIDO em 03/08 (Tatiana), e é a régua da apuração do externo.** É o C5 do inventário ([[fluxos-n8n-salesforce]] §8): o `Status__c = 'Churn'` usa **60 dias de propósito, "para poder usar como critério do mapa"**, enquanto a virada de mês do externo usa **120**. Consequência travada: **`reaquisicao` ≠ `Churn`** — é um subconjunto, e **ler o campo pronto está proibido**, porque dispararia o tipo ~2 meses antes. A derivação **recalcula de `data_ultima_compra`**. ⚠️ Efeito colateral a declarar em tela: o mesmo pin pode aparecer como `Churn` no filtro de `status_cliente` (60d) e **não** ser visita de reaquisição (120d) — as duas leituras estão certas, e é exatamente a contestação de vendedor que o C5 manda antecipar.
2b. 🔴 **`retencao` precisa do MÊS, não de uma janela de dias.** A condição é *"comprou no mês anterior e não comprou no mês corrente"* — mês **de calendário**, que nenhum campo pronto entrega: `Status__c` só separa `Recorrente` (≤60d) de `Churn` (>60d), e `Meses_Recorrente__c` conta meses **desde a coorte**, não desde a última compra. Exige `data_ultima_compra` comparada ao mês corrente. ⚠️ **E traz um efeito de borda que vale decidir antes de construir:** no **dia 1º** do mês *"não comprou no mês corrente"* é verdade para toda a base recorrente. Cenários e recomendação em [[jornada-tipos-de-visita]] §4, buraco 3.
3. 🟡 **`recorrencia` tem um sinal com prazo, e ele não é o limite do tipo.** `Status_funil__c` (`Disponível 2ª`/`Disponível 3ª`, [[fluxos-n8n-salesforce]] §3e) marca a **janela de 45 dias** após a 1ª compra — 275 accounts hoje, lista pequena e quente. Passados os 45 dias o fluxo **apaga o campo**, mas o ponto **continua** sendo `recorrencia` (comprou 1 ou 2 vezes). Usar o campo como fronteira do tipo criaria um ponto sem tipo nenhum. Ele serve para **priorizar** dentro do tipo, e quem consumir **não pode cachear nem recalcular**.
4. 🟡 **`follow_up` e `primeira_visita` dependem de `ultima_visita`**, que no protótipo é semeado e no snapshot vem do Salesforce. A régua de 120 dias sobre dado semeado é honesta; sobre snapshot, herda a qualidade do campo lá.

### 4d. Os campos dos três estágios de aquisição (06/08)

> 📄 **Fonte:** Notion *"Tipos de check-in Atlas Praso"*, lido em 06/08. A jornada e o rationale estão em [[jornada-funil-aquisicao]] §3; **aqui é o contrato**.

#### 4d.1 O que cada estágio pergunta, e onde o dado mora

| Estágio | Campo | Tipo | Obrig. | Mora em |
|---|---|---|---|---|
| 🔍 **Prospecção** | `td_encontrado` | boolean | não | **tarefa** *(já existia — §4 nº 9b)* |
| 🔍 | `decisor_nome` | text | não | **[[estabelecimento]]** ⚠️ LGPD |
| 🔍 | `decisor_telefone` | text | não | **[[estabelecimento]]** ⚠️ LGPD |
| 🔍 | `decisor_melhor_dias` | text[] | não | **[[estabelecimento]]** — vocabulário fechado |
| 🔍 | `decisor_melhor_hora` | time | não | **[[estabelecimento]]** |
| 🎯 **Qualificação** | *(confirmar nome e contato do TD)* | — | `*` | escreve nos mesmos campos do pin, **pré-preenchidos** |
| 🎯 | `skus_mais_comprados` | text | `*` | **tarefa** — ✏️ **texto livre** *(por enquanto — §4d.4)* |
| 🎯 | `fornecedores_atuais` | text[] | `*` | **tarefa** — vocabulário fechado (5 valores) |
| 🎯 | `preferencia_marca` | text | opcional | **tarefa** |
| 🎯 | `potencial_compra` | text | opcional | **tarefa** — vocabulário fechado |
| 🎯 | `motivo_churn` | text | **obrigatório na reaquisição** | **tarefa** — vocabulário fechado |
| 🤝 **Fechamento** | `venda_declarada` | boolean | não | **tarefa** *(já existia — §4 nº 9c)* |
| 🤝 | `motivo_nao_venda` | text | condicional | **tarefa** *(já existia — §4 nº 10, 14 valores)* |

> ⚖️ **Por que o CONTATO do TD mora no pin e a INTELIGÊNCIA mora na tarefa.** O doc do Notion diz que a qualificação chega *"pré-preenchida com info da prospecção"* — ou seja, o contato **atravessa visitas**: é atributo do ponto, não do dia. Já SKUs, fornecedores e potencial **envelhecem** e são constatação de campo: guardá-los no pin faria a visita nova apagar em silêncio o que a anterior apurou, sem autor e sem data. Na tarefa, o pin **exibe o mais recente** e o histórico fica de pé — é a mesma disciplina de *"constatação de campo tem autor e data"* (§8).
> ✅ **E isso resolve de graça o "pré-preenchido" da próxima visita:** a derivação lê a **última qualificação** do pin.

#### 4d.2 A obrigatoriedade dos `*` NÃO é de gravação — é de derivação

Esta é a regra mais fácil de implementar errado, e o doc do Notion é explícito: *"não barrar o vendedor de ir para a opção de fechamento se ele não preencher os campos obrigatórios de qualificação. Isso é só caso o vendedor não venda na mesma visita → a próxima só vai ser de fechamento se ele preencher."*

```text
qualificacao_completa  =  decisor_nome        IS NOT NULL
                     AND  skus_mais_comprados IS NOT NULL
                     AND  fornecedores_atuais IS NOT NULL
```

- ⛔ **O botão de concluir NUNCA é bloqueado por esses campos.** Quem vende na mesma visita não deve nada a ninguém.
- ✅ **O que os `*` governam é o TIPO DA PRÓXIMA visita:** sem `qualificacao_completa`, a próxima nasce **Qualificação** de novo; com ela, nasce **Fechamento**.
- ⚠️ **Logo não existe `CHECK` de NOT NULL para os `*`** — e isso é escolha, não esquecimento. Os `CHECK` de §3 são **bidirecionais no sentido oposto**: proíbem o campo **fora** do estágio e nunca o exigem **dentro** dele. ⚖️ **É exatamente a direção que o furo de 06/08 mostrou faltar** (o `CHECK` de `motivo_status` proibia fora da lateral e não exigia dentro) — a diferença é que aqui a ausência **não é erro**, é um estado previsto do fluxo, com efeito declarado.

#### 4d.3 `motivo_churn`: o campo que o app cria e a empresa não tem

Obrigatório **quando a qualificação é de reaquisição** — isto é, quando o pin voltou à banda de aquisição por 120 dias sem comprar ([[jornada-funil-aquisicao]] §4).

> 🔴 **Este invariante NÃO pode virar `CHECK`, e é preciso dizer por quê.** A obrigatoriedade depende de o **pin** ser reaquisição, e um `CHECK` de tabela só enxerga a linha da tarefa. Então ele vive **só na função pura do app** — quebrando, aqui, a regra do projeto de que *"invariante existe duas vezes"* ([[estabelecimento]] §3). ⚖️ **A alternativa seria um trigger** com leitura do pin; fica registrado como a saída, e a escolha de não usá-lo é consciente. Enquanto isso, **é um invariante com uma metade só** — e a metade que falta é a do banco, que é justamente a que pegou os dois furos de 06/08.
> ⭐ **E é o campo mais valioso do conjunto:** motivo de churn **não existe hoje em lugar nenhum** — nem no ERP, nem no Salesforce ([[fluxos-n8n-salesforce]]). Os outros campos melhoram um registro que já existe; este **cria** um dado que a empresa não tem.

#### 4d.4 O que ainda não tem catálogo — declarado, não inventado

| Campo | Situação |
|---|---|
| `skus_mais_comprados` | ✏️ **TEXTO LIVRE, decidido em 06/08** — *"esse campo não vai ser de lista e sim para o vendedor escrever (por enquanto)"*. Não há objeto de produto/SKU, e a lista de **categorias** que eu havia proposto foi recusada em favor do texto |
| `preferencia_marca` | 🔴 **não existe catálogo de marca**, então fica **texto livre** e **a gerencial não conta** este campo. Vira lista fechada quando houver catálogo |
| `potencial_compra` | ✅ **faixas próprias, fechadas em 06/08.** 🔧 **E a recomendação anterior deste doc estava errada:** dizia para reusar o `faixa_faturamento_c` do Salesforce *"para não ter duas escalas para a mesma grandeza"* — mas **não é a mesma grandeza**. `faixa_faturamento_c` é o **faturamento do EC**; `potencial_compra` é **quanto ele compraria da Praso por mês**. Um restaurante de R$ 300k/mês pode comprar R$ 5k de hortifruti aqui. Reusar a régua teria **conflatado receita do cliente com potencial de venda** |
| `fornecedores_atuais` | ✅ **fechado em 06/08:** `distribuidor · ceasa · atacarejo · industria · outro`. *"Seasa"* **é CEASA**, confirmado |

> ⚠️ **O "por enquanto" do `skus_mais_comprados` tem um preço, e ele já aconteceu neste projeto.** Enquanto o campo for texto, **não há como contar o que a base compra** — a pergunta *"quais categorias mais aparecem na minha zona?"* não tem resposta consultável, só leitura linha a linha. E quando ele virar lista, **o que foi escrito como texto não migra**: *"tomate, cebola"* não vira `hortifruti` sem alguém decidir por cada linha. É o mesmo que aconteceu com os vocabulários de motivo em 28/07, quando migrar teria sido *"inventar o motivo que o vendedor teria escolhido"* (§9). ⚖️ **Registrado, não contestado:** texto livre é a escolha certa quando ainda não se sabe qual é a lista — o que não se pode é descobrir depois que o histórico virou lixo analítico sem ninguém ter avisado.
> ✅ **De bom, o texto livre resolve o que a lista não resolvia:** SKU **é** granularidade de produto (*"tomate italiano"*, *"coxa e sobrecoxa"*), e minha lista de categorias respondia outra pergunta. Melhor um campo honesto sobre o que não sabe do que um enum que finge precisão.

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
- **`tipo`** — **derivado** do estado comercial do pin, em **5 valores**, pela tabela de §4c.2. Vivo enquanto a tarefa é `planejada`, **congelado no check-out** (§4c.3).
  > ⚠️ **Isto mudou em 03/08 e o campo trocou de natureza.** Era `campo` **com sugestão**: a tarefa nascia com o valor do histórico (`sem visita → primeira_visita` · `csc`/`aquisicao` → `recorrencia` · `visitado → follow_up`) e o vendedor **confirmava ou corrigia** no sheet de conclusão. Agora não há o que confirmar — **o estado do ponto decide**, e o vendedor só **vê**. A escada de 3 valores da sugestão morreu junto: ela punha `csc` e `recorrente` no mesmo `recorrencia`, que é justamente o corte que os cinco tipos precisam fazer.
  > ⚖️ **Isto FECHA a exceção que a sugestão abria.** O doc precisava dizer *"sugestão ≠ classificação derivada, `tipo` segue sendo digitado"* para não ferir *"classificação nunca é digitada"* — a regra do projeto valia para `qualidade`/`porte`/`origem_confianca`/`status` e o `tipo` era o único fora dela. Agora **`tipo` entra na lista**, e a exceção deixa de existir.
  > ⚠️ **O preço de tirar o campo: erro de derivação não tem escape em campo.** Com o chip, um pedido atrasado no ERP era corrigível no ato (o vendedor via "follow-up" e marcava "recorrência"); sem ele, o formulário errado é o único disponível. Duas mitigações — a primeira **decidida**, a segunda **em aberto**: (1) o check-out mostra o tipo **com o porquê** (`Recorrência · 2ª compra em 12/06`), porque rótulo que não se muda e não se explica é só uma tela mandando; (2) uma via de correção com autor e data fica para a **Fase 4**, junto do Admin.
- **`atrasada`** — `status = planejada` **E** `data < hoje`. Só de exibição. ⚖️ **Por DIA, nunca por hora**, mesmo com `hora` preenchida: uma tarefa marcada para hoje às 15h não vira "atrasada" às 15h05. Numa demo isso significaria a tela mudando de estado no meio de uma reunião, e no campo significaria acusar atraso de quem está a caminho. ⚠️ Desde 28/07 a **Agenda não mostra atrasadas nem fala delas** — sem bloco, badge, contagem ou atalho ([[spec-07-atividades]] §4.2). O derivado segue no modelo; **nenhuma tela o exibe como marca**.
- **`duracao_min`** — `checkout_em − checkin_em`. Insumo da visão gerencial; nulo se a tarefa não teve check-in/out.
- **`resultado` → `status` do [[estabelecimento]]** — a tarefa move **só as etapas de campo**:

| Evento | efeito no `status` do estabelecimento |
|---|---|
| **agendar** — ou **check-in em pin sem plano**, ou **montar rota** (31/07), que criam a tarefa (nasce `planejada` nos três casos) | `sem_plano → visita_planejada` — **entra no funil** |
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
  - ⚖️ **Montar rota também não tira o pin da lateral** (31/07). É a mesma escrita (`novaTarefaPlanejada`, com a guarda explícita), então a regra vale de graça — e o sheet de criar rota **diz isso em âmbar antes do toque**, nomeando quantos pontos continuam onde estão ([[spec-01-mapa]] §6.2). Abrir uma porta nova de agendamento sem repetir o aviso seria refazer o bug de 30/07 em outro lugar.
  - ⚖️ **Agendar NÃO tira o pin da lateral** (explícito em 30/07). Um plano não constata nada: a tarefa nasce `planejada` no ponto `perdido`, o pin **fica onde está** — com `status_anterior` e `motivo_status` intactos — e volta ao funil no **check-out**. Antes disso a regra existia só por acidente (a escada recusava a regressão para `visita_planejada`) e **vazava**: um lateral **sem `status_anterior`** — dado antigo ou snapshot real — caía em `sem_plano`, de onde `visita_planejada` é avanço legítimo, e o agendamento ressuscitava o pin. O sheet de agendar **diz isso antes do toque** ([[spec-07-atividades]] §2.1).
  - ⚖️ **Sair da lateral apaga `motivo_status`.** Ele explica a **saída**; num pin de volta ao funil viraria mentira — *"Perdido (preço alto)"* escrito num ponto em *Visitado*. Vale para as duas portas de volta (tarefa concluída e arraste no Funil), e por isso mora no único lugar que escreve `status` ([[estabelecimento]] §5).

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
- **Tarefa `planejada` não é editável em nada; realizada, tampouco.** ⚠️ **Mudou em 03/08:** o `tipo` era o **único** campo editável de uma planejada, e virou **derivado** (§4c) — então não sobrou campo nenhum para editar em nenhum estado. O check-out continua sendo o instante em que o tipo **se fixa** (§4c.3), só que **congelando o derivado** em vez de gravar uma escolha. Depois disso a tarefa é **registro**, e corrigir desfecho exige concluir uma nova atividade (§5).
- **O `tipo` da visita é pré-determinado, não escolhido** (03/08). Cinco valores, derivados do estado comercial do ponto (§4c.2); o vendedor **vê** no check-out, com o motivo da classificação, e **não muda**. Consequência de contrato: `tipo` deixou de ser exceção à regra *"classificação nunca é digitada"*. Consequência de tela: o campo **saiu do sheet de agendar** e das duas escolhas de tipo do check-out ([[spec-07-atividades]] §2.1 e §3).
- **Check-in/out é a Tarefa** — sinônimos. Não há objeto `Visita`, e não há caminho alternativo pra registrar uma atividade de campo. ⚠️ **A resposta à pergunta aberta do Notion mudou** (Fase 3, item 4 — *"vale fazer outro tipo de atividade sem ser check-in?"*): era *"sim, é a mesma Tarefa concluída sem `checkin_em`"*; desde 28/07 é **não** — sem check-in a atividade fica **não realizada** (§5). O que existe é visita **remota**, que tem check-in e é feita de longe.
- **Uma coleção só** pra planejado e realizado; `status` distingue.
- **`realizada` ⟺ check-in E check-out** (§5). Não há realizada pela metade: sem presença não houve visita, sem fechamento não houve `resultado` — e sem `resultado` o funil não se move. **Visita em andamento** (check-in aberto) continua `planejada`, e é o único estado com um extremo só.
- **No máximo UMA visita em andamento** (29/07) — check-in aberto é estado exclusivo **do app**, não do pin. Enquanto existir uma, nenhum outro check-in abre, em nenhum ponto. ⚠️ **Não é filtrado por `responsavel_id`** de propósito: ele é derivado do **dono do pin**, não de quem tocou o botão, então filtrar por vendedor deixaria a trava vazar num pin de outro vendedor. Com auth/RLS (**Fase 4**) o invariante passa a ser *"uma por vendedor"*. Superfície e saída em [[spec-07-atividades]] §2.4.
- **O `resultado` move as etapas de campo do funil**, monotonicamente na escada. **Não move `csc`/`aquisicao`** — esses são derivados do ERP e prevalecem ([[estabelecimento]] §5). O invariante do `status` deixa de ser "muda só por fluxo" e passa a ser **"nunca é digitado"**: ou vem de tarefa concluída, ou vem do ERP.
- **Motivo é obrigatório em TODA realizada que não vendeu** (28/07), de **vocabulário fechado** + `outro` com texto, e **um só por atividade**: `motivo_perda` quando `resultado = perdido`, `motivo_desqualificacao` quando `resultado = desqualificado`, e `motivo_nao_venda` em todo o resto (`sem_avanco` e `td_encontrado`). As duas primeiras movem o pin para a saída lateral correspondente; a terceira não move nada — é o motivo do **evento**, não do estado do ponto, e por isso **não** vira `motivo_status` no pin.
  > ⚠️ **Isto endureceu a regra.** Até 28/07 só os dois desfechos negativos cobravam motivo, e a maioria das visitas era concluída sem dizer por que não saiu pedido. Agora **todo check-out sem venda cobra** — a lista tem `sem_objecao` e `outro` como saída, então sempre há resposta, e a gerencial nasce sem lacuna.
- **Vender exige tomador de decisão.** Marcar `Vendeu` marca `td_encontrado` **e o trava**: não se vende sem falar com quem decide, e deixar desmarcar contradiria a venda registrada na linha de cima.
- **`perdido` e `desqualificado` são estados revisáveis, nunca exclusão** — o pin **segue visível no mapa** e o filtro apenas oculta. Só acontecem **por tarefa concluída** (constatação de campo tem autor e data), nunca por toque solto no pin; e **voltar de lá também exige tarefa** (§5). A diferença entre os dois vive no **motivo**, não na mecânica: `perdido` = a negociação morreu, o ponto segue oportunidade; `desqualificado` = o ponto não é oportunidade.
- **Tarefa não se deleta — cancela-se** (`status = cancelada`). Espelha *"o pin nunca some"*. Cancelar a **rota** cancela todas as paradas dela ([[rota]] §2.3) — é o mesmo cancelamento, N vezes, e só quem perdeu o **último** plano sai do board.
- **Concluir é sempre no pin, nunca na Agenda** (28/07). A Agenda é o **plano**: mostra horário, anotação do agendamento e cancelar, e nada mais. Check-in/check-out e conclusão vivem no sheet do pin. ✅ **A ponta solta da atividade remota fechou junto:** ela deixou de ser "concluir sem check-in" (que não tinha porta de UI) e passou a ser "check-in feito longe do pin" (§5) — que **qualquer** check-in produz, sem tela nova, quando a distância passa do raio. Ver [[spec-07-atividades]] §4.2.
- **A continuidade é outra TAREFA, não um campo** (30/07). O check-out fecha a atividade e, opcionalmente, **agenda a próxima** no mesmo toque ([[spec-07-atividades]] §3 item 4) — foi o que matou `proxima_acao`/`proxima_acao_data` (§4). Duas consequências de contrato: a escrita é a mesma de agendar (nasce `planejada`, **avulsa**, com `responsavel_id` derivado do dono do pin), e **com saída lateral não se agenda daqui** — `perdido`/`desqualificado` marcados escondem o bloco, porque a tarefa nova tiraria o pin da lateral que a mesma tela acabou de gravar.
- **Classificação nunca é digitada:** `status`, `responsavel_id`, `atrasada`, `duracao_min` são derivados.
- **Recorrência não gera nada** na Fase 2 (decisão Tatiana): é só um valor de `tipo`. ⚠️ **E desde 03/08 é um valor mais estreito:** `recorrencia` deixou de significar *"o pin é cliente"* e passou a significar *"comprou 1 ou 2 vezes, o ciclo não fechou"* — o cliente que já é recorrente virou `expansao` (§4c.1). Continua sem gerar ocorrência nenhuma.
- **Tudo em memória, sem banco** — mas **não sem persistência**: o store salva no `localStorage` (`crm-externo-map:v9`), então a tarefa **sobrevive a fechar o app**. ⚠️ Esta linha dizia *"sem persistência entre aberturas"* e estava errada desde que o store passou a salvar — corrigida em 29/07, quando a consequência apareceu: um check-in aberto atravessava o fechamento do app sem que nada avisasse ([[spec-07-atividades]] §2.4).
- **LGPD:** a tarefa não carrega dado de pessoa física. `notas` é texto livre do vendedor — no protótipo público, **conteúdo fictício**.

## 9. Anexos / parkings

- **Parkings (motor):** `recorrencia_dias` + geração automática da próxima ocorrência · SLA/tempo em etapa · fotos e check-in por proximidade (PostGIS) · agenda semanal / Google Agenda · persistência + auth/RLS · alerta "cliente sem visita há N dias" · sync completo tarefa→funil · **objeto [[rota]] completo** (sequenciamento, trajeto, ETA, recorrência — §6).
- **Chave de estado subiu para v6** (`js/state.js`): a tarefa ganhou `hora` e `rota_id`, e o estado passou a carregar a coleção `rotas`. Estado v5 não tem rota nenhuma, então a Agenda em calendário nasceria sem rotas em quem já abriu a demo.
- **E para v7 no mesmo dia** (28/07): o check-out virou quatro checkboxes, a tarefa ganhou `td_encontrado`, `venda_declarada` e `motivo_nao_venda`, `resultado` ganhou `vendido`, e os **dois** vocabulários de motivo viraram **três, com chaves novas**. Estado v6 guarda `motivo_perda: 'compra_do_concorrente'` e afins — chaves que não existem mais e que apareceriam **em branco** no detalhe e na tabela da gerencial. Migrar seria inventar o motivo que o vendedor fictício teria escolhido; descartar e resemear é honesto. O seed passou a popular `motivo_nao_venda` em **todo** o histórico realizado (senão o campo estrearia sem dado na reunião de supervisão) e a semear `vendido` onde ele **não mexe no board** — pins já em `td_encontrado` (o `resultado` mapeia para o mesmo status) e em `csc`/`aquisicao` (onde o ERP prevalece). Em `visitado`, não: ali `vendido` promoveria o pin e embaralharia o funil.
- **Resolve um parking do [[estabelecimento]]:** `proximo_contato_agendado` (§9 de estabelecimento.md) não é campo do pin — é **outra Tarefa**. ⚠️ **Corrigido em 30/07:** virou `proxima_acao` + `proxima_acao_data` aqui, e os dois **morreram** (§4); o próximo contato é uma tarefa `planejada`, agendada no check-out ou pelo `＋ Agendar` do pin. Resposta melhor que a de 28/07, porque tarefa aparece na Agenda e cobra desfecho — texto solto não fazia nem uma coisa nem outra.
- **A chave de estado NÃO subiu em 30/07**, quando `proxima_acao` saiu (§4). Campo **removido** não quebra estado antigo: tarefa gravada no `v9` continua carregando as duas chaves e ninguém mais as lê — nada aparece em branco, nada cai em fallback. Subir a versão custaria o histórico de quem já abriu a demo para apagar dois campos mortos.
- **Implementação do enum de 8 valores / 7 colunas:** `STATUS` em `js/data.js` precisa ganhar `sem_plano` (novo default, **sem coluna**), `visita_planejada` (renomeia `nao_visitado`), `td_encontrado` (renomeia `em_negociacao`), `csc` + `aquisicao` (substituem `convertido`), `perdido` e `desqualificado` — as colunas do Kanban saem daí, então o board se ajusta sozinho ([[spec-06-funil]] §2). **Três cores novas** (`csc`, `perdido`, `desqualificado`): decisão de design, `css/styles.css` é a fonte de verdade (regras em [[spec-00-design-system]] §2.6). O seed fictício precisa popular `data_cadastro`/`data_primeira_compra` para que CSC e Aquisição tenham cards.
- **Divergência de enum com o Notion: RESOLVIDA.** O plano (Fase 4) falava `Novo → Em progresso → CSC → Convertido`; a escada agora é `visita_planejada → visitado → td_encontrado → csc → aquisicao` (com `sem_plano` fora do board) — o `CSC` do plano entrou e "Convertido" virou `aquisicao`. Sobra só diferença de rótulo nas duas primeiras etapas.
- **A chave de estado terá de subir para v10 quando os 5 tipos entrarem no código** (§4c). As duas chaves antigas continuam válidas (`primeira_visita`, `follow_up`), mas **`recorrencia` mudou de significado** — no v9 ela está gravada em todo pin cliente, inclusive nos que agora seriam `expansao`. Como o tipo da realizada é **congelado** (§4c.3), o histórico velho **não se reescreve**: a pivô *vendedor × tipo* estrearia com **duas colunas vazias** (`expansao`, `reaquisicao`) na reunião de supervisão, que é exatamente o motivo que subiu o v7 em 28/07. Resemear é honesto; migrar seria inventar em que degrau de recorrência cada pin fictício estava.
- **O seed precisa aprender a coorte.** Para `recorrencia` × `expansao` existirem no fictício, o gerador tem de semear **quantas compras** o pin fez (1ª/2ª × ciclo fechado) e uma `data_ultima_compra` que faça alguns pins caírem em `reaquisicao` — hoje ele só tem `data_primeira_compra`/`data_cadastro`. **No dado real isso não se semeia: exige a junção com `salesforce.account`** (§4c.5, item 1), que é a mesma pendência que o C2 do inventário já abriu.
- **Implementação (quando a fatia entrar):** `TAREFA_TIPO` e `TAREFA_TIPO_ORDER` em `js/data.js` ganham dois valores; `sugereTipoVisita` deixa de ser *sugestão* e vira a **derivação** de §4c.2 (o nome mente depois disso — candidato: `tipoDaVisita`); os três pontos que hoje gravam tipo escolhido (`js/pin.js`, `js/state.js`) passam a **ler**, e a heurística própria da "próxima visita" (`js/pin.js:233`) morre — com o tipo derivado na hora de mostrar (§4c.3), não há o que adivinhar no agendamento.
- **A resolver:** semear `vendedor_responsavel_id` nos estabelecimentos fictícios (sem isso o recorte "por vendedor" da CAP-13 colapsa num bucket único) · **a régua do snapshot de dado real** precisa distinguir CSC × Aquisição, o que exige uma fonte de *pedido* que o `salesforce.lead` não tem ([[spec-06-funil]] §8).
