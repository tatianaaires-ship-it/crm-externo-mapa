---
title: "Jornada do cliente × tipo de visita — CRM Externo / Praso Maps"
tipo: jornada
fase: "Fase 2 — contrato dos tipos fechado; conteúdo dos formulários em aberto (§6)"
status: rascunho-editavel
sources:
  - "Decisão Tatiana (2026-08-03): tipo derivado, não digitado · lead ou CSC sem visita há 4 meses = 1ª visita · reaquisição em 120 dias · retenção é sinal estreito"
  - "Fluxo desenhado por Tatiana no Miro (2026-08-03): DUAS BANDAS (aquisição × recorrência), 7 tipos, e o tipo `relacionamento` net-new"
  - "docs/objetos/tarefa.md §4c — o contrato (este doc é a jornada que o contrato espelha)"
  - "Edge Case Hunter (2026-08-03) — cenários de fronteira não tratados, em §3 e §4"
related:
  - "[[tarefa]]"
  - "[[estabelecimento]]"
  - "[[spec-07-atividades]]"
  - "[[fluxos-n8n-salesforce]]"
---

# Jornada do cliente × tipo de visita

> **Uma linha:** o caminho que um estabelecimento percorre e **qual visita ele pede em cada ponto** — **7 tipos derivados em 2 bandas**, os cenários que caem em cada um, e o que cada formulário deve perguntar.

> ✏️ **Este doc é para MEXER.** O **fluxo** você desenha no **Miro** (é de lá que veio esta versão); os **cenários** (§3), as **decisões** (§4) e o **conteúdo dos formulários** (§6) se editam aqui. O contrato só muda quando você fechar aqui — [[tarefa]] §4c é o espelho, e ele segue este doc.

> 🔴 **06/08 — a banda de AQUISIÇÃO deste doc foi SUBSTITUÍDA** por [[jornada-funil-aquisicao]]: os 3 tipos viraram **3 estágios de funil** que avançam dentro da própria visita. **A banda de RECORRÊNCIA segue valendo** — e ganhou **aba própria no Funil** (§5.2 de lá): um board *Recorrência · Relacionamento · Expansão · Retenção*, **somente-leitura**, porque as quatro colunas são derivadas do ERP e ninguém as arrasta. ⚠️ A **régua de visita virou 90 dias** e vale só na aquisição; os **120** ficam com a compra.

## 1. As duas bandas e os sete tipos

**A primeira pergunta não é sobre a visita, é sobre a banda:** *este ponto é oportunidade de aquisição, ou é um cliente que compra?*

**🎯 Banda de AQUISIÇÃO** — há uma *primeira* compra a conquistar:

| Tipo | Chave | A pergunta que o formulário faz | Quem é o ponto |
|---|---|---|---|
| 🚩 **1ª visita** | `primeira_visita` | **mapeamento do estabelecimento** | nunca comprou · sem visita há 4 meses |
| 🔁 **Follow-up** | `follow_up` | *"o que falta para a compra?"* | **qualquer** ponto da banda com visita nos últimos 4 meses |
| ♻️ **Reaquisição** | `reaquisicao` | *"por que parou de comprar?"* | já comprou · 4 meses sem comprar · **e** sem visita há 4 meses |

**🔄 Banda de RECORRÊNCIA** — o ponto é cliente e está comprando:

| Tipo | Chave | A pergunta que o formulário faz | Quem é o ponto |
|---|---|---|---|
| 🗓️ **Recorrência** | `recorrencia` | **fechamento do onboarding** | `Disponível 2ª`/`3ª` — dentro dos **45 dias** da 1ª compra |
| 🤝 **Relacionamento** | `relacionamento` | **acompanhamento do cliente** | comprou, a janela de 45 dias **venceu**, o ciclo não fechou |
| 📈 **Expansão** | `expansao` | **complemento de mix e aumento de receita** | recorrente comprando — ou parado, sem ser do mês anterior |
| 🛡️ **Retenção** | `retencao` | *(a definir — §6)* | recorrente que comprou no **mês anterior** e não no corrente |

