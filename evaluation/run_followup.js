/* =====================================================================
 * run_followup.js — Test 2：动态追问效果（真实模型调用）
 * 复刻 index.html 的追问评估 prompt（askNextQuestionV3 → evaluateAnswer），
 * 向本地 Cline 服务发请求，解析 {score,dimension,needFollowup,followup,comment}。
 * 合理性由 scenarios_followup.js 中评估者设定的 expectedNeed 判定（非模型自判）。
 * 相关性/上下文利用采用「字面+结构」可复现启发式（已在报告中注明需人工复核）。
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { callModel, configMeta } = require('./harness');
const { BASE, scenarios } = require('./scenarios_followup');

const OUT_DIR = path.join(__dirname, 'out');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const DIM = ['comm', 'biz', 'tech', 'leader', 'strategy', 'culture'];

function bigrams(s) {
  s = String(s || '').replace(/[\s\p{P}]/gu, '');
  const g = [];
  for (let i = 0; i < s.length - 1; i++) g.push(s.slice(i, i + 2));
  return g;
}
function overlapRatio(a, b) {
  const A = new Set(bigrams(a)), B = new Set(bigrams(b));
  if (!A.size) return 0;
  let c = 0; A.forEach(x => { if (B.has(x)) c++; });
  return c / A.size;
}
function mapOverlap(o) {
  if (o >= 0.30) return 5;
  if (o >= 0.18) return 4;
  if (o >= 0.10) return 3;
  if (o >= 0.04) return 2;
  return 1;
}
function parseJSON(text) {
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a === -1 || b === -1) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}

const contextText = BASE.resume + '\n' + BASE.jd + '\n' + BASE.history.map(h => h.q + h.a).join('\n') + '\n' + BASE.question;

async function evalOne(sc) {
  const user =
    '面试问题：' + BASE.question + '\n' +
    '候选人回答：' + sc.answer + '\n' +
    '候选人简历摘要：\n' + BASE.resume + '\n\n' +
    '请评估回答，从以下维度选最相关的一个打分：\n' +
    'comm(沟通表达) biz(业务理解) tech(技术深度) leader(领导力) strategy(战略思维) culture(文化匹配)\n' +
    '返回纯JSON：\n{"score":0到95的整数,"dimension":"六个之一","needFollowup":true或false,"followup":"needFollowup为true时写追问问题否则空字符串","comment":"一句话评价"}';
  const res = await callModel({ system: '你是严格的面试评分与追问决策助手。必须仅依据候选人【实际回答】与【简历】评估，禁止臆测未提及的信息。', user, temperature: 0.2, maxTokens: 400 });
  const parsed = res.ok ? parseJSON(res.text) : null;
  const followup = (parsed && typeof parsed.followup === 'string') ? parsed.followup.trim() : '';
  const needFU = !!(parsed && parsed.needFollowup === true);
  const hasFU = followup.length > 0 && !/^(无|不需要|无需|null|none)$/i.test(followup);
  const actualFU = needFU && hasFU;

  // 启发式评分（可复现，已在报告注明需人工复核）
  let relevance = null, contextUtil = null, repetition = false, unsupported = false, newInfoProbed = false;
  if (actualFU) {
    const rel = overlapRatio(followup, sc.answer);
    const ctx = overlapRatio(followup, contextText);
    relevance = mapOverlap(rel);
    contextUtil = mapOverlap(ctx);
    // 增强：追问引用了回答中的量化指标/数字 → 明确切题（如"52%→76%、31%"）
    const ansNums = sc.answer.match(/\d+(?:\.\d+)?\s?[%％万千古百次天周月年点分pp]/g) || [];
    const fuNums = followup.match(/\d+(?:\.\d+)?\s?[%％万千古百次天周月年点分pp]/g) || [];
    if (fuNums.some(n => ansNums.indexOf(n) >= 0)) relevance = Math.max(relevance, 5);
    // 增强：追问引用了回答中的核心实词（≥2字且非停用词）
    const coreWords = (sc.answer.match(/[一-龥]{2,}/g) || []).filter(w => !/^(项目|这个|那个|一个|我们|他们|觉得|来说|整体|比较|一些|还是|其实|就是|做过|参与|负责|主要|提升|下降|通过|进行|以及|说明|角色|业务|影响|成果|代表|作为|当时|其实|问题|背景|目标|动作|结果|复盘|风险|下一步|待|未|没|不)$/.test(w));
    const fuWords = new Set((followup.match(/[一-龥]{2,}/g) || []));
    const coreHit = coreWords.some(w => fuWords.has(w));
    if (coreHit) relevance = Math.max(relevance, Math.max(relevance, 3));
    // 重复：与历史问题高度重叠
    repetition = BASE.history.some(h => overlapRatio(followup, h.q) > 0.5);
    // 无依据推断：引用候选人"之前所说"但内容在上下文中无支撑
    if (/(你说你|你提到你|据你|你之前说|你之前提到|你刚才说)/.test(followup)) {
      unsupported = overlapRatio(followup, contextText) < 0.05;
    }
  }
  if (sc.type === 'new-info' && actualFU) {
    newInfoProbed = (relevance != null && relevance >= 3);
  }

  const decisionRational = (needFU === sc.expectedNeed);

  return {
    id: sc.id, type: sc.type, expectedNeed: sc.expectedNeed,
    answer: sc.answer,
    ok: res.ok, httpStatus: res.httpStatus, latencyMs: res.latencyMs,
    raw: res.ok ? res.text : ('ERROR: ' + res.error),
    parsed,
    score: parsed ? parsed.score : null,
    dimension: parsed ? parsed.dimension : null,
    needFollowup: needFU, hasFollowup: hasFU, actualFollowup: actualFU,
    followup, comment: parsed ? parsed.comment : null,
    relevance, contextUtil, repetition, unsupported, newInfoProbed,
    decisionRational
  };
}

// 受限并发执行
async function pool(items, worker, concurrency) {
  const out = new Array(items.length);
  let idx = 0;
  async function next() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await worker(items[i], i);
    }
  }
  const ps = [];
  for (let k = 0; k < concurrency; k++) ps.push(next());
  await Promise.all(ps);
  return out;
}

function pct(x) { return Math.round(x * 1000) / 10; }
function quantile(arr, q) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos), rest = pos - base;
  return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base];
}

(async function main() {
  console.log('Test 2 动态追问评测：模型=' + configMeta().model + ' 并发=4 场景数=' + scenarios.length);
  const results = await pool(scenarios, evalOne, 4);

  const okCount = results.filter(r => r.ok).length;
  const lat = results.filter(r => r.ok).map(r => r.latencyMs);
  const fuResults = results.filter(r => r.actualFollowup);
  const rel = fuResults.map(r => r.relevance).filter(v => v != null);
  const ctx = fuResults.map(r => r.contextUtil).filter(v => v != null);
  const rep = fuResults.filter(r => r.repetition).length;
  const unsup = fuResults.filter(r => r.unsupported).length;
  const newInfoSc = results.filter(r => r.type === 'new-info');
  const newInfoProbed = newInfoSc.filter(r => r.newInfoProbed).length;
  const decisionRational = results.filter(r => r.decisionRational).length;

  const metrics = {
    sample_total: scenarios.length,
    api_success: okCount, api_success_rate: pct(okCount / scenarios.length),
    api_fail: scenarios.length - okCount,
    latency_mean_ms: Math.round(lat.reduce((a, b) => a + b, 0) / (lat.length || 1)),
    latency_p50_ms: Math.round(quantile(lat, 0.5)),
    latency_p95_ms: Math.round(quantile(lat, 0.95)),
    latency_max_ms: lat.length ? Math.max.apply(null, lat) : 0,
    followup_generated_n: fuResults.length,
    relevance_avg: rel.length ? Math.round(rel.reduce((a, b) => a + b, 0) / rel.length * 100) / 100 : null,
    context_util_avg: ctx.length ? Math.round(ctx.reduce((a, b) => a + b, 0) / ctx.length * 100) / 100 : null,
    decision_rational_n: decisionRational,
    decision_rational_rate: pct(decisionRational / scenarios.length),
    repetition_n: rep, repetition_rate: fuResults.length ? pct(rep / fuResults.length) : null,
    unsupported_n: unsup, unsupported_rate: fuResults.length ? pct(unsup / fuResults.length) : null,
    newinfo_scenarios: newInfoSc.length, newinfo_probed_n: newInfoProbed,
    newinfo_probed_rate: newInfoSc.length ? pct(newInfoProbed / newInfoSc.length) : null
  };

  // 对照实验：同一上下文，仅改变回答（specific / vague / contradictory）
  const control = ['F01', 'F09', 'F41'].map(id => {
    const r = results.find(x => x.id === id);
    return { id, type: r.type, expectedNeed: r.expectedNeed, needFollowup: r.needFollowup, followup: r.followup, comment: r.comment };
  });

  const out = { test: 'followup', model: configMeta(), metrics, control, results };
  fs.writeFileSync(path.join(OUT_DIR, 'followup.json'), JSON.stringify(out, null, 2), 'utf8');

  console.log('--- 结果 ---');
  console.log('API 成功率:', metrics.api_success_rate + '% (' + okCount + '/' + scenarios.length + ')');
  console.log('耗时 ms 均值/ P50/ P95/ 最大:', metrics.latency_mean_ms, metrics.latency_p50_ms, metrics.latency_p95_ms, metrics.latency_max_ms);
  console.log('生成追问数:', metrics.followup_generated_n, '| 相关性均值:', metrics.relevance_avg, '| 上下文利用均值:', metrics.context_util_avg);
  console.log('决策合理率:', metrics.decision_rational_rate + '% (' + decisionRational + '/' + scenarios.length + ')');
  console.log('重复问题率:', metrics.repetition_rate + '% (' + rep + '/' + fuResults.length + ') | 无依据推断率:', metrics.unsupported_rate + '% (' + unsup + '/' + fuResults.length + ')');
  console.log('新信息追问率:', metrics.newinfo_probed_rate + '% (' + newInfoProbed + '/' + newInfoSc.length + ')');
  console.log('对照实验（同上下文不同回答）:', JSON.stringify(control, null, 0));
  console.log('已写入', path.join(OUT_DIR, 'followup.json'));
})();
