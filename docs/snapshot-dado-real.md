---
title: "Snapshot de dado real — contrato salesforce.lead → protótipo"
tipo: contrato-snapshot (ETL de exibição)
fase: "Fase 3 (puxada p/ a quinzena 20–31/07/2026)"
status: em-uso
sources:
  - "salesforce.lead — Metabase (db 19, tabela 1066, 161 colunas; dialeto MySQL)"
  - "salesforce.user — Metabase (db 19, tabela 880) — nome do vendedor"
  - "js/data.js (shape do pin do protótipo — alvo da transformação)"
  - "docs/objetos/estabelecimento.md (contrato de dados)"
  - "_bmad-output/planning-artifacts/plano-revisado-fases.md (Fase 3 · tarefa 1)"
  - "Decisões Tatiana (2026-07-23): régua de funil, join de vendedor, drop de telefone"
related:
  - "[[estabelecimento]]"
---

# Snapshot de dado real — contrato `salesforce.lead` → protótipo

> **Uma linha:** query no Metabase (`salesforce.lead`) → JSON no shape do pin do protótipo,
> **campos minimizados** (LGPD), **derivações espelhando `js/data.js`**. Só exibição — sem banco, sem fluxo.

> 🔒 **Regra de privacidade (dura):** o JSON de dado real **nunca** entra no Git nem no deploy público
> (GitHub Pages). Ele vive fora do repo e, na Fase 3, é servido pelo **porteiro** (Cloudflare Worker +
> login Google `@praso.com.br`). Público vê fictício; Praso logado vê real, na mesma URL.

## 1. Recorte das linhas (o `WHERE`)

O "lead que importa" para o campo: PJ ativa, Ouro/Prata, não-MEI, com rota, não desqualificado e ainda
não cadastrado. **6.914 leads** batem neste filtro (23/07/2026).

```sql
WHERE l.is_deleted = 0
  AND l.is_converted = 0
  AND l.cnpj_c IS NOT NULL
  AND l.porte_c NOT IN ('me-ei-mei')
  AND l.qualidade_c IN ('Ouro','Prata')
  AND l.situacao_cadastral_lead_c = 'ATIVA'
  AND (l.motivo_desqualifica_o_c NOT IN
        ('CNPJ baixado','Fora da área de entrega','Não é food-service','Negócio fora de funcionamento')
       OR l.motivo_desqualifica_o_c IS NULL)
  AND l.status NOT IN ('Qualified','Unqualified')
  AND l.optante_mei_c = 'Não'
  AND l.vendedor_rota_lead_c IS NOT NULL
```

## 2. Mapeamento campo → coluna

| Campo do protótipo (`js/data.js`) | Coluna(s) `salesforce.lead` | Como |
|---|---|---|
| `id` | `id` | ID SF do lead (chave estável) |
| `name` (nome_fantasia) | `COALESCE(nome_fantasia_c, name)` | `nome_fantasia_c` só 57% preenchido |
| `razaoSocial` | `razao_social_c` | direto |
| `cnpj` | `cnpj_c` | direto (chave de dedup) |
| `cnaeCodigo` | `cnae_principal_c` | código 7 díg (99,5%) — usar o **código**, não a descrição |
| `cnaeDescricao` | `atividade_cnae_principal_c` | cache (há variações sujas: usar como rótulo, não como chave) |
| `typology` | **derivado** de `cnae_principal_c` | `categorias_c`/`industry` são 100% nulos → lookup §3 |
| `address` | `street`+`bairro_c`+`city`+`state`+`postal_code`+`complemento_endereco_c` | consolidar |
| `lat`/`lng` (**onde o pin fica**) | `COALESCE(verificada, original)` — `latitude_verificada_lead_c` / `longitude_verificada_lead_c` e, na falta, `latitude` / `longitude` | ⚠️ **mudou em 30/07** (era só `latitude`/`longitude`). A verificada **manda**: a crua é, em boa parte da base, o **centroide** do bairro/cidade. Medido: **2.110 pins mudam de lugar**, mediana **2,5 km** (§3) |
| `geoVerificado` | `latitude_verificada_lead_c` / `longitude_verificada_lead_c` | 2.110/6.914; + `coordenadas_corrigidas_c`, `data_correcao_pin_c`, `motivo_correcao_pin_c`. **Continua campo próprio** — é o que diz que a coordenada *foi* verificada; o `lat`/`lng` só diz onde desenhar |
| `bairro` | `bairro_c` | **novo em 29/07** — geografia fina; não é a zona |
| `zone` (zona_id) | **`zona_guardioes_c`** | **trocou de coluna em 29/07**; vocabulário **fechado** de 15 → o resto vira `Sem Zona` (§3) |
| `origin` (origem_confianca) | **derivado** | escada §3, a partir de `localizacao_verificada_google_c`, `gmaps_status_c`, `coordenadas_corrigidas_c`, verificada≠null |
| `status` (funil) | `status` + `data_ultima_visita_lead_c` | régua de cobertura §3 |
| `motivoStatus` | `motivo_perda_c` / `motivo_desqualifica_o_c` | rótulo quando aplicável |
| `qualidade` | `qualidade_c` | **chega pronta** (Ouro/Prata) — não re-derivar |
| `porte` | `porte_c` | mapa de código composto §3 |
| `vendedor` | `vendedor_rota_lead_c` → `salesforce.user.name` | **LEFT JOIN** em `user` (crase: `` `user` ``) |
| `lastVisit` (ultima_visita) | `data_ultima_visita_lead_c` | 1.114/6.914 preench. |
| `phone` | — | **dropado** (minimização; telefones tocam PF) |
| `notes` / `checkins` / `createdByUser` | — | net-new; começam vazios |

