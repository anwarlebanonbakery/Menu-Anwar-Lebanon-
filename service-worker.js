const CACHE = 'anwar-shell-v2';
const SHELL = ['./','./index.html','./firebase-app.js','./kiosk-app.js','./manifest.webmanifest','./logo.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Always prefer the newest app files. Fall back to cache only when offline.
  const isAppFile = url.pathname.endsWith('/') ||
    /\.(html|js|webmanifest)$/.test(url.pathname);

  event.respondWith(
    isAppFile
      ? fetch(req).then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => caches.match(req))
      : caches.match(req).then(cached => {
          const network = fetch(req).then(res => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then(c => c.put(req, copy));
            }
            return res;
          }).catch(() => cached);
          return cached || network;
        })
  );
});
