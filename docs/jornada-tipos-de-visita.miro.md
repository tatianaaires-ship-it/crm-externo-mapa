# Levar a jornada de/para o Miro

> **Para que serve este arquivo:** o Miro **não importa** arquivo de fluxograma. O que ele lê é **código de diagrama** (Mermaid), e transforma em **formas nativas** — caixas e setas que você arrasta como qualquer coisa que desenhou lá. Então este arquivo não é para editar: é o **transporte**.
>
> ⚖️ **O fluxo de origem é o board do Miro** (desenhado em 03/08). Este bloco é o espelho dele, mantido para quem precisa recriar o board ou levá-lo para outra ferramenta.

## Como colar

1. Abra o board.
2. **Diagramming** (ou `+` → *Diagram*) → **Mermaid** / *Diagram from code*. *(Em alguns planos: **Miro AI → Diagram**.)*
3. Cole o bloco. Sai **horizontal**, tudo selecionável.

## O fluxo — 7 tipos em 2 bandas

```
flowchart LR
    S([Estabelecimento recebe visita]) --> R{Oportunidade de aquisicao?}

    R -- Sim --> Q1{Ja comprou na Praso?}

    Q1 -- Nao --> V1{Visita nos ultimos 120 dias?}
    V1 -- "Nao / Nunca" --> T1[1a VISITA<br/>mapeamento do estabelecimento]
    V1 -- Sim --> T2[FOLLOW-UP<br/>o que falta para a compra?]

    Q1 -- Sim --> V2{Visita nos ultimos 120 dias?}
    V2 -- "Nao / Nunca" --> T3[REAQUISICAO<br/>por que parou de comprar?]
    V2 -- Sim --> T2b[FOLLOW-UP<br/>o que falta para a compra?]

    R -- Nao --> E{Estagio no funil de recorrencia}
    E -- "Disp 2a/3a - 45 dias" --> T4[RECORRENCIA<br/>fechamento do onboarding]
    E -- "Nao recorrente +45 dias" --> T5[RELACIONAMENTO<br/>acompanhamento do cliente]
    E -- Recorrente --> M1{Comprou no mes corrente?}

    M1 -- Sim --> T6[EXPANSAO<br/>complemento de mix e aumento de receita]
    M1 -- Nao --> M2{Comprou no mes anterior?}
    M2 -- Sim --> T7[RETENCAO<br/>por que a compra do mes nao veio?]
    M2 -- Nao --> T6b[EXPANSAO<br/>complemento de mix e aumento de receita]
```

> ⚠️ **Sem acento e sem emoji de propósito.** Importador de diagrama é a parte mais frágil de qualquer ferramenta, e caractere especial em rótulo é onde ele quebra primeiro. Depois de colar, renomeie no Miro com acento e emoji à vontade — ali já é texto nativo.

## A escada do silêncio

```
flowchart LR
    A[comprou este mes<br/><br/>EXPANSAO] --> B[comprou mes passado<br/><br/>RETENCAO - um mes so]
    B --> C[30 a 120 dias sem comprar<br/><br/>EXPANSAO - volta a ser]
    C --> D[mais de 120 dias<br/><br/>REAQUISICAO - troca de banda]
```

## Os sete cartões, para colar nas formas que você já desenhou

Um bloco por forma, na ordem do quadro. **Copie e cole dentro de cada cápsula** — é texto, não precisa de importador.

```
1ª VISITA
Objetivo:
conhecer o EC e saber se é oportunidade real — é a visita que corrige a base
Informações chave:
- perfil real: trabalha food service? tipologia observada
- fornecedor atual e frequência
- quem decide (cargo) + melhor dia/hora para voltar
```

```
FOLLOW-UP
Objetivo:
destravar o primeiro pedido — o que exatamente falta para o sim
Informações chave:
- o que precisa acontecer para fechar (lista fechada)
- prazo esperado da decisão
- já recebeu proposta? já testou produto?
```

```
REAQUISIÇÃO
Objetivo:
entender por que parou de comprar e se dá para trazer de volta
Informações chave:
- motivo de ter parado (lista fechada)
- de quem compra hoje
- o que traria de volta + é recuperável?
```

```
RECORRÊNCIA
Objetivo:
fazer sair a 2ª/3ª compra dentro da janela de 45 dias
Informações chave:
- sabe como pedir? (canal)
- a 1ª compra atendeu? (prazo, produto, qualidade)
- o que falta para a próxima compra
```

```
RELACIONAMENTO
Objetivo:
manter a relação de quem comprou e não engatou — e decidir se segue na carteira
Informações chave:
- por que não repetiu
- está comprando de outro?
- vale seguir? (carteira / inside / descartar)
```

```
EXPANSÃO
Objetivo:
aumentar receita em quem já compra — mix, volume, categoria
Informações chave:
- categorias que compra de outro fornecedor
- o que foi ofertado nesta visita
- barreira à ampliação (lista fechada)
```

```
RETENÇÃO
Objetivo:
entender a compra que não veio, antes de virar churn
Informações chave:
- por que não comprou este mês (lista fechada)
- vai comprar ainda este mês?
- risco de perder (baixo / médio / alto)
```

> ⚖️ **A moldura de três bullets é a regra, não o desenho.** O check-out é a tela mais usada do app e o vendedor está em pé na porta do cliente: o que não cabe em três não entra. E **nada aí repete o tronco comum** (TD encontrado · Vendeu? · motivo · notas · agendar a próxima), que é perguntado nos sete — repetir faria o vendedor responder duas vezes a mesma coisa.

## Depois de colar

O import chega sem cor. Três decisões visuais contam a história:

| O que | Sugestão | Por quê |
|---|---|---|
| As **duas bandas** | dois retângulos de fundo cinza, rotulados `AQUISIÇÃO` e `RECORRÊNCIA` | a banda é a primeira leitura do fluxo, antes de qualquer tipo |
| Os **7 tipos** | azul/índigo | é o destino — o formulário que abre |
| As **perguntas** | branco/cinza | é encanamento, não conclusão |

E vale um sticky para cada coisa que está aberta: o **pico do dia 1º**, o ***fallback*** de quando o estágio do funil não tem dado, e a pergunta **de quem é a banda de recorrência** (inside/growth × campo).

⚖️ **O que fica sendo fonte de verdade:** o **board** é o desenho. Os **cenários e as decisões** ficam em [`jornada-tipos-de-visita.md`](jornada-tipos-de-visita.md), e o **contrato** em [`objetos/tarefa.md`](objetos/tarefa.md) §4c — board não versiona nem guarda rationale, e decisão que só existe num quadro se perde na próxima limpeza.
