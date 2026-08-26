(async function () {
  const params = new URLSearchParams(window.location.search);

  function backHome() {
    window.location.href = 'index.html';
  }

  function base64UrlToBytes(s) {
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    s += '='.repeat((4 - s.length % 4) % 4);
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function decodeCompressed(data) {
    if (!('DecompressionStream' in window)) throw new Error('DecompressionStream unavailable');
    const bytes = base64UrlToBytes(data);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new TextDecoder().decode(await new Response(stream).arrayBuffer());
  }

  async function readPayload() {
    const zipped = params.get('z');
    if (zipped) return decodeCompressed(zipped);

    const legacy = params.get('data');       // 兼容旧版 base64 长链接
    if (!legacy) return null;
    return decodeURIComponent(atob(legacy));
  }

  try {
    const raw = await readPayload();
    if (!raw) { backHome(); return; }
    const share = JSON.parse(raw);
    render(share.data, share.date);
  } catch (e) {
    console.warn('[Share] 分享数据解析失败：', e);
    backHome();
  }
})();
