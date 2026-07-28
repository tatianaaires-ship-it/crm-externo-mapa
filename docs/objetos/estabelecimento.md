---
title: "Objeto Estabelecimento — CRM Externo / Praso Maps"
tipo: objeto-dominio
fase: "Fase 2 (20–31/07/2026)"
status: em-revisao
sources:
  - "_bmad-output/planning-artifacts/objeto-lead-fase2.md (rationale/narrativa)"
  - "_bmad-output/specs/spec-crm-externo/SPEC.md (contrato do protótipo)"
  - "salesforce.lead — Metabase (db 19, tabela 1066, 161 colunas)"
  - "Decisão Tatiana + líder (2026-07-23): fundir Lead + Conta num objeto 'Estabelecimento'"
related:
  - "[[vendedor]]"
  - "[[tarefa]]"
  - "[[cnae_tier]]"
  - "[[zona]]"
---

# Objeto Estabelecimento

> **Uma linha:** **um único objeto** para o ponto no mapa — cliente cadastrado **ou** não —, distinguido pelo campo derivado `cadastrado`. O pin nunca se divide ao converter; ele **acumula**.
> **Vizinhos:** [[vendedor]] · [[tarefa]] · [[cnae_tier]] · [[zona]]

> ℹ️ O código do protótipo (`js/`) ainda usa o termo **"lead"**. Alinhar o naming com "Estabelecimento" é uma tarefa de refactor **parkada** — não bloqueia a modelagem.

## 1. Conceito

Um **estabelecimento** é qualquer ponto que a operação acompanha no mapa — seja um **lead** (ainda não cliente) ou uma **conta** (cliente cadastrado na Praso). **São o mesmo objeto**: o registro nasce como lead e, ao virar cliente, **acumula** os campos comerciais sem trocar de identidade nem de pin. A **chave de identidade é o `cnpj`** (deduplica; junção com as fontes na Fase 3). Definição travada com a Tatiana + líder (23/07).

> **Por que um só objeto:** continuidade. O histórico do ponto — prospecção → conversão → compras → risco → reconquista — vive num registro contínuo que **nunca é partido**. É o oposto de "o Lead virou uma Conta separada e perdeu o passado".

## 2. Decisões-chave

1. **Um objeto, não dois.** Lead + Conta fundidos em Estabelecimento (23/07). Discriminador = `cadastrado` (derivado); campos comerciais nulos enquanto for só lead.
2. **Preservar cru primeiro, modelar depois.** Carga real do Salesforce e schema canônico são **Fase 3** (contrato SF encerra fev/2027). A *estrutura* vem das colunas reais; no protótipo público só os **valores** são fictícios.
3. **O vínculo comercial é sticky.** Uma vez cliente, o registro comercial não some se o ponto churnar — a saúde vira `status_cliente` (ativo/em risco/inativo/reconquistado). É o que sustenta a continuidade.

## 3. Schema-alvo (DDL)

> ⚠️ **Banco a confirmar na Fase 4** — DDL **proposto** (Postgres + PostGIS como alvo provável), não travado.

