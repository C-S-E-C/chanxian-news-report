(function () {
  const params = new URLSearchParams(window.location.search);
  const STORAGE_PREFIX = 'chanxian-share:';

  function backHome() {
    window.location.href = 'index.html';
  }

  function readPayload() {
    const sid = params.get('s');
    if (sid) {
      try { return localStorage.getItem(STORAGE_PREFIX + sid); } catch (e) { return null; }
    }
    const data = params.get('data');       // 兼容旧版长链接
    if (!data) return null;
    try { return decodeURIComponent(atob(data)); } catch (e) { return null; }
  }

  const raw = readPayload();
  if (!raw) { backHome(); return; }

  try {
    const share = JSON.parse(raw);
    render(share.data, share.date);
  } catch (e) {
    console.warn('[Share] 分享数据解析失败：', e);
    backHome();
  }
})();
