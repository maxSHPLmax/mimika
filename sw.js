// Офлайн-кэш. Меняйте VERSION при каждом обновлении файлов приложения.
const VERSION = 'mimika-v5';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/analysis.js', 'js/exercises.js', 'js/features.js', 'js/geometry.js',
  'js/session.js', 'js/storage.js', 'js/sync.js', 'js/tracker.js', 'js/voice.js',
  'vendor/mediapipe/vision_bundle.mjs',
  'icons/icon-180.png', 'icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'mimika-assets').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Приложение: сначала сеть (чтобы обновления приходили), при отсутствии сети — кэш.
// Тяжёлые файлы (wasm, модель, шрифты): сначала кэш — они не меняются.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const heavy = /\.(wasm|task)$/.test(url.pathname) || url.pathname.includes('/vendor/mediapipe/wasm/') ||
    url.hostname === 'storage.googleapis.com' || url.hostname.endsWith('gstatic.com') || url.hostname === 'fonts.googleapis.com';

  if (heavy) {
    e.respondWith(
      caches.open('mimika-assets').then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      })
    );
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
  );
});
