---
title: "Documentação — CRM Externo / Praso Maps"
tipo: indice-raiz
status: vivo
atualizado: "2026-07-23"
---

# 🗺️ Documentação — Praso Maps (CRM Externo)

> **Você é uma IA ou dev chegando agora? Comece por aqui.** Este é o mapa da documentação:
> diz **o que existe, onde ler, e em que ordem**. Cada doc de objeto aponta para os vizinhos
> (`related:` no topo) — então você entra por qualquer porta e acha o resto.

## Como está organizado

```text
docs/
├── README.md            ← você está aqui (o "doc das docs")
├── _template-objeto.md  ← molde para criar um novo doc de objeto
├── objetos/             ← um doc por objeto de domínio (o CONTRATO de dados)
└── telas/               ← um doc por tela/superfície (a definir — próxima frente)
```

**Duas camadas de navegação:** (1) este índice na raiz; (2) o campo `related:` no topo de cada doc,
que linka os objetos vizinhos. Contrato de dados mora em `objetos/`; a narrativa/rationale que o
originou fica em `sources:` (rastreabilidade), não no corpo.

## Objetos

| Objeto | Doc | Tipo | Status |
|---|---|---|---|
| **Estabelecimento** — o ponto no mapa: cliente cadastrado **ou** não (o pin) | [objetos/estabelecimento.md](objetos/estabelecimento.md) | domínio | 🟡 em revisão |
| **Tarefa** — a atividade datada no pin; **check-in/out é a própria tarefa** | [objetos/tarefa.md](objetos/tarefa.md) | domínio | 🟡 em revisão |
| **Rota** — conjunto de estabelecimentos de um vendedor num dia; **cada parada é uma Tarefa** | [objetos/rota.md](objetos/rota.md) | domínio | 🚧 rascunho |
| **Vendedor / Usuário** — quem opera, e alvo de RLS | `objetos/vendedor.md` | domínio | ⬜ a fazer |
| ~~**Visita**~~ — absorvida por [Tarefa](objetos/tarefa.md) (27/07): check-in/out **é** a tarefa | ~~`objetos/visita.md`~~ | — | ⛔ não existe |
| **cnae_tier** — CNAE → tier; deriva `qualidade` (editável no Admin) | `objetos/cnae_tier.md` | referência | ⬜ a fazer |
| **Zona** — território de atuação (**`zona_guardioes_c`**: 15 fixas + `Sem Zona`) | `objetos/zona.md` | referência | ⬜ a fazer |

> **Decisão 23/07 — Lead + Conta são um só objeto, chamado `Estabelecimento`.** Um ponto pode ser cliente cadastrado ou não; o campo derivado `cadastrado` distingue, e os campos comerciais (cadastro, 1ª/última compra, limite de crédito, saldo devedor, ticket médio, frequência, inadimplência, ciclo de vida) vivem no mesmo registro. **Não há objeto Conta separado.** (O código do protótipo em `js/` ainda usa "lead" — alinhar o naming é tarefa parkada.)
> `nota_estabelecimento` (notas do pin, 1:N) também vive dentro de [Estabelecimento](objetos/estabelecimento.md), não é doc próprio.

> **Decisão 27/07 — Check-in/out É a Tarefa, são sinônimos.** Não existe objeto `Visita`: a atividade datada, o check-in, o check-out e o desfecho vivem num só registro ([Tarefa](objetos/tarefa.md)). O `resultado` da tarefa concluída é o **único** caminho automático que move o `status` do Estabelecimento no funil.

