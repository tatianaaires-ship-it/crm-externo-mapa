---
title: "SPEC 07 — Atividades (CRM Externo / Praso Maps)"
tipo: design-spec
herda: "spec-00-design-system"
fase: "Fase 2 (casca) — motor na Fase 3/4/5"
status: em-revisao
fonte_de_verdade: "js/atividades.js (aba) + js/state.js (tarefas e rotas) + js/pin.js (bloco e as 5 telas do sheet: pin, lista, detalhe, conclusão, agendar) + js/data.js (seed em rotas) — implementado 27–28/07. ✅ Não há mais window.prompt em nenhum fluxo: o §3 (conclusão) e o §2.1 (agendar) viraram sheets em 28/07."
sources:
  - "_bmad-output/specs/spec-crm-externo/SPEC.md — CAP-11 (atividade no pin) · CAP-12 (aba) · CAP-13 (visão gerencial) · CAP-14 (desqualificar) · CAP-6 revisada"
  - "docs/objetos/tarefa.md — campos, enums, tabela resultado→funil, requalificação"
  - "KR 1.5 — Notion, Fase 2 item 8 · Fase 3 itens 4, 5 e 6"
related:
  - "[[spec-00-design-system]]"
  - "[[spec-06-funil]]"
  - "[[spec-02-pin-sheet]]"
  - "[[tarefa]]"
  - "[[rota]]"
  - "[[estabelecimento]]"
---

# SPEC 07 — Atividades

> 🎯 **Objetivo.** A superfície da **[[tarefa]]** — a atividade datada onde **check-in/out é a própria tarefa**. Cobre o **bloco de atividades dentro do pin** (CAP-11), a **aba Atividades** com a agenda do vendedor (CAP-12), a **visão gerencial** (CAP-13) — que absorveu a lista de realizadas — e o fluxo de **desqualificar** (CAP-14). **Herda o [[spec-00-design-system]]** — tokens, shell e componentes não se repetem aqui.

> 🧩 **Casca × motor.** **Casca (Fase 2):** criar, agendar, fazer check-in/out, registrar resultado + motivo, desqualificar/requalificar, listar e agregar — **tudo em memória**. **Motor (depois):** persistência + auth/RLS (Fase 4) · SLA/tempo em etapa (Fase 4) · proximidade GPS e fotos (Fase 3/4) · calendário externo (Fase 3) · recorrência automática (Fase 5).

> ⚖️ **Esta spec é dona de toda a superfície de Tarefa**, inclusive do bloco dentro do pin. A [[spec-02-pin-sheet]] (a fazer) **referencia** §2 em vez de redescrever — o objeto é um só, e a 02 não deve nascer com um buraco esperando a 07.

## 1. As três superfícies

| Superfície | CAP | Quem usa | Onde |
|---|---|---|---|
| **Bloco de atividades no sheet do pin** | 11 · 14 | vendedor | dentro do pin-sheet (SPEC 00 §6.7) |
| **Aba Atividades** — a agenda (o que falta fazer) | 12 | vendedor | 4ª aba, cobre o mapa (z 25) |
| **Visão gerencial** | 13 | **liderança** | sub-visão da aba Atividades |

**Uma coleção só** alimenta as três ([[tarefa]] §2): a agenda é o recorte `status = planejada`, as realizadas e a gerencial são `status = realizada`. Não há dado duplicado entre superfícies.

## 2. Bloco de atividades no sheet do pin (CAP-11)

Bloco no pin-sheet, **abaixo das notas** — as notas seguem sempre visíveis (CAP-3, invariante). Estrutura: **botão de ação** → **histórico (3 últimas)** → **`Ver todas`**. Título do bloco é só `Atividades`: o lembrete *"check-in é a tarefa"* saiu (28/07) — é regra de modelo ([[tarefa]] §2), não legenda de tela, e quem usa o app não precisa dela.

> ⚖️ **A atividade planejada não aparece no bloco** (28/07). O botão de check-in **é** ela — mesma tarefa, e mostrar as duas coisas dizia o mesmo duas vezes num bloco que já briga por altura com as notas. O bloco ficou com duas perguntas só: **o que fazer agora** (botão) e **o que já foi feito** (lista). A planejada segue com detalhe próprio, pela tela de todas as atividades (§2.2) — que passa a contá-la como escondida, e por isso o botão `Ver todas` aparece sempre que houver planejada.
>
> **Preço aceito:** o badge `Atrasada` sumiu do sheet do pin. A dívida vencida continua visível no **detalhe da atividade** (§2.2) e na **tabela da gerencial** (§5.4), mas quem abre só o pin não vê mais que o compromisso venceu. ⚠️ **O preço subiu em 28/07:** o bloco fixo da Agenda, que era a outra porta, também saiu (§4.2) — sobraram duas telas mais fundas.

- **`📍 Check-in` existe em TODO pin** — não é preciso plano para visitar (§2.3). Ele é o **primário e é um toque só**; `＋ Agendar` fica ao lado como **secundário** (visitar agora e planejar depois são intenções diferentes). Com visita em andamento (`checkin_em` preenchido, `checkout_em` nulo), o primário vira **`⏱️ Check-out`** (abre §3) — é assim que o sheet mostra que há check-in aberto, junto de uma faixa verde com a hora do check-in.
- **O `tipo` da visita NÃO é escolhido aqui** (28/07). Ele vive no **sheet de conclusão** (§3) — ou no sheet de agendar (§2.1), se o caminho for planejar.
- **Histórico — as 3 últimas**, cada uma clicável, mais recente primeiro: emoji do tipo · data · `resultado` (com cor) · duração. Deriva das tarefas, não de `pin.checkins`. Abaixo, **`Ver todas as atividades (N) ›`** quando houver alguma que a tela não mostra (a conta inclui o banner da próxima, não só as realizadas).

> ⚖️ **Por que 3 e não todas.** Um ponto de recorrência acumula dezenas de atividades; a lista inteira empurrava as **notas** — que a CAP-3 obriga a manter sempre visíveis — para fora da tela. O bloco vira um resumo, e a lista completa ganha tela própria.

> **`Concluir sem check-in` saiu do pin** (28/07) — e depois **deixou de existir**. ⚠️ **A atividade remota não é "concluir sem check-in"**: é o check-in feito **longe do pin** ([[tarefa]] §5). Sem check-in nenhum a atividade fica **não realizada**, e `tipo_checkin` é nulo. Então não há botão faltando: qualquer check-in produz `remoto` quando a distância passa do raio, sem tela nova.

### 2.2 Lista e detalhe: as outras duas telas do sheet

O sheet do pin tem **cinco telas**, não cinco lugares — tudo dentro do mesmo bottom sheet, com voltar, porque sair do sheet tiraria o vendedor do contexto do ponto:

1. **Pin** — o que já existia, com o histórico enxugado a 3.
2. **Lista** (`Ver todas ›`) — todas as atividades do ponto, em dois grupos: **Planejadas** e **Realizadas**. Cabeçalho com voltar, título `Atividades` e o **nome do ponto** por baixo, para não se perder de quem é a lista.
3. **Detalhe** (toque numa atividade) — a ficha da [[tarefa]]: data · situação · responsável · **rota** · tipo de check-in · check-in/check-out com duração · **distância no check-in** · resultado · motivo · próxima ação · comentário.
4. **Conclusão** (§3) — o check-out. Entra pelo botão do pin **ou** pelo detalhe da atividade, e volta para a tela do pin ao concluir.
5. **Agendar** (§2.1) — o plano. Entra pelo `＋ Agendar` do bloco e volta ao pin.

