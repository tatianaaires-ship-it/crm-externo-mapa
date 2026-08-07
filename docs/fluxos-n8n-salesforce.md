---
title: "Fluxos n8n + Salesforce que não podem faltar no Praso Maps"
tipo: inventário-de-automações (mapeamento de dependências)
fase: "Fase 3 — sprint 26/07/2026"
status: 🟡 em revisão — escopo do externo FECHADO (30/07); 5 contradições abertas em §8 (C2 resolvida)
sources:
  - "Notion — 🔍 Diagnóstico - Time Externo (255 críticas, jan–abr/2026)"
  - "Notion — Diagnóstico: Geocodificação de Leads (workflow `Atualiza Coordenadas Verificadas v3`)"
  - "Canal interno de suporte de dados — CNPJá→SF parado desde 18/03/2026 (14/07); Fivetran é o sync (03/11)"
  - "Canal interno de sinalizações do externo — bot Agente Comercial (fichas de exclusão de base)"
  - "Conversa interna com engenharia (22/05/2026) — praso-web empurra Account para o SF via CreateObjectsJob"
  - "docs/snapshot-dado-real.md (o WHERE do snapshot depende destes fluxos)"
  - "Decisões Tatiana (2026-07-30): n8n como remendo — o requisito é a capacidade nativa"
  - "Lista Tatiana (2026-07-30): 2 workflows n8n + 4 Flows do Salesforce nomeados"
  - "JSON do workflow `Att Salesforce - Funil, Recorrentes, Churn` (id XKeacoGayHnd5JGA), 2026-07-30"
  - "Metabase db19 (2026-07-30): distribuição de account.status_c; 520 leads Cadastrado não convertidos"
related:
  - "[[estabelecimento]]"
  - "[[tarefa]]"
  - "[[snapshot-dado-real]]"
---

# Fluxos n8n + Salesforce que não podem faltar no Praso Maps

> **Uma linha:** o Praso Maps não nasce num vácuo — cada pin que ele mostra é o **produto de uma
> automação que já existe** no n8n ou no Salesforce. Este doc lista essas automações e responde, para
> cada uma: **o que quebra no app se ela não existir.**

> ✅ **Escopo fechado para o time externo** (decisão Tatiana, 30/07/2026). Não é o inventário completo
> da instância n8n — é o recorte que importa para o externo, e ele está completo. Fluxos de Growth e de
> outras operações ficam fora de propósito.

## 0. Resumo

**Prioridade:** **P0** = sem isso o app não existe ou mente sobre o dado · **P1** = o app funciona pior ·
**P2** = decidir antes de agir.
Na coluna *Onde*, `→ tech` marca o que hoje é remendo no n8n/SF e **precisa virar capacidade nativa** (§1).

| Fluxo | Onde | Prior. | O que faz |
|---|---|---|---|
| **CNPJá → Lead** | n8n | **P0** | Cria o lead a partir da base de CNPJ. **É a origem de todo pin** — e está **parado desde 18/03/2026**. |
| **Fivetran: Salesforce → MySQL db19** | tech | **P0** | Espelha o Salesforce no banco que o app lê. Único caminho de dado: a latência dele é a latência do app. |
| **Situação cadastral + MEI** | n8n **→ tech** | **P0** | Mantém situação na Receita e flag MEI atualizadas. É o filtro que tira CNPJ baixado e MEI da base. |
| **`Praso - Converter lead - V2`** | Salesforce **→ tech** | **P0** | Converte Lead → Account pelo CNPJ. Produz o `cadastrado`. Falha quando não há CNPJ. |
| **`Ajustar convertidos leads salesforce`** | n8n **→ tech** | **P0** | A cada minuto, casa lead com Account por CNPJ e marca `status = Cadastrado`. Remendo do vínculo que não vem na origem. |
| **`Converter lead pelo status = cadastrado`** | Salesforce **→ tech** | **P0** | Converte o lead a partir do status. Consome a saída do de cima — os três são uma cadeia só. |
| **`Att Salesforce - Funil, Recorrentes, Churn`** | n8n | **P0** | De hora em hora, classifica a **conta**: `Funil` · `CSC` · `Recorrente` · `Churn`, mais meses de recorrência e time responsável. |
| **Atualizar zona e vendedor-zona** (Maps assignment rule) | Salesforce + **Maps** | **P0** | Define a zona do pin e, a partir dela, o vendedor dono. Duas dimensões de filtro **e o dono do pin** — mas a regra é do Maps, que sai de cena. ⚠️ São **dois passos** (plano em lote → gatilho), e a **posse do território mora na tabela de regras do Maps**, não num fluxo (§3f). |
| **`Atualiza Coordenadas Verificadas v3`** | n8n **→ tech** | **P0** | Busca a coordenada real no Google Places e corrige pin em centroide. **Só existe para Lead**; Account está pendente. |
| **Duplicate Rule por CNPJ** (Lead ↔ Account) | Salesforce | **P0** | Bloqueia criar registro com CNPJ que já existe. Única proteção contra duplicata na criação em campo. |
| **`Status Funil`** | n8n | **P1** | Marca `Disponível 2ª` / `Disponível 3ª` na janela de 45 dias após a 1ª compra. Único sinal **com prazo** — o fluxo apaga quando vence. |
| **Fluxo de validação planejamento** | Salesforce | **P1** | Gate de supervisão: marca o planejamento como validado e **estampa a data**. |
| **Atualizar fase para desqualificado/perdido via Motivo** | Salesforce | **P1** | Preencher o Motivo **move a fase**. É um segundo caminho automático de funil. |
| **Check-in → Task → apuração** | Salesforce | **P1** | Registra a visita e vincula ao lead **ao vivo** pelo CNPJ, na hora da apuração. |
| **`Atualizar rank1 date`** | n8n | **P1** | Traz do Metabase a data da última aquisição e a tag do vendedor. |
| **Sinalização de exclusão de base** | n8n | **P2** | Vendedor sinaliza EC fechado / CNPJ baixado / não-ICP; cai ficha num canal interno. **Pode morrer** se o modelo virar aquisição + recorrência. |
| **Wishlist (planilha → SF)** | n8n | **P2** | Sobe estabelecimentos de lista/indicação para o Salesforce. |
| **Validação de WhatsApp / telefone** | n8n | **P2** | Valida telefone e manda para o Supabase. Provável redundância com a validação do CNPJá. |

