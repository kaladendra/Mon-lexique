/* Mon lexique — service worker.
   Strategy: network-first for the page (so an update is never more than one
   launch away), cache-first for static assets. The cache name carries the
   build hash, so a new build gets a new cache and old ones are deleted. */
const VERSION = "14qp8zf";
const CACHE   = "mon-lexique-" + VERSION;
const CORE = ["./", "./index.html", "./manifest.json", "./favicon-32.png",
              "./favicon.ico", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(CORE.map(u => c.add(u)));   // one failure must not abort install
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys())
      if (k.startsWith("mon-lexique-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isDoc = req => req.mode === "navigate" ||
  (req.headers.get("accept") || "").includes("text/html");

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  if (isDoc(req)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const net = await Promise.race([
          fetch(req),
          new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 3500))
        ]);
        if (net && net.ok) cache.put("./index.html", net.clone());
        return net;
      } catch (_) {
        return (await cache.match("./index.html")) || (await cache.match("./")) ||
               new Response("<h1>Hors ligne</h1><p>Ouvrez l'application une fois en ligne pour l'installer.</p>",
                            {headers: {"Content-Type": "text/html; charset=utf-8"}});
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const net = await fetch(req);
      if (net && (net.ok || net.type === "opaque")) cache.put(req, net.clone());  // includes Google Fonts
      return net;
    } catch (_) {
      return hit || Response.error();
    }
  })());
});
