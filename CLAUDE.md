# Praso Maps — CRM Externo

> 🧊 **CONGELADO PARA DOCUMENTAÇÃO desde 07/08/2026. Não edite `docs/` nem `css/styles.css` aqui.**
>
> A documentação e o design foram **consolidados** em [`praso-eng/tati-wfm-externo`](https://github.com/praso-eng/tati-wfm-externo), com os **47 commits de histórico** (via `git subtree`, não cópia). Lá eles vivem em **`docs/produto/`**, e a fonte de verdade do design passou a ser **`app/styles/crm.css`**.
>
> **O que este repositório ainda é:** o **protótipo** em `js/` + `index.html`, vivo e funcionando, e a **demo pública do GitHub Pages** — que hoje é o único link que existe do produto, porque o app ainda não foi publicado. Mexer no protótipo aqui: **sim**. Mexer em doc ou design aqui: **não** — vai para o outro repo, senão as duas cópias divergem em silêncio.
>
> ⚠️ **Os `docs/` daqui ficaram como estavam em 07/08** e não recebem mais correção. Para ler a versão atual, vá ao outro repo. Este `CLAUDE.md` também deixou de ser o índice de documentação: o de lá é o `AGENTS.md`.

Protótipo **PWA** (vanilla JS + Leaflet, sem build) de gestão comercial de campo: um **mapa com pins** de estabelecimentos, para o time de vendas externo. Dados 100% fictícios; alvo Android; instalável como app. Escopo completo (capabilities, constraints, non-goals) em [`_bmad-output/specs/spec-crm-externo/SPEC.md`](_bmad-output/specs/spec-crm-externo/SPEC.md).

> ⚠️ **Desde 06/08 existe um SEGUNDO repositório, e ele é o app de verdade.** [`praso-eng/tati-wfm-externo`](https://github.com/praso-eng/tati-wfm-externo) — React Router 7 + Supabase, com o banco da Fase 4 e as quatro abas portadas. **Este repo aqui continua sendo a fonte de verdade da DOCUMENTAÇÃO e do DESIGN** (`docs/` e `css/styles.css`); o outro é onde o código vive daqui para frente. Antes de mexer em código, confirme em qual dos dois.

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
- O **DDL** nos docs de objeto está **APLICADO** desde 06/08 (Supabase `wfm-externo-tati`). Mudança de schema é **migration** no outro repo, e o doc espelha a migration — não o contrário. ⚠️ Os invariantes existem **duas vezes**: função pura no app e `CHECK` no banco. Mudou um, muda o outro.
- **Classificação nunca é digitada** (`qualidade`, `origem_confianca`, `porte`, `cadastrado`, `status_cliente` são derivados/chegam prontos).
- **O pin nunca some e nunca se divide** — não há exclusão; filtro apenas oculta.

## Código

- **Aqui:** vanilla JS, **sem build**. Os scripts em `js/` carregam na ordem definida em `index.html` e expõem `window.CRM_*` (`CRM_DATA`, `CRM_STATE`, `CRM_MAP`, `CRM_FILTERS`, `CRM_PIN`, `CRM_INTEL`…).
- **No `tati-wfm-externo`:** React Router 7 com loaders/actions, Supabase service-role só no servidor. O domínio (`app/domain/`) é o port de `js/data.js` + as transições de `js/state.js`, com testes; a UI imperativa foi reescrita.
  - ⚠️ **RLS: está LIGADA nas 7 tabelas e sem policy nenhuma** (medido em 06/08 — este arquivo dizia "sem RLS", e estava errado). Isso nega tudo a `anon`/`authenticated`, e o app só funciona porque a `service_role` ignora RLS. Como os grants de `anon` são completos (até `TRUNCATE`), **a RLS é a única barreira: não desligar, e não criar policy `using (true)`**. Detalhe em [`docs/objetos/estabelecimento.md`](docs/objetos/estabelecimento.md) §3.
- Idioma do projeto: **Português (Brasil)** — commits, comentários e UI.
