---
title: "SPEC 00 — Design System & App Shell (CRM Externo / Praso Maps)"
tipo: design-spec
fase: "Protótipo do Mapa (Fase 1–2)"
status: ratificado
fonte_de_verdade: "css/styles.css (o doc espelha o CSS, não o inverso)"
sources:
  - "css/styles.css — tokens e componentes implementados"
  - "index.html — estrutura do shell"
  - "_bmad-output/specs/spec-crm-externo/SPEC.md (CAP-1..10, constraints)"
  - "origem-confiabilidade.md (as 4 categorias de origem)"
  - "Ref. estética: Marco Polo (Stone), BEES Force (Ambev)"
related:
  - "[[estabelecimento]]"
  - "[[spec-01-mapa]]"
  - "[[spec-02-pin-sheet]]"
---

# SPEC 00 — Design System & App Shell

> 🎯 **Objetivo.** Definir os padrões visuais, tokens, componentes e a estrutura de navegação que **toda tela do Praso Maps herda**. É o alicerce: cada spec de tela (`spec-01`, `spec-02`…) refere a este documento em vez de repetir tokens.
> ⚠️ **Fonte de verdade = `css/styles.css`.** Este doc **transcreve** o que já está implementado no protótipo. Mudou o CSS, atualize aqui (e vice-versa). Não é design aspiracional.

## 1. Princípios de design

1. **Mobile-first, o mapa no centro.** Não é um CRM de mesa com um mapa dentro; é um mapa em tela cheia com os controles flutuando por cima. O alvo é o vendedor de campo no Android.
2. **PWA nativo e offline-friendly.** Fonte do sistema (sem webfont baixada), `100dvh`, scroll do documento travado, `safe-area` respeitada. O app parece nativo e não depende de rede pra ficar bonito.
3. **Reconhecimento visual antes da leitura.** Cor, emoji e badge dizem o essencial *sem clicar* — o pin é lido de relance (CAP-1).
4. **Acessível por mais de um canal.** Nunca só cor: origem também é comunicada por **forma de borda** e **badge** (pista não-cromática para daltônicos).
5. **Mínimo atrito para registrar.** Criar um lead pede só nome + local; classificação é derivada, nunca digitada. Preferir toque/chip a campo de texto.
6. **Referência estética:** apps de field sales (Marco Polo/Stone, BEES Force/Ambev), **não** CRMs de desktop.

## 2. Paleta de cores (tokens `:root`)

### 2.1 Base

| Token | Hex | Uso |
|---|---|---|
| `--brand` | `#2053CE` | Ações principais, FAB, aba ativa, foco |
| `--brand-600` | `#1a44a8` | Press/hover de brand |
| `--brand-050` | `#e8effc` | Fundo suave, ring de foco (3px) |
| `--ink` | `#0f172a` | Texto primário; chips ativos; banners |
| `--ink-2` | `#334155` | Texto secundário forte |
| `--muted` | `#64748b` | Texto terciário, labels, placeholders |
| `--bg` | `#eef1f6` | Fundo do app |
| `--surface` | `#ffffff` | Cards, barras, sheets |
| `--surface-2` | `#f8fafc` | Fundo sutil, botão ghost |
| `--line` | `#e2e8f0` | Bordas de card, divisores |
| `--line-2` | `#cbd5e1` | Bordas de input/chip, handle |

### 2.2 Semânticas

| Papel | Hex | Uso |
|---|---|---|
| Success / check-in | `#10b981` (texto forte `#059669`) | Positivo; botão de check-in; geo validado |
| Warning / check-out | `#f59e0b` | Atenção; botão de check-out; acento de nota |
| Danger | `#dc2626` | Erro de campo, ação destrutiva |
| Hint positivo | `#059669` sobre `#d1fae5` | Selo "validado em campo" no sheet |

### 2.3 Origem / confiabilidade do pin — **load-bearing (CAP-1)**

A cor do pin = **de onde veio o dado**. A escala completa e a regra de derivação vivem em [[estabelecimento]] §5.

| Categoria | key CSS | Cor | Confiabilidade | Pista não-cromática |
|---|---|---|---|---|
| CNPJá puro | `cnpja_puro` | `#8A94A6` cinza | Menor | **borda tracejada** |
| Google puro | `google_puro` | `#2E7DF6` azul | Média | — |
| CNPJá + Google | `cnpja_google` | `#12B981` verde | Alta | **borda mais grossa (3px)** |
| Validado em campo | `validado_campo` | `#7C3AED` roxo | Máxima | **badge `✓`** |

> A cor entra via variável `--pin`; o miolo do pin é um dot branco. As mesmas pistas se repetem na legenda e nos dots da lista (Inteligência). *(O emoji de tipologia é previsto no CSS mas **não é renderizado** no `map.js` atual — o marker é origin-only. Ver [[spec-01-mapa]] §3.)*

