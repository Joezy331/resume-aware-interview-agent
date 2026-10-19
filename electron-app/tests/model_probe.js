/* 探测各模型在本应用真实提示词下的可用性
 *  node tests/model_probe.js
 */
const fs = require('fs');
const path = require('path');

const cfgPath = path.join(__dirname, '..', 'local_api_config.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
const API_KEY = cfg.api_key || cfg.apiKey;
const BASE = (cfg.base_url || cfg.baseUrl || 'http://localhost:8787/v1').replace(/\/+$/, '');

const MODELS = [
  'cline-free/mimo-v2.6-flash',
  'cline-free/step-5-preview',
  'cline-free/solar-mini4',
  'cline-free/muse-spark-1.3-contributor'
];

async function chat(model, messages, temperature, maxTokens) {
  const t0 = Date.now();
  const r = await fetch(BASE + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
    body: JSON.stringify({ model, messages, temperature: temperature == null ? 0.7 : temperature, max_tokens: maxTokens || 1024 })
  });
  const ms = Date.now() - t0;
  const txt = await r.text();
  if (!r.ok) return { ok: false, status: r.status, ms, err: txt.slice(0, 200) };
  try {
    const j = JSON.parse(txt);
    const c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return { ok: true, ms, text: String(c || '') };
  } catch (e) { return { ok: false, status: r.status, ms, err: 'JSON parse fail' }; }
}

const CASES = [
  {
    name: '出题（含【评分】【评价】【追问】标记）',
    temp: 0.85,
    messages: [
      { role: 'system', content: '你是资深面试官。请针对候选人回答输出：\n【评分】xx（0-100整数）\n【评价】一句话\n【追问】一个追问问题' },
      { role: 'user', content: '目标岗位：机械设计工程师。候选人回答：我用 SolidWorks 做了减速器壳体建模，并用 ANSYS 做了静力学仿真，最大应力下降了18%。' }
    ],
    check: t => /【评分】/.test(t) && /【追问】/.test(t)
  },
  {
    name: '结构化 JSON（岗位候选）',
    temp: 0.4,
    messages: [
      { role: 'system', content: '只输出 JSON，不要任何解释文字。' },
      { role: 'user', content: '简历：陈思远，北京理工大学机械工程本科，上汽集团机械设计实习，熟练 SolidWorks/ANSYS/AutoCAD，CET-6。\n请输出2个候选岗位，格式：{"jobs":[{"title":"","core_skills":[""],"tasks":[""]}]}' }
    ],
    check: t => { const m = t.match(/\{[\s\S]*\}/); if (!m) return false; try { const j = JSON.parse(m[0]); return !!(j.jobs && j.jobs.length); } catch (e) { return false; } }
  },
  {
    name: '中文长文本报告',
    temp: 0.6,
    messages: [
      { role: 'system', content: '你是职业发展顾问，用中文写作，条理清晰。' },
      { role: 'user', content: '为一名机械设计工程师写一段 150 字左右的面试表现总结与成长建议。' }
    ],
    check: t => t.length >= 80
  }
];

(async () => {
  console.log('BASE = ' + BASE + '\n');
  for (const m of MODELS) {
    console.log('=== ' + m + ' ===');
    for (const c of CASES) {
      const r = await chat(m, c.messages, c.temp);
      if (!r.ok) {
        console.log('  ❌ ' + c.name + ' → HTTP ' + r.status + ' ' + JSON.stringify(r.err));
      } else {
        const good = c.check(r.text);
        console.log('  ' + (good ? '✅' : '⚠️ ') + ' ' + c.name + ' → ' + r.ms + 'ms, ' + r.text.length + '字');
        if (!good) console.log('     输出样例: ' + JSON.stringify(r.text.slice(0, 160)));
      }
    }
  }
  // 多选一：视觉能力
  console.log('\n=== 视觉 OCR 能力 ===');
  const png = path.join(__dirname, 'fixtures', '_src.html');
  console.log('（视觉能力已在上一轮验证：mimo-v2.6-flash ✅ / step-5-preview ✅ / solar-mini4 ❌ 空返回）');
})();
