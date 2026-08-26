/* ============================================================
 * 产险行业晨报 —— 数据 + 图表生成 + 极简渲染 + TTS 朗读
 * index.html 只是模板（无内容），所有内容都在下方 DATA 里：
 *   · 文字内容直接写在 DATA
 *   · 图表只给百分比数据（不给 HTML/SVG），由生成函数自动绘制：
 *     颜色按 PALETTE 顺序取用，条的大小按 pct 计算
 * 由一个 render() 函数一次性填充进 #app 容器。
 * 换一期报纸只需改 DATA。
 * ============================================================ */

/* ---------- 一、内容数据区 ---------- */
var DATA = {
  kicker: 'PROPERTY & CASUALTY DAILY BRIEF',
  title : '产险行业晨报',
  date  : '2026年8月25日 · 星期二 · 由 WorkBuddy 自动整理',

  /* KPI 卡片：cls 可选 up / teal */
  kpis: [
    { v: '9846',   unit: '亿元', cls: 'up',   t: '财产险公司保费（上半年）同比 +2.1%' },
    { v: '54%',                 cls: 'teal', t: '非车险占比，首次过半' },
    { v: '5343',   unit: '亿元', cls: 'up',   t: '非车险保费 同比 +3.9%' },
    { v: '4504',   unit: '亿元',              t: '车险保费 基本持平，车均保费续降' },
    { v: '+15.3%',              cls: 'up',   t: '健康险增速，非车险中最快' }
  ],

  intro: '今日导读：金融监管总局发布《非车险综合治理行动方案》，行业监管从费用约束转向全链条治理；上半年非车险占比首次超过车险，达到百分之五十四；平安、众安等公司中报密集披露，新能源车险成为最大亮点。本期预计收听约八分钟。',

  /* 一、今日要闻：chip/tag 配对，color 取 CSS 变量名 */
  secNews: '一、今日要闻',
  news: [
    {
      chip: 'reg', tag: '监管', color: '--red',
      title: '金融监管总局发布《非车险综合治理行动方案》，非车险监管从费用约束转向全链条治理',
      text: '8月21日，金融监管总局对外发布《非车险综合治理行动方案》（金办发〔2026〕68号），提出在"十五五"期间有效整治非车险市场无序竞争，构建规范化、专业化和精细化的非车险市场体系。方案要求分险种、分阶段推进非车险存量产品重新备案，加快产品"清虚提质"；严禁保险中介虚假核算、账外经营，规范互联网平台利用流量优势收取不合理费用，严肃查处捆绑搭售、销售误导等违规行为。券商研报认为，治理升级后头部财险公司有望受益。',
      src: '来源：国家金融监督管理总局官网 / 新华社 / 西部证券研报（2026-08-24）'
    },
    {
      chip: 'data', tag: '数据', color: '--accent',
      title: '上半年财产险公司保费9846亿元，非车险占比首次过半',
      text: '中国保险行业协会7月31日发布数据：上半年财产险公司实现原保险保费收入9846亿元，同比增长2.1%。其中车险保费4504亿元与上年同期基本持平，车均保费持续下降；非车险保费5343亿元，同比增长3.9%，占比由十年前的25%提高到54%，首次超过车险。健康险保费1855亿元，同比增长15.3%，是非车险中增长最快的板块。',
      src: '来源：中国保险行业协会 / 人民网 / 新华网'
    },
    {
      chip: 'co', tag: '公司', color: '--teal',
      title: '众安在线今日发布中报：新能源车险保费同比增长105.7%',
      text: '众安在线8月25日披露2026年中期业绩：汽车生态总保费15.41亿元，同比增长4.2%，高于行业增速；其中新能源车险总保费同比增长105.7%，在公司车险总保费中的占比已接近36.5%。AI深度进入理赔全流程：查勘由传统40分钟缩短至平均3分钟，定损最快5分钟，结案最快10分钟。汽车生态综合成本率93.3%。',
      src: '来源：港交所公告（2026-08-25）'
    },
    {
      chip: 'co', tag: '公司', color: '--teal',
      title: '平安产险上半年保费1787.5亿元，新能源车保费增长21.5%',
      text: '中国平安2026年中期报告显示：财产保险业务原保险保费收入1787.51亿元，同比增长4.0%，其中新能源车原保险保费收入同比增长21.5%；整体综合成本率95.1%，同比优化0.1个百分点；车险综合成本率94.9%，同比优化0.6个百分点，盈利能力继续处于行业前列。',
      src: '来源：中国平安2026年中期报告'
    },
    {
      chip: 'pay', tag: '理赔', color: '--amber',
      title: '20省自然灾害理赔：估损110.5亿元，已赔付55.3亿元',
      text: '针对广西、湖北、甘肃等20个省份的暴雨洪涝、台风、地震等自然灾害，保险业累计接报案53.3万件，估损金额110.5亿元，已赔付55.3亿元，其中暴雨洪涝及台风灾害赔付52.1亿元。行业落地"三免四快"便民服务，理赔工作正有序推进。',
      src: '来源：中国保险行业协会例行新闻发布会（2026-07-31）'
    },
    {
      chip: 'data', tag: '数据', color: '--accent',
      title: '非上市财险公司"增收不增利"：上半年净利润同比下降3%',
      text: '据行业统计，77家非上市财险公司上半年合计实现净利润89.57亿元，同比下降约3%，其中63家实现盈利。赔付压力增加与行业竞争加剧是主因：车险利润空间收窄、新能源车险赔付成本居高不下、极端天气推高农险与车险赔付。头部阵营中，国寿财险以21.97亿元净利润居非上市公司首位。',
      src: '来源：中国经济网 / 经济参考报（2026-08）'
    }
  ],

  /* 二、行业数据速览：图表只给百分比，SVG 由下方函数绘制
   * hbar 横向条形图：pct = 相对最大条的宽度百分比（最大者为 100）
   * vbar 纵向柱状图：高度与 pct 成正比；refLine 参考线（可省略）
   * split 占比分割条：宽度 = pct% × 总宽；after 为图后解说（可省略） */
  secData : '二、行业数据速览',
  dataLead: '以下数据除特别说明外，均为2026年上半年累计口径，来源为中国保险行业协会及上市险企公告。',
  charts: [
    {
      type : 'hbar',
      title: '各险种原保险保费收入与同比增速（2026年上半年，亿元）',
      cap  : '财产险公司口径 · 车险原地踏步，健康险贡献主要增量',
      bars : [
        { label: '车险',   value: '4504亿', note: '持平',   pct: 100 },
        { label: '健康险', value: '1855亿', note: '+15.3%', pct: 41 },
        { label: '农险',   value: '1093亿', note: '+0.2%',  pct: 24 },
        { label: '责任险', value: '864亿',  note: '+8.2%',  pct: 19 },
        { label: '意外险', value: '313亿',  note: '+7.6%',  pct: 7 }
      ]
    },
    {
      type : 'vbar',
      title: '非车险占比：十年从 25% 到 54%',
      cap  : '非车险保费占财产险公司保费比例 · 跨过"半壁江山"分界线',
      cols : [
        { label: '约2016年',     pct: 25 },
        { label: '2026年上半年', pct: 54 }
      ],
      refLine: { pct: 50, text: '50% 半壁江山线' },
      note   : '十年提升约29个百分点',
      after  : '结构变化的含义：财险公司正在摆脱"车险依赖症"。科技保险、责任保险、农业保险、健康险持续扩容，非车险从十年前的补充业务成长为半壁江山。在车险综改与新能源车险高赔付的背景下，非车险的专业化经营能力将决定公司之间的分化。'
    },
    {
      type : 'split',
      title: '非上市财险公司承保盈亏分布（2026年上半年）',
      cap  : '76家披露综合成本率的非上市财险公司 · 恰好一半对一半',
      parts: [
        { label: '38家 承保盈利', sub: '综合成本率 < 100%', pct: 50, color: '#3fd0a8' },
        { label: '38家 承保亏损', sub: '综合成本率 > 100%', pct: 50, color: '#f0524f' }
      ],
      after: '行业分化正在加剧：披露数据的非上市财险公司中，承保盈利与承保亏损各占一半，二季度平均综合成本率仍在103%左右。好消息是，超过半数公司的综合成本率同比下降，行业经营基本面在改善；坏消息是，"马太效应"之下，中小公司若找不到差异化定位，生存空间会继续被压缩。'
    }
  ],

  /* 三、头部公司动态 */
  secCo: '三、头部公司动态',
  companies: [
    {
      title: '平安产险：量质齐升，综合成本率优化至95.1%',
      text : '上半年保费1787.51亿元（+4.0%），新能源车保费大增21.5%；整体综合成本率95.1%，车险综合成本率94.9%，盈利优势持续增强。平安同时推进"平安服务年"，AI查问办覆盖集团88%业务场景。'
    },
    {
      title: '众安在线：科技保险样本，AI理赔全流程提速',
      text : '数字生活生态保险服务收入76.27亿元（+31.7%），综合成本率99.2%；汽车生态中新能源车险占比升至36.5%，AI查勘、定损、结案分别压缩到3分钟、5分钟、10分钟量级，差异化线上车险路径初步跑通。'
    },
    {
      title: '非上市阵营：国寿财险领跑，盈利top5门槛4亿元级别',
      text : '上半年净利润前五为：国寿财险21.97亿元、英大财险12.59亿元、鼎和财险5.47亿元、华安财险4.72亿元、紫金财险3.44亿元。股东背景与细分客群（电网、股东业务）成为非上市公司的盈利护城河。'
    }
  ],

  /* 四、今日关注与风险提示（每条以 <strong> 开头） */
  secWatch: '四、今日关注与风险提示',
  watch: [
    '<strong>《非车险综合治理行动方案》落地节奏。</strong>重点关注：非车险存量产品重新备案的时间表、互联网平台费用规范细则、"报行合一"执行口径。方案明确"先立后破"，短期业务节奏或受影响，中长期利好合规经营的头部公司。',
    '<strong>极端天气与巨灾赔付。</strong>下半年仍是台风季，上半年自然灾害估损已超110亿元。持续跟踪台风路径对东南沿海车险、农险、企财险的赔付冲击，以及再保险安排的充足性。',
    '<strong>新能源车险的高增长与高赔付并存。</strong>上半年签单保费784亿元（+18.5%），但赔付成本居高不下。关注车企系保险公司入局、三电系统定损标准、以及监管对新能源车险定价的引导政策。',
    '<strong>中小险企的差异化窗口。</strong>马太效应加剧背景下，关注在细分领域（如新能源网约车、宠物险、网络安全险）跑出独立曲线的中小公司样本，以及非车险治理对费用率的边际改善。'
  ],
  ending: '以上就是全部内容啦，我们明天再见！',
  sources: '国家金融监督管理总局、中国保险行业协会、中国平安2026年中期报告、众安在线2026年中期业绩公告、新华社、人民网、中国经济网、经济参考报、西部证券研报（截至2026-08-25）。',
  note    : '本报告由 WorkBuddy 基于公开信息自动整理生成，数据以官方披露为准，不构成投资建议。朗读功能需在浏览器中打开本文件使用，点击顶部"播放"即可收听。'
};

