---
title: "Funil de Aquisição — os 3 tipos de check-in (CRM Externo / Praso Maps)"
tipo: jornada
fase: "Fase 2 — contrato dos estágios; formulários nesta fatia"
status: rascunho-editavel
sources:
  - "Notion — 'Tipos de check-in Atlas Praso' (Plataforma Externo › REVOPS), lido em 06/08/2026"
  - "Fluxo desenhado por Tatiana no Miro (06/08): Prospecção → Qualificação → Fechamento, com Ganho e Perdido/Congelado"
  - "docs/jornada-tipos-de-visita.md — os 7 tipos em 2 bandas; ESTE doc substitui a banda de aquisição"
related:
  - "[[jornada-tipos-de-visita]]"
  - "[[tarefa]]"
  - "[[estabelecimento]]"
  - "[[spec-06-funil]]"
  - "[[spec-07-atividades]]"
---

# Funil de Aquisição — os 3 tipos de check-in

> **Uma linha:** na banda de aquisição, o tipo de check-in **não é um rótulo por estado do ponto** — é o **estágio** em que o ponto está no funil, e ele **avança durante a própria visita**.
>
> ⭐ **A frase que muda o desenho todo** (OBS do doc do Notion): *"pode acontecer tudo em uma visita só: na primeira visita o vendedor já encontrar o TD e já fechar pedido."*

## 1. Os três estágios e os dois desfechos

```text
          sem visita há 90 dias / nunca
                      │
                      ▼
   ┌──────────────► PROSPECÇÃO ──── encontrou TD? ── não ──┐
   │                                      │               │
   │  visitado nos                       sim              └─ fica em prospecção
   │  últimos 90 dias:                    ▼
   │  VOLTA PARA           ┌────────► QUALIFICAÇÃO
   │  ONDE PAROU ──────────┤               │
   │                       │          TD quer comprar (mesma visita)
   │                       │          ou próxima visita já qualificada
   │                       │               ▼
   │                       └────────►  FECHAMENTO ──── vendeu? ── sim ──► 🟢 GANHO
   │                                       ▲                │
   │                                       │               não
   │                                       │                ▼
   │                                       └── não ── motivo é perda de mercado?
   │                                                        │
   └────────────────────────────────────────────────── sim ─┴──► 🔴 PERDIDO / CONGELADO
```

**Cada estágio é uma TELA.** Especificação do doc: *"se o vendedor passar por mais de um tipo no mesmo dia, cada um deve ser uma tela diferente, como se ele tivesse avançado de tela."*

## 2. Qual estágio abre o check-in

| Situação do ponto | Abre em |
|---|---|
| nunca visitado, **ou** sem visita nos **últimos 90 dias** | **Prospecção** |
| visitado nos últimos 90 dias | **volta para onde parou** — o estágio que o ponto já alcançou |

> ✅ **90 dias — DECIDIDO (Tatiana, 06/08).** A recência de **visita** é **90 dias**; os **120** ficam valendo só para a recência de **compra** (reaquisição).
> ⚠️ **E isto desfaz a simetria que [[jornada-tipos-de-visita]] §5 celebrava.** Estava escrito que *"4 meses é a régua do esquecimento e vale nos dois eixos"* — **não vale mais**: são **duas réguas diferentes**, 90 dias para visita e 120 para compra. A simetria era elegância, não requisito, e agora é só uma frase errada em outro doc — corrigida lá.

## 3. Os três estágios, em detalhe

> ✅ **Isto virou CONTRATO em 06/08:** campos, tipos, onde cada dado mora e os **4 vocabulários fechados** estão em [[tarefa]] §4d e nos *Vocabulários fechados* de §4. O que segue aqui é a jornada — a fonte, o porquê e o que ficou por confirmar.

### 3.1 🔍 Prospecção

- **Quando ocorre:** estabelecimento nunca visitado ou sem visita nos últimos 90 dias.
- **Objetivo:** conhecer o EC e **identificar o TD**.
- **Informações chave:**
  - **TD encontrado?** — checkbox
  - **Nome e contato do TD** — dois campos: **nome** e **telefone** *(⚠️ LGPD — §6, R6)*
  - **Melhor dia/hora para encontrar o TD** — dia da semana (todo dia · toda segunda e quarta…) + horário