> **Decisão 29/07 (b) — a fatia de FILTROS: "Fase" ≠ "Status", zona fechada e porte real.** Quatro mudanças. (1) O filtro do funil passou a se chamar **Fase** em todo o app (a chave segue `status`). (2) Nasceu **`status_cliente`** como filtro — `lead` · `csc` · `recorrente` · `churn` —, **derivado** de `cadastrado` + `status`, e que **existe para todo pin**, não só para cliente: é o `status_cliente` que a [SPEC 00 §2.5](telas/spec-00-design-system.md) tinha como buraco marcado, chegando com o vocabulário da operação. (3) **Porte** foi de 4 para **6 faixas**, uma por valor real de `porte_c` (`LTDA` morreu, virou `DEMAIS`). (4) **Zona** trocou de coluna — `zona_2_c` → **`zona_guardioes_c`** — e virou **vocabulário fechado**: 15 zonas + `Sem Zona`, com 16 chips fixos no painel. Contrato em [Estabelecimento §5](objetos/estabelecimento.md); régua em [snapshot §3](snapshot-dado-real.md).
> ⚠️ **Zona não é bairro.** No protótipo `zone` era o bairro e era ele que dava coordenada, endereço e DDD — então o bairro **não** foi absorvido: virou o campo `bairro`, e a zona passou a ser a zona. Foi isso que obrigou o `localStorage` a subir para **v9**.
> 🏆 **Decisão 29/07 (c) — a quickbar ganhou um PRESET e perdeu dois recortes.** Entrou **🏆 Aquisição** (dourado), que liga **quatro filtros de uma vez** para isolar oportunidades reais: `porte ≠ MEI` · `qualidade ∈ {Ouro, Prata}` · `status do cliente ∈ {lead, csc, churn}` · `fase ∉ {perdido, desqualificado}` — 29 dos 61 pins no fictício. Saíram **🥇 Ouro** (absorvido pelo preset) e **✓ Validado em campo** (procedência não é intenção de trabalho); os dois seguem no painel completo. O preset **marca os chips** em vez de esconder a regra, e seu estado é **derivado** — mexer num filtro dele apaga o destaque sozinho. Detalhe em [SPEC 01 §5](telas/spec-01-mapa.md) e [SPEC 00 §6.2b](telas/spec-00-design-system.md).
> 🔎 **Decisão 29/07 (d) — a BUSCA virou dimensão de filtro, e o mapa ganhou a sua.** A quickbar do Mapa ganhou uma **lupa** que abre um campo de largura cheia (nome fantasia · razão social · CNPJ por dígitos — a mesma `matchBusca` de sempre). O ponto não é a caixa nova: é que a busca deixou de ser recorte local e virou **`CRM_FILTERS.q`**, então vale nas **quatro abas** e conta no badge. A caixa da Inteligência passou a escrever no mesmo lugar — ⚠️ **mudança de comportamento lá**: digitar na Intel agora filtra o mapa. Em troca, o app para de se contradizer (a Intel prometia "o mesmo conjunto filtrado" e mostrava outro). O mapa **reenquadra** nos resultados, senão buscar algo em Fortaleza estando no Recife deixa a tela vazia sem dizer por quê. E a busca **sugere enquanto se digita**: dropdown com até 8 casamentos (ranqueados por prefixo do nome, com rodapé dizendo quantos sobraram), e **tocar num item leva ao pin e abre o sheet**. As duas coisas convivem — o filtro responde *"quais casam"*, a lista responde *"é este"*. Detalhe em [SPEC 01 §5.2](telas/spec-01-mapa.md) e [SPEC 00 §6.2c](telas/spec-00-design-system.md).
> ⭐ **A busca ACHA o que o filtro esconde — e revela sem mexer no filtro.** A lista varre **todos** os pins, não o conjunto filtrado: uma busca que não acha o ponto porque um chip está ligado não serve para nada, e a pessoa não tem como saber de quem é a culpa. **Achar é função da busca; filtrar é função do filtro.** O item oculto vem marcado (`fora do filtro`, âmbar) e, ao ser escolhido, entra no mapa como **pin momentâneo** com anel âmbar — fora do `matches`, então o pill, o badge e as outras três abas continuam dizendo a verdade sobre o recorte. Termina ao fechar o sheet ou trocar de pin. Mexer nos chips por baixo seria pior: destruiria o recorte que a pessoa montou. Isso virou padrão em [SPEC 00 §6.2c](telas/spec-00-design-system.md): **revelar em vez de mexer no filtro**.