/* ---------- 二、图表生成：数据只给百分比，SVG 在这里绘制 ----------
 * 颜色按 PALETTE 顺序循环取用；个别有语义的颜色（如盈亏红绿）
 * 可在数据里用 color 字段覆盖，其余一律不用写颜色。 */
var PALETTE = ['#4da3ff', '#3fd0a8', '#f2b13d', '#9d7bff', '#8b98a5'];
var INK = '#e6edf3', MUTED = '#8b98a5';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* 横向条形图：条宽 = W × pct/100 */
function hbarSVG(c) {
  var X0 = 140, W = 440, BH = 24, Y0 = 20, STEP = 45, n = c.bars.length;
  var svg = `<svg viewBox="0 0 680 ${Y0 + STEP * (n - 1) + BH + 28}" role="img" aria-label="${esc(c.title)}">`;
  svg += `<line x1="${X0}" y1="14" x2="${X0}" y2="${Y0 + STEP * (n - 1) + BH + 12}" stroke="#2a3644"/>`;
  c.bars.forEach(function (b, i) {
    var bw = Math.round(W * b.pct / 100), y = Y0 + i * STEP, ty = y + 17;
    var colr = b.color || PALETTE[i % PALETTE.length];
    svg += `<text x="128" y="${ty}" text-anchor="end" font-size="13" fill="${INK}">${esc(b.label)}</text>`;
    svg += `<rect x="${X0}" y="${y}" width="${bw}" height="${BH}" rx="4" fill="${colr}"/>`;
    svg += `<text x="${X0 + bw + 8}" y="${ty}" font-size="13" fill="${INK}" font-weight="bold">${esc(b.value)}</text>`;
    if (b.note) svg += `<text x="${X0 + bw + 61}" y="${ty}" font-size="12" fill="${/^\+/.test(b.note) ? '#f0524f' : MUTED}">${esc(b.note)}</text>`;
  });
  return svg + '</svg>';
}

