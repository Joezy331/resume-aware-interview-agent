/* =====================================================================
 * run_match.js — Test 1：简历岗位匹配效果（离线，确定性引擎）
 * 直接复用产品的 job-matching.js，无任何 API 调用、无任何硬编码结果。
 * 合理率由 synthetic_resumes.js 中评估者设定的 referenceFamily 判定。
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { requireJobMatching } = require('./harness');
const { RESUMES } = require('./synthetic_resumes');

const JobMatching = requireJobMatching();
const OUT_DIR = path.join(__dirname, 'out');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function round(x, d) { const p = Math.pow(10, d || 0); return Math.round(x * p) / p; }

const COMPLETE_FAMILIES = ['software', 'ai_data', 'product_pm', 'design', 'biz_ops', 'finance_admin', 'education', 'engineering_mfg', 'medical_bio', 'legal', 'logistics_supply'];

// 各家族「硬性资格受限岗位」标题，用于资格识别判定
const FAMILY_CERT_TITLES = {
  medical_bio: ['药师', '临床医师/医技', '医学支持/CRA'],
  legal: ['法务专员', '律师助理']
};
const EXPECTED_INCOMPLETE_IDS = ['R31_incomplete', 'R32_generic'];

const perResume = [];
const allScores = [];
const top1Families = [];
const top3FamiliesAll = [];
const top1Industries = [];

let top1Reasonable = 0, top3Reasonable = 0, completeCount = 0;
let aiPmUnwarrantedTop1 = 0, aiPmUnwarrantedTop3 = 0, nonPmCount = 0;
const insufficientFlaggedIds = [];
const certCases = []; // {id, family, hasHardCert, certJob, flagged, expectedFlag, correct}
const missedTop1 = []; // 完整样本中 Top1 未命中参考族

RESUMES.forEach(r => {
  const res = JobMatching.recommendJobs(r.text, { rawText: r.text }, { topN: 5 });
  const jobs = (res.jobs || []).map(j => ({
    job_title: j.job_title, family_id: j.family_id, industry: j.industry,
    match_score: j.match_score, evidence_coverage: j.evidence_coverage,
    band: j.band, not_recommended: !!(j.not_recommended),
    deductions: (j._debug && j._debug.deductions) ? j._debug.deductions : []
  }));
  jobs.forEach(j => { allScores.push(j.match_score); });
  const top1 = jobs[0];
  const top3 = jobs.slice(0, 3);
  const top1Fam = top1 ? top1.family_id : null;
  const top3Fams = top3.map(j => j.family_id);
  if (top1Fam) top1Families.push(top1Fam);
  top3Fams.forEach(f => top3FamiliesAll.push(f));
  if (top1 && top1.industry) top1Industries.push(top1.industry);

  const isComplete = COMPLETE_FAMILIES.indexOf(r.family) >= 0;
  let top1r = false, top3r = false;
  if (isComplete) {
    completeCount++;
    top1r = (top1Fam === r.family);
    top3r = (top3Fams.indexOf(r.family) >= 0);
    if (top1r) top1Reasonable++;
    if (top3r) top3Reasonable++;
  }
  // AI 产品经理无依据推荐：参考族非 product_pm，但推荐命中 product_pm
  if (r.family !== 'product_pm' && r.family !== 'incomplete' && r.family !== 'generic') {
    nonPmCount++;
    if (top1Fam === 'product_pm') aiPmUnwarrantedTop1++;
    if (top3Fams.indexOf('product_pm') >= 0) aiPmUnwarrantedTop3++;
  }
  // 信息不足识别（记录被标记的样本 id，用于后续统计识别率/误报率）
  if (res.insufficient || res.all_weak) insufficientFlaggedIds.push(r.id);

  // 资格识别（仅对显式标注 certTest 的用例做定向检查，针对该族特定受限岗位）
  if (r.certTest) {
    const certTitles = FAMILY_CERT_TITLES[r.family] || [];
    const target = jobs.find(j => certTitles.some(t => j.job_title.indexOf(t) >= 0));
    const flagged = target ? target.not_recommended : false;
    const expectedFlag = (r.certTest === 'missing'); // 缺失资格→期望被限制；持有资格→期望不被限制
    const correct = (target ? (flagged === expectedFlag) : (r.certTest === 'missing' ? false : true));
    certCases.push({ id: r.id, family: r.family, certTest: r.certTest, certJob: target ? target.job_title : null, flagged, expectedFlag, correct });
  }

  perResume.push({
    id: r.id, label: r.id, referenceFamily: r.family, referenceTitles: r.referenceTitles,
    isComplete,
    top1: top1 ? { job_title: top1.job_title, family_id: top1Fam, match_score: top1.match_score } : null,
    top3: top3.map(j => ({ job_title: j.job_title, family_id: j.family_id, match_score: j.match_score })),
    top1Reasonable: isComplete ? top1r : null,
    top3Reasonable: isComplete ? top3r : null,
    engineInsufficient: !!(res.insufficient),
    engineAllWeak: !!(res.all_weak),
    evidenceCoverageTop1: top1 ? top1.evidence_coverage : null,
    notice: res.notice || '',
    jobs
  });
});

// ---- 汇总指标 ----
const metrics = {
  sample_total: RESUMES.length,
  complete_count: completeCount,
  top1_reasonable_rate: completeCount ? round(top1Reasonable / completeCount * 100, 1) : null,
  top3_reasonable_rate: completeCount ? round(top3Reasonable / completeCount * 100, 1) : null,
  top1_reasonable_n: top1Reasonable,
  top3_reasonable_n: top3Reasonable,
  industry_coverage: new Set(top1Industries).size,
  family_diversity_top1: new Set(top1Families).size,
  family_diversity_all: new Set(top3FamiliesAll).size,
  mean_evidence_coverage_top1: round(mean(perResume.map(p => p.evidenceCoverageTop1).filter(v => v != null)) * 100, 1),
  score_mean: round(mean(allScores), 1),
  score_median: round(median(allScores), 1),
  score_max: Math.max.apply(null, allScores),
  score_min: Math.min.apply(null, allScores),
  ratio_90plus: round(allScores.filter(s => s >= 90).length / allScores.length * 100, 1),
  count_90plus: allScores.filter(s => s >= 90).length,
  total_jobs: allScores.length,
  insufficient_expected: EXPECTED_INCOMPLETE_IDS.length,
  insufficient_flagged: insufficientFlaggedIds.length,
  insufficient_detected_expected: EXPECTED_INCOMPLETE_IDS.filter(id => insufficientFlaggedIds.indexOf(id) >= 0).length,
  insufficient_detection_rate: round(EXPECTED_INCOMPLETE_IDS.filter(id => insufficientFlaggedIds.indexOf(id) >= 0).length / EXPECTED_INCOMPLETE_IDS.length * 100, 1),
  insufficient_false_positive: insufficientFlaggedIds.filter(id => EXPECTED_INCOMPLETE_IDS.indexOf(id) < 0).length,
  insufficient_false_positive_rate: round(insufficientFlaggedIds.filter(id => EXPECTED_INCOMPLETE_IDS.indexOf(id) < 0).length / completeCount * 100, 1),
  ai_pm_unwarranted_top1_n: aiPmUnwarrantedTop1,
  ai_pm_unwarranted_top1_rate: nonPmCount ? round(aiPmUnwarrantedTop1 / nonPmCount * 100, 1) : null,
  ai_pm_unwarranted_top3_n: aiPmUnwarrantedTop3,
  ai_pm_unwarranted_top3_rate: nonPmCount ? round(aiPmUnwarrantedTop3 / nonPmCount * 100, 1) : null,
  non_pm_count: nonPmCount,
  cert_cases_total: certCases.length,
  cert_cases_correct: certCases.filter(c => c.correct).length,
  cert_detection_rate: certCases.length ? round(certCases.filter(c => c.correct).length / certCases.length * 100, 1) : null,
  cert_missing_detected_n: certCases.filter(c => c.certTest === 'missing' && c.correct).length,
  cert_missing_total: certCases.filter(c => c.certTest === 'missing').length,
  cert_present_not_flagged_n: certCases.filter(c => c.certTest === 'present' && c.correct).length,
  cert_present_total: certCases.filter(c => c.certTest === 'present').length,
  cert_detection_cases: certCases,
  missed_top1: missedTop1
};

const out = { test: 'match', metrics, perResume };
fs.writeFileSync(path.join(OUT_DIR, 'match.json'), JSON.stringify(out, null, 2), 'utf8');

// 控制台摘要
console.log('===== Test 1 岗位匹配评测（离线）=====');
console.log('样本数:', RESUMES.length, '| 完整职业样本:', completeCount);
console.log('Top1 合理率:', metrics.top1_reasonable_rate + '% (' + top1Reasonable + '/' + completeCount + ')');
console.log('Top3 合理率:', metrics.top3_reasonable_rate + '% (' + top3Reasonable + '/' + completeCount + ')');
console.log('行业覆盖:', metrics.industry_coverage, '| Top1 族多样性:', metrics.family_diversity_top1, '| 全部推荐族多样性:', metrics.family_diversity_all);
console.log('证据覆盖率均值(Top1):', metrics.mean_evidence_coverage_top1 + '%');
console.log('分数 均值:', metrics.score_mean, '中位数:', metrics.score_median, '最高:', metrics.score_max, '最低:', metrics.score_min);
console.log('90+ 比例:', metrics.ratio_90plus + '% (' + metrics.count_90plus + '/' + metrics.total_jobs + ')');
console.log('信息不足识别率:', metrics.insufficient_detection_rate + '% (' + metrics.insufficient_detected_expected + '/' + metrics.insufficient_expected + ' 期望样本被识别) | 误报:', metrics.insufficient_false_positive + ' 份 (' + metrics.insufficient_false_positive_rate + '% of 完整样本)');
console.log('资格识别正确率:', metrics.cert_detection_rate + '% (' + metrics.cert_cases_correct + '/' + metrics.cert_cases_total + ') | 缺失资格被识别 ' + metrics.cert_missing_detected_n + '/' + metrics.cert_missing_total + ' | 持有资格未被误标 ' + metrics.cert_present_not_flagged_n + '/' + metrics.cert_present_total);
console.log('AI产品经理无依据推荐: Top1=' + aiPmUnwarrantedTop1 + '/' + nonPmCount + ' (' + metrics.ai_pm_unwarranted_top1_rate + '%)' + ' | Top3=' + aiPmUnwarrantedTop3 + '/' + nonPmCount + ' (' + metrics.ai_pm_unwarranted_top3_rate + '%)');
console.log('Top1 未命中样本:', JSON.stringify(missedTop1));
console.log('资格识别用例:', JSON.stringify(certCases));
console.log('已写入', path.join(OUT_DIR, 'match.json'));
