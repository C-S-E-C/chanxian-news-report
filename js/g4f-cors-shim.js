/* ============================================================
 * G4F CORS 兜底垫片 —— 必须在 cake-baker.js 之前加载
 *
 * 现状：g4f.space 对 https://c-s-e-c.github.io 的跨域请求返回
 *   Access-Control-Allow-Origin: null
 * 这是对方服务器的配置错误：
 *   · GET（如 /cake/issue）响应被浏览器直接丢弃；
 *   · POST（如 /cake/bake）的 OPTIONS 预检同样被拒。
 * 唯一自建中继 url-proxy.syntropica.top 会补上 Access-Control-Allow-Origin:*。
 *
 * 本垫片包装 window.fetch：
 *   · 非 g4f.space/cake/* 的请求一律原样放行；
 *   · GET：先按原样直连（g4f.space 修好后自动回到最优路径），
 *     被拦/失败时改走中继重试一次；
 *   · 非 GET：预检在 g4f.space 处必然失败，直接经中继转发
 *     方法/头/体（要求中继支持方法与请求体透传及 OPTIONS 预检）。
 * 仅做透明兜底，不改变任何业务语义。
 * ============================================================ */
(function () {
  var TARGET = /^https:\/\/g4f\.space\/cake\//i;
  var RELAY = 'https://url-proxy.syntropica.top/?url=';   /* 唯一中继 */
  var _fetch = window.fetch ? window.fetch.bind(window) : null;
  if (!_fetch) return;

  function viaRelay(url, init) {
    var o = init || {};
    o.cache = 'no-store';
    return _fetch(RELAY + encodeURIComponent(url), o);
  }

  window.fetch = function (input, init) {
    var url = '', req = null;
    try { if (input && typeof input !== 'string') { req = input; url = input.url || ''; } else { url = input || ''; } } catch (e) { }
    if (!TARGET.test(url)) return _fetch.apply(null, arguments);

    var method = 'GET', headers = null, body;
    try {
      method = String((init && init.method) || (req && req.method) || 'GET').toUpperCase();
      headers = (init && init.headers) || (req && req.headers) || null;
      if (init && 'body' in init) body = init.body;
      else if (req && req.body) body = req.body;
    } catch (e) { }

    /* GET：直连优先，失败才走中继 */
    if (method === 'GET') {
      return _fetch.apply(null, arguments).catch(function (err) {
        console.info('[G4F-CORS-shim] GET 直连失败，改走中继:', url);
        return viaRelay(url, { headers: headers }).catch(function () { throw err; });
      });
    }
    /* 非 GET：预检必被 g4f.space 拒绝，直接经中继透传方法/头/体 */
    console.info('[G4F-CORS-shim]', method, '改走中继:', url);
    return viaRelay(url, { method: method, headers: headers, body: body });
  };
})();
