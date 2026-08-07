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
3. **O vínculo comercial é sticky.** Uma vez cliente, o registro comercial não some se o ponto churnar — a saúde vira `status_cliente` (`lead` → `csc` → `recorrente` → `churn`, vocabulário de 29/07). É o que sustenta a continuidade.

## 3. Schema-alvo (DDL)

> ✅ **O banco EXISTE desde 06/08** — Supabase `wfm-externo-tati`, migration `20260805200457_init_praso_maps.sql` no repo [`praso-eng/tati-wfm-externo`](https://github.com/praso-eng/tati-wfm-externo). O DDL abaixo deixou de ser proposta: ele foi aplicado, com **quatro divergências declaradas** e os invariantes de §5 impostos em `CHECK`, não só documentados.
>
> 1. 📍 **Geo virou `lat`/`lng` graváveis + `geography` GERADA.** São quatro colunas `numeric(10,7)` (`lat_original`, `lng_original`, `lat_verificada`, `lng_verificada`) e três `geography(Point,4326)` derivadas delas — inclusive `geo_pin`, que é o `COALESCE(verificada, original)` de 30/07 virado coluna, com índice GIST. **O motivo é de leitura, não de modelagem:** PostgREST devolve `geography` como WKB hex, então o loader do app ficaria sem coordenada legível para o mapa. O par numérico é a verdade gravável; a geometria serve à consulta espacial. O `CHECK` garante **par completo ou nada**.
> 2. 🗺️ **`zona_id` é `NOT NULL DEFAULT 'sem_zona'`**, não nulável. É a regra do projeto aplicada ao schema: dimensão que aceita nulo precisa de balde explícito. **`porte` continua nulável** de propósito — `SEM_PORTE` é valor de FILTRO, não faixa de dado.
> 3. ⛔ **`DELETE` está bloqueado por trigger** em estabelecimento, tarefa e rota. *"O pin nunca some"* deixou de ser convenção. `TRUNCATE` segue liberado — é a válvula de recarga em desenvolvimento, e a diferença está comentada na migration.
> 4. 🔤 **Vocabulários fechados em `CHECK`, não em `CREATE TYPE`.** Eles mudaram três vezes em dez dias (motivos reescritos em 28/07, porte 4→6, tipo 3→7): trocar um `CHECK` é uma migration, mexer em enum de Postgres é dor.
>
> 🔴 **A RLS: o que estava escrito aqui estava ERRADO, e errava na direção perigosa** *(medido em 06/08, na revisão do port, consultando o banco pela API de gerenciamento)*. Este parágrafo dizia *"o banco nasceu SEM RLS"*. O estado real do `wfm-externo-tati`:
> - **RLS está LIGADA nas 7 tabelas** (`relrowsecurity = true`) — e a migration **não tem uma linha** de `enable row level security`, então foi o Supabase que a ligou.
> - **Zero policies.** RLS ligada sem policy **nega tudo** a `anon` e `authenticated`.
> - **`anon` e `authenticated` têm grants COMPLETOS** em todas as tabelas: `SELECT, INSERT, UPDATE, DELETE, TRUNCATE`.
> - O app funciona porque a **`service_role` ignora RLS** — é ela que o servidor usa.
>
> ⚖️ **A leitura correta é o inverso da que estava aqui: a RLS é a ÚNICA coisa entre a chave pública `anon` e permissão total de escrita e `TRUNCATE` em todas as tabelas.** Por isso o erro importava: o doc descrevia o banco como **menos** protegido do que ele é, e essa descrição convida exatamente a ação que o abriria — desligar a RLS "porque não tem RLS mesmo", ou colar uma policy permissiva para destravar algo. ⛔ **Não desligar, e não criar policy `using (true)`** enquanto os grants estiverem assim.
> 🔴 **E sobra uma contradição de verdade, agora entre o banco e o template:** o `AGENTS.md` do template de apps internos **proíbe ligar RLS** (a autorização deve viver no código das rotas), e o banco está com ela ligada. Uma das duas coisas tem de mudar, e isso **não foi decidido**. Já o **R3** da [decisão de banco](../../_bmad-output/planning-artifacts/decisao-banco-operacional.md) — que escolheu Supabase pela RLS nativa — não está mais contrariado pela ausência dela, mas segue não atendido: **RLS sem policy não é autorização, é bloqueio total**. As colunas de posse (`vendedor_responsavel_id`) existem e estão indexadas; o modelo de posse **não existe** (não há mapeamento sessão→usuario), então nem o código nem o banco distinguem um vendedor de outro.

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
  bairro                   text,                           -- geografia fina; NAO e a zona (29/07)
  -- geo
  lat_original             numeric(10,7),                  -- a verdade GRAVAVEL; par completo ou nada (CHECK)
  lng_original             numeric(10,7),
  lat_verificada           numeric(10,7),                  -- nulo até validar (monotônico, por trigger)
  lng_verificada           numeric(10,7),
  -- as tres abaixo sao GERADAS das quatro acima; geo_pin leva o indice GIST
  geo_original             geography(Point,4326) GENERATED ALWAYS AS (...) STORED,
  geo_verificado           geography(Point,4326) GENERATED ALWAYS AS (...) STORED,
  geo_pin                  geography(Point,4326) GENERATED ALWAYS AS (...) STORED,  -- COALESCE(verificada, original)
  zona_id                  text NOT NULL DEFAULT 'sem_zona' REFERENCES zona(id),  -- vocabulario FECHADO (15) + o balde
  -- classificação (derivada — ver §5)
  origem_confianca         text,                           -- escada de confiança (3 degraus)
  qualidade                text,                           -- de cnae_tier
  porte                    text,                           -- chega via CNPJá; 6 faixas de porte_c
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
  -- ▼ o TOMADOR DE DECISÃO, escrito pela visita de Prospecção (06/08, [[tarefa]] §4d) ▼
  -- Mora aqui e nao na tarefa porque ATRAVESSA visitas: a qualificacao chega pre-preenchida.
  decisor_nome             text,                           -- ⚠️ PESSOA FÍSICA — FICTÍCIO no protótipo (§6, §8)
  decisor_telefone         text,                           -- ⚠️ idem
  decisor_melhor_dias      text[],                         -- vocabulário fechado ([[tarefa]] §4)
  decisor_melhor_hora      time,                           -- horário em que se encontra o TD
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
  status_cliente           text,                           -- DERIVADO: lead|csc|recorrente|churn (§5) -- existe para TODO pin desde 29/07
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
| 8 | `lat`/`lng` × 4 → `geo_*` | numeric → geography **gerada** | Não | `fonte:sf` / `campo` | **mapa** | o par NUMÉRICO é o gravável; as três `geography` derivam dele, e `geo_pin` já é o COALESCE pronto (§3). Verificada: nula até validar; monotônica. ⚠️ **Onde o pin é desenhado é `COALESCE(geo_verificado, geo_original)`** (30/07) — a original é o **fallback**, não a preferência: na base real ela é muitas vezes o centroide do bairro (§5) |
| 8b | `bairro` | text | Não | `fonte:sf` (`bairro_c`) | sheet (subtítulo + sob a Zona) | **geografia fina — não é a zona** (29/07); no protótipo é ele que dá coordenada, endereço e DDD |
| 9 | `zona_id` | fk → [[zona]] | Não | `fonte:sf` | **filtro (16 chips fixos)** · sheet | = **`zona_guardioes_c`**; **vocabulário FECHADO**: 15 zonas + `Sem Zona` — §5 |
| 10 | `origem_confianca` | enum (3) | Não | **derivado** | **pista do pin** (tracejado · `G` · `✓`) · sheet | §5; **deixou de ser a cor** em 29/07 |
| 11 | `qualidade` | enum Ouro/Prata/Bronze | Não | **derivado** | filtro · sheet | de [[cnae_tier]] |
| 12 | `porte` | enum (**6**) | Não | `fonte:cnpja` / `fonte:sf` (`porte_c`) | filtro · sheet | 29/07: 4→6 faixas, uma por valor real de `porte_c`; `LTDA` virou `DEMAIS` — §5 |
| 13 | `status` | enum (8; **7 colunas**) | Sim | **derivado** (tarefa + ERP) | filtro · sheet | **nunca digitado**; três fontes, ERP prevalece; `sem_plano` fica fora do board — §5. ⚠️ **Rotulado "Fase" na tela** desde 29/07 (a chave segue `status`) |
| 13b | `status_anterior` | enum | Não | `auto` | — | etapa de origem antes de `perdido`/`desqualificado`; usada para **voltar** |
| 14 | `motivo_status` | text | Não | **derivado** | sheet | cache do `motivo_perda`/`motivo_desqualificacao` da última [[tarefa]] concluída. **Existe só enquanto o pin está numa lateral** — sair de lá o apaga (§5); motivo de **não venda** nunca entra aqui (é do evento, não do estado) |
| 15 | `ultima_visita` | date | Não | check-in | filtro · sheet | — |
| 16 | `vendedor_responsavel_id` | fk → [[vendedor]] | Não | `fonte:sf` | (RLS) · sheet | alvo de RLS |
| 17 | `telefone` | text | Não | `fonte:sf`/`google` | sheet (ligar/WhatsApp) · form:expandir | **fictício** |

### Relação comercial — só faz sentido quando `cadastrado = true` (ex-objeto Conta)

| Campo | Tipo | Origem | Onde aparece | Notas |
|---|---|---|---|---|
| `cadastrado` | boolean | **derivado** (integração/ERP — futuro) | **cor do pin** (29/07) · **filtro** · sheet | discriminador lead↔cliente; sticky; §5 |
| `data_cadastro` | date | `fonte:erp` | sheet (se cliente) | quando virou cliente (ex-`converted_at`) |
| `data_primeira_compra` | date | `fonte:erp` | sheet (se cliente) | — |
| `data_ultima_compra` | date | `fonte:erp` | sheet (se cliente) | **dispara `status_cliente`** |
| `limite_credito` | numeric(12,2) | `fonte:erp` | sheet (se cliente) | **fictício** |
| `saldo_devedor` | numeric(12,2) | `fonte:erp` | sheet (se cliente) | **fictício** |
| `ticket_medio` | numeric(12,2) | `fonte:erp` | sheet (se cliente) | **fictício** |
| `frequencia_compra` | numeric | `fonte:erp` | sheet (se cliente) | compras/mês (aprox.) |
| `inadimplente` | boolean | flag (`fonte:erp`) | **filtro** · sheet (se cliente) | deriva de saldo/vencidos no futuro |
| `status_cliente` | enum (**4**) | **derivado** | **filtro** · sheet | 29/07: vocabulário `lead \| csc \| recorrente \| churn`; **existe para TODO pin**, não só cliente — §5 |
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

  > 🔴 **06/08 — esta família de valores foi REESCRITA, e a frase abaixo está REVERTIDA.** O funil virou **duas abas** ([[jornada-funil-aquisicao]] §5.1 e §5.2): **Aquisição**, com 6 colunas — *Perdido · Prospecção · Qualificação · Fechamento · Aquisição · Desqualificado* —, e **Recorrência**, com os 4 tipos derivados. **A piscina `sem_plano` entra no board**, como tag dentro de Prospecção. Efeitos no enum: `visita_planejada` e `visitado` viram **tags de card**, `td_encontrado` vira **Qualificação**, nasce **Fechamento**, e **`csc` SAI do `status`** (decidido).
  > 🔧 **O invariante abaixo perde um lado.** Era `status ∈ {csc, aquisicao} ⟺ cadastrado`; passa a ser **`status = aquisicao ⟹ cadastrado`** — quem comprou é cadastrado, mas **nem todo cadastrado está em Aquisição**: o `csc` agora trabalha nas colunas de aquisição como qualquer oportunidade, e o cadastro se lê pela **tag `status_cliente`** no card. ⏳ **O DDL só muda quando as 4 pendências de [[jornada-funil-aquisicao]] §7 fecharem.**

  **O funil é o pipeline de trabalho, não a base.** `sem_plano` é o default de todo pin e **não tem coluna** no Kanban: o ponto segue visível no **mapa** e na **Inteligência**, que é onde a base vive. Agendar uma tarefa promove a `visita_planejada` (entra no board); **cancelar a última tarefa planejada devolve a `sem_plano`** — é a única transição reversível, porque só reflete se existe plano. Depois que o ponto é visitado de fato, nunca volta.

  **Derivação comercial:** `cadastrado = true` **e** `data_primeira_compra IS NULL` → **`csc`** (cadastrado sem compra); `data_primeira_compra IS NOT NULL` → **`aquisicao`**. **O ERP prevalece sobre o campo:** quem tem pedido está em `aquisicao` mesmo que a última tarefa tenha dado `perdido` — e um pedido chegando **tira o pin da saída lateral** sozinho.

  - **`venda_declarada`** *(derivado, 28/07)* — **tag `Venda realizada`**, não status. O check-out ganhou um `Vendeu?` ([[tarefa]] §4), e ele **não move o ponto para `aquisicao`**: venda declarada é fato do **vendedor**, conversão é fato do **ERP**, e o invariante de que só o pedido converte segue intacto. O derivado é `existe tarefa realizada com venda_declarada` **E** `status <> 'aquisicao'` — some sozinho quando o pedido chega, porque lá não há mais o que denunciar. **Em `csc` ele FICA:** cadastrado sem compra com venda declarada é exatamente o furo que a supervisão quer ver. Aparece **só no card do Funil** ([[spec-06-funil]] §3) e como KPI da gerencial. `aquisicao` é **sticky** (é um marco, não uma saúde): cliente que para de comprar continua em `aquisicao`, e a deterioração aparece em `status_cliente`, não aqui.

  **Invariante:** `status ∈ {csc, aquisicao}` ⟺ `cadastrado = true`. Os dois campos dizem a mesma verdade em granularidades diferentes — `cadastrado` é o booleano de filtro, `status` é a posição no funil.

  **Avanço monotônico na escada**; `perdido`/`desqualificado` são **saídas laterais** (não regressão) e guardam `status_anterior`, restaurado quando uma nova tarefa — ou um pedido — traz o ponto de volta.

  > ⚖️ **Transição recusada não escreve nada — e a saída da lateral é um ato só** (30/07). Voltar de uma lateral é *restaurar `status_anterior` e então aplicar o status novo*; se o segundo passo é recusado (regressão na escada, ERP prevalecendo), o **primeiro não pode ter acontecido**. Era o bug: agendar num `perdido` restaurava o pin para `visitado` e **depois** recusava o `visita_planejada`, deixando o ponto fora da lateral, sem `status_anterior`, com o `motivo_status` da perda ainda colado, e a função dizendo que nada mudou — logo nem `status_cliente` era rederivado. Ou a transição inteira acontece, ou nada acontece.
  > ⚖️ **Sair da lateral apaga `motivo_status`.** Ele é o motivo da **saída**: mantido num pin de volta ao funil, viraria *"Perdido (preço alto)"* escrito num ponto em *Visitado*. Limpar mora no mesmo lugar que escreve `status`, então vale para as duas portas de volta — tarefa concluída e arraste no Funil.
  > 🐞 **A regra de 30/07 foi VIOLADA de novo no port, e a lição é sobre onde ela mora** (achado da revisão de 06/08, corrigido). O bug de 30/07 estava na *transição*; este estava no **chamador**: `concluirTarefa` gravava `motivo_status` **fora** do bloco condicionado a "mudou", então um pin `perdido` cujo novo check-out **não avançava** (ex.: `sem_avanco` com origem em `td_encontrado` — regressão na escada, corretamente recusada) continuava `perdido` e **perdia o motivo**. O pin ficava "Perdido" sem dizer por quê.
  > ⚖️ **E o `CHECK` não pegou — porque ele é unidirecional.** `estabelecimento_lateral_guarda_motivo` proíbe motivo **fora** da lateral; motivo **nulo dentro** dela é válido para o banco. É o primeiro caso registrado em que a duplicação invariante-no-código/`CHECK`-no-banco **não** salvou: as duas metades concordavam, e nenhuma cobria essa direção. **O padrão que fica: "recusada não escreve nada" tem de valer no CHAMADOR, não só na função pura** — quem grava é ele, e um `CHECK` só recusa o que ele consegue nomear.
  > 🔴 **Escrita concorrente perde a etapa de origem — restrição conhecida, correção na Fase 4** (revisão 06/08). Toda transição é *ler → decidir → gravar* **sem transação**. Interleaving concreto: A arrasta o card `visitado → td_encontrado` enquanto B conclui uma tarefa com `perdido`; os dois **leem `visitado`**; A grava `td_encontrado`; B grava `perdido` com `status_anterior = 'visitado'` — **a etapa de origem gravada é a que A já substituiu**, então voltar da lateral devolve o pin a *Visitado* e apaga o avanço. Mesma forma nos laços de [[rota]] (`criarRota`/`cancelarRota`, um `select`+`update` por pin). ⚖️ **Declarado em vez de mascarado:** a janela é estreita (um vendedor por pin, uso de campo), e a correção certa — escrita condicional por status lido, ou a transição dentro de uma RPC — mexe na camada de escrita inteira.

- **`cadastrado`** *(derivado)* — a verdade virá da **integração com o ERP/financeiro** (existe registro comercial?). Enquanto não há integração, no protótipo deriva de `data_cadastro IS NOT NULL`. **Sticky** por natureza: o registro comercial não desaparece se o cliente churnar. **Desde 29/07 é a COR do pin** (azul cliente × lilás lead) — e, por ser derivado do ERP, a cor continua nunca sendo digitada. Como o invariante `status ∈ {csc, aquisicao} ⟺ cadastrado` vale, no board do Funil o azul cai exatamente sobre as duas colunas comerciais.
- **`qualidade`** — de `cnae_codigo` via [[cnae_tier]] (editável no Admin sem código). Recalculada quando o CNAE muda.
- **`origem_confianca`** — eixo = **a localização do pin**. Escada **aditiva de 3 degraus** (nível mais alto que alcançar): (1) **validado em campo (Máxima)** — monotônico; (2) **Google (Média)** — o cadastro de CNPJ foi enriquecido com Google; (3) **CNPJ (Menor)** — o piso. Princípio: *na dúvida, arredonda pra BAIXO*. Exceções: validação de campo sobe/grava; reclassificação manual permitida.
  > ⚠️ **Mudou em 29/07: eram 4 valores, viraram 3, e as chaves mudaram** (`cnpja_puro`→`cnpj`, `cnpja_google`→`google`). A categoria **"Google puro"** (ponto com Google e **sem** CNPJ) deixou de existir por decisão de produto: todo ponto nasce da base de CNPJ e o Google **enriquece** esse cadastro. Consequências: os degraus são cumulativos (`cnpj` ⊂ `google` ⊂ `validado_campo`), `match_confirmado` deixou de entrar na conta (não há mais dois degraus para ele separar), e a **inversão-tese "Google puro > CNPJá puro" ficou DORMENTE, não revogada** — sem a categoria, ela não tem sujeito; se um dia entrar ponto sem CNPJ, ela volta e vira o 4º degrau.
  > **Isto NÃO é mais a cor do pin.** A origem virou **pista de forma** (tracejado · `G` · `✓`) e a cor passou a ser `cadastrado`. Ver [[spec-00-design-system]] §2.3 e [[spec-01-mapa]] §3.
- **`status_cliente`** *(a relação no tempo)* — **enum de 4: `lead` → `csc` → `recorrente` → `churn`.** É o sinal que expõe o fosso de retenção, e desde 29/07 é **dimensão de filtro própria**. Derivado, nunca digitado:
  `cadastrado = false` → **`lead`** · `cadastrado` sem `data_primeira_compra` → **`csc`** · com `data_primeira_compra` → **`recorrente`** · era cliente e parou de comprar → **`churn`**.
  > ⚠️ **Mudou em 29/07, e a mudança é de forma, não só de vocabulário.** Antes: `ativo | em_risco | inativo | reconquistado`, **só quando cadastrado**. Agora o enum inclui **`lead`**, então o campo **existe para todo pin** — deixou de ser "atributo de cliente" e passou a ser "onde este ponto está na relação". Em troca, os quatro degraus de saúde colapsaram em `recorrente` × `churn`: a granularidade fina (em risco, reconquistado) volta quando o ERP trouxer `data_ultima_compra`, com os **limiares que continuam a definir**.
  > ⚠️ **`csc` fica nos DOIS enums** — aqui e em `status` (funil). Não é duplicação: é a mesma verdade em eixos diferentes. No funil `csc` é a **coluna** (onde o trabalho está); aqui é a **relação** (o que o ponto é). O invariante `status ∈ {csc, aquisicao} ⟺ cadastrado` amarra os dois, então eles nunca discordam.
  > ⚠️ **`churn` não tem fonte hoje** e nasce **vazio nas duas bases**. O `salesforce.lead` não traz compra nem pedido — só `cliente_minal*_lead_c` (cliente de outra marca) e `faixa_faturamento_c`. O valor existe no vocabulário para o filtro não mentir sobre o que o modelo prevê; o chip fica em 0 até a integração do ERP.
  > 🆕 **03/08 — a granularidade fina ganhou LEITOR, e o enum de 4 não basta mais.** Os **cinco tipos de visita** ([[tarefa]] §4c) são derivados deste mesmo eixo, e precisam de **6 distinções** onde há 4 baldes: `recorrente` tem de virar **dois** — *comprou 1 ou 2 vezes* (visita de **recorrência**) × *ciclo de recompra fechado* (visita de **expansão**) —, o que exige a **coorte de recorrência** (`rank1/2/3` de `comercial.regras_de_funil_2025`, ou `Status__c` da `salesforce.account` por `id_praso_c`). E `churn` precisa da régua de **120 dias** que os tipos usam, não a de **60** que o mapa herdou ([[fluxos-n8n-salesforce]] §8, C5). Era um refinamento adiado *"até o ERP trazer `data_ultima_compra`, com os limiares que continuam a definir"*; **os limiares agora têm quem os leia** — um formulário de check-out por degrau. Fica **a resolver** (§9), com dependência declarada em [[tarefa]] §4c.5.
  > 📍 **Relação com a COR do pin:** este é o refinamento que a [[spec-00-design-system]] §2.5 previu que ia querer o canal da cor. **A cor segue binária** (cliente × lead) por ora — `lead` aqui é exatamente o lilás, e `csc`/`recorrente`/`churn` são exatamente o azul. Abrir o azul em três tons é decisão em aberto.
- **`porte`** — **6 faixas** desde 29/07, uma por valor real de `porte_c` (conferidos no Metabase): `MEI` ← `me-ei-mei` · `ME` ← `me-ltda` · `ME_EI` ("ME-EI Não MEI") ← `me-ei-nao_mei` · `EPP` ← `epp-ltda` · `EPP_EI` ← `epp-ei` · `DEMAIS` ← `demais`. O prefixo deixou de bastar (`me-ltda` e `me-ei-nao_mei` são faixas distintas e ambas começam com "me"). `LTDA` era rótulo nosso e **morreu**. Valor novo na coluna → **nulo**, nunca chute. ⚠️ **`MEI` nunca aparece no dado real:** o recorte do snapshot o exclui duas vezes.
  > **`SEM_PORTE` é valor de FILTRO, não faixa de dado** (29/07). O campo continua **nulo** quando o porte é desconhecido — o que é o caso do pin criado em campo, cujo porte chega via CNPJá. O que mudou é que esse nulo virou **filtrável**: o painel tem o chip `Sem porte` e o `matches` compara `porte || 'SEM_PORTE'`. Sem isso, pin sem porte saía de qualquer recorte de porte sem avisar. Mesmo padrão do `Sem Zona` — ver [[spec-00-design-system]] §6.2.
- **`zona_id`** — **vocabulário FECHADO** desde 29/07, de `zona_guardioes_c`: as **15 zonas** da operação (`CE Guararapes` · `CE Grande Fortaleza` · `REC Zona Sul` · `PE Interior` · `PE Litoral Sul` · `JP Sul` · `CE Maracanaú` · `RMR Norte` · `REC Zona Norte` · `REC Zona Oeste` · `CE Caucaia - Parquelândia` · `CE Aldeota` · `PE Jaboatão` · `PB João Pessoa Litoral` · `JP Oeste`) **+ `Sem Zona`** para tudo o mais — inclusive nulo e os 7 valores residuais da base (`CE Eusébio Guararapes`, `CE Maracanaú Fatima`, `CE Aldeota Cumbuco`, `PE Áreas Brancas`, `CE Litoral Oeste` e dois `Recife Zona Sul - Oeste/Leste` com 1 registro cada). **Nunca inventa zona.**
  > ⚠️ **Trocamos de coluna, não só de valores.** Usávamos `zona_2_c`, cuja taxonomia é **outra** — só 5 dos 13 valores dela estão nestes 15 — e que é muito menos preenchida (82k nulos contra 33k). No recorte do snapshot as 15 cobrem **99,6%** (29 de 6.880 caem em `Sem Zona`).
  > ⚠️ **Zona não é bairro.** No protótipo `zone` era o bairro, e era ele que dava coordenada, endereço e DDD; por isso o bairro **não** foi absorvido — virou o campo `bairro` (§4, linha 8b), e a zona passou a ser a zona. Confundir os dois foi o que obrigou a subir o `localStorage` para v9.

## 6. O que NUNCA fica aqui

- **Camadas de fonte (Fase 3)** viram objetos próprios, não colunas: `fonte_cnpja` (capital social, situação cadastral, sócios…) e `fonte_google` (avaliações, status, url…). Trocar de provedor sem redesenhar.
- **Nomes de pessoa física** — só com base legal, **nunca com valor real no público** (§8). ⚠️ **`socio_1..4_c` continua fora.**
  > 🔄 **`decisor_nome` SAIU desta lista em 06/08 e passou a ser campo do §3/§4.** O funil de aquisição pede **nome e telefone do TD** na Prospecção, e a Qualificação chega **pré-preenchida** com eles ([[tarefa]] §4d) — sem o campo, o fluxo inteiro não fecha. **A regra não foi afrouxada, foi aplicada:** contato profissional de decisor em PJ tem base legal (legítimo interesse, relação comercial B2B), e o que a §8 proíbe é **valor real em ambiente público** — que segue proibido, porque este repositório e a demo são públicos. Então: **campo real no app, valor fictício no protótipo.**
  > ⚖️ **O que mudou de fato foi a minimização.** A versão anterior desta fatia propunha guardar só o **cargo** ("o cargo, nunca o nome"), que é o mínimo LGPD possível — e ela **não sobrevive ao fluxo**: o vendedor precisa ligar para a pessoa, e *"o comprador"* não tem telefone. A escolha de guardar mais dado é **consciente e tem contrapartida**: fictício no público, e `socio_1..4_c` segue fora porque **não** tem uso no fluxo.
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
| Estab. → [[zona]] | N:1 | `zona_id` = **`zona_guardioes_c`** (vocabulário fechado de 15 + `Sem Zona`) |
| Estab. → cnae_tier | N:1 (lookup) | deriva `qualidade` |

> ~~Estab. → Conta~~ **removido** — Conta deixou de ser objeto separado (fusão 23/07).

## 8. Regras de domínio / da fatia

- **O pin nunca some, e nunca se divide** — não há deletar; converter não cria registro novo, só acumula campos. **Desqualificação é estado revisável**: o pin segue visível, o filtro apenas oculta.
- **`status` nunca é digitado** — nasce `sem plano` e muda por **três fontes** (§5): **agendar** uma [[tarefa]] promove a `visita planejada` (e cancelar devolve), **concluir** uma tarefa move as etapas de campo e as saídas laterais, e o **ERP** deriva `csc`/`aquisicao` e **prevalece**. Nunca por toque solto. Avanço **monotônico** de `visita planejada` em diante; `perdido` e `desqualificado` são **saídas laterais** que guardam `status_anterior`.
- **O funil é o pipeline, não a base.** `sem plano` não tem coluna no Kanban — o ponto existe no mapa e na Inteligência, e entra no funil quando ganha uma visita planejada.
- **Conversão não é fato de campo.** Não existe `resultado = convertido` na [[tarefa]]: o vendedor não decide que alguém virou cliente — cadastro e pedido decidem. É o que separa esforço de campo de resultado comercial no funil.
- **Classificação é derivada ou chega pronta — nunca digitada** (`qualidade`, `origem_confianca`, `porte`, `cadastrado`, `status_cliente`). Form pede só o **básico** (nome + local) + **"expandir"** opcional.
- **Check-in PRESENCIAL e correção de pin promovem a "validado em campo"** (monotônico); a correção de pin grava `geo_verificado`.
  > ⚖️ **Só presença confirmada promove — decidido em 06/08, numa revisão de código.** A regra dizia "check-in" sem qualificar a distância, e isso colidia com o próprio `tipo_checkin` ([[tarefa]] §5): um check-in **remoto** é, por definição, o vendedor registrando de longe — a 1,2 km não se constata coisa alguma. Agora `remoto` registra a visita e **não** sobe na escada de confiança.
  > ⛔ **E o check-in não copia mais a coordenada CRUA para a verificada.** O port fazia `lat_verificada = lat_verificada ?? lat_original`, o que **estampava o centroide do bairro como "validado em campo"** — zerando exatamente a diferença que a decisão de 30/07 existe para medir (mediana 2,5 km; 1.404 pins acima de 500 m). E era **irreversível**, porque `geo_verificado` é monotônico por trigger. Enquanto o GPS não entrar, o check-in **não escreve coordenada nenhuma**; quando entrar, é a coordenada **medida** que vem para cá — nunca a crua. *(A promoção de `origem_confianca` continua: quem esteve na porta validou o ponto, mesmo sem termos medido onde a porta fica.)*
- **O pin é desenhado na coordenada verificada quando ela existe** *(30/07)* — `COALESCE(geo_verificado, geo_original)`, com **par completo ou nada** (meia coordenada põe o pin em lugar nenhum). A original não é a preferência, é o fallback: na base real ela é frequentemente o **centroide** do bairro/cidade, e 2.110 dos 6.914 pins se movem em mediana **2,5 km** quando a verificada entra ([[snapshot-dado-real]] §3). ⚖️ **`geo_verificado` continua campo próprio, não é absorvido pelo coalesce:** *onde desenhar* e *foi verificada?* são perguntas diferentes — a segunda é o que o sheet mostra e a que a auditoria de correção de pin usa. E isto **não** promove `origem_confianca`: coordenada corrigida por automação (Google) não é constatação humana.
- **LGPD × dado comercial (distinguir):** `limite_credito`, `saldo_devedor`, `inadimplente`, datas de compra são **dado comercial da PJ** (confidencial), *não* dado pessoal de pessoa física — regime é sigilo comercial, não LGPD. Já `telefone`/`decisor_nome` tocam pessoa física. Em qualquer caso: no protótipo público, **valores fictícios**; reais só em ambiente privado (Fase 3), com valor obviamente falso enquanto público.

## 9. Anexos / parkings

- **Anexo — seed de `qualidade`:** listas Ouro/Prata/Bronze de CNAE → em [[cnae_tier]].
- **Campos comerciais (depois vamos adicionando):** `conta_erp_id` (chave para o ERP) e outros indicadores financeiros → detalhar quando a integração entrar.
- **Parkings:** `tem_cardapio_c`/`cardapio_url_c` (fotos, Fase 4) · `microrota_c` (roteirização) · `proximo_contato_agendado` (Tarefas/Funil) · scores SF `temperatura_c`/`lead_score_c` (Performance, Fase 5).
- **A resolver:** limiares de `status_cliente` — **agora com prazo, porque os sete tipos de visita dependem deles** ([[tarefa]] §4c.5): a coorte que separa recorrência × expansão e a régua de **120 dias** do churn/reaquisição; colunas nulas vs. extensão 1:1 (Winston); alinhar o naming "lead" no código do protótipo (`js/`) com "Estabelecimento".
- **A ambiguidade da palavra "aquisição"** (levantada em 03/08, [[tarefa]] §4c.1): no `status` daqui `aquisicao` = **já comprou** (a coluna do Kanban, o marco do pedido); na fala da operação, *"base de aquisição"* = **quem ainda não comprou**. Sentidos opostos da mesma palavra em dois lugares do produto. Nenhum tipo de visita se chama `aquisicao`, então não há colisão de rótulo em tela — **renomear a coluna do funil (candidato: `comprou`) não foi decidido.**
