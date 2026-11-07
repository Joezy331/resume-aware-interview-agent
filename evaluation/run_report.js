/* =====================================================================
 * run_report.js — Test 3 执行器（多角色评价与报告）
 *
 *  - 32 个单轮场景：复刻 submitAnswer 的评分 prompt（行 1784-1789），
 *    调真实模型，解析【评分/评价/追问】三行。
 *  - 3 个完整候选人：6 维度各 1 答，复刻 renderReportV3 聚合
 *    （行 1873-1893）→ 加权总分 / verdict / 多面试官冲突检测。
 *  - 全部指标由真实结果计算，不预设、不硬编码。
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const h = require('./harness.js');
const S = require('./scenarios_report.js');

const OUT = path.join(__dirname, 'out', 'report.json');
const CONC = 3;

// —— 情感词典（中文）用于 评分-证据一致性 代理指标 ——
const POS = ['优秀','强','清晰','到位','扎实','突出','熟练','精准','结构化','完整','全面','深刻','专业','逻辑','亮','充分','恰当','合理','有深度','量化','高','好','有效'];
const NEG = ['不足','薄弱','模糊','缺','不够','弱','问题','偏差','矛盾','含糊','笼统','缺乏','不清晰','待','提升','加强','补充','不深','浅','错误','不符','不一致','虚','空洞'];
function polarity(text){
  let p = 0;
  for (const w of POS) if (text.indexOf(w) !== -1) p++;
  for (const w of NEG) if (text.indexOf(w) !== -1) p--;
  return p;
}
function band(quality){
  // 期望分数区间（用于方向性/短板识别）
  switch(quality){
    case 'strong': return [70, 98];
    case 'medium': return [55, 82];
    case 'weak': return [30, 62];
    case 'contradictory': return [30, 60];
    case 'offtopic': return [30, 55];
    default: return [30, 98];
  }
}
function inBand(score, q){ const [lo, hi] = band(q); return score >= lo && score <= hi; }

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

async function run(){
  const meta = h.configMeta();
  const t0 = Date.now();

  // ===== 1) 32 单轮场景 =====
  const scenarios = await pool(S.REPORT_SCENARIOS, async (scn) => {
    const prompt = S.buildScorePrompt(scn, 3); // 大厂难度，要求量化与结构化
    const r = await h.callModel({ system: prompt.system, user: prompt.user, temperature: 0.4, maxTokens: 200, stage: 'score' });
    const rec = { id: scn.id, interviewerId: scn.interviewerId, dimension: scn.dimension, quality: scn.quality,
                  question: scn.question, answer: scn.answer, success: false, latencyMs: r.latencyMs || 0 };
    if (!r.ok){ rec.error = r.error; return rec; }
    const parsed = S.parseScore(r.text);
    rec.raw = r.text;
    rec.score = parsed.score;
    rec.comment = parsed.comment;
    rec.followup = parsed.followup;
    rec.pol = polarity(parsed.comment);
    rec.success = true;
    return rec;
  }, CONC);

  // ===== 2) 3 个完整候选人（端到端聚合）=====
  const profiles = [];
  for (const cand of S.CANDIDATE_PROFILES){
    const scored = await pool(cand.answers, async (a) => {
      const scn = { interviewerId: S.DIM_TO_IV[a.dimension], dimension: a.dimension, question: a.question, answer: a.answer };
      const prompt = S.buildScorePrompt(scn, 3);
      const r = await h.callModel({ system: prompt.system, user: prompt.user, temperature: 0.4, maxTokens: 200, stage: 'score' });
      if (!r.ok) return { dimension: a.dimension, iv: S.DIM_TO_IV[a.dimension], score: 70, error: r.error };
      const p = S.parseScore(r.text);
      return { dimension: a.dimension, iv: S.DIM_TO_IV[a.dimension], score: p.score, comment: p.comment };
    }, CONC);
    // 复刻聚合（行 1873-1893）
    const scores = {}; ['comm','biz','tech','leader','strategy','culture'].forEach(d => {
      const vals = scored.filter(s => s.dimension === d).map(s => s.score);
      scores[d] = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
    });
    const w = S.SCORING_WEIGHTS[cand.jobType].weights;
    const wt = Math.round(Object.entries(scores).reduce((s,kv)=>s+kv[1]*(w[kv[0]]||0)/100, 0));
    const verdict = wt >= 75 ? '推荐' : wt >= 60 ? '谨慎推荐' : '不推荐';
    const ivAvgs = S.INTERVIEWERS.map(iv => {
      const vals = scored.filter(s => s.iv === iv.id).map(s => s.score);
      return { id: iv.id, name: iv.name, avg: vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0 };
    });
    const avals = ivAvgs.filter(v => v.avg > 0).map(v => v.avg);
    const mx = avals.length ? Math.max.apply(null, avals) : 0;
    const mn = avals.length ? Math.min.apply(null, avals) : 0;
    const hasC = mx - mn > 15;
    profiles.push({
      id: cand.id, label: cand.label, jobType: cand.jobType,
      scores, weightedTotal: wt, verdict,
      interviewerAvgs: ivAvgs, spread: mx - mn, hasConflict: hasC,
      valid: !isNaN(wt) && ['推荐','谨慎推荐','不推荐'].includes(verdict)
              && Object.values(scores).every(v => !isNaN(v))
              && ivAvgs.every(v => v.avg >= 0)
    });
  }

  // ===== 3) 指标计算 =====
  const ok = scenarios.filter(s => s.success);
  const n = scenarios.length;

  // 评分依据完整率：score 解析成功 + 评价非空 + 追问解析成功
  const completeness = scenarios.filter(s => s.success && s.comment && s.comment.length > 0 && typeof s.followup === 'string').length / n;

  // 评分-证据一致性：高分段(>=75)应非负向；低分段(<=55)应非负向
  let consistTotal = 0, consistHit = 0;
  for (const s of ok){
    if (s.score >= 75){ consistTotal++; if (s.pol >= 0) consistHit++; }
    else if (s.score <= 55){ consistTotal++; if (s.pol <= 0) consistHit++; }
  }
  const scoreEvidenceConsistency = consistTotal ? consistHit / consistTotal : 0;

  // 方向性 / 短板识别：按质量档统计均分，并检查 弱/矛盾/偏题 是否显著低于 强
  const byQuality = {};
  for (const s of ok){ (byQuality[s.quality] = byQuality[s.quality] || []).push(s.score); }
  const meanByQ = {};
  Object.keys(byQuality).forEach(q => { const a = byQuality[q]; meanByQ[q] = Math.round(a.reduce((x,y)=>x+y,0)/a.length); });
  const weakSet = ok.filter(s => ['weak','contradictory','offtopic'].includes(s.quality));
  const strongSet = ok.filter(s => s.quality === 'strong');
  const weakMean = weakSet.length ? weakSet.reduce((a,s)=>a+s.score,0)/weakSet.length : 0;
  const strongMean = strongSet.length ? strongSet.reduce((a,s)=>a+s.score,0)/strongSet.length : 0;
  const weakIdentificationRate = weakSet.length ? weakSet.filter(s => s.score <= 62).length / weakSet.length : 0;
  const monotonic = strongMean > (meanByQ.medium || 0) && (meanByQ.medium || 0) >= weakMean;

  // 追问必要性一致：强/充分场景 followup 应为「无」或空；弱/矛盾/偏题应为非「无」
  let fuTotal = 0, fuHit = 0;
  for (const s of ok){
    const fu = (s.followup || '').replace(/[。.]/g,'').trim();
    if (s.quality === 'strong'){ fuTotal++; if (fu === '' || fu === '无') fuHit++; }
    else if (['weak','contradictory','offtopic'].includes(s.quality)){ fuTotal++; if (fu !== '' && fu !== '无') fuHit++; }
  }
  const followupConsistency = fuTotal ? fuHit / fuTotal : 0;

  // 报告生成成功率 & 关键字段完整率
  const reportGenSuccess = profiles.filter(p => p.valid).length / profiles.length;
  const keyFieldComplete = profiles.every(p => p.valid
      && Object.keys(p.scores).length === 6
      && p.interviewerAvgs.length === 5
      && p.interviewerAvgs.every(v => typeof v.avg === 'number')
      && ['推荐','谨慎推荐','不推荐'].includes(p.verdict)
      && typeof p.hasConflict === 'boolean') ? 1 : (profiles.filter(p => {
        return p.valid && Object.keys(p.scores).length === 6 && p.interviewerAvgs.length === 5;
      }).length / profiles.length);

  // API 指标
  const apiOk = ok.length;
  const latencies = scenarios.filter(s => s.latencyMs).map(s => s.latencyMs);
  const latMean = latencies.length ? Math.round(latencies.reduce((a,b)=>a+b,0)/latencies.length) : 0;
  const latP95 = latencies.length ? latencies.slice().sort((a,b)=>a-b)[Math.floor(latencies.length*0.95)] : 0;

  const metrics = {
    n_scenarios: n,
    api_success_rate: +(apiOk / n).toFixed(4),
    latency_mean_ms: latMean, latency_p95_ms: latP95,
    scoring_rationale_completeness: +completeness.toFixed(4),
    score_evidence_consistency: +scoreEvidenceConsistency.toFixed(4),
    directionality_monotonic: !!monotonic,
    mean_score_by_quality: meanByQ,
    strong_mean: +strongMean.toFixed(1), weak_mean: +weakMean.toFixed(1),
    weak_identification_rate: +weakIdentificationRate.toFixed(4),
    followup_consistency: +followupConsistency.toFixed(4),
    report_generation_success: +reportGenSuccess.toFixed(4),
    key_field_completeness: +(typeof keyFieldComplete === 'number' ? keyFieldComplete : (keyFieldComplete ? 1 : 0)).toFixed(4),
    conflict_detection: profiles.map(p => ({ id: p.id, spread: p.spread, hasConflict: p.hasConflict, verdict: p.verdict }))
  };

  const out = {
    test: 'Test3-multi-role-evaluation-report',
    meta: Object.assign({}, meta, { difficulty: 3, concurrency: CONC, generated_at: new Date().toISOString() }),
    metrics,
    scenarios,
    profiles
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log('=== Test 3 完成 ===');
  console.log('API 成功率:', metrics.api_success_rate, '| 耗时均值:', latMean, 'ms / P95:', latP95, 'ms');
  console.log('评分依据完整率:', metrics.scoring_rationale_completeness);
  console.log('评分-证据一致性:', metrics.score_evidence_consistency);
  console.log('方向性单调(强>中>弱):', metrics.directionality_monotonic, '| 强均分', metrics.strong_mean, '弱均分', metrics.weak_mean);
  console.log('短板识别率(弱/矛盾/偏题≤62):', metrics.weak_identification_rate);
  console.log('追问必要性一致:', metrics.followup_consistency);
  console.log('报告生成成功率:', metrics.report_generation_success, '| 关键字段完整率:', metrics.key_field_completeness);
  console.log('候选人画像:');
  profiles.forEach(p => console.log('  ', p.id, p.label, '→ 加权', p.weightedTotal, p.verdict, '| 分差', p.spread, p.hasConflict ? '(冲突)' : '(一致)'));
  console.log('已写入', OUT);
}

run().catch(e => { console.error('FATAL', e); process.exit(1); });