## 3. Derivações (espelham `js/data.js`)

- **`typology` (CNAE → tipologia):** lookup por código. Aproximações registradas: bufê/cantina/eventos/
  catering (`5620101-04`, `8230002`) → `marmitaria`; ambulante (`5612100`) → `lanchonete`; atacado/
  laticínios/frios (`4639701`, `4721103`, `1052000`) → `mercadinho`; motel/apart-hotel (`5510802-03`) →
  `hotel`; padaria/panificação/biscoitos (`1091101-02`, `4721102`, `1092900`) → `padaria`. CNAE nulo → `outro`.
- **`origin` (escada de confiança — 3 degraus desde 29/07):** `coordenadas_corrigidas_c = 1` (correção
  **humana** do pin) → `validado_campo` — **não** usar `latitude_verificada_lead_c` (verificação automática;
  alimenta só o `geoVerificado` de exibição); senão sinal Google (`gmaps_status_c` ≠ null **ou**
  `localizacao_verificada_google_c = 1`) → **`google`**; senão → **`cnpj`**.
  Calibração (23/07): corrigidas 1.673 · gmaps_status 999 · google_bool 476 · verificada 2.110.
  > ⚠️ **A régua encolheu com o enum** (4 → 3 valores; ver [[objetos/estabelecimento]] §5). Duas saídas
  > desapareceram e o `matchConfirmed` saiu da conta: `cnpja_google` **virou** `google` (é o mesmo caso — CNPJ
  > enriquecido), e `google_puro` deixou de ter degrau próprio. Como no `salesforce.lead` **todo** registro tem
  > CNPJ (MEI já sai no `WHERE`), o caso "Google sem CNPJ" não aparece na prática — a decisão só formalizou
  > isso. Quem carregar snapshot gerado pelo transform antigo é migrado no cliente (`ORIGIN_LEGADO` em
  > `js/state.js`), então nada cai no fallback. ✅ **O transform já foi alinhado (29/07)** — `tools/build-snapshot.mjs`
  > emite `cnpj`/`google`/`validado_campo`, e também `cadastrado`/`dataCadastro` no vocabulário atual, em vez de
  > obrigar o cliente a reconstruir.
- **`porte` (6 faixas desde 29/07):** mapa **exato** de `porte_c`, não mais prefixo — `me-ltda` e `me-ei-nao_mei` são faixas distintas e as duas começam com "me", então o prefixo passou a estar errado.

  | `porte_c` | faixa | n (recorte) |
  |---|---|---|
  | `me-ei-mei` | **MEI** | **0** — excluído no `WHERE` |
  | `me-ltda` | **ME** | 3.034 |
  | `me-ei-nao_mei` | **ME-EI Não MEI** (`ME_EI`) | 3.020 |
  | `epp-ltda` | **EPP** | 513 |
  | `epp-ei` | **EPP-EI** (`EPP_EI`) | 29 |
  | `demais` | **DEMAIS** | 284 |

  Valor novo na coluna → **nulo**, nunca chute. ⚠️ **MEI nunca casa nada no dado real:** o recorte o exclui **duas vezes** (`porte_c NOT IN ('me-ei-mei')` **e** `optante_mei_c = 'Não'`). O chip existe para o fictício e para o futuro, e fica em 0 no modo real — que é a verdade. Trazer MEI para o recorte não é ajuste de filtro: são **67.691** registros na base, mais de 10× o recorte atual.
