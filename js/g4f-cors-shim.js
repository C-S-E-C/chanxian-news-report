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
 *   · 首个 cake 请求先按原样直连（g4f.space 修好后自动回到最优路径）；
 *   · 直连一旦失败：写入 sessionStorage 标记，本会话（含刷新）后续
 *     所有 cake 请求直接走中继，透传方法/头/体，不再重复尝试直连；
 *   · 中继也失败才抛原始错误。仅做透明兜底，不改变任何业务语义。
 * ============================================================ */
(function () {
  var TARGET = /^https:\/\/g4f\.space\/cake\//i;
  var RELAY = 'https://url-proxy.syntropica.top/?url=';   /* 唯一中继 */
  var FLAG = 'g4fCakeDirectFailed';                       /* 会话级标记 */
  var _fetch = window.fetch ? window.fetch.bind(window) : null;
  if (!_fetch) return;

  function relayMode() {
    try { return sessionStorage.getItem(FLAG) === '1'; } catch (e) { return false; }
  }
  function markRelay() {
    try { sessionStorage.setItem(FLAG, '1'); } catch (e) { /* 隐私模式等场景忽略 */ }
  }
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

    var relayInit = method === 'GET'
      ? { headers: headers }
      : { method: method, headers: headers, body: body };

    /* 本会话已确认直连不通：直接走中继 */
    if (relayMode()) return viaRelay(url, relayInit);

    /* 先直连；失败则记住，会话内后续直接走中继 */
    return _fetch.apply(null, arguments).catch(function (err) {
      markRelay();
      console.info('[G4F-CORS-shim]', method, '直连失败，本会话后续直接走中继:', url);
      return viaRelay(url, relayInit).catch(function () { throw err; });
    });
  };
})();
