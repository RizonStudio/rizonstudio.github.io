// Expeniq service worker
// Network-first with a 4s fallback to the cached copy on slow or failed networks.
// Keep the 'expeniq-' prefix when changing CACHE_NAME.
const CACHE_NAME = 'expeniq-v14';
const CORE = ['./', './index.html'];
const EXTRA = ['./manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(async c => {
    await c.addAll(CORE.map(u => new Request(u, {cache: 'reload'})));
    await Promise.all(EXTRA.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  }));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys
      .filter(k => k.startsWith('expeniq-') && k !== CACHE_NAME)
      .map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const network = fetch(req, {cache: 'no-cache'});
  e.waitUntil(network.then(res => {
    if (res.status !== 200) return;
    const copy = res.clone();
    return caches.open(CACHE_NAME).then(c => c.put(req, copy));
  }).catch(() => {}));

  e.respondWith((async () => {
    const c = await caches.open(CACHE_NAME);
    const hit = await c.match(req) ||
      (req.mode === 'navigate' ? await c.match('./index.html') : undefined);
    if (!hit) return network;
    return Promise.race([
      network.then(r => r.status >= 500 ? hit : r).catch(() => hit),
      new Promise(done => setTimeout(() => done(hit), 4000))
    ]);
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true})
    .then(list => {
      const app = list.find(w => w.url.startsWith(self.registration.scope));
      return app ? app.focus() : self.clients.openWindow('./');
    }));
});
