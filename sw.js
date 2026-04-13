const CACHE_NAME = "baralla-v0.2.0";
const CACHE_FILES = [
  "./README.md",
  "./app.js",
  "./fonts/phosphor/Phosphor-Light.woff2",
  "./fonts/phosphor/phosphor.css",
  "./icon.png",
  "./index.html",
  "./lib/marked.js",
  "./manifest.json",
  "./setup.js",
  "./style.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const url of CACHE_FILES) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn("Baralla SW: failed to cache", url, err);
        }
      }
      return self.skipWaiting();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.map((n) => n !== CACHE_NAME && caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});