- **Conclusão:** agendar próxima visita · dar perdido · desqualificar — **ou concluir sem marcar nada**.

### 3.2 🎯 Qualificação

- **Quando ocorre:** na visita de prospecção, **quando o vendedor marca que encontrou o TD**.
- **Objetivo:** conhecer o TD, entender **necessidades e condições**.
- **Informações chave** — `*` é obrigatório **para que a próxima visita seja de fechamento**:
  - **Confirmar nome e contato do TD** `*` — pré-preenchido com o que veio da prospecção
  - **SKUs mais comprados** `*`
  - **Preferência de marca** — opcional
  - **Fornecedores atuais** (distribuidor, Seasa…) `*`
  - **Potencial de compra** — opcional
- **Conclusão:** ir para **Fechamento** (a visita **vira** de fechamento e segue nas questões dele) · agendar próxima · perdido · desqualificar · nada.

> ⚖️ **Obrigatório não é barreira — é condição da PRÓXIMA visita.** Do doc: *"não barrar o vendedor de ir para a opção de fechamento se ele não preencher os campos obrigatórios de qualificação. Isso é só caso o vendedor não venda na mesma visita → a próxima só vai ser de fechamento se ele preencher."* Ou seja: quem vende na hora **não** é obrigado a nada; quem não vende só ganha uma visita de fechamento se deixou a qualificação pronta. **O `*` governa a derivação do próximo tipo, não o botão de concluir.**

### 3.3 🤝 Fechamento

- **Quando ocorre:** na visita de qualificação, quando o TD **já quer comprar** — ou na próxima visita, pós-qualificação.
- **Objetivo:** **fechar o pedido**.
- **Informações chave:**
  - **Vendeu?** — checkbox
  - **Motivo da não venda** — lista de opções
- **Conclusão:** agendar próxima visita · perdido · desqualificar · nada.

### 3.4 Os dois desfechos terminais

| Desfecho | Como se chega |
|---|---|
| 🟢 **Ganho** | `Vendeu? = sim` no Fechamento |
| 🔴 **Perdido** | o vendedor marca **Perda** e escolhe um dos 6 motivos abaixo |
| *(continua em Fechamento)* | não vendeu e **não** marcou perda — o ponto segue trabalhável, e o `motivo da não venda` explica o dia |

✅ **`Congelado` NÃO é estado novo — decidido em 06/08 (Tatiana): *"congelado é o mesmo que perdido, deixe perdido mesmo"*.** O desenho trazia `PERDIDO/CONGELADO` como um desfecho só, e agora está resolvido para o lado simples: **seguem existindo duas saídas laterais**, `perdido` e `desqualificado` ([[tarefa]] §5), sem terceira. Nada muda de cor, de enum ou de regra de volta.

✅ **E o gate *"motivo é perda de mercado?"* dissolveu.** Não há subconjunto de motivos "de mercado" que feche o ponto enquanto os outros o mantêm: **qualquer motivo de perda leva a Perdido**, e o que mantém o ponto em Fechamento é o vendedor **não marcar perda**. Isso reconcilia o desenho com o check-out que já existe ([[spec-07-atividades]] §3): *Perda* é uma caixa que se marca, e marcá-la **exige** motivo.

**Motivos de perda — confirmados em 06/08, e são exatamente os 6 que já estavam no contrato:**

| Valor | Rótulo |
|---|---|
| `preco_alto` | Preço |
| `sem_contato_efetivo` | Não consegui contato efetivo com o TD |
| `ja_tem_fornecedores` | Já tem fornecedores |
| `sem_mix_procurado` | Não temos o mix procurado |
| `sem_interesse` | Não tem interesse |
| `outro` | Outro *(exige texto)* |

> ✅ **Nada a mudar em [[tarefa]] §4:** a lista ditada bate valor por valor com o `motivo_perda` que a operação escreveu em 28/07. É a segunda vez que a mesma lista sai da operação sem consulta ao doc — bom sinal de que o vocabulário está estável.

## 4. Reaquisição não é um estágio — é um SABOR da qualificação

Do doc: *"se for qualificação de reaquisição…"*. A escada é **a mesma**; o que muda são duas coisas:

