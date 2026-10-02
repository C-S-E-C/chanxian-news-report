const CACHE_URLS = [
  "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm",
  "https://cdn.jsdelivr.net/npm/firecrawl@4.42.1/+esm",
  "https://cdn.jsdelivr.net/npm/axios@1.18.0/+esm",
  "https://cdn.jsdelivr.net/npm/zod-to-json-schema@3.25.2/+esm",
  "https://cdn.jsdelivr.net/npm/zod@3.25.76/+esm",
  "https://cdn.jsdelivr.net/npm/zod@4.3.6/v3/+esm",
];

const cacheReady = (async () => {
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await registration.update();
  const installing = registration.installing || registration.waiting || registration.active;
  if (installing) {
    await new Promise((resolve) => {
      if (installing.state === "activated" || installing.state === "redundant") return resolve();
      installing.addEventListener("statechange", () => {
        if (installing.state === "activated" || installing.state === "redundant") resolve();
      });
    });
  }
  await navigator.serviceWorker.ready;
  return registration;
})();

function postToServiceWorker(message, transfer = []) {
  return cacheReady.then((registration) => new Promise((resolve, reject) => {
    const worker = registration.active || navigator.serviceWorker.controller;
    if (!worker) return reject(new Error("Service Worker 尚未就绪"));
    const channel = new MessageChannel();
    const timer = setTimeout(() => reject(new Error("Service Worker 请求超时")), 5000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data);
    };
    worker.postMessage(message, [channel.port2, ...transfer]);
  }));
}

async function syncLocalStorageRequest(event) {
  const key = event.data?.key;
  if (!key || !event.ports[0]) return;
  event.ports[0].postMessage({ value: localStorage.getItem(key) });
  event.ports[0].close();
}

navigator.serviceWorker.addEventListener("message", syncLocalStorageRequest);

window.cacheManager = {
  ready: cacheReady,
  async cacheUrls(urls = CACHE_URLS) {
    const missing = [];
    for (const url of urls) {
      if (!(await caches.match(url, { ignoreSearch: false }))) missing.push(url);
    }
    if (!missing.length) return { type: "CACHE_RESULT", results: [] };
    return postToServiceWorker({ type: "CACHE_URLS", urls: missing });
  },
  async clear() {
    return postToServiceWorker({ type: "CLEAR_CACHE" });
  },
  async list() {
    return postToServiceWorker({ type: "LIST_CACHE" });
  },
};

cacheReady.then(() => window.cacheManager.cacheUrls()).catch((error) => {
  console.warn("Service Worker 缓存初始化失败：", error);
});
