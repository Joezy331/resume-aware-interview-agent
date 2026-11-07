/* ============================================================
   AI Career Copilot · Prototype Data
   Real field names extracted from dist/index_v3.html +
   docs/competency_framework.md + python-backend/config.py.
   Sections backed only by frontend prototype state are
   marked:  // MOCK DATA FOR PROTOTYPE
   ============================================================ */
window.DB = {};

/* ---------- User profile ---------- */
DB.profile = {
  name:'江同学', role:'AI 产品经理 · 求职中',
  avatar:'🐱', target:'AI 产品经理',
  resumeDone:true, lastScore:78, growth:+12,
  email:'jiang@prototype.dev'
};

/* ---------- Resume parse (real-ish structure) ---------- */
DB.resume = {
  file:'Jiang_Resume_2026.pdf', size:'2.4 MB', status:'已解析',
  basic:{name:'江同学', edu:'硕士 · 计算机', years:'3 年', field:'AI / 产品'},
  education:[{school:'某 985 高校', major:'人工智能（硕士）', time:'2023–2026'}],
  projects:[
    {name:'AI 聊天机器人平台', role:'产品负责人', impact:'DAU +38%'},
    {name:'Prompt 评测工作台', role:'产品设计 + 0→1', impact:'评测效率 ×3'}
  ],
  interns:[{co:'某大厂 AI Lab', role:'产品实习生', time:'2024 夏'}],
  skills:['Python','LLM/GPT API','产品策略','A/B 测试','SQL','Figma','敏捷开发','数据分析'],
  ability:[
    {k:'产品思维', v:82}, {k:'数据分析', v:74}, {k:'AI 理解', v:79},
    {k:'沟通表达', v:86}, {k:'项目深度', v:80}, {k:'业务洞察', v:71}
  ]
};

/* ---------- Job matches (11, real list from index_v3) ---------- */
DB.jobs = [
  {name:'AI 产品经理',score:92,reason:'丰富的 AI/LLM 产品经验 + 策略能力',skills:['Prompt设计','LLM应用','产品策略','数据驱动'],gap:'需更多模型评估经验',path:'AI PM → 高级 AI PM → AI 产品总监'},
  {name:'产品经理',score:88,reason:'扎实的产品管理基础 + 数据决策',skills:['需求分析','PRD','敏捷开发','A/B测试'],gap:'B2C 产品经验不足',path:'PM → 高级PM → 产品总监'},
  {name:'数据产品经理',score:85,reason:'强大数据技能 + 看板设计 + 指标驱动',skills:['SQL','数据看板','指标体系','实验设计'],gap:'数仓架构知识待加深',path:'数据分析师→数据PM→高级数据PM'},
  {name:'AIGC 产品经理',score:83,reason:'AI/LLM理解 + 产品思维 + AIGC认知',skills:['Agent设计','Prompt工程','AI伦理'],gap:'AIGC工具链经验不足',path:'AIGC PM → 高级 PM → 创新负责人'},
  {name:'AI 运营',score:80,reason:'AI工具熟练 + 数据分析 + 流程优化',skills:['自动化','数据分析','内容策略','增长实验'],gap:'MLOps 基础待学习',path:'AI运营→高级运营→运营经理'},
  {name:'数据分析师',score:79,reason:'SQL/数据能力强 + 可视化 + 统计基础',skills:['Python','SQL','Tableau','统计'],gap:'统计学待深入',path:'初级→分析师→高级→分析经理'},
  {name:'提示词工程师',score:77,reason:'LLM API经验 + AI能力理解',skills:['Prompt工程','CoT','API调用','模型评估'],gap:'系统化训练待加强',path:'PE → 高级PE → AI架构师'},
  {name:'商业分析师',score:76,reason:'业务理解 + 数据 + 干系人管理',skills:['商业模式','财务建模','流程优化'],gap:'行业知识待深入',path:'BA→高级BA→主管BA'},
  {name:'用户增长',score:74,reason:'数据驱动 + A/B测试 + 用户行为',skills:['增长漏斗','留存','实验设计','病毒传播'],gap:'增长黑客实战不足',path:'增长分析师→经理→负责人'},
  {name:'前端开发',score:71,reason:'技术背景 + 产品理解 + UX意识',skills:['HTML/CSS/JS','React/Vue','UI组件','响应式'],gap:'框架深入经验待补充',path:'初级前端→工程师→高级→架构师'},
  {name:'后端开发',score:69,reason:'Python能力 + 系统设计 + API',skills:['Python','REST API','数据库','系统设计'],gap:'分布式系统待学习',path:'初级后端→工程师→高级→架构师'}
];