1. **Um painel de leitura, "Informações do cliente"**, que abre por cima e mostra: data do último pedido · SKUs comprados nos **últimos 3 pedidos** · botão para a página de pedidos (detalhe de cada um) · **crédito** e **prazo**. Também deve estar **no pin**, para o vendedor ver **antes** do check-in.
2. **Motivo do churn entra como informação chave, e é obrigatório.**

> 🔴 **Dependência declarada no próprio doc:** *"precisamos fazer o objeto pedido antes de andar aqui."* Sem [[pedido]] não há "últimos 3 pedidos" nem página de pedidos — então **este sabor está bloqueado** por um objeto que ainda não existe.
> ⭐ **E o motivo do churn continua sendo o dado mais valioso do conjunto:** ele não existe hoje em lugar nenhum — nem no ERP, nem no Salesforce.

## 5. O que o estágio faz com o funil do estabelecimento

Os três estágios **não são só tela** — eles são posição no funil, e o funil hoje é o `status` do [[estabelecimento]] ([[spec-06-funil]]):

| Estágio / desfecho | `status` do estabelecimento hoje | Situação |
|---|---|---|
| Prospecção | `visitado` | ✅ existe |
| Qualificação | `td_encontrado` | ✅ existe — a porta é a mesma (marcar TD) |
| **Fechamento** | — | 🔴 **não existe** — a escada vai de `td_encontrado` direto a `csc` |
| 🟢 Ganho | `csc` / `aquisicao` (vêm do **ERP**) | ⚠️ o campo declara a venda; o pedido é que promove |
| 🔴 Perdido / Congelado | `perdido` | ⚠️ e `congelado`? ver §3.4 |

> ✅ **Resolvido em 06/08 — e não com uma coluna nova, mas com um BOARD NOVO.** Ver §5.1.

### 5.1 O Kanban de aquisição — 6 colunas (decidido 06/08)

**A ordem, ditada:** 🔴 **Perdido** · 🔍 **Prospecção** · 🎯 **Qualificação** · 🤝 **Fechamento** · 🟢 **Aquisição** · ⛔ **Desqualificado**.

**A coluna Prospecção guarda TRÊS populações**, distinguidas por uma **tag no card**, filtrável:

| Tag | Quem está aí | `status` de hoje |
|---|---|---|
| **oportunidade** | a **piscina total** de oportunidades de aquisição — o ponto que ninguém tocou ainda | `sem_plano` |
| **planejada** | visita de aquisição **agendada** | `visita_planejada` |
| **prospectada** | visita de prospecção **realizada** que **não** passou para qualificação | `visitado` |

> 🔴 **Isto REVERTE a decisão de que "o funil é o pipeline, não a base"** — e é a mudança de maior alcance desta fatia. [[estabelecimento]] §5 e [[spec-06-funil]] §2 cravam que **`sem_plano` não tem coluna**, porque *"o ponto só aparece no board quando ganha uma visita planejada; a base vive no mapa e na Inteligência"*. Agora a piscina inteira entra em **Prospecção**.
> 📏 **O número que isso significa, para a decisão ser tomada com ele à vista:** no fictício são 61 pins; **no dado real são 6.914**, e quase todos são oportunidade de aquisição — ou seja, **a coluna Prospecção nasce com milhares de cards** e as outras cinco com dezenas. O board deixa de ser *"onde está meu trabalho"* e passa a ser *"a base, com meu trabalho nas 5 colunas da direita"*. **A mitigação é a tag + filtro**, e ela precisa vir junto, não depois.
> ⚖️ **O que se ganha, e é real:** hoje a piscina de aquisição **não tem superfície de funil nenhuma** — ela só existe no mapa e na Intel. Pôr a piscina como primeira coluna faz o board responder *"quanto da minha base ainda não foi tocada"*, que é a pergunta da liderança de aquisição.

**Quatro colunas de hoje deixam de existir**, e vale saber para onde cada uma foi:

| Coluna de hoje | Para onde vai |
|---|---|
| **Visita planejada** | vira a **tag `planejada`** dentro de Prospecção |
| **Visitado** | vira a **tag `prospectada`** dentro de Prospecção |
| **TD encontrado** | vira a coluna **Qualificação** (a porta é a mesma: marcar TD) |
| **CSC** | 🔴 **sai do board** — ver abaixo |

