import './search.js';
import './ai.js';

const form = document.getElementById('providerConfig');
const searchSelect = document.getElementById('searchProvider');
const aiSelect = document.getElementById('aiProvider');
const searchKey = document.getElementById('searchApiKey');
const aiKey = document.getElementById('aiApiKey');
const button = form.querySelector('button[type="submit"]');
let phase = 'loading';
let lastStatus = '';

function setStatus(text, state = '') {
  const key = `${state}:${text}`;
  if (key === lastStatus) return;
  lastStatus = key;
  window.channels.statUpdater.postMessage({
    name: '配置', value: text, exp: -1,
    color: state === 'error' ? 'var(--red)' : state === 'ready' ? 'var(--teal)' : 'var(--amber)',
  });
}

function populate(select, providers, current) {
  select.replaceChildren(...Object.keys(providers).map((name) => new Option(name, name)));
  select.value = current;
}

function populateModels(select, models, current) {
  select.replaceChildren(...models.map((name) => new Option(name, name)));
  select.value = models.includes("💻 | "+current) 
    ? "💻 | "+current 
      : (models.includes("☁ | "+current) 
        ? "☁ | "+current 
          : models[0] || '');
}

function configureKey(fieldId, input, requirement) {
  if (!['needed', 'optional', 'none'].includes(requirement)) {
    throw new Error(`invalid apiKey requirement: ${requirement}`);
  }
  document.getElementById(fieldId).hidden = requirement === 'none';
  input.required = requirement === 'needed';
}

function aiProviderName() {
  return aiSelect.value.split(' | ')[1];
}

function keyStorageName(type, providerName) {
  return `apiKey.${type}.${providerName}`;
}

function restoreKey(type, providerName, providers, input) {
  const requirement = providers[providerName]?.apiKey || 'none';
  input.value = requirement === 'none' ? '' : localStorage.getItem(keyStorageName(type, providerName)) || '';
}

function saveKey(type, providerName, providers, input) {
  if (!providerName || (providers[providerName]?.apiKey || 'none') === 'none') return;
  const storageName = keyStorageName(type, providerName);
  const key = input.value.trim();
  if (key) localStorage.setItem(storageName, key);
  else localStorage.removeItem(storageName);
}

function updateFields() {
  const searchRequirement = window.search.providers[searchSelect.value]?.apiKey || 'none';
  configureKey('searchKeyField', searchKey, searchRequirement);
  restoreKey('search', searchSelect.value, window.search.providers, searchKey);
  const providerName = aiProviderName();
  const aiRequirement = window.ai.providers[providerName]?.apiKey || 'none';
  configureKey('aiKeyField', aiKey, aiRequirement);
  restoreKey('ai', providerName, window.ai.providers, aiKey);
}

function applyKey(ProviderClass, provider, input) {
  const requirement = ProviderClass.apiKey || 'none';
  const key = input.value.trim();
  if (requirement === 'needed' && !key) throw new Error('请填写 API Key');
  if (requirement !== 'none' && key) {
    if (typeof provider.updateApiKey !== 'function') throw new Error('提供商不支持设置 API Key');
    provider.updateApiKey(key);
  }
}
populate(searchSelect, window.search.providers, window.search.current.provider);
const lastSearch = localStorage.getItem('lastUsed.search');
if (lastSearch && Object.hasOwn(window.search.providers, lastSearch)) searchSelect.value = lastSearch;
searchSelect.addEventListener('change', updateFields);
aiSelect.addEventListener('change', updateFields);
searchKey.addEventListener('input', () => saveKey('search', searchSelect.value, window.search.providers, searchKey));
aiKey.addEventListener('input', () => saveKey('ai', aiProviderName(), window.ai.providers, aiKey));

function populateAI() {
  populateModels(aiSelect, window.ai.models, `${window.ai.current.provider} | ${window.ai.current.model}`);
  choose();
  updateFields();
}

window.ai.addEventListener('loaded', () => {
  populateAI();
});
window.ai.addEventListener('error', () => { populateAI(); });
if (window.ai.ready || window.ai.error) populateAI();
else updateFields();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  button.disabled = true;
  phase = 'starting';
  setStatus('正在启动…', 'loading');
  try {
    const searchProvider = window.search.selectProvider(searchSelect.value);
    applyKey(window.search.providers[searchSelect.value], searchProvider, searchKey);
    saveKey('search', searchSelect.value, window.search.providers, searchKey);
    localStorage.setItem('lastUsed.search', searchSelect.value);
    window.search.changeProvider(searchSelect.value);

    const [_,providerName, model] = aiSelect.value.split(' | ');
    if (!providerName || !model) throw new Error('没有可用的 AI 模型');
    const aiProvider = window.ai.selectProvider(providerName);
    applyKey(window.ai.providers[providerName], aiProvider, aiKey);
    saveKey('ai', providerName, window.ai.providers, aiKey);
    console.log(`切换 AI 提供商: ${providerName}, 模型: ${model}`);
    localStorage.setItem('lastUsed.ai', aiSelect.value);
    await window.ai.changeModel(providerName, model);

    await import('./analyser.js');
    phase = 'started';
    window.channels.statUpdater.postMessage({ name: '配置', value: null });
  } catch (error) {
    phase = 'error';
    setStatus(String(error?.message || error), 'error');
    button.disabled = false;
  }
});

function choose() {
  const lastSearch = localStorage.getItem('lastUsed.search');
  if (lastSearch && Object.hasOwn(window.search.providers, lastSearch)) {
    searchSelect.value = lastSearch;
  }

  const lastAI = localStorage.getItem('lastUsed.ai');
  if (lastAI && [...aiSelect.options].some((option) => option.value === lastAI)) {
    aiSelect.value = lastAI;
  }
}