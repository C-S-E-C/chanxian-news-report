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
 *   · 直连抛 TypeError（被 CORS 拦截/网络失败）且是 GET 时，
 *     依次改走公共 CORS 中继重试一次，全部失败才抛原始错误。
 * 仅做透明兜底，不改变任何业务语义。
 * ============================================================ */
(function () {
  var TARGET = /^https:\/\/g4f\.space\/cake\//i;
  /* 中继列表：依次尝试，均返回带 Access-Control-Allow-Origin:* 的响应 */
  var RELAYS = [
    function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
    function (u) { return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u); }
  ];
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
      function (err) {                              /* 直连失败：仅对 GET 做中继兜底 */
        if (method !== 'GET') throw err;
        return relay(url, 0).catch(function () { throw err; });
      }
    );
  };

  function relay(url, i) {
    if (i >= RELAYS.length) return Promise.reject(new Error('relay exhausted'));
    console.info('[G4F-CORS-shim] 直连失败，改走中继 (' + (i + 1) + '/' + RELAYS.length + '):', url);
    return _fetch(RELAYS[i](url), { cache: 'no-store' }).catch(function (e) {
      return relay(url, i + 1);
    });
  }
})();
