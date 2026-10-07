// «Суккубить» service worker: the cube opens offline once it has been opened online.
//  - the page and api.json: network first (fresh when online, cached copy offline)
//  - libraries, fonts, pictures, icons: cache first
//  - videos (range requests) and the key server are not touched; the encrypted tracks are cached by the page itself
const SHELL = 'sk-shell-v1';
const PRECACHE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'assets/mag-left.png', 'assets/mag-right.png', 'assets/mag-up.png', 'assets/mag-down.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('sk-shell') && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const c = await caches.open(SHELL);
  try {
    const r = await fetch(req);
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch (e) {
    return (await c.match(req, { ignoreSearch: true })) || Response.error();
  }
}
async function cacheFirst(req) {
  const c = await caches.open(SHELL);
  const hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === 'opaque') c.put(req, r.clone());
  return r;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const u = new URL(req.url);
  if (/\.(mp4|bin)$/.test(u.pathname) || u.pathname.includes('/api/')) return;
  if (u.origin === location.origin) {
    if (req.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html') || u.pathname.endsWith('api.json'))
      e.respondWith(networkFirst(req));
    else e.respondWith(cacheFirst(req));
  } else if (/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com|telegram\.org/.test(u.host)) {
    e.respondWith(cacheFirst(req));
  }
});