> ⚖️ **As duas telas de formulário nasceram em 28/07 e mataram os seis `window.prompt` da fatia.** Elas compartilham o padrão `.sform-*` ([[spec-00-design-system]] §6.7.2): label caixa-alta + `obrigatório`/`opcional` em `em` minúsculo, chips para escolha fechada, inputs nativos a 16px, e **botão que diz o que falta** em vez de recusar depois do toque.

- **Ações vivem só no detalhe de atividade aberta** (`Check-in`/`Check-out` + `Cancelar atividade`), e operam sobre **aquela** tarefa — não sobre "a próxima do pin". Atividade realizada é **registro, não formulário**: nenhum botão.
- Cancelar a última planejada avisa que o pin **sai do funil** e volta à lista (§2.1).
- Toda tela nova começa **do topo**; abrir um pin sempre volta para a tela 1.

> ✅ **O botão de check-in mudou de significado, não de lugar — e isso está implementado (28/07).** Antes ele gravava um par `{in, out}` solto no pin; agora opera sobre uma **tarefa**, criando uma na hora quando não há planejada. É a CAP-6 revisada, detalhada em §2.3.

### 2.1 Agendar visita (sheet)

> ✅ **É um sheet desde 28/07** — a **5ª tela do pin-sheet**, no mesmo molde do sheet de conclusão (§3), porque é o mesmo tipo de tarefa cognitiva: poucos campos, escolha fechada em chips, um botão que diz o que falta. Eram três `window.prompt`, a **última pendência de UI da fatia**. Com isto, **não há mais `window.prompt` em nenhum fluxo do app**.

Pede **só o que é digitado**, nesta ordem:

| Campo | Obrig. | Nota |
|---|---|---|
| **Tipo da visita** | sim | 3 chips, **pré-marcado** pela mesma sugestão do check-in ([[tarefa]] §5) — o histórico já diz que visita é essa |
| **Dia** | **sim** | `input[type=date]` nativo, default **hoje**, com `min = hoje` |
| **Hora** | não | `input[type=time]` nativo. Sem hora, a visita entra como **dia inteiro** no topo do dia (§4.2) — e o hint diz isso |
| **Anotação** | não | é **o único texto que o card da Agenda mostra**, e o hint avisa. Vira `tarefa.notas` |

`responsavel_id` **não aparece** — é derivado ([[tarefa]] §5). `estabelecimento_id` vem do pin. A tarefa nasce **avulsa** (`rota_id` null), porque montar rota é outro fluxo (§4.2).

> ⚖️ **Não se agenda para o passado.** `min = hoje` no campo, e o botão vira `O dia já passou` se alguém digitar uma data vencida. O motivo não é purismo: uma planejada em data passada **não apareceria na Agenda** (que mostra de hoje em diante — §4.2), então o vendedor criaria um compromisso invisível.
>
> ⚖️ **O sheet diz o que agendar faz ao funil**, na linha antes do botão: *"Agendar coloca {ponto} no funil, em Visita planejada"* — ou, se já houver plano, quantas planejadas o ponto tem. Quem está a um toque de mexer no board deve saber disso **antes** do toque, não descobrir pelo Funil depois.

> ⚖️ **Agendar já move o funil.** Criar a atividade promove o pin de `sem_plano` para **Visita planejada** — é assim que ele **entra no board** do Funil ([[estabelecimento]] §5). **Cancelar** a última atividade planejada devolve o pin a `sem_plano` e ele sai do board. É a única transição reversível do funil, e vale confirmar no cancelamento por isso.

### 2.3 Check-in em qualquer pin, com o tipo já sugerido (CAP-6 revisada)

**O vendedor não precisa de plano para visitar.** Passou na porta, entrou: o `📍 Check-in` aparece em **todo** pin, e quando não há atividade planejada ele **cria a tarefa na hora**, datada de hoje. Era o que a CAP-6 revisada previa desde 27/07 e o que este doc já descrevia como comportamento futuro do botão; até 28/07 o pin **sem plano** oferecia apenas `＋ Agendar`, o que obrigava a planejar uma visita que já estava acontecendo.

**Sobre qual tarefa o check-in age:**

| Situação do pin | O que acontece |
|---|---|
| planejada para **hoje** ou **atrasada** | o check-in é **nela** — é a mesma visita; criar outra duplicaria o compromisso |
| só planejada **futura** | **nasce uma tarefa de hoje** e o plano futuro **fica de pé**, intacto |
| **nenhuma** planejada | nasce uma tarefa de hoje |

> ⚖️ **Não se reescreve a data do plano.** Fazer check-in hoje num ponto que tem visita marcada para sexta poderia "puxar" o plano de sexta para hoje — mas isso é decidir pelo vendedor que aquele compromisso morreu. A visita de hoje é um fato novo; o plano de sexta continua e ele cancela se quiser.
>
> ⚖️ **A tarefa ATRASADA, sim, vem para hoje.** Em planejada a `data` é quando se pretende ir; em realizada é **quando aconteceu**, e é dela que saem a tabela e os gráficos por dia. Check-in hoje numa tarefa de ontem mantendo a data velha poria a visita no dia errado, com `checkin_em` de hoje na coluna ao lado — dado que se contradiz na mesma linha.
>
> ⚖️ **Uma atividade aberta por pin** continua valendo: com check-in em curso, o botão é `Check-out` e não há como abrir outra.

**O check-in é um toque só, e o tipo se decide no fim.** A tarefa nasce com o tipo **sugerido** pelo histórico (`CRM_DATA.sugereTipoVisita`) e o vendedor **confirma ou corrige no sheet de conclusão** (§3):

| Histórico do ponto | Sugestão |
|---|---|
| nunca visitado | **1ª visita** |
| cliente (CSC ou Aquisição) | **Recorrência** — é o tipo que existe para isso |
| visitado, ainda não cliente | **Follow-up** |

> ⚖️ **Os chips de tipo estiveram no pin, acima do botão, por uma hora** (28/07) — e saíram: **quem está entrando na porta do cliente não para para classificar a visita**. Pior, no check-in ele ainda não sabe o que a visita vai ser; no check-out sabe. Então o campo foi para onde a informação existe, e o check-in voltou a ser um gesto único. Se o caminho for **planejar** em vez de visitar, o tipo é pedido no sheet de agendar (§2.1) — que é o outro momento em que se sabe o propósito.
>
> **Sugestão ≠ classificação derivada.** `tipo` segue sendo campo digitado ([[tarefa]] §4) — o que a regra faz é preencher bem o default para que confirmar seja o caso comum. Isso não fere *"classificação nunca é digitada"*, que vale para `qualidade`/`porte`/`origem_confianca`/`status`.
>
> **A janela de edição é a mesma:** o tipo só muda enquanto a tarefa é `planejada`, e o check-out é o último instante dessa janela. Depois dele a atividade é **registro, não formulário** (§9).

## 3. Check-out: o fluxo-assinatura (CAP-11 · CAP-14)

> ✅ **É um sheet de verdade desde 28/07.** Eram três `window.prompt` em sequência — a mecânica estava certa, mas a apresentação não era a desta spec, e era a coisa mais feia do protótipo. Virou a **4ª tela do pin-sheet** (§2.2): mesmo bottom sheet, com voltar, sem tirar o vendedor do contexto do ponto. **O gatilho foi pedir o `tipo` aqui** — não havia formulário onde pôr o campo.

O momento em que a atividade **vira dado** e o funil se move. Quatro campos, nesta ordem:

0. **Tipo da visita** — pré-marcado com o que a tarefa já tem (do plano ou da sugestão). É aqui que o vendedor confirma **o que a visita foi**, porque agora ele sabe (§2.3).