> ⏱️ **Decisão 29/07 (e) — a visita em andamento ganhou faixa no mapa, e passou a ser UMA no app.** O check-in aberto só existia **dentro do sheet do pin**: fechado o sheet — ou o app, já que o estado persiste —, a visita em curso não tinha sintoma nenhum na tela. E a regra era *"uma atividade aberta **por pin**"*, então dava para fazer check-in em A, fechar o sheet e fazer check-in em B: **duas visitas abertas ao mesmo tempo, as duas invisíveis**. Entraram as duas peças juntas: **faixa** verde no rodapé do mapa (`⏱️ {ponto} · check-in há 43 min` + `Check-out ›`, a barra toda é o toque, leva direto ao sheet de conclusão) e **invariante global** — check-in em qualquer outro pin é recusado com a oferta de fechar o que está aberto. Passando de **8h** ou virando o dia, a faixa fica **âmbar** e diz `aberto desde ontem, 14:32`. Detalhe em [SPEC 07 §2.4](telas/spec-07-atividades.md) · [SPEC 01 §6.1](telas/spec-01-mapa.md) · [SPEC 00 §6.15](telas/spec-00-design-system.md).
> ⚖️ **Bloquear exige dar a saída** — faixa e bloqueio são uma coisa só: sem a faixa, "não pode abrir outra" seria beco sem saída. E a recusa **nomeia o ponto**: recusar em silêncio é o pior desfecho, porque o vendedor toca e nada muda.
> ⚠️ **Ponta solta declarada:** o check-out de uma visita esquecida ainda grava a **duração cheia** ("19h em campo"), e é esse número que a Gerencial mostra. O que fazer com ele — não contar, marcar como não confiável, ou criar `encerrar sem desfecho` — **é decisão em aberto**, não escolhida em silêncio. O âmbar avisa antes de fechar; não corrige o dado.
> 📍 **E a distância real (GPS) segue fictícia** — `distancia_km` é semeada, não medida, mesmo com `navigator.geolocation` já ligado no FAB "minha localização". Medir de verdade é a fatia seguinte, e o lugar da medição é o **check-in**, não o check-out (no check-out o vendedor já pode estar no carro — mediria a saída, não a presença).

> ✅ **E o preset achou um buraco antigo: o vazio precisa de nome.** A lista-branca de porte escondia o **pin criado em campo** (porte nulo até o CNPJá responder) da própria lista de aquisição. Entrou o chip **`Sem porte`**, como o `Sem Zona` — a regra que fica é: **dimensão de filtro que aceita nulo precisa de balde explícito**, senão o pin sai do recorte em silêncio ([SPEC 00 §6.2](telas/spec-00-design-system.md)).
> ⚠️ **`churn` e `MEI` nascem vazios, e isso é a verdade:** `churn` não tem fonte no `salesforce.lead` (não há compra nem pedido lá) e MEI está fora do recorte do snapshot, que o exclui duas vezes.
> 🔴 **O snapshot em disco precisa ser regerado** — gerado com `zona_2_c`, ele joga **5.183 dos 6.914** pins em `Sem Zona`, porque as duas colunas têm taxonomias diferentes.

> **Decisão 29/07 (a) — a COR do pin virou a relação comercial; a origem desceu para PISTA de forma.** Até aqui a cor era `origem_confianca` em 4 categorias. Agora são dois eixos ortogonais em canais diferentes: **cor** = `cadastrado` (azul cliente / lilás lead) e **pista** = degrau de origem (tracejado `cnpj` · badge `G` · badge `✓`). Nenhum degrau depende mais de matiz — era o ponto fraco da CAP-1. A escada caiu de 4 para **3 degraus aditivos** (`cnpj` ⊂ `google` ⊂ `validado_campo`): todo ponto nasce da base de CNPJ, o Google **enriquece**, o campo confirma. A categoria **"Google puro"** deixou de existir, logo a **inversão-tese "Google puro > CNPJá puro" fica DORMENTE, não revogada** — sem a categoria, ela não tem sujeito. Detalhe em [SPEC 00 §2.3](telas/spec-00-design-system.md) · [SPEC 01 §3](telas/spec-01-mapa.md) · [Estabelecimento §5](objetos/estabelecimento.md).
> ⚠️ **A cor só carrega verdade comercial no modo real** (177 dos 6.914 pins vêm de `status = 'Cadastrado'` no Salesforce). No dataset fictício `cadastrado` é inventado por design — por isso a legenda ganhou nota de procedência, âmbar no fictício e verde no real.