> ✅ **`csc` SAI do `status` — decidido em 06/08 (Tatiana).** *"Cadastrado sem compra"* **não é estágio de trabalho**: um CSC que não comprou continua sendo oportunidade de aquisição e vive em Prospecção, Qualificação ou Fechamento conforme o estágio dele. `csc` continua existindo onde sempre fez sentido — no booleano `cadastrado` e no enum **`status_cliente`** (`lead` · `csc` · `recorrente` · `churn`).
> ⚖️ **O ganho conceitual: o funil passa a codificar SÓ estágio de trabalho.** Cadastro é atributo do ponto, não posição na esteira — e misturar os dois era o que obrigava o board a ter uma coluna que ninguém trabalhava.
> 🔧 **O invariante precisa ser reescrito, e perde um lado.** Era `status ∈ {csc, aquisicao} ⟺ cadastrado` (bicondicional). Passa a ser **`status = aquisicao ⟹ cadastrado`** — só uma direção: quem comprou é cadastrado, mas nem todo cadastrado está em Aquisição. Muda em [[estabelecimento]] §5.

#### 5.1.1 O card: sai a qualidade, entram duas tags

✅ **Decidido em 06/08:** o **badge de qualidade do CNAE sai do card** (*"essa informação não é tão relevante"*), e no lugar entram **duas tags de naturezas diferentes**:

| Tag | Valores | Onde aparece | O que responde |
|---|---|---|---|
| **estágio** | `oportunidade` · `planejada` · `prospectada` | **só na coluna Prospecção** — as outras cinco não têm sub-população | *em que pé está dentro da piscina* |
| **`status_cliente`** | `lead` · `csc` · `recorrente` · `churn` | **em qualquer coluna** | *que relação este ponto tem com a Praso* |

> ⭐ **A tag de `status_cliente` faz o sabor de REAQUISIÇÃO aparecer no board, de graça.** Um card com tag **`churn`** em Prospecção ou Qualificação **é** a visita de reaquisição (§4) — o vendedor vê no board quem é ex-cliente antes de abrir o pin, e a liderança consegue filtrar *"quanto da minha piscina é gente que já comprou"*. Sem essa tag, ex-cliente e lead cru ficavam indistinguíveis na mesma coluna.
> ⭐ **E ela resolve o `csc` que acabou de sair da coluna:** o cadastrado sem compra deixa de ter coluna própria e passa a ser **visível como tag** onde quer que esteja trabalhando.
> ⚠️ **O que se perde com a saída da qualidade, declarado:** a coluna Prospecção nasce com milhares de cards, e a qualidade do CNAE era o único canal **no card** que dizia quais deles valem mais. A priorização passa a depender do **filtro** (o chip de qualidade segue na quickbar e no painel — [[spec-01-mapa]] §5), não da leitura de relance. Registrado porque, se a coluna ficar difícil de varrer, é aqui que se olha primeiro.

### 5.2 O Funil ganha DUAS abas: Aquisição e Recorrência (06/08)

✅ **Decidido:** a aba Funil passa a ter **dois boards**, num segmented control — **Aquisição** (as 6 colunas de §5.1) e **Recorrência**. É a resposta à pergunta que estava aberta sobre onde os 4 tipos da banda de recorrência viveriam: **num board próprio**, não espremidos no de aquisição.

**Por que isso resolve bem:** os dois boards respondem perguntas diferentes e têm naturezas diferentes — o de **aquisição** é uma **esteira** (o ponto avança de estágio pelo trabalho do vendedor), o de **recorrência** é um **retrato** (o cliente muda de coluna porque o *ERP* mudou, não porque alguém o arrastou). Misturar esteira e retrato num board só é o que fazia a coluna *Aquisição* ficar com todo cliente que já comprou, sem dizer nada sobre nenhum deles.

**E os dois se fecham num ciclo:**

```text
        ┌──────────── BOARD DE AQUISIÇÃO ────────────┐
        │  Perdido · Prospecção · Qualificação ·      │
        │  Fechamento · Aquisição · Desqualificado    │
        └──────┬───────────────────────────▲──────────┘
      🟢 ganhou│                            │ 120 dias sem comprar
       (1ª compra)                          │ (volta como oportunidade,
               ▼                            │  com a tag churn)
        ┌──────────── BOARD DE RECORRÊNCIA ──────────┐
        │  Recorrência · Relacionamento ·             │
        │  Expansão · Retenção                        │
        └─────────────────────────────────────────────┘
```