1. **Resultado** — 4 opções, uma escolha obrigatória. O chip ativo **veste a cor do resultado** — a mesma que pinta o pin e o gráfico, porque a cor segue a entidade ([[spec-00-design-system]] §6.13):

| Opção | Efeito no pin |
|---|---|
| **Sem avanço** | → Visitado |
| **TD (tomador de decisão) encontrado** | → TD encontrado |
| **Perdido** | → Perdido (guarda a etapa de origem) |
| **Desqualificar** | → Desqualificado (guarda a etapa de origem) |

> ⚖️ **Não há "Convertido" no check-out.** Conversão não é fato de campo — o vendedor não decide que alguém virou cliente. **CSC** (cadastrado sem compra) e **Aquisição** são derivados do **ERP** (cadastro e pedido) e **prevalecem** sobre a tarefa: quem tem pedido está em Aquisição mesmo que a última atividade tenha dado `Perdido`. Ver [[estabelecimento]] §5.

2. **Motivo** — aparece **só** para `Perdido` e `Desqualificar`, com o vocabulário fechado do respectivo enum ([[tarefa]] §4); `outro` revela o campo de texto. **Não dá pra concluir sem motivo** nesses dois casos.
3. **Próxima ação** (opcional, sempre visível): texto de uma linha + data. ⚠️ **Deixou de alimentar a Agenda em 28/07** (§4.2) — sugestão dentro de um calendário lê como compromisso marcado. Continua no registro da atividade e na tabela da gerencial, e **nunca virou tarefa**.

**O botão diz o que falta.** Enquanto o formulário está incompleto ele fica desabilitado e o rótulo é a instrução — `Escolha o resultado` → `Escolha o motivo` → `Descreva o motivo` → `✓ Concluir atividade`. Botão que recusa em silêncio faz o usuário achar que a tela travou; e validação que só aparece **depois** do toque obriga a errar primeiro.

- **Trocar o resultado zera o motivo.** O vocabulário de `perdido` não é o de `desqualificado` ([[tarefa]] §4) — manter a escolha anterior guardaria um motivo do enum errado.
- **`outro` mostra o texto no pin, não a palavra "Outro".** O `motivo_status` do estabelecimento passa a exibir o que o vendedor escreveu — "Outro" não informa nada a quem abre o pin depois.
- **O sheet só abre com check-in aberto.** Sem presença registrada não há o que concluir ([[tarefa]] §5), então não existe estado "concluir sem check-in" nesta tela. Quando o check-in foi feito **longe do pin**, a faixa do topo diz `remoto (1,2 km do pin)` — o vendedor fica sabendo como a visita vai ser classificada **antes** de fechar, não depois, na coluna da gerencial.
- **A saída lateral se explica aqui**, não só no pin: se o ponto está `perdido`/`desqualificado`, o sheet diz para onde ele volta ao concluir (§3.1). É neste instante que a decisão é tomada.
- **Interação delegada, não por elemento.** A tela se re-renderiza a cada toque (o campo de motivo depende do resultado), então listener anexado a chip é listener em nó que morre no próximo render — um `click`/`input` só, no sheet, e o `data-*` diz qual campo mudou. Texto e data **não** re-renderizam: refazer o HTML a cada tecla tiraria o foco do campo.

Ao confirmar: `checkout_em`, `status = realizada`, o pin se move pela tabela acima, `ultima_visita` atualiza e `origem_confianca` sobe para `validado_campo`. O **mapa, o Funil e a Inteligência refletem na hora** (mesmo pipeline `emit → reapply → refresh` da SPEC 06 §4).

### 3.1 As duas saídas laterais: Perdido e Desqualificado (CAP-14)

`Perdido` e `Desqualificado` têm **a mesma mecânica** — a diferença vive no **motivo**, não no encanamento (negociação morreu × o ponto não é oportunidade).

- **Não existe botão solto no pin** para nenhum dos dois — a única porta é o resultado do check-out. Constatação de campo tem autor e data.
- O pin **continua no mapa**, com a aparência do estado; o **filtro apenas oculta**. Nunca some.
- **Voltar** = concluir uma nova atividade nesse pin. Ao confirmar, `status_anterior` é restaurado e o novo `resultado` se aplica em cima. O sheet avisa: *"Este ponto está {perdido|desqualificado} (motivo). Concluir uma atividade o devolve a **{status_anterior}**."*
- **Um pedido também tira o pin da lateral**, sem tarefa nenhuma — o ERP prevalece (§3).

## 4. Aba Atividades (CAP-12)

Aba full-screen que **cobre o mapa** (z 25 — mesma camada de Funil e Inteligência, SPEC 00 §5.1). Bottom nav de **4 abas**: 🗺️ Mapa · 📋 Intel. · 📊 Funil · 🗓️ **Atividades** — é a **última**, ao lado do Funil, porque as duas são o pipeline de trabalho (SPEC 00 §5.2). *(com 4 abas o rótulo de Inteligência encurta — ver §9.)* **A quickbar do mapa não aparece aqui** (§6).

**Segmented control** no topo, **dois** recortes da mesma coleção — **a aba abre na Gerencial**:

- **Gerencial** — §5. O retrato do período: KPIs, quebras, gráficos L7D e a **tabela detalhada** no fim. É o default.
- **Agenda** — §4.2. `status = planejada`, **de hoje em diante**, em **calendário**: um bloco por dia, com **rotas** ([[rota]]) e **atividades avulsas**.

> **Havia um terceiro recorte, "Realizadas"** (cards de `status = realizada`, mais recente primeiro). **Removido em 28/07:** a tabela do §5.4 já é a lista detalhada, com mais colunas e ordenação — manter as duas era manter duas respostas para a mesma pergunta.
>
> ⚖️ **A consequência foi no drill, não na aba.** Todo número da Gerencial navegava para "Realizadas" filtrada; agora **filtra a própria tabela**, ali embaixo, e rola até ela. Vantagem: os agregados de cima **continuam inteiros** enquanto a tabela mostra a fatia — o gráfico vira o controle e a tabela o detalhe, que é a leitura de dashboard. O requisito do Notion (*quantidade **+** lista detalhada*) segue cumprido, na mesma tela.

> ⚖️ **A Gerencial abre por padrão** mesmo ela sendo a visão de liderança (§1). Inverte a leitura da aba: ela deixa de ser "minha agenda com um resumo atrás" e vira "o retrato do período, com o detalhe atrás". Decisão de produto, não do contrato — nada em [[tarefa]] muda. Reversível trocando uma linha.

### 4.1 Barra de filtros da aba

Logo abaixo do segmented control, **um estado de filtro só — com dois alcances** (28/07). Trocar de recorte não perde a seleção.

| Controle | Onde aparece | O que filtra |
|---|---|---|
| **Vendedor** | os **dois** recortes | `responsavel_id` **da tarefa**, não `vendedor_responsavel_id` do pin. `<select>` com `Todos os vendedores` (default); o da sessão vem marcado `(eu)` |
| **Buscar** | os **dois** recortes | o **estabelecimento**: nome fantasia · razão social · CNPJ (§4.1.1) |
| **Tipo de visita** | só a **Gerencial** | `tipo` da tarefa |
| **Tipo de check-in** | só a **Gerencial** | `presencial`/`remoto` — derivado da **distância** no check-in ([[tarefa]] §5), não de ter ou não check-in |
| **Período** | só a **Gerencial** | chips `Hoje · Ontem · Esta semana · Semana passada · Este mês · Mês passado · 📅 Período`. Default **Este mês**; semana começa na **segunda**. `📅 Período` revela `de`/`até` com o **date picker nativo** (sem build, sem componente novo pra manter) |

