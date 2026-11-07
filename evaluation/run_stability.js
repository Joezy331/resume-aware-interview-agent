/* =====================================================================
 * run_stability.js — Test 4 执行器（系统稳定性）
 *
 *  (1) 重复调用真实接口：K 次请求，统计
 *      总/成功/失败/超时、API 成功率、P50/P95/均值、失败类型分布。
 *  (2) 多轮对话状态保留：6 段 3 轮对话，第 1 轮植入暗号，第 3 轮召回，
 *      统计端点级上下文保留率（复刻应用"逐轮累积 history 再发送"的方式）。
 *  (3) 核心回归测试通过率：见 run_regression.js（独立离线执行，结果并入报告）。
 *
 *  全部来自真实运行，无预设。
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const h = require('./harness.js');

const OUT = path.join(__dirname, 'out', 'stability.json');
const CONC = 4;
const K = 40; // API 负载调用次数

const WORDS = ['橙汁', '灯塔', '量子', '锦鲤', '齿轮', '薄荷'];

function pool(items, worker, conc){
  // 健壮版：用 started/completed 计数，绝不在稀疏数组空洞上误判完成
  return new Promise((resolve) => {
    const out = new Array(items.length);
    let started = 0, completed = 0;
    function next(){
      if (started >= items.length) return;
      const my = started++;
      Promise.resolve().then(() => worker(items[my], my))
        .then(r => { out[my] = r; })
        .catch(e => { out[my] = { error: e.message }; })
        .then(() => {
          completed++;
          if (completed === items.length) resolve(out);
          else next();
        });
    }
    const k = Math.min(conc, items.length);
    for (let i = 0; i < k; i++) next();
  });
}
function pct(a, b){ return b ? +(a / b).toFixed(4) : 0; }
function quantile(arr, q){ if (!arr.length) return 0; const s = arr.slice().sort((a,b)=>a-b); return s[Math.floor(s.length * q)] || s[s.length-1]; }

async function run(){
  const meta = h.configMeta();
  const t0 = Date.now();

  // ===== (1) API 负载测试 =====
  const loadItems = Array.from({length: K}, (_, i) => i);
  const apiCalls = await pool(loadItems, async (i) => {
    const r = await h.callModel({
      user: '请用一句话解释什么是「产品经理」，不超过 20 个字。',
      temperature: 0.3, maxTokens: 60, timeoutMs: 60000
    });
    return { i, ok: r.ok, httpStatus: r.httpStatus, error: r.error, latencyMs: r.latencyMs || 0 };
  }, CONC);

  const total = apiCalls.length;
  const success = apiCalls.filter(c => c.ok).length;
  const fail = total - success;
  const timeouts = apiCalls.filter(c => !c.ok && (c.error === '超时')).length;
  const httpFails = apiCalls.filter(c => !c.ok && c.httpStatus && c.httpStatus !== 0);
  const lat = apiCalls.filter(c => c.ok && c.latencyMs).map(c => c.latencyMs);
  const api = {
    total, success, fail, timeouts,
    http_error_breakdown: httpFails.reduce((m, c) => { const k = 'HTTP ' + c.httpStatus; m[k] = (m[k]||0)+1; return m; }, {}),
    api_success_rate: pct(success, total),
    latency_mean_ms: lat.length ? Math.round(lat.reduce((a,b)=>a+b,0)/lat.length) : 0,
    latency_p50_ms: quantile(lat, 0.5),
    latency_p95_ms: quantile(lat, 0.95),
    latency_max_ms: lat.length ? Math.max.apply(null, lat) : 0
  };

  // ===== (2) 多轮对话状态保留 =====
  const retention = await pool(WORDS, async (word, i) => {
    const sys = '你是一个严谨的助手，请严格按用户要求回复。';
    // 轮1：植入暗号
    const r1 = await h.callModel({ messages: [
      {role:'system', content: sys},
      {role:'user', content: `请记住这个暗号：「${word}」。然后只回复「已记住」。`}
    ], temperature: 0, maxTokens: 20 });
    // 轮2：无关问题（验证 context 不被覆盖）
    const r2 = await h.callModel({ messages: [
      {role:'system', content: sys},
      {role:'user', content: `请记住这个暗号：「${word}」。然后只回复「已记住」。`},
      {role:'assistant', content: '已记住'},
      {role:'user', content: '今天的天气适合散步吗？简短回答即可。'}
    ], temperature: 0, maxTokens: 30 });
    // 轮3：召回暗号
    const r3 = await h.callModel({ messages: [
      {role:'system', content: sys},
      {role:'user', content: `请记住这个暗号：「${word}」。然后只回复「已记住」。`},
      {role:'assistant', content: '已记住'},
      {role:'user', content: '今天的天气适合散步吗？简短回答即可。'},
      {role:'assistant', content: (r2.ok ? r2.text : '简短回答')},
      {role:'user', content: '我最早让你记住的暗号是什么？只回复那个暗号本身，不要解释。'}
    ], temperature: 0, maxTokens: 20 });
    const recalled = r3.ok && r3.text.indexOf(word) !== -1;
    return { word, turn3_ok: r3.ok, recalled, turn3_text: r3.ok ? r3.text.slice(0, 40) : r3.error };
  }, 3);

  const retTotal = retention.length;
  const retRecalled = retention.filter(r => r.recalled).length;

  const out = {
    test: 'Test4-system-stability',
    meta: Object.assign({}, meta, { concurrency: CONC, load_calls: K, generated_at: new Date().toISOString(), elapsed_ms: Date.now()-t0 }),
    metrics: {
      api_total: api.total, api_success: api.success, api_fail: api.fail, api_timeouts: api.timeouts,
      api_success_rate: api.api_success_rate,
      latency_mean_ms: api.latency_mean_ms, latency_p50_ms: api.latency_p50_ms, latency_p95_ms: api.latency_p95_ms, latency_max_ms: api.latency_max_ms,
      http_error_breakdown: api.http_error_breakdown,
      multiturn_total: retTotal, multiturn_recalled: retRecalled,
      multiturn_retention_rate: pct(retRecalled, retTotal),
      // 应用层多轮状态保留：interviewState.answers 为确定性数组追加，由 dom_smoke/flow_check 回归覆盖
      app_state_retention: 'covered-by-regression'
    },
    api_calls: apiCalls,
    retention
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log('=== Test 4 完成 ===');
  console.log('API 负载:', api.total, '次 | 成功', api.success, '| 失败', api.fail, '| 超时', api.timeouts);
  console.log('API 成功率:', api.api_success_rate, '| P50', api.latency_p50_ms, 'ms / P95', api.latency_p95_ms, 'ms / 均值', api.latency_mean_ms, 'ms');
  console.log('HTTP 错误分布:', JSON.stringify(api.http_error_breakdown));
  console.log('多轮召回:', retRecalled + '/' + retTotal, '=', out.metrics.multiturn_retention_rate);
  retention.forEach(r => console.log('  ', r.word, '→', r.recalled ? '召回✔' : '未召回✘', '|', r.turn3_text));
  console.log('已写入', OUT);
}

run().catch(e => { console.error('FATAL', e); process.exit(1); });