### 2.4 Qualidade (Ouro/Prata/Bronze)

Derivada do CNAE (ver [[cnae_tier]]). Aparece como pill no sheet, badge na lista e chips no filtro.

| Tier | Hex |
|---|---|
| Ouro | `#C9971B` |
| Prata | `#7E8CA0` |
| Bronze | `#B06A3B` |

### 2.5 Ciclo de vida do cliente — ⚠️ **a definir**

Quando os campos comerciais do Estabelecimento (`status_cliente`: ativo/em risco/inativo/reconquistado) chegarem à tela, precisarão de cores próprias (o CSS ainda não as tem). **Buraco marcado**, não preenchido — evitar colidir com o semáforo de origem/qualidade.

## 3. Tipografia

**Família:** stack nativa — `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Sem webfont (decisão: app de campo/offline). *(O SPEC 00 do CRM-KA usa Inter; aqui é deliberadamente nativo.)*

| Elemento | Tamanho | Peso | Cor |
|---|---|---|---|
| Título de sheet/modal | 18–19px | 700 | `--ink` |
| Título de bloco/card | 13px | 800 | `--ink` |
| Corpo | 13.5–14px | 400–600 | `--ink` / `--ink-2` |
| Label de grupo | 12px, UPPERCASE, `letter-spacing .04em` | 700 | `--muted` |
| Small / sub | 11–12.5px | 400–600 | `--muted` |
| Badge/pill | 11–12.5px | 700–800 | cor do badge |
| Números (CNPJ, durações) | — | 500 | `--ink-2`, `font-variant-numeric: tabular-nums` |

> **Inputs = 16px** sempre (evita zoom automático do iOS ao focar). Regra travada.

## 4. Tokens de forma, sombra e espaço

- **Raios:** `--r-sm 10px` · `--r-md 14px` · `--r-lg 20px` · `--r-pill 999px`.
- **Sombras:** `--shadow-sm` (cards/barras) · `--shadow-md` (flutuantes: legenda, FAB-locate, toast) · `--shadow-lg` (projeta pra **cima** — sheets e modais).
- **Alturas de barra:** topbar `56px` · quickbar `52px` · bottomnav `56px` (todas + safe-area).
- **Safe-area:** `--sat` (topo/notch) e `--sab` (base/barra de gesto) somadas às barras e aos flutuantes ancorados no rodapé (FAB, toast).

## 5. App Shell — estrutura

Layout em coluna, `height: 100dvh`, `overflow: hidden` (o app não rola; o conteúdo interno rola). O mapa é `flex: 1` e **tudo mais flutua sobre ele**.

```text
┌───────────────────────────────────────────┐
│ TOPBAR (56)   ◈ CRM Externo   [count] [⟲]  │  z 40
├───────────────────────────────────────────┤
│ QUICKBAR (52) [chips de filtro…]  [Filtros]│  z 39
├───────────────────────────────────────────┤
│                                           │
│                 MAPA (flex:1)             │  z 1
│         ◎ (locate)              ＋ (FAB)   │  z 30
│    [legenda]        [banners de modo]     │
│                                           │
├───────────────────────────────────────────┤
│ BOTTOM NAV (56)  🗺️ Mapa | 📊 Funil | 📋 Intel. │  z 41
└───────────────────────────────────────────┘
```

### 5.1 Pilha de z-index (a espinha do shell)

| Camada | z-index |
|---|---|
| Mapa | 1 |
| Aba Inteligência (cobre o mapa) | 25 |
| FAB criar / FAB localizar | 30 |
| Banners de modo (placing/moving) | 35 |
| Popover de classificação (+backdrop 37) | 38 |
| Quickbar | 39 |
| Topbar | 40 |
| Bottom nav | 41 |
| Install toast | 44 |
| Backdrop de sheet/filtro | 45 |
| Sheet / painel (bottom) | 50 |
| Toast / modal de criação | 60 |

### 5.2 Navegação

Bottom nav de **3 abas** — Mapa, **Funil** (Kanban por status) e Inteligência — que **compartilham os mesmos filtros** (mudar filtro atualiza as três). Não há sidebar (contraste deliberado com o CRM-KA). Aba ativa: cor `--brand` + barrinha de 3px no topo do tab. Nas abas Funil e Inteligência, os controles do mapa (FAB, banners) somem.

**Tela de entrada (porteiro).** Em build com porteiro configurado (`js/config.js`), o app abre numa **tela de login** sobre o shell (`#login-gate`, z 100): login `@praso.com.br` carrega o dado real; **"Seguir sem login"** segue no fictício, com um "Entrar" no topo para logar depois. Sem porteiro, vai direto ao mapa. (Detalhe do fluxo em `porteiro/README.md`.)

## 6. Componentes

