/* ============================================================
 * analyser.js —— AI 自动编辑器 + 简易 MCP 工具层
 *
 * 流程：
 *   进入网页 → IndexedDB 有当天快照？直接用（不再调 AI）
 *            → 没有：先渲染内置兜底数据并备份，
 *              然后 AI 上岗：给它 system prompt（教它用工具）+
 *              直接喂今日新闻列表，它边分析边调 fill_template
 *              实时把内容写进页面；全部添加完后回复 {"done":true}，
 *              之后不再调用 AI。
 * ============================================================ */

/* ---------- 内置兜底报告内容（AI 未产出前的占位，也是各字段的缺省值） ---------- */
/* ---------- 兜底数据：全部为空，页面完全由 AI 输出实时构建 ---------- */
var DEFAULT_DATA = {
  kpis: [],
  intro: '',
  news: [],
  dataLead: '',
  charts: [],
  companies: [],
  watch: [],
  ending : '',
  sources: '',
  note   : `本报告由 ${ai.current.provider} 基于 ${search.current.provider} 自动整理生成，不构成投资建议。`
};

/* ---------- 基础设施：日期与 IndexedDB ---------- */
const DB_NAME = 'chanxian-report', STORE = 'snapshots', SEARCH_STORE = 'searchResults';
let headlineCache = null, headlineCacheKey = null;

const postStatus = (value, color = 'var(--amber)') =>
    window.channels.statUpdater.postMessage({ name: '编辑', value, color, exp: -1 });

function todayKey() {
  const t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
}
function fmtDateCN(t) {
  const wd = ['日', '一', '二', '三', '四', '五', '六'][t.getDay()];
  return `${t.getMonth() + 1}月${t.getDate()}日  ${t.getFullYear()}  星期${wd}`;
}
function openDB() {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open(DB_NAME, 2);
    rq.onupgradeneeded = () => {
      if (!rq.result.objectStoreNames.contains(STORE)) rq.result.createObjectStore(STORE, { keyPath: 'date' });
      if (!rq.result.objectStoreNames.contains(SEARCH_STORE)) rq.result.createObjectStore(SEARCH_STORE, { keyPath: 'key' });
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
async function idbPut(rec) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec);
    rq.onsuccess = () => resolve(true);
    rq.onerror = () => reject(rq.error);
  });
}
async function idbList() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    rq.onsuccess = () => resolve(rq.result || []);
    rq.onerror = () => reject(rq.error);
  });
}
async function idbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
function searchCacheKey(type, url = '') {
  return JSON.stringify([todayKey(), search.current.provider, type, url]);
}

async function searchCacheGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(SEARCH_STORE, 'readonly').objectStore(SEARCH_STORE).get(key);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}

async function searchCachePut(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(SEARCH_STORE, 'readwrite').objectStore(SEARCH_STORE).put({ key, value });
    rq.onsuccess = () => resolve(value);
    rq.onerror = () => reject(rq.error);
  });
}

async function cachedSearch(type, url, fetchResult) {
  const key = searchCacheKey(type, url);
  try {
    const cached = await searchCacheGet(key);
    if (cached) return cached.value;
  } catch (e) {
    console.warn('[Analyser] 搜索缓存读取失败：', e);
  }
  const result = await fetchResult();
  if (result != null) {
    try { await searchCachePut(key, result); }
    catch (e) { console.warn('[Analyser] 搜索缓存写入失败：', e); }
  }
  return result;
}

async function getList() {
  const key = searchCacheKey('news');
  if (headlineCacheKey !== key) {
    headlineCache = await cachedSearch('news', '', () => search.getNews());
    headlineCacheKey = key;
  }
  return headlineCache;
}

/* ---------- 工具：获取新闻 ---------- */
async function tGetNews(args) {
  const list = await getList();
  let out = list;
  if (args.keyword) {
    const k = String(args.keyword).toLowerCase();
    out = out.filter(x => x.text.toLowerCase().includes(k));
  }
  const limit = args.limit || 30;
  return { total: list.length, returned: Math.min(out.length, limit), items: out.slice(0, limit) };
}