> ⚖️ **A ordem é por banda, não uma escada só.** É ela que a pivô *vendedor × tipo* usa, e o ganho é o **subtotal por banda** — *quanto do mês foi aquisição e quanto foi carteira*, que é a leitura da supervisão. `reaquisicao` fica **em aquisição** porque é lá que a operação a põe: *"o ponto entra na base de aquisição novamente"*.
>
> ⚠️ **"Aquisição" tem dois sentidos no produto, e agora a palavra é estrutural.** No funil, `aquisicao` = **já comprou** (a coluna do Kanban). Aqui, **banda de aquisição = ainda falta a primeira compra** — o oposto. Nenhum tipo se chama `aquisicao`, então nada colide em tela, mas 🔴 **renomear a coluna do funil (candidato: `comprou`) precisa ser decidido.**

## 2. O fluxo

> 🎨 **O desenho vive no Miro** (fluxo horizontal, duas bandas). O quadro [`.drawio`](jornada-tipos-de-visita.drawio) e a árvore abaixo são **espelhos** dele; para levar de volta ao Miro depois de mexer, use [`jornada-tipos-de-visita.miro.md`](jornada-tipos-de-visita.miro.md).
>
> ⚖️ **Gramática do desenho:** a cadeia de perguntas corre para a **direita**, o tipo de visita sai para **cima**, e o tracejado marca **tipo provisório por falta de dado**.

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

> ⭐ **A forma mudou, e é a melhor coisa desta versão: virou ÁRVORE.** Antes eram regras planas com *"primeiro que casa vence"*, e a exaustividade dependia de haver um **piso** no fim da lista — foi assim que nasceu o buraco do pin sem tipo. Numa árvore toda pergunta tem os ramos nomeados, então **cobrir tudo é estrutural**: não há como um pin não chegar a uma folha. **Precedência deixou de ser ordinal e passou a ser topológica.**
>
> 📏 **A régua de 4 meses aparece três vezes, e é a mesma ideia nas três:** sem **compra** (a raiz, que troca de banda) e sem **visita** (os dois ramos da aquisição). Grandezas diferentes — pedido × visita —, mesmo princípio: passados 4 meses, o que houve antes não conta mais como conversa em andamento.

### 2.1 A escada do silêncio (banda de recorrência)

```text
  comprou          comprou         ~30 a 120 dias        mais de
 este mês   →   mês passado   →     sem comprar    →    120 dias
────────────   ─────────────      ───────────────     ─────────────
📈 EXPANSÃO     🛡️ RETENÇÃO        📈 EXPANSÃO        ♻️ REAQUISIÇÃO
                 ↑ um mês só         ↑ volta a ser      ↑ troca de BANDA
```

> ⚖️ **A retenção não se alarga, e é isso que a mantém útil** (decisão 03/08): *"só é de retenção se é recorrente **e** comprou no mês anterior"* — a falha **fresca**, a anomalia de um mês em quem estava comprando. ⛔ **Recusado** cobrir a faixa inteira até 120 dias: o sinal viraria *"cliente que não comprou"*, quase toda a base num mês qualquer, e formulário de retenção sem alvo não serve para nada. **Preço aceito:** o afastamento é tratado em duas janelas (1 mês e 4 meses) e no meio delas o app confia no vendedor.

## 3. Os cenários

✅ coberto · ⚠️ fronteira sem resposta · ❓ a decidir

### 3.A Aquisição — nunca comprou

