/* ============================================================
 * G4F CORS 兜底垫片 —— 必须在 cake-baker.js 之前加载
 *
 * 现状：g4f.space 对 https://c-s-e-c.github.io 的跨域请求返回
 *   Access-Control-Allow-Origin: null
 * 这是对方服务器的配置错误，浏览器会直接丢弃响应（哪怕状态码是 200）。
 *
 * 本垫片包装 window.fetch：
 *   · 非 g4f.space/cake/* 的请求一律原样放行；
 *   · 目标请求先按原样直连（服务器修好后自动回到最优路径）；
 *   · 直连被拦/网络失败且是 GET 时，改走唯一自建中继
 *     （url-proxy.syntropica.top）重试一次，仍失败才抛原始错误。
 * 仅做透明兜底，不改变任何业务语义。
 * ============================================================ */
(function () {
  var TARGET = /^https:\/\/g4f\.space\/cake\//i;
  var RELAY = 'https://url-proxy.syntropica.top/?url=';   /* 唯一中继 */
  var _fetch = window.fetch ? window.fetch.bind(window) : null;
  if (!_fetch) return;

  window.fetch = function (input, init) {
    var url = '';
    try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (e) { }
    if (!TARGET.test(url)) return _fetch.apply(null, arguments);

    var method = 'GET';
    try { method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase(); } catch (e) { }

    return _fetch.apply(null, arguments).then(
      function (res) { return res; },               /* 直连成功：原样返回 */
      function (err) {                              /* 直连失败：仅对 GET 走中继兜底一次 */
        if (method !== 'GET') throw err;
        console.info('[G4F-CORS-shim] 直连失败，改走中继:', url);
        return _fetch(RELAY + encodeURIComponent(url), { cache: 'no-store' })
          .catch(function () { throw err; });
      }
    );
  };
})();
