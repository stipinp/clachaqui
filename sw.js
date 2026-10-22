// Service worker: guarda todo el juego para que funcione sin conexión.
// Si cambiás algún archivo, subí el número de versión.
const VERSION = 'yukk-v2';
const ARCHIVOS = [
  './',
  'index.html',
  'game.js',
  'atlas.js',
  'manifest.json',
  'img/btn_reiniciar.webp',
  'img/elemento_invocado.webp',
  'img/entidad-0.webp',
  'img/entidad-1.webp',
  'img/entidad-2.webp',
  'img/entidad_final.webp',
  'img/fondo_arido-0.webp',
  'img/fondo_arido-1.webp',
  'img/fondo_florida-0.webp',
  'img/fondo_florida-1.webp',
  'img/fondo_lluvia-0.webp',
  'img/fondo_lluvia-1.webp',
  'img/fondo_lluvia-2.webp',
  'img/guerrero_cabeza.webp',
  'img/guerrero_cuerpo.webp',
  'img/guerrero_piernas.webp',
  'img/idle.webp',
  'img/mapa_fijo.webp',
  'img/yukk.webp',
  'img/yukk_captura.webp',
  'img/yukk_puco.webp',
  'icons/icon-128.png',
  'icons/icon-16.png',
  'icons/icon-256.png',
  'icons/icon-32.png',
  'icons/icon-512.png',
  'icons/icon-64.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