| # | Cenário | Última visita | Tipo | Situação |
|---|---|---|---|---|
| A1 | Pin de base, ninguém nunca foi | nunca | 🚩 1ª visita | ✅ |
| A2 | Pin criado em campo agora (sem CNPJ resolvido, sem porte) | nunca | 🚩 1ª visita | ✅ |
| A3 | Lead visitado há 5 meses, esfriou | 150 dias | 🚩 1ª visita | ✅ a régua reseta |
| A4 | Lead visitado no mês passado, sem pedido | 25 dias | 🔁 Follow-up | ✅ |
| A5 | **CSC que nunca recebeu visita** (cadastrou por inside/orgânico) | nunca | 🚩 1ª visita | ✅ *decidido 03/08 — é a 1ª visita do vendedor* |
| A6 | CSC visitado há 2 meses, ainda sem comprar | 60 dias | 🔁 Follow-up | ✅ |
| A7 | CSC de 2 anos, visitado todo mês, nunca compra | 20 dias | 🔁 Follow-up | ❓ nunca esfria enquanto é visitado — é isso que se quer? |
| A8 | Visita foi **remota** (check-in fora do raio de 500 m) | 30 dias | 🔁 Follow-up | ❓ visita remota reseta a régua de 4 meses? |
| A9 | Ponto **desqualificado** por tarefa concluída, recebe visita nova | 40 dias | 🔁 Follow-up | ❓ tarefa com desfecho lateral conta como visita? |

### 3.B Aquisição — já comprou e parou

| # | Cenário | Última compra | Última visita | Tipo | Situação |
|---|---|---|---|---|---|
| B1 | Ex-cliente sumido, campo também não vai lá | 150 dias | 200 dias | ♻️ Reaquisição | ✅ |
| B2 | **Ex-cliente sumido, mas visitado no mês passado** | 150 dias | 25 dias | 🔁 **Follow-up** | ✅ *novo em 03/08 — a pergunta "por que parou?" já foi feita na visita anterior* |
| B3 | Parou de comprar há 3 anos | 1.100 dias | nunca | ♻️ Reaquisição | ❓ reaquisição tem teto? Depois de N meses volta a ser 1ª visita? |
| B4 | Parou há 5 meses porque o **EC mudou de dono** | 150 dias | 200 dias | ♻️ Reaquisição | ✅ tipo certo — e é o formulário que tem de capturar isso (§6) |

### 3.C Recorrência

| # | Cenário | Estágio | Tipo | Situação |
|---|---|---|---|---|
| C1 | Comprou 1 vez há 20 dias | `Disponível 2ª` | 🗓️ Recorrência | ✅ |
| C2 | Comprou 2 vezes, ainda na janela | `Disponível 3ª` | 🗓️ Recorrência | ✅ |
| C3 | **Comprou 1 vez há 60 dias, a janela venceu** | não recorrente, +45d | 🤝 **Relacionamento** | ✅ *novo em 03/08 — este cenário não tinha tipo nenhum* |
| C4 | Recorrente comprando normal | recorrente | 📈 Expansão | ✅ |
| C5 | Recorrente comprou mês passado, nada este mês | recorrente | 🛡️ Retenção | ✅ |
| C6 | Recorrente que parou há 2 meses e meio | recorrente | 📈 Expansão | ✅ *decidido 03/08 — retenção é só a falha do mês seguinte* |
| C7 | **Recorrente que nunca recebeu visita** | recorrente | 📈 Expansão | ✅ *a banda vem da compra; a visita não entra aqui* |
| C8 | Recorrente comprando, mas **inadimplente** | recorrente | 📈 Expansão | ❓ falta um tipo de cobrança, ou a expansão absorve? |

### 3.D Fronteiras de data e de dado

| # | Cenário | O que acontece | Situação |
|---|---|---|---|
| D1 | **Hoje é dia 1º do mês** | toda a base recorrente que comprou no mês passado vira 🛡️ Retenção antes de ter chance de comprar | ⚠️ **buraco aberto** (§4) |
| D2 | Cliente que compra a cada **45 dias** | fica em 🛡️ Retenção todo mês sem estar atrasado | ⚠️ mesmo buraco, outra porta |
| D3 | Exatamente **120 dias** sem comprar | a raiz não diz se a régua é inclusiva; o ponto oscila entre as bandas | ⚠️ definir `>` × `>=` |
| D4 | `data_ultima_compra` **nula** com 1ª compra preenchida | a raiz não avalia e o ponto fica na banda de recorrência | ⚠️ falta o *fallback* `última = primeira` |
| D5 | **`Status_funil__c` e coorte ausentes** *(estado do dado hoje)* | a pergunta do estágio não tem resposta | ⚠️ *fallback* proposto: 🤝 **Relacionamento** (§4) |
| D6 | Pedido do mês **cancelado/devolvido** depois | se `data_ultima_compra` não recua, a retenção não dispara para quem de fato não comprou | ❓ regra do ERP |
| D7 | `ultima_visita` com data **no futuro** | satisfaz *"últimos 120 dias"* e classifica como Follow-up | ⚠️ usar só realizadas com data ≤ hoje |
| D8 | **O que define "oportunidade de aquisição"** | assumido como *sem 1ª compra **ou** +120 dias sem comprar* | ❓ **confirmar** — se for lista/régua da operação, deixa de ser derivável (§4) |

