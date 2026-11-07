/* =====================================================================
 * scenarios_report.js — Test 3（多角色评价与报告）场景定义
 *
 * 完全复刻 electron-app/index.html 中真实评测路径：
 *   - 5 位虚拟面试官（行 988-994 INTERVIEWERS）
 *   - 6 维评分（comm/biz/tech/leader/strategy/culture，行 1022 DIM_LABELS）
 *   - 单轮评分 prompt（行 1784-1789）：三行格式
 *       【评分】0-100 整数
 *       【评价】15-30 字点评
 *       【追问】≤30 字追问 / 「无」
 *   - 聚合 + 报告（行 1873-1893）：按 SCORING_WEIGHTS 加权、verdict、冲突检测
 *
 * 所有指标均来自真实模型调用，无任何预设结果。
 * ===================================================================== */
'use strict';

// —— 复刻应用常量（与 index.html 完全一致）——
const INTERVIEWERS = [
  {id:'hr',name:'Sarah Chen',role:'HR 经理',initials:'SC',color:'#ec4899',focus:'动机与沟通'},
  {id:'biz',name:'Mike Zhang',role:'业务经理',initials:'MZ',color:'#1d6fd1',focus:'商业洞察与影响力'},
  {id:'pro',name:'刘博士',role:'技术专家',initials:'DL',color:'#8b5cf6',focus:'专业深度与技术'},
  {id:'lead',name:'Emma Wang',role:'团队负责人',initials:'EW',color:'#10b981',focus:'领导力与潜力'},
  {id:'chief',name:'David Park',role:'首席评估官',initials:'DP',color:'#f59e0b',focus:'战略视野与决策'}
];

const SCORING_WEIGHTS = {
  product:{name:'产品经理',weights:{comm:20,biz:25,tech:10,leader:20,strategy:15,culture:10}},
  tech:{name:'软件工程师',weights:{comm:10,biz:5,tech:35,leader:15,strategy:10,culture:10}},
  ai:{name:'AI 工程师',weights:{comm:10,biz:10,tech:30,leader:10,strategy:20,culture:10}},
  data:{name:'数据分析师',weights:{comm:15,biz:20,tech:25,leader:10,strategy:15,culture:10}},
  ops:{name:'运营',weights:{comm:20,biz:20,tech:10,leader:20,strategy:15,culture:15}},
  general:{name:'通用岗位',weights:{comm:20,biz:15,tech:25,leader:15,strategy:10,culture:15}}
};

const DIM_LABELS = {comm:'沟通表达',biz:'商业洞察',tech:'技术深度',leader:'领导力',strategy:'战略思维',culture:'文化匹配'};

// 固定简历摘要（复刻 getResumeSummaryForAI 形态，AI-PM 候选人）
const RESUME_SUMMARY =
`姓名：李明
核心技能：需求分析、PRD 撰写、A/B 实验、SQL、Figma、LLM 应用集成
项目经历：① 智能客服问答助手（落地，DAU 12w，工单解决率 76%→89%）② 增长活动平台（支撑 30+ 活动，ROI +18%）③ 竞品监控看板（周报自动化，节省 20h/周）
亮点：0→1 搭建 2 个 C 端产品模块；主导跨 4 部门协作
简介：2 年 AI 产品经验，目标岗位 AI 产品经理`;

// 构建单轮评分 prompt（与 submitAnswer 完全一致，行 1784-1789）
function buildScorePrompt(scn, difficulty){
  const iv = INTERVIEWERS.find(i => i.id === scn.interviewerId) || INTERVIEWERS[0];
  const diffHints = {
    1:'候选人应聘校招/实习，评分偏宽松',
    2:'社招难度，关注落地经验',
    3:'大厂面试，要求量化与结构化',
    4:'高压面试，要求STAR与反事实思考',
    5:'Leader/管理岗，考察战略与取舍'
  };
  const sys = '你是「' + iv.name + '（' + iv.role + '，侧重' + iv.focus + '）」，正在对候选人做结构化面试评估。'
    + (diffHints[difficulty] || '') + '。请对候选人的本轮回答给出专业评审。';
  const usr = '候选人简历摘要：\n' + RESUME_SUMMARY
    + '\n\n当前面试官：' + iv.name + '（' + iv.role + '）'
    + '\n本轮考察维度：' + (DIM_LABELS[scn.dimension] || '综合')
    + '\n本轮问题：\n' + scn.question
    + '\n候选人回答：\n' + scn.answer
    + '\n\n请严格按以下三行格式输出（不要任何前后缀、解释或多余文字）：\n【评分】0-100 的整数\n【评价】一句 15-30 字中文点评（肯定亮点或指出不足）\n【追问】若存在明显薄弱点/含糊处或值得深挖的亮点，输出一句 30 字内追问；若回答已非常充分则输出「无」';
  return { system: sys, user: usr };
}