**Não são fluxos, mas somem junto com o Salesforce Maps:**

| Recurso | Onde | Prior. | O que faz |
|---|---|---|---|
| **"Definir local verificado"** | Maps | **P0** | Botão que reposiciona o pin no GPS do celular. É a versão nativa da correção em lote. Não funciona em pin de rota. |
| **Click2Create + filtro `OR` da camada** | Maps | **P0** | Cria lead no ponto clicado. O filtro `OR` é o que impede o lead criado em campo de desaparecer da camada. |
| **Filtros de camada** | Maps | **P1** | `GMaps Avaliações > 100`, `Qualidade` preenchida, `Situação Cadastral = ATIVA`. A régua de "lead que importa". |

> Fora de escopo, registrados só para não serem redescobertos: os dois fluxos de Growth
> ("Menor preço nos últimos 30d", "Aniversário de 1º pedido") — §7.

## 1. Como ler

> ⭐ **A leitura mais importante deste doc: a maioria dos 🔴 não é requisito de fluxo — é sintoma de
> furo.** Vários workflows abaixo só existem porque uma capacidade que **deveria ser nativa** não
> funciona. Nesses casos o requisito do Praso Maps **não é o workflow**: é a capacidade funcionar
> **sem n8n**. Copiar o remendo para dentro do app seria **herdar o furo** — e o remendo é justamente
> a parte que ninguém garante que continua rodando.

Cinco destinos possíveis, e é isso que decide o que fazer com cada item:

- **Consumir** — o app lê o resultado do fluxo. O fluxo continua onde está, e está certo que continue.
- **Nativo** ⭐ — o n8n é **remendo**. O requisito é a capacidade existir do lado de tech, sem n8n.
- **Absorver** — o fluxo deixa de existir fora do app; a superfície do Praso Maps passa a ser o fluxo.
- **Reimplementar** — não é fluxo, é recurso do Salesforce (Maps) que o app perde ao sair dele.
- **A verificar / a decidir** — pode não ser necessário; a pergunta ainda está aberta.

**Criticidade:** 🔴 sem isso o app mente ou não existe · 🟡 degrada · ⚪ fora de escopo.
Nos itens **nativo**, a criticidade é **da capacidade**, não do workflow.

## 2. Fluxos que ALIMENTAM o pin

Sem esta camada não há pin — ou o pin existe e está errado.

| # | Fluxo | Onde | Crit. | O que quebra no Praso Maps | Ação |
|---|---|---|---|---|---|
| 1 | **CNPJá → Lead no Salesforce** | n8n | 🔴 | É a **origem de todo pin**. Alimenta `fonte_do_lead_c` e o degrau `cnpj` da escada de origem ([SPEC 00 §2.3](telas/spec-00-design-system.md)). **Está quebrado**: o lead mais recente criado pelo CNPJá é de **18/03/2026** (canal interno de suporte de dados, 14/07/2026). Sem ele a base de aquisição congela — o mapa fica bonito e velho. | consumir |
| 2 | **Situação cadastral + MEI** (`data.base_cnpjs_completa` → SF) | n8n | 🔴 | Grava `Situacao_Cadastral_Lead__c`, `Data_Situacao_Cadastral_Lead__c`, `Data_Atualizacao_Situacao_Cadastral_Lead__c`, `Optante_MEI_Lead__c`. É **literalmente o `WHERE` do snapshot** (`= 'ATIVA'`, `optante_mei_c = 'Não'` — [snapshot §1](snapshot-dado-real.md)). Sem ele o app mostra CNPJ baixado e MEI: as duas maiores queixas de "base poluída" do Diagnóstico. | **nativo** ⭐ |
| 3 | **`Atualiza Coordenadas Verificadas v3`** (Google Places API) | n8n | 🔴 | Grava `Latitude_Verificada_Lead__c` / `Longitude_Verificada_Lead__c` → alimenta o `geoVerificado` (2.110 de 6.914 pins). É a raiz de **85 das 213 críticas de Aquisição (40%)**: pin em centroide → check-in registrado como remoto. Loga em Sheets (3 abas) e **só grava se a coordenada nova estiver longe da atual**. | **nativo** ⭐ |
| 4 | **Fivetran: Salesforce → `salesforce.*` (MySQL db19)** | — | 🔴 | Não é n8n nem Flow, mas é o **único caminho** pelo qual o app vê dado hoje ([snapshot](snapshot-dado-real.md) lê daí). **Latência do Fivetran = latência do mapa.** Já mordeu: campo que existe no SF e não subiu na tabela (canal interno de suporte de dados, 24/07/2026). | consumir |
| 5 | **`Atualizar rank1 date`** (Metabase → SF) | n8n | 🟡 | Lê uma tabela no Metabase e grava no cliente: **data da última aquisição** + **tag do vendedor**. É atribuição — quem conquistou, e quando. No app alimenta "última aquisição" e a leitura de recência do pin. | **consumir — a verificar** |