/* ---------- JD library (real JD fields) ---------- */
DB.jd = {
  'AI 产品经理':{
    resp:['定义 AI 产品路线图','设计 LLM/Agent 功能','推动跨团队落地','建立评测体系'],
    hard:['LLM 应用','Prompt 工程','产品设计','数据分析'],
    soft:['跨团队沟通','结构化思考','Owner 意识'],
    tools:['GPT/Claude API','Figma','SQL','Mixpanel'],
    edu:'本科及以上，AI/计算机/相关优先',
    focus:'LLM 应用、产品落地、评测体系',
    kw:['用户研究','需求分析','AI产品','数据分析','Prompt','Agent']
  },
  '产品经理':{
    resp:['用户研究与需求分析','撰写 PRD','敏捷迭代','版本规划'],
    hard:['需求分析','原型设计','数据分析','项目管理'],
    soft:['沟通协调','向上管理','同理心'],
    tools:['Figma','Axure','SQL','Jira'],
    edu:'本科及以上',
    focus:'用户价值、需求优先级、交付质量',
    kw:['用户研究','需求分析','PRD','A/B测试','项目管理']
  },
  '数据分析师':{
    resp:['搭建数据分析体系','撰写数据洞察','支持业务决策','设计 A/B 实验'],
    hard:['SQL','Python/R','统计学','BI 工具'],
    soft:['逻辑分析','业务理解','报告撰写'],
    tools:['SQL','Python','Tableau','Excel'],
    edu:'本科及以上，统计/数学/计算机优先',
    focus:'统计分析、数据建模、业务洞察',
    kw:['SQL','Python','指标','A/B测试','可视化']
  },
  'AI 运营':{
    resp:['制定 AI 工具运营策略','优化 AI 辅助流程','分析运营数据','培训团队使用 AI'],
    hard:['AI工具熟练','数据分析','内容运营','自动化'],
    soft:['学习能力','流程优化','沟通培训'],
    tools:['ChatGPT','飞书','Excel','Python'],
    edu:'本科及以上',
    focus:'AI工具应用、流程自动化、数据运营',
    kw:['自动化','运营数据','增长实验','流程优化']
  }
};
DB.jdFallback = {
  resp:['负责核心业务模块','推动需求落地','跨部门协作','复盘迭代'],
  hard:['岗位硬技能','数据分析','项目执行'],
  soft:['沟通表达','逻辑思维','协作'],
  tools:['常用办公与专业工具'],
  edu:'本科及以上',
  focus:'岗位核心能力与业务结果',
  kw:['岗位关键词','业务','协作','结果']
};