/* ---------- 工具：查看某个新闻 ---------- */
async function tViewNews(args) {
  if (!args.url && args.index === undefined) throw new Error('需要参数 url 或 index');
  const list = await getList();
  let url = args.url, head = null;
  if (url === undefined) {
    const item = list[args.index];
    if (!item) throw new Error('index 越界：当前共 ' + list.length + ' 条');
    url = item.href; head = item;
  }
  if (!head) head = list.filter(x => x.href === url)[0] || {};
  const c = await cachedSearch('content', url, () => search.getContent(url));
  if (!c) return { url, headline: head.text || '', from: head.from || '', detail: null, hint: '该链接暂只支持人民网正文抓取' };
  c.url = url; c.headline = head.text || '';
  return c;
}

/* ---------- 工具：填充到模板（只实时渲染；完成前不写 IndexedDB） ---------- */
function mergeReport(data) {
  return Object.assign({}, DEFAULT_DATA, data || {});
}
let currentReport = null;                   // 当前已合并的报告状态（供 AI 分批填充累积）
async function tFillTemplate(args) {
  const data = args.data || {};
  currentReport ||= Object.assign({}, DEFAULT_DATA);
  const ds = args.date || fmtDateCN(new Date());
  const arrayFields = new Set(['kpis', 'news', 'companies', 'watch', 'charts']);
  let rendered = 0;

  for (const [field, value] of Object.entries(data)) {
    if (!Object.hasOwn(DEFAULT_DATA, field)) continue;
    if (arrayFields.has(field)) {
      if (!Array.isArray(value)) continue;
      for (const item of value) {
        const existing = currentReport[field];
        const duplicate = field === 'news'
          ? existing.some(news => news.title === item?.title && news.src === item?.src)
          : existing.some(entry => JSON.stringify(entry) === JSON.stringify(item));
        if (duplicate) continue;
        currentReport = { ...currentReport, [field]: [...existing, item] };
        window.render(currentReport, ds);
        rendered++;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } else if (value != null && value !== currentReport[field]) {
      currentReport = { ...currentReport, [field]: value };
      window.render(currentReport, ds);
      rendered++;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  return {
    ok: true,
    updated: rendered,
    saved: false,
    reason: '逐项渲染完成；等待 AI 回复 {"done":true} 后再写入 IndexedDB',
    counts: { kpis: currentReport.kpis.length, news: currentReport.news.length, charts: currentReport.charts.length, companies: currentReport.companies.length, watch: currentReport.watch.length }
  };
}

function reportIssues(data) {
  const issues = [];
  if (!data || typeof data.intro !== 'string' || !data.intro.trim()) issues.push('今日导读');
  if (!Array.isArray(data?.news) || !data.news.some(item =>
    typeof item?.title === 'string' && item.title.trim() &&
    typeof item?.text === 'string' && item.text.trim() &&
    typeof item?.src === 'string' && item.src.trim())) {
    issues.push('至少一条有标题、摘要和来源的新闻');
  }
  return issues;
}

async function saveCompletedReport(source) {
  if (reportIssues(currentReport).length) return null;
  const rec = {
    date: todayKey(),
    datestr: window.__CURRENT_REPORT_DATE__ || fmtDateCN(new Date()),
    savedAt: new Date().toISOString(),
    source: source || 'ai-complete',
    complete: true,
    data: currentReport
  };
  await idbPut(rec);
  return rec;
}

/* ---------- 辅助工具：查看某天的备份 ---------- */
async function tGetBackup(args) {
  const r = await idbGet(args.date || todayKey());
  if (!r) return { found: false, date: args.date || todayKey() };
  return { found: true, date: r.date, datestr: r.datestr, savedAt: r.savedAt, source: r.source, data: r.data };
}

async function callTool(name, args) {
  switch (name) {
    case 'get_news':      return tGetNews(args || {});
    case 'view_news':     return tViewNews(args || {});
    case 'fill_template': return tFillTemplate(args || {});
    case 'get_backup':    return tGetBackup(args || {});
    default: throw new Error('unknown tool: ' + name);
  }
}

/* ============================================================
 * AI 编辑：system prompt 教它用工具，直接喂新闻列表，
 * 它分批调 fill_template 实时写入页面，全部加完即停。
 * ============================================================ */
const SYSTEM_PROMPT = `你是《产险行业晨报》的自动编辑，负责把今天的新闻整理成晨报并实时写入网页。

每次只回复一个完整 JSON 对象，不要多个对象、代码块、XML 或解释文字。每轮只做一件事：
查看正文：{"tool":"view_news","index":0}
填充报告：{"tool":"fill_template","data":{"intro":"今日导读"}}
新闻单独填充：{"tool":"fill_template","data":{"news":[{"chip":"data","tag":"数据","color":"--accent","title":"新闻标题","text":"已核对正文的摘要","src":"来源名称"}]}}
全部完成：{"done":true}（至少已有导读和一条带标题、摘要、来源的新闻）
严格使用英文双引号，JSON 字符串内部不要出现未转义的双引号；每次只提交一个字段或一条新闻，不要重复提交整个报告，也不要输出空 news。查看正文后等待工具结果，再单独填充报告。禁止在同一回复中同时输出工具调用和 done。

fill_template 可用字段：
- intro：今日导读，一段话
- kpis：[{"v":"9846","unit":"亿元","cls":"up","t":"说明"}]，cls 可选 up(红)/teal(青)/省略
- news：[{"chip":"reg","tag":"监管","color":"--red","title":"标题","text":"80~150字摘要","src":"来源：xxx"}]
  · chip/tag 配对：reg=监管/data=数据/co=公司/pay=理赔；color 对应 --red/--accent/--teal/--amber
- companies：[{"title":"标题","text":"摘要"}]
- watch：["<strong>关注点标题。</strong>风险提示正文", ...]
- charts：行业数据速览图表。【该区块没有默认内容，只有你传了才会显示】请尽量从已读新闻中提炼可量化的对比数据；没有可靠数据时宁可整个省略：
  · 条形图 {"type":"hbar","title":"…","cap":"…","bars":[{"label":"车险","value":"4504亿","note":"+2.1%","pct":100}]}，pct=相对最大条的宽度百分比（最大者100）
  · 柱状图 {"type":"vbar","title":"…","cols":[{"label":"2025年","pct":25}],"refLine":{"pct":50,"text":"50%参考线"},"note":"注释"}
  · 分割条 {"type":"split","parts":[{"label":"盈利","sub":"成本率<100%","pct":50,"color":"#3fd0a8"},{"label":"亏损","sub":">100%","pct":50,"color":"#f0524f"}]}（pct合计100）
- ending、sources、note：结尾语 / 数据来源 / 免责声明

工作要求：
1. 有可靠数据时逐个提交 kpis；没有可靠数据就跳过，不编造数字或照抄示例；
2. 从新闻列表里挑出与财产险、保险业、金融监管相关的条目（最多6条，宁缺毋滥），重要条目先用 view_news 阅读正文再提炼摘要；
3. 分批调用 fill_template，每轮只写一个字段或一条新闻；已有字段不需要重发，每个数组项都会独立上屏；
4. 页面各区块只显示你提交过的内容——某区块未提交前不会出现在页面上，请按批次逐步提交实现实时更新；
5. 所有内容都添加完后，必须回复 {"done":true} 结束工作。`;

function parseAgentReply(text) {
  let reply;
  try { reply = JSON.parse(text); } catch (e) { return null; }
  if (!reply || typeof reply !== 'object' || Array.isArray(reply)) return null;
  if (reply.done === true && !reply.tool) return { done: true };
  if (reply.done || reply.actions || typeof reply.tool !== 'string') return null;
  if (reply.tool === 'view_news' &&
      (typeof reply.index === 'number' && Number.isInteger(reply.index) && reply.index >= 0 ||
       typeof reply.url === 'string' && reply.url)) {
    return { tool: 'view_news', args: { index: reply.index, url: reply.url } };
  }
  if (reply.tool === 'fill_template' && reply.data && typeof reply.data === 'object' &&
      !Array.isArray(reply.data) && Object.keys(reply.data).length) {
    return { tool: 'fill_template', args: { data: reply.data } };
  }
  return null;
}

async function runEditorAgent() {
  const list = await getList();
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: '今天是 ' + todayKey() + '。今日新闻列表(JSON)：\n' +
        JSON.stringify(list.slice(0, 40)) + '\n请开始工作。' }
  ];
  // 一直循环回喂工具结果，直到 AI 回复 {"done":true}；
  // 仅当连续多轮无法解析时才保护性中止，避免故障模型死循环刷接口。
  let consecutiveFailures = 0, stalledRounds = 0, round = 0;
  let completed = false;
  let lastCommand = '', repeats = 0;
  const viewed = new Set();
  while (round < 30) {
    round++;
    const res = await ai.completions.create({ messages });
    const text = res.choices?.[0]?.message?.content || '';
    console.log('[Analyser][AI] 第' + round + '轮输出：', String(text));
    postStatus(`AI第 ${round} 轮输出：${String(text).slice(0, 60)}${String(text).length > 60 ? '…' : ''}`);
    const parsed = parseAgentReply(text);
    if (!parsed) {
      console.warn('[Analyser][AI] 回复不是完整 JSON，finish_reason=' + (res.choices?.[0]?.finish_reason || 'unknown'));
      consecutiveFailures++;
      stalledRounds++;
      if (consecutiveFailures >= 4 || stalledRounds >= 8) { console.warn('[Analyser][AI] 多轮无有效进展，停止生成（未完成内容不保存）。'); postStatus('输出格式连续错误，已停止，未保存', 'var(--red)'); break; }
      messages.push({ role: 'user', content: currentReport?.intro
        ? '上一条 JSON 格式错误，已忽略。下一轮只提交一条简短新闻：{"tool":"fill_template","data":{"news":[{"title":"标题","text":"摘要","src":"来源"}]}}。不要重发整个报告。'
        : '上一条 JSON 格式错误，已忽略。下一轮只提交导读：{"tool":"fill_template","data":{"intro":"今日保险动态"}}。不要重发整个报告。' });
      continue;
    }
    messages.push({ role: 'assistant', content: text });
    if (parsed.done) {
      const missing = reportIssues(currentReport);
      if (missing.length) {
        consecutiveFailures++;
        stalledRounds++;
        if (consecutiveFailures >= 4 || stalledRounds >= 8) break;
        messages.push({ role: 'user', content: '报告尚未完成，缺少：' + missing.join('、') + '。请先调用 fill_template 补充，再回复 {"done":true}。' });
        continue;
      }
      try {
        const rec = await saveCompletedReport('ai-complete');
        if (rec) {
          completed = true;
          console.log('[Analyser][AI] 报告完成，已写入 IndexedDB：' + rec.date + '，共 ' + round + ' 轮。');
        }
      } catch (e) {
        console.warn('[Analyser][AI] 报告完成，但 IndexedDB 写入失败：', e);
      }
      console.log('[Analyser][AI] 报告完成，AI 下班。共 ' + round + ' 轮。');
      if (completed) postStatus('报告已完成', 'var(--teal)');
      break;
    }
    const command = JSON.stringify(parsed);
    repeats = command === lastCommand ? repeats + 1 : 0;
    lastCommand = command;
    if (repeats >= 3) {
      consecutiveFailures++;
      stalledRounds++;
      if (consecutiveFailures >= 4 || stalledRounds >= 8) break;
      messages.push({ role: 'user', content: '请不要重复同一命令。请读取不同新闻、填充新内容，或在完成后回复 {"done":true}。' });
      continue;
    }
    try {
      if (parsed.tool === 'view_news') {
        const key = parsed.args.url || String(parsed.args.index);
        if (viewed.has(key)) {
          stalledRounds++;
          messages.push({ role: 'user', content: '这条新闻已经读过。请从已读正文写出带标题、摘要、来源的 news，调用 fill_template。' });
          if (stalledRounds >= 8) break;
          continue;
        }
        viewed.add(key);
      }
      const result = await callTool(parsed.tool, parsed.args);
      messages.push({ role: 'user', content: '工具结果 ' + parsed.tool + '：' + JSON.stringify(result).slice(0, 4000) });
      if (parsed.tool === 'fill_template' && !reportIssues(currentReport).length) {
        consecutiveFailures = 0;
        stalledRounds = 0;
      } else {
        stalledRounds++;
        if (stalledRounds >= 8) { console.warn('[Analyser][AI] 8轮未写出完整新闻，停止生成。'); break; }
      }
    } catch (e) {
      consecutiveFailures++;
      stalledRounds++;
      if (consecutiveFailures >= 4 || stalledRounds >= 8) { console.warn('[Analyser][AI] 多轮工具执行失败，停止生成。'); break; }
      messages.push({ role: 'user', content: '工具执行出错：' + String(e && e.message || e) });
    }
  }
  if (round >= 30 && !completed) console.warn('[Analyser][AI] 已达到30轮上限，未完成内容不写入 IndexedDB。');
  if (!completed) postStatus('生成未完成，未保存', 'var(--red)');
  return completed;
}

let generationPromise = null;
async function regenerate() {
  if (generationPromise) return generationPromise;
  generationPromise = (async () => {
    await idbDelete(todayKey());
    for (let attempt = 1; attempt <= 2; attempt++) {
      currentReport = Object.assign({}, DEFAULT_DATA);
      window.render(currentReport, fmtDateCN(new Date()));
      postStatus(`正在生成报告（第 ${attempt} 次尝试）`);
      try {
        if (await runEditorAgent()) return true;
      } catch (e) {
        console.warn('[Analyser] AI 编辑中断（未完成内容不保存）：', e);
        postStatus('生成中断：' + String(e && e.message || e), 'var(--red)');
      }
      if (attempt < 2) postStatus('生成失败，清空对话后重试');
    }
    postStatus('两次尝试均未完成，未保存', 'var(--red)');
    return false;
  })();
  try { return await generationPromise; }
  finally { generationPromise = null; }
}

/* ---------- 启动：当天有 AI/手动产出过的快照直接用（不调AI）；否则兜底渲染后让 AI 干活 ---------- */
async function boot() {
  const key = todayKey();
  try {
    const s = await idbGet(key);
    // 只有已完成的快照才算命中；AI 分批生成中的半成品一律视为未命中
    if (s && s.data && s.complete === true && !reportIssues(s.data).length) {
      currentReport = s.data;
      window.render(s.data, s.datestr || fmtDateCN(new Date()));
      console.log('[Analyser] 命中 IndexedDB 当天快照（' + key + '），savedAt=' + s.savedAt + '，无需 AI。');
      postStatus('命中快照，无需 AI', 'var(--teal)');
      return { source: 'indexeddb', date: s.date };
    }
  } catch (e) {
    console.warn('[Analyser] IndexedDB 读取失败：', e);
  }
  // 未命中：保留搜索缓存，失败时最多从空对话重试一次。
  regenerate().catch(e => {
    postStatus('生成中断，未保存：' + String(e && e.message || e), 'var(--red)');
    console.warn('[Analyser] AI 编辑中断（未完成内容不写入 IndexedDB）：', e);
  });
  return { source: 'default+ai', date: key };
}

/* ---------- 简易 MCP（JSON-RPC 2.0）对外接口 ---------- */
function ok(id, result) { return { jsonrpc: '2.0', id, result }; }
function err(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }

const TOOLS = [
  { name: 'get_news', description: '获取今日新闻列表（人民网，经代理）。', inputSchema: { type: 'object', properties: { keyword: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'view_news', description: '查看某个新闻正文（url 或 index 二选一）。', inputSchema: { type: 'object', properties: { url: { type: 'string' }, index: { type: 'number' } } } },
  { name: 'fill_template', description: '把数据合并进晨报模板并实时渲染；完成前不写 IndexedDB。', inputSchema: { type: 'object', properties: { data: { type: 'object' }, date: { type: 'string' }, source: { type: 'string' } } } },
  { name: 'get_backup', description: '查看 IndexedDB 某天（默认今天）的备份。', inputSchema: { type: 'object', properties: { date: { type: 'string' } } } }
];

async function handle(req) {
  req = req || {};
  const id = req.id === undefined ? null : req.id;
  switch (req.method) {
    case 'initialize':
      return ok(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'chanxian-news-analyser', version: '1.1.0' } });
    case 'notifications/initialized':
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: TOOLS });
    case 'tools/call': {
      const p = req.params || {};
      try {
        const out = await callTool(p.name, p.arguments || {});
        return ok(id, { content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }] });
      } catch (e) {
        return ok(id, { isError: true, content: [{ type: 'text', text: String(e && e.message || e) }] });
      }
    }
    default:
      return err(id, -32601, 'method not found: ' + req.method);
  }
}

export const Analyser = {
  request: handle,
  callTool: (name, args) =>
    handle({ jsonrpc: '2.0', id: 'local-' + Math.random().toString(16).slice(2), method: 'tools/call', params: { name, arguments: args || {} } })
      .then(res => {
        if (res.error) throw new Error(res.error.message);
        const text = res.result.content[0].text;
        try { return JSON.parse(text); } catch (e) { return text; }
      }),
  runEditorAgent,
  regenerate,
  get generating() { return generationPromise !== null; },
  boot,
  db: { get: idbGet, put: idbPut, list: idbList, delete: idbDelete, clearToday: () => idbDelete(todayKey()), todayKey }
};
window.Analyser = Analyser;

console.log('[Analyser] 就绪：await Analyser.callTool(toolName, args)；AI 编辑随启动自动运行（仅当天无缓存时）。');
postStatus('正在等待 AI 响应', 'var(--amber)');
boot();