// 解析三行输出（与 index.html 行 1795 正则一致）
function parseScore(t){
  const mS = String(t).match(/评分[：:】)\s]*(\d{1,3})/);
  const mC = String(t).match(/评价[：:】)\s]*([^\n]+)/);
  const mF = String(t).match(/追问[：:】)\s]*([^\n]+)/);
  let score = mS ? parseInt(mS[1], 10) : NaN;
  if (isNaN(score)) score = 70;
  score = Math.min(Math.max(score, 30), 98);
  const comment = mC ? mC[1].trim() : '';
  const followup = mF ? mF[1].trim() : '';
  return { score, comment, followup };
}

/* ---------------------------------------------------------------------
 * 32 个单轮场景：5 位面试官 × 各质量档（strong/medium/weak/contradictory/offtopic）
 * quality 为人工标注的"参考答案质量"，用于方向性合理率等代理指标。
 * ------------------------------------------------------------------- */
const REPORT_SCENARIOS = [
  // —— HR / 沟通表达 ——
  {id:'H1',interviewerId:'hr',dimension:'comm',quality:'strong',
   question:'请用 STAR 法则介绍你最有成就感的项目。',
   answer:'背景：客服工单长期积压。任务：我牵头搭建智能问答助手。行动：用 LLM+RAG 重构知识库、设人工兜底、做 A/B。结果：工单解决率 76%→89%，DAU 12w，月省 800 人力小时。'},
  {id:'H2',interviewerId:'hr',dimension:'comm',quality:'weak',
   question:'请介绍一下你自己。',
   answer:'我做过一些产品相关的事情吧，感觉还行，反正就是做了不少项目，挺充实的，具体也说不太清。'},
  {id:'H3',interviewerId:'hr',dimension:'comm',quality:'contradictory',
   question:'你有多少年产品经验？',
   answer:'我有五年产品经验，主导过很多从零到一的大项目。', /* 简历写 2 年 */},
  {id:'H4',interviewerId:'hr',dimension:'culture',quality:'offtopic',
   question:'你为什么想加入我们公司？',
   answer:'其实我更想去字节，你们这边主要是先拿个保底，公司文化我倒没太关注。'},
  {id:'H5',interviewerId:'hr',dimension:'culture',quality:'medium',
   question:'你未来三年的职业规划？',
   answer:'希望在 AI 产品方向深耕，先做好执行再带小团队，多接触业务和用户。'},
  {id:'H6',interviewerId:'hr',dimension:'comm',quality:'strong',
   question:'讲一个你推动跨团队协作的例子。',
   answer:'我协调了研发、设计、运营、数据 4 个部门，用双周对齐机制把需求平均交付周期从 3 周压到 9 天，关键是用统一看板消除信息差。'},

  // —— Biz / 商业洞察 ——
  {id:'B1',interviewerId:'biz',dimension:'biz',quality:'strong',
   question:'你做的增长活动平台如何衡量商业价值？',
   answer:'按活动 ROI 口径：单活动平均获客成本降 22%，GMV 环比 +18%，并归因到 3 个核心漏斗环节做精细化补贴，把补贴 ROI 从 1.3 提到 2.1。'},
  {id:'B2',interviewerId:'biz',dimension:'biz',quality:'weak',
   question:'你怎么看这个产品的商业模式？',
   answer:'就是帮用户解决问题嘛，然后可以变现，感觉付费意愿应该还行，具体怎么收我们可以再想想。'},
  {id:'B3',interviewerId:'biz',dimension:'biz',quality:'contradictory',
   question:'你提到带来 1000 万营收，具体构成？',
   answer:'主要是活动带来的，大概 1000 万吧，其实里面有很大一部分是自然流量，跟活动关系不太大。'},
  {id:'B4',interviewerId:'biz',dimension:'strategy',quality:'offtopic',
   question:'如果预算砍一半，你怎么调整策略？',
   answer:'我不太管预算的事情，那是老板考虑的，我就把功能做好就行。'},
  {id:'B5',interviewerId:'biz',dimension:'strategy',quality:'medium',
   question:'如何判断一个新功能是否值得做？',
   answer:'我会先看用户痛点和规模，再做轻量 MVP 验证，用核心指标判断是否放量，避免凭感觉拍板。'},
  {id:'B6',interviewerId:'biz',dimension:'biz',quality:'strong',
   question:'如何为一个新市场设计进入策略？',
   answer:'先按 TAM/SAM/SOM 切分，选高净值低竞争切口，用种子用户做 PMF 验证，再用单位经济模型决定补贴力度，设 3 个退出阈值控制风险。'},

  // —— Pro / 技术深度 ——
  {id:'P1',interviewerId:'pro',dimension:'tech',quality:'strong',
   question:'RAG 系统的检索召回如何优化？',
   answer:'用混合检索（BM25+向量），加重排模型，做 chunk 重叠与元数据过滤，再用 query 改写提升召回，离线评估用 Recall@10 和大模型评分双指标。'},
  {id:'P2',interviewerId:'pro',dimension:'tech',quality:'weak',
   question:'你如何理解大模型微调？',
   answer:'就是让模型更聪明一点，我们用 SFT 调了一下，效果还不错，具体参数我记不太清了。'},
  {id:'P3',interviewerId:'pro',dimension:'tech',quality:'contradictory',
   question:'你说自建了向量数据库，用的什么架构？',
   answer:'我们自建了向量数据库，性能特别好，具体用的什么我不太记得了，反正就是存向量然后查。'},
  {id:'P4',interviewerId:'pro',dimension:'tech',quality:'offtopic',
   question:'前端如何处理大模型流式输出？',
   answer:'我主要是写 PRD 的，前端代码我不太会，那个让开发处理就好了。'},
  {id:'P5',interviewerId:'pro',dimension:'tech',quality:'medium',
   question:'如何评估一个推荐算法的效果？',
   answer:'我会看点击率、转化率和留存，也会做 A/B 对比，关注长期指标而不是短期刷量。'},
  {id:'P6',interviewerId:'pro',dimension:'tech',quality:'strong',
   question:'高并发下如何保证问答延迟？',
   answer:'请求侧加语义缓存命中高频问，模型侧用投机解码+量化，架构上异步化与限流，P99 从 2.1s 压到 600ms，成本降 40%。'},

  // —— Lead / 领导力 ——
  {id:'L1',interviewerId:'lead',dimension:'leader',quality:'strong',
   question:'讲一次你化解团队冲突的经历。',
   answer:'研发与运营因优先级争执，我拉双方对齐目标，用数据排期并设双周复盘，两周内冲突归零，关键需求按期上线。'},
  {id:'L2',interviewerId:'lead',dimension:'leader',quality:'weak',
   question:'你如何带团队拿到结果？',
   answer:'反正都是我一个人把最难的部分做了，下面的人能力不太行，我盯得紧一点就出活了。'},
  {id:'L3',interviewerId:'lead',dimension:'leader',quality:'contradictory',
   question:'你带过多少人？',
   answer:'我带过 15 人的团队，全面负责管理和招聘。', /* 简历写独立贡献者 */},
  {id:'L4',interviewerId:'lead',dimension:'leader',quality:'offtopic',
   question:'你的管理风格？',
   answer:'管理这些虚的我不太关心，我就想把需求写完。'},
  {id:'L5',interviewerId:'lead',dimension:'leader',quality:'medium',
   question:'如何推动一个你不熟悉的领域项目？',
   answer:'我会先找领域专家补齐认知，再定里程碑，过程中保持同步，遇到风险及时升级。'},
  {id:'L6',interviewerId:'lead',dimension:'leader',quality:'strong',
   question:'资源有限时如何取舍？',
   answer:'我用 RICE 排序，砍掉低杠杆需求，集中 70% 资源攻核心链路，并向利益相关方透明同步取舍理由，拿到授权。'},

  // —— Chief / 战略思维 ——
  {id:'C1',interviewerId:'chief',dimension:'strategy',quality:'strong',
   question:'AI 产品 vs 传统产品，战略差异？',
   answer:'AI 产品不确定性高、需持续对齐模型能力边界，策略上用场景收敛+数据飞轮，先窄后宽，把泛化留到能力成熟后。'},
  {id:'C2',interviewerId:'chief',dimension:'strategy',quality:'weak',
   question:'如何制定产品三年战略？',
   answer:'就是看行业趋势，然后定几个大目标，再一步步实现，反正要有愿景嘛。'},
  {id:'C3',interviewerId:'chief',dimension:'strategy',quality:'contradictory',
   question:'你说市占率第一，依据？',
   answer:'我们市占率肯定是行业第一，具体数据我手头没有，但内部都这么认为。'},
  {id:'C4',interviewerId:'chief',dimension:'strategy',quality:'offtopic',
   question:'如何平衡短期 KPI 与长期价值？',
   answer:'KPI 是上面定的，我照着完成就行，长期的事想了也没用。'},
  {id:'C5',interviewerId:'chief',dimension:'strategy',quality:'medium',
   question:'如何判断要不要切入一个新赛道？',
   answer:'我会评估市场空间、自身能力和时机，做小步快跑验证，不行就及时止损。'},
  {id:'C6',interviewerId:'chief',dimension:'strategy',quality:'strong',
   question:'面对大厂入场，你的差异化策略？',
   answer:'避开通用能力军备竞赛，切垂直场景做深行业 know-how 与数据闭环，用合规与私有化建立壁垒，打不对称仗。'},

  // —— 2 个"充分/无需追问"标杆（验证 followup=无）——
  {id:'S1',interviewerId:'pro',dimension:'tech',quality:'strong',
   question:'解释一下你用的评估指标。',
   answer:'离线用 Recall@10 和大模型相关性评分，在线用解决率、转人工率和 CSAT 三指标联合监控，每周回灌 badcase 做回归，指标定义和阈值都有文档。'},
  {id:'S2',interviewerId:'hr',dimension:'comm',quality:'strong',
   question:'你最大的优点？',
   answer:'结构化表达和执行力。我习惯把目标拆成可验证里程碑，过去 4 个项目全部按期交付且指标达标，复盘沉淀为团队模板。'}
];