> ⚖️ **O board de recorrência é somente-leitura por natureza, e isso é uma vantagem.** As quatro colunas são **derivadas** do estado comercial ([[jornada-tipos-de-visita]] §2) — ninguém arrasta um card para *Expansão*, porque quem decide é o pedido. Então ele nasce sem a mecânica de arraste, sem as recusas de drop e sem o risco de alguém mover o funil com o dedo.
> ⚠️ **Um mesmo pin aparece nos DOIS boards, e isso não é bug.** Um cliente recorrente foi ganho na aquisição algum dia e hoje é retrato na recorrência. São duas perguntas — *"como foi conquistado"* × *"como está sendo mantido"* —, e o pin é um só ([[estabelecimento]]: o pin nunca se divide).

### 5.2.1 As colunas da Recorrência — e elas NÃO são os tipos de visita (06/08)

✅ **Decidido:** 🔴 **Perdido** · **Disponível 2ª** · **Disponível 3ª** · **Recorrente**.

⭐ **A escolha mais forte desta fatia, e vale dizer por quê:** essas colunas **não são invenção nossa** — são o funil de recompra que a operação **já mantém**, no campo `Status_funil__c` do fluxo `Status Funil` ([[fluxos-n8n-salesforce]] §3e). O board de recorrência passa a ser a **superfície de um dado que já existe**, em vez de mais uma taxonomia para manter. Hoje são **275 accounts** dentro da janela: 196 em `Disponível 2ª` e 79 em `Disponível 3ª`.

✅ **E a gramática de ordem ficou consistente nos dois boards: o estado de risco abre à esquerda.** *Perdido* na frente aqui e lá — não é progressão da esquerda para a direita, é *"o que eu perdi"* antes de *"o que eu tenho"*.

> ⚖️ **Coluna ≠ tipo de visita, e é de propósito** (*"diferente dos tipos de visita"*). A **coluna** diz **onde o cliente está** no funil de recompra da operação; o **tipo** diz **qual formulário abre** no check-out. São dois eixos, e o segundo é mais fino que o primeiro:

| Coluna do board | Tipo de visita que o check-out abre |
|---|---|
| **Disponível 2ª** | 🗓️ Recorrência |
| **Disponível 3ª** | 🗓️ Recorrência |
| **Recorrente** | 📈 Expansão · 🛡️ Retenção *(conforme comprou ou não no mês)* |
| **Perdido** | — *(saída lateral, sem visita)* |
| 🔴 **sem coluna** | 🤝 **Relacionamento** ← ver abaixo |

> 🔴 **Buraco novo, e é o mesmo de sempre: quem a janela deixou para trás não tem coluna.** O cliente que comprou 1 ou 2 vezes e **viu os 45 dias vencerem sem fechar** sai de `Disponível 2ª/3ª` — o próprio fluxo **apaga o campo** — e **não** entra em `Recorrente`, porque não tem coorte. Ele fica **fora das quatro colunas**. É exatamente a população para a qual o tipo **🤝 Relacionamento** foi criado ([[jornada-tipos-de-visita]] §1), então o tipo existe e a coluna não. **Duas saídas:** (a) uma 5ª coluna entre *Disponível 3ª* e *Recorrente* — candidata a se chamar **`Funil`**, que é como a operação já a chama ([[fluxos-n8n-salesforce]] §8, C4) — ou **Relacionamento**; (b) esses cards ficam **só no mapa e na Intel**, e o board assume que não os mostra. *(Recomendo (a): sem ela, o board de carteira esconde justamente quem esfriou — que é o que ele deveria denunciar.)*
>
> ⚖️ **`Recorrente` deve significar "fechou o ciclo", não "comprou nos últimos 60 dias".** O `Status__c` da operação usa **60 dias** para separar `Recorrente` de `Churn`, mas o app manda o cliente de volta à aquisição só aos **120** (§2). Se a coluna herdar os 60, quem está entre 60 e 120 dias **também fica sem coluna**. Definindo `Recorrente = tem coorte`, a recência sai da coluna e vai para o **tipo de visita** (expansão × retenção), que é onde ela já mora. Fecha o segundo buraco sem coluna nova.
>
> ⚠️ **A forma deste board depende de um campo que se apaga sozinho — e agora isso é estrutural.** `Status_funil__c` some quando os 45 dias vencem, por decisão do próprio fluxo. Já estava escrito que **não se pode cachear nem recalcular** ([[fluxos-n8n-salesforce]] §3e); antes isso valia para um sinal de prioridade, agora vale para **a coluna em que o card aparece**. Cachear congela cards em *Disponível 2ª* para sempre.
>
> 💡 **A mesma mecânica de tag da Prospecção serve aqui:** dentro de **Recorrente** convivem *expansão* e *retenção*, e **retenção é o sinal quente** ([[jornada-tipos-de-visita]] §4) — uma tag `retenção` no card evita que ele se perca numa coluna grande. É a sugestão, não decisão.