> **Decisão 28/07 — a Tarefa passou a ser a PARADA de uma Rota, e Rota entrou como RASCUNHO.** A [Tarefa](objetos/tarefa.md) §6 mantinha Rota fora de escopo até a Fase 4 (*"uma tarefa não é uma parada"*); com a Agenda em calendário mostrando rotas, ela ganhou `rota_id` + `hora` e o rótulo derivado `nome_rota` morreu. O que existe é o **mínimo** ([Rota](objetos/rota.md)): identidade, nome, dia e dono. **Sequenciamento e otimização de trajeto continuam Fase 4** — é o que mantém o objeto de verdade adiado. Tarefa sem `rota_id` é **avulsa**.

## Design & Telas

O **SPEC 00** é o alicerce visual (tokens, componentes, shell) que toda spec de tela herda — extraído do `css/styles.css` real. As specs de tela derivam dos objetos: a coluna **"Onde aparece"** de cada doc de objeto ancora qual superfície mostra cada campo.

| Spec | Doc | Status |
|---|---|---|
| **SPEC 00 — Design System & App Shell** | [telas/spec-00-design-system.md](telas/spec-00-design-system.md) | 🟡 em revisão |
| **SPEC 01 — Mapa** (pins, quickbar, legenda, FAB) | [telas/spec-01-mapa.md](telas/spec-01-mapa.md) | 🟡 em revisão |
| **SPEC 02 — Pin Sheet** (detalhe, notas, check-in) | `telas/spec-02-pin-sheet.md` | ⬜ a fazer |
| **SPEC 03 — Filtros** (painel + quick filters) | `telas/spec-03-filtros.md` | ⬜ a fazer |
| **SPEC 04 — Criar pin** | `telas/spec-04-criar.md` | ⬜ a fazer |
| **SPEC 05 — Inteligência** (lista de leads) | `telas/spec-05-intel.md` | ⬜ a fazer |
| **SPEC 06 — Funil** (Kanban por status, arrastar card) | [telas/spec-06-funil.md](telas/spec-06-funil.md) | 🟡 em revisão |
| **SPEC 07 — Atividades** (bloco no pin, agenda em calendário de rotas, visão gerencial com gráficos, desqualificar) | [telas/spec-07-atividades.md](telas/spec-07-atividades.md) | 🟡 em revisão |

> ⚠️ **SPEC 00 voltou a 🟡 em 29/07.** A **decisão** de §2.3 está ratificada (foi tomada na sessão), mas o **texto** que a espelha é novo e ainda não passou pela sua leitura — e a regra do projeto é que o SPEC 00 espelha o `css/styles.css`, não o contrário. Volta a ✅ depois que você ler §2.3, §2.5, §6.1 e §6.2.

> Superfícies do protótipo: **mapa** · **sheet do pin** (com sub-telas de atividade) · **filtros/acesso rápido** · **criar pin** · **aba Funil (Kanban)** · **aba Atividades (gerencial + agenda)** · **aba Inteligência**. Nav de 4 abas, nesta ordem: 🗺️ Mapa · 📋 Intel. · 📊 Funil · 🗓️ Atividades. Cada spec de tela referencia o SPEC 00 em vez de repetir tokens.

## Contratos e fontes de verdade (rastreabilidade)

- **Contrato do protótipo:** [`_bmad-output/specs/spec-crm-externo/SPEC.md`](../_bmad-output/specs/spec-crm-externo/SPEC.md) — capabilities, constraints, non-goals, success signal.
- **Snapshot de dado real (Fase 3):** [snapshot-dado-real.md](snapshot-dado-real.md) — contrato `salesforce.lead` → shape do protótipo (query, mapeamento, derivações, minimização LGPD).
- **Planejamento/fases:** `_bmad-output/planning-artifacts/` (PR-FAQ, plano revisado, decisão de banco).
- **Referência externa (outro produto Praso):** doc "👤 Usuário" do **CRM para KA** (Notion) — de onde veio o esqueleto deste molde de objeto.

## Convenções

- **DDL é sempre "alvo/proposto"** enquanto o banco estiver adiado (Fase 4). Não é decisão de stack.
- **Origem** de campo: `fonte:sf|cnpja|google` · `derivado` · `admin` · `campo` (digitado) · `auto`.
- **Classificação nunca é digitada** — `qualidade`, `origem_confianca`, `porte` são derivados/chegam prontos.
- Novo objeto? Copie [`_template-objeto.md`](_template-objeto.md), preencha, e adicione a linha na tabela acima.
