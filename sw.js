const CACHE_NAME = "cache-v2";
const MIRROR_PREFIX = "mirror.";

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function requestStorage(key, timeout = 1500) {
  return new Promise(async (resolve) => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = clients[0];
    if (!client) return resolve(null);

    const channel = new MessageChannel();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value ?? null);
      channel.port1.close();
    };
    const timer = setTimeout(() => finish(null), timeout);
    channel.port1.onmessage = (event) => finish(event.data?.value);
    client.postMessage({ type: "GET_LOCALSTORAGE", key }, [channel.port2]);
  });
}

async function getMirrorFor(url) {
  const source = new URL(url);
  const mirror = await requestStorage(`${MIRROR_PREFIX}${source.hostname}`);
  if (!mirror) return null;
  try {
    const target = new URL(mirror.includes("://") ? mirror : `${source.protocol}//${mirror}`);
    target.pathname = source.pathname;
    target.search = source.search;
    target.hash = source.hash;
    return target;
  } catch {
    return null;
  }
}

async function cacheUrls(urls) {
  const cache = await caches.open(CACHE_NAME);
  const results = [];
  const concurrency = 6;
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    results.push(...await Promise.all(batch.map(async (url) => {
      try {
        const original = new URL(url, self.location.href);
        const mirror = await getMirrorFor(original.href);
        const target = mirror || original;
        const existing = await cache.match(original.href, { ignoreSearch: false });
        if (existing) return { url, ok: true, cached: true, mirror: mirror?.href || null };
        const response = await fetch(new Request(target.href, { cache: "default" }));
        if (!response.ok && response.type !== "opaque") {
          return { url, ok: false, reason: `status=${response.status}` };
        }
        await cache.put(original.href, response.clone());
        if (mirror) await cache.put(mirror.href, response.clone());
        return { url, ok: true, mirror: mirror?.href || null };
      } catch (error) {
        return { url, ok: false, reason: String(error) };
      }
    })));
  }
  return results;
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "CLEAR_CACHE") {
    const port = event.ports[0];
    event.waitUntil(caches.delete(CACHE_NAME).then((ok) => {
      port?.postMessage({ type: "CACHE_CLEARED", ok });
      port?.close();
    }));
    return;
  }
  if (data.type === "LIST_CACHE") {
    const port = event.ports[0];
    event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
      const keys = await cache.keys();
      port?.postMessage({ type: "CACHE_LIST", urls: keys.map((request) => request.url) });
      port?.close();
    }));
    return;
  }
  if (data.type === "CACHE_URLS") {
    const port = event.ports[0];
    event.waitUntil(cacheUrls(Array.isArray(data.urls) ? data.urls : []).then((results) => {
      port?.postMessage({ type: "CACHE_RESULT", results });
      port?.close();
    }));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode === "navigate") return;
  const cacheableOrigins = [
    "https://cdn.jsdelivr.net",
    "https://esm.sh",
    "https://unpkg.com",
  ];
  if (!cacheableOrigins.includes(new URL(request.url).origin)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request.url, { ignoreSearch: false });
    if (cached) return cached;

    const mirror = await getMirrorFor(request.url);
    const target = mirror || new URL(request.url);
    try {
      const response = await fetch(new Request(target.href, request));
      if (response.ok || response.type === "opaque") {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request.url, response.clone());
      }
      return response;
    } catch {
      const offline = await caches.match("/offline.html");
      return offline || new Response("Offline", { status: 503 });
    }
  })());
});