### 5.2.2 A coluna Aquisição: os ganhos do MÊS (06/08)

✅ **Decidido:** a coluna **Aquisição** do board 1 mostra as **aquisições do mês**, não todo cliente já conquistado. O board de aquisição é do **trabalho de aquisição**, e um ganho de 2023 não é trabalho de ninguém.

> ⚠️ **Consequência a declarar antes que alguém reporte como bug: a coluna esvazia no dia 1º.** É a única coluna do board com recorte de tempo — todas as outras mostram estado atual —, então na virada do mês ela zera e volta a encher. **É o comportamento pedido.** *(Mesma família do pico do dia 1º da retenção, [[jornada-tipos-de-visita]] §4 — mês de calendário produz degrau na virada.)*
> ⚖️ **E o pin não some do produto quando sai dela:** ele continua no board de **Recorrência**, que é onde a vida do cliente passa a ser contada. A coluna Aquisição vira o **placar do mês**, não o arquivo de conquistas.

✅ **`churn` só no board de aquisição — decidido.** Passados os 120 dias, o cliente **sai** da Recorrência e volta à piscina de Prospecção com a tag `churn`. Não há coluna de churn no board de carteira: dois lugares para o mesmo estado é o que esta fatia acabou de desfazer.

**Três consequências que caem junto, e nenhuma é cosmética:**

1. **Agendar deixa de "colocar o ponto no funil".** Ele já está lá, na piscina — agendar só troca a tag de `oportunidade` para `planejada`. Morre a frase do sheet (*"Agendar coloca {ponto} no funil, em Visita planejada"*, [[spec-07-atividades]] §2.1) e morre *"cancelar a última planejada tira o pin do board"*, que era **a única transição reversível do funil**. Ela continua reversível — só que agora volta a ser `oportunidade`, sem sair da tela.
2. **Arrastar para Qualificação e Fechamento deve ser RECUSADO**, pela mesma razão que já recusa CSC/Aquisição: esses estágios são **constatação de campo** (achou o TD, o TD quer comprar), e arrastar um card para Qualificação inventaria um TD que ninguém encontrou. Sobra o arraste para **Perdido** e **Desqualificado**, que já exigem motivo. ⚠️ Na prática **o board de aquisição fica quase todo somente-leitura** — e isso é coerente com *"`status` nunca é digitado"* ([[estabelecimento]] §8).
3. **A ordem começa por Perdido**, o que quebra a leitura de esteira da esquerda para a direita — num Kanban a progressão se lê nesse sentido, e um terminal na primeira posição é lido como início. Fica **como você ditou**; registro só para que a escolha seja consciente, e não uma surpresa quando o board estiver na tela.

> ⚖️ **A tag substituir o badge de qualidade do CNAE: cuidado, é justamente onde ela mais faz falta.** A ideia foi *"pode substituir pela tag de qualidade do CNAE"* — mas é a **qualidade** que torna uma coluna de milhares de cards priorizável (*quais desses são Ouro?*), e ela vira mais necessária, não menos, quando a piscina entra no board. **Sugestão:** manter as duas, com canais diferentes — a **tag de estágio como texto** e a **qualidade como a cor da borda do card** (o card já usa cor de status na borda, e o status agora é a própria coluna, então a borda ficou livre). Decisão sua; o que não recomendo é trocar uma pela outra.

## 6. Reconciliação — o que isto derruba do que já estava fechado

Lista honesta, porque duas destas decisões foram fechadas nesta semana e uma delas ontem.