/* ---------- Competency tree (real second-level, per job) ---------- */
DB.competency = {
  '产品经理':{
    '产品设计':['用户研究','需求分析','原型设计','优先级判断'],
    '数据分析':['指标体系','漏斗分析','A/B 测试','用户画像'],
    '商业理解':['竞品分析','商业模式','市场分析','定价策略'],
    '沟通协作':['需求评审','跨部门协调','向上管理','团队激励']
  },
  'AI 运营':{
    'AI工具':['ChatGPT应用','Midjourney','自动化工具','AI辅助写作'],
    '运营能力':['内容运营','用户运营','活动策划','数据分析'],
    '流程优化':['效率提升','自动化设计','标准化','培训赋能'],
    '数据能力':['数据监控','效果分析','A/B测试','报告撰写']
  },
  '数据分析师':{
    '分析技能':['SQL精通','Python分析','统计建模','机器学习基础'],
    '可视化':['Tableau','数据看板','报告撰写','故事讲述'],
    '业务理解':['业务指标','漏斗分析','用户分群','ROI计算'],
    '工具':['Excel高级','Jupyter','R语言','SPSS']
  },
  '用户增长':{
    '增长方法':['增长漏斗','留存分析','病毒传播','增长实验'],
    '数据分析':['用户行为','A/B测试','归因分析','LTV计算'],
    '产品理解':['用户画像','转化优化','产品体验','功能实验'],
    '渠道运营':['获客渠道','内容营销','社交传播','合作推广']
  }
};
DB.competencyFallback = {
  '核心能力':['需求理解','执行落地','沟通协作','结果导向'],
  '专业深度':['方法论','工具使用','案例积累','数据验证'],
  '业务理解':['用户价值','指标意识','商业逻辑','复盘迭代']
};

/* ---------- Dynamic scoring weights (real 5 templates) ---------- */
DB.DIM = {comm:'沟通表达',biz:'商业洞察',tech:'技术深度',leader:'领导力',strategy:'战略思维',culture:'文化匹配'};
DB.weights = {
  product:{name:'产品经理',icon:'📦',weights:{comm:20,biz:25,tech:10,leader:20,strategy:15,culture:10}},
  tech:{name:'软件工程师',icon:'💻',weights:{comm:10,biz:5,tech:35,leader:15,strategy:10,culture:10}},
  ai:{name:'AI 工程师',icon:'🤖',weights:{comm:10,biz:10,tech:30,leader:10,strategy:20,culture:10}},
  data:{name:'数据分析师',icon:'📊',weights:{comm:15,biz:20,tech:25,leader:10,strategy:15,culture:10}},
  ops:{name:'运营',icon:'🚀',weights:{comm:20,biz:20,tech:10,leader:20,strategy:15,culture:15}}
};
/* map a job name → weight template key */
DB.jobType = function(name){
  if(/数据/.test(name)) return 'data';
  if(/AI|大模型|Prompt|提示词|AIGC/.test(name)) return 'ai';
  if(/运营|增长/.test(name)) return 'ops';
  if(/前端|后端|开发|工程师/.test(name)) return 'tech';
  return 'product';
};

/* ---------- Interviewers (real 5) ---------- */
DB.interviewers = [
  {id:'hr',name:'Sarah',role:'HR 经理',initials:'S',color:'#C8F36A',focus:'沟通表达 · 文化匹配'},
  {id:'biz',name:'Mike Zhang',role:'业务经理',initials:'M',color:'#6B8CAE',focus:'商业洞察 · 策略思维'},
  {id:'pro',name:'刘博士',role:'技术专家',initials:'L',color:'#9A7BB5',focus:'技术深度 · 专业'},
  {id:'lead',name:'Emma Wang',role:'团队负责人',initials:'E',color:'#7C9A78',focus:'领导力 · 潜力'},
  {id:'chief',name:'David Park',role:'首席评估官',initials:'D',color:'#C9A227',focus:'战略视野 · 仲裁'}
];

/* ---------- Interview question bank (real V3 bank, trimmed) ---------- */
DB.questions = [
  {q:'请介绍一个你参与过的 AI 产品项目，以及你在其中承担的主要工作。',src:'resume',iv:'hr',dim:'comm'},
  {q:'职位强调 LLM 应用。你会如何为客服机器人设计 Prompt 策略？',src:'jd',iv:'pro',dim:'tech'},
  {q:'你曾带领 4 人团队。请描述一个需要做艰难决策的场景。',src:'resume',iv:'lead',dim:'leader'},
  {q:'如何为新 AI 功能设计 A/B 测试框架来衡量业务影响？',src:'competency',iv:'biz',dim:'biz'},
  {q:'请讲述一个跨职能协调三方达成一致的经历。',src:'jd',iv:'chief',dim:'strategy'},
  {q:'如何跟进最新 AI 发展并应用到产品中？',src:'competency',iv:'pro',dim:'tech'},
  {q:'描述一个用数据驱动重大产品决策的项目，跟踪了哪些指标？',src:'jd',iv:'biz',dim:'biz'},
  {q:'为什么对这个职位感兴趣？与你的规划如何契合？',src:'competency',iv:'chief',dim:'culture'}
];