### 2b. Por que #2 e #3 são "nativo", não "consumir"

**#2 — Situação cadastral + MEI.** Manter CNPJ baixado e MEI fora da base é **atualização de cadastro**,
não automação de crescimento. O requisito do Praso Maps é que exista um **fluxo de atualização do lado
de tech** mantendo esses campos vivos — o n8n hoje é quem faz, mas não deveria ser quem faz. Enquanto
for n8n, a régua do mapa (`ATIVA` · não-MEI) depende de um workflow fora do produto.

**#3 — Coordenadas verificadas.** Corrigir a posição de um pin é uma **função do sistema**, e o
Salesforce já tem a dela ("Definir local verificado", §6 #18). O requisito é que **o fluxo interno de
corrigir o pin funcione** — em Lead *e* em Account —, não que um workflow externo faça varredura em
lote via Google Places para compensar.

> ⚠️ **O buraco do #3, que a nativização é justamente o que resolve:** hoje o workflow existe **só para
> Lead**. A versão para Account (`Latitude_Verificada_Cobran_a__c`) está **pendente** — o **cliente
> cadastrado continua com pin torto**. E é justamente ele que a cor azul promete como "relação
> comercial existente" ([SPEC 00 §2.3](telas/spec-00-design-system.md)).

### 2c. #5 talvez não precise passar pelo Salesforce

O `rank1 date` **nasce no Metabase** e é escrito de volta no SF. Mas o Praso Maps também lê do
warehouse ([snapshot](snapshot-dado-real.md)) — então, para o app, o writeback é um desvio: ele pode ler
**na fonte**. Vale confirmar de onde vem a "tag do vendedor" (provável `prasoweb.account_executives.tag`)
e se alguém além do SF depende desse campo estar no SF.

## 3. Fluxos que movem o FUNIL e definem o DONO

Sem esta camada o pin existe, mas a **fase** dele — ou o **dono** dele — mente.

| # | Fluxo | Onde | Crit. | O que quebra no Praso Maps | Ação |
|---|---|---|---|---|---|
| 6 | **`Praso - Converter lead - V2`** | SF Flow | 🔴 | Conversão Lead → Account **pelo CNPJ**. Produz `is_converted` → `cadastrado`. **Sem CNPJ não converte** — e o pin criado em campo nasce sem CNPJ. | **nativo** ⭐ |
| 7 | **`Ajustar convertidos leads salesforce`** — **a cada minuto** | n8n | 🔴 | **Casa** lead com CNPJ ao Account correspondente e grava `status = 'Cadastrado'`. É o **matcher** da cadeia (§3b). | **nativo** ⭐ |
| 8 | **`Converter lead pelo status = cadastrado`** | SF Flow | 🔴 | Converte o lead a partir de `status = 'Cadastrado'` — **o segundo caminho de conversão**, e o que consome a saída do #7. | **nativo** ⭐ |
| 9 | **`Att Salesforce - Funil, Recorrentes, Churn`** (`XKeacoGayHnd5JGA`, ativo) | n8n | 🔴 | Escreve na **Account**, de hora em hora, via REST `PATCH` v62.0. É o produtor de `status_cliente`. **Requisito declarado: tem que existir para o Praso Maps também.** Detalhe em §3c. | **consumir — requisito** |
| 9b | **`Status Funil`** — braço B do mesmo workflow do #9 | n8n | 🔴 | Grava `Status_funil__c`: a **janela de 45 dias após a 1ª compra** para conquistar a 2ª e a 3ª (`Disponível 2ª` · `Disponível 3ª` · nulo). É o **único sinal do inventário que tem prazo** — e o próprio fluxo **apaga** quando a janela fecha. Detalhe em §3e. | **consumir — requisito** |
| 10 | **`Atualizar fase para desqualificado/perdido via Motivo`** | SF Flow | 🔴 | Preencher `motivo_desqualifica_o_c` / `motivo_perda_c` **move a fase** para desqualificado/perdido. ⚠️ **É um segundo caminho automático de funil** — ver contradição C1 (§8). | consumir |
| 11 | **Check-in → Task → apuração** | SF + query | 🟡 | A apuração vincula a atividade ao lead **ao vivo**: `LEFT JOIN salesforce.lead sl ON sl.id = st.who_id`. `sl.cnpj_c` reflete o valor **atual** — a task se vincula sozinha quando o CNPJ chega. O app precisa **espelhar** essa regra ([Tarefa](objetos/tarefa.md)). | consumir |
| 12 | **`Atualizar zona e vendedor-zona a partir do Maps assignment rule`** | SF Flow (+ **Maps**) | 🔴 | Define `zona_guardioes_c` e `vendedor_rota_lead_c` — **duas dimensões de filtro do app** e o **dono do pin** (cláusula do `WHERE` do snapshot; base de RLS e da Gerencial). ⚠️ **A regra de atribuição é do Salesforce Maps** — ver contradição C3 (§8). | **reimplementar** |

### 3b. A cadeia de conversão, e onde está o furo

Não são fluxos paralelos: são **elos**.

```
praso-web: customer criado
  └─ Customers::AfterCreateJob → SalesForce::CreateObjectsJob → SalesForce::Account.create
       (Account nasce por PUSH — apuração interna, 22/05/2026)

#7  n8n, a cada minuto: casa Lead ↔ Account por CNPJ  →  status = 'Cadastrado'
#8  SF Flow: converte o lead a partir de status = 'Cadastrado'
#6  SF Flow: converte o lead direto pelo CNPJ  (caminho alternativo; falha se não há CNPJ)
```

A Account **nasce certa**, por push. O que não fecha sozinho é o **casamento Lead ↔ Account** — e é
exatamente esse elo que o n8n preenche, varrendo a base de minuto em minuto.

> ⭐ **Requisito: que a conversão Shopify → Salesforce entregue o vínculo na origem, sem n8n.** Não é
> "portar os três" — é ter **um** caminho confiável em que o customer criado já chega com o lead de
> origem identificado. Um polling de 1 minuto é a assinatura de um vínculo que não vem na origem.
>
> Isso sustenta o `cadastrado` (**cor** do pin) e o `status_cliente` (**filtro**). Hoje **a cor do pin
> do Praso Maps depende de um cron de 1 minuto.**

### 3c. #9 dissecado — o produtor de `status_cliente`

Lido do JSON do workflow (30/07/2026). **Trigger:** `Schedule Trigger` com `interval.field = "hours"`
→ **de hora em hora** (não de minuto em minuto; isso é o #7). Dois braços independentes, ambos
`PATCH` em `Account`. Só faz `PATCH` no que **mudou** (`HAVING old <> new`).

**Braço A — `Status`** grava três campos na Account:

| Campo | Regra | Régua |
|---|---|---|
| **`Status__c`** ⭐ | sem pedido → `CSC` · >60d sem pedido → `Churn` · tem coorte e ≤60d → `Recorrente` · resto → `Funil` | **60 dias** |
| `Meses_Recorrente__c` | meses desde `cohort_since_last_rank_3`; nulo se >120d | **120 dias** |
| `Time_Responsavel__c` | `Inside` > `Externo` > `Orgânico`, por prioridade | janela do mês |

**Braço B — `Status Funil`** grava **`Status_funil__c`**, que é **outra coisa**: a janela de recompra
(`Disponível 2ª` se falta o rank2 · `Disponível 3ª` se falta o rank3 · nulo fora de 45 dias do rank1).
Confirmado no banco: só 196 + 79 preenchidos. **Não confundir com `Status__c`.**

**Chave de junção: `salesforce.account.id_praso_c` = `prasodata.customer.id`** — não é CNPJ. É por aí
que o snapshot terá que puxar a classificação.

Distribuição real de `Status__c` (111.906 accounts com `id_praso_c`, 30/07/2026):

| | Orgânico | Inside | Externo | nulo | **total** |
|---|---|---|---|---|---|
| **CSC** | 55.217 | — | — | 10 | **55.227** |
| **Churn** | 45.133 | 1 | — | — | **45.134** |
| **Recorrente** | 9.884 | 131 | 94 | — | **10.109** |
| **Funil** | 1.228 | 116 | 63 | — | **1.407** |
| nulo | — | — | — | 29 | **29** |

> ⚠️ **`Time_Responsavel__c` NÃO serve como dono do pin.** Só **157 accounts** são do `Externo`, e
> 99,6% são `Orgânico` — porque a regra olha `rank1_date`/`rank3_date` **do mês passado**. É atribuição
> do **ciclo corrente**, não posse. O dono do pin continua sendo `vendedor_rota_lead_c` (#12). São dois
> eixos diferentes, e trocar um pelo outro esvazia o mapa.

### 3e. #9b — o único sinal do inventário que tem PRAZO

Mora no mesmo arquivo de workflow do #9, mas é **outro fluxo**: credencial própria (`prasodata`), query
própria, campo próprio, nó de `PATCH` próprio. Compartilha só o gatilho.

**Fonte:** `comercial.regras_de_funil_2025`, junto por `r.customer_id = sa.id_praso_c`.
`rank1`/`rank2`/`rank3` são a **1ª, 2ª e 3ª compra**.

| Situação | `Status_funil__c` |
|---|---|
| ≤45d do `rank1`, sem `rank2` | `Disponível 2ª` |
| ≤45d do `rank1`, com `rank2` e sem `rank3` | `Disponível 3ª` |
| ≤45d do `rank1`, com `rank2` e `rank3` | nulo — fechou o funil |
| **>45d do `rank1`** | nulo — **venceu** |

> O segundo braço do `UNION ALL` existe **só para apagar**: quando a janela fecha, o fluxo limpa o campo.

> 🆕 **06/08 — este campo virou a FORMA DE UMA TELA, e isso eleva o aviso de "não cachear" a requisito estrutural.** O board de **Recorrência** do Funil ([[jornada-funil-aquisicao]] §5.2.1) tem como colunas **`Disponível 2ª` e `Disponível 3ª`** — ou seja, o Kanban da carteira **é** a superfície deste campo. Antes, cachear produziria uma prioridade errada; agora **congela o card numa coluna para sempre**. ⚠️ **E o efeito de apagar ficou visível:** quem vê a janela vencer sem fechar sai das duas colunas e **não** entra em `Recorrente` (não tem coorte) — some do board. É o buraco declarado em §5.2.1, cuja saída candidata é uma 5ª coluna com o nome que a operação já usa: **`Funil`**.

**Hoje:** 196 `Disponível 2ª` + 79 `Disponível 3ª` = **275 accounts**, de 449 clientes dentro da janela.

**Por que é importante — e diferente de tudo o resto do inventário:**

- Todo o resto descreve **estado** (`Churn`, `Recorrente`, `CSC`, fase, zona). Este descreve
  **oportunidade com data de vencimento**: *"comprou uma vez, e tem N dias para comprar de novo"*.
- É uma lista **pequena e quente** — 275 de 112 mil accounts. É trabalho do dia, não recorte de base.
- **Expira sozinho.** Quem consumir isso **não pode cachear nem recalcular por conta própria**, senão
  mostra oportunidade vencida. Tem que ler o campo, porque é o fluxo que decide quando ele morre.
- A query lê `r.vendedor` mas **não grava**. O campo diz *"está disponível"*, **não** *"é seu"* — a
  atribuição continua vindo de outro lugar (#12).

> ⚠️ **Fragilidade latente (não é bug hoje):** a query faz `GROUP BY r.customer_id` **sem agregação**, e
> a tabela **tem** múltiplas linhas por cliente (29.015 com 1 linha, ~9.700 com 2 ou mais). Hoje é
> inofensivo — dentro da janela de 45 dias **todos os 449 clientes têm exatamente 1 linha**, porque as
> linhas extras são ciclos antigos. Se um cliente passar a ter dois ciclos abertos ao mesmo tempo, o
> resultado vira arbitrário.

### 3d. Os 520 pins que dizem "Cadastrado" e não converteram

Consultado no banco (30/07/2026): **520 leads** com `is_converted = 0` **e** `status = 'Cadastrado'`.
Fatos, não interpretação:

- **todos os 520 têm CNPJ** (`sem_cnpj = 0` em todas as faixas);
- **todos os 520 têm Account casando por CNPJ** (520/520 no join normalizado);
- **29 estão parados há mais de 7 dias** — o mais antigo desde **25/05/2026** (66 dias).

O #7 (matcher) fez a parte dele: o `status` está lá. Quem não fecha é a **conversão**. Duas leituras
possíveis, e **não sei qual é**:

1. o #8 (`Converter lead pelo status = cadastrado`) **falha ou não alcança** esses registros; ou
2. a conversão é **intencionalmente evitada** porque a Account já nasceu por push do `praso-web`, e
   converter criaria duplicata — nesse caso o lead fica marcado e sobra.

Nos dois casos o efeito no Praso Maps é o mesmo: **são justamente esses os pins que a cor azul mostra
como "cliente" no modo real** (o README cita 177 dentro do recorte do snapshot). Ou seja, hoje o azul
do mapa real não é a base de clientes — é **o vão da cadeia de conversão**.

### 3f. #12 são DOIS passos, e a posse do território mora numa TABELA, não num fluxo

Mecanismo real (Tatiana, 30/07/2026), confirmado nos campos do banco:

```
1. PLANO DE ATRIBUIÇÃO (Salesforce Maps, em lote, só para pins NOVOS)
   casa o pin com a regra pelo polígono → escreve a REGRA no pin

2. FLUXO (Salesforce, disparado quando a regra é preenchida)
   lê a regra → escreve zona + vendedor no pin,
   usando o campo `Usuário` configurado NAQUELA regra
```

**O vendedor não é escolhido nem derivado de `user.zona_vendedor_c`: ele vem do campo `Usuário` da
regra de atribuição.** A tabela de regras do Maps **é** a tabela de posse de território — uma linha por
zona, cada uma apontando para um usuário (18 regras ativas em 30/07/2026).

**Os campos que carregam isso** (`salesforce.lead`):

| Campo | O que é | Estado no espelho |
|---|---|---|
| `maps_assignment_rule_vendedor_rota_lead_c` | **ID da regra** que atribuiu o pin | preenchido em **113.262** leads; **32** valores distintos; **0** casam com `user.id` — confirma que é regra, não usuário |
| `maps_assignment_rule_c` | a regra (campo "oficial") | ⚠️ **100% nulo** nos 136.924 leads |
| `vendedor_rota_lead_c` | usuário resultante — **o dono do pin** | 23 valores distintos |
| `zona_guardioes_c` | zona resultante | 19 valores distintos |

> 🔴 **`maps_assignment_rule_c` estar 100% nulo é caso concreto do risco do #4.** O campo existe no
> schema do espelho e nunca é populado — o mesmo sintoma relatado no suporte de dados (24/07): campo que
> existe no objeto do SF e não sobe na tabela. Quem for ler a atribuição no warehouse **tem que usar o
> `..._vendedor_rota_lead_c`**, não o campo de nome óbvio. Sem isso, a atribuição parece não existir.

**Por que a zona do pin e a do vendedor batem em 97,9%:** porque as duas saem da **mesma regra**. Medido
em leads não convertidos com vendedor (30/07/2026): 117.023 com vendedor, **114.569 (97,9%)** com
`zona_guardioes_c` igual ao `user.zona_vendedor_c` do dono; 1.379 (1,2%) divergentes; 368 com vendedor
sem zona cadastrada; 729 pins sem zona.

**O 1,2% tem explicação, e é estrutural:** o plano de atribuição roda **para pins novos**. Pin que já
tem regra não é reavaliado — então mudança de polígono, troca de vendedor numa zona ou zona nova
**não reatribuem o que já está atribuído**. A deriva não se corrige sozinha.

#### A taxonomia de zona é mantida em cinco lugares e já divergiu

| Fonte | Quantas zonas |
|---|---|
| Regras ativas no Maps (30/07) | **18** |
| IDs de regra vistos nos leads (inclui histórico) | **32** |
| `lead.zona_guardioes_c` | **19** |
| `user.zona_vendedor_c` | **17** |
| **Whitelist hardcoded do app** (`js/data.js:415`) | **15** |

As 4 zonas reais fora da whitelist do app: `CE Eusébio Guararapes` (280 leads), `PE Áreas Brancas`
(140), `CE Litoral Oeste` (2), `CE Aldeota Cumbuco` (1) — **423 leads, 0,37%**.

> ✅ **Isto não é bug do app.** O `js/data.js:425` já trata zona fora da lista como `Sem Zona` e diz
> explicitamente *"Nunca inventa zona"* — citando `CE Eusébio Guararapes` no próprio comentário. O
> comportamento é deliberado.
>
> ⚠️ **O problema é o mecanismo, não o resultado:** a lista de 15 é **hardcoded no app**, e a fonte de
> verdade é a tabela de regras do Maps. **Território novo = alteração de código + deploy.** E duas
> regras ativas (`PE Abreu e Lima`, `PE Camaragibe`) não aparecem em `zona_guardioes_c` nenhuma vez —
> ou são novas sem pins atribuídos, ou escrevem noutra coluna de zona (`zona_c`, `zona_2_c`, `zona_3_c`
> também existem). Não verificado.

> ⚠️ **Consequência para reimplementar (C3):** o que sai de cena com o Maps não é só o polígono — é a
> **tabela de posse de território**. No Praso Maps ela precisa ser **dado de primeira classe com tela de
> Admin** (zona → polígono → vendedor), mais o lote que estampa pin novo e o gatilho que propaga. Se a
> tabela não existir como dado, o app herda a deriva sem ter onde consertá-la, e não responde "por que
> esse pin é do vendedor errado?" — 3ª queixa mais frequente do Diagnóstico (34 críticas de "cliente
> fora de zona").

## 4. Fluxo de PLANEJAMENTO / supervisão

| # | Fluxo | Onde | Crit. | O que quebra no Praso Maps | Ação |
|---|---|---|---|---|---|
| 13 | **`Fluxo de validação planejamento`** (+ estampa a **data de validação** quando a validação é marcada) | SF Flow | 🔴 | É o **gate de supervisão**: o planejamento do vendedor só vale depois de validado, e o fluxo registra **quando**. O Praso Maps tem esse gate como capability própria — então aqui a superfície do app **substitui** a do SF. | **absorver** |

> Este item **não existia no inventário anterior** — é o primeiro fluxo mapeado que não é sobre o dado
> do pin, e sim sobre o **ritual de trabalho** em volta dele. A data de validação é o que permite
> distinguir "planejou" de "planejou e foi aprovado" — e sem ela a Gerencial não tem como cobrar o
> gate, só a existência do plano.

## 5. Fluxos de HIGIENE / saída de base

| # | Fluxo | Onde | Crit. | O que quebra no Praso Maps | Ação |
|---|---|---|---|---|---|
| 14 | **Sinalização de exclusão de base** → bot *Agente Comercial* num canal interno do externo | n8n | 🔴 | O vendedor sinaliza (EC fechado · CNPJ baixado · não-ICP · mudou de endereço) e cai ficha formatada no chat. Hoje é formulário + chat; no app seria o `desqualificar` do pin ([SPEC 07](telas/spec-07-atividades.md)). | **absorver — a confirmar** |
| 15 | **Duplicate Rule por CNPJ (Lead ↔ Account)** | SF nativo | 🔴 | Rede de segurança contra duplicata na criação em campo — bloqueia mesmo quando o vendedor não achou o registro no mapa por falta de coordenada. O "criar pin" do protótipo **não tem isso hoje**. | reimplementar |
| 16 | **Wishlist (planilha padrão → SF)** | n8n | 🟡 | Entrada de estabelecimento por indicação/lista, com template padronizado. Decidir se vira origem de pin ou fica fora. | a decidir |
| 17 | **Validação de WhatsApp / telefone → Supabase** | n8n + Colab | ⚪ | O app **dropou telefone** por minimização LGPD ([snapshot §2](snapshot-dado-real.md)). | **a verificar** |

### 5b. #14 pode simplesmente deixar de existir

O fluxo de sinalização é a superfície de um **modelo de retenção**: o vendedor olha a base dele, acha
o que está morto e pede para tirar. **Se o externo migrar de retenção para aquisição + recorrência, a
pergunta que o fluxo responde deixa de ser feita** — não há "minha base de churn para limpar", há
oportunidade para conquistar e cliente para manter comprando.

Então a ordem é: **decidir o modelo comercial antes de decidir o que fazer com este fluxo.** Absorvê-lo
agora é o risco de construir o `desqualificar` como porta principal de uma operação que está deixando
de existir. (O novo modelo comercial já roda no CE desde julho/2026 — planejamento interno.)

> ⚠️ E a colisão de regra continua de pé **se** ele for absorvido: a regra dura do projeto é que **não
> há exclusão, filtro apenas oculta** — e o fluxo, por definição, **remove** o estabelecimento da base.

### 5c. #17 talvez seja redundante

Vale **verificar se ainda é necessário**: já existe verificação de telefone **no momento em que o lead
é puxado do CNPJá**. Se a validação da origem for suficiente, o fluxo de WhatsApp + Colab + Supabase é
uma segunda passada no mesmo dado. Independente disso, o telefone **não entra no Praso Maps** (LGPD) —
o que está em jogo é se o fluxo deve continuar existindo, não se o app o consome.

## 6. Nativo do Salesforce Maps (não é fluxo, mas some junto)

| # | Recurso | O que faz | Ação |
|---|---|---|---|
| 18 | **"Definir local verificado"** | Captura o GPS do celular e reposiciona o pin, gravando lat/long verificada. Zero desenvolvimento no SF. ⚠️ **não funciona em pin de rota**. É a **versão nativa** do #3. | reimplementar |
| 19 | **Click2Create + filtro `OR` da camada** | Cria lead no ponto clicado com coordenada do GPS. O **filtro `OR`** impede o lead recém-criado de **desaparecer da camada** por falta de campos de qualificação. | reimplementar |
| 20 | **Filtros de camada** | `GMaps Avaliações > 100`, `Qualidade` preenchida, `Situação Cadastral = ATIVA`. É a régua de "lead que importa" — a mesma do [snapshot §1](snapshot-dado-real.md). | consumir |
| 21 | **Assignment rule de território** | Fonte da atribuição zona/vendedor que o #12 grava. **Sai de cena junto com o Maps** — ver C3 (§8). | reimplementar |

## 7. Fora do escopo do externo (registrar e ignorar)

| # | Fluxo | Onde |
|---|---|---|
| 22 | "Menor preço nos últimos 30d (preço caiu)" | n8n (Growth) |
| 23 | "Aniversário de 1º pedido na Praso (customer milestone)" | n8n (Growth) |

## 8. ⚠️ Contradições que este inventário abriu

Três afirmações em docs **já fechados** que a lista de 30/07 contradiz. Nenhuma é detalhe de
implementação — todas mudam contrato.

### C1 — "o `resultado` da tarefa é o **único** caminho automático de funil" é falso no sistema real

[docs/README.md](README.md) e [Tarefa](objetos/tarefa.md) afirmam exclusividade. Mas o #10
(`Atualizar fase para desqualificado/perdido via Motivo`) é um **segundo caminho automático**: preencher
o motivo move a fase, sem passar por tarefa nenhuma.

**A decidir:** o Praso Maps adota os dois caminhos (motivo também move a fase) ou mantém a exclusividade
e aceita que a fase no app divirja da fase no Salesforce? Manter a exclusividade **no papel** e não no
sistema é o pior dos três.

### C2 — ✅ RESOLVIDA: `churn` **tem** fonte; o snapshot é que não a alcança

[docs/README.md](README.md) registra que *"`churn` não tem fonte no `salesforce.lead` (não há compra nem
pedido lá)"* e por isso nasce vazio. **Está errado.** A fonte existe: é
**`salesforce.account.status_c`**, escrita de hora em hora pelo #9 (§3c) — 45.134 accounts em `Churn`
hoje. Como é **classificação de conta**, vive na Account, e o snapshot lê só `salesforce.lead`.

**A frase certa passa a ser:** *"o snapshot não lê o objeto onde o `status_cliente` vive"*. Consequências
concretas para [snapshot-dado-real.md](snapshot-dado-real.md):

- precisa de um **segundo `FROM`**: `salesforce.account`, juntando por **`id_praso_c`** (não por CNPJ);
- e precisa decidir se o universo de pins passa a incluir **Account**, porque hoje o `WHERE` tem
  `is_converted = 0` — o snapshot **não tem nenhum cliente de verdade** (ver §3d).

### C4 — o vocabulário de `status_cliente` está errado: é `Funil`, não `lead`

[Estabelecimento §5](objetos/estabelecimento.md) e a decisão de 29/07 definem `status_cliente` como
`lead` · `csc` · `recorrente` · `churn`. O que o #9 realmente grava é **`Funil` · `CSC` · `Recorrente` ·
`Churn`**. Não é sinônimo:

- **`Funil`** é cliente **sem coorte de recorrência e com pedido recente** — é gente que já comprou.
  O `lead` do app é o oposto: quem **nunca** comprou (`cadastrado = false`).
- Um pin que nunca foi cliente **não recebe `Status__c` nenhum** — o #9 só toca Account com
  `id_praso_c`, ou seja, só quem existe em `prasodata.customer`.

> 🆕 **03/08 — C4 ganhou um consumidor, e ele aponta para a resolução.** Os **sete tipos de visita**
> ([objetos/tarefa.md](objetos/tarefa.md) §4c) são derivados deste eixo e mapeiam **um para um** no
> vocabulário da operação: `Funil` → visita de **recorrência** · `Recorrente` → **expansão** ·
> `Churn` → **reaquisição** · `CSC` e lead → **follow-up**/**1ª visita** pela recência da visita.
> Ou seja: **é o vocabulário da operação que fecha com os tipos**, não o de 29/07 — o `Funil` do #9
> deixou de ser "um nome estranho" e passou a ser exatamente a população de um formulário. Isso reforça
> a primeira alternativa abaixo (adotar `Funil` e tratar `lead` como quinto balde derivado de
> `cadastrado = false`), e acrescenta um requisito que o C4 não tinha: o app precisa distinguir
> `Funil` de `Recorrente`, o que exige a **coorte** — não dá para derivar de `data_primeira_compra`.

**A decidir:** o app adota o vocabulário da operação (`Funil`) e trata `lead` como um **quinto** balde
derivado (`cadastrado = false`), ou renomeia. O que não pode continuar é o app chamar de `lead` uma
coisa que a operação chama de `Funil` — são populações diferentes, e a decisão de 29/07 dizia
explicitamente que o `status_cliente` chegava "com o vocabulário da operação".

### C5 — churn tem **duas réguas**, e a de 60 dias foi feita para o mapa

Dentro do próprio #9, o SQL traz este comentário:

> `-- Como aqui eu não uso pra virada de mês do externo, usei 60 em vez de 120 para poder usar como critério do mapa`

Ou seja: **`Status__c = 'Churn'` usa 60 dias, de propósito, para servir o mapa**, enquanto a apuração de
virada de mês do externo usa **120** — e o `Meses_Recorrente__c`, no mesmo fluxo, usa 120.

Isso **não é bug**, é escolha registrada. Mas é uma escolha que o Praso Maps herda sem saber: o mesmo
cliente pode ser `Churn` no mapa e não-churn na apuração, e as duas telas estarão certas. **Precisa
estar dito na SPEC**, senão vira contestação de vendedor — que é exatamente a categoria de problema que
o Diagnóstico mediu.

> 🆕 **03/08 — a escolha das duas réguas saiu do "precisa estar dito" para o "muda o que a tela pede".**
> A visita de **reaquisição** ([objetos/tarefa.md](objetos/tarefa.md) §4c) é definida como **4 meses sem
> comprar** — ou seja, a régua de **120**, a da apuração do externo, e **não** a de 60 que o `Status__c`
> usa para servir o mapa. Consequência direta: **`reaquisicao` ≠ `Status__c = 'Churn'`** — é um
> subconjunto, e ler o campo pronto faria o app abrir o formulário de reaquisição **~2 meses antes** do
> que a operação considera churn para efeito de meta. Quem implementar tem de escolher entre ler o campo
> (60) e recalcular de `data_ultima_compra` (120); o doc de Tarefa está escrito com **120** e marca a
> confirmação como pendente.

### C3 — zona e vendedor vêm de uma feature do Salesforce **Maps**

O #12 grava `zona_guardioes_c` e `vendedor_rota_lead_c` a partir do **assignment rule do Maps**. Ou
seja: **duas dimensões de filtro do app e o dono do pin dependem da ferramenta que o Praso Maps
substitui.** Não é "consumir um fluxo que continua rodando" — é uma capacidade que sai de cena.

Isso rebaixa o item de `consumir` para **`reimplementar`**, e levanta a pergunta de **onde mora a regra
de território** depois do Maps: no Praso Maps, num serviço de tech, ou continua no Maps só para isso?

## 9. Lacunas do inventário

- ✅ **Cobertura do externo** — fechada em 30/07: os fluxos nomeados pela Tatiana + os achados por busca
  cobrem o que o externo precisa. **Não** é o inventário completo da instância n8n, e isso é de propósito.
- ✅ **Objeto/campo do #9** — fechado: `salesforce.account.status_c`, join por `id_praso_c` (§3c, C2).
- ⏳ **Por que 520 leads travam em `status = 'Cadastrado'` sem converter** (§3d) — falha do #8 ou
  conversão evitada de propósito? São esses os pins que o azul mostra no modo real.
- ⏳ **Quem escreve `dias_saida_funil_c`** — não é o #9 (o JSON não toca nesse campo).
- ⏳ **Fluxo de apuração de aquisição** — a query de vínculo task→lead é conhecida (#11), mas **onde
  ela roda** (n8n? Metabase? Colab?) e com que periodicidade, não.
- ⏳ **Onde exatamente o casamento Lead↔Account falha** (§3b) — se é lead sem CNPJ, CNPJ divergente
  entre Shopify e SF, ou ordem de criação. Sem isso o requisito nº1 fica genérico.

## 10. O que virou requisito

Traduzindo o inventário em pedido, sem o vocabulário de fluxo:

1. **Conversão Shopify → Salesforce entregando o vínculo Lead↔Account na origem** (mata #6, #7, #8).
   Enquanto não existir, a **cor do pin do Praso Maps depende de um cron de 1 minuto**.
2. **Atualização de cadastro (situação cadastral, MEI) como rotina de tech** (mata #2). É o `WHERE`
   do mapa; não pode morar num workflow fora do produto.
3. **Correção de pin funcionando no sistema, para Lead *e* Account** (mata #3, cobre #18). Hoje só
   Lead tem correção em lote, e o pin do **cliente cadastrado** — o azul — é o pior posicionado.
4. **Status de cliente (`Funil` · `CSC` · `Recorrente` · `Churn`) existindo para o Praso Maps** (#9) —
   requisito declarado, e a fonte já existe (`account.status_c`). O que falta é do lado do app: **o
   snapshot passar a ler a Account** por `id_praso_c` (C2), **acertar o vocabulário** (C4) e **declarar
   a régua de 60 dias** (C5).
   - E junto dele: **a janela de 2ª/3ª compra (`Status_funil__c`) chegando ao app como campo lido,
     não recalculado** (#9b). É o único sinal com **prazo** do inventário, e quem o apaga é o fluxo —
     derivar por conta própria significa mostrar oportunidade vencida.
5. **Território como dado de primeira classe, fora do Salesforce Maps** (#12, #21, §3f). O que sai de
   cena com o Maps não é só o polígono — é a **tabela de posse** (zona → polígono → vendedor), que hoje
   *é* a tela de regras de atribuição. No app isso precisa de **tela de Admin**, mais o lote que estampa
   pin novo e o gatilho que propaga. Some a whitelist de 15 zonas **hardcoded** em `js/data.js:415`:
   hoje território novo exige deploy.
6. **Gate de validação de planejamento, com data** (#13) — absorvido pelo app.
7. **CNPJá → Lead voltando a rodar** (#1, parado desde 18/03/2026). Não é remendo: é a origem. E
   enquanto estiver parado, o app precisa **dizer isso como procedência**, não fingir base viva.
8. **Deduplicação por CNPJ na criação de pin** (#15) — o protótipo não tem.

E três perguntas que **não são de engenharia**:

- **Um caminho de funil ou dois?** (C1) — motivo move a fase, ou só o resultado da tarefa?
- **Qual modelo comercial?** Retenção vs. aquisição + recorrência decide se #14 é absorvido ou morre.
- **A validação de telefone é redundante?** (§5c)
