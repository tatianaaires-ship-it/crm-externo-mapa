# Porteiro — Praso Maps (Cloudflare Worker + login Google)

Serve o **snapshot de dado real** (KV) só para quem loga com **@praso.com.br**.
Público (GitHub Pages) continua fictício; o dado real transita só por aqui — **nunca no repositório**.

```
Cliente (GitHub Pages, fictício)
  └─ botão "Entrar" (js/auth.js, Google Identity Services)
       └─ ID token ──► Worker (verifica assinatura + domínio @praso.com.br)
                          └─ 200 + JSON (do KV)  ──► app troca p/ dado real (em memória)
```

Arquivos: [`worker.js`](worker.js) · [`wrangler.toml`](wrangler.toml) · cliente em [`../js/auth.js`](../js/auth.js) + [`../js/config.js`](../js/config.js).

---

## Pré-requisitos (você)

- **Node** instalado + Wrangler: `npm i -g wrangler`
- Conta **Cloudflare** (plano grátis serve)
- Acesso ao **Google Cloud Console** com o Workspace `praso.com.br`
- O snapshot gerado: `private/data-real.json` (rode `node tools/build-snapshot.mjs`)

## 1. Criar o OAuth Client ID (Google)

1. Google Cloud Console → **APIs e Serviços → Tela de consentimento OAuth** → tipo **Interno**
   (Interno já restringe a `praso.com.br` — camada extra além da checagem do Worker).
2. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
3. Em **Origens JavaScript autorizadas**, adicione (sem barra final):
   - `https://SEU-USUARIO.github.io` (produção)
   - `http://localhost:8788` (dev local, opcional)
4. Copie o **Client ID** (`...apps.googleusercontent.com`).

## 2. Subir o Worker + KV (Cloudflare)

Do diretório `porteiro/`:

```bash
wrangler login
wrangler kv namespace create SNAPSHOT     # copie o "id" retornado
```

- Cole o `id` do KV em [`wrangler.toml`](wrangler.toml) (`kv_namespaces[].id`).
- Preencha em `[vars]`: `GOOGLE_CLIENT_ID`, `ALLOWED_ORIGIN` (= sua URL do Pages, sem barra), `ALLOWED_HD`.

Suba o snapshot para o KV e faça o deploy:

```bash
wrangler kv key put --binding=SNAPSHOT data-real --path="../private/data-real.json" --remote
wrangler deploy                           # anote a URL: https://praso-maps-porteiro.<sub>.workers.dev
```

## 3. Ligar o cliente

Em [`../js/config.js`](../js/config.js), preencha (ambos são **públicos**, pode commitar):

```js
window.CRM_CONFIG = {
  GOOGLE_CLIENT_ID: '...apps.googleusercontent.com',
  WORKER_URL: 'https://praso-maps-porteiro.<sub>.workers.dev'
};
```

Faça commit/deploy do Pages. O botão **Entrar** aparece no topo; login `@praso.com.br` troca o mapa
para os 6.914 pins reais. Conta de fora do domínio recebe **401**.

## 4. Atualizar o dado depois

```bash
node ../tools/build-snapshot.mjs          # regenera private/data-real.json
wrangler kv key put --binding=SNAPSHOT data-real --path="../private/data-real.json" --remote
```

## Dev local (opcional)

```bash
wrangler dev            # sobe em http://localhost:8787
```
Aponte `WORKER_URL` para `http://localhost:8787`, adicione a origem local no OAuth (passo 1.3) e
ajuste `ALLOWED_ORIGIN` no `wrangler.toml`. Sirva o app por `http://localhost` (não `file://`) —
o Google Sign-In exige origem http(s).

## Segurança / privacidade

- `GOOGLE_CLIENT_ID` e `WORKER_URL` **não são segredo** (ficam no cliente) — ok no repo.
- O **dado real** só existe no **KV** e é servido após validar assinatura do Google **e** domínio.
  Nunca entra no Git (`.gitignore` cobre `private/` e `*-real.json`).
- No cliente, o dado real fica **só em memória** (não vai pro `localStorage`).
- Camadas: consentimento **Interno** (só `praso.com.br` obtém token) + Worker confere `aud`, `exp`,
  assinatura (JWKS) e `hd`/`email @praso.com.br`.
