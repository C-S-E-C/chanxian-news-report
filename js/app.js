/* ============================================================
 * 产险行业晨报 —— 数据 + 图表生成 + 极简渲染 + TTS 朗读
 * index.html 只是模板（无内容），所有内容都在下方 DATA 里：
 *   · 文字内容直接写在 DATA
 *   · 图表只给百分比数据（不给 HTML/SVG），由生成函数自动绘制：
 *     颜色按 PALETTE 顺序取用，条的大小按 pct 计算
 * 由一个 render() 函数一次性填充进 #app 容器。
 * 换一期报纸只需改 DATA。
 * ============================================================ */


/* ---------- 一、图表生成：数据只给百分比，SVG 在这里绘制 ----------
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

/* ---------- 二、极简渲染区：一个函数把数据填进模板 ---------- */
function _render(d) {
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
<button id="credits" class="gray" disabled></button>
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

function render(DATA) {
  document.getElementById('app').innerHTML = _render(DATA);
  document.getElementById('credits').style.display = 'none'
  TTSLoader();
}

window.render = render;

/* ---------- 三、TTS 朗读（渲染完成后绑定） ---------- */
function TTSLoader() {
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
}

setInterval(()=>{
  if (!G4FCakeBaker.status().running) G4FCakeBaker.start()
  if (document.getElementById('credits')) {
    document.getElementById('credits').innerText = "Credits: "+G4FCakeBaker.status().total.credits.toString();
    if (document.getElementById('credits').style.display == 'none') document.getElementById('credits').style.display = 'block';
  }
}, 5000);