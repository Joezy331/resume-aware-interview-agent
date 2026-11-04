/* ============================================================
 * tools/jd_gen_acceptance.js — 12 测试岗位真实模型生成验收（纯 Node）
 * 验收点（对应需求第八节）：
 *  - 不同岗位生成差异化 JD（行业关键词命中）
 *  - 不同职级生成职责/任职资格差异化（实习生 vs 高级）
 *  - JSON 输出结构完整（九段字段必备项）
 *  - 必备/优先条件区分、技能分级标注、无虚构企业招聘信息
 * 前置：本地 Cline 服务在线（http://localhost:8787/v1）。
 * 运行：env -u NODE_OPTIONS node tools/jd_gen_acceptance.js
 * ============================================================ */
'use strict';
const http = require('http');
const path = require('path');
const JL = require('../job-library.js');
const JC = require('../jd-core.js');
const cfg = require('../local_api_config.json');

const BASE = (cfg.base_url || cfg.baseUrl || 'http://localhost:8787/v1').replace(/\/$/, '');
const MODEL = (cfg.available_models && cfg.available_models[0]) || cfg.model || 'auto';
const API_KEY = cfg.api_key || cfg.apiKey || '';

/* 12 个测试岗位（覆盖需求指定的方向），各配一个职级 */
const CASES = [
  { title: 'AI 产品经理', level: '实习生', industry: '人工智能与大模型', expectKw: [/Prompt|Agent|大模型|LLM|模型/, /场景|需求|产品/] },
  { title: '产品经理', level: '应届生', industry: '互联网与软件服务', expectKw: [/需求|PRD|原型/, /用户|迭代|版本/] },
  { title: '数据分析师', level: '初级', industry: '互联网与软件服务', expectKw: [/SQL|Python/, /指标|报表|可视化|分析/] },
  { title: '前端开发工程师', level: '中级', industry: '互联网与软件服务', expectKw: [/HTML|CSS|JavaScript|React|Vue/i, /性能|组件|工程化/] },
  { title: '后端开发工程师', level: '初级', industry: '互联网与软件服务', expectKw: [/接口|服务|数据库|MySQL|Redis/i, /高可用|稳定|架构/] },
  { title: 'UI 设计师', level: '应届生', industry: '互联网与软件服务', expectKw: [/视觉|界面|Figma|Sketch/i, /规范|交互|设计/] },
  { title: '市场营销', level: '实习生', industry: '市场营销与广告传媒', expectKw: [/市场|品牌|传播|渠道/, /活动|调研|内容/] },
  { title: '产品运营', level: '应届生', industry: '电商与零售', expectKw: [/用户|留存|转化|活跃/, /活动|数据|运营/] },
  { title: '金融分析师', level: '初级', industry: '金融与银行', expectKw: [/财务|估值|行业研究|模型/, /投资|报告|分析/] },
  { title: '人力资源专员', level: '实习生', industry: '人力资源与企业服务', expectKw: [/招聘|员工|培训/, /沟通|协调/] },
  { title: '机械工程师', level: '中级', industry: '制造业与工业自动化', expectKw: [/机械|结构|CAD|SolidWorks|图纸/i, /工艺|加工|量产/] },
  { title: '销售顾问', level: '应届生', industry: '电商与零售', expectKw: [/客户|销售|成交|转化/, /目标|沟通|维护/] }
];
/* 职级差异化对照：同岗位不同级别 */
const LEVEL_PAIR = { title: 'AI 产品经理', levels: ['实习生', '高级'], industry: '人工智能与大模型' };