/* ---------- Score report (mock aggregated result) ---------- */
DB.report = {
  overall:78, band:'整体表现良好',
  dims:{comm:82,biz:74,tech:78,leader:71,strategy:80,culture:84},
  strengths:[
    '项目表达较完整，有具体案例支撑',
    '沟通逻辑清晰，结构分明',
    '岗位理解较好，动机明确'
  ],
  weaknesses:[
    '数据指标表达偏少，缺少量化结果',
    '业务分析停留在执行层，缺商业拆解',
    '部分回答缺少清晰框架'
  ],
  evidence:{
    comm:'用 STAR 完整讲述项目，结论先行',
    biz:'未给出北极星指标与 ROI 推导',
    tech:'能讲清原理但缺落地数据验证',
    leader:'给出艰难决策案例，Owner 意识强',
    strategy:'拆解问题有层次，路径清楚',
    culture:'动机与团队案例一致'
  }
};

/* ---------- Growth (top 3) ---------- */
DB.growth = [
  {k:'数据分析',cur:74,tgt:85,gap:11,why:'面试回答缺少指标定义与结果验证',tips:['学习指标体系','练习 A/B 测试题','梳理项目数据']},
  {k:'业务分析',cur:71,tgt:82,gap:11,why:'回答偏执行层，缺商业目标与用户价值分析',tips:['加强商业目标分析','练习 ROI 推导','补行业研究方法']},
  {k:'结构化表达',cur:80,tgt:88,gap:8,why:'部分回答缺少清晰框架',tips:['使用 STAR/金字塔','先结论后论据','限时练习']}
];

/* ---------- Interview history (mock) ---------- */
DB.history = [
  {date:'2026.09.29',diff:'标准',score:78,trend:'+6',weak:'数据指标'},
  {date:'2026.09.20',diff:'轻量',score:72,trend:'+3',weak:'业务分析'},
  {date:'2026.09.12',diff:'标准',score:69,trend:'—',weak:'结构化'}
];

