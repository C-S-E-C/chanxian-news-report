/* ============================================================
 * G4F 日志降噪 —— 必须在 cake-baker.js 之前加载
 *
 * 目的：控制台只保留 [G4FCakeBaker] 的关键事件（baked/submit 等），
 *       屏蔽刷屏的 hashing 进度日志。不修改 cake-baker 本身。
 *
 * 原理：
 *   1) 包装主线程 console.log/info/debug：参数匹配 /hashing/ 直接丢弃；
 *   2) 部分 hashing 日志由 Web Worker（blob 脚本）自己打印，主线程
 *      补丁管不到 —— 因此包装 window.Worker：同步读取 blob 源码，
 *      在源码头部注入同样的过滤函数后重建 Worker。
 *   只静默输出，绝不改动任何计算逻辑；任何一步失败都回退原生行为。
 * ============================================================ */
(function () {
  var QUIET = /\[G4FCakeBaker\]\s*(hashing|hash found)/;

  /* ---- 1) 主线程 console 过滤（不动 warn/error） ---- */
  ['log', 'info', 'debug'].forEach(function (m) {
    var orig = console[m];
    if (typeof orig !== 'function') return;
    console[m] = function () {
      for (var i = 0; i < arguments.length; i++) {
        if (QUIET.test(String(arguments[i]))) return;
      }
      return orig.apply(console, arguments);
    };
  });

  /* ---- 2) Worker 内部日志过滤（仅处理 blob: 脚本） ---- */
  var NativeWorker = window.Worker;
  if (typeof NativeWorker !== 'function') return;

  var GUARD =
    '(function(){var q=/\\[G4FCakeBaker\\]\\s*(hashing|hash found)/;' +
    "['log','info','debug'].forEach(function(m){var o=console[m];" +
    'if(typeof o!=="function")return;' +
    'console[m]=function(){for(var i=0;i<arguments.length;i++){' +
    'if(q.test(String(arguments[i])))return;}' +
    'return o.apply(console,arguments);};});})();';

  function PatchedWorker(url, opts) {
    try {
      var u = String(url);
      if (/^blob:/i.test(u)) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', u, false);           /* 同步读 blob 源码 */
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) {
          var src = String(xhr.responseText || '');
          if (src && src.indexOf('q=/\\[G4FCakeBaker\\]') < 0) {   /* 防重复注入 */
            var blob = new Blob([GUARD + '\n;\n' + src], { type: 'application/javascript' });
            return new NativeWorker(URL.createObjectURL(blob), opts);
          }
        }
      }
    } catch (e) { /* 任何异常都回退原生 Worker */ }
    return new NativeWorker(url, opts);
  }
  PatchedWorker.prototype = NativeWorker.prototype;
  ['onerror'].forEach(function (k) {        /* 静态属性透传 */
    try { PatchedWorker[k] = NativeWorker[k]; } catch (e) { }
  });
  window.Worker = PatchedWorker;
})();