> ⚖️ **Os três da Gerencial não ficam escondidos na Agenda — eles não existem lá.** O controle é ocultado **e o filtro não é aplicado**. Ocultar aplicando seria exatamente o **filtro invisível** que esta barra combate (foi por isso que a gaveta `Mais` caiu). Só o que age aparece; só o que aparece age.
>
> **O que isso resolveu de graça:** (1) a Agenda deixou de ter recorte de período, então **o plano inteiro de hoje em diante aparece** — morre o efeito colateral de `Este mês` no dia 27 esconder o plano do mês seguinte; (2) o **filtro de check-in não esvazia mais a Agenda**, porque não está lá — a esquisitice documentada ("`tipo_checkin` só existe onde houve check-in, então a Agenda fica vazia") deixou de existir em vez de virar aviso; (3) a barra da Agenda caiu de três linhas para **uma**, e a altura foi para o calendário.
>
> **Preço:** trocar de recorte muda o conjunto sem o usuário mexer em controle nenhum — a Gerencial recorta por período e a Agenda não. É consistente com "cada recorte responde a pergunta dele", e o *hint* de cada um diz o recorte em vigor (`este mês …` × `todo o plano, de hoje em diante`).

Onde a Gerencial aplica o período: em `data`, de planejada **e** de realizada (§5.1). A **Agenda** não aplica período — só o piso de **hoje** (§4.2).

#### 4.1.1 A busca é por estabelecimento, e é a mesma da Inteligência

`CRM_DATA.matchBusca(pin, query)` — **uma função para as duas superfícies que buscam pin**: busca que se comporta diferente em duas telas do mesmo app é bug de produto, não variação. Casa com **nome fantasia**, **razão social** ou **CNPJ**:

- **acento-insensível** nos nomes (`mare` acha `Maré Alta`);
- no CNPJ compara **só dígitos**, então `14066` acha `14.066.645/0001-46` sem digitar pontuação.

> **Era só CNPJ por dígitos, com o rótulo `CNPJ` e placeholder `dígitos`.** Buscar o ponto pelo nome é o gesto natural de quem está em campo, e o CNPJ é o que menos se sabe de cabeça. **Efeito colateral bem-vindo:** a Inteligência, que já buscava os três campos, herdou o casamento por dígitos — antes ela só achava CNPJ se o usuário digitasse a pontuação.

**Uma exceção ao período, rotulada na tela** (exceção que não se anuncia é bug): os **gráficos por dia `L7D`** (§5.4) — e ela vive **dentro da Gerencial**, o único recorte que tem período. *(Havia duas: o bloco `Atrasadas` da Agenda era a outra, e saiu em 28/07 — §4.2. A Agenda inteira deixou de ter período, então não há o que excetuar lá.)*

**Nada fica atrás de botão.** Grade de 2 colunas (~172px por célula em 375px): a Gerencial ocupa duas linhas + a trilha de chips; a **Agenda usa uma linha só**. Controle com valor diferente de `Todos` (ou com texto na busca) fica **marcado em `--brand`** — lado a lado, é preciso ver de relance quais estão agindo. A busca usa *debounce*, nunca re-render por tecla.

> **Filtros ficaram um tempo recolhidos atrás de um botão `Mais`** com badge de contagem, para poupar altura (a barra ia de 88px para 127px). Revertido em 28/07: **filtro que não se acha não é filtro**, e a economia de 39px não paga o custo de o usuário não saber que o controle existe. A marcação em `--brand` substitui o badge no papel de mostrar o que está ativo. ⚖️ **A redução por recorte (28/07) não contradiz isso:** esconder um controle **que não age** é o oposto de esconder um que age.

O filtro **não persiste** entre sessões (nada de `localStorage` até a Fase 4).

### 4.2 A Agenda é um calendário de rotas (28/07)

Antes era uma pilha de cards de atividade agrupada por dia, com `Atrasadas` no topo e `Sugestões` no fim. **O problema era de leitura:** com ~80 planejadas, não se via *o que é de qual dia* — e o que o vendedor planeja não são atividades soltas, é **rota**.

**A forma agora é a do Google Agenda:** um bloco por dia, **data na sarjeta** (`TER 28` + `Hoje` / `Amanhã` / `4 de agosto`, com disco de marca em hoje), cabeçalho do dia **grudado no topo** enquanto o dia rola, e **horário na sarjeta de cada item**. Dentro do dia, duas naturezas:

| Natureza | O que é | Como aparece |
|---|---|---|
| **Rota** ([[rota]]) | conjunto de estabelecimentos de um vendedor no dia; **cada parada é uma tarefa planejada** | bloco com espinha em `--brand`: `🧭 nome · N paradas · faixa de horário · vendedor`, `Cancelar rota`, e as paradas em lista |
| **Avulsa** | o compromisso que o vendedor marcou solto (`rota_id` null) — *"retorno na quinta às 15h"* | card com espinha neutra, com o vendedor no subtítulo |

- **Ordem dentro do dia:** quem **não tem `hora`** vem primeiro, sob o rótulo `DIA INTEIRO` (a `hora` é opcional — [[tarefa]] §4); depois, tudo pelo horário. A rota entra na posição da **sua primeira parada**.
- **O item mostra o que foi combinado, e só:** horário marcado · nome do estabelecimento · tipo · **a anotação do vendedor no agendamento** (`tarefa.notas`) · `✕` cancelar. **Toque no nome abre o pin** no mapa (volta à aba Mapa, foca e abre o sheet) — mesmo gesto do Funil e da Inteligência.
- **Rota encurtada por filtro diz que foi encurtada:** o cabeçalho vira `2 de 5 paradas`. Rota que perde paradas em silêncio lê como rota errada.
- **`Cancelar rota`** cancela **todas** as paradas dela e avisa quantas são e **quantos pins saem do funil** — é a única reversão do board ([[tarefa]] §5). A rota não se deleta; ela apenas fica sem paradas e some da Agenda.

> ⚖️ **A Agenda perdeu `Check-in` e `Concluir`.** Ela é o **plano**; a execução é no sheet do pin, que já tem o botão contextual (§2). Duas ações de execução num card de agenda competiam com o gesto principal (abrir o pin) e espalhavam o fluxo de conclusão por duas telas.
>
> **O preço que isto parecia cobrar não existe mais.** Por algumas horas de 28/07 a leitura foi: *"a atividade remota ficou sem porta de UI, porque era 'concluir sem check-in' e esse botão acabou"*. A premissa estava errada — **remoto é check-in feito longe do pin**, não check-in ausente ([[tarefa]] §5). Qualquer check-in produz `remoto` quando a distância passa do raio, então a ponta solta fechou sem nenhuma tela nova. O que a Agenda perdeu foi só a execução, que é do pin.

> ⚖️ **A Agenda não mostra atrasadas, e não fala delas.** Era bloco fixo no topo e exceção ao filtro de período. Saiu porque a Agenda passou a ser *"o que vem por aí"*, e dívida vencida no topo de um calendário empurra o dia de hoje para fora da tela.
>
> **Nem o ponteiro sobrou.** Houve, por algumas horas, um pill `N atrasadas na Gerencial` no *hint* — posto ali pela regra de que omissão não deve ser silenciosa. **Removido em 28/07 por decisão de produto:** *"não quero dar atenção às atrasadas"*. Contar a dívida e apontar para onde ela está **é** dar atenção a ela; a rigor, um contador no alto da tela chama mais atenção do que uma lista lá embaixo. Então a Agenda passou a não mencionar atraso em nenhuma forma — sem bloco, sem badge, sem contagem, sem atalho.
>
> ⚠️ **O que isto custa, explicitamente:** a tarefa planejada de data passada **só existe** na tabela da gerencial, e lá **sem marca própria** de atraso — ela aparece porque a tabela lista todas as planejadas do período, não porque a tela sinalize a dívida. A tabela obedece ao filtro de período, então com `Hoje` selecionado a atrasada de ontem não aparece em lugar nenhum do app. **Isso é o comportamento pedido, não uma lacuna a consertar** — e é a razão de estar escrito aqui: um leitor futuro que "descobrir" essa ausência precisa saber que ela é intencional antes de reintroduzir o bloco.

> ⚖️ **As `Sugestões` (`proxima_acao_data`) saíram da Agenda.** Elas eram "não-tarefas" num calendário — exatamente o tipo de item que alguém lê como compromisso marcado. O campo continua no modelo e na tabela da gerencial; a Agenda ficou só com compromisso real.

**Criar rota ou atividade daqui ainda não existe.** O FAB da aba com seletor buscável de pin segue prometido e não implementado (§9) — e agora ele tem duas formas a resolver: criar **avulsa** (um pin) e **montar rota** (N pins, o que cria N tarefas planejadas). Agendar pelo sheet do pin cria sempre uma **avulsa**. Toda tarefa tem `estabelecimento_id` obrigatório; não há atividade órfã.

## 5. Visão gerencial (CAP-13)

Sub-visão, **não aba própria**: é o mesmo dado com outro recorte ([[tarefa]] §5 — agregação pura), e uma 5ª aba para a única tela de liderança não se paga.

- **Seletor de período** — mora na barra da aba (§4.1), não aqui dentro. O vocabulário `7 · 30 · 90 dias` foi substituído por presets de calendário, e o intervalo custom **saiu do parking**. ⚖️ **Ele subiu para a barra para valer nos dois recortes e, em 28/07, voltou a ser exclusivo desta sub-visão** — a Agenda não recorta por período (§4.1). O controle segue na barra (é lá que moram os filtros da aba), mas só aparece quando a Gerencial está na tela.

### 5.1 Hierarquia em três níveis

O problema que esta estrutura resolve não era falta de gráfico — era **falta de hierarquia**: três blocos de barras idênticos davam o mesmo peso a tudo, e o olho não sabia onde pousar. Agora:

1. **KPI row** — três tiles que formam um **funil de execução**, cada um em % do **anterior**, não do total:

| Tile | Número | Terceira linha |
|---|---|---|
| **Planejadas** | tarefas com data no período | `no período` |
| **Realizadas** | as concluídas | `y% das planejadas` — taxa de execução do plano |
| **TD encontrado** | realizadas com `resultado = td_encontrado` | `w% das realizadas` — taxa de eficácia |

> ⚖️ **"Planejadas" é o PLANO DO PERÍODO** — todas as tarefas com data no recorte, **realizadas incluídas**. Tinha que ser: se contasse só quem continua `planejada`, os dois conjuntos seriam **disjuntos** (o plano vive no futuro, o feito no passado) e "16 de 38" não significaria coisa alguma. É a mesma leitura dos gráficos L7D (§5.4), e é o que faz a taxa de execução existir.

> **`Atrasadas hoje` saiu da KPI row** (28/07) — os três tiles agora contam **uma** história encadeada, e a dívida vencida era um quarto assunto no meio dela. ⚠️ **Na mesma semana a dívida perdeu o resto das superfícies:** o bloco fixo da Agenda saiu e a Agenda deixou de contá-la (§4.2). Hoje a tarefa vencida só existe **como linha da tabela** do §5.4, sem marca. É intencional.
2. **Quebras**, cada uma com a forma que o trabalho pede (§5.2).
3. **Detalhe** — gráficos por dia e a tabela de atividades (§5.4).

> ⚖️ **Não há número-manchete.** Existiu um (`≥48px`, "N atividades realizadas") e foi **removido em 28/07**: o *head* da aba já mostra `N realizadas` no alto da tela, e a manchete dizia exatamente a mesma coisa dois centímetros abaixo. Ficou a forma menor. Se um dia a gerencial deixar de morar dentro de uma aba que já conta, a manchete volta.

> ⚖️ **A gerencial mostra o plano ao lado da execução.** Deixou de ser recorte só de `realizada`: `Planejadas` e `Atrasadas hoje` vêm de `status = planejada`. É a pergunta real da supervisão — *"está rodando conforme o combinado?"* — que o total de realizadas sozinho não responde.

> ⛔ **O tile `Atrasadas hoje` não existe mais** (removido em 28/07, acima). Ficava fora do filtro de período e por isso levava **"hoje"** no rótulo — sem a palavra, em `Mês passado` o número leria como "2 atrasadas no mês passado" quando eram as vencidas de agora. Registrado porque a regra vale para qualquer número que um dia volte a ignorar o período: **o rótulo tem que dizer o recorte real**.

### 5.2 As formas, por trabalho

| Quebra | Forma | Por quê |
|---|---|---|
| **Resultado** | **barra empilhada 100%** + legenda rotulada + detalhamento ao apontar | É parte-do-todo. Em 375px a empilhada é mais precisa e mais compacta que um donut, e fala a mesma língua das barras já na tela. **Ordem fixa do enum, nunca por ranking** — a cor segue a entidade, então o mesmo resultado tem a mesma cor em qualquer período |
| **Vendedor × tipo** | **tabela pivô** com totais de linha e coluna | Cruzamento de duas dimensões nominais — nem barra nem gráfico resolve; a grade é a forma certa. Números à direita e com `tabular-nums` (aqui dígito de largura fixa **ajuda**, ao contrário do texto corrido). **Cada célula é um drill duplo** (vendedor **e** tipo) e a coluna **Total** dá o drill por vendedor |

> **Não há bloco "Por vendedor".** Existiu (barras horizontais) e saiu em 28/07: a pivô já entrega o total por vendedor na coluna `Total` **e** ainda cruza com o tipo. Duas leituras da mesma dimensão, uma delas mais pobre, só custavam altura. A quebra "Por tipo" em chips saiu antes, pelo mesmo motivo — a pivô contém as duas.

- **Cada número filtra a tabela do §5.4** e rola até ela — é o requisito explícito do Notion: *quantidade **+** lista detalhada*. Vale para os três tiles, cada célula da pivô (drill **duplo**: vendedor **e** tipo), a coluna `Total` da pivô e cada item das duas legendas. Um **chip no título da tabela** diz o critério ativo e é a porta de volta — tabela filtrada sem chip parece dado que sumiu. Trocar qualquer filtro da barra **limpa o drill** (ele pode ser justamente pela dimensão que mudou).
- **Drill por `resultado` exclui planejadas sozinho** — quem não tem desfecho não casa com nenhum valor do enum. Não precisou de regra: cai do modelo.
- ⚖️ **Na barra empilhada, o segmento MOSTRA e a legenda LEVA.** Apontar um segmento abre o detalhamento (todos os desfechos com contagem e %, sobre o total de realizadas); o drill fica no item de legenda logo abaixo. No celular um toque não pode fazer as duas coisas — ou abre o detalhamento ou navega. A porta continua existindo, a 8px de distância e por categoria.
- `responsavel_id` **deixou de ser filtro só daqui** e virou filtro da aba (§4.1). `tipo` e `resultado` seguem como parking desta sub-visão — as quebras os mostram e permitem drill, mas não filtram a tela inteira.

### 5.3 Cor: o que foi computado