/* =================== ADMIN (mostly prototype-scale) =================== */
// MOCK DATA FOR PROTOTYPE — admin analytics are demo figures, not live backend
DB.admin = {
  kpis:[
    {k:'用户数',v:'1,284',d:'+8.2%'},
    {k:'累计面试',v:'3,602',d:'+12%'},
    {k:'平均评分',v:'74.6',d:'+1.4'},
    {k:'完成率',v:'91%',d:'+3%'}
  ],
  trend:[52,48,61,55,63,58,70,66,72,69,78,74], // 12-week interview counts
  jobDist:[['AI 产品经理',38],['产品经理',24],['数据分析',18],['AI 运营',12],['其他',8]],
  abilityDist:[['沟通表达',82],['商业洞察',74],['技术深度',76],['领导力',70],['战略思维',78],['文化匹配',80]],
  diffDist:[['校招',18],['普通社招',40],['大厂',24],['BAT',12],['Leader',6]],
  // 13-agent pipeline (real order, real names)
  pipeline:[
    'Resume Parser','Job Match','JD Agent','Competency Framework',
    'Interview Agent','Follow-up Agent','HR Interviewer','Business Interviewer',
    'Professional Interviewer','Leader Interviewer','Chief Evaluation',
    'Score Agent','Summary Agent'
  ],
  agentHealth:[
    {n:'HR Agent',rate:98}, {n:'Business Agent',rate:97}, {n:'Professional Agent',rate:96},
    {n:'Leader Agent',rate:95}, {n:'Chief Evaluation',rate:99}
  ],
  // Agent monitor (13 agents) — demo
  monitor:[
    {n:'Resume Parser',st:'done',t:'0.9s',calls:1284,succ:100,token:'—',last:'09:58'},
    {n:'Job Match',st:'done',t:'1.2s',calls:1284,succ:100,token:'—',last:'09:58'},
    {n:'JD Agent',st:'done',t:'1.5s',calls:1180,succ:99,token:'—',last:'09:55'},
    {n:'Competency',st:'done',t:'0.7s',calls:1180,succ:100,token:'—',last:'09:55'},
    {n:'Interview Agent',st:'run',t:'2.8s',calls:3602,succ:98,token:'1,284',last:'now'},
    {n:'Follow-up Agent',st:'run',t:'1.1s',calls:2950,succ:97,token:'640',last:'now'},
    {n:'HR Interviewer',st:'done',t:'1.6s',calls:3602,succ:99,token:'420',last:'09:40'},
    {n:'Business Interviewer',st:'done',t:'1.9s',calls:3602,succ:98,token:'510',last:'09:40'},
    {n:'Professional Interviewer',st:'warn',t:'3.4s',calls:3602,succ:95,token:'690',last:'09:38'},
    {n:'Leader Interviewer',st:'done',t:'2.0s',calls:3602,succ:98,token:'480',last:'09:39'},
    {n:'Chief Evaluation',st:'run',t:'2.2s',calls:3602,succ:99,token:'320',last:'now'},
    {n:'Score Agent',st:'wait',t:'—',calls:3602,succ:99,token:'—',last:'09:30'},
    {n:'Summary Agent',st:'wait',t:'—',calls:3602,succ:100,token:'—',last:'09:30'}
  ],
  agentDetail:{
    name:'Interview Agent',status:'Completed',latency:'2.8s',token:'1,284',model:'GPT-4o-mini (Demo)',
    input:'Resume + JD + 上一轮回答',
    process:['读取简历与 JD','匹配能力维度','生成情境问题','标注追问信号'],
    output:'本轮面试问题 + 下一轮追问策略',
    errors:'无'
  },
  // model calls (demo)
  models:[
    {m:'GPT-4o-mini',role:'面试问题生成',calls:3602,cost:'$42.1',lat:'1.8s'},
    {m:'GPT-4o',role:'评估报告汇总',calls:1180,cost:'$61.3',lat:'2.4s'},
    {m:'Embedding',role:'简历/岗位向量',calls:2464,cost:'$3.2',lat:'0.3s'},
    {m:'Claude (备选)',role:'冲突仲裁',calls:420,cost:'$18.9',lat:'2.1s'}
  ],
  system:[
    {k:'服务状态',v:'运行中',ok:true},
    {k:'API 可用率',v:'99.7%',ok:true},
    {k:'平均时延',v:'1.9s',ok:true},
    {k:'待处理队列',v:'12',ok:true},
    {k:'错误率(24h)',v:'0.3%',ok:true},
    {k:'存储使用',v:'41%',ok:true}
  ],
  quality:[
    {k:'评分一致性(跨面试官)',v:'0.86',note:'Cohen κ'},
    {k:'冲突仲裁触发率',v:'7.2%',note:'>15 分差异'},
    {k:'低分申诉率',v:'2.1%',note:'用户反馈'},
    {k:'追问命中率',v:'83%',note:'用户认为相关'}
  ]
};

