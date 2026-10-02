const CACHE_NAME = "cache-v1"; // 建议带版本号

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS") return;
  const urls = Array.isArray(event.data.urls) ? event.data.urls : [];

  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const origin = self.location.origin;

    // 并发但分批，避免打爆连接
    const CONCURRENCY = 6;
    const results = [];
    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      const batch = urls.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(async (url) => {
        try {
          const absolute = new URL(url, self.location.href);
          const request = new Request(absolute.href, { cache: "reload" });
          const response = await fetch(request);

          const cacheable =
            response.type === "opaque" ||
            (response.ok &&
              (absolute.origin === origin ||
               response.type === "basic" ||
               response.type === "cors"));

          if (!cacheable) {
            return { url, ok: false, reason: `type=${response.type}, status=${response.status}` };
          }

          // 关键：用 URL 字符串当 key，保证 fetch 时能匹配
          await cache.put(absolute.href, response.clone());
          return { url, ok: true };
        } catch (e) {
          return { url, ok: false, reason: String(e) };
        }
      }));
      results.push(...batchResults);
    }

    event.ports[0]?.postMessage({ type: "CACHE_RESULT", results });
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // 规范要求
  if (req.cache === "only-if-cached" && req.mode !== "same-origin") {
    return;
  }

  event.respondWith((async () => {
    // 用 URL 字符串匹配，跨域也能命中
    const cached = await caches.match(req.url, { ignoreSearch: false });
    if (cached) return cached;

    try {
      return await fetch(req);
    } catch {
      const offline = await caches.match("/offline.html");
      if (offline) return offline;
      return new Response("Offline", { status: 503 });
    }
  })());
});