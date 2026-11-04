/* ============================================================
 * job-library.js — 行业岗位库（可扩展数据模块）
 * ------------------------------------------------------------
 * - 12 个行业方向 + 初始岗位族（产品/运营/设计/市场/商务/金融/
 *   职能/技术/数据/工程/供应链），不写死在 index.html 业务逻辑中
 * - 每个岗位带能力标签与简历匹配关键词，供 JD 智能生成模块做
 *   岗位推荐（主推荐 + 拓展岗位）
 * - 扩展方式：JobLibrary.register(job) / registerIndustry(ind)
 *   （后续可将岗位库下沉到 local_api_config.json 或远程接口，
 *    本模块仅作为初始内置数据与匹配算法宿主）
 * - 纯 JS 无依赖；同时支持浏览器全局与 Node require（测试用）
 * ============================================================ */
(function (root) {
  'use strict';

  /* ---------- 行业 ---------- */
  var INDUSTRIES = [
    { id: 'internet',     name: '互联网与软件服务' },
    { id: 'ai',           name: '人工智能与大模型' },
    { id: 'finance',      name: '金融与银行' },
    { id: 'ecommerce',    name: '电商与零售' },
    { id: 'marketing',    name: '市场营销与广告传媒' },
    { id: 'education',    name: '教育与在线教育' },
    { id: 'health',       name: '医疗健康与生物医药' },
    { id: 'manufacturing',name: '制造业与工业自动化' },
    { id: 'energy',       name: '新能源与汽车' },
    { id: 'gaming',       name: '游戏与数字娱乐' },
    { id: 'hr',           name: '人力资源与企业服务' },
    { id: 'logistics',    name: '物流与供应链' }
  ];

  /* ---------- 岗位 ---------- */
  /* 字段说明：
   * title    标准岗位名称
   * industry 行业 id（对应 INDUSTRIES）
   * family   岗位族：product/ops/design/market/biz/finance/hr/admin/tech/data/eng/supply
   * tech     是否技术岗（用于匹配分析六维权重调整）
   * tags     核心能力标签（推荐卡片展示「已有优势/待提升」）
   * kw       简历匹配关键词（命中越多推荐分越高；正则字符串数组）
   * goal     岗位核心工作目标（一句话，生成 JD 时的锚点）
   */
  var JOBS = [
    /* ===== 互联网与 AI ===== */
    { title: 'AI 产品经理', industry: 'ai', family: 'product', tech: false,
      tags: ['AI 场景挖掘', '用户需求分析', '产品规划', 'Prompt 设计', 'Agent 工作流', '模型能力评估', '数据分析', 'AI 产品迭代'],
      kw: ['AI产品', '大模型', 'LLM', 'AIGC', 'Prompt', 'Agent', '智能体', '模型评估', 'AI应用', '产品规划', '需求分析'],
      goal: '挖掘 AI 技术的应用场景，把大模型能力转化为可落地的产品功能并持续迭代' },
    { title: 'AI 应用产品经理', industry: 'ai', family: 'product', tech: false,
      tags: ['AI 场景挖掘', '需求分析', '产品方案设计', '数据标注与评估', 'Prompt 设计', '跨团队协作', '竞品分析'],
      kw: ['AI产品', 'AI应用', '大模型', 'LLM', '智能体', 'AI落地', '场景设计', '需求分析', '产品方案'],
      goal: '面向具体业务场景设计 AI 应用方案，协调算法与工程团队完成落地' },
    { title: '产品经理', industry: 'internet', family: 'product', tech: false,
      tags: ['需求分析', '产品设计', 'PRD 撰写', '项目管理', '数据分析', '用户研究', '竞品分析', '跨部门协作'],
      kw: ['产品经理', '产品', '需求', 'PRD', '原型', 'Axure', '用户调研', '竞品', '迭代', '产品规划'],
      goal: '识别用户需求并转化为产品方案，推动研发落地并达成业务目标' },
    { title: '产品助理', industry: 'internet', family: 'product', tech: false,
      tags: ['需求收集', '竞品调研', '文档撰写', '原型绘制', '数据整理', '沟通协作'],
      kw: ['产品助理', '产品实习', '需求文档', '竞品', '原型', 'Axure', '墨刀', '产品调研'],
      goal: '协助产品经理完成需求收集、文档撰写与项目跟进等基础工作' },
    { title: '产品运营', industry: 'internet', family: 'ops', tech: false,
      tags: ['用户分析', '活动策划', '数据运营', '内容策划', '渠道维护', '用户反馈处理'],
      kw: ['产品运营', '运营', '活动策划', '用户反馈', '数据运营', '留存', '转化'],
      goal: '通过运营手段提升产品活跃、留存与转化，沉淀运营方法论' },
    { title: '用户运营', industry: 'ecommerce', family: 'ops', tech: false,
      tags: ['用户分层', '社群运营', '活动策划', '用户生命周期管理', '数据分析', '会员体系'],
      kw: ['用户运营', '社群', '用户分层', '会员', '留存', '召回', '生命周期', '私域'],
      goal: '搭建用户分层运营体系，提升用户活跃度、留存与忠诚度' },
    { title: '内容运营', industry: 'marketing', family: 'ops', tech: false,
      tags: ['内容策划', '选题规划', '文案撰写', '数据复盘', '热点跟进', '平台规则理解'],
      kw: ['内容运营', '内容', '文案', '选题', '公众号', '短视频', '小红书', '知乎', '图文'],
      goal: '通过优质内容策划与分发提升品牌曝光与用户粘性' },
    { title: '活动运营', industry: 'ecommerce', family: 'ops', tech: false,
      tags: ['活动策划', '项目推进', '预算管理', '效果复盘', '跨部门协作', '数据分析'],
      kw: ['活动运营', '活动策划', '大促', '营销活动', '裂变', '拉新', '促销'],
      goal: '策划并落地线上活动，达成拉新、促活与转化目标' },
    { title: '商业化运营', industry: 'internet', family: 'ops', tech: false,
      tags: ['商业化策略', '广告变现', '数据分析', '客户沟通', '收入增长', 'AB 实验'],
      kw: ['商业化', '变现', '广告收入', '营收', '付费', '收入增长', '变现效率'],
      goal: '设计并优化产品商业化路径，提升营收与变现效率' },
    { title: '新媒体运营', industry: 'marketing', family: 'ops', tech: false,
      tags: ['账号运营', '内容创作', '涨粉策略', '数据分析', '粉丝互动', '热点营销'],
      kw: ['新媒体', '公众号', '抖音', '小红书', 'B站', '涨粉', '账号', '短视频', '直播'],
      goal: '运营新媒体矩阵账号，持续产出内容并实现粉丝与转化增长' },
    { title: '社区运营', industry: 'internet', family: 'ops', tech: false,
      tags: ['社区氛围建设', 'KOL 维护', '内容审核', '活动策划', '用户激励体系', '舆情处理'],
      kw: ['社区', '论坛', 'KOL', '氛围', 'UGC', '用户激励', '版主'],
      goal: '建设健康活跃的社区生态，提升用户参与度与归属感' },
    { title: '用户增长', industry: 'internet', family: 'ops', tech: false,
      tags: ['增长模型', 'A/B 实验', '漏斗分析', '裂变设计', '渠道分析', '数据驱动'],
      kw: ['增长', 'AARRR', '裂变', '漏斗', 'A/B', 'AB实验', '拉新', '获客', '转化率'],
      goal: '以数据驱动方式设计增长实验，实现用户规模与转化效率提升' },
    { title: '项目经理', industry: 'internet', family: 'product', tech: false,
      tags: ['项目排期', '风险管理', '跨部门协调', '敏捷开发', '资源协调', '交付管理'],
      kw: ['项目管理', '项目经理', '排期', '敏捷', 'Scrum', '里程碑', '风险', '甘特', '交付'],
      goal: '统筹项目计划、进度与风险，保障项目按时高质量交付' },
    { title: '产品设计师', industry: 'internet', family: 'design', tech: false,
      tags: ['产品设计', '交互设计', '视觉表达', '用户研究', '原型设计', '设计规范'],
      kw: ['产品设计', '交互', '原型', 'Figma', 'Sketch', '设计规范', '用户体验'],
      goal: '兼顾产品思维与设计表达，输出兼具体验与商业价值的设计方案' },

    /* ===== 技术与数据 ===== */
    { title: '大模型应用工程师', industry: 'ai', family: 'tech', tech: true,
      tags: ['LLM 应用开发', 'Prompt 工程', 'RAG 检索增强', 'Agent 开发', 'Python', '模型微调', '向量数据库'],
      kw: ['大模型', 'LLM', 'RAG', 'Agent', 'LangChain', '微调', 'Embedding', '向量', 'Prompt', '推理'],
      goal: '基于大模型构建应用与智能体，完成检索增强、工具调用与效果优化' },
    { title: 'AI 算法工程师', industry: 'ai', family: 'tech', tech: true,
      tags: ['机器学习', '深度学习', '模型训练', '论文复现', '数据建模', 'Python', 'PyTorch'],
      kw: ['算法', '机器学习', '深度学习', 'PyTorch', 'TensorFlow', '模型训练', 'NLP', 'CV', '论文'],
      goal: '研发与优化机器学习/深度学习模型，支撑核心业务算法能力' },
    { title: '算法工程师', industry: 'ai', family: 'tech', tech: true,
      tags: ['机器学习', '推荐系统', '数据结构', '工程实现', '离线与在线实验', 'Python'],
      kw: ['算法', '推荐系统', '搜索', '排序', '机器学习', '特征工程', 'CTR'],
      goal: '设计并落地算法策略（推荐/搜索/风控等），持续优化线上效果指标' },
    { title: 'Python 开发工程师', industry: 'internet', family: 'tech', tech: true,
      tags: ['Python', 'Web 框架', '数据库设计', '接口开发', '脚本自动化', '代码规范'],
      kw: ['Python', 'Django', 'Flask', 'FastAPI', '爬虫', '自动化', '后端'],
      goal: '使用 Python 完成服务端功能与自动化工具的开发与维护' },
    { title: 'Java 开发工程师', industry: 'internet', family: 'tech', tech: true,
      tags: ['Java', 'Spring 生态', '微服务', '数据库', '分布式', 'JVM 调优'],
      kw: ['Java', 'Spring', 'SpringBoot', '微服务', 'MyBatis', 'JVM', '分布式', 'Redis'],
      goal: '基于 Java 技术栈开发稳定高效的服务端系统并保障线上质量' },
    { title: '前端开发工程师', industry: 'internet', family: 'tech', tech: true,
      tags: ['HTML/CSS/JS', '前端框架', '组件开发', '接口联调', '性能优化', '工程化'],
      kw: ['前端', 'JavaScript', 'TypeScript', 'React', 'Vue', 'HTML', 'CSS', '组件', 'Webpack', 'Vite'],
      goal: '开发高质量前端页面与组件，保障交互体验与页面性能' },
    { title: '后端开发工程师', industry: 'internet', family: 'tech', tech: true,
      tags: ['服务端开发', '数据库设计', '接口设计', '高并发', '缓存与消息队列', '系统稳定性'],
      kw: ['后端', '服务端', '接口', 'MySQL', 'Redis', '消息队列', '高并发', '分布式', '微服务'],
      goal: '设计并实现服务端业务逻辑与接口，保障系统高可用与高性能' },
    { title: '测试工程师', industry: 'internet', family: 'tech', tech: true,
      tags: ['测试用例设计', '自动化测试', '缺陷管理', '接口测试', '质量保障', '性能测试'],
      kw: ['测试', 'QA', '自动化测试', '用例', 'Selenium', 'Pytest', 'Jmeter', '缺陷'],
      goal: '设计测试方案与用例，保障产品功能与性能质量稳定交付' },
    { title: '数据分析师', industry: 'internet', family: 'data', tech: false,
      tags: ['SQL', 'Python', '统计分析', '数据清洗', '可视化', '指标体系', '业务分析', '决策支持'],
      kw: ['数据分析', 'SQL', 'Python', 'Tableau', 'PowerBI', '指标', '报表', '可视化', '统计', 'BI', 'Excel'],
      goal: '通过数据分析发现业务问题与机会，输出可执行的决策建议' },
    { title: '数据开发工程师', industry: 'internet', family: 'data', tech: true,
      tags: ['数据仓库', 'ETL', 'SQL', '大数据组件', '调度管理', '数据治理'],
      kw: ['数据开发', '数仓', 'ETL', 'Hive', 'Spark', 'Hadoop', 'Flink', 'Kafka', '数据仓库'],
      goal: '建设稳定高效的数据管道与数仓模型，支撑业务数据分析需求' },
    { title: '数据产品经理', industry: 'internet', family: 'product', tech: false,
      tags: ['指标体系设计', '数据产品规划', '需求分析', 'AB 实验', '数据可视化', '跨团队协作'],
      kw: ['数据产品', '指标体系', '埋点', 'BI 平台', '数据可视化', '实验平台'],
      goal: '规划数据类产品（BI/实验/埋点平台等），让数据能力产品化' },

    /* ===== 设计与创意 ===== */
    { title: 'UI 设计师', industry: 'internet', family: 'design', tech: false,
      tags: ['视觉设计', '设计规范', 'Figma', '界面还原度把控', '图标设计', '设计走查'],
      kw: ['UI', '视觉设计', 'Figma', 'Sketch', '图标', '设计规范', '切图', '界面'],
      goal: '输出高质量界面视觉方案并维护设计规范，保障产品视觉一致性' },
    { title: 'UX 设计师', industry: 'internet', family: 'design', tech: false,
      tags: ['用户研究', '交互设计', '可用性测试', '原型设计', '信息架构', '设计交付'],
      kw: ['UX', '用户体验', '交互设计', '可用性', '用户研究', '原型', '信息架构', '用户旅程'],
      goal: '从用户视角优化产品体验流程，提升可用性与满意度' },
    { title: '交互设计师', industry: 'internet', family: 'design', tech: false,
      tags: ['交互方案设计', '原型设计', '用户研究', '设计规范', '跨职能协作', '可用性评估'],
      kw: ['交互', '原型', 'Axure', 'Figma', '流程图', '交互稿', '用户流程'],
      goal: '设计清晰高效的任务流程与交互方案，平衡用户目标与业务目标' },
    { title: '视觉设计师', industry: 'marketing', family: 'design', tech: false,
      tags: ['视觉创意', '海报设计', '品牌视觉', 'PS/AI 工具', '审美能力', '多媒介设计'],
      kw: ['视觉设计', '海报', 'PS', 'Photoshop', 'Illustrator', '创意', '主视觉', 'KV'],
      goal: '产出符合品牌调性的视觉创意物料，支撑营销与品牌表达' },
    { title: '平面设计师', industry: 'marketing', family: 'design', tech: false,
      tags: ['平面设计', '排版设计', '品牌物料', '印刷知识', 'PS/AI', '创意执行'],
      kw: ['平面设计', '排版', '画册', '物料', '印刷', 'Logo', 'VI'],
      goal: '完成品牌与营销所需的平面物料设计与排版执行' },
    { title: '用户研究员', industry: 'internet', family: 'design', tech: false,
      tags: ['用户访谈', '问卷设计', '可用性测试', '数据分析', '研究报告', '洞察输出'],
      kw: ['用户研究', '访谈', '问卷', '定性', '定量', '可用性测试', '调研报告', ' ethnography'],
      goal: '通过定性定量研究方法洞察用户需求，为产品决策提供依据' },

    /* ===== 市场与商务 ===== */
    { title: '市场营销', industry: 'marketing', family: 'market', tech: false,
      tags: ['市场调研', '用户洞察', '营销策划', '渠道运营', '活动执行', '营销数据分析'],
      kw: ['市场营销', '市场', '营销', '品牌', '活动', '渠道', '调研', '推广'],
      goal: '策划并执行市场营销活动，提升品牌认知与获客效率' },
    { title: '品牌策划', industry: 'marketing', family: 'market', tech: false,
      tags: ['品牌策略', '内容策划', '传播方案', '创意提案', '公关协调', '效果评估'],
      kw: ['品牌', '策划', '传播', '公关', 'Slogan', '调性', 'Campaign'],
      goal: '制定品牌策略与传播方案，建立并强化品牌心智' },
    { title: '广告投放专员', industry: 'marketing', family: 'market', tech: false,
      tags: ['投放策略', '素材优化', 'ROI 分析', '投放平台操作', '数据监控', '人群定向'],
      kw: ['投放', '信息流', '巨量', '千川', '广点通', 'ROI', 'CPA', '素材', '优化师'],
      goal: '管理广告投放计划，持续优化素材与定向以达成投放 ROI 目标' },
    { title: '商务拓展', industry: 'internet', family: 'biz', tech: false,
      tags: ['商务谈判', '渠道拓展', '客户关系管理', '方案撰写', '合同管理', '行业资源'],
      kw: ['商务', 'BD', '拓展', '合作', '渠道', '谈判', '客户', '签约'],
      goal: '拓展并维护合作伙伴关系，达成合作签约与业务增长目标' },
    { title: '销售顾问', industry: 'ecommerce', family: 'biz', tech: false,
      tags: ['客户开发', '销售话术', '需求挖掘', '成单转化', '客户维护', '目标达成'],
      kw: ['销售', '客户开发', '成单', '签单', '业绩', '转化', '跟进', 'CRM'],
      goal: '开发并维护客户，通过专业咨询式销售达成业绩目标' },
    { title: '客户成功经理', industry: 'hr', family: 'biz', tech: false,
      tags: ['客户管理', '续约增购', '需求诊断', '培训交付', '健康度管理', '跨部门协同'],
      kw: ['客户成功', '续约', '增购', 'SaaS', '客户满意度', 'NPS', '交付培训'],
      goal: '保障客户顺利使用并持续获得价值，驱动续约与增购增长' },

    /* ===== 金融 ===== */
    { title: '金融分析师', industry: 'finance', family: 'finance', tech: false,
      tags: ['财务建模', '行业研究', '估值分析', '报告撰写', '数据获取与处理', 'Excel'],
      kw: ['金融', '估值', '财务模型', '行业研究', '投资', '尽调', 'DCF', '研报'],
      goal: '通过行业与财务分析输出投资研究结论，支持投资决策' },
    { title: '风险控制专员', industry: 'finance', family: 'finance', tech: false,
      tags: ['风险评估', '信贷审核', '数据分析', '政策理解', '反欺诈识别', '报告输出'],
      kw: ['风控', '风险', '信贷', '反欺诈', '审核', '授信', '合规', '逾期'],
      goal: '识别与评估业务风险，制定并执行风控策略保障资产质量' },
    { title: '会计', industry: 'finance', family: 'finance', tech: false,
      tags: ['账务处理', '报表编制', '税务知识', 'Excel', '细心严谨', '准则理解'],
      kw: ['会计', '账务', '凭证', '报表', '税务', '财务', '核算', 'CPA', '初级会计'],
      goal: '准确完成账务核算与报表编制，保障财务数据真实合规' },

    /* ===== 人力资源与行政 ===== */
    { title: '人力资源专员', industry: 'hr', family: 'hr', tech: false,
      tags: ['招聘执行', '员工关系', '薪酬社保', '培训组织', '沟通协调', '制度执行'],
      kw: ['人力资源', 'HR', '招聘', '员工关系', '薪酬', '绩效', '培训', '六大模块'],
      goal: '支持人力资源各模块日常工作，保障组织人才供给与员工体验' },
    { title: '招聘专员', industry: 'hr', family: 'hr', tech: false,
      tags: ['简历筛选', '面试邀约', '渠道运营', '人才寻访', '沟通协调', '数据统计'],
      kw: ['招聘', '简历', '邀约', '面试安排', '猎聘', 'BOSS', '人才寻访', 'offer'],
      goal: '高效执行招聘流程，为业务部门及时输送合格人才' },
    { title: '行政专员', industry: 'hr', family: 'admin', tech: false,
      tags: ['行政事务', '资产管理', '会务组织', '文档管理', '供应商对接', '细致耐心'],
      kw: ['行政', '后勤', '会务', '资产', '办公用品', '前台', '证照'],
      goal: '保障公司日常行政事务高效运转，支持团队办公体验' },

    /* ===== 制造 / 电气 / 供应链 ===== */
    { title: '机械工程师', industry: 'manufacturing', family: 'eng', tech: true,
      tags: ['机械设计', 'CAD/SolidWorks', '工艺知识', '图纸标准化', '公差配合', '项目跟进'],
      kw: ['机械', 'CAD', 'SolidWorks', 'UG', 'ProE', '图纸', '工艺', '结构设计', '非标'],
      goal: '完成机械结构与设备的设计、仿真与落地验证，支撑产品量产' },
    { title: '电气工程师', industry: 'manufacturing', family: 'eng', tech: true,
      tags: ['电气设计', 'PLC 编程', '电路图', '电气标准', '调试能力', 'AutoCAD Electrical'],
      kw: ['电气', 'PLC', '电路', '变频器', '伺服', '继电', 'EPLAN', '强电', '弱电'],
      goal: '负责电气系统设计与调试，保障设备安全稳定运行' },
    { title: '供应链管理', industry: 'logistics', family: 'supply', tech: false,
      tags: ['需求计划', '库存管理', '供应商管理', '成本优化', '数据分析', '跨部门协调'],
      kw: ['供应链', '库存', '采购计划', 'S&OP', '周转', '补货', '供应商', '履约'],
      goal: '统筹计划、采购与库存策略，平衡供应成本与服务水平' },
    { title: '采购专员', industry: 'manufacturing', family: 'supply', tech: false,
      tags: ['供应商寻源', '比价议价', '合同执行', '订单跟进', '质量协同', '成本意识'],
      kw: ['采购', '寻源', '比价', '议价', '订单', '供应商开发', '招标'],
      goal: '执行采购全流程，在保证质量与交期的前提下优化采购成本' },

    /* ===== 教育 / 医疗 / 能源 / 游戏（补充行业覆盖） ===== */
    { title: '课程运营', industry: 'education', family: 'ops', tech: false,
      tags: ['课程运营', '学员服务', '社群管理', '转化率优化', '数据复盘', '内容策划'],
      kw: ['课程', '学员', '教育', '续费', '完课率', '教培', '班主任'],
      goal: '运营课程产品全生命周期，提升学员完课率、续费与口碑' },
    { title: '医药代表', industry: 'health', family: 'biz', tech: false,
      tags: ['客户拜访', '产品知识', '合规意识', '目标管理', '关系维护', '学术推广'],
      kw: ['医药', '药品', '医院', '学术推广', '拜访', '合规'],
      goal: '在合规前提下推广公司药品，达成区域销售目标' },
    { title: '电池工程师', industry: 'energy', family: 'eng', tech: true,
      tags: ['电化学基础', '电池测试', '数据分析', '工艺改善', '失效分析', '实验设计'],
      kw: ['电池', '锂电', '电芯', '充放电', 'BMS', '能量密度', '电解液'],
      goal: '负责电池产品开发、测试与工艺优化，提升能量密度与安全性' },
    { title: '游戏策划', industry: 'gaming', family: 'product', tech: false,
      tags: ['玩法设计', '数值设计', '关卡设计', '玩家心理', '竞品拆解', '文档能力'],
      kw: ['游戏', '策划', '玩法', '数值', '关卡', '系统设计', '拆解', '电竞'],
      goal: '设计游戏玩法与系统，打磨体验并支撑留存与付费目标' }
  ];

  /* ---------- 内部工具 ---------- */
  function esc(s){ return String(s==null?'':s); }
  function industryName(id){
    for (var i=0;i<INDUSTRIES.length;i++) if (INDUSTRIES[i].id===id) return INDUSTRIES[i].name;
    return id || '';
  }
  function getJob(title){
    var t = String(title||'').trim().toLowerCase();
    for (var i=0;i<JOBS.length;i++) if (JOBS[i].title.toLowerCase()===t) return JOBS[i];
    // 模糊：包含关系（如「高级产品经理」匹配「产品经理」）
    for (var j=0;j<JOBS.length;j++){
      var jt = JOBS[j].title.toLowerCase();
      if (t.indexOf(jt)>=0 || jt.indexOf(t)>=0) return JOBS[j];
    }
    return null;
  }
  function hitsKeyword(text, kw){
    try { return new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text); }
    catch(e){ return text.indexOf(kw)>=0; }
  }

  /* 简历技能字段 → 扁平字符串（兼容 parsedResume.skills 与自填技能） */
  function collectResumeSkills(parsed){
    var out=[];
    if (parsed && Array.isArray(parsed.skills)) out = out.concat(parsed.skills.map(esc));
    return out.map(function(s){ return String(s).trim(); }).filter(Boolean);
  }

  /* ---------- 推荐 ----------
   * text         简历原文或 resumeToText 产物
   * parsedResume 结构化简历（可空）
   * opts.topN    返回岗位数（默认 5，范围 3–5 由调用方约束）
   * 返回 { jobs:[...], primaryCount }，jobs 内含：
   *   job_title/industry/industry_name/match_score/recommend_reason/
   *   advantages/gaps/is_primary/recommend_type
   */
  function recommend(text, parsedResume, opts){
    opts = opts || {};
    var topN = opts.topN || 5;
    var t = String(text||'');
    var tFlat = t.replace(/\s+/g,'');           // 去空格版本：兼容「AI 产品经理」与「AI产品经理」
    var skills = collectResumeSkills(parsedResume);
    var skillBlob = skills.join(' ').toLowerCase();
    var projectsBlob = parsedResume && Array.isArray(parsedResume.projects)
      ? parsedResume.projects.map(function(p){ return esc(p.name)+' '+esc(p.desc); }).join(' ') : '';
    var eduBlob = parsedResume ? esc(parsedResume.education) : '';
    var expBlob = parsedResume ? esc(parsedResume.experience)+' '+esc(parsedResume.title) : '';
    var selfTitle = parsedResume ? String(parsedResume.title||'').replace(/\s+/g,'') : '';

    /* 关键词命中：原文 或 去空格文本任一命中即算 */
    function hit(kw){
      if (hitsKeyword(t, kw)) return true;
      var flatKw = String(kw).replace(/\s+/g,'');
      return flatKw && hitsKeyword(tFlat, flatKw);
    }

    var scored = JOBS.map(function(j){
      var hits = [];
      j.kw.forEach(function(k){
        if (hit(k)) hits.push(k);
      });
      // 命中权重：标题类关键词 > 普通关键词；技能字段命中额外加分
      var score = hits.length * 12;
      hits.forEach(function(h){
        if (skillBlob && hitsKeyword(skillBlob, h)) score += 6;
        if (projectsBlob && hitsKeyword(projectsBlob, h)) score += 4;
      });
      // 能力标签与简历技能的交叉
      var advantages = j.tags.filter(function(tag){
        return skills.some(function(s){ return tag.toLowerCase().indexOf(s.toLowerCase())>=0 || s.toLowerCase().indexOf(tag.toLowerCase())>=0; });
      });
      score += advantages.length * 5;
      // 简历自述岗位与目标岗位一致 → 强加权（不只看专业名称，仍以经历/技能为主体）
      var flatJob = j.title.replace(/\s+/g,'');
      var titleExact = !!selfTitle && selfTitle===flatJob;
      var titlePartial = !!selfTitle && !titleExact && (selfTitle.indexOf(flatJob)>=0 || flatJob.indexOf(selfTitle)>=0);
      if (titleExact) score += 30;
      else if (titlePartial) score += 14;
      // 教育/经历字段轻量加权（避免只凭专业名称推岗）
      if (eduBlob && j.kw.some(function(k){ return hitsKeyword(eduBlob, k); })) score += 3;
      if (expBlob && j.kw.some(function(k){ return hitsKeyword(expBlob, k); })) score += 4;

      var gaps = j.tags.filter(function(tag){ return advantages.indexOf(tag)<0; }).slice(0,4);
      var isPrimary = hits.length >= 3 || (hits.length >= 2 && advantages.length >= 1) || titleExact;
      var reason = titleExact
        ? '简历自述岗位与该岗位一致，且体现「' + hits.slice(0,3).join('、') + '」等能力信号'
        : (hits.length
          ? '简历中体现「' + hits.slice(0,3).join('、') + '」等相关信号，与该岗位能力模型吻合'
          : '能力标签与简历技能存在交叉，可作为拓展方向');
      return {
        job_title: j.title,
        industry: j.industry,
        industry_name: industryName(j.industry),
        family: j.family,
        tech: !!j.tech,
        match_score: Math.max(5, Math.min(98, score)),
        recommend_reason: reason,
        advantages: advantages.slice(0,4),
        gaps: gaps,
        is_primary: isPrimary,
        recommend_type: isPrimary ? '主推荐' : '拓展岗位'
      };
    });

    scored.sort(function(a,b){ return b.match_score - a.match_score; });

    // 主推荐优先，同岗位族内避免扎堆；拓展岗位补充行业/职能多样性
    var primary=[], expanded=[];
    var seenFamily = {};
    scored.forEach(function(r){
      if (r.is_primary && primary.length < 3) { primary.push(r); seenFamily[r.family]=1; }
    });
    scored.forEach(function(r){
      if (primary.indexOf(r)>=0) return;
      if (expanded.length >= topN - primary.length) return;
      // 拓展岗优先补不同族，保证候选多样性
      if (seenFamily[r.family] && expanded.length < topN - primary.length - 1) return;
      expanded.push(r); seenFamily[r.family]=1;
    });
    var jobs = primary.concat(expanded).slice(0, topN);
    // 分数归一化排序展示
    jobs.sort(function(a,b){ return b.match_score - a.match_score; });
    // 标签与实际入选位置对齐（主推荐 ≤3，其余为拓展岗位）
    jobs.forEach(function(j){ j.recommend_type = primary.indexOf(j)>=0 ? '主推荐' : '拓展岗位'; });
    return { jobs: jobs, primaryCount: primary.length };
  }

  /* 按岗位族聚合（供「编辑岗位」下拉 / 行业筛选） */
  function listByIndustry(industryId){
    return JOBS.filter(function(j){ return !industryId || j.industry===industryId; });
  }
  function allTitles(){
    return JOBS.map(function(j){ return j.title; });
  }

  /* 扩展接口：运行时注册新行业/新岗位（后续可接入远程岗位库） */
  function registerIndustry(ind){ if(ind&&ind.id&&ind.name&&INDUSTRIES.indexOf(ind)<0) INDUSTRIES.push(ind); }
  function register(job){
    if(!job||!job.title) return false;
    if(getJob(job.title)) return false;
    JOBS.push({
      title:String(job.title),
      industry:job.industry||'internet',
      family:job.family||'product',
      tech:!!job.tech,
      tags:Array.isArray(job.tags)?job.tags:[],
      kw:Array.isArray(job.kw)?job.kw:[],
      goal:job.goal||''
    });
    return true;
  }

  var API = {
    INDUSTRIES: INDUSTRIES,
    JOBS: JOBS,
    industryName: industryName,
    getJob: getJob,
    recommend: recommend,
    listByIndustry: listByIndustry,
    allTitles: allTitles,
    register: register,
    registerIndustry: registerIndustry
  };

  root.JobLibrary = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
