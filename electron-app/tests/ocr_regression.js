/* =====================================================================
 * 图片简历 OCR + AI 结构化抽取 —— 真实模型回归
 *  node tests/ocr_regression.js
 *
 * 复用应用内完全一致的提示词，验证：
 *   1) 多模态模型能把简历截图里的中文逐字转录出来
 *   2) 转录文本能喂给 job-matching 引擎，且推荐出正确行业（机械，不是 AI PM）
 *   3) 结构化 JSON 抽取能产出合法 JSON 且字段正确
 * ===================================================================== */
const fs = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'local_api_config.json'), 'utf-8'));
const API_KEY = cfg.api_key || cfg.apiKey;
const BASE = (cfg.base_url || cfg.baseUrl || 'http://localhost:8787/v1').replace(/\/+$/, '');
const VISION_MODELS = ['cline-free/mimo-v2.6-flash', 'cline-free/step-5-preview'];
const PARSE_MODELS = ['cline-free/step-5-preview', 'cline-free/mimo-v2.6-flash'];

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '\n     → ' + extra : '')); }
}

async function chat(model, messages, temperature, maxTokens) {
  const r = await fetch(BASE + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens || 2048 })
  });
  const txt = await r.text();
  if (!r.ok) return { ok: false, status: r.status, err: txt.slice(0, 200) };
  const j = JSON.parse(txt);
  return { ok: true, text: String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '') };
}

async function withFallback(messages, temp, models, maxTokens) {
  let last = null;
  for (const m of models) {
    const r = await chat(m, messages, temp, maxTokens);
    if (r.ok && r.text.trim()) return { model: m, text: r.text };
    last = r;
  }
  return { model: null, text: '', err: last };
}

/* —— 与 index.html 中 ocrImageResume 完全一致的提示词 —— */
const OCR_SYS = '你是专业的 OCR 与文档转录引擎。用户会给你一张简历图片。\n' +
  '任务：把图片里出现的所有文字逐字转录出来，保留原有的分段与条目结构（用换行分隔）。\n' +
  '要求：\n' +
  '1. 只输出转录结果，不要任何说明、标题、总结、Markdown 代码块标记。\n' +
  '2. 不要遗漏：姓名、联系方式、求职意向、教育背景（学校/专业/学历/时间）、工作与实习经历（公司/岗位/时间/职责）、项目经历、技能、证书与荣誉。\n' +
  '3. 不要编造图片里没有的内容；看不清的部分用「□」代替。\n' +
  '4. 保持原文语言（中文简历输出中文）。';

/* —— 与 index.html 中 aiExtractResume 完全一致的提示词 —— */
const PARSE_SYS = '你是简历结构化抽取引擎。只输出一个 JSON 对象，不要任何解释文字、不要 Markdown 代码块。\n' +
  'JSON 结构：\n' +
  '{"name":"","target_job":"","education":"","years":"","skills":[],"experiences":[{"org":"","role":"","period":""}],"projects":[{"name":"","desc":""}],"certs":[],"highlights":[]}\n' +
  '规则：\n' +
  '1. 全部字段必须来自原文，禁止编造；无信息时填空字符串或空数组。\n' +
  '2. education：学历+学校+专业，如「本科 · 北京理工大学 · 机械工程」。\n' +
  '3. years：工作年限，如「3年」；无则空。\n' +
  '4. skills：具体技能词（工具/技术/专业能力），6-12 个，不要写「沟通能力强」这类泛泛表述。\n' +
  '5. target_job：简历里明确写了求职意向才填，否则空字符串。\n' +
  '6. highlights：带数字的量化成就原文摘录，最多 5 条。';

/* 与 index.html 中 ocrImageResume 一致：双模型【并行竞速】，先出合格转录者胜 */
async function ocrRace(messages) {
  const sufficient = t => String(t || '').trim().length >= 120 && /[\u4e00-\u9fa5]/.test(t);
  return new Promise((resolve, reject) => {
    let pending = VISION_MODELS.length;
    let settled = false, errors = [], firstNonEmpty = null;
    const t0 = Date.now();
    VISION_MODELS.forEach(m => {
      chat(m, messages, 0.1, 4096).then(r => {
        if (settled) return;
        const t = String(r.text || '').trim();
        if (r.ok && sufficient(t)) { settled = true; console.log('  胜出模型：' + m + ' · ' + (Date.now() - t0) + 'ms'); return resolve(t); }
        if (r.ok && t && firstNonEmpty === null) firstNonEmpty = t;
        errors.push(m + ':' + (r.err || '空返回'));
        if (--pending === 0) { firstNonEmpty ? resolve(firstNonEmpty) : reject(new Error(errors.join(';'))); }
      }).catch(e => {
        if (settled) return;
        errors.push(m + ':' + e.message);
        if (--pending === 0) { firstNonEmpty ? resolve(firstNonEmpty) : reject(new Error(errors.join(';'))); }
      });
    });
  });
}

