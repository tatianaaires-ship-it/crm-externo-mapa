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
| **Zona** — território de atuação (`zona_2_c`) | `objetos/zona.md` | referência | ⬜ a fazer |

> **Decisão 23/07 — Lead + Conta são um só objeto, chamado `Estabelecimento`.** Um ponto pode ser cliente cadastrado ou não; o campo derivado `cadastrado` distingue, e os campos comerciais (cadastro, 1ª/última compra, limite de crédito, saldo devedor, ticket médio, frequência, inadimplência, ciclo de vida) vivem no mesmo registro. **Não há objeto Conta separado.** (O código do protótipo em `js/` ainda usa "lead" — alinhar o naming é tarefa parkada.)
> `nota_estabelecimento` (notas do pin, 1:N) também vive dentro de [Estabelecimento](objetos/estabelecimento.md), não é doc próprio.

> **Decisão 27/07 — Check-in/out É a Tarefa, são sinônimos.** Não existe objeto `Visita`: a atividade datada, o check-in, o check-out e o desfecho vivem num só registro ([Tarefa](objetos/tarefa.md)). O `resultado` da tarefa concluída é o **único** caminho automático que move o `status` do Estabelecimento no funil.

> **Decisão 28/07 — a Tarefa passou a ser a PARADA de uma Rota, e Rota entrou como RASCUNHO.** A [Tarefa](objetos/tarefa.md) §6 mantinha Rota fora de escopo até a Fase 4 (*"uma tarefa não é uma parada"*); com a Agenda em calendário mostrando rotas, ela ganhou `rota_id` + `hora` e o rótulo derivado `nome_rota` morreu. O que existe é o **mínimo** ([Rota](objetos/rota.md)): identidade, nome, dia e dono. **Sequenciamento e otimização de trajeto continuam Fase 4** — é o que mantém o objeto de verdade adiado. Tarefa sem `rota_id` é **avulsa**.

## Design & Telas

O **SPEC 00** é o alicerce visual (tokens, componentes, shell) que toda spec de tela herda — extraído do `css/styles.css` real. As specs de tela derivam dos objetos: a coluna **"Onde aparece"** de cada doc de objeto ancora qual superfície mostra cada campo.

| Spec | Doc | Status |
|---|---|---|
| **SPEC 00 — Design System & App Shell** | [telas/spec-00-design-system.md](telas/spec-00-design-system.md) | ✅ ratificado |
| **SPEC 01 — Mapa** (pins, quickbar, legenda, FAB) | [telas/spec-01-mapa.md](telas/spec-01-mapa.md) | 🟡 em revisão |
| **SPEC 02 — Pin Sheet** (detalhe, notas, check-in) | `telas/spec-02-pin-sheet.md` | ⬜ a fazer |
| **SPEC 03 — Filtros** (painel + quick filters) | `telas/spec-03-filtros.md` | ⬜ a fazer |
| **SPEC 04 — Criar pin** | `telas/spec-04-criar.md` | ⬜ a fazer |
| **SPEC 05 — Inteligência** (lista de leads) | `telas/spec-05-intel.md` | ⬜ a fazer |
| **SPEC 06 — Funil** (Kanban por status, arrastar card) | [telas/spec-06-funil.md](telas/spec-06-funil.md) | 🟡 em revisão |
| **SPEC 07 — Atividades** (bloco no pin, agenda em calendário de rotas, visão gerencial com gráficos, desqualificar) | [telas/spec-07-atividades.md](telas/spec-07-atividades.md) | 🟡 em revisão |

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
