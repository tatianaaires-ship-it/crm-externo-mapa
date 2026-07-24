/* =====================================================================
   worker.js — Porteiro (Cloudflare Worker) do Praso Maps.
   Serve o snapshot de dado real (KV) SOMENTE para quem apresenta um
   ID token do Google válido cujo domínio é @praso.com.br.
   Público (GitHub Pages) continua fictício; este Worker é o único lugar
   onde o dado real transita — nunca no repositório.

   Verificação local do JWT (RS256) com Web Crypto + JWKS do Google (cacheado).
   Config via vars (wrangler.toml): GOOGLE_CLIENT_ID, ALLOWED_ORIGIN, ALLOWED_HD.
   KV binding: SNAPSHOT (chave "data-real").
   ===================================================================== */

const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const VALID_ISS = ['accounts.google.com', 'https://accounts.google.com'];

let jwksCache = null;
let jwksExpMs = 0;

export default {
  async fetch(request, env) {
    const allowOrigin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, cors);

    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    if (!token) return json({ error: 'missing_token' }, 401, cors);

    try {
      await verifyGoogleIdToken(token, {
        clientId: env.GOOGLE_CLIENT_ID,
        allowedHd: env.ALLOWED_HD || 'praso.com.br'
      });
    } catch (e) {
      return json({ error: 'unauthorized', detail: String(e && e.message || e) }, 401, cors);
    }

    const data = await env.SNAPSHOT.get('data-real');
    if (!data) return json({ error: 'sem_dados', hint: 'suba data-real no KV (ver README)' }, 404, cors);

    return new Response(data, {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

/* ---- Verificação do ID token do Google ---- */
async function verifyGoogleIdToken(token, { clientId, allowedHd }) {
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID não configurado no Worker');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('token malformado');
  const [h, p, s] = parts;

  const header = jsonFromB64Url(h);
  const payload = jsonFromB64Url(p);

  const jwk = await getGoogleJwk(header.kid);
  if (!jwk) throw new Error('chave (kid) do Google não encontrada');

  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, bytesFromB64Url(s), new TextEncoder().encode(h + '.' + p)
  );
  if (!valid) throw new Error('assinatura inválida');

  // Claims
  if (!VALID_ISS.includes(payload.iss)) throw new Error('iss inválido');
  if (payload.aud !== clientId) throw new Error('aud (client_id) não confere');
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) throw new Error('token expirado');

  const emailOk = payload.email && payload.email_verified &&
    String(payload.email).toLowerCase().endsWith('@' + allowedHd);
  const hdOk = payload.hd === allowedHd;
  if (!hdOk && !emailOk) throw new Error('domínio não autorizado (exige @' + allowedHd + ')');

  return payload;
}

async function getGoogleJwk(kid) {
  const now = Date.now();
  if (!jwksCache || now > jwksExpMs) {
    const res = await fetch(GOOGLE_CERTS);
    const body = await res.json();
    jwksCache = body.keys || [];
    const cc = res.headers.get('cache-control') || '';
    const m = cc.match(/max-age=(\d+)/);
    jwksExpMs = now + (m ? Math.min(+m[1], 3600) : 3600) * 1000;
  }
  return jwksCache.find(k => k.kid === kid);
}

/* ---- Helpers base64url ---- */
function bytesFromB64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4 ? 4 - (str.length % 4) : 0;
  str += '='.repeat(pad);
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function jsonFromB64Url(str) {
  return JSON.parse(new TextDecoder().decode(bytesFromB64Url(str)));
}