## 4. Decisões e o que segue aberto

### ✅ Fechado — a árvore substituiu a lista, e o piso deixou de ser necessário

O pin com compra e sem coorte ficava **sem tipo, logo sem formulário**. Na árvore isso **não existe como forma**: a pergunta do estágio tem os três ramos nomeados. Sobrou o **dado**: sem `Status_funil__c` nem coorte, a pergunta não tem resposta.

**Proposto:** o *fallback* é 🤝 **Relacionamento** — o ramo genérico *"acompanhar o cliente"* da própria banda, e o menos errado quando não se sabe o degrau. *(Era `follow_up`, que na árvore nova está na **banda errada** e perguntaria "o que falta para a compra?" a quem já compra.)*

- [ ] Fallback = Relacionamento (recomendado)
- [ ] Fallback = Recorrência
- [ ] Outro: ____________

### ⚠️ ABERTO — o dia 1º do mês (cenários D1 e D2)

*"Não comprou no mês corrente"* é verdade para **todo mundo** no dia 1º. Então, na virada, **todo recorrente que comprou no mês passado é Retenção** — a população inteira do degrau, de uma vez — e vai esvaziando conforme os pedidos entram. Quem tem ciclo maior que 30 dias cai em Retenção **todo mês**, sem nunca estar atrasado.

⚠️ **A retenção estreita deixou este buraco mais nítido, não menor:** o degrau é definido por *"comprou no mês anterior e não neste"*, que é exatamente a condição que a virada do mês torna universal.

**Recomendação:** medir o atraso contra o **ciclo do próprio cliente** — retenção quando passou do intervalo com que ele costuma comprar. Se pesar agora, a alternativa barata é uma **carência**.

- [ ] Atraso contra o ciclo do próprio cliente (recomendado — precisa do histórico de pedidos)
- [ ] Carência fixa: retenção só a partir de ______ dias sem compra
- [ ] Mês de calendário puro, com o pico do dia 1º aceito

### ❓ ABERTO — de quem é a banda de recorrência (post-it do quadro)

*"Cliente que tá no funil de recorrência — inside/growth? Relacionamento?"* Não é sobre o tipo, é sobre **de quem é o trabalho**. Se a banda de recorrência (ou parte dela) for de inside sales/growth e não do campo, esses tipos existem no modelo mas **não** no check-out do vendedor externo — e a pivô da gerencial nasceria com colunas que o time externo nunca preenche. **Decidir antes de construir os formulários de §6.**

- [ ] As duas bandas são do campo
- [ ] Recorrência/Relacionamento são de inside; o campo só vê Expansão e Retenção
- [ ] Outro: ____________

## 5. As réguas, num lugar só

Números que reclassificam gente quando mudam — por isso ficam nomeados aqui e não espalhados no código (mesma disciplina do `RAIO_PRESENCIAL_KM`, [[tarefa]] §5):