/* =================== CHART SERIES =================== */
// MOCK DATA FOR PROTOTYPE
// Every series below is demo data drawn for the high-fidelity prototype.
// No live backend / analytics pipeline is connected.
DB.charts = {
  /* ---------- 用户端 ---------- */
  scoreTrend:{labels:['08-12','08-20','09-01','09-12','09-29'],vals:[69,72,71,76,78]},
  resumeSections:[
    {label:'教育背景',val:100},{label:'项目经历',val:92},{label:'技能标签',val:88},
    {label:'实习经历',val:80},{label:'AI 能力',val:76}
  ],
  skillDist:[['产品能力',34],['数据能力',24],['AI 能力',22],['沟通协作',20]],
  jdKwWeight:{                       // 关键词权重（示意）
    'AI 产品经理':[38,32,28,24,20,16],
    '产品经理':[36,31,27,22,18,14],
    '数据分析师':[40,33,26,21,17,13],
    'AI 运营':[34,30,25,20,16,12]
  },
  jdKwWeightFallback:[34,29,24,20,16,12],
  targetFit:[
    {k:'产品思维',you:82,req:88},{k:'数据分析',you:74,req:80},
    {k:'AI 理解',you:79,req:85},{k:'沟通表达',you:86,req:82},
    {k:'业务洞察',you:71,req:78}
  ],
  diffMeta:[
    {k:'校招',q:6,fu:30,depth:50},
    {k:'普通社招',q:8,fu:45,depth:70},
    {k:'大厂',q:10,fu:60,depth:85},
    {k:'BAT',q:12,fu:78,depth:95},
    {k:'Leader',q:9,fu:65,depth:90}
  ],
  agentScores:[
    {n:'HR · Sarah',v:84},{n:'Business · Mike',v:74},
    {n:'Professional · 刘博士',v:78},{n:'Leader · Emma',v:71},
    {n:'Chief · David',v:80}
  ],
  agentLatency:[
    {n:'HR',v:1.6},{n:'Business',v:1.9},
    {n:'Professional',v:3.4},{n:'Leader',v:2.0},{n:'Chief',v:2.2}
  ],
  prevDims:{comm:76,biz:70,tech:72,leader:68,strategy:74,culture:80},
  historySeries:{
    labels:['09-12','09-20','09-29'],
    items:[
      {name:'综合得分',vals:[69,72,78],color:'#18181B'},
      {name:'数据分析',vals:[62,68,74],color:'#C8F36A'},
      {name:'结构化表达',vals:[70,73,80],color:'#6B8CAE'}
    ]
  },
  activity:[3,5,4,7,6,8,7,9],
  jdHit:[92,86,78,71,64,58],        // 简历对 JD 关键词的命中率（示意）
  livePerf:[62,68,71,75,78],        // 本轮面试实时表现（示意）
  offerProb:[62,68,74,79,83],       // 录用概率随面试推进（示意）

  /* ---------- 管理员端 ---------- */
  userTrend:{labels:['W1','W2','W3','W4','W5','W6','W7','W8'],vals:[820,910,985,1042,1108,1164,1226,1284]},
  userStatus:[['活跃',986],['沉默',298]],
  scoreDist:[['<60',6],['60-69',18],['70-79',38],['80-89',28],['90+',10]],
  doneTrend:{labels:['W1','W5','W9','W13','W17','W21','W25','W29'],vals:[84,86,85,88,90,89,91,93]},
  agentTrend:{labels:['10:00','10:05','10:10','10:15','10:20','10:25'],vals:[2.1,2.4,3.1,2.8,2.6,2.9]},
  uptimeTrend:{labels:['W1','W2','W3','W4','W5','W6','W7','W8'],vals:[99.5,99.6,99.4,99.8,99.7,99.9,99.6,99.7]},
  qualityTrend:{labels:['W1','W2','W3','W4','W5','W6','W7','W8'],vals:[0.78,0.80,0.81,0.79,0.83,0.85,0.84,0.86]},
  modelCost:[{label:'GPT-4o',v:61.3},{label:'4o-mini',v:42.1},{label:'Claude',v:18.9},{label:'Embedding',v:3.2}],
  queueTrend:[8,11,9,14,12,10,13,12],
  tokenDist:[{label:'Interview',v:1284},{label:'Follow-up',v:640},{label:'Professional',v:690},{label:'Business',v:510},{label:'Leader',v:480}]
};
