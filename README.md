# CRM Externo — Protótipo do Mapa

Protótipo interativo do mapa de field sales da Praso. **Dados 100% fictícios**, ancorados em **3 capitais do Nordeste — Recife, Fortaleza e João Pessoa**. O mapa abre no **Brasil inteiro** e navega até as cidades. Sem integrações reais. Entregue como **PWA instalável** (alvo Android).

Objetivo: gate visual/funcional para Planejamento e Supervisão aprovarem a construção do produto real.

## O que dá pra fazer (8 capabilities)

1. Ver pins sobre um mapa real e distinguir a **origem/confiança** de cada um pela cor + ícone + selo (4 categorias), sem clicar.
2. **Filtrar** de forma combinável (tipologia, zona, potencial, última visita, origem, status) + **botões de acesso rápido** ("🥖 Padarias", "📌 Não visitados 30+", "🔥 Alto potencial", "✓ Validado em campo").
3. Abrir um pin e ver **info + notas sempre visíveis**.
4. **Criar** um pin novo (nome + local no mapa).
5. **Mover** um pin arrastando (a nova posição persiste).
6. **Check-in / check-out** simples direto no pin.
7. **Instalar como app** pelo link no celular.
8. **Pegar minha localização** no celular (GPS) — centraliza o mapa em você, com ponto + raio de precisão.

## Rodar localmente (desktop)

Na raiz do projeto:

```bash
py -m http.server 8080      # Windows (ou: python3 -m http.server 8080)
```

Abra `http://localhost:8080`. Em `localhost` o service worker registra e o app funciona completo.

## Abrir e instalar no Android (CAP-7)

⚠️ **Importante:** para instalar como app (PWA) num celular, o link precisa ser **HTTPS** (ou `localhost`). Um `http://<ip-da-rede>:8080` **não** registra o service worker nem oferece "Adicionar à tela inicial". O mesmo vale pra **pegar sua localização** (CAP-8): a geolocalização do celular só funciona em **HTTPS** ou `localhost`. Escolha uma opção:

- **Deploy estático (recomendado):** publique a pasta inteira em um host estático com HTTPS — **Netlify** (arraste a pasta), **GitHub Pages**, **Vercel** ou **Cloudflare Pages**. Compartilhe o link `https://…`.
- **Túnel rápido para testar:** com o servidor local rodando, exponha por HTTPS com `cloudflared tunnel --url http://localhost:8080` (ou `ngrok http 8080`) e use a URL `https://…` gerada.

No celular (Chrome/Android): abra o link → aparece o aviso "Instalar" (ou menu **⋮ → Adicionar à tela inicial**) → abra pelo ícone: roda em tela cheia, como app.

## Notas técnicas

- **Sem build:** HTML/CSS/JS vanilla. É só servir a pasta como arquivos estáticos.
- **Mapa:** [Leaflet](https://leafletjs.com) (vendorizado em `vendor/leaflet/`, self-contained) sobre tiles **CARTO Positron** (gratuitos, dados © OpenStreetMap).
- **Estado:** persistido no navegador via `localStorage`. O botão **⟲** (topo) reseta para o dataset fictício original.
- **Sem excluir pin:** por princípio do produto ("o pin nunca some"), não há ação de deletar.

## Estrutura

```
index.html                 app shell
css/styles.css             design system (field sales)
js/data.js                 dataset fictício (Recife, Fortaleza, João Pessoa) + metadados
js/state.js                store + persistência (localStorage)
js/map.js                  mapa Leaflet + markers por origem
js/filters.js              filtros combináveis + atalhos
js/pin.js                  bottom sheet do pin (info/notas/check-in-out)
js/create.js               criar pin
js/app.js                  bootstrap + PWA (install)
manifest.webmanifest       manifesto PWA
sw.js                      service worker (cache shell + tiles)
icons/                     ícones do app
vendor/leaflet/            Leaflet vendorizado
```