| Régua | Valor | Onde age | Situação |
|---|---|---|---|
| **Sem compra** | **120 dias** | a **raiz** — troca de banda | ✅ decidido 03/08. **Não** é o `Churn` de 60 dias do Salesforce ([[fluxos-n8n-salesforce]] §8, C5) |
| **Sem visita** | ~~120 dias~~ → **90 dias** | entrada em 🔍 Prospecção | ⚠️ **mudou em 06/08** ([[jornada-funil-aquisicao]] §2). E a régua **deixou de ser simétrica**: 90 para visita, 120 para compra — a frase *"4 meses vale nos dois eixos"*, que este doc celebrava, **não vale mais** |
| **Janela de recompra** | **45 dias** | Recorrência × Relacionamento | ✅ vem pronto (`Status_funil__c`) — 🔴 **proibido cachear**: o fluxo apaga o campo quando a janela fecha |
| **Janela de retenção** | 1 mês, estrito | Expansão × Retenção | ✅ o *quanto* está decidido; ⚠️ o *como medir o mês* segue aberto (§4) |
| **Ciclo fechado** | 3ª compra / coorte | Recorrência × Expansão | 🔴 dado não existe ainda ([[tarefa]] §4c.5) |
| **Teto de reaquisição** | — | Reaquisição × 1ª visita | ❓ não existe (cenário B3) |

## 6. O que cada visita deve perguntar

> 🚧 **Esta seção é a frente de trabalho atual.** O que está abaixo é **proposta**, para riscar e reescrever. O que já está travado é o **tronco comum**; o que varia é a *pergunta-assinatura* de cada tipo.

### 6.1 As três regras que valem para os sete

| Regra | Por quê |
|---|---|
| ⛔ **Tronco comum não varia** | os 4 checkboxes de desfecho, o `resultado` derivado, o **motivo obrigatório** sem venda, `notas` e o agendar a próxima ([[spec-07-atividades]] §3). A gerencial tem **as mesmas colunas para os sete** — sete desfechos diferentes seriam sete relatórios |
| 📏 **Teto de 3–4 perguntas próprias** | o check-out é a tela mais usada do app, e o vendedor está em pé na porta do cliente. Formulário longo não é preenchido — é preenchido *de qualquer jeito*, que é pior |
| 👁️ **Mostrar é tão importante quanto perguntar** | cada formulário abre com um **cabeçalho de leitura** dos fatos comerciais que justificam o tipo (última compra, ticket, dias na janela). É o que faz a pergunta não sair no vácuo — e é a mesma razão de o tipo aparecer **com o porquê** ([[tarefa]] §5) |
| 🔒 **O que a gerencial vai contar é vocabulário FECHADO** | texto livre só em `notas`. Campo que vira gráfico não pode ser digitado — é a regra do projeto aplicada ao formulário |

### 6.2 Os sete cartões

> 📐 **Formato definido no quadro (Tatiana, 03/08): `Objetivo` + 3 `informações chave`.** A moldura **é** a regra — três bullets, e o que não cabe em três não entra. ⛔ **Nada aqui repete o tronco comum:** `TD encontrado`, `Vendeu?`, motivo de não venda e notas são perguntados **em todos**, então aparecer como *informação chave* faria o vendedor responder duas vezes a mesma coisa.

---

**🚩 1ª VISITA**
**Objetivo:** conhecer o estabelecimento e saber se é oportunidade real — é a visita cujo produto é **corrigir a base**.
**Informações chave:**
- **Perfil real:** trabalha food service? tipologia observada *(contra o que o CNAE diz)*
- **Fornecedor atual** e com que frequência compra dele
- **Quem decide** (o **cargo**, nunca o nome — LGPD) e o melhor **dia/hora** para voltar

---

**🔁 FOLLOW-UP**
**Objetivo:** destravar o primeiro pedido — saber o que exatamente falta para o sim.
**Informações chave:**
- **O que precisa acontecer para fechar** *(fechado: liberar crédito · ajustar preço · provar produto/amostra · esperar contrato com o atual · resolver entrega · falar com o decisor)*
- **Prazo esperado** da decisão
- **Estágio da negociação:** já recebeu proposta? já testou produto?

---

**♻️ REAQUISIÇÃO**
**Objetivo:** entender por que parou de comprar e se dá para trazer de volta.
**Informações chave:**
- **Motivo de ter parado** *(fechado: preço · foi para concorrente · atraso/problema de entrega · ruptura de produto · qualidade · atendimento · dívida/crédito · EC fechou ou mudou de dono · mudou a operação · sem motivo claro)*
- **De quem compra hoje**
- **O que traria de volta**, e se é **recuperável** *(agora · depois · não)*