### 6.1 Pin (componente-assinatura)
Corpo circular 34px, borda branca 2.5px, cauda (tip) abaixo. `--pin` = cor da origem; dot branco central; badge `✓` = validado. *(Emoji de tipologia previsto no CSS, mas o protótipo atual renderiza só a cor da origem — ver [[spec-01-mapa]] §3.)* Estados: `is-selected` (escala 1.22 + halo brand), `--moving` (escala + halo), `--new` (animação `pinPop`), `--temp` (pulso roxo `pulse`). Pistas não-cromáticas: `cnpja_puro` borda tracejada, `cnpja_google` borda 3px.

### 6.2 Chips de filtro / quickbar
Pill com borda `--line-2`; ativo = fundo `--ink` texto branco. Variante origem pinta com a cor da categoria (`--co`). Atalho "Classificação" abre popover de tipologias; badge numérico mostra quantos ativos.

### 6.3 Botão Filtros
`.filters-btn` — fundo `--brand`, pill, com badge branco de contagem. Abre o painel de filtros (bottom-sheet).

### 6.4 Legenda
Card semi-transparente (`backdrop-filter: blur`) colapsável, ancorado no canto do mapa. Repete cor + pista não-cromática + rótulo de confiança das 4 origens.

### 6.5 FAB
`＋` criar (58px, `--brand`, sombra colorida) e `◎` localizar (46px, branco). Ambos esmaecem (opacity .3) durante placing/moving.

### 6.6 Sheet / Painel (bottom sliding)
Base comum: sobe de baixo (`translateY`), `border-radius` no topo, `max-height 86dvh`, handle de 40×4px, `--shadow-lg`. Usado por: **pin-sheet** (detalhe do local), **painel de filtros**. Transição `.3s cubic-bezier(.22,.61,.36,1)`. No desktop (≥620px) viram cards flutuantes centralizados.

### 6.7 Pin-sheet (anatomia)
Avatar (cor da origem + emoji) · nome + sub · **origin-card** (badge + escada de confiança em dots) · **info rows** (chave/valor) · **blocos** (check-in/out, notas) · **notas** (sempre visíveis; nota = cartão âmbar; input inline). Botões check-in (verde) / check-out (âmbar).

### 6.8 Modal de criação
Sobe de baixo, borda superior 3px `--brand`, **sem scrim bloqueante** (o mapa e o marcador roxo seguem arrastáveis por trás). Campo básico (nome) + "Mais detalhes" expansível (tipologia, CNPJ, telefone) + dica de qualidade derivada.

### 6.9 Card de lead (aba Inteligência)
Linha com dot de origem (mesmas pistas do pin), nome, sub, CNPJ e badge de qualidade. Toque foca o pin correspondente no mapa.

### 6.10 Transientes
**Toast** (pill escuro, rodapé, acima da nav) · **banners de modo** (`placing`/`moving`, faixa escura no topo do mapa) · **install-toast** (Android, "Adicionar à tela inicial") · **empty states** (mapa e lista, com CTA "Limpar filtros").

## 7. Ícones

Hoje **baseados em emoji/glifos** (vanilla, sem lib): `◈` marca · `＋` criar · `◎` localizar · `⟲` reset · `≡`/`🎛` filtros · `🗺️`/`📋` nav · `🔎` busca · `👆`/`✥` banners · `✓` validado. *(O CRM-KA usa Lucide via React.)* **Parking:** se o produto real for React, migrar para um set consistente (ex. Lucide) e mapear os emojis atuais.

## 8. Responsividade

Mobile-first com **um único breakpoint**: `@media (min-width: 620px)` — sheets/painéis viram cards flutuantes centralizados, modal centraliza, lista ganha `max-width`. Não há layout de desktop dedicado (sem sidebar). Alvo: **Android PWA**; desktop é "abre e funciona", não otimizado.

## 9. Movimento

- Transições curtas: `.1–.15s` (toques/press: `scale .94–.97`), `.2s` (aparições), `.3s` (sheets).
- Keyframes: `pinPop` (pin novo), `pulse` (pin temporário roxo), `slideUp` (modal), `dropIn` (banners/install).
- Curva das sheets: `cubic-bezier(.22,.61,.36,1)`.

## 10. Estados

- **Placing** (`body.is-placing`): cursor crosshair, banner "toque no mapa", FABs esmaecidos.
- **Moving** (`body.is-moving`): banner "arraste o pin", FABs esmaecidos, pin em halo.
- **Empty:** card central no mapa / bloco na lista, ambos com "Limpar filtros".
- **Loading:** o protótipo é estático (sem loading). **Parking:** no produto real, usar *skeleton screens* (não spinners), à la SPEC 00 do CRM-KA.

---

## Como cada spec de tela usa este documento

Uma spec de tela (`spec-01-mapa`, `spec-02-pin-sheet`…) **não repete** tokens nem componentes: referencia este SPEC 00 e descreve só o que é próprio da tela (layout específico, dados exibidos — ver a coluna "Onde aparece" de [[estabelecimento]] —, fluxos e casos de borda).