As 4 cores de `resultado` são as **mesmas do funil** — e isso é correto, não reuso indevido: a cor segue a **entidade**, e a entidade é o mesmo `resultado` que pinta o pin. Rodadas no validador de paleta contra `--surface #ffffff`:

| Check | Veredito |
|---|---|
| Faixa de luminosidade · separação para daltonismo (ΔE 9.6 deutan) · piso de visão normal (ΔE 19.1) | ✅ passam |
| **Piso de croma** | ❌ `#475569` (desqualificado) tem croma 0.037 — **lê como cinza** |
| **Contraste vs. superfície** | ⚠️ `#0ea5e9` (2.77) e `#f59e0b` (2.15) abaixo de 3:1 |

- O **`❌` foi aceito conscientemente**: desqualificado é inerte por definição, e o cinza comunica isso. Manter uma cor só por estado (mapa, funil e gráfico) vale mais do que passar no check.
- O **`⚠️` não é dispensável** e vira requisito: **rótulo + número sempre visíveis** na legenda. Cor nunca carrega o sentido sozinha — mesma disciplina de pistas não-cromáticas do [[spec-00-design-system]] §6.1.

### 5.4 Detalhe: por dia e linha a linha

**Dois gráficos de coluna empilhada por dia, empilhados por vendedor** — *Realizadas por dia* e *Planejadas por dia*. Uma **escala só** para os dois, para que as alturas sejam comparáveis entre eles; a diferença entre as duas barras **é o não-realizado**. Legenda de vendedor acima, compartilhada, com drill.

> ⚖️ **Janela fixa de 7 dias (L7D) — a única coisa da tela fora do filtro de período.** Amarrados ao período eles ficavam ilegíveis: "Este mês" rende 31 colunas de 11px e "Mês passado" vira um campo de buracos. Com 7 colunas de ~47px a leitura volta, e as colunas dividem a largura em vez de rolar. **O filtro de vendedor continua valendo.** O selo `L7D` no título é o que impede a leitura errada — sem ele, trocar o período e ver o gráfico parado seria bug; com ele, é contrato.

**Detalhamento ao apontar a coluna** — painel escuro com a data, uma linha por vendedor (cor · nome · quantidade · **%**) e o **Total 100%**. Aparece no `hover` do mouse, no toque (Android) e no foco por teclado; some ao sair, ao rolar e ao tocar fora. Dia sem atividade diz *"Sem atividade neste dia"* em vez de sumir — coluna vazia com tooltip mudo parece quebrada.

> **Nenhuma visita cai em fim de semana.** As tarefas-âncora nasciam de `ultima_visita` e de offsets fixos, e às vezes caíam num sábado; dentro da janela L7D isso virava uma barra de 3 visitas no domingo, que a supervisão lê como erro de sistema. O seed encosta data passada na sexta e joga data futura para a segunda. **Hoje é semeado como dia em andamento** (parte do plano já realizada, o resto de pé) — é o único dia em que o par de gráficos conta a história inteira, e sem isso a última coluna nasce vazia.

> ⚖️ **"Planejadas do dia" = todas as tarefas daquela data**, não só as que continuam `planejada`. Planejada e realizada são o mesmo objeto ([[tarefa]] §2): o que foi feito hoje **estava** no plano de hoje. Contar só o resíduo faria o gráfico do passado ser sempre zero.

**Tabela de atividades do período** — planejadas **e** realizadas, uma linha por atividade, **ordenável por qualquer coluna** (toque no cabeçalho; o mesmo cabeçalho inverte). Colunas: `vendedor` · `data` · `cliente` · **`cnpj`** · `nome da rota` · `tipo de visita` · `realizado` · `tipo de check-in` · `comentário` · `distância` · `endereço`. Rola nos dois eixos, com o cabeçalho fixo no topo. O nome do cliente abre o pin. **`cnpj` sai vazio (`—`) em lead cru** — nem todo ponto do mapa tem CNPJ, e isso é do modelo ([[estabelecimento]]), não falha de dado.

- **Vazio vai sempre para o fim**, nas duas direções: se `—` subisse ao topo ao inverter, ordenar esconderia o dado em vez de revelá-lo.
- **Teto de 150 linhas por ordenação, dito na tela.** Sem teto, cada toque custava ~250ms para reconstruir 300+ linhas × 10 células. O rodapé informa quantas ficaram fora — corte silencioso lê como "cobri tudo" quando não cobriu.
- **`nome da rota` deixou de ser rótulo derivado** (28/07): vem do **objeto [[rota]]** via `tarefa.rota_id`, e mostra **`Avulsa`** para tarefa fora de rota. No seed, ~4 em cada 5 linhas têm rota de verdade (com nome de bairro); as `Avulsa` são as visitas-âncora e as agendadas soltas. *(Era `Rota (dd/mm/aaaa)` a partir de `responsavel_id` + `data` — o rótulo existia justamente para não antecipar o objeto, e o objeto rascunho o substituiu.)*
- **Duas colunas continuam não sendo campos:** `tipo de check-in` deriva da **`distancia_km`** e `realizado` deriva de `status`. Ver [[tarefa]] §4 e §5. ⚠️ **A coluna e o filtro não repetem `realizado`:** entre as realizadas há presencial **e** remoto (no seed, ~17% remoto), e as não realizadas mostram `—` porque sem check-in o campo é nulo.
- **`distancia_km` é campo novo** ([[tarefa]] §4), derivado no check-in e persistido. Exceção consciente ao não-escopo de GPS: o campo entrou, o motor que o preenche não. No protótipo o valor é **fictício**.

### 5.5 O seed precisou crescer

Com uma tarefa por pin, os gráficos por dia davam **pico de 4** e a tela parecia de brinquedo. O seed foi adensado para ritmo de campo: **63 → 538 tarefas**, 9–16 visitas por dia útil, **nenhuma em fim de semana**, e **hoje como dia em andamento** (parte do plano já realizada, o resto de pé).

> ⚖️ **O seed tinha uma mentira e ela saiu (28/07).** Ele gerava ~14% de realizadas **sem check-in** para popular a coluna `Remoto` da gerencial — o que, com a regra corrigida ([[tarefa]] §5), seria contar como *visita realizada* algo que ninguém fez. Agora: **12% das paradas de rota passada ficam `planejada` em data vencida** (não realizadas), e o `remoto` vem de onde deve vir — **distância acima do raio no check-in** (~17% das realizadas). Dois ganhos de leitura: o par de gráficos L7D passou a ter **diferença de verdade** entre planejado e executado (era quase colado), e a taxa de execução caiu de 84% para **77%**, que é o número honesto.

> ⚖️ **Depois (28/07) o seed passou a nascer em ROTAS, inclusive no passado** — um caminho de código só (`rotaDoDia`) para o dia que já rodou e para o dia que vem: **522 tarefas em 117 rotas**, 3 vendedores × 3–5 paradas por dia útil, paradas espaçadas de 45min. **As paradas de cada rota saem por proximidade** (vizinhos mais próximos de uma âncora que gira), porque foi isso que fez o nome da rota ser verdade: uma janela qualquer dava *"Rota Boa Viagem"* com parada em Casa Forte, que é enfeite. **O passado tinha que virar rota também** — sem isso a coluna `Nome Rota` da tabela diria `Avulsa` em ~460 de 522 linhas, o oposto do que a tela passou a afirmar. **O funil não se moveu:** mesmas 7 colunas e mesmas contagens (verificado — `resultado` de cada parada continua vindo da âncora do pin).

> ✅ **Série temporal saiu do parking (28/07).** Ela tinha sido cortada por falta de dado; com o adensamento, os gráficos por dia passaram a ter forma.