```sql
CREATE TABLE estabelecimento (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- identidade / cadastro
  nome_fantasia            text NOT NULL,
  razao_social             text,
  cnpj                     text UNIQUE,                    -- chave de dedup
  cnae_codigo              text,
  cnae_descricao           text,                           -- cache do código
  tipologia                text,
  endereco                 text,                           -- consolidado
  -- geo
  geo_original             geography(Point,4326),
  geo_verificado           geography(Point,4326),          -- nulo até validar em campo (monotônico)
  zona_id                  text REFERENCES zona(id),
  -- classificação (derivada — ver §5)
  origem_confianca         text,                           -- escada de confiança
  qualidade                text,                           -- de cnae_tier
  porte                    text,                           -- chega via CNPJá
  -- funil de campo
  -- entrada:          sem_plano (default, FORA do board) <-> visita_planejada
  -- escada de campo:  visitado | td_encontrado
  -- escada comercial: csc | aquisicao        (do ERP, prevalece)
  -- saídas laterais:  perdido | desqualificado
  status                   text NOT NULL DEFAULT 'sem_plano',
  status_anterior          text,                           -- etapa de origem, para voltar de uma lateral (§5)
  motivo_status            text,                           -- DERIVADO: motivo da última tarefa concluída
  ultima_visita            date,
  vendedor_responsavel_id  uuid REFERENCES usuario(id),    -- alvo de RLS
  telefone                 text,                           -- FICTÍCIO no protótipo (§8)
  -- ▼ relação comercial (quando é cliente) — nulos enquanto for só lead ▼
  cadastrado               boolean,                        -- DERIVADO (§5): via integração/ERP no futuro; no protótipo = (data_cadastro IS NOT NULL)
  data_cadastro            date,                           -- fonte:erp — quando virou cliente
  data_primeira_compra     date,                           -- fonte:erp
  data_ultima_compra       date,                           -- fonte:erp — dispara status_cliente
  limite_credito           numeric(12,2),                  -- fonte:erp — FICTÍCIO
  saldo_devedor            numeric(12,2),                  -- fonte:erp — FICTÍCIO
  ticket_medio             numeric(12,2),                  -- fonte:erp — FICTÍCIO
  frequencia_compra        numeric,                        -- fonte:erp — compras/mês (aprox.)
  inadimplente             boolean,                        -- flag; fonte:erp (deriva de saldo/vencidos no futuro)
  status_cliente           text,                           -- DERIVADO: ativo|em_risco|inativo|reconquistado (§5)
  -- auditoria da correção de pin (detalhe completo → Fase 3)
  data_correcao_pin        timestamptz,
  motivo_correcao_pin      text,
  coordenadas_corrigidas   boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- notas: relação 1:N net-new (não existe no Salesforce). Sempre visível ao abrir o pin.
CREATE TABLE nota_estabelecimento (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id uuid NOT NULL REFERENCES estabelecimento(id) ON DELETE CASCADE,
  texto              text NOT NULL,
  criado_por         uuid REFERENCES usuario(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);
```

> **Alternativa registrada (Winston):** se a esparsidade de nulos incomodar (a maioria dos pins nunca vira cliente), os campos comerciais migram para uma **extensão 1:1** `dados_cliente(estabelecimento_id PK/FK, …)`. Para o protótipo, **colunas nulas bastam**. Reversível.

## 4. Campos

### Núcleo (vale para lead e cliente)

| # | Campo | Tipo | Obrig. | Origem | Onde aparece | Notas |
|---|---|---|---|---|---|---|
| 1 | `id` | uuid | Sim | auto | — | PK |
| 2 | `nome_fantasia` | text | **Sim** | `campo`/`fonte:sf` | mapa · sheet · lista · form:básico | único sempre digitado |
| 3 | `razao_social` | text | Não | `fonte:sf` | sheet · busca | — |
| 4 | `cnpj` | text (único) | Não | `fonte:sf` | sheet · busca · form:expandir | **chave de dedup** |
| 5 | `cnae_codigo` / `cnae_descricao` | text | Não | `fonte:sf` | sheet | entrada de `qualidade` |
| 6 | `tipologia` | enum | Não | `fonte:sf` | filtro · sheet · form:expandir | — |
| 7 | `endereco` | text | Não | `fonte:sf` | sheet | consolidado de 6 colunas |
| 8 | `geo_original` / `geo_verificado` | geography | Não | `fonte:sf` / `campo` | **mapa** | verificado: nulo até validar; monotônico |
| 9 | `zona_id` | fk → [[zona]] | Não | `fonte:sf` | filtro · sheet | = `zona_2_c` |
| 10 | `origem_confianca` | enum (4) | Não | **derivado** | **cor do pin** · sheet | §5 |
| 11 | `qualidade` | enum Ouro/Prata/Bronze | Não | **derivado** | filtro · sheet | de [[cnae_tier]] |
| 12 | `porte` | enum | Não | `fonte:cnpja` | filtro · sheet | dimensão de filtro |
| 13 | `status` | enum (8; **7 colunas**) | Sim | **derivado** (tarefa + ERP) | filtro · sheet | **nunca digitado**; três fontes, ERP prevalece; `sem_plano` fica fora do board — §5 |
| 13b | `status_anterior` | enum | Não | `auto` | — | etapa de origem antes de `perdido`/`desqualificado`; usada para **voltar** |
| 14 | `motivo_status` | text | Não | **derivado** | sheet | cache do `motivo_perda`/`motivo_desqualificacao` da última [[tarefa]] concluída |
| 15 | `ultima_visita` | date | Não | check-in | filtro · sheet | — |
| 16 | `vendedor_responsavel_id` | fk → [[vendedor]] | Não | `fonte:sf` | (RLS) · sheet | alvo de RLS |
| 17 | `telefone` | text | Não | `fonte:sf`/`google` | sheet (ligar/WhatsApp) · form:expandir | **fictício** |

