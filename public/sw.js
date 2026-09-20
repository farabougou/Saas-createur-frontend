// Service worker de SaaS Créateurs.
//
// Objectif : permettre l'installation de l'app sur l'écran d'accueil et offrir
// une page claire quand il n'y a pas de réseau. Stratégie "réseau d'abord" :
// vous avez TOUJOURS la dernière version du site quand vous êtes en ligne ;
// le cache ne sert que de secours. Les appels vers le backend, Supabase et
// Stripe (autres domaines) ne passent jamais par ici : aucune donnée de
// compte n'est stockée dans le cache.
const VERSION = 'v3';
const CACHE = 'sc-shell-' + VERSION;
const SHELL = [
  '/offline.html',
  '/reset.css',
  '/style.css',
  '/config.js',
  '/quotes.js',
  '/contacts.js',
  '/app.js',
  '/mobile.js',
  '/pwa.js',
  '/account.js',
  '/icons/icon-192.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Un fichier manquant ne doit pas empêcher l'installation.
      return Promise.all(
        SHELL.map(function (url) {
          return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k.indexOf('sc-shell-') === 0 && k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API, Supabase, Stripe, CDN : réseau direct

  event.respondWith(
    fetch(request).then(function (response) {
      if (response && response.ok && response.type === 'basic') {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('/offline.html');
        return Response.error();
      });
    })
  );
});
