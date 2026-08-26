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
import Client from 'https://g4f.dev/dist/js/client.js';

const client = new Client();

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
  note   : '本报告由 WorkBuddy 基于公开信息自动整理生成，不构成投资建议。'
};

/* ---------- 基础设施：日期与 IndexedDB ---------- */
const DB_NAME = 'chanxian-report', STORE = 'snapshots';
const search = new SearchEngine();          // 来自 js/search.js
let headlineCache = null;

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
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore(STORE, { keyPath: 'date' }); };
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
async function idbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key);
    rq.onsuccess = () => resolve(true);
    rq.onerror = () => reject(rq.error);
  });
}
async function getList() {
  if (!headlineCache) headlineCache = await search.getNews();
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
  const c = await search.getContent(url);   // 目前支持人民网正文
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
  currentReport = Object.assign({}, currentReport || DEFAULT_DATA, args.data || {});
  const ds = args.date || fmtDateCN(new Date());
  window.render(currentReport, ds);         // ① 实时渲染进页面
  return {
    ok: true,
    saved: false,
    reason: '实时渲染完成；等待 AI 回复 {"done":true} 后再写入 IndexedDB',
    counts: { kpis: currentReport.kpis.length, news: currentReport.news.length, charts: currentReport.charts.length, companies: currentReport.companies.length, watch: currentReport.watch.length }
  };
}