- **`zona_guardioes_c` → `zone` (vocabulário FECHADO, 29/07):** as **15** zonas da operação; **tudo o mais vira `Sem Zona`** — nulo e os 7 residuais (`CE Eusébio Guararapes` 22 · `PE Áreas Brancas` 6 · `CE Maracanaú Fatima` · `CE Aldeota Cumbuco` · `CE Litoral Oeste` · dois `Recife Zona Sul - Oeste/Leste` com 1 cada). No recorte, as 15 cobrem **99,6%**: só **29 de 6.880** caem no balde.
  > ⚠️ **Trocamos de coluna, e a taxonomia é outra.** `zona_2_c` tem 13 valores, dos quais **só 5** estão nestes 15 (`REC Zona Oeste`, `PE Interior`, `REC Zona Norte`, `PB João Pessoa Litoral`, `REC Zona Sul`) — os outros, como `RMR Norte Olinda` e `PE Litoral Sul 1`, são de outro recorte territorial. A coluna nova também é **muito melhor preenchida**: 33k nulos contra 82k.
  > 🔴 **Snapshot gerado antes de 29/07 fica errado nesta dimensão.** Medido no arquivo em disco: **5.183 dos 6.914 pins caem em `Sem Zona`** (75%), porque ele carrega `zona_2_c`. O cliente não tem como consertar — os valores da coluna velha simplesmente não existem no vocabulário novo. **É preciso regerar o snapshot** com `tools/build-snapshot.mjs` (já alinhado) e a query da §5, que agora seleciona `zona_guardioes_c`.
  >
  > ⚠️ **E regerar só com o transform NÃO resolve — descoberto em 30/07.** O export em disco (`snapshot_leads_fase3.json`, de 23/07) **não contém** `zona_guardioes_c`: a única coluna de zona nele é `zona_2_c`. Rodar o transform atual sobre esse arquivo devolvia **6.914 em `Sem Zona`** — *pior* que os 5.183 que ele substitui, e **em silêncio**. O que falta é o **export novo**: rodar a query da §5 no Metabase. Duas salvaguardas entraram no transform: (1) **fallback declarado** — sem a coluna nova, a zona sai de `zona_2_c` **pelo mesmo vocabulário fechado** (os 5 nomes em comum sobrevivem, o resto vira `Sem Zona`; nada é inventado), o que reproduz os **1.731 com zona** do arquivo anterior em vez de zerar a dimensão; (2) o script **avisa** no fim da execução que a entrada é velha, e passou a imprimir sempre a contagem `com zona / Sem Zona`. ⚖️ **Aceitar dado velho é aceitável; aceitar em silêncio não é** — é assim que um número errado passa por certo.
- **`status` (funil — régua de cobertura do mês):** avaliar nesta ordem —
  1. `status = 'Cadastrado'` → **convertido**;
  2. visita **no mês corrente** (`data_ultima_visita_lead_c >= 1º dia do mês do snapshot`) → **visitado**;
  3. resto (sem visita **ou** visita antes do mês) → **nao_visitado**.
  **Sem `em_negociacao`** (1º/2º/3º contato são do time *inside*, não do campo) e **sem `perdido`** por ora
  (Perdido cai em visitado/não-visitado pela régua).
- **`geoVerificado`:** objeto `{lat,lng}` só quando `latitude_verificada_lead_c` ≠ null; senão `null`.
- **`lat`/`lng` — a coordenada EXIBIDA é `COALESCE(verificada, original)`** *(30/07)*. A verificada vem do fluxo
  do Google Places ([[fluxos-n8n-salesforce]] §3, fluxo 3); a `latitude`/`longitude` crua do Salesforce é, em
  boa parte da base, o **centroide** do bairro ou da cidade. **Medido nos 6.914:** 2.110 têm verificada e
  **todas as 2.110 mudam de lugar** — deslocamento mediano **2,5 km**, p90 **9,1 km**, e **1.404 acima dos
  500 m** do raio presencial ([[tarefa]] §5). Ou seja: sem este coalesce, mais de mil pins ficam longe demais
  da porta para que um check-in **na porta** seja classificado como `presencial` — que é exatamente a queixa
  registrada no inventário de fluxos (pin em centroide → visita lida como remota).
  - **Par completo ou nada:** só troca se **as duas** componentes vierem preenchidas, finitas e dentro da faixa.
    Latitude verificada com longitude original poria o pin em lugar nenhum. Medido: **0 casos parciais**, 0
    inválidos, 0 pares `(0,0)`, 0 fora de faixa — a guarda existe porque o snapshot é **regerado**, e o dado
    limpo é o de hoje. *(Antes, `+''` virava `0` — pin no golfo da Guiné — e texto virava `NaN`, que passava
    pelo filtro `!= null` e ia para o mapa sem lugar.)*
  - ⚖️ **Isto NÃO mexe em `origem_confianca`.** A regra de §3 continua valendo: a coordenada verificada é
    **automática** (Google), não constatação humana, então ela **não** promove o pin a `validado_campo`. Muda
    onde o pin é desenhado, não o quanto se confia nele.
  - ⚠️ **Ponta solta declarada:** **6 pins** deslocam mais de 20 km e **4** mais de 50 km — o extremo é
    *POUSADA SAO JOSE* (Fortaleza/Fátima) a **194 km**. Ou o endereço cadastrado está em outra cidade, ou o
    Google casou o estabelecimento errado. Não há como decidir daqui qual dos dois é, então o coalesce **não
    abre exceção** para eles: distância grande é o sintoma esperado de centroide corrigido, e inventar um teto
    (*"acima de X km ignora a verificada"*) descartaria correção legítima em cidade do interior.