### Relação comercial — só faz sentido quando `cadastrado = true` (ex-objeto Conta)

| Campo | Tipo | Origem | Onde aparece | Notas |
|---|---|---|---|---|
| `cadastrado` | boolean | **derivado** (integração/ERP — futuro) | **filtro** · sheet | discriminador lead↔cliente; sticky; §5 |
| `data_cadastro` | date | `fonte:erp` | sheet (se cliente) | quando virou cliente (ex-`converted_at`) |
| `data_primeira_compra` | date | `fonte:erp` | sheet (se cliente) | — |
| `data_ultima_compra` | date | `fonte:erp` | sheet (se cliente) | **dispara `status_cliente`** |
| `limite_credito` | numeric(12,2) | `fonte:erp` | sheet (se cliente) | **fictício** |
| `saldo_devedor` | numeric(12,2) | `fonte:erp` | sheet (se cliente) | **fictício** |
| `ticket_medio` | numeric(12,2) | `fonte:erp` | sheet (se cliente) | **fictício** |
| `frequencia_compra` | numeric | `fonte:erp` | sheet (se cliente) | compras/mês (aprox.) |
| `inadimplente` | boolean | flag (`fonte:erp`) | **filtro** · sheet (se cliente) | deriva de saldo/vencidos no futuro |
| `status_cliente` | enum | **derivado** | filtro · sheet (se cliente) | ciclo de vida comercial — §5 |
| *(entre outros)* | — | `fonte:erp` | — | **depois vamos adicionando** |

**Estruturais:** `cadastrado` substitui o antigo `is_converted` como filtro "é cliente?"; `data_cadastro` substitui `converted_at`; o FK `conta_id` **deixa de existir**. `notas` (1:N, ver DDL); auditoria de correção de pin; `created_at`/`updated_at`.

## 5. Campos derivados / calculados

