'use strict';
// Service worker de la maquette : garde l'application hors ligne dans le navigateur.
// ⚠ Chaque changement de fichier = nouveau numero de cache, sinon le navigateur sert l'ancienne version.
// Prefixe propre a cette application : il ne touche jamais les caches des autres pages DRAGLOG.
var PREFIXE = 'dlx-maquette-';
var CACHE = PREFIXE + 'v0.1';
var FICHIERS = ['./', './index.html', './css/app.css', './js/i18n.js', './js/graph.js', './js/demo-runs.js', './js/kit.js', './js/app.js',
                './manifest.json', './img/logo.svg', './img/icon-192.webp', './img/icon-512.webp'];
self.addEventListener('install', function (ev) { ev.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); })); self.skipWaiting(); });
self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k.indexOf(PREFIXE) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});
// Reseau d'abord (la maquette change souvent), le cache seulement hors ligne.
self.addEventListener('fetch', function (ev) {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(fetch(ev.request).then(function (r) {
    var copie = r.clone(); caches.open(CACHE).then(function (c) { c.put(ev.request, copie); }); return r;
  }).catch(function () { return caches.match(ev.request); }));
});
