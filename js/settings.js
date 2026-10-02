const dialog = document.getElementById('settingsDialog');
const status = document.getElementById('settingsStatus');
const searchProvider = document.getElementById('settingsSearchProvider');
const aiProvider = document.getElementById('settingsAIProvider');
const searchKey = document.getElementById('settingsSearchKey');
const aiKey = document.getElementById('settingsAIKey');
const mirrorSource = document.getElementById('mirrorSource');
const mirrorTarget = document.getElementById('mirrorTarget');
const mirrorList = document.getElementById('mirrorList');
const archiveList = document.getElementById('archiveList');
const SETTINGS_PREFIX = 'mirror.';

function showStatus(message, error = false) {
  status.textContent = message;
  status.dataset.state = error ? 'error' : 'ready';
}

function options(select, values) {
  select.replaceChildren(...Object.keys(values).map((name) => new Option(name, name)));
}

function providerName(value) {
  return value?.split(' | ')[0] || value;
}

function loadKeys() {
  const searchName = searchProvider.value;
  const aiName = providerName(aiProvider.value);
  searchKey.value = localStorage.getItem(`apiKey.search.${searchName}`) || '';
  aiKey.value = localStorage.getItem(`apiKey.ai.${aiName}`) || '';
}

function renderMirrors() {
  const items = Object.keys(localStorage).filter((key) => key.startsWith(SETTINGS_PREFIX)).sort();
  mirrorList.replaceChildren(...items.map((key) => {
    const row = document.createElement('div');
    row.className = 'settings-row';
    const text = document.createElement('span');
    text.textContent = `${key.slice(SETTINGS_PREFIX.length)} → ${localStorage.getItem(key)}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'gray';
    remove.textContent = '删除';
    remove.addEventListener('click', () => { localStorage.removeItem(key); renderMirrors(); });
    row.append(text, remove);
    return row;
  }));
}

function saveKey(type, name, value) {
  const key = `apiKey.${type}.${name}`;
  if (value.trim()) localStorage.setItem(key, value.trim());
  else localStorage.removeItem(key);
}

function renderArchives() {
  if (!window.Analyser?.db) return;
  window.Analyser.db.list?.().then((items) => {
    archiveList.replaceChildren(...(items || []).map((item) => {
      const row = document.createElement('div');
      row.className = 'settings-row';
      const text = document.createElement('span');
      text.textContent = `${item.date} · ${item.savedAt || ''} · ${item.source || ''}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'gray';
      remove.textContent = '删除';
      remove.addEventListener('click', async () => { await window.Analyser.db.delete(item.date); renderArchives(); });
      row.append(text, remove);
      return row;
    }));
  }).catch(() => {});
}

document.getElementById('openSettings').addEventListener('click', () => {
  options(searchProvider, window.search.providers);
  options(aiProvider, window.ai.providers);
  loadKeys();
  renderMirrors();
  renderArchives();
  dialog.showModal();
});
searchProvider.addEventListener('change', loadKeys);
aiProvider.addEventListener('change', loadKeys);

document.getElementById('saveSettingsKeys').addEventListener('click', () => {
  const searchName = searchProvider.value;
  const aiName = providerName(aiProvider.value);
  saveKey('search', searchName, searchKey.value);
  saveKey('ai', aiName, aiKey.value);
  try {
    const searchInstance = window.search.selectProvider(searchName);
    if (typeof searchInstance.updateApiKey === 'function') searchInstance.updateApiKey(searchKey.value);
    const aiInstance = window.ai.selectProvider(aiName);
    if (typeof aiInstance.updateApiKey === 'function') aiInstance.updateApiKey(aiKey.value);
  } catch (error) { showStatus(String(error), true); return; }
  showStatus('API Key 已保存');
});

document.getElementById('saveMirror').addEventListener('click', () => {
  const source = mirrorSource.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const target = mirrorTarget.value.trim();
  if (!source || !target) return showStatus('请填写原始域名和镜像域名', true);
  localStorage.setItem(`${SETTINGS_PREFIX}${source}`, target);
  mirrorSource.value = '';
  mirrorTarget.value = '';
  renderMirrors();
  showStatus('镜像已保存');
});

document.getElementById('clearMirror').addEventListener('click', () => {
  const source = mirrorSource.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!source) return showStatus('请填写要清除的原始域名', true);
  localStorage.removeItem(`${SETTINGS_PREFIX}${source}`);
  renderMirrors();
  showStatus('镜像已清除');
});

document.getElementById('clearNetworkCache').addEventListener('click', async () => {
  try { await window.cacheManager.clear(); showStatus('网络缓存已清除'); }
  catch (error) { showStatus(String(error), true); }
});

document.getElementById('exportArchive').addEventListener('click', async () => {
  const item = await window.Analyser?.db.get?.(window.Analyser.db.todayKey());
  if (!item) return showStatus('没有可导出的今日存档', true);
  const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `chanxian-report-${item.date}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showStatus('存档已导出');
});

document.getElementById('importArchive').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file || !window.Analyser?.db?.put) return;
  try {
    const item = JSON.parse(await file.text());
    if (!item.date || !item.data) throw new Error('存档格式无效');
    await window.Analyser.db.put(item);
    renderArchives();
    showStatus('存档已导入');
  } catch (error) { showStatus(String(error), true); }
});