---

**🗓️ RECORRÊNCIA**
**Objetivo:** fazer sair a 2ª/3ª compra dentro da janela de 45 dias — fechar o onboarding.
**Informações chave:**
- **Sabe como pedir?** *(conhece o canal: app · WhatsApp · vendedor)*
- **A 1ª compra atendeu?** *(prazo de entrega · produto certo · qualidade)*
- **O que falta para a próxima compra**

---

**🤝 RELACIONAMENTO**
**Objetivo:** manter a relação de quem comprou e não engatou — e decidir se segue na carteira.
**Informações chave:**
- **Por que não repetiu**
- **Está comprando de outro?**
- **Vale seguir?** *(manter na carteira · passar para inside · descartar)*

---

**📈 EXPANSÃO**
**Objetivo:** aumentar receita em quem já compra — mix, volume, categoria.
**Informações chave:**
- **Categorias que compra de outro fornecedor** ← o campo mais valioso deste cartão
- **O que foi ofertado** nesta visita
- **Barreira à ampliação** *(preço · prazo de entrega · pedido mínimo · espaço/estoque · crédito)*

---

**🛡️ RETENÇÃO**
**Objetivo:** entender a compra que não veio, antes de virar churn.
**Informações chave:**
- **Por que não comprou este mês** *(fechado: ainda tem estoque · comprou de outro · problema na última entrega · crédito/dívida · caiu o movimento do EC · sem contato · preço)*
- **Vai comprar ainda este mês?** *(sim · não · não sei)*
- **Risco de perder** *(baixo · médio · alto)*

---

### 6.2b O que a tela MOSTRA em cada tipo

Não é campo, e por isso não entra nos três bullets — mas sem isso a pergunta sai no vácuo:

| Tipo | Cabeçalho de leitura |
|---|---|
| 🚩 1ª visita | endereço e CNPJ, para conferir com o que está na porta |
| 🔁 Follow-up | **se há histórico de compra** — ⚠️ obrigatório aqui, mais que em qualquer outro: este tipo atende quem **nunca** comprou **e** ex-cliente (§1); sem isso o vendedor pergunta *"o que falta para a primeira compra"* a um cliente de dois anos |
| ♻️ Reaquisição | data e valor da última compra, e o que ele comprava |
| 🗓️ Recorrência | data/valor da 1ª compra e **quantos dias restam na janela** — é o que dá urgência, e a janela expira sozinha |
| 🤝 Relacionamento | quantas compras fez e quando foi a última |
| 📈 Expansão | ticket médio, frequência e **as categorias que já compra** |
| 🛡️ Retenção | última compra e **a média das últimas 3** — a diferença **é** o assunto da visita |

> ⭐ **O cartão mais valioso dos sete para o negócio é o de REAQUISIÇÃO:** *motivo de churn não existe em lugar nenhum hoje* — nem no ERP, nem no Salesforce. Os outros seis melhoram um registro que já existe; esse **cria** um dado que a empresa não tem.
>
> 📊 **Só três campos dos 21 são opinião do vendedor** (`risco de perder`, `vale seguir?`, `recuperável?`), e os três estão nos tipos em que a decisão **é** de julgamento. O resto é fato observado — que é o que sustenta *"perguntar o fato, nunca a categoria"* ([[spec-07-atividades]] §9).

### 6.3 O que decidir antes de construir

- [ ] **Recortar os 14 `motivo_nao_venda` por tipo?** `ruptura_de_produto` faz sentido em recorrência e nenhum em 1ª visita. ⚠️ É **mudança de contrato** ([[tarefa]] §4), não de tela — muda o enum e o seed
- [ ] **Todo tipo precisa de formulário próprio?** Tipo sem pergunta própria herda só o tronco. Melhor decidir um por um do que nascer com sete arquivos por simetria
- [ ] **Quais desses campos a gerencial vai contar?** Só esses precisam de vocabulário fechado e coluna — o resto pode viver em `notas`
- [ ] **Foto da fachada na 1ª visita** — hoje é parking de Fase 3/4 ([[tarefa]] §6). Entra ou fica fora?