> ⚖️ **O adensamento não move o funil.** `reconcileStatus` é *last-wins* (a última realizada manda), então cada tarefa de volume nasce com o **mesmo `resultado` da tarefa-âncora do seu pin** — o status derivado sai idêntico e o board mantém as mesmas 7 colunas e contagens.

> ⚠️ **O recorte "por vendedor" só demonstra algo se o dataset fictício semear `vendedor_responsavel_id`** nos estabelecimentos. Sem isso, tudo cai num bucket único. Era a dependência crítica desta tela para o gate ([[tarefa]] §9) — ✅ semeado, 3 vendedores.

### 5.6 Dado real também recebe atividades simuladas

O snapshot **não traz atividade nenhuma**. Sem simular, quem entra pelo porteiro vê a aba vazia e o board com quatro colunas desertas ([[spec-06-funil]] §7) — o oposto do que esta fatia existe para demonstrar. Desde 28/07, `useRealData()` roda o **mesmo** `buildTarefas` sobre os pins reais.

- **O volume é função do TIME, não da base.** Três vendedores fazem ~12 visitas por dia útil tenham eles 61 ou 6.914 pins, e `buildTarefas` já contava assim — o total de tarefas sai da mesma ordem dos dois lados, sem explodir com o tamanho do snapshot. Medido: 2.000 pins reais → 1.122 tarefas em ~105ms.
- **A régua do snapshot prevalece onde sabe mais.** `csc`/`aquisicao` vêm do ERP (o `Cadastrado` do snapshot **é** o sinal comercial) e são restaurados depois do reconcile; pin que não ganhou tarefa mantém o status da régua, em vez de cair para `sem_plano`.
- **`TD encontrado` precisa de empurrão.** A régua só conhece Cadastrado / visitado / não visitado, então a coluna nasceria vazia mesmo com tarefas. `buildTarefas(pins, {promoverTd: n})` promove ~15% dos visitados (teto 30) com uma tarefa datada de **hoje** — como o reconcile é *last-wins*, ela manda. **No fictício `opts` vem vazio e nada disso executa**: o board fictício não se mexe (verificado — 538 tarefas e as mesmas 7 contagens).
- **`Aquisição` continua vazia com dado real, e isso é correto** — exige saber se houve **pedido**, dado que o `salesforce.lead` não tem. Régua provisória mantida: todo convertido do snapshot cai em CSC.
- **Nada persiste.** `persist()` já sai cedo em `realMode`, então as tarefas simuladas morrem no reload junto com os pins. Verificado: o `localStorage` contém só o dataset fictício, sem um nome ou CNPJ real.

> ⚠️ **Faixa fixa de procedência, nas duas abas.** Isto é razão social, CNPJ e endereço **verdadeiros** com visitas, check-ins, distâncias e **motivos** que não aconteceram — inclusive as saídas laterais, com frases como *"não existe no endereço"* sobre um CNPJ real. Uma faixa âmbar (`.sim-banner`, só em `body.real-mode`) fica no topo da aba Atividades **e do Funil**, fora da área que rola, para sobreviver a print recortado: *"Dado real com atividades simuladas — nenhuma visita aconteceu."* O Funil entrou junto porque as colunas dele passaram a ser populadas pelas mesmas tarefas.

> **O vendedor real é descartado de propósito.** O snapshot traz `vendedor_rota_lead_c` → nome de gente de verdade, e as tarefas são atribuídas aos **três vendedores fictícios** mesmo assim. Número de desempenho inventado não vai no nome de uma pessoa real, na frente da liderança dela. Efeito colateral bem-vindo: dispensa registro dinâmico de vendedor e resolve a paleta — ela tem 3 cores e o campo teria N.

## 6. Filtros — o que compartilha e o que não

- **Compartilha:** a aba Atividades respeita o conjunto filtrado do mapa (só atividades de pins visíveis), como o Funil e a Inteligência. Filtro **oculta**, nunca deleta. Mas **a quickbar não aparece nesta aba** (SPEC 00 §5.2): o filtro do mapa não é útil aqui e custava 52px. Para ele não virar filtro invisível, o head mostra o pill `N filtros do mapa` (SPEC 00 §6.11) quando há algum ativo, e tocá-lo volta ao Mapa — o único lugar onde se mexe nele.
- **Não compartilha:** `período`, `vendedor`, `tipo` e `resultado` são filtros **da própria aba** (§4.1) — não entram na quickbar do mapa. Um filtro de tarefa não deve mexer nos pins. O mapa **não tem** filtro de vendedor, então não há dois seletores concorrentes: o da aba é o único, e é de tarefa.

## 7. Dados exibidos

Da [[tarefa]]: `tipo`, `data`, `status`, `resultado`, `motivo_perda`/`motivo_desqualificacao`, `proxima_acao`(+data), `responsavel_id`, `atrasada`, `duracao_min` (só na gerencial). Do [[estabelecimento]]: `nome_fantasia`, `tipologia` (emoji), cidade/zona — o suficiente para identificar o pin no card. Referência cruzada: coluna **"Onde aparece"** em [[tarefa]] §4.

## 8. Estados

- **Agenda vazia:** "Nada planejado neste recorte." — e nada mais. A frase **não** menciona atraso (§4.2), mesmo havendo dívida vencida escondida.
- **Rota sem parada planejada:** não é renderizada. Cancelar todas as paradas faz a rota sair da Agenda (o registro dela fica — nada se deleta).
- **Gerencial sem realizadas:** os KPIs continuam (o plano existe), as quebras somem — não se renderiza barra vazia — e o texto diz quantas planejadas há no recorte. A **tabela ainda aparece**, com as planejadas.
- **Tabela com drill que não casa nada:** o chip do critério continua visível, para o vazio ter explicação e ter saída.
- **Pin sem atividade:** chips com `1ª visita` marcada + `📍 Check-in` e `＋ Agendar`. Sem histórico e sem `Ver todas`. *(Antes só havia `＋ Agendar` — §2.3.)*
- **Pin só com planejada:** o mesmo, com o chip no tipo dela e o hint `confere o plano de dd/mm` quando for de hoje ou atrasada, + `Ver todas as atividades (1) ›`.
- **Check-in aberto:** o botão do pin vira `Check-out`, os chips somem e uma faixa verde diz `{tipo} em andamento · check-in às HH:MM` (§2.3) — é assim que o sheet mostra visita em curso, já que a planejada não tem linha própria. ⚠️ **A Agenda não marca mais isso** (não tem ação de execução, §4.2): a visita em andamento se vê no pin.
- **Loading:** protótipo estático (sem loading) — parking de skeleton no SPEC 00 §10.

## 9. Decisões & casos de borda

