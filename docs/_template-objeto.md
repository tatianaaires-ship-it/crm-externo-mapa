---
title: "Objeto <Nome> — CRM Externo / Praso Maps"
tipo: objeto-dominio          # objeto-dominio | tabela-referencia
fase: "Fase <n>"
status: rascunho              # rascunho | em-revisao | ratificado
sources:                      # rastreabilidade — de onde veio o conteúdo (não é contrato)
  - "..."
related:                      # "página relacionada" — objetos vizinhos (breadcrumb de navegação)
  - "[[conta]]"
---

# Objeto <Nome>

> **Uma linha:** <o que este objeto é, em uma frase que a IA leia primeiro>.
> **Vizinhos:** [[conta]] · [[visita]] · [[vendedor]]

## 1. Conceito

<Um parágrafo. O que o objeto representa, a definição travada (com dono da decisão),
e qual é a **chave de identidade** (a coluna que deduplica e faz ponte com outros objetos).>

## 2. Decisão-chave

<A UMA decisão arquitetural que molda o objeto. Se não houver, apague esta seção.>
<Ex.: "extensão do auth, não sistema próprio"; "geo separado do cadastro"; "banco a confirmar na Fase 4".>

## 3. Schema-alvo (DDL)

> ⚠️ **Banco a confirmar na Fase 4** — este DDL é **proposto** (Postgres/PostGIS como alvo provável),
> **não travado**. Serve para a IA não adivinhar tipos e relações; não é decisão de stack.

```sql
CREATE TABLE <nome> (
  id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ...
);
```

## 4. Campos

| Campo | Tipo | Obrig. | Origem | Onde aparece | Notas |
|---|---|---|---|---|---|
| `id` | uuid | Sim | auto | — | PK |

- **Origem:** `fonte:sf` · `fonte:cnpja` · `fonte:google` · `derivado` · `admin` · `campo` (digitado pelo vendedor) · `auto`.
- **Onde aparece:** superfície que exibe o campo (`mapa`, `sheet do pin`, `lista/Inteligência`, `form:básico`, `form:expandir`) ou `—`. Esta coluna é a ponte objeto→tela: mata metade da spec de tela.

## 5. Campos derivados / calculados

<Campos que **nunca são digitados** — a regra que os produz. Regra longa → resuma aqui e linke o anexo (§9).>

## 6. O que NUNCA fica aqui

<A fronteira do objeto: o que parece pertencer mas não pertence, e **onde mora de verdade**.
Inclui o "descartar" (encanamento de origem que não faz sentido no novo modelo).>

## 7. Relações

```text
<ERD em ASCII — só as relações que TOCAM este objeto>
```

| Relação | Tipo | Nota |
|---|---|---|
| <A> → <B> | 1:N | ... |

## 8. Regras de domínio / da fatia

<Invariantes e princípios travados (com dono). Regra da fatia atual. Notas de LGPD.
Ex.: "o pin nunca some"; "na dúvida arredonda pra baixo"; "status muda só por fluxo".>

## 9. Anexos / parkings

- **Anexos:** listas grandes, seed data, tabelas de referência — linkados para manter o corpo enxuto.
- **Parkings:** campos/ideias adiados para fatias posteriores (não descartar, não implementar agora).

---
<!--
COMO USAR ESTE MOLDE
- Enxuto por padrão. Se uma seção passar de ~1 tela, quebre em anexo linkado (§9).
- `tipo: tabela-referencia` (ex. cnae_tier, zona) usa só as seções 1, 3, 4 e 9.
- `related:` + o índice em docs/README.md são as DUAS camadas do "doc das docs".
- DDL é sempre "alvo/proposto" enquanto o banco estiver adiado (Fase 4).
- Rastreabilidade vive em `sources:`; o corpo é o CONTRATO, não a narrativa.
-->