- **`status` (o funil)** — **três fontes, nenhuma digitada.** Oito valores, sendo **7 colunas** no Kanban (`sem_plano` fica fora do board):

  | Família | Valores | Fonte | Reversível? |
  |---|---|---|---|
  | **Entrada no funil** | `sem_plano` ⇄ `visita_planejada` | existe [[tarefa]] com `status = planejada`? | **sim** |
  | **Escada de campo** | `visitado` → `td_encontrado` | `resultado` de uma [[tarefa]] concluída | não |
  | **Escada comercial** | `csc` → `aquisicao` | **derivado do ERP** — *prevalece* | não |
  | **Saídas laterais** | `perdido` · `desqualificado` | `resultado` de uma [[tarefa]] concluída | via nova tarefa |

  **O funil é o pipeline de trabalho, não a base.** `sem_plano` é o default de todo pin e **não tem coluna** no Kanban: o ponto segue visível no **mapa** e na **Inteligência**, que é onde a base vive. Agendar uma tarefa promove a `visita_planejada` (entra no board); **cancelar a última tarefa planejada devolve a `sem_plano`** — é a única transição reversível, porque só reflete se existe plano. Depois que o ponto é visitado de fato, nunca volta.

  **Derivação comercial:** `cadastrado = true` **e** `data_primeira_compra IS NULL` → **`csc`** (cadastrado sem compra); `data_primeira_compra IS NOT NULL` → **`aquisicao`**. **O ERP prevalece sobre o campo:** quem tem pedido está em `aquisicao` mesmo que a última tarefa tenha dado `perdido` — e um pedido chegando **tira o pin da saída lateral** sozinho.

  - **`venda_declarada`** *(derivado, 28/07)* — **tag `Venda realizada`**, não status. O check-out ganhou um `Vendeu?` ([[tarefa]] §4), e ele **não move o ponto para `aquisicao`**: venda declarada é fato do **vendedor**, conversão é fato do **ERP**, e o invariante de que só o pedido converte segue intacto. O derivado é `existe tarefa realizada com venda_declarada` **E** `status <> 'aquisicao'` — some sozinho quando o pedido chega, porque lá não há mais o que denunciar. **Em `csc` ele FICA:** cadastrado sem compra com venda declarada é exatamente o furo que a supervisão quer ver. Aparece **só no card do Funil** ([[spec-06-funil]] §3) e como KPI da gerencial. `aquisicao` é **sticky** (é um marco, não uma saúde): cliente que para de comprar continua em `aquisicao`, e a deterioração aparece em `status_cliente`, não aqui.

  **Invariante:** `status ∈ {csc, aquisicao}` ⟺ `cadastrado = true`. Os dois campos dizem a mesma verdade em granularidades diferentes — `cadastrado` é o booleano de filtro, `status` é a posição no funil.

  **Avanço monotônico na escada**; `perdido`/`desqualificado` são **saídas laterais** (não regressão) e guardam `status_anterior`, restaurado quando uma nova tarefa — ou um pedido — traz o ponto de volta.

- **`cadastrado`** *(derivado)* — a verdade virá da **integração com o ERP/financeiro** (existe registro comercial?). Enquanto não há integração, no protótipo deriva de `data_cadastro IS NOT NULL`. **Sticky** por natureza: o registro comercial não desaparece se o cliente churnar.
- **`qualidade`** — de `cnae_codigo` via [[cnae_tier]] (editável no Admin sem código). Recalculada quando o CNAE muda.
- **`origem_confianca`** — eixo = **a localização do pin**. Escada (nível mais alto que alcançar): (1) **validado em campo (Máxima)** — monotônico; (2) **CNPJá+Google com match confirmado (Alta)**; (3) **Google puro (Média)**; (4) **CNPJá puro (Menor)**. Princípio: *na dúvida, arredonda pra BAIXO*. **Inversão-tese:** Google puro > CNPJá puro (fachada vista > cartório). Exceções: validação de campo sobe/grava; reclassificação manual permitida.
- **`status_cliente`** *(retenção)* — só quando `cadastrado`. Derivado dos dias desde `data_ultima_compra`: `ativo` → `em_risco` → `inativo`; volta a comprar após inativo = `reconquistado`. **É o sinal que expõe o fosso de retenção.** ⚠️ **Limiares a definir** (ex., do CRM-KA: risco após N dias sem compra).

## 6. O que NUNCA fica aqui

- **Camadas de fonte (Fase 3)** viram objetos próprios, não colunas: `fonte_cnpja` (capital social, situação cadastral, sócios…) e `fonte_google` (avaliações, status, url…). Trocar de provedor sem redesenhar.
- **Nomes de pessoa física** (`decisor_nome`, `socio_1..4_c`) — só com base legal, **nunca com valor real no público** (§8).
- **Descartar** (encanamento de ETL/marketing do SF): `_fivetran_*` · `is_deleted` · `master_record_id` · `jigsaw*` · `maps_assignment_rule*` · `converter_automacao_c` · `status_aprovacao_c` · `is_priority_record` · `photo_url` · `has_opted_out_of_email` …

## 7. Relações