/* —— 与 index.html 中 extractJSON 一致 —— */
function extractJSON(s) {
  if (!s) return null;
  var t = String(s).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  var start = t.indexOf('{');
  if (start === -1) return null;
  var depth = 0, end = -1, inStr = false, esc = false;
  for (var i = start; i < t.length; i++) {
    var ch = t[i];
    if (inStr) { if (esc) { esc = false; continue; } if (ch === '\\') { esc = true; continue; } if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  try { var o = JSON.parse(t.slice(start, end + 1)); return (o && typeof o === 'object') ? o : null; } catch (e) { return null; }
}

(async () => {
  const png = path.join(__dirname, 'fixtures', 'resume_mechanical.png');
  if (!fs.existsSync(png)) {
    console.log('缺少样本 ' + png + '，请先运行 tests/gen_pdf.js');
    process.exit(1);
  }
  const dataUrl = 'data:image/png;base64,' + fs.readFileSync(png).toString('base64');

  console.log('\n[1] 图片 → 文字（多模态并行竞速）');
  const t0 = Date.now();
  const text = (await ocrRace(
    [{ role: 'system', content: OCR_SYS },
     { role: 'user', content: [
        { type: 'text', text: '请转录这张简历图片中的所有文字：' },
        { type: 'image_url', image_url: { url: dataUrl } }
     ] }]
  )).trim();
  const ocrMs = Date.now() - t0;
  console.log('  识别用时：' + (ocrMs / 1000).toFixed(1) + 's · 识别出 ' + text.length + ' 字');
  console.log('  --- OCR 结果 ---\n' + text.split('\n').map(l => '  | ' + l).join('\n'));

  ok('OCR 产出非空文本', text.length > 100, 'len=' + text.length);
  ok('识别耗时 < 45s（竞速生效，未串行等待慢模型）', ocrMs < 45000, (ocrMs / 1000).toFixed(1) + 's');
  ok('识别出姓名', text.indexOf('陈思远') >= 0);
  ok('识别出求职意向', text.indexOf('机械设计工程师') >= 0);
  ok('识别出学校', text.indexOf('北京理工大学') >= 0);
  ok('识别出公司', text.indexOf('上汽集团') >= 0);
  ok('识别出技能工具', /SolidWorks|ANSYS|AutoCAD/.test(text));
  ok('未输出 Markdown 围栏', !/```/.test(text));

  console.log('\n[2] OCR 文本 → job-matching 引擎（本地规则，不调用模型）');
  const JM = require(path.join(__dirname, '..', 'job-matching.js'));
  const rec = JM.recommendJobs(text, null, { topN: 5 });
  console.log('  ' + rec.jobs.map(j => j.job_title + '(' + j.match_score + ')').join(' · '));
  ok('推荐出 ≥3 个岗位', rec.jobs.length >= 3, 'n=' + rec.jobs.length);
  ok('首选岗位属于机械/工程方向', /机械|结构|工程|设计/.test(rec.jobs[0].job_title), rec.jobs[0].job_title);
  ok('未出现「AI 产品经理」等互联网岗位误判',
    rec.jobs.every(j => !/AI 产品经理|产品经理/.test(j.job_title)),
    rec.jobs.map(j => j.job_title).join(' / '));
  ok('未判定为「信息不足」', rec.insufficient === false, JSON.stringify(rec.insufficient));
  ok('方向识别命中机械/工程族（engineering_mfg）',
    (rec.debug.directions || []).some(d => String(d.familyId || '') === 'engineering_mfg'),
    JSON.stringify((rec.debug.directions || []).map(d => d.familyId)));
  ok('机械/工程族位列方向首位',
    (rec.debug.directions || [])[0] && rec.debug.directions[0].familyId === 'engineering_mfg',
    JSON.stringify((rec.debug.directions || []).map(d => d.familyId)));

  console.log('\n[3] 文字 → 结构化 JSON（AI 抽取）');
  const p = await withFallback(
    [{ role: 'system', content: PARSE_SYS },
     { role: 'user', content: '简历原文：\n---\n' + text.slice(0, 6000) + '\n---\n请输出 JSON：' }],
    0.2, PARSE_MODELS, 2048);
  if (!p.model) { console.log('  ❌ 抽取模型全部失败：' + JSON.stringify(p.err)); process.exit(1); }
  console.log('  使用模型：' + p.model);
  const obj = extractJSON(p.text);
  ok('输出可被解析为合法 JSON', !!obj, JSON.stringify(p.text.slice(0, 200)));
  if (obj) {
    console.log('  ' + JSON.stringify(obj).slice(0, 400));
    ok('name = 陈思远', obj.name === '陈思远', JSON.stringify(obj.name));
    ok('target_job = 机械设计工程师', /机械设计/.test(String(obj.target_job || '')), JSON.stringify(obj.target_job));
    ok('education 含学校', /北京理工大学/.test(String(obj.education || '')), JSON.stringify(obj.education));
    ok('skills 为非空数组', Array.isArray(obj.skills) && obj.skills.length >= 3, JSON.stringify(obj.skills));
    ok('skills 含具体工具词', (obj.skills || []).some(s => /SolidWorks|ANSYS|AutoCAD|MATLAB/i.test(String(s))), JSON.stringify(obj.skills));
  }

  console.log('\n==============================');
  console.log('  通过 ' + pass + ' / ' + (pass + fail));
  console.log('==============================\n');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERR ' + e.stack); process.exit(1); });
