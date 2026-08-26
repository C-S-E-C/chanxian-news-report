/* ============================================================
 * G4F CORS 兜底垫片 —— 必须在 cake-baker.js 之前加载
 *
 * 现状：g4f.space 对 https://c-s-e-c.github.io 的跨域请求返回
 *   Access-Control-Allow-Origin: null
 * 这是对方服务器的配置错误（预检头全套都在，唯独 ACAO 值写成了 null）：
 *   · GET（如 /cake/issue）响应被浏览器直接丢弃；
 *   · POST（如 /cake/bake）的 OPTIONS 预检同样被拒。
 * 唯一自建中继 url-proxy.syntropica.top 会补上 Access-Control-Allow-Origin:*。
 *
 * 本垫片包装 window.fetch：
 *   · 非 g4f.space/cake/* 的请求一律原样放行；
 *   · 所有方法一律先按原样直连 —— g4f.space 修好后自动回到最优路径，
 *     且直连能保证 issue/bake 来源 IP 一致（服务端按 IP 绑定签发）；
 *   · 被拦/失败时改走中继重试一次，透传方法/头/体，仍失败抛原始错误。
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

    /* 一律直连优先；被 CORS 拦截/网络失败时才走中继兜底一次 */
    return _fetch.apply(null, arguments).catch(function (err) {
      console.info('[G4F-CORS-shim]', method, '直连失败，改走中继:', url);
      var relayInit = method === 'GET'
        ? { headers: headers }
        : { method: method, headers: headers, body: body };
      return viaRelay(url, relayInit).catch(function () { throw err; });
    });
  };
})();