- **`cadastrado` (= a COR do pin desde 29/07):** vem de `status = 'Cadastrado'` no `salesforce.lead` — **é sinal
  real, não inferência nossa**. No snapshot atual isso está gravado com o nome antigo `isConverted` (o arquivo
  foi gerado antes da fatia de Tarefa), então `js/state.js` reconstrói na carga (`migrarRelacao`): **177 dos
  6.914** viram cliente (azul), o resto é lead (lilás). `dataCadastro` só existe onde há `convertedAt` — **15
  dos 177** —, e nos outros o sheet diz que é cliente **sem afirmar desde quando**, em vez de inventar data.
  `dataPrimeiraCompra` é **sempre nulo** de propósito (não há fonte de PEDIDO aqui), o que casa com a régua
  provisória de todo convertido parar em **CSC**. Invariante `status ∈ {csc, aquisicao} ⟺ cadastrado`
  verificado nos 6.914: **zero violações**.
  > ⚠️ **Não confundir com o dataset fictício:** lá `cadastrado` é *inventado por design* (o marcador `conv: 1`
  > está escrito à mão em 10 das 61 sementes de `js/data.js`) — como todo o resto daquele dataset. A cor só
  > carrega verdade comercial no modo real.

## 4. Minimização / colunas descartadas

**PII de pessoa física:** `first_name`, `last_name`, `salutation`, `title`, `email`, `phone`,
`mobile_phone`, `phone_2/3/4_c`, `gmaps_telefone_c`, `socio_1..4_c`.
**Encanamento/ruído:** `_fivetran_*`, `is_deleted`, `master_record_id`, `jigsaw*`, `maps_assignment_rule*`,
`photo_url`, `has_opted_out_of_email`, `converter_automacao_c`, `status_aprovacao_c`, `is_priority_record`.
**Fora de fase:** `temperatura_c`/`lead_score_c` (Performance, F5); `tem_cardapio_c`/`cardapio_url_c` (F4).

## 5. Query canônica (MySQL)

```sql
SELECT
  l.id,
  COALESCE(l.nome_fantasia_c, l.name)        AS nome_fantasia,
  l.razao_social_c, l.cnpj_c,
  l.cnae_principal_c, l.atividade_cnae_principal_c,
  l.street, l.bairro_c, l.city, l.state, l.postal_code, l.complemento_endereco_c,
  l.latitude, l.longitude,
  l.latitude_verificada_lead_c, l.longitude_verificada_lead_c,
  l.coordenadas_corrigidas_c, l.data_correcao_pin_c, l.motivo_correcao_pin_c,
  l.qualidade_c, l.porte_c, l.zona_guardioes_c,
  l.localizacao_verificada_google_c, l.gmaps_status_c,
  l.status, l.motivo_perda_c, l.motivo_desqualifica_o_c, l.data_ultima_visita_lead_c,
  l.vendedor_rota_lead_c, u.name AS vendedor_nome
FROM salesforce.lead l
LEFT JOIN salesforce.`user` u ON u.id = l.vendedor_rota_lead_c
WHERE /* §1 */ ;
```

## 6. A resolver

- Corte de `visitado` = **mês corrente** do snapshot (parametrizável se virar "últimos 30 dias").
- ✅ **Resolvido em 29/07:** a zona parcial era da coluna `zona_2_c` (~41% nula). Com `zona_guardioes_c` o recorte fica **99,6%** coberto pelas 15 — o filtro de zona deixou de ser parcial. **Falta regerar o snapshot** (§3).
- Coordenadas repetidas entre leads da mesma zona = centroide (não fachada) — ok exibir, sinalizado.
- Qualidade real vem de `qualidade_c` (pronta); o `cnae_tier` do protótipo é conferência, não fonte.