/* 纵向柱状图：柱高 = MAXH × pct/maxPct，与百分比成正比 */
function vbarSVG(c) {
  var BASE = 210, MAXH = 160, CW = 90, n = c.cols.length, SPREAD = 500 / n, LEFT = 340 - SPREAD * n / 2;
  var maxPct = Math.max.apply(null, c.cols.map(function (o) { return o.pct; }));
  var svg = `<svg viewBox="0 0 680 250" role="img" aria-label="${esc(c.title)}">`;
  svg += `<line x1="60" y1="${BASE}" x2="620" y2="${BASE}" stroke="#2a3644" stroke-width="1.5"/>`;
  if (c.refLine) {
    var ry = BASE - Math.round(MAXH * c.refLine.pct / maxPct);
    svg += `<line x1="60" y1="${ry}" x2="620" y2="${ry}" stroke="#f2b13d" stroke-dasharray="6 6" stroke-width="1.5"/>`;
    svg += `<text x="620" y="${ry - 10}" text-anchor="end" font-size="12" fill="#f2b13d">${esc(c.refLine.text)}</text>`;
  }
  c.cols.forEach(function (col, i) {
    var h = Math.round(MAXH * col.pct / maxPct), cx = LEFT + SPREAD * (i + 0.5);
    var colr = col.color || PALETTE[i % PALETTE.length];
    svg += `<rect x="${cx - CW / 2}" y="${BASE - h}" width="${CW}" height="${h}" rx="6" fill="${colr}"/>`;
    svg += `<text x="${cx}" y="${BASE - h - 12}" text-anchor="middle" font-size="16" fill="${colr}" font-weight="bold">${col.pct}%</text>`;
    svg += `<text x="${cx}" y="232" text-anchor="middle" font-size="13" fill="${MUTED}">${esc(col.label)}</text>`;
  });
  if (c.note) svg += `<text x="340" y="105" text-anchor="middle" font-size="13" fill="#4da3ff">${esc(c.note)}</text>`;
  return svg + '</svg>';
}