/* ---------------------------------------------------------------------
 * 3 个完整候选人画像（端到端聚合测试）：每人在 6 个维度各 1 答，
 * 面试官按维度归属映射（comm/culture→hr, biz→biz, tech→pro, leader→lead, strategy→chief）
 * ------------------------------------------------------------------- */
const DIM_TO_IV = {comm:'hr',culture:'hr',biz:'biz',tech:'pro',leader:'lead',strategy:'chief'};

const CANDIDATE_PROFILES = [
  {id:'CAND_STRONG',jobType:'product',label:'强候选人（STAR+量化）',
   answers:[
     {dimension:'comm',question:'介绍最有成就感的项目',answer:'用 STAR 把智能客服从 0 搭到 DAU12w，解决率 76%→89%，月省 800 人力小时，跨 4 部门协作。'},
     {dimension:'culture',question:'为何加入',answer:'认同用 AI 降人力成本的使命，已深度使用产品并写了 3 篇体验分析。'},
     {dimension:'biz',question:'商业价值',answer:'活动 ROI 从 1.3 提到 2.1，获客成本降 22%，GMV +18%，归因到 3 个漏斗环节。'},
     {dimension:'tech',question:'技术深度',answer:'RAG 混合检索+重排，chunk 重叠与元数据过滤，Recall@10 提升 14pt，P99 压到 600ms。'},
     {dimension:'leader',question:'领导力',answer:'用 RICE 砍低杠杆需求，集中资源攻核心链路，透明同步取舍拿到授权。'},
     {dimension:'strategy',question:'战略',answer:'场景收敛+数据飞轮，先窄后宽，把泛化留到能力成熟后，建立不对称壁垒。'}
   ]},
  {id:'CAND_MEDIUM',jobType:'product',label:'中等候选人（有框架欠量化）',
   answers:[
     {dimension:'comm',question:'介绍项目',answer:'做过智能客服项目，负责需求，整体还行，和用户也聊了不少。'},
     {dimension:'culture',question:'为何加入',answer:'想找个稳定发展平台，做 AI 产品方向。'},
     {dimension:'biz',question:'商业价值',answer:'我觉得活动效果还行，具体数字没太细跟，但应该不错。'},
     {dimension:'tech',question:'技术深度',answer:'RAG 我知道，就是检索加生成，具体调参不太熟。'},
     {dimension:'leader',question:'领导力',answer:'会协调一下大家，把任务分一分，遇到问题再沟通。'},
     {dimension:'strategy',question:'战略',answer:'看行业趋势定目标，小步快跑验证，不行就止损。'}
   ]},
  {id:'CAND_WEAK',jobType:'product',label:'弱候选人（含糊/矛盾/偏题）',
   answers:[
     {dimension:'comm',question:'介绍项目',answer:'做了一些产品的事情吧，反正挺充实的，具体也说不太清。'},
     {dimension:'culture',question:'为何加入',answer:'先拿个保底，我更想去大厂，文化没太关注。'},
     {dimension:'biz',question:'商业价值',answer:'就是能变现，付费意愿应该还行，具体再想想。'},
     {dimension:'tech',question:'技术深度',answer:'微调就是让模型更聪明，参数我记不太清了。'},
     {dimension:'leader',question:'领导力',answer:'都是我一个人做最难的，下面人能力不行我盯着。'},
     {dimension:'strategy',question:'战略',answer:'KPI 上面定的我照完成，长期想了也没用。'}
   ]}
];

module.exports = {
  INTERVIEWERS, SCORING_WEIGHTS, DIM_LABELS, RESUME_SUMMARY,
  buildScorePrompt, parseScore,
  REPORT_SCENARIOS, CANDIDATE_PROFILES, DIM_TO_IV
};