```text
   ┌───────────────────────────────┐
   │       ESTABELECIMENTO          │   cadastrado = false → lead
   │  pin único, acumula histórico  │   cadastrado = true  → cliente
   └───┬───────────┬───────────┬────┘
   1:N │       1:N │       N:1 │        zona_id ─► [[zona]]
       ▼           ▼           ▼        cnae_codigo ─► [[cnae_tier]]
 ┌──────────────┐ ┌────────┐ ┌────────┐ vendedor_responsavel_id ─► [[vendedor]]
 │NOTA_ESTABEL. │ │ TAREFA │ │VENDEDOR│
 │  (net-new)   │ │=check- │ │        │
 │              │ │  in/out│ │        │
 └──────────────┘ └────────┘ └────────┘
```

| Relação | Tipo | Nota |
|---|---|---|
| Estab. → Nota_estabelecimento | 1:N | net-new; sempre visível no pin |
| Estab. → [[tarefa]] | 1:N | atividade datada **= check-in/out**; promove a "validado em campo"; o `resultado` move o `status` |
| Estab. → Vendedor | N:1 | `vendedor_responsavel_id`; alvo de RLS |
| Estab. → Zona | N:1 | `zona_id` = `zona_2_c` |
| Estab. → cnae_tier | N:1 (lookup) | deriva `qualidade` |

> ~~Estab. → Conta~~ **removido** — Conta deixou de ser objeto separado (fusão 23/07).

## 8. Regras de domínio / da fatia

- **O pin nunca some, e nunca se divide** — não há deletar; converter não cria registro novo, só acumula campos. **Desqualificação é estado revisável**: o pin segue visível, o filtro apenas oculta.
- **`status` nunca é digitado** — nasce `sem plano` e muda por **três fontes** (§5): **agendar** uma [[tarefa]] promove a `visita planejada` (e cancelar devolve), **concluir** uma tarefa move as etapas de campo e as saídas laterais, e o **ERP** deriva `csc`/`aquisicao` e **prevalece**. Nunca por toque solto. Avanço **monotônico** de `visita planejada` em diante; `perdido` e `desqualificado` são **saídas laterais** que guardam `status_anterior`.
- **O funil é o pipeline, não a base.** `sem plano` não tem coluna no Kanban — o ponto existe no mapa e na Inteligência, e entra no funil quando ganha uma visita planejada.
- **Conversão não é fato de campo.** Não existe `resultado = convertido` na [[tarefa]]: o vendedor não decide que alguém virou cliente — cadastro e pedido decidem. É o que separa esforço de campo de resultado comercial no funil.
- **Classificação é derivada ou chega pronta — nunca digitada** (`qualidade`, `origem_confianca`, `porte`, `cadastrado`, `status_cliente`). Form pede só o **básico** (nome + local) + **"expandir"** opcional.
- **Check-in e correção de pin promovem a "validado em campo"** (monotônico); gravam `geo_verificado`.
- **LGPD × dado comercial (distinguir):** `limite_credito`, `saldo_devedor`, `inadimplente`, datas de compra são **dado comercial da PJ** (confidencial), *não* dado pessoal de pessoa física — regime é sigilo comercial, não LGPD. Já `telefone`/`decisor_nome` tocam pessoa física. Em qualquer caso: no protótipo público, **valores fictícios**; reais só em ambiente privado (Fase 3), com valor obviamente falso enquanto público.

## 9. Anexos / parkings

- **Anexo — seed de `qualidade`:** listas Ouro/Prata/Bronze de CNAE → em [[cnae_tier]].
- **Campos comerciais (depois vamos adicionando):** `conta_erp_id` (chave para o ERP) e outros indicadores financeiros → detalhar quando a integração entrar.
- **Parkings:** `tem_cardapio_c`/`cardapio_url_c` (fotos, Fase 4) · `microrota_c` (roteirização) · `proximo_contato_agendado` (Tarefas/Funil) · scores SF `temperatura_c`/`lead_score_c` (Performance, Fase 5).
- **A resolver:** limiares de `status_cliente`; colunas nulas vs. extensão 1:1 (Winston); alinhar o naming "lead" no código do protótipo (`js/`) com "Estabelecimento".