/* 占比分割条：每段宽 = 总宽 × pct/100 */
function splitSVG(c) {
  var X = 60, TW = 560, Y = 40, BH = 40, x = X;
  var svg = `<svg viewBox="0 0 680 140" role="img" aria-label="${esc(c.title)}">`;
  c.parts.forEach(function (p, i) {
    var w = Math.round(TW * p.pct / 100), cx = x + w / 2;
    var colr = p.color || PALETTE[i % PALETTE.length];
    svg += `<rect x="${x}" y="${Y}" width="${w}" height="${BH}" fill="${colr}"/>`;
    svg += `<text x="${cx}" y="66" text-anchor="middle" font-size="15" fill="#04121f" font-weight="bold">${esc(p.label)}</text>`;
    if (p.sub) svg += `<text x="${cx}" y="105" text-anchor="middle" font-size="13" fill="${colr}">${esc(p.sub)}</text>`;
    x += w;
  });
  return svg + '</svg>';
}

function chartSVG(c) {
  if (c.type === 'hbar') return hbarSVG(c);
  if (c.type === 'vbar') return vbarSVG(c);
  return splitSVG(c);
}

/* ---------- 三、极简渲染区：一个函数把数据填进模板 ---------- */
function render(d) {
  return `
<header>
<div class="kicker">${d.kicker}</div>
<h1>${d.title}</h1>
<div class="date">${d.date}</div>
</header>

<div class="ttsbar">
<button id="btnPlay">▶ 播放</button>
<button id="btnPause" class="gray">⏸ 暂停</button>
<button id="btnStop" class="gray">■ 停止</button>
<button id="btnPrev" class="gray">⏮ 上一项</button>
<button id="btnNext" class="gray">下一项 ⏭</button>
<label>音色
<select id="voice"><option value="">自动选择</option></select>
</label>
<label>语速
<select id="rate">
<option value="0.8">0.8×</option>
<option value="1" selected>1.0×</option>
<option value="1.2">1.2×</option>
<option value="1.5">1.5×</option>
</select>
</label>
<span id="status">加载中…</span>
</div>

<section>
<div class="kpis">${d.kpis.map(k =>
`<div class="kpi"><div class="v${k.cls ? ' ' + k.cls : ''}">${k.v}${k.unit ? `<span style="font-size:14px">${k.unit}</span>` : ''}</div><div class="t">${k.t}</div></div>`).join('')}
</div>
<div class="note" data-tts>${d.intro}</div>
</section>

<h2>${d.secData}</h2>
<p data-tts>${d.dataLead}</p>
${d.charts.map(c =>
`<div class="chartbox">
<h3>${c.title}</h3>
<div class="cap">${c.cap}</div>
${chartSVG(c)}
${c.after ? `<p data-tts>${c.after}</p>` : ''}
</div>`).join('')}

<h2>${d.secCo}</h2>
${d.companies.map(c =>
`<div class="card" data-tts><div class="news-title">${c.title}</div><p>${c.text}</p></div>`).join('')}

<h2>${d.secNews}</h2>
${d.news.map(n =>
`<div class="card" style="border-left:3px solid var(${n.color})">
<div><span class="chip ${n.chip}">${n.tag}</span></div>
<div data-tts><div class="news-title">${n.title}</div><p>${n.text}</p></div>
<div class="src">${n.src}</div>
</div>`).join('')}

<h2>${d.secWatch}</h2>
<ol class="watch">
${d.watch.map(w => `<li><p data-tts>${w}</p></li>`).join('\n')}
</ol>
<br>

<div class="note" data-tts>${d.ending}</div>

<footer>
<strong>数据来源：</strong>${d.sources}<br>
<strong>说明：</strong>${d.note}
</footer>`;
}

