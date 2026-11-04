/* ============================================================
 * tests/jd_module.test.js — JD 智能分析模块纯 Node 单测
 * 覆盖：job-library（行业/岗位覆盖、推荐、扩展）、jd-core
 * （Prompt 构造、归一化、六维权重、本地兜底匹配、数据模型/历史）。
 * 运行：env -u NODE_OPTIONS node tests/jd_module.test.js
 * ============================================================ */
'use strict';
const JL = require('../job-library.js');
const JC = require('../jd-core.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + ' :: ' + JSON.stringify(detail !== undefined ? detail : '')); }
}
console.log('--- job-library ---');

/* 1. 12 行业全覆盖 */
ok('行业数 ≥ 12', JL.INDUSTRIES.length >= 12, JL.INDUSTRIES.length);
const REQ_IND = ['互联网与软件服务','人工智能与大模型','金融与银行','电商与零售','市场营销与广告传媒','教育与在线教育','医疗健康与生物医药','制造业与工业自动化','新能源与汽车','游戏与数字娱乐','人力资源与企业服务','物流与供应链'];
ok('需求指定的 12 行业全部存在', REQ_IND.every(n => JL.INDUSTRIES.some(i => i.name === n)), REQ_IND.filter(n => !JL.INDUSTRIES.some(i => i.name === n)));

/* 2. ≥12 个测试岗位方向覆盖 */
const REQ_JOBS = ['AI 产品经理','产品经理','数据分析师','前端开发工程师','后端开发工程师','UI 设计师','UX 设计师','市场营销','产品运营','金融分析师','人力资源专员','机械工程师','销售顾问'];
ok('需求指定的测试岗位全部在库（≥12 方向）', REQ_JOBS.every(t => !!JL.getJob(t)), REQ_JOBS.filter(t => !JL.getJob(t)));
ok('岗位总数 ≥ 45（可扩展库）', JL.JOBS.length >= 45, JL.JOBS.length);
ok('每个岗位都有能力标签与关键词', JL.JOBS.every(j => j.tags && j.tags.length >= 3 && j.kw && j.kw.length >= 3), null);

/* 3. 推荐：AI 简历 → 应给 AI/产品方向，主推荐+拓展区分 */
const aiResume = '教育背景：某某大学 信息管理与信息系统 本科。实习：XX 科技 AI 产品部 产品实习生，负责 AI 产品需求分析与竞品调研，参与大模型应用场景设计与 Prompt 优化。项目：基于大模型的智能问答机器人，使用 RAG 与 Agent 工作流，完成效果评估。技能：AI 产品设计、Prompt 设计、SQL、Python、Figma、用户调研、数据分析。';
const r1 = JL.recommend(aiResume, { skills: ['AI/LLM','产品管理','数据分析'], projects: [{ name: '大模型问答机器人', desc: 'RAG Agent Prompt' }] }, { topN: 5 });
ok('推荐返回 3-5 个岗位', r1.jobs.length >= 3 && r1.jobs.length <= 5, r1.jobs.length);
ok('存在主推荐岗位', r1.primaryCount >= 1, r1.primaryCount);
ok('主推荐与拓展岗位均有标注', r1.jobs.every(j => j.recommend_type === '主推荐' || j.recommend_type === '拓展岗位'), null);
ok('AI 简历的 Top3 中含 AI/产品方向岗位', r1.jobs.slice(0,3).some(j => /AI|产品|大模型/.test(j.job_title)), r1.jobs.slice(0,3).map(j=>j.job_title));
ok('推荐卡片含优势与差距字段', r1.jobs.every(j => Array.isArray(j.advantages) && Array.isArray(j.gaps)), null);

/* 4. 跨行业多样性：前端简历不推荐金融岗为第一 */
const feResume = '项目：React Vue 组件库开发，Webpack 工程化，接口联调，性能优化。技能：JavaScript TypeScript React Vue HTML CSS Node。实习：前端开发实习生。';
const r2 = JL.recommend(feResume, { skills: ['软件开发'], projects: [{ name: '组件库', desc: 'React Vue' }] }, { topN: 5 });
ok('前端简历 Top1 是技术族岗位', r2.jobs[0].family === 'tech', r2.jobs[0]);

