/*
 * ImageLab service worker — what makes the app installable, and nothing clever.
 *
 * The shell (index.html) is always fetched from the network first, so a push to the pod shows up
 * on the next launch; the cached copy is only for when the pod cannot be reached. Hashed build
 * assets never change under a name, so they are served from cache once seen. Everything else —
 * ComfyUI, the ImageLab API, images, websockets — goes straight to the network, untouched.
 */
const CACHE = 'imagelab-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const rel = url.pathname.slice(scope.pathname.length);

  if (req.mode === 'navigate' || rel === '' || rel === 'index.html') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(scope.href, res.clone());
        return res;
      } catch {
        return (await caches.match(scope.href)) || Response.error();
      }
    })());
    return;
  }

  if (rel.startsWith('assets/') || rel.startsWith('icons/')) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
  }
});