function postChat(messages, maxTokens) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, messages, temperature: 0.6, max_tokens: maxTokens || 4096 });
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
    if (API_KEY) headers['Authorization'] = 'Bearer ' + API_KEY;   // 本地服务需要认证（无 Key 会 401）
    const req = http.request(BASE + '/chat/completions', {
      method: 'POST', headers, timeout: 180000
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode === 401 || res.statusCode === 403) return reject(new Error('认证失败（HTTP ' + res.statusCode + '）：请检查 local_api_config.json 的 api_key'));
        if (res.statusCode === 429 || res.statusCode === 502 || res.statusCode === 503) return reject(new Error('HTTP ' + res.statusCode));
        try {
          const j = JSON.parse(buf);
          const ch = (j.choices && j.choices[0]) || {};
          const content = (ch.message && ch.message.content) || '';
          if (!content) return reject(new Error('空返回（finish_reason=' + ch.finish_reason + '）'));
          if (ch.finish_reason === 'length') console.log('   [warn] 输出被截断(length)，改用更大 max_tokens 重试');
          resolve(content);
        } catch (e) { reject(new Error('bad response: ' + buf.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(body); req.end();
  });
}
/* 与 index.html extractJSON 同逻辑的容错解析 */
function extractJSON(s) {
  if (!s) return null;
  var t = String(s).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  var start = t.indexOf('{');
  if (start === -1) return null;
  var depth = 0, end = -1, inStr = false, esc = false;
  for (var i = start; i < t.length; i++) {
    var ch = t[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  try { var o = JSON.parse(t.slice(start, end + 1)); return (o && typeof o === 'object') ? o : null; }
  catch (e) { return null; }
}
async function genWithRetry(caseItem, maxRetry) {
  const messages = JC.buildJDGenMessages({
    jobTitle: caseItem.title, industry: caseItem.industry, level: caseItem.level,
    resumeText: '', resumeStruct: null
  });
  for (let i = 0; i <= maxRetry; i++) {
    try {
      const text = await postChat(messages, 4096);
      const jd = JC.normalizeGeneratedJD(extractJSON(text));
      if (jd && jd.job_title) return jd;
      throw new Error('JSON 解析失败');
    } catch (e) {
      if (i === maxRetry) throw e;
      await new Promise(r => setTimeout(r, 4000 * (i + 1)));
    }
  }
}

(async () => {
  console.log('BASE=' + BASE + ' MODEL=' + MODEL);
  // 探活
  try {
    await new Promise((resolve, reject) => {
      http.get(BASE + '/models', { timeout: 8000 }, r => { resolve(); r.resume(); }).on('error', reject);
    });
  } catch (e) {
    console.log('SERVICE_OFFLINE 无法连接本地模型服务（' + BASE + '）：' + e.message);
    console.log('ACCEPTANCE_SKIPPED 请启动 Cline 服务后重跑本脚本');
    process.exit(2);
  }

  const results = [];
  let pass = 0, fail = 0;
  function ok(name, cond, detail) {
    if (cond) { pass++; console.log('  ✅ ' + name); }
    else { fail++; console.log('  ❌ ' + name + ' :: ' + String(detail).slice(0, 220)); }
  }

  /* 支持 `node tools/jd_gen_acceptance.js levels`：只跑职级差异化对照（快速复验） */
  const LEVELS_ONLY = process.argv.indexOf('levels') >= 0;

  for (const c of (LEVELS_ONLY ? [] : CASES)) {
    process.stdout.write('GEN ' + c.title + ' · ' + c.level + ' ... ');
    try {
      const jd = await genWithRetry(c, 2);
      const blob = JSON.stringify(jd);
      const kwHit = c.expectKw.every(re => re.test(blob));
      const structOk = jd.job_title && jd.job_summary && jd.responsibilities.length >= 4
        && jd.required_qualifications.length >= 2 && jd.preferred_qualifications.length >= 1
        && jd.professional_skills.length >= 4 && jd.kpi_indicators.length >= 3
        && jd.work_scenarios.length >= 3 && jd.career_path.length >= 1;
      const levelOk = !jd.job_level || jd.job_level.indexOf(c.level) >= 0;
      const splitOk = jd.required_qualifications.length >= 2 && jd.preferred_qualifications.length >= 1;
      const skillGradeOk = jd.professional_skills.some(s => s.level);
      const noFakeCompany = !/(XX科技|某某科技|字节跳动|腾讯|阿里巴巴|阿里集团|美团|百度公司)\s*(公司|集团)?的?招聘/.test(blob)
        && !/\d+\s*(k|K|千|万)\s*[-–~至]\s*\d+\s*(k|K|千|万)/.test(blob);
      const refNoteOk = jd.confidence_notes.length >= 0; // 建议项
      results.push({ title: c.title, level: c.level, jd });
      ok(c.title + '（' + c.level + '）JSON 结构完整（九段必备字段）', !!structOk, JSON.stringify({ resp: jd.responsibilities.length, req: jd.required_qualifications.length, pref: jd.preferred_qualifications.length, kpi: jd.kpi_indicators.length }));
      ok(c.title + '（' + c.level + '）行业差异化（关键词命中）', kwHit, blob.slice(0, 150));
      ok(c.title + '（' + c.level + '）职级标注正确', levelOk, jd.job_level);
      ok(c.title + '（' + c.level + '）必备/优先条件区分', splitOk, null);
      ok(c.title + '（' + c.level + '）技能分级标注', skillGradeOk, null);
      ok(c.title + '（' + c.level + '）无虚构企业招聘信息', noFakeCompany, blob.slice(0, 100));
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      ok(c.title + '（' + c.level + '）生成', false, e.message);
    }
  }

  /* 职级差异化对照 */
  console.log('--- 职级差异化对照：' + LEVEL_PAIR.title + ' ---');
  try {
    const jd1 = await genWithRetry({ title: LEVEL_PAIR.title, level: LEVEL_PAIR.levels[0], industry: LEVEL_PAIR.industry }, 2);
    await new Promise(r => setTimeout(r, 1500));
    const jd2 = await genWithRetry({ title: LEVEL_PAIR.title, level: LEVEL_PAIR.levels[1], industry: LEVEL_PAIR.industry }, 2);
    const b1 = JSON.stringify(jd1), b2 = JSON.stringify(jd2);
    const internSignals = /指导|协助|学习|在.*带领下|支持|参与|基础/.test(b1);
    const seniorSignals = /策略|体系|管理|团队|负责|统筹|主导|战略/.test(b2);
    const different = b1 !== b2 && jd1.responsibilities.length > 0 && jd2.responsibilities.length > 0;
    ok('实习生 JD 含「在指导下/学习/参与」类要求', internSignals, b1.slice(0, 150));
    ok('高级 JD 含「策略/体系/管理/负责」类要求', seniorSignals, b2.slice(0, 150));
    ok('同岗位不同职级输出明显不同', different, null);
    /* 不把管理要求套到实习生：仅当出现「管理/带领/统筹 + 团队/部门」「N 人团队」「制定战略」
     * 「对业务结果负责」这类强管理信号时才算违规；「团队协作/项目管理/需求管理」属正常表述 */
    const internNoMgmt = !/(管理|带领|统筹|组建)\s*(一个|所属|整个)?\s*(团队|部门)|\d+\s*人(的)?团队|制定.{0,8}(业务)?(战略|策略体系)|对.{0,10}(业务|营收|业绩)结果负责/.test(b1);
    ok('实习生 JD 未套用高级管理要求', internNoMgmt, null);
  } catch (e) {
    ok('职级差异化对照', false, e.message);
  }

  fs_out(results);
  console.log('---');
  console.log('ACCEPTANCE_PASSED=' + pass + ' FAILED=' + fail);
  process.exit(fail ? 1 : 0);

  function fs_out(results) {
    try {
      require('fs').writeFileSync(
        path.join(__dirname, '..', '_preview', 'jd_acceptance_results.json'),
        JSON.stringify(results.map(r => ({ title: r.title, level: r.level, jd: r.jd })), null, 2), 'utf-8');
      console.log('RESULTS_SAVED _preview/jd_acceptance_results.json');
    } catch (e) { console.log('save fail ' + e.message); }
  }
})();