async function saveCompletedReport(source) {
  if (!currentReport) return null;
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

【输出格式硬性要求】每次回复只能是"一行 JSON"，必须以 { 开头、以 } 结尾。
禁止使用 <tool_call> 标签、markdown 代码块以外的解释文字、或空回复。
推荐直接写纯 JSON（不要包 \`\`\` 代码块）。

你可以通过输出 JSON 来调用工具：
① 查看某条新闻正文：
{"actions":[{"tool":"view_news","args":{"index":0}}]}
② 把内容填充进晨报（立即渲染到页面，可分多次调用、每次填一部分）：
{"actions":[{"tool":"fill_template","args":{"data":{ ... }}}]}
③ 全部添加完毕后，回复：{"done":true}

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
1. 第一批 fill_template 必须包含全新的 kpis（从今日新闻里提炼的4~5个关键指标或看点），禁止照抄页面上的占位数据；
2. 从新闻列表里挑出与财产险、保险业、金融监管相关的条目（最多6条，宁缺毋滥），重要条目先用 view_news 阅读正文再提炼摘要；
3. 分批调用 fill_template（如：第一批 intro+kpis → 第二批 news → 第三批 companies+watch+ending+sources），每批都会实时显示在页面上；
4. 页面各区块只显示你提交过的内容——某区块未提交前不会出现在页面上，请按批次逐步提交实现实时更新；
5. 所有内容都添加完后，必须回复 {"done":true} 结束工作。`;

function extractJSON(text) {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const candidates = ['{', '['];
  let start = Infinity;
  for (const c of candidates) { const i = raw.indexOf(c); if (i !== -1 && i < start) start = i; }
  if (start === Infinity) return null;
  const close = raw[start] === '{' ? '}' : ']';
  const end = raw.lastIndexOf(close);
  if (end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch (e) { return null; }
}

/* 兼容 <tool_call> 风格的工具调用（部分本地模型的原生格式）：
 *   变体A：<tool_call>view_news<arg_key>index</arg_key><arg_value>11</arg_value></tool_call>
 *   变体B：<tool_call>{"name":"view_news","arguments":{"index":11}}</tool_call> */
function parseToolCallXML(text) {
  const out = [];
  const re = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const body = m[1].trim();
    if (body.startsWith('{')) {                      // 变体B
      try {
        const j = JSON.parse(body);
        const nm = j.name || j.tool;
        if (nm) out.push({ tool: nm, args: j.arguments || j.args || {} });
        continue;
      } catch (e) { /* 落回变体A解析 */ }
    }
    const nameM = body.match(/^([a-zA-Z_][\w]*)/);   // 变体A
    if (!nameM) continue;
    const act = { tool: nameM[1], args: {} };
    const pairs = body.match(/<arg_key>[\s\S]*?<\/arg_key>\s*<arg_value>[\s\S]*?<\/arg_value>/g) || [];
    for (const pair of pairs) {
      const k = pair.match(/<arg_key>([\s\S]*?)<\/arg_key>/)[1].trim();
      let v = pair.match(/<arg_value>([\s\S]*?)<\/arg_value>/)[1].trim();
      try { v = JSON.parse(v); } catch (e) { /* 保留字符串 */ }
      act.args[k] = v;
    }
    out.push(act);
  }
  return out.length ? { actions: out } : null;
}

/* 统一入口：把各种回复格式归一化为 {done?, actions:[{tool,args}]} */
function parseAgentReply(text) {
  if (!text || !text.trim()) return null;
  let parsed = null;
  if (text.includes('<tool_call>')) parsed = parseToolCallXML(text);   // XML 风格优先按工具调用解读
  if (!parsed) parsed = extractJSON(text);
  if (!parsed) return null;
  if (parsed.done) return { done: true, actions: [] };
  /* 单个动作对象 {"name"/"tool", "arguments"/"args"} 也算一次调用 */
  if (!Array.isArray(parsed) && !parsed.actions && (parsed.name || parsed.tool)) {
    parsed = { actions: [parsed] };
  }
  let acts = Array.isArray(parsed) ? parsed : (parsed.actions || []);
  acts = acts.map(a => {
    if (!a || typeof a !== 'object') return null;
    const tool = a.tool || a.name;
    if (!tool) return null;
    return { tool, args: a.args || a.arguments || {} };
  }).filter(Boolean);
  return { done: false, actions: acts };
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
  let consecutiveFailures = 0, round = 0;
  while (true) {
    round++;
    const res = await client.chat.completions.create({ model: 'glm-5-2', messages });
    const text = res.choices?.[0]?.message?.content || '';
    console.log('[Analyser][AI] 第' + round + '轮输出：', String(text).slice(0, 200));
    const parsed = parseAgentReply(text);
    messages.push({ role: 'assistant', content: text });
    if (!parsed) {
      consecutiveFailures++;
      if (consecutiveFailures >= 10) { console.warn('[Analyser][AI] 连续10轮无法解析，保护性停止（已渲染内容保留）。'); break; }
      messages.push({ role: 'user', content: text.trim()
        ? '无法解析。请只输出一行 JSON：工具调用 {"actions":[{"tool":"view_news","args":{"index":0}}]} 或 {"tool":"fill_template","args":{"data":{...}}}，完成后回复 {"done":true}。不要使用 <tool_call> 等其它格式。'
        : '（上一轮回复为空）请只输出 JSON：工具调用 {"actions":[...]} 或完成时回复 {"done":true}。' });
      continue;
    }
    if (parsed.done) {
      try {
        const rec = await saveCompletedReport('ai-complete');
        if (rec) console.log('[Analyser][AI] 报告完成，已写入 IndexedDB：' + rec.date + '，共 ' + round + ' 轮。');
      } catch (e) {
        console.warn('[Analyser][AI] 报告完成，但 IndexedDB 写入失败：', e);
      }
      console.log('[Analyser][AI] 报告完成，AI 下班。共 ' + round + ' 轮。');
      break;
    }
    const actions = parsed.actions;
    if (!actions.length) {
      consecutiveFailures++;
      if (consecutiveFailures >= 10) { console.warn('[Analyser][AI] 连续10轮无有效动作，保护性停止。'); break; }
      messages.push({ role: 'user', content: '没有可执行的动作，请调用工具或回复 {"done":true}。' });
      continue;
    }
    consecutiveFailures = 0;
    for (const act of actions) {
      if (!act || !act.tool) continue;
      try {
        if (act.tool === 'fill_template') {
          const r = await tFillTemplate({ data: act.args?.data || {}, source: 'ai' });   // 实时上屏+备份
          messages.push({ role: 'user', content: '工具结果 fill_template：' + JSON.stringify(r) });
        } else if (act.tool === 'view_news') {
          const r = await tViewNews(act.args || {});
          messages.push({ role: 'user', content: '工具结果 view_news：\n' + JSON.stringify(r).slice(0, 4000) });
        } else {
          messages.push({ role: 'user', content: '未知工具：' + act.tool });
        }
      } catch (e) {
        messages.push({ role: 'user', content: '工具执行出错：' + String(e && e.message || e) });
      }
    }
  }
}

/* ---------- 启动：当天有 AI/手动产出过的快照直接用（不调AI）；否则兜底渲染后让 AI 干活 ---------- */
async function boot() {
  const key = todayKey();
  try {
    const s = await idbGet(key);
    // 只有已完成的快照才算命中；AI 分批生成中的半成品一律视为未命中
    if (s && s.data && s.complete === true) {
      currentReport = s.data;
      window.render(s.data, s.datestr || fmtDateCN(new Date()));
      console.log('[Analyser] 命中 IndexedDB 当天快照（' + key + '），savedAt=' + s.savedAt + '，无需 AI。');
      return { source: 'indexeddb', date: s.date };
    }
  } catch (e) {
    console.warn('[Analyser] IndexedDB 读取失败：', e);
  }
  // 未命中：只渲染兜底内容，【不写入 IndexedDB】——AI 没产出结果前不能占用当天缓存，
  // 否则下次进入会命中假快照导致 AI 永远不会再运行。
  currentReport = Object.assign({}, DEFAULT_DATA);
  window.render(currentReport, fmtDateCN(new Date()));
  // 让 AI 接手，实时逐块填充真实内容；只有最终 done 后才写入 IndexedDB
  runEditorAgent().catch(e => console.warn('[Analyser] AI 编辑中断（未完成内容不写入 IndexedDB）：', e));
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
  boot,
  db: { get: idbGet, put: idbPut, delete: idbDelete, clearToday: () => idbDelete(todayKey()), todayKey }
};
window.Analyser = Analyser;

console.log('[Analyser] 就绪：await Analyser.callTool(toolName, args)；AI 编辑随启动自动运行（仅当天无缓存时）。');
boot();