document.getElementById('app').innerHTML = render(DATA);

/* ---------- 四、TTS 朗读（渲染完成后绑定） ---------- */
(function () {
  var synth = window.speechSynthesis;
  var parts = Array.prototype.slice.call(document.querySelectorAll('[data-tts]'));
  var playBtn = document.getElementById('btnPlay'), pauseBtn = document.getElementById('btnPause'), stopBtn = document.getElementById('btnStop');
  var prevBtn = document.getElementById('btnPrev'), nextBtn = document.getElementById('btnNext');
  var rateSel = document.getElementById('rate'), voiceSel = document.getElementById('voice'), statusEl = document.getElementById('status');
  var cur = -1, stopped = true, paused = false, gen = 0;
  var voices = [], voiceTouched = false;

  var totalChars = parts.reduce(function (s, p) { return s + p.innerText.length; }, 0);
  var mins = Math.max(1, Math.round(totalChars / 280));
  statusEl.textContent = '共 ' + parts.length + ' 段 · 预计 ' + mins + ' 分钟，点击"播放"开始收听';

  function setStatus(t) { statusEl.textContent = t; }
  function highlight(i) {
    parts.forEach(function (p, idx) { p.classList.toggle('reading', idx === i); });
    if (parts[i] && parts[i].scrollIntoView) { try { parts[i].scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { } }
  }
  /* 音色：优先用下拉框所选；未选则按偏好自动挑中文女声 */
  function pickVoice() {
    var vs = synth.getVoices();
    for (var i = 0; i < vs.length; i++) { if (/^zh/i.test(vs[i].lang) && (/female|女|Xiaoxiao|Yaoyao/i.test(vs[i].name))) return vs[i]; }
    for (var j = 0; j < vs.length; j++) { if (/^zh/i.test(vs[j].lang)) return vs[j]; }
    return null;
  }
  function currentVoice() {
    if (voiceSel.value !== '') { return voices[parseInt(voiceSel.value, 10)] || pickVoice(); }
    return pickVoice();
  }
  /* 网络状态测试：能连通 example.com 视为在线（no-cors 探测 + 超时保护） */
  function netOK(ms) {
    ms = ms || 3000;
    return new Promise(function (resolve) {
      var done = false;
      function settle(ok) { if (!done) { done = true; clearTimeout(timer); resolve(ok); } }
      var timer = setTimeout(function () { settle(false); }, ms);
      try {
        fetch('https://example.com', { mode: 'no-cors', cache: 'no-store' })
          .then(function () { settle(true); })
          .catch(function () { settle(false); });
      } catch (e) { settle(false); }
    });
  }
  /* 默认音色：在线优先"Microsoft 晓晓 Online (Natural)"；离线自动改用本地"Microsoft Yayan/Yaoyao"；都没有再走通用偏好 */
  function autoPickVoice() {
    if (voiceTouched) return;
    netOK().then(function (online) {
      if (voiceTouched) return;
      var want = null;
      if (online) {
        want = voices.filter(function (v) { return /online.*natural|natural.*online/i.test(v.name); })[0]
          || voices.filter(function (v) { return /xiaoxiao|晓晓/i.test(v.name); })[0];
      } else {
        want = voices.filter(function (v) { return /yaoyao|亚瑶|Yaoyao/i.test(v.name); })[0];
      }
      if (!want) want = pickVoice();
      if (want && voices.indexOf(want) > -1) { voiceSel.value = String(voices.indexOf(want)); }
    });
  }
  function loadVoices() {
    voices = synth.getVoices().filter(function (v) { return /^zh/i.test(v.lang); });
    if (!voices.length) return;
    var keep = voiceSel.value;
    voiceSel.innerHTML = '';
    var auto = document.createElement('option');
    auto.value = ''; auto.textContent = '自动选择';
    voiceSel.appendChild(auto);
    voices.forEach(function (v, i) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = v.name + '（' + v.lang + '）';
      voiceSel.appendChild(o);
    });
    if (keep && parseInt(keep, 10) < voices.length) { voiceSel.value = keep; }
    else { autoPickVoice(); }
  }
  /* 跳转到第 i 段：gen++ 让旧的 onend/onerror 回调失效，避免串读 */
  function jumpTo(i) {
    i = Math.max(0, Math.min(parts.length - 1, i));
    try { synth.cancel(); } catch (e) { }
    stopped = false; paused = false;
    speak(i);
    playBtn.textContent = '▶ 播放中…';
  }
  function speak(i) {
    if (i < 0 || i >= parts.length) { finish(); return; }
    cur = i; paused = false;
    highlight(i);
    setStatus('正在朗读 ' + (i + 1) + ' / ' + parts.length + ' · 点击"暂停"可中断');
    var myGen = ++gen;
    var u = new SpeechSynthesisUtterance(parts[i].innerText.replace(/\s+/g, ' ').trim());
    var v = currentVoice();
    u.lang = v ? v.lang : 'zh-CN';
    u.rate = parseFloat(rateSel.value);
    if (v) { u.voice = v; }
    u.onend = function () { if (!stopped && myGen === gen) { speak(cur + 1); } };
    u.onerror = function () { if (!stopped && myGen === gen) { speak(cur + 1); } };
    synth.speak(u);
  }
  function finish() {
    stopped = true; paused = false; cur = -1;
    parts.forEach(function (p) { p.classList.remove('reading'); });
    playBtn.textContent = '▶ 播放';
    setStatus('朗读完毕 · 共 ' + parts.length + ' 段');
  }
  playBtn.addEventListener('click', function () {
    if (paused && !stopped) { synth.resume(); paused = false; playBtn.textContent = '▶ 播放中…'; setStatus('继续朗读 ' + (cur + 1) + ' / ' + parts.length); return; }
    if (!stopped) { return; }
    stopped = false; speak(0); playBtn.textContent = '▶ 播放中…';
  });
  pauseBtn.addEventListener('click', function () {
    if (stopped) return;
    if (paused) { synth.resume(); paused = false; playBtn.textContent = '▶ 播放中…'; setStatus('继续朗读 ' + (cur + 1) + ' / ' + parts.length); }
    else if (synth.speaking) { synth.pause(); paused = true; playBtn.textContent = '▶ 播放'; setStatus('已暂停（第 ' + (cur + 1) + ' 段），点击"播放"继续'); }
  });
  stopBtn.addEventListener('click', function () {
    stopped = true; paused = false; cur = -1;
    try { synth.cancel(); } catch (e) { }
    parts.forEach(function (p) { p.classList.remove('reading'); });
    playBtn.textContent = '▶ 播放';
    setStatus('已停止 · 共 ' + parts.length + ' 段');
  });
  prevBtn.addEventListener('click', function () { jumpTo(cur <= 0 ? 0 : cur - 1); });
  nextBtn.addEventListener('click', function () { jumpTo(cur + 1); });
  voiceSel.addEventListener('change', function () {
    voiceTouched = true;   /* 用户手动选过音色后，不再自动切换 */
    if (!stopped && !paused) { jumpTo(cur); }   /* 播放中换音色立即重读当前段生效 */
  });

  loadVoices();
  if (typeof synth.onvoiceschanged !== 'undefined') { synth.onvoiceschanged = loadVoices; }
})();