- **4ª aba, separada do Funil.** Atividade é objeto datado; funil é estado do estabelecimento — a fronteira travada em [[tarefa]] §2. Compartilhar tela reintroduziria a confusão que o contrato desfez. ⚠️ **Divergência consciente com o Notion** (Fase 3 item 6 agrupa "funil + agenda + gerencial" numa aba só): o agrupamento do Notion é rótulo de *plano*, escrito antes da fronteira de objeto existir. Reversível — fundir depois é envolver os dois num segmented control.
- **Bottom nav de 3 → 4 abas** altera o [[spec-00-design-system]] §5/§5.2. Com 4 abas os rótulos encurtam (`Intel.`); abaixo de 360px o rótulo pode ceder ao ícone. A ordem final agrupa por natureza — base (Mapa · Intel.) e depois pipeline (Funil · Atividades).
- **A quickbar some no Funil e nas Atividades**, não na Inteligência. Intel. é a *mesma base* do mapa em forma de lista, onde o filtro de pin é a ferramenta principal; Funil e Atividades são recortes de trabalho, onde ele é ruído. Consequência aceita: o filtro do mapa fica menos evidente nessas duas — mitigado pelo pill do head (§6), não eliminado.
- **Visão gerencial é sub-visão**, não aba (§5) — **e é a que abre por padrão** (§4). As duas coisas convivem: continua não valendo uma 5ª aba, mas é ela que dá o contexto de entrada.
- **Um estado de filtro só, com dois alcances** (§4.1). `vendedor` e `busca` valem nos dois recortes e sobrevivem à troca — é a pergunta ("este vendedor, este ponto") que se mantém. `tipo`, `check-in` e `período` são da Gerencial: **o controle desaparece e o filtro deixa de agir**, nunca um sem o outro. Alternativa recusada: manter os cinco visíveis nos dois — era o que havia, e punha na Agenda um recorte de período que escondia plano futuro e um filtro de check-in que a esvaziava.
- **A Agenda é calendário de rotas, de hoje em diante** (§4.2) — sem atrasadas, sem sugestões, sem check-in e sem concluir. A alternativa (manter tudo e só reagrupar por dia) devolvia a pilha que não deixava ver de qual dia era cada coisa.
- **Atraso não é assunto da Agenda, nem por referência** (§4.2). Decisão de produto de 28/07: nem bloco, nem badge, nem contagem, nem atalho. É a única "omissão não anunciada" aceita na aba — e é aceita porque anunciar já seria dar o destaque que se quis remover.
- **[[rota]] entrou como RASCUNHO declarado**, contra o que a [[tarefa]] §6 dizia (Rota é Fase 4, tarefa não é parada). O que entrou é identidade + nome + dia + dono; **sequenciamento continua fora**, e é ele que faz o objeto da Fase 4. Alternativa recusada: agrupar por `(vendedor, dia)` derivado — não distinguia rota de avulsa, e era justamente a distinção pedida.
- **Cancelar rota é cancelamento em lote, não exclusão** — N paradas viram `cancelada` e a rota fica sem paradas. Espelha *"tarefa não se deleta"*.
- **Calendário e relógio = `input type="date"`/`type="time"` nativos**, não componente próprio. Sem build, sem 150 linhas novas para manter, e o Android já entrega os pickers do sistema. O preço é que esses controles não usam os tokens do [[spec-00-design-system]].
- **Perdido e Desqualificado só pelo check-out** (§3.1) — nunca botão solto, nunca arraste. A [[spec-06-funil]] recusa o drop nessas duas colunas (exigem motivo) e também em CSC/Aquisição (vêm do ERP).
- **Conversão não passa pelo check-out** (§3): `csc`/`aquisicao` vêm do ERP e prevalecem. Um card pode aparecer em Aquisição sem nenhuma atividade concluída.
- **Agendar põe o pin no funil** (§2.1) — e **o check-in também**, desde 28/07: a tarefa que ele cria nasce `planejada`, então o pin entra em `Visita planejada` e só o `resultado` do check-out o move dali (§2.3). Consequência de produto inalterada: o Funil mostra só o pipeline, e a contagem dele divergir da do mapa é o comportamento correto ([[spec-06-funil]] §5).
- **Check-in em todo pin, sem exigir plano** (§2.3) — a CAP-6 revisada, finalmente implementada. Alternativa recusada: manter `＋ Agendar` como única porta e fazer o vendedor planejar uma visita que já estava acontecendo.
- **O tipo é confirmado no fim, não no começo** (§2.3 + §3). Ele esteve em chips no pin, acima do botão de check-in, por uma hora em 28/07: quem entra na porta do cliente não para para classificar a visita — e no check-in ainda não sabe o que ela vai ser. Foi para o sheet de conclusão, onde a informação existe. Alternativa recusada: um passo de confirmação **antes** do check-in (sheet ou prompt) — um toque a mais na ação mais frequente do app.
- **O sheet de conclusão nasceu de um campo, não de um refactor** (§3). A pendência dos três `window.prompt` era conhecida havia dois dias; o que a resolveu foi precisar de um lugar para o `tipo`. Fica registrado porque é o padrão útil: pendência de apresentação sai junto com o próximo requisito que a encoste.
- **O sheet é a 4ª tela do pin-sheet, não um sheet sobre o sheet** (§2.2). Empilhar dois bottom sheets exigiria segundo backdrop e nova camada de z-index para uma tela que sempre pertence a **um** ponto.
- **Presencial × remoto é DISTÂNCIA, não presença de check-in** ([[tarefa]] §5, corrigido em 28/07). Sem check-in a atividade fica **não realizada** e `tipo_checkin` é nulo; com check-in, o raio de **`0,5 km`** — o critério que a operação da Praso já usa — separa quem estava na porta de quem registrou de longe. A versão anterior — `remoto` = concluída sem check-in — fazia a gerencial contar como *realizada remota* uma visita que ninguém tinha feito.
- **Não se conclui sem check-in** (§3). Consequência no seed: as ~60 "remotas sem check-in" viraram **planejadas em data passada** (§5.5), e a taxa de execução caiu de 84% para 77% — que é o número honesto.
- **`proxima_acao_data` não tem mais superfície na Agenda** (§4.2) — segue no modelo e na tabela da gerencial. Sugestão dentro de um calendário lê como compromisso.
- **O sheet do pin virou três telas** (§2.2), não uma tela longa. Empilhar lista completa + detalhe dentro do sheet mantém o vendedor no contexto do ponto; abrir tela cheia por atividade perderia o pin de vista.
- **Atividade realizada não tem ação** — é registro. Corrigir um desfecho errado exige concluir uma **nova** atividade, que é o mesmo caminho da requalificação (§3.1). Não há edição retroativa.
- **Recorrência não gera nada** na Fase 2: é só um valor de `tipo`. A agenda não se autopreenche.
- **Uma atividade aberta por pin** (com check-in sem check-out). Tentar abrir outra oferece fechar a anterior.
- **Sobre dado real:** o snapshot não traz atividades. Até 28/07 a aba nascia **vazia** com dado real; agora ela recebe as **mesmas tarefas simuladas** do fictício, com faixa fixa de procedência (§5.6). A alternativa era demonstrar a fatia só em dado fictício — o que tornaria o login no porteiro um caminho pior que o de demonstração.

## 10. Como o SPEC 07 usa o SPEC 00

Não repete tokens nem componentes: reusa o pin-sheet (§6.7) **e o bloco de atividades dele** (§6.7.1 — as duas ações + a conferência de tipo), o sheet/painel bottom (§6.6), o modal de criação (§6.8), os transientes (§6.15), o shell/nav (§5) e o **chip** (§6.2), tanto nos presets de período quanto nos três chips de tipo. **Pede ao SPEC 00:** a 4ª aba na navegação (§5.2), **três cores novas** de status (`csc`, `perdido`, `desqualificado`) e um badge de `resultado` (4 valores) — ambas em §2.6 — mais **seis componentes novos**: o **segmented control** (§6.10), o **pill de filtro herdado** (§6.11), a **barra de filtros de aba** (§6.12), os **gráficos da gerencial** (§6.13, com as regras de cor que passam a valer para qualquer gráfico do produto), a **faixa de procedência** (§6.14) e o **calendário da Agenda** (§6.16: bloco de dia com sarjeta e cabeçalho grudado, item com sarjeta de horário, bloco de rota com espinha). *(O card de atividade no molde do card de lead saiu junto com os cards da Agenda — §4.2.)*
