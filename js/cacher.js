(async () => {
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const reg = await navigator.serviceWorker.ready;

    if (!reg.active) {
      console.error("没有 active SW");
      return;
    }

    const urls = [
      "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm",
      "https://cdn.jsdelivr.net/npm/firecrawl@4.42.1/+esm",
      "https://cdn.jsdelivr.net/npm/axios@1.18.0/+esm",
      "https://cdn.jsdelivr.net/npm/zod-to-json-schema@3.25.2/+esm",
      "https://cdn.jsdelivr.net/npm/zod@3.25.76/+esm",
      "https://cdn.jsdelivr.net/npm/zod@4.3.6/v3/+esm",
    ];
    for (url of urls) {
        const cached = await caches.match(url, { ignoreSearch: false });
        if (cached) {
            urls.splice(urls.indexOf(url), 1);
        }
    }

    const channel = new MessageChannel();

    channel.port1.onmessage = (e) => {
      channel.port1.close();
    };

    reg.active.postMessage(
      { type: "CACHE_URLS", urls },
      [channel.port2]
    );
  } catch (e) {
    console.error("SW 流程失败:", e);
  }
})();