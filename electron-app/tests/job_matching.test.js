/* =====================================================================
 * 跨行业岗位推荐回归测试（本地确定性评分，不依赖外部模型）
 * 运行： node tests/job_matching.test.js
 *
 * 目的：验证
 *  - 不同行业简历 → 不同候选岗位（不再一律 AI 产品经理）
 *  - 非互联网简历 → 推荐与专业能力相关的岗位
 *  - 信息不足 → 降低置信度、压低分数（不再强行高分）
 *  - 缺少硬性资格 → 合理扣分
 * ===================================================================== */
const JM = require('../job-matching.js');

/* ---------- 10 类合成简历 ---------- */
const CASES = [
  {
    id: 'mechanical', name: '机械工程 / CAD / 机械制图',
    expectFamily: 'engineering_mfg',
    resume: `教育背景
本科 机械设计制造及其自动化 华中科技大学

工作经历
2021-2024 某重工集团 机械设计工程师
负责非标设备结构设计，使用 SolidWorks 完成三维建模与工程图出图
参与产线设备改造，完成工装夹具设计并跟踪现场试制与装配调试

项目经历
自动化装配线设备设计：主导输送线与装配工位机械结构设计，输出 CAD 图纸 120 余张，设备节拍提升 25%

专业技能
SolidWorks AutoCAD 机械制图 有限元分析 ANSYS 公差配合 气动 液压 材料选型`
  },
  {
    id: 'finance', name: '会计 / 财务 / 审计',
    expectFamily: 'finance_admin',
    resume: `教育背景
本科 会计学 上海财经大学

工作经历
2020-2024 某会计师事务所 审计员
负责年报审计底稿编制，执行实质性程序与函证程序
参与制造业客户成本核算与内控测试，编制财务报表

项目经历
某上市公司年审：完成收入与存货循环审计，发现并调整差错金额 300 万元

专业技能
审计 财务报表 记账 凭证 Excel 用友 金蝶 税务申报 成本核算 财务分析

证书
注册会计师 CPA 已通过 中级会计职称`
  },
  {
    id: 'education', name: '教育 / 教学实践',
    expectFamily: 'education',
    resume: `教育背景
硕士 学科教学（数学） 北京师范大学

工作经历
2022-2024 某中学 数学教师
负责高一数学授课与备课，承担两个班级教学工作
批改作业并进行课后辅导，所带班级平均分提升 12 分

项目经历
校本课程设计：参与教研并编写教案 40 余篇，开发配套课件

专业技能
教学 备课 授课 课堂管理 教研 教案 课程设计 普通话 辅导

证书
教师资格证`
  },
  {
    id: 'design', name: '视觉设计 / 作品集',
    expectFamily: 'design',
    resume: `教育背景
本科 视觉传达设计 中国美术学院

工作经历
2021-2024 某品牌设计公司 视觉设计师
负责品牌视觉物料设计，输出海报与包装方案
参与电商页面视觉规范制定与改稿

项目经历
某新消费品牌全案视觉：完成 Logo 与包装设计，整理作品集，方案采纳率提升 30%

专业技能
Photoshop Illustrator InDesign Figma 版式 配色 品牌 包装 手绘 渲染`
  },
  {
    id: 'software', name: '软件开发 / 编程项目',
    expectFamily: 'software',
    resume: `教育背景
本科 计算机科学与技术 电子科技大学

工作经历
2021-2024 某互联网公司 后端开发工程师
负责订单服务模块开发，使用 Java 与 Spring 实现接口
参与系统重构与性能优化，接口响应时间降低 40%

项目经历
分布式订单系统：实现微服务拆分与 Redis 缓存，QPS 提升 3 倍

专业技能
Java Python Spring MySQL Redis Docker Git 微服务 数据结构 算法 Linux`
  },
  {
    id: 'ai_data', name: 'AI 与数据',
    expectFamily: 'ai_data',
    resume: `教育背景
硕士 计算机科学与技术（人工智能方向）

工作经历
2022-2024 某科技公司 数据分析师
负责用户行为数据分析，搭建指标看板
构建流失预测模型，AUC 达到 0.85

项目经历
推荐系统特征工程：使用 Python 与 Spark 完成特征开发，CTR 提升 18%

专业技能
Python SQL 机器学习 深度学习 PyTorch 特征工程 数据挖掘 统计 Tableau BI`
  },
  {
    id: 'marketing', name: '市场营销 / 品牌 / 销售',
    expectFamily: 'biz_ops',
    resume: `教育背景
本科 市场营销

工作经历
2021-2024 某快消公司 市场专员
负责新品上市推广策划，撰写文案并投放小红书与抖音
维护客户与渠道关系，季度获客增长 30%

项目经历
夏季促销活动：策划并执行 campaign，销售额提升 22%

专业技能
市场营销 品牌 策划 文案 推广 社群 活动 转化 客户 CRM 渠道 SEO`
  },
  {
    id: 'hr', name: '人力资源 / 招聘 / 行政',
    expectFamily: 'finance_admin',
    resume: `教育背景
本科 人力资源管理

工作经历
2020-2024 某公司 人力资源专员
负责招聘与入离职办理，月度招聘完成率 90%
组织员工培训，管理社保与薪酬核算

项目经历
校招专项：统筹 3 所高校宣讲，录用人数同比提升 35%

专业技能
招聘 绩效 薪酬 培训 社保 劳动合同 Excel 行政 档案`
  },
  {
    id: 'medical', name: '医疗 / 药学 / 实验室',
    expectFamily: 'medical_bio',
    resume: `教育背景
本科 药学

工作经历
2021-2024 某医院药房 药师
负责处方审核与调配，参与临床用药指导
完成药品养护与 GSP 台账管理

项目经历
合理用药点评：抽查处方 800 张，干预不合理处方 60 余例

专业技能
药理 药剂 处方 配药 药物 GSP 临床 检验

证书
执业药师`
  },
  {
    id: 'insufficient', name: '信息不足 / 方向不明',
    expectFamily: null,
    resume: `张三
电话 13800000000
邮箱 zhangsan@example.com`
  }
];

/* ---------- 断言 ---------- */
let pass = 0, fail = 0;
const failures = [];
const topTitles = [];

function check(cond, msg) {
  if (cond) { pass++; }
  else { fail++; failures.push(msg); }
}

console.log('='.repeat(96));
console.log('跨行业岗位推荐回归测试（本地证据评分，无外部模型）');
console.log('='.repeat(96));

const results = CASES.map(c => {
  // 统一使用本地确定性引擎（useAI 默认 false），保证可重复
  const r = JM.recommendJobs(c.resume, null, { topN: 5 });
  const top = r.jobs[0];
  topTitles.push(top ? top.job_title : '(无)');
  return { c, r, top };
});

results.forEach(({ c, r, top }) => {
  console.log('\n── [' + c.id + '] ' + c.name);
  console.log('   简历信息完整度: ' + Math.round(r.debug.evidence.completeness * 100) + '%' +
              ' | 信息不足: ' + (r.insufficient ? '是' : '否'));
  if (r.notice) console.log('   ⚠️  ' + r.notice);
  console.log('   候选岗位:');
  r.jobs.forEach((j, i) => {
    console.log('     ' + (i + 1) + '. ' + pad(j.job_title, 16) +
                ' | ' + pad(j.industry, 12) +
                ' | 分 ' + pad(String(j.match_score), 4) +
                ' | ' + j.band +
                ' | 置信 ' + j.confidence +
                ' | 覆盖 ' + j.evidence_coverage);
  });
  if (top) {
    console.log('   → TOP: ' + top.job_title + ' / ' + top.industry +
                ' | 依据: ' + (top.match_reasons[0] || '-'));
  }

  /* --- 逐项断言 --- */
  if (c.expectFamily) {
    const famOk = r.jobs.some(j => j.family_id === c.expectFamily);
    check(famOk, `[${c.id}] 候选中应包含行业族 ${c.expectFamily}`);
    const topOk = top && top.family_id === c.expectFamily;
    check(!!topOk, `[${c.id}] 首选岗位应属于 ${c.expectFamily}，实际 ${top && top.family_id}(${top && top.job_title})`);
  }

  // 非互联网类简历，不得把「产品经理/项目管理/项目助理」排在首位
  const nonInternet = ['mechanical', 'finance', 'education', 'design', 'marketing', 'hr', 'medical'];
  if (nonInternet.indexOf(c.id) !== -1) {
    const isPM = top && (top.job_title.indexOf('产品经理') !== -1 ||
                         top.job_title.indexOf('项目管理') !== -1 ||
                         top.job_title.indexOf('项目助理') !== -1);
    check(!isPM, `[${c.id}] 不应把产品经理类岗位排在第一位，实际 ${top && top.job_title}`);
  }

  // 明确禁止：任何简历都不得出现"AI 产品经理"作为首选（除非有 AI+产品 双重证据）
  check(!(top && top.job_title === 'AI 产品经理'), `[${c.id}] 首选不得为 AI 产品经理`);

  // 信息不足：必须降置信度且分数受限
  if (c.id === 'insufficient') {
    check(r.insufficient === true, `[${c.id}] 应判定为信息不足`);
    const allLow = r.jobs.every(j => j.confidence === 'low');
    check(allLow, `[${c.id}] 所有岗位置信度应为 low`);
    const capped = r.jobs.every(j => j.match_score <= 60);
    check(capped, `[${c.id}] 信息不足时分数应 <=60，实际最高 ${Math.max(...r.jobs.map(j => j.match_score))}`);
    check(r.questions.length > 0, `[${c.id}] 应给出补充信息提问`);
  } else {
    check(r.insufficient === false, `[${c.id}] 不应判定为信息不足`);
  }

  // 分数区分度：当推荐跨越多个职业族时，各岗位分数应具区分度（不应全平）。
  // 说明：单族强匹配简历（如机械简历推荐多个机械岗位）出现同族并列是合理现象，
  // 此时放宽该断言，避免把正确的同分行为误判为「评分损坏」。
  const scores = r.jobs.map(j => j.match_score);
  const famCount = new Set(r.jobs.map(j => j.family_id)).size;
  if (r.jobs.length >= 2 && famCount >= 2) {
    check(new Set(scores).size > 1, `[${c.id}] 跨行业候选分数应具区分度`);
  }
});

/* ---------- 全局断言 ---------- */
console.log('\n' + '='.repeat(96));
const distinct = new Set(topTitles);
check(distinct.size >= 8, '10 类简历应产生 >=8 个不同的首选岗位，实际 ' + distinct.size);
console.log('不同首选岗位数: ' + distinct.size + ' / 10');
console.log('首选岗位分布: ' + topTitles.join(' , '));

// 硬性资格缺失应扣分：把「药师」证书的简历去掉证书后，药师岗位分数应下降
const medWithCert = JM.recommendJobs(CASES.find(c => c.id === 'medical').resume, null, { topN: 5 });
const medNoCert = JM.recommendJobs(
  CASES.find(c => c.id === 'medical').resume.replace('执业药师', ''), null, { topN: 5 });
const pharmaWith = medWithCert.jobs.find(j => j.job_title === '药师');
const pharmaNo = medNoCert.jobs.find(j => j.job_title === '药师');
console.log('\n硬性资格影响：持证药师 ' + (pharmaWith ? pharmaWith.match_score : 'n/a') +
            ' → 无证 ' + (pharmaNo ? pharmaNo.match_score : 'n/a'));
if (pharmaWith && pharmaNo) {
  check(pharmaNo.match_score <= pharmaWith.match_score, '缺失硬性资格后分数不应升高');
  check(pharmaNo.not_recommended === true || pharmaNo.missing_requirements.some(m => m.indexOf('执业药师') !== -1),
        '缺失执业药师资格应被标记为缺失项');
}

// 求职意向：用户明确想转行时，意向岗位应进入候选并单独展示能力分
const mechToPM = JM.recommendJobs(
  CASES.find(c => c.id === 'mechanical').resume + '\n\n求职意向：产品经理', null, { topN: 5 });
const intentJob = mechToPM.jobs.find(j => j.job_title.indexOf('产品经理') !== -1);
check(!!intentJob, '明确求职意向应进入候选列表');
if (intentJob) {
  console.log('\n转行意向：机械简历 + 求职意向"产品经理" → ' + intentJob.job_title +
              ' 能力匹配分 ' + intentJob.match_score + '，意向维度分 ' + intentJob.dimensions.intent.score +
              '，风险: ' + (intentJob.risks[0] || '-'));
  check(intentJob.dimensions.intent.score === 100, '意向岗位 intent 维度应为 100');
  check(intentJob.match_score < 70, '转行岗位能力匹配分不应虚高（应 <70）');
}

/* ---------- 对抗性断言：跨行业偏差 / 虚高回归 ---------- */
console.log('\n' + '-'.repeat(96));
console.log('对抗性用例：通用话术简历不应被误判为产品/AI，且分数不被虚高');
console.log('-'.repeat(96));

// 1) 机械背景但简历写成通用管理语言：不得是「AI 产品经理」，且若有推荐分数必须低（弱匹配）
const mechGeneric = JM.recommendJobs(
`教育背景
本科 机械设计 某理工大

工作经历
2020-2024 某制造企业 工程师
负责项目推进，协调团队完成产品交付
主导方案设计，推动流程优化，提升效率
参与数据分析与复盘，输出报告

专业技能
项目管理 数据分析 协调 沟通 流程优化`, null, { topN: 5 });
const mgTop = mechGeneric.jobs[0];
console.log('  [机械背景-通用话术] 首选: ' + (mgTop ? mgTop.job_title + ' / ' + mgTop.industry + ' / 分 ' + mgTop.match_score : '(无)') +
  ' | 候选: ' + mechGeneric.jobs.map(j => j.job_title).join(', '));
check(!(mgTop && mgTop.job_title === 'AI 产品经理'), '[机械背景-通用话术] 不得误判为 AI 产品经理');
check(!mgTop || mgTop.match_score < 45, '[机械背景-通用话术] 若有推荐不得虚高(≥45)');

// 2) 运营简历（含产品/数据话术）：首选必须是 biz_ops（运营/市场），而非产品/AI
const opsAmb = JM.recommendJobs(
`教育背景
本科 市场营销 某财经大学

工作经历
2022-2024 某互联网公司 运营
负责产品运营，通过数据分析优化用户增长
推动活动策划与项目落地，协调跨部门资源

专业技能
数据分析 项目管理 用户增长 活动策划 内容运营`, null, { topN: 5 });
const oaTop = opsAmb.jobs[0];
console.log('  [运营简历-含产品话术] 首选: ' + (oaTop ? oaTop.job_title + ' / ' + oaTop.industry + ' / 分 ' + oaTop.match_score : '(无)') +
  ' | 候选: ' + opsAmb.jobs.map(j => j.job_title).join(', '));
check(!!oaTop && oaTop.family_id === 'biz_ops', '[运营简历-含产品话术] 首选应为 biz_ops，实际 ' + (oaTop && oaTop.family_id));
check(!(oaTop && /AI 产品经理/.test(oaTop.job_title)), '[运营简历-含产品话术] 不得为 AI 产品经理');

// 3) 虚高回归：纯通用话术简历的推荐岗位分数必须 < 65（不得进入较/强匹配）
const genericR = JM.recommendJobs(
`教育背景
本科 工商管理

实习经历
参与项目协调，负责数据整理与报告撰写
协助团队推动方案落地

专业技能
Excel PPT 沟通 团队协作 项目管理`, null, { topN: 5 });
genericR.jobs.forEach(function (j) {
  check(j.match_score < 65, '[通用话术] 推荐岗位不应进入较/强匹配(≥65)，实际 ' + j.job_title + '=' + j.match_score);
});

/* ---------- 汇总 ---------- */
console.log('\n' + '='.repeat(96));
console.log('断言通过: ' + pass + ' | 失败: ' + fail);
if (failures.length) {
  console.log('\n失败明细:');
  failures.forEach(f => console.log('  ✗ ' + f));
}
console.log('='.repeat(96));

function pad(s, n) {
  s = String(s);
  let w = 0;
  for (const ch of s) w += /[\u4e00-\u9fa5]/.test(ch) ? 2 : 1;
  return s + ' '.repeat(Math.max(1, n - w));
}

process.exit(fail === 0 ? 0 : 1);