/* 5. 扩展接口 */
ok('register 注册新岗位生效', JL.register({ title: '测试岗位XYZ', industry: 'gaming', family: 'product', tags: ['a','b','c'], kw: ['x'] }) && !!JL.getJob('测试岗位XYZ'), null);
ok('重复注册被拒绝', JL.register({ title: '测试岗位XYZ' }) === false, null);

console.log('--- jd-core ---');

/* 6. Prompt 构造 */
const gen = JC.buildJDGenMessages({ jobTitle: 'AI 产品经理', industry: '人工智能与大模型', level: '实习生', resumeText: '简历原文', resumeStruct: { education: '本科', skills: ['a'], projects: [{ name: 'p', desc: 'd' }] } });
ok('JD 生成消息含 system+user', gen.length === 2 && gen[0].role === 'system' && gen[1].role === 'user', null);
ok('System Prompt 含职级区分要求', /实习生：[\s\S]*应届生：[\s\S]*初级岗位/.test(gen[0].content), null);
ok('System Prompt 含九段结构 A-I', /A\. 岗位基本信息[\s\S]*I\. 发展路径/.test(gen[0].content), null);
ok('System Prompt 含 JSON 输出格式', /generation_type.*industry_reference/.test(gen[0].content), null);
ok('System Prompt 禁止编造企业信息', /不得编造企业名称/.test(gen[0].content), null);
ok('User 消息带岗位与职级', gen[1].content.indexOf('AI 产品经理') >= 0 && gen[1].content.indexOf('实习生') >= 0, null);

const match = JC.buildMatchMessages({ jobTitle: '前端开发工程师', resumeText: '简历', jd: { job_title: '前端开发工程师' }, isTech: true });
ok('匹配 Prompt 含六维权重', ['专业技能匹配','核心岗位职责匹配','项目及实践经验','行业与业务理解','学历及专业背景','通用能力'].every(d => match[0].content.indexOf(d) >= 0), null);
ok('匹配 Prompt 含三分原则（已体现/未体现/待确认）', /已体现.*未体现.*待确认|区分/.test(match[0].content) && (match[0].content.indexOf('已体现')>=0 && match[0].content.indexOf('未体现')>=0 && match[0].content.indexOf('待确认')>=0), null);

/* 7. 六维权重：默认 25/25/20/15/10/5，技术岗调权 */
const wDefault = JC.weightsFor('产品经理');
ok('默认权重 = 25/25/20/15/10/5', wDefault.map(w=>w.weight).join('/') === '25/25/20/15/10/5', wDefault.map(w=>w.weight).join('/'));
const wTech = JC.weightsFor('前端开发工程师');
ok('技术岗提高技术技能权重', wTech[0].name === '专业技能匹配' && wTech[0].weight > 25, wTech);
ok('技术岗权重总和 = 100', wTech.reduce((s,w)=>s+w.weight,0) === 100, wTech.reduce((s,w)=>s+w.weight,0));

/* 8. 归一化容错：字符串/对象混合、缺字段 */
const norm = JC.normalizeGeneratedJD({
  job_title: '数据分析师', job_level: '中级', job_summary: '负责业务数据分析与决策支持，输出分析报告。',
  responsibilities: [{ task: 'a', action: 'b', outcome: 'c' }, '裸字符串职责'],
  professional_skills: ['裸技能', { category: '数据分析能力', skill: 'SQL', level: '必须掌握' }],
  required_qualifications: ['q1'], preferred_qualifications: [null, 'p1'], kpi_indicators: [{ name: 'k1' }, 'k2str'],
  work_scenarios: ['s1'], career_path: ['c1'], confidence_notes: ['n1'],
  experience_requirements: ['1-3 年数据分析相关经验（行业参考）']
});
ok('归一化：职责对象与字符串混合处理', norm.responsibilities.length === 2 && norm.responsibilities[0].task === 'a' && norm.responsibilities[1].task === '裸字符串职责', norm.responsibilities);
ok('归一化：裸技能默认归类', norm.professional_skills.length === 2 && norm.professional_skills[0].category === '核心业务技能', norm.professional_skills[0]);
ok('归一化：KPI 字符串/对象混合', norm.kpi_indicators.length === 2 && norm.kpi_indicators[1].name === 'k2str', norm.kpi_indicators);
ok('归一化：generation_type 固定 industry_reference', norm.generation_type === 'industry_reference', norm.generation_type);
ok('归一化：null 输入返回 null', JC.normalizeGeneratedJD(null) === null, null);

