/* =====================================================================
   sw.js — Service Worker do protótipo.
   - App shell/assets: NETWORK-FIRST (online sempre pega o mais novo; F5
     reflete mudanças). Cai no cache só offline. Bom p/ protótipo em iteração.
   - Tiles do mapa: stale-while-revalidate (área revisitada abre offline).
   ===================================================================== */
const VERSION = 'crm-map-v3';
const SHELL_CACHE = 'shell-' + VERSION;
const TILE_CACHE = 'tiles-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/data.js',
  './js/state.js',
  './js/map.js',
  './js/filters.js',
  './js/pin.js',
  './js/create.js',
  './js/intel.js',
  './js/app.js',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // Resiliente: um asset ausente não derruba a instalação inteira.
      return Promise.allSettled(SHELL.map(function (url) { return cache.add(url); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL_CACHE && k !== TILE_CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isTile(url) {
  return url.hostname.indexOf('basemaps.cartocdn.com') !== -1 ||
         url.hostname.indexOf('tile.openstreetmap.org') !== -1;
}

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Tiles do mapa (cross-origin) → stale-while-revalidate.
  if (isTile(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then(function (cache) {
        return cache.match(req).then(function (cached) {
          const network = fetch(req).then(function (res) {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          }).catch(function () { return cached; });
          return cached || network;
        });
      })
    );
    return;
  }

  // Navegação → network-first (online = sempre atual; offline = index em cache).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then(function (cache) { cache.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (c) { return c || caches.match('./'); });
      })
    );
    return;
  }

  // Mesma origem → network-first (atualiza o cache), cai no cache só offline.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }
});
