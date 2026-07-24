# Praso Maps — CRM Externo

Protótipo **PWA** (vanilla JS + Leaflet, sem build) de gestão comercial de campo: um **mapa com pins** de estabelecimentos, para o time de vendas externo. Dados 100% fictícios; alvo Android; instalável como app. Escopo completo (capabilities, constraints, non-goals) em [`_bmad-output/specs/spec-crm-externo/SPEC.md`](_bmad-output/specs/spec-crm-externo/SPEC.md).

## 📖 Leia a documentação antes de trabalhar

A documentação canônica vive em **`docs/`**. O índice mestre abaixo é a porta de entrada — ele diz **o que existe, onde ler e em que ordem**. Ele é importado automaticamente no início da sessão:

@docs/README.md

**Leitura sob demanda (não carregue tudo de uma vez):**

- Vai mexer no **modelo de dados** (campos, schema, um objeto)? Leia o doc do objeto em `docs/objetos/` **antes** — ex.: [`docs/objetos/estabelecimento.md`](docs/objetos/estabelecimento.md).
- Vai mexer em **UI / CSS / uma tela**? Leia [`docs/telas/spec-00-design-system.md`](docs/telas/spec-00-design-system.md) (tokens, componentes, shell) **+** a spec da tela específica (ex.: [`docs/telas/spec-01-mapa.md`](docs/telas/spec-01-mapa.md)).
- Ao criar um **novo objeto** ou **nova spec de tela**, siga os moldes existentes e **adicione a linha no índice** (`docs/README.md`).

## Regras que valem sempre

- **`docs/` é a fonte de verdade**, espelhada no Notion — **o repositório manda**. Mudou o doc, atualize o Notion (e vice-versa); eles não sincronizam sozinhos.
- **`css/styles.css` é a fonte de verdade do design** (o SPEC 00 espelha o CSS, não o contrário).
- O **DDL** nos docs de objeto é **proposto** (Postgres/PostGIS como alvo) — o banco só é decidido na Fase 4. Não trate como travado.
- **Classificação nunca é digitada** (`qualidade`, `origem_confianca`, `porte`, `cadastrado`, `status_cliente` são derivados/chegam prontos).
- **O pin nunca some e nunca se divide** — não há exclusão; filtro apenas oculta.

## Código

- Vanilla JS, **sem build**. Os scripts em `js/` carregam na ordem definida em `index.html` e expõem `window.CRM_*` (`CRM_DATA`, `CRM_STATE`, `CRM_MAP`, `CRM_FILTERS`, `CRM_PIN`, `CRM_INTEL`…).
- Idioma do projeto: **Português (Brasil)** — commits, comentários e UI.