| # | O que muda | Onde estava | Precisa de você? |
|---|---|---|---|
| **R1** | **Régua de visita: 90 dias**, não 120 — e a simetria *"4 meses nos dois eixos"* se desfaz | [[jornada-tipos-de-visita]] §5 | ✅ **decidido 06/08** — 90 |
| **R2** | **`tipo` deixa de ser UM valor por tarefa:** uma visita pode atravessar Prospecção → Qualificação → Fechamento, cada um em sua tela | [[tarefa]] §4c.3 | ✅ **decidido 06/08** — grava o **estágio mais fundo** |
| **R3** | **O tronco comum se redistribui:** `TD encontrado` passa a ser pergunta **da Prospecção**, `Vendeu?` e `motivo da não venda` **do Fechamento**. Não são mais perguntados em todo check-out | [[jornada-tipos-de-visita]] §6.2 · [[spec-07-atividades]] §3.2 | ⚠️ consequência em §7 |
| **R4** | **`primeira_visita` vira `prospeccao`**, e **`follow_up` dissolve** em *"volta para onde parou"* — o tipo passa a vir do **estágio**, não da recência | [[tarefa]] §4c.1 (tipos 1 e 2) | ✅ decorre do doc |
| **R5** | **`reaquisicao` deixa de ser tipo irmão** e vira **sabor da qualificação** (§4) | [[tarefa]] §4c.1 (tipo 3) | ✅ decorre do doc |
| **R6** | **Nome e telefone do TD** são pedidos como campo. A regra do repo é: **nome de pessoa física só com base legal, e NUNCA valor real no público** ([[estabelecimento]] §6 e §8) | os cartões diziam *"o cargo, nunca o nome"* | ⚠️ ver abaixo |
| **R7** | **`Congelado`** e o gate **"motivo é perda de mercado?"** | [[tarefa]] §4 (`motivo_perda`, 6 valores) | ✅ **decidido 06/08** — congelado **é** perdido; o gate dissolveu; os 6 motivos batem com o enum |
| **R8** | **Objeto [[pedido]] é dependência nova e declarada** | não existia no índice | ✅ registrado no índice |
| **R9** | **O board de aquisição tem 6 colunas** e a **piscina entra nele** (§5.1) | [[estabelecimento]] §5 · [[spec-06-funil]] | ✅ **decidido 06/08** — resta confirmar a saída de `csc` |

> ⚖️ **Sobre R6, e não é impedimento — é a regra que já existe.** O campo **pode** existir: contato de decisor em PJ é dado de contato profissional, e o modelo já prevê `decisor_nome`/`telefone`. O que a regra do repo proíbe é **valor real em ambiente público** — este repositório é público e a demo é pública, então nome e telefone do TD entram como **campo real no app** e **valor fictício no protótipo**. Ajustei os cartões: era *"o cargo, nunca o nome"*, e o certo é *"nome e telefone, fictícios enquanto público"*.
>
> ⚠️ **Sobre R3, a consequência que ninguém pediu:** o KPI *TD encontrado* da gerencial conta o **campo `td_encontrado` da tarefa** ([[spec-07-atividades]] §5.1). Se a pergunta só existe na tela de Prospecção, uma visita que **abre direto em Fechamento** nunca a responde — e o KPI passa a **subcontar**, embora o ponto tenha TD. **Sugestão:** `TD encontrado` vira fato do **pin** (o estágio alcançado), e a tarefa guarda *"foi nesta visita que se achou"*. São duas perguntas diferentes e hoje um campo só responde as duas.

## 7. Decisões — o que fechou em 06/08 e o que sobra

**✅ Fechadas (Tatiana, 06/08):**

- ✅ **R2 — a tarefa grava o ESTÁGIO MAIS FUNDO alcançado.** Uma visita que prospectou, qualificou e vendeu conta como **Fechamento**, uma linha só. A pivô *vendedor × tipo* continua somando 100% e o histórico segue sendo uma visita = uma tarefa.
  > ⚠️ **O preço, declarado:** a prospecção e a qualificação que aconteceram **dentro** dessa visita ficam **invisíveis** — a gerencial vai contar 1 fechamento e 0 prospecções num dia em que houve as três coisas. Some com isso a resposta a *"quantas prospecções o time fez no mês?"*, que passa a ser *"quantas visitas PARARAM em prospecção"*. ⛔ **Não adotado:** o campo à parte com a lista de estágios percorridos, que eu havia recomendado — fica registrado como a saída, se um dia a pergunta acima for feita.
