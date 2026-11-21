const CACHE = "lol-v1";
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png"])).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("lol-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin || url.hostname === "ddragon.leagueoflegends.com" || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    const net = () => fetch(req).then(r => { if (r.ok || r.type === "opaque") { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; });
    // Datos propios: primero la red (para tener el parche nuevo). Imágenes de Riot y fuentes: primero la caché.
    e.respondWith(url.origin === location.origin ? net().catch(() => caches.match(req).then(r => r || caches.match("index.html"))) : caches.match(req).then(r => r || net()));
  }
});
