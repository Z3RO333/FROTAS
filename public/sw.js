// Service Worker — Frotas Bemol PWA
const CACHE_NAME = "frotas-v1";

// Recursos estáticos para cache na instalação
const STATIC_ASSETS = [
  "/",
  "/login",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estratégia: Network First (sempre tenta a rede, usa cache se offline)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requests não-GET e de outras origens
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Ignora APIs, auth e rotas de servidor
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/login")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cacheia respostas bem-sucedidas de páginas
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        // Offline: retorna da cache
        caches.match(request).then((cached) => cached ?? caches.match("/"))
      )
  );
});