- ✅ **R1 — 90 dias** para a recência de visita (e 120 seguem só para compra).
- ✅ **R7 — `Congelado` é `perdido`**, o gate de "perda de mercado" dissolveu, e os 6 motivos são os que já estavam no contrato.
- ✅ **R9 — o board de aquisição tem 6 colunas** e a piscina entra em Prospecção com tag (§5.1).

- ✅ **`csc` sai do `status`** e vive em `cadastrado` + `status_cliente`; o invariante vira **unidirecional** (§5.1).
- ✅ **O badge de qualidade sai do card**, e entram as tags de **estágio** e de **`status_cliente`** (§5.1.1).
- ✅ **A banda de recorrência ganha ABA PRÓPRIA dentro do Funil** (§5.2) — dois boards, esteira e retrato.

- ✅ **Colunas da Recorrência:** *Perdido · Disponível 2ª · Disponível 3ª · Recorrente* — o funil de recompra **que a operação já mantém**, não uma taxonomia nova (§5.2.1). Gramática de ordem confirmada nos dois boards: **o estado de risco abre à esquerda**.
- ✅ **Coluna `Aquisição` = ganhos do MÊS** (§5.2.2), e ela **zera no dia 1º** — comportamento pedido.
- ✅ **`churn` só no board de aquisição** (§5.2.2).
- ✅ **`tipo` da tarefa e coluna do funil NÃO são a mesma coisa** — dois campos, dois eixos. O **pin** guarda o **estágio** (a coluna); a **tarefa** guarda o **tipo**, que é o estágio mais fundo alcançado *naquela visita*. Respondem *"onde ele está"* × *"até onde cheguei hoje"*, e é por isso que a mesma coluna pode abrir formulários diferentes (§5.2.1).

**🔴 O que sobra:**

- [ ] **A 5ª coluna da Recorrência** — quem viu a janela de 45 dias vencer sem fechar hoje fica **sem coluna nenhuma**, e é justamente a população do tipo 🤝 **Relacionamento**. Criar a coluna (candidatos: **`Funil`**, o nome da operação, ou **Relacionamento**) ou assumir que o board não mostra essa gente? *(Recomendo criar — §5.2.1.)*
- [ ] **`Recorrente` = "tem coorte" ou = `Status__c = Recorrente` (≤60 dias)?** Se herdar os 60, quem está entre 60 e 120 dias também fica sem coluna. *(Recomendo "tem coorte" — §5.2.1.)*
- [ ] **Tag `retenção` dentro da coluna Recorrente?** Mesma mecânica da Prospecção, para o sinal quente não se perder numa coluna grande (§5.2.1).
- ✅ **Os campos dos três estágios viraram contrato** em [[tarefa]] §4d, com os vocabulários fechados. **Duas confirmações fecharam em 06/08:** *"Seasa"* **é CEASA**, e `fornecedores_atuais` ficou em **5 valores** (`distribuidor · ceasa · atacarejo · industria · outro`); `skus_mais_comprados` virou **texto livre** — a lista de categorias que eu propus foi recusada, porque SKU é granularidade de produto e a lista respondia outra pergunta.
- ✅ **`potencial_compra` fica com faixas próprias** (`ate_1k` → `acima_50k` + `nao_sei`). ⛔ Recusado reusar o `faixa_faturamento_c` do Salesforce — e **a recusa corrige um erro meu**: não é a mesma grandeza. Aquele campo é o **faturamento do EC**; este é **quanto ele compraria da Praso**. Reusar teria conflatado receita do cliente com potencial de venda ([[tarefa]] §4d.4).
- [ ] **`fornecedores_atuais` não tem valor para "não compra de ninguém"** — e o campo é obrigatório para liberar o Fechamento, então esse EC (o mais fácil de converter) travaria na qualificação. Escape declarado hoje: marcar **`outro`**, aceitando que ele passe a significar duas coisas ([[tarefa]] §4).
- [ ] **`motivo_churn` é um invariante com uma metade só.** A obrigatoriedade depende de o **pin** ser reaquisição, e `CHECK` de tabela não enxerga o pin — então ele vive só na função pura, contra a regra de que *"invariante existe duas vezes"*. Aceitar assim, ou fazer por **trigger**? ([[tarefa]] §4d.3)