/* 9. 匹配结果归一化 + overall 计算 */
const nm = JC.normalizeMatchResult({
  dimensions: [{ name: '专业技能匹配', score: 80 }, { name: '核心岗位职责匹配', weight: 25, score: 60 }],
  satisfied: ['s1'], partial: [{ item: 'p1', gap: 'g' }], missing: ['m1'], to_confirm: ['t1'],
  strengths: ['st'], gaps: ['gp'], resume_suggestions: ['r'], interview_suggestions: ['i'], learning_path: ['l']
}, wDefault);
ok('匹配归一化：维度补默认权重', nm.dimensions[0].weight === 25, nm.dimensions[0]);
ok('匹配归一化：overall 按权重计算', typeof nm.overall_match === 'number' && nm.overall_match > 0 && nm.overall_match <= 100, nm.overall_match);
ok('匹配归一化：对象/字符串数组兼容', nm.satisfied[0].item === 's1' && nm.partial[0].gap === 'g', null);

/* 10. 本地兜底匹配 */
const fb = JC.localMatchFallback(
  { job_title: '数据分析师', required_qualifications: ['SQL 能力', '沟通表达'], professional_skills: [{ skill: 'Python' }, { skill: 'Tableau' }] },
  '熟悉 SQL 与 Python 数据分析，本科计算机专业，做过报表与可视化项目', { skills: ['数据分析', 'SQL'], projects: [{ name: '报表' }] },
  wDefault
);
ok('兜底匹配：overall ∈ 0-100', fb.overall_match >= 0 && fb.overall_match <= 100, fb.overall_match);
ok('兜底匹配：SQL 判为已满足（有证据）', fb.satisfied.some(s => /SQL/.test(s.item)), fb.satisfied.map(s=>s.item));
ok('兜底匹配：未命中项判为未体现（非不具备）', fb.missing.every(m => /未体现/.test(m.note)), fb.missing);
ok('兜底匹配：输出六维', fb.dimensions.length === 6, fb.dimensions.length);

/* 11. 数据模型与历史（内存存储兜底） */
const rec = JC.newJDRecord({ sourceType: 'manual', jobTitle: '测试岗', rawText: 'JD原文', structured: { title: '测试岗' } });
ok('记录：manual 类型与字段完整', rec.source_type === 'manual' && rec.id && rec.createdAt && rec.updatedAt && rec.raw_text === 'JD原文', null);
ok('记录：industry_reference 类型默认', JC.newJDRecord({}).source_type === 'industry_reference', null);
const sv = JC.saveJDRecord(rec);
ok('保存记录成功', sv.ok === true, sv);
ok('读取记录成功', JC.getJDRecord(rec.id) && JC.getJDRecord(rec.id).job_title === '测试岗', null);
rec.match = { overall_match: 77 };
JC.saveJDRecord(rec);
ok('更新记录不重复插入', JC.loadJDHistory().filter(r => r.id === rec.id).length === 1, JC.loadJDHistory().length);
ok('匹配分回写', JC.getJDRecord(rec.id).match_score === 77, null);
ok('删除记录成功', JC.deleteJDRecord(rec.id).ok && !JC.getJDRecord(rec.id), null);

/* 12. jdToText / manualJDToText */
const full = JC.jdToText(norm);
ok('jdToText 含全部九段关键节', ['岗位概述','核心岗位职责','必备条件','优先条件','专业技能要求','工作经验要求','KPI','典型工作场景','发展路径'].every(k => full.indexOf(k) >= 0), null);
const man = JC.manualJDToText({ title: 'X', resp: ['r1'], hard: ['h1'], soft: ['s1'], tools: ['t1'], edu: '本科', focus: 'f' });
ok('manualJDToText 保留解析分区', ['岗位职责','硬技能','软技能','工具','学历','面试重点'].every(k => man.indexOf(k) >= 0), null);

/* 13. sourceLabel 与 LEVELS */
ok('LEVELS 五级完整', JC.LEVELS.join(',') === '实习生,应届生,初级,中级,高级', JC.LEVELS);
ok('sourceLabel', JC.sourceLabel('manual') === '手动输入' && JC.sourceLabel('industry_reference') === '行业标准', null);

console.log('---');
console.log('JD_MODULE_TEST_PASSED=' + pass + ' FAILED=' + fail);
process.exit(fail ? 1 : 0);
