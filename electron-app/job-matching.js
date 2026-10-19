/* =====================================================================
 * job-matching.js
 * 跨行业、证据驱动的「岗位推荐 + 匹配评分」引擎
 *
 * 设计原则（严格遵循本次需求）：
 *  1. 岗位候选来自「简历证据」，不来自应用定位/热门行业/预设白名单。
 *  2. 不把「AI / 互联网 / 产品经理」设为默认或优先方向。
 *  3. 匹配分数 = 6 维度加权，由本文件（代码）计算；LLM 只提供
 *     「各维度的证据 + 分项评分」，不得直接给出最终总分。
 *  4. 不做统一加分、不做最低分兜底、不做强制归一化。
 *  5. match_score / confidence / evidence_coverage 三者分离。
 *  6. 缺失硬性要求（证书/资格）必须扣分，必要时标记「暂不推荐」。
 *  7. 简历信息不足时降低置信度，而不是用高分掩盖不确定性。
 *
 * 用法（浏览器）：<script src="job-matching.js"></script> → window.JobMatching
 * 用法（Node）  ：const JobMatching = require('./job-matching.js')
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.JobMatching = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ========================= 1. 可配置权重 ========================= */
  /* 说明：这是项目「初始假设」，不是经过验证的行业标准，集中在此便于后续用测试调整 */
  var DEFAULT_WEIGHTS = {
    core_skill:       0.34,  // 核心专业技能匹配（提高：相关性主导评分）
    task_project:     0.28,  // 工作任务与项目职责匹配（提高）
    domain_knowledge: 0.18,  // 专业知识与行业相关性（提高）
    depth_evidence:   0.10,  // 经历深度及成果证据（降低：与岗位是否匹配无关，仅作辅助）
    education_cert:   0.05,  // 教育背景、证书及岗位硬性要求（降低：与岗位是否匹配无关，仅作辅助）
    intent:           0.05   // 用户明确的求职意向
  };

  var DIM_LABELS = {
    core_skill:       '核心专业技能匹配',
    task_project:     '工作任务与项目职责匹配',
    domain_knowledge: '专业知识与行业相关性',
    depth_evidence:   '经历深度及成果证据',
    education_cert:   '教育背景、证书及岗位硬性要求',
    intent:           '用户明确的求职意向'
  };

  /* 评分区间：仅用于解释本项目内部评分，不代表真实招聘成功率 */
  var SCORE_BANDS = [
    { min: 80, label: '强匹配',   desc: '关键岗位要求有充分的简历证据支持' },
    { min: 65, label: '较匹配',   desc: '大部分核心要求有证据支持，但仍存在明显缺口' },
    { min: 45, label: '部分匹配', desc: '存在一定相关能力，但核心要求仍有较大缺失' },
    { min: 0,  label: '弱匹配',   desc: '简历证据不足或与岗位要求存在明显差距' }
  ];

  /* 扣罚配置（可调整） */
  var PENALTY = {
    missingHardCert: 15,   // 每缺失一项硬性证书/资格，在最终分上扣分
    hardCertCap: 55,       // 硬性要求全缺时，最终分上限
    weakEvidenceCap: 70,   // 核心技能无强证据（只有弱证据）时的分数上限
    insufficientCap: 60    // 简历信息不足时的分数上限
  };

  /* 满分基准：达到该数量的「证据项」即认为该维度证据充分。
   * 注意：分类词典里的 core/tasks 是「信号词典」（尽量全），
   * 直接拿全表当清单会导致分数被系统性压低（无人能命中 30 项），
   * 因此评分以配置的「关键要求数量」为分母（可随测试调整）。 */
  var EXPECT = {
    core: 8,    // 核心专业技能：8 项强证据 → 维度满分
    tasks: 6,   // 工作任务/职责：6 项强证据 → 维度满分
    domain: 4   // 领域/行业知识：4 项强证据 → 维度满分
  };

  /* 通用职场动词 / 通用领域词：几乎任何中文简历都会出现，不能作为「跨行业判别证据」。
   * 用于 (1) 方向识别时剔除这些词贡献的强度；(2) 逐岗位评分时从 task/domain 维度剔除，
   * 避免机械/财务等简历因写了「推动方案、协调项目、复盘」而被误判为产品经理。 */
  var GENERIC_TASK_WORDS = [
    '需求', '规划', '迭代', '推动', '协调', '调研', '方案', '上线', '验收', '复盘',
    '跟进', '落地', '推进', '优化', '负责', '主导', '参与', '输出', '报告', '制定',
    '撰写', '沟通', '执行', '配合', '支持', '搭建', '实施', '开展', '完成', '处理', '落实'
  ];
  var GENERIC_DOMAIN_WORDS = ['产品', '业务'];

  function bandOf(score) {
    for (var i = 0; i < SCORE_BANDS.length; i++) {
      if (score >= SCORE_BANDS[i].min) return SCORE_BANDS[i];
    }
    return SCORE_BANDS[SCORE_BANDS.length - 1];
  }

  /* ========================= 2. 证书/资格词典 ========================= */
  /* 硬性要求：命中即视为「已满足」；未命中且岗位要求 → 扣分 */
  var CERT_DICT = {
    '教师资格证':   ['教师资格证', '教资', '教师资格'],
    '法律职业资格': ['法律职业资格', '司法考试', '法考'],
    '注册会计师':   ['注册会计师', 'CPA'],
    '会计职称':     ['初级会计', '中级会计', '高级会计', '会计职称', '会计从业'],
    '执业医师资格': ['执业医师', '医师资格'],
    '执业药师资格': ['执业药师', '药师资格'],
    'PMP':          ['PMP'],
    '英语六级':     ['六级', 'CET-6', 'CET6'],
    '雅思托福':     ['雅思', 'IELTS', '托福', 'TOEFL'],
    'CATTI':        ['CATTI', '翻译资格'],
    '计算机等级':   ['计算机二级', '计算机三级', '计算机等级'],
    '软考':         ['软考', '计算机技术与软件', '系统集成项目管理工程师']
  };

  /* ========================= 3. 开放式职业分类 ========================= */
  /* 说明：分类用于「帮助生成候选岗位」，不是封闭白名单；允许按简历动态扩展。
   * 覆盖需求要求的 10+ 类别，另外补充法律/科研/物流/农业等专业领域。 */
  var CAREER_FAMILIES = [
    {
      id: 'software', industry: '互联网与软件',
      titles: [
        { name: '软件开发工程师' },
        { name: '前端开发工程师', extra: ['React', 'Vue', 'TypeScript', 'CSS', 'Webpack'] },
        { name: '测试工程师',     extra: ['测试用例', '自动化测试', 'Selenium', '缺陷管理', '回归测试'] },
        { name: '运维/技术支持工程师', extra: ['Linux', 'Docker', 'Kubernetes', '监控', '故障排查'] }
      ],
      core: ['Java', 'Python', 'Go', 'C++', 'JavaScript', 'TypeScript', 'React', 'Vue',
             'Spring', 'Node', '微服务', '数据结构', '算法', 'Git', 'Linux', 'Docker',
             'Kubernetes', 'SQL', 'REST', 'API', 'MySQL', 'Redis'],
      tasks: ['开发', '编码', '实现', '接口', '调试', '单元测试', '代码评审', '部署',
              '运维', '测试', '缺陷', '需求分析', '系统设计', '性能优化', '重构'],
      domain: ['软件', '互联网', '系统', '架构', '服务端', '客户端', '分布式', '高并发', '编程'],
      edu: '本科及以上，计算机/软件相关优先'
    },
    {
      id: 'ai_data', industry: 'AI 与数据',
      titles: [
        { name: '数据分析师' },
        { name: '算法工程师',     extra: ['机器学习', '深度学习', 'PyTorch', 'TensorFlow', '模型训练'] },
        { name: '数据工程师',     extra: ['ETL', '数据仓库', 'Spark', 'Hadoop', '数据管道'] },
        { name: '大模型应用工程师', extra: ['LLM', '大模型', 'Prompt', 'RAG', 'Agent', '微调'] }
      ],
      core: ['Python', '机器学习', '深度学习', 'LLM', '大模型', 'NLP', 'CV', 'PyTorch',
             'TensorFlow', 'SQL', 'Spark', 'Hadoop', '数据挖掘', '统计', '特征工程',
             'RAG', '微调', 'Prompt', 'A/B', 'Tableau', 'BI'],
      tasks: ['建模', '训练', '调参', '评估', '数据清洗', '特征', '指标', '看板',
              '实验', '挖掘', '预测', '可视化', '分析报告'],
      domain: ['算法', '数据', '人工智能', '模型', '数据平台', '数仓', '机器学习'],
      edu: '本科及以上，数学/统计/计算机相关优先'
    },
    {
      id: 'product_pm', industry: '产品与项目',
      titles: [
        { name: '产品经理' },
        { name: '项目管理',     extra: ['PMP', 'Scrum', '敏捷', '里程碑', '甘特图', '风险管理'] },
        { name: '项目助理',     extra: ['会议纪要', '进度跟踪', '文档', '协调'] }
      ],
      core: ['需求分析', 'PRD', '原型', 'Axure', 'Figma', '用户研究', '竞品分析',
             '产品设计', '产品策略', '路线图', '敏捷', 'Scrum', '项目管理', 'PMP',
             'OKR', '数据驱动', 'A/B', '埋点'],
      tasks: ['需求', '规划', '迭代', '推动', '协调', '调研', '方案', '上线', '验收', '复盘'],
      domain: ['产品', '业务', '用户体验', '商业化', '互联网'],
      edu: '本科及以上'
    },
    {
      id: 'design', industry: '设计与创意',
      titles: [
        { name: '平面/视觉设计师' },
        { name: 'UI 设计师',  extra: ['Figma', 'Sketch', '交互', '界面', '组件库'] },
        { name: '工业设计师',  extra: ['SolidWorks', 'Rhino', 'Keyshot', '建模', '渲染', '手板'] },
        { name: '内容创作/新媒体设计', extra: ['短视频', '剪辑', 'Pr', 'Ae', '公众号', '排版'] }
      ],
      /* 注意：CAD / SolidWorks / Rhino / Keyshot 已移到「工业设计师」的 extra，
       * 否则机械/工程类简历会因为会用 CAD 而被误判为设计岗。 */
      core: ['Photoshop', 'Illustrator', 'Figma', 'Sketch', 'C4D', 'InDesign', '手绘',
             '版式', '配色', '视觉', '品牌', '包装', '作品集', '渲染', '剪辑'],
      tasks: ['设计', '排版', '出图', '效果图', '渲染', '打样', '视觉规范', '创意', '提案', '改稿'],
      domain: ['设计', '视觉', '品牌', '广告', '工业设计', '产品设计', '文创'],
      hardCerts: [],
      edu: '大专及以上，设计相关专业优先'
    },
    {
      id: 'biz_ops', industry: '商业与运营',
      titles: [
        { name: '市场营销专员' },
        { name: '销售/客户成功', extra: ['客户', 'CRM', '签约', '回款', '谈判', '客户维护'] },
        { name: '运营专员',     extra: ['社群', '活动', '留存', '转化', '内容运营'] },
        { name: '品牌传播',     extra: ['品牌', '公关', '媒体', '文案', '传播'] }
      ],
      core: ['市场营销', '品牌', '策划', '文案', '销售', '客户', 'CRM', '渠道',
             '推广', 'SEO', 'SEM', '社群', '活动', '转化', '留存', '增长',
             '商务', '谈判', '招投标', '抖音', '小红书'],
      tasks: ['推广', '获客', '转化', '维护客户', '策划活动', '撰写文案', '谈判',
              '签约', '回访', '运营', '投放'],
      domain: ['市场', '营销', '销售', '电商', '品牌', '客户', '渠道'],
      edu: '大专及以上'
    },
    {
      id: 'finance_admin', industry: '财务与行政',
      titles: [
        { name: '会计' },
        { name: '财务分析师',   extra: ['财务分析', '预算', '成本核算', '经营分析', '建模'] },
        { name: '审计',         extra: ['审计', '内控', '底稿', '年审', '合规检查'] },
        { name: '人力资源专员',  extra: ['招聘', '绩效', '薪酬', '培训', '社保', '入离职'] },
        { name: '行政专员',     extra: ['行政', '档案', '会议', '办公', '后勤'] }
      ],
      core: ['会计', '财务', '审计', '税务', '报表', '记账', '凭证', 'Excel', 'ERP',
             '用友', '金蝶', 'SAP', '成本核算', '预算', '财务分析', '对账', '开票',
             '招聘', '绩效', '薪酬', '培训', '社保', '劳动合同'],
      tasks: ['记账', '报税', '对账', '编制报表', '审计', '核算', '预算', '招聘',
              '入离职', '发薪', '培训', '行政', '档案', '报销'],
      domain: ['财务', '会计', '审计', '税务', '人力', '行政', 'HR'],
      edu: '大专及以上，财会相关专业优先'
    },
    {
      id: 'education', industry: '教育与语言',
      titles: [
        { name: '学科教师' },
        { name: '教研/课程设计', extra: ['教研', '课程设计', '教案', '课件', '教材'] },
        { name: '培训讲师',     extra: ['培训', '授课', '内训', '讲师'] },
        { name: '翻译',         extra: ['笔译', '口译', '翻译', '本地化'] }
      ],
      core: ['教学', '备课', '授课', '课堂管理', '课程设计', '教研', '教案', '学科知识',
             '普通话', '家教', '辅导', '培训', '翻译', '口译', '笔译', '课件'],
      tasks: ['授课', '备课', '批改', '辅导', '教研', '课程开发', '培训', '翻译', '讲题'],
      domain: ['教育', '培训', '学校', '学科', '语言', '教学'],
      edu: '本科及以上，师范/相关专业优先'
    },
    {
      id: 'engineering_mfg', industry: '工程与制造',
      titles: [
        { name: '机械设计工程师' },
        { name: '电气/自动化工程师', extra: ['PLC', '电气', '电路', '梯形图', '伺服', '变频'] },
        { name: '质量工程师',       extra: ['ISO9001', 'FMEA', 'SPC', '六西格玛', '质检', '不良'] },
        { name: '生产工艺工程师',    extra: ['工艺', '工装', '夹具', 'CNC', '产线', '试制'] }
      ],
      core: ['CAD', 'SolidWorks', 'AutoCAD', '机械制图', '机械设计', '有限元', 'ANSYS',
             'PLC', '电气', '电路', '自动化', '液压', '气动', '公差', 'GD&T',
             '工艺', '工装', '夹具', 'CNC', '数控', '质量管理', 'ISO9001', '六西格玛',
             'FMEA', 'SPC', '生产', '设备', '装配', '材料'],
      tasks: ['制图', '设计', '建模', '仿真', '装配', '调试', '工艺编制', '设备维护',
              '质检', '改善', '产线', '试制', '选型', '出图'],
      domain: ['机械', '制造', '汽车', '重工', '设备', '自动化', '产线', '工厂', '模具'],
      edu: '大专及以上，机械/电气/自动化相关优先'
    },
    {
      id: 'medical_bio', industry: '医疗与生命科学',
      titles: [
        { name: '临床医师/医技', hardCerts: ['执业医师资格'] },
        { name: '药师',         extra: ['药理', '处方', '配药', 'GSP'], hardCerts: ['执业药师资格'] },
        { name: '实验室技术员',  extra: ['PCR', 'ELISA', '细胞', '试剂', '离心', '培养'] },
        { name: '医学支持/CRA',  extra: ['GCP', 'CRA', '临床试验', '受试者', '注册'] }
      ],
      core: ['临床', '诊断', '治疗', '病历', '护理', '药学', '药理', 'GLP', 'GMP',
             '实验', '细胞', 'PCR', 'ELISA', '试剂', '检验', '医学', '药物', '注册',
             'CRA', 'GCP', '解剖', '生理'],
      tasks: ['诊疗', '查房', '处方', '配药', '检验', '实验操作', '数据分析',
              '受试者', '注册申报', '采样'],
      domain: ['医疗', '医药', '医院', '生物', '实验室', '临床', '制药'],
      edu: '本科及以上，医学/药学/生物相关'
    },
    {
      id: 'legal', industry: '法律',
      titles: [
        { name: '法务专员',   hardCerts: ['法律职业资格'] },
        { name: '律师助理',   extra: ['诉讼', '案卷', '开庭', '律所'], hardCerts: ['法律职业资格'] },
        { name: '合规专员',   extra: ['合规', '内控', '反洗钱', '风险'] }
      ],
      core: ['法律', '法学', '合同', '诉讼', '合规', '法务', '民法', '公司法',
             '劳动法', '知识产权', '起草', '审查'],
      tasks: ['起草合同', '审核', '诉讼', '合规审查', '法律咨询', '尽调', '仲裁'],
      domain: ['法律', '法务', '合规', '律所', '司法'],
      edu: '本科及以上，法学相关'
    },
    {
      id: 'logistics_supply', industry: '物流与供应链',
      titles: [
        { name: '供应链专员' },
        { name: '采购专员',   extra: ['采购', '供应商', '询价', '比价', '招投标'] },
        { name: '仓储/物流运营', extra: ['WMS', 'TMS', '仓储', '配送', '库存', '运输'] }
      ],
      core: ['供应链', '采购', '物流', '仓储', 'WMS', 'TMS', '库存', '报关',
             '运输', '配送', 'ERP', '供应商管理', '招投标', '订单', '跟单'],
      tasks: ['采购', '下单', '跟单', '仓储', '配送调度', '供应商', '清关', '库存管理', '盘点'],
      domain: ['物流', '供应链', '采购', '仓储', '运输', '贸易'],
      edu: '大专及以上'
    },
    {
      id: 'research', industry: '科研',
      titles: [
        { name: '研究员' },
        { name: '科研助理', extra: ['文献', '实验', '数据整理', '课题组'] }
      ],
      core: ['科研', '论文', 'SCI', '课题', '实验设计', '文献', '基金', '专利', '学术'],
      tasks: ['文献调研', '实验', '撰写论文', '申报课题', '数据分析', '学术交流'],
      domain: ['科研', '学术', '高校', '研究所', '实验室'],
      edu: '硕士及以上优先'
    },
    {
      id: 'agri', industry: '农业及其他专业领域',
      titles: [
        { name: '农艺师' },
        { name: '园艺/种植技术员', extra: ['园艺', '种植', '育苗', '温室'] },
        { name: '畜牧兽医',       extra: ['兽医', '养殖', '防疫', '畜牧'] }
      ],
      core: ['农学', '园艺', '植保', '土壤', '作物', '畜牧', '兽医', '养殖',
             '种子', '肥料', '病虫害', '灌溉'],
      tasks: ['种植', '田间管理', '病虫害防治', '检验', '养殖', '防疫', '育苗'],
      domain: ['农业', '种植', '养殖', '农垦', '园林'],
      edu: '大专及以上，农学/园艺/畜牧相关'
    }
  ];

  /* ========================= 4. 工具函数 ========================= */
  function lc(s) { return String(s == null ? '' : s).toLowerCase(); }

  function countOf(text, kw) {
    var ls = lc(text), lk = lc(kw), c = 0, i = 0, step = lk.length || 1;
    if (!lk) return 0;
    while ((i = ls.indexOf(lk, i)) !== -1) { c++; i += step; }
    return c;
  }

  function has(text, kw) { return countOf(text, kw) > 0; }

  /* 抓取包含关键词的一小段原文作为「证据片段」 */
  function snippet(text, kw, radius) {
    radius = radius || 28;
    var idx = lc(text).indexOf(lc(kw));
    if (idx === -1) return '';
    var s = Math.max(0, idx - radius);
    var e = Math.min(text.length, idx + kw.length + radius);
    var raw = text.slice(s, e).replace(/[\r\n]+/g, ' ').trim();
    return (s > 0 ? '…' : '') + raw + (e < text.length ? '…' : '');
  }

  function uniq(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
      var k = String(arr[i]);
      if (!seen[k]) { seen[k] = 1; out.push(arr[i]); }
    }
    return out;
  }

  /* 划分简历段落（用于把「技能」「项目」「教育」区分开） */
  function splitSections(text) {
    var sec = { education: '', experience: '', project: '', skill: '', cert: '', intent: '', other: '' };
    var lines = String(text || '').split(/[\r\n]+/);
    var cur = 'other';
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i] || '';
      var t = l.trim();
      if (!t) continue;
      if (/^(教育背景|教育经历|学历|Education)/i.test(t)) { cur = 'education'; continue; }
      if (/^(工作经历|实习经历|工作经验|任职经历|Experience)/i.test(t)) { cur = 'experience'; continue; }
      if (/^(项目经历|项目经验|Projects)/i.test(t)) { cur = 'project'; continue; }
      if (/^(专业技能|技能特长|技能|Skills)/i.test(t)) { cur = 'skill'; continue; }
      if (/^(证书|资格证书|资格认证|Certifications)/i.test(t)) { cur = 'cert'; continue; }
      if (/^(求职意向|目标岗位|期望职位|意向岗位|应聘岗位)/i.test(t)) { cur = 'intent'; continue; }
      sec[cur] += t + '\n';
    }
    if (!sec.education && !sec.experience && !sec.project && !sec.skill) sec.other = String(text || '');
    return sec;
  }

  /* ========================= 5. 简历证据抽取 ========================= */
  /* 严格区分：明确证据(strong) / 弱证据(weak) / 无证据(none) */
  var EDU_LEVELS = [
    { name: '博士', kws: ['博士', 'PhD', '博士研究生'] },
    { name: '硕士', kws: ['硕士', '研究生', 'MBA'] },
    { name: '本科', kws: ['本科', '学士', '大学'] },
    { name: '大专', kws: ['大专', '专科', '高职'] }
  ];

  var MAJOR_KWS = ['机械', '电气', '自动化', '计算机', '软件', '电子信息', '通信', '土木',
                   '会计', '财务管理', '金融', '经济', '市场营销', '工商管理', '国际贸易',
                   '设计', '视觉传达', '工业设计', '环境艺术', '教育学', '心理学', '汉语言',
                   '英语', '日语', '新闻', '广告', '医学', '临床', '药学', '护理', '生物',
                   '法学', '法律', '物流', '供应链', '农学', '园艺', '动物医学', '化学', '材料'];

  var TRANSFERABLE_KWS = ['沟通', '团队合作', '团队协作', '协作', '学习能力', '抗压',
                          '责任心', '创新', '逻辑思维', '执行力', '主动性', '适应能力'];

  function extractEvidence(text, parsed) {
    text = String(text || '');
    var sec = splitSections(text);
    var ev = {
      text: text,
      education: { level: '', major: '', school: '', raw: '' },
      years: null, level: '',
      experiences: [], projects: [],
      skillsStrong: [], skillsWeak: [],
      tools: [], domains: [], industries: [],
      certs: [], achievements: [],
      intent: { stated: false, title: '', industry: '' },
      transferable: [],
      completeness: 0, insufficient: false, missingFields: [],
      sections: sec
    };

    /* --- 教育背景 --- */
    var eduText = sec.education || text;
    ev.education.raw = eduText.slice(0, 300);
    for (var i = 0; i < EDU_LEVELS.length; i++) {
      for (var j = 0; j < EDU_LEVELS[i].kws.length; j++) {
        if (has(eduText, EDU_LEVELS[i].kws[j])) { ev.education.level = EDU_LEVELS[i].name; break; }
      }
      if (ev.education.level) break;
    }
    for (var m = 0; m < MAJOR_KWS.length; m++) {
      if (has(eduText, MAJOR_KWS[m])) { ev.education.major = MAJOR_KWS[m]; break; }
    }
    var schoolM = eduText.match(/([^\s，,。\n]{2,12}(?:大学|学院|学校|理工|师范))/);
    if (schoolM) ev.education.school = schoolM[1];
    if (!ev.education.major) {
      /* 兜底：教育行剔除「学历层次」与「学校名」后，剩余部分视为专业方向 */
      var line = (eduText.split(/[\n]/)[0] || '').trim();
      if (schoolM) line = line.replace(schoolM[1], '');
      line = line.replace(/博士|硕士|研究生|本科|学士|大专|专科|高职|MBA|PhD/gi, '')
                 .replace(/[（）()【】\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
      if (line.length >= 2 && line.length <= 24) ev.education.major = line;
    }

    /* --- 工作年限 --- */
    var ym = text.match(/(\d+)\s*年(?:以上)?(?:相关)?(?:工作|从业|行业)?经验/) ||
             text.match(/经验[：: ]*(\d+)\s*年/) ||
             text.match(/(\d+)\s*年\s*(?:工作|从业)/);
    if (ym) ev.years = parseInt(ym[1], 10);
    if (ev.years == null) {
      var yrs = text.match(/(19|20)\d{2}/g);
      if (yrs && yrs.length >= 2) {
        var a = parseInt(yrs[0], 10), b = parseInt(yrs[yrs.length - 1], 10);
        var d = Math.abs(b - a);
        if (d > 0 && d < 45) ev.years = d;
      }
    }

    /* --- 经历 / 项目 --- */
    function collect(src, bucket) {
      if (!src) return;
      src.split(/[\n。；;]/).forEach(function (s) {
        s = (s || '').trim();
        if (s.length > 6 && bucket.length < 12) bucket.push(s.slice(0, 120));
      });
    }
    collect(sec.experience, ev.experiences);
    collect(sec.project, ev.projects);
    if (parsed && parsed.projects) {
      parsed.projects.forEach(function (p) {
        if (p && p.desc && ev.projects.length < 12) ev.projects.push(String(p.desc).slice(0, 120));
      });
    }
    if (!ev.experiences.length && !ev.projects.length) collect(text, ev.projects);

    /* --- 技能（跨全行业词典，不再只覆盖互联网方向） --- */
    var skillText = (sec.skill || '') + '\n' + text;
    CAREER_FAMILIES.forEach(function (f) {
      f.core.forEach(function (kw) {
        var c = countOf(skillText, kw);
        if (c === 0) return;
        if (c >= 2 || has(sec.skill, kw)) ev.skillsStrong.push(kw);
        else ev.skillsWeak.push(kw);
      });
      f.domain.forEach(function (kw) {
        if (has(text, kw)) ev.domains.push(kw);
      });
    });
    ev.skillsStrong = uniq(ev.skillsStrong);
    ev.skillsWeak = uniq(ev.skillsWeak.filter(function (k) { return ev.skillsStrong.indexOf(k) === -1; }));
    ev.domains = uniq(ev.domains);

    /* --- 证书 --- */
    Object.keys(CERT_DICT).forEach(function (name) {
      for (var i = 0; i < CERT_DICT[name].length; i++) {
        if (has(text, CERT_DICT[name][i])) { ev.certs.push(name); return; }
      }
    });

    /* --- 可量化成果 --- */
    var achPat = [/(?:提升|增长|提高|降低|节省|下降|增加|完成|实现|达成|输出|录用|同比)[^。；\n]{0,25}?\d+/g,
                  /\d+(?:%|％|万|倍|个百分点)/g];
    achPat.forEach(function (p) {
      var m;
      while ((m = p.exec(text)) !== null && ev.achievements.length < 8) {
        ev.achievements.push({ text: m[0].trim().slice(0, 60), quantified: true });
      }
    });

    /* --- 用户明确求职意向 --- */
    var it = sec.intent;
    if (!it) {
      var im = text.match(/(?:求职意向|目标岗位|期望职位|意向岗位|应聘岗位)[：: ]?([^\n。；]{2,30})/);
      if (im) it = im[1];
    }
    if (it && String(it).trim().length > 1) {
      ev.intent.stated = true;
      ev.intent.title = String(it).trim().slice(0, 30);
    }
    if (parsed && parsed.customJob) { ev.intent.stated = true; ev.intent.title = String(parsed.customJob); }

    /* --- 可迁移能力（弱证据，严禁单独用来推断产品/互联网岗位） --- */
    TRANSFERABLE_KWS.forEach(function (k) { if (has(text, k)) ev.transferable.push(k); });
    ev.transferable = uniq(ev.transferable);

    /* --- 信息完整度 --- */
    var fields = [
      { ok: !!ev.education.level, name: '学历' },
      { ok: !!ev.education.major, name: '专业' },
      { ok: ev.years != null, name: '工作年限' },
      { ok: ev.experiences.length > 0, name: '工作经历' },
      { ok: ev.projects.length > 0, name: '项目经历' },
      { ok: ev.skillsStrong.length > 0, name: '专业技能' },
      { ok: ev.achievements.length > 0, name: '成果证据' }
    ];
    var okCount = 0;
    fields.forEach(function (f) { if (f.ok) okCount++; else ev.missingFields.push(f.name); });
    ev.completeness = okCount / fields.length;

    /* 信息不足判定：以「证据量」为准，而不是简历字数（避免篇幅稍短就被误判） */
    var signalCount = ev.skillsStrong.length + ev.domains.length + ev.experiences.length + ev.projects.length;
    ev.insufficient = (text.length < 60) || (signalCount < 5) ||
                      ((ev.skillsStrong.length < 2) && (ev.domains.length < 2));
    return ev;
  }

  /* ========================= 6. 职业方向识别 ========================= */
  /* 返回按证据强度排序的职业方向（开放式，不做行业配额） */
  function identifyDirections(ev) {
    var dirs = [];
    CAREER_FAMILIES.forEach(function (f) {
      var strong = 0, weak = 0, hits = [];
      f.core.forEach(function (kw) {
        if (ev.skillsStrong.indexOf(kw) !== -1) { strong++; hits.push(kw); }
        else if (ev.skillsWeak.indexOf(kw) !== -1) { weak++; hits.push(kw + '(弱)'); }
      });
      var dom = 0, domDisc = 0;
      f.domain.forEach(function (kw) {
        if (ev.domains.indexOf(kw) !== -1) {
          dom++;
          if (GENERIC_DOMAIN_WORDS.indexOf(kw) === -1) domDisc++;
        }
      });
      var task = 0, taskDisc = 0;
      f.tasks.forEach(function (kw) {
        if (has(ev.text, kw)) {
          task++;
          if (GENERIC_TASK_WORDS.indexOf(kw) === -1) taskDisc++;
        }
      });
      /* 方向识别门槛：必须有「判别性证据」——核心技能命中，或 ≥2 个非通用领域命中。
       * 仅由通用职场动词（推动/协调/方案/复盘…）堆出来的强度一律忽略，
       * 否则任何用通用话术写的简历都会被误判为产品/运营/AI 方向。 */
      var hasDisc = (strong + weak) > 0 || domDisc >= 2;
      var strength = strong * 2 + weak * 1 + domDisc * 1.5 + taskDisc * 0.5;
      if (hasDisc && strength > 0) {
        dirs.push({
          familyId: f.id, industry: f.industry, strength: strength,
          strongHits: strong, weakHits: weak, domainHits: dom, domainDisc: domDisc,
          taskHits: task, taskDisc: taskDisc,
          evidence: hits.slice(0, 8), gated: false
        });
      }
    });
    dirs.sort(function (a, b) { return b.strength - a.strength; });
    return dirs;
  }

  /* ========================= 7. 候选岗位生成 ========================= */
  function familyById(id) {
    for (var i = 0; i < CAREER_FAMILIES.length; i++) {
      if (CAREER_FAMILIES[i].id === id) return CAREER_FAMILIES[i];
    }
    return null;
  }

  /* 在同一职业族内挑选「最贴合简历证据」的岗位名，而不是固定取第一个。
   * 计分：专项关键词证据(强2/弱1) + 简历直接出现该岗位名(+8) + 通用岗位先验(首个 +5)
   * —— 通用岗位名作为先验，必须被明确的专项证据超越才会让位。 */
  function rankTitles(fam, ev) {
    return fam.titles.map(function (t, idx) {
      var s = 0;
      (t.extra || []).forEach(function (kw) {
        if (ev.skillsStrong.indexOf(kw) !== -1) s += 2;
        else if (ev.skillsWeak.indexOf(kw) !== -1) s += 1;
        else if (has(ev.text, kw)) s += 1;
      });
      /* 简历中直接出现该岗位名（或其去掉通用后缀后的核心词）→ 强信号 */
      var core = t.name.replace(/(专员|工程师|设计师|分析师|经理|助理|主管|代表|员|师)$/, '');
      if (has(ev.text, t.name)) s += 8;
      else if (core.length >= 2 && has(ev.text, core)) s += 8;
      if (idx === 0) s += 5;
      return { t: t, s: s };
    }).sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.t; });
  }

  /* 由职业方向 + 证据动态生成候选岗位（按行业轮转，保证不集中在单一行业） */
  function buildCandidates(dirs, ev, topN) {
    topN = topN || 5;
    var out = [], usedFam = {}, usedTitle = {};
    var considered = [];

    function push(titleObj, fam, dirInfo) {
      if (out.length >= topN) return;
      if (usedTitle[titleObj.name]) return;
      usedTitle[titleObj.name] = 1;
      usedFam[fam.id] = (usedFam[fam.id] || 0) + 1;
      var req = {
        job_title: titleObj.name,
        industry: fam.industry,
        familyId: fam.id,
        core: (fam.core || []).concat(titleObj.extra || []),
        tasks: fam.tasks || [],
        domain: fam.domain || [],
        hardCerts: titleObj.hardCerts || fam.hardCerts || [],
        edu: fam.edu || '学历未明确要求',
        source: 'taxonomy:' + fam.id
      };
      out.push(req);
      considered.push({ title: req.job_title, industry: req.industry, familyId: fam.id, dirStrength: dirInfo ? dirInfo.strength : 0 });
    }

    /* 轮转：先取每个方向最贴合的岗位，再取次贴合的……避免全部集中在一个行业 */
    var rankedCache = {};
    for (var round = 0; round < 3 && out.length < topN; round++) {
      for (var i = 0; i < dirs.length && out.length < topN; i++) {
        var fam = familyById(dirs[i].familyId);
        if (!fam) continue;
        if (round > 0 && (usedFam[fam.id] || 0) > round) continue;
        if (!rankedCache[fam.id]) rankedCache[fam.id] = rankTitles(fam, ev);
        var t = rankedCache[fam.id][round];
        if (t) push(t, fam, dirs[i]);
      }
    }

    /* 用户明确求职意向：若其方向不在前列，也纳入候选（意向单独计权，不改变能力分） */
    if (ev.intent.stated && ev.intent.title) {
      var intentFam = null, best = 0;
      CAREER_FAMILIES.forEach(function (f) {
        f.titles.forEach(function (t) {
          var score = 0;
          if (ev.intent.title.indexOf(t.name) !== -1 || t.name.indexOf(ev.intent.title) !== -1) score += 5;
          f.core.forEach(function (kw) { if (ev.intent.title.indexOf(kw) !== -1) score += 1; });
          if (score > best) { best = score; intentFam = { fam: f, t: t }; }
        });
      });
      if (intentFam && !usedTitle[intentFam.t.name]) {
        out.unshift({
          job_title: ev.intent.title.length <= 20 ? ev.intent.title : intentFam.t.name,
          industry: intentFam.fam.industry,
          familyId: intentFam.fam.id,
          core: (intentFam.fam.core || []).concat(intentFam.t.extra || []),
          tasks: intentFam.fam.tasks || [],
          domain: intentFam.fam.domain || [],
          hardCerts: intentFam.t.hardCerts || intentFam.fam.hardCerts || [],
          edu: intentFam.fam.edu || '',
          source: 'user-intent'
        });
        considered.unshift({ title: ev.intent.title, industry: intentFam.fam.industry, familyId: intentFam.fam.id, dirStrength: 0, reason: '用户明确求职意向' });
      }
    }
    return { candidates: out, considered: considered };
  }

  /* ========================= 8. 逐岗位评分 ========================= */
  function evidenceLevel(ev, kw) {
    if (ev.skillsStrong.indexOf(kw) !== -1) return 'strong';
    if (ev.skillsWeak.indexOf(kw) !== -1) return 'weak';
    if (has(ev.text, kw)) return 'weak';
    return 'none';
  }

  /* list: 信号词典；expect: 该维度「证据充分」所需的证据项数（配置值）。
   * 计分：强证据=1，弱证据=0.5，达到 expect 即满分，超出不额外加分。 */
  function scoreDimension(list, ev, expect) {
    expect = expect || 8;
    var matched = [], missing = [], s = 0;
    list.forEach(function (kw) {
      var lv = evidenceLevel(ev, kw);
      if (lv === 'strong') { matched.push({ kw: kw, level: 'strong', snippet: snippet(ev.text, kw) }); s += 1; }
      else if (lv === 'weak') { matched.push({ kw: kw, level: 'weak', snippet: snippet(ev.text, kw) }); s += 0.5; }
      else missing.push(kw);
    });
    var score = Math.round(100 * Math.min(1, s / expect));
    return { score: score, matched: matched, missing: missing, weighted: s };
  }

  function scoreDepth(ev) {
    /* 经历深度及成果证据：年限 + 量化成果 + 主导/负责信号 + 经历条数 */
    var y = ev.years;
    var base = 40;
    if (y == null) base = 35;
    else if (y <= 1) base = 45;
    else if (y <= 2) base = 58;
    else if (y <= 4) base = 72;
    else if (y <= 7) base = 82;
    else base = 88;

    var ach = Math.min(20, (ev.achievements.length || 0) * 7);
    var own = has(ev.text, '负责') || has(ev.text, '主导') || has(ev.text, '带领') ||
              has(ev.text, 'owner') || has(ev.text, 'Owner') ? 10 : 0;
    var vol = Math.min(15, ((ev.experiences.length || 0) + (ev.projects.length || 0)) * 3);
    var score = Math.min(100, base + ach + own + vol);

    var evidence = [];
    if (y != null) evidence.push('工作年限约 ' + y + ' 年');
    if (ev.achievements.length) evidence.push('可量化成果 ' + ev.achievements.length + ' 条');
    if (own) evidence.push('存在主导/负责表述');
    return { score: score, matched: evidence.map(function (t) { return { kw: t, level: 'strong', snippet: t }; }), missing: [] };
  }

  var EDU_RANK = { '博士': 4, '硕士': 3, '本科': 2, '大专': 1, '': 0 };

  function scoreEduCert(req, ev) {
    /* 学历匹配 + 硬性证书；硬性要求缺失要显式扣分 */
    var need = EDU_RANK[ev.education.level] || 0;
    var eduScore;
    if (/硕士/.test(req.edu)) eduScore = need >= 3 ? 100 : need === 2 ? 65 : need === 1 ? 45 : 50;
    else if (/本科/.test(req.edu)) eduScore = need >= 2 ? 100 : need === 1 ? 60 : 50;
    else if (/大专/.test(req.edu)) eduScore = need >= 1 ? 100 : 50;
    else eduScore = 70;

    var hardMissing = [];
    (req.hardCerts || []).forEach(function (c) {
      if (ev.certs.indexOf(c) === -1) hardMissing.push(c);
    });

    /* 证书维度：无硬性要求 → 不适用(100)；有要求 → 按已满足比例计分。
     * 注意：硬性资格的「扣分」统一放在最终分上执行（见 scoreJob），
     * 避免 10% 权重把扣罚稀释到看不出来。 */
    var certScore = 100;
    if ((req.hardCerts || []).length) {
      certScore = Math.round(100 * ((req.hardCerts.length - hardMissing.length) / req.hardCerts.length));
    }
    var score = Math.round(0.6 * eduScore + 0.4 * certScore);
    var penalty = 0;
    var evidence = [];
    if (ev.education.level) evidence.push({ kw: '学历：' + ev.education.level, level: 'strong', snippet: ev.education.raw.slice(0, 60) });
    if (ev.education.major) evidence.push({ kw: '专业：' + ev.education.major, level: 'strong', snippet: '' });
    ev.certs.forEach(function (c) { evidence.push({ kw: '证书：' + c, level: 'strong', snippet: '' }); });
    return { score: Math.round(score), matched: evidence, missing: hardMissing, penalty: penalty, eduScore: eduScore };
  }

  function scoreIntent(req, ev) {
    if (!ev.intent.stated || !ev.intent.title) {
      return { score: 0, matched: [], missing: ['简历未写明求职意向'] };
    }
    var t = ev.intent.title;
    if (t === req.job_title || t.indexOf(req.job_title) !== -1 || req.job_title.indexOf(t) !== -1) {
      return { score: 100, matched: [{ kw: '求职意向：' + t, level: 'strong', snippet: t }], missing: [] };
    }
    var fam = familyById(req.familyId);
    var rel = 0;
    if (fam) {
      fam.domain.forEach(function (kw) { if (t.indexOf(kw) !== -1) rel++; });
      fam.core.forEach(function (kw) { if (t.indexOf(kw) !== -1) rel++; });
    }
    if (rel > 0) return { score: 55, matched: [{ kw: '求职意向部分相关：' + t, level: 'weak', snippet: t }], missing: [] };
    return { score: 0, matched: [], missing: ['求职意向(' + t + ')与本岗位不一致'] };
  }

  function scoreJob(req, ev, weights) {
    weights = weights || DEFAULT_WEIGHTS;
    var d = {};
    d.core_skill = scoreDimension(req.core, ev, EXPECT.core);
    /* 评分时剔除通用职场动词 / 通用领域词：不匹配的岗位不应因「推动方案、协调项目」
     * 这类任何简历都有的表述而获得 task/domain 维度分数，从而避免系统性虚高。 */
    var taskList = (req.tasks || []).filter(function (k) { return GENERIC_TASK_WORDS.indexOf(k) === -1; });
    var domList = (req.domain || []).filter(function (k) { return GENERIC_DOMAIN_WORDS.indexOf(k) === -1; });
    d.task_project = scoreDimension(taskList, ev, EXPECT.tasks);
    d.domain_knowledge = scoreDimension(domList, ev, EXPECT.domain);
    d.depth_evidence = scoreDepth(ev);
    d.education_cert = scoreEduCert(req, ev);
    d.intent = scoreIntent(req, ev);

    var raw = 0;
    Object.keys(weights).forEach(function (k) { raw += (weights[k] * d[k].score); });
    var rawScore = Math.round(raw);

    /* ---- 证据覆盖度（同样以「关键要求数量」为基准，而非信号词典全长） ---- */
    var need = EXPECT.core + EXPECT.tasks + (req.hardCerts || []).length;
    var covered = Math.min(EXPECT.core, d.core_skill.weighted) +
                  Math.min(EXPECT.tasks, d.task_project.weighted);
    (req.hardCerts || []).forEach(function (c) { if (ev.certs.indexOf(c) !== -1) covered += 1; });
    var coverage = need ? Math.min(1, covered / need) : 0;

    /* ---- 扣分与上限（只降不升：不做统一加分、不做最低分兜底、不归一化） ---- */
    var score = rawScore, caps = [], deductions = [];
    var strongCount = 0, weakCount = 0;
    d.core_skill.matched.forEach(function (m) { if (m.level === 'strong') strongCount++; else weakCount++; });
    if (strongCount === 0 && weakCount > 0) {
      score = Math.min(score, PENALTY.weakEvidenceCap);
      caps.push('核心技能无强证据，分数上限 ' + PENALTY.weakEvidenceCap);
    }
    var hardMissing = d.education_cert.missing || [];
    if (hardMissing.length) {
      var cut = PENALTY.missingHardCert * hardMissing.length;
      score -= cut;
      deductions.push('缺失硬性资格「' + hardMissing.join('、') + '」，扣 ' + cut + ' 分');
      if ((req.hardCerts || []).length && hardMissing.length === req.hardCerts.length) {
        score = Math.min(score, PENALTY.hardCertCap);
        caps.push('硬性资格全部缺失，分数上限 ' + PENALTY.hardCertCap);
      }
    }
    if (ev.insufficient) {
      score = Math.min(score, PENALTY.insufficientCap);
      caps.push('简历信息不足，分数上限 ' + PENALTY.insufficientCap);
    }
    score = Math.max(0, Math.min(100, Math.round(score)));

    /* ---- 置信度（与匹配分分离） ---- */
    var confidence;
    if (ev.insufficient) confidence = 'low';
    else if (coverage >= 0.6 && ev.completeness >= 0.55) confidence = 'high';
    else if (coverage >= 0.35) confidence = 'medium';
    else confidence = 'low';

    /* ---- 输出字段 ---- */
    var supporting = [], matchingSkills = [];
    ['core_skill', 'task_project', 'domain_knowledge'].forEach(function (k) {
      d[k].matched.forEach(function (m) {
        matchingSkills.push(m.kw);
        if (m.snippet && supporting.length < 6) supporting.push(m.snippet);
      });
    });
    matchingSkills = uniq(matchingSkills).slice(0, 12);
    supporting = uniq(supporting);

    var missing = [];
    d.core_skill.missing.slice(0, 5).forEach(function (k) { missing.push('核心技能未体现：' + k); });
    d.task_project.missing.slice(0, 3).forEach(function (k) { missing.push('工作任务/职责未体现：' + k); });
    hardMissing.forEach(function (c) { missing.push('缺少硬性资格：' + c); });
    if (!ev.education.level) missing.push('学历信息缺失');
    if (ev.years == null) missing.push('工作年限不明确');

    var reasons = [];
    if (d.core_skill.score >= 60) reasons.push('核心专业技能有证据支持（覆盖 ' + d.core_skill.matched.length + ' 项）');
    if (d.task_project.score >= 60) reasons.push('工作任务/项目职责与岗位要求吻合');
    if (d.domain_knowledge.score >= 50) reasons.push('具备该行业/领域相关知识');
    if (d.depth_evidence.score >= 65) reasons.push('经历深度与成果证据较充分');
    if (d.intent.score === 100) reasons.push('与用户明确求职意向一致');
    if (!reasons.length) reasons.push('简历与该岗位仅有少量相关证据');

    var risks = [];
    if (d.core_skill.score < 50) risks.push('核心技能与岗位要求差距较大，需系统补足');
    if (hardMissing.length) risks.push('缺少岗位硬性资格，可能无法通过资格筛选');
    if (d.domain_knowledge.score < 40) risks.push('行业知识储备不足，属跨行业转向');
    if (ev.insufficient) risks.push('简历信息不足，判断不确定性高');
    if (!risks.length) risks.push('需进一步验证实际落地能力');

    var sugg = [];
    d.core_skill.missing.slice(0, 3).forEach(function (k) { sugg.push('补充/强化「' + k + '」相关能力与实践'); });
    hardMissing.forEach(function (c) { sugg.push('考取「' + c + '」以满足岗位硬性要求'); });
    if (d.task_project.missing.length) sugg.push('在简历中补充与「' + d.task_project.missing[0] + '」相关的项目职责描述');
    if (ev.insufficient) sugg.push('补充教育背景、工作年限、项目职责与量化成果等信息');

    var band = bandOf(score);

    return {
      job_title: req.job_title,
      industry: req.industry,
      family_id: req.familyId,
      match_score: score,
      raw_score: rawScore,
      band: band.label,
      band_desc: band.desc,
      confidence: confidence,
      evidence_coverage: Math.round(coverage * 100) / 100,
      dimensions: {
        core_skill:       { label: DIM_LABELS.core_skill,       weight: weights.core_skill,       score: d.core_skill.score,       evidence: d.core_skill.matched.slice(0, 6) },
        task_project:     { label: DIM_LABELS.task_project,     weight: weights.task_project,     score: d.task_project.score,     evidence: d.task_project.matched.slice(0, 6) },
        domain_knowledge: { label: DIM_LABELS.domain_knowledge, weight: weights.domain_knowledge, score: d.domain_knowledge.score, evidence: d.domain_knowledge.matched.slice(0, 6) },
        depth_evidence:   { label: DIM_LABELS.depth_evidence,   weight: weights.depth_evidence,   score: d.depth_evidence.score,   evidence: d.depth_evidence.matched },
        education_cert:   { label: DIM_LABELS.education_cert,   weight: weights.education_cert,   score: d.education_cert.score,   evidence: d.education_cert.matched.slice(0, 6) },
        intent:           { label: DIM_LABELS.intent,           weight: weights.intent,           score: d.intent.score,           evidence: d.intent.matched }
      },
      supporting_evidence: supporting,
      matching_skills: matchingSkills,
      /* 该岗位的关键要求（供 JD / 能力树等环节复用，避免回退到硬编码岗位） */
      key_requirements: {
        core_skills: req.core || [],
        tasks: req.tasks || [],
        domain: req.domain || [],
        hard_certs: req.hardCerts || []
      },
      missing_requirements: uniq(missing),
      match_reasons: reasons,
      risks: risks,
      improvement_suggestions: uniq(sugg),
      not_recommended: hardMissing.length > 0 && hardMissing.length === (req.hardCerts || []).length,
      _debug: {
        source: req.source,
        caps: caps,
        deductions: deductions,
        weights: weights,
        calculation: Object.keys(weights).map(function (k) {
          return DIM_LABELS[k] + ' ' + d[k].score + '×' + weights[k] + '=' + Math.round(weights[k] * d[k].score * 10) / 10;
        }),
        sorted_by: 'match_score desc'
      }
    };
  }

  /* ========================= 9. 主流程 ========================= */
  function recommendJobs(resumeText, parsed, opts) {
    opts = opts || {};
    var topN = opts.topN || 5;
    var weights = opts.weights || DEFAULT_WEIGHTS;
    var ev = extractEvidence(resumeText, parsed || null);
    var dirs = identifyDirections(ev);
    var built = buildCandidates(dirs, ev, topN);
    var jobs = built.candidates.map(function (c) { return scoreJob(c, ev, weights); });

    /* 排序：能力匹配分为主；求职意向作为同分/接近时的加权（并单独展示） */
    jobs.sort(function (a, b) {
      var ao = a.match_score + (a.dimensions.intent.score === 100 ? 3 : 0);
      var bo = b.match_score + (b.dimensions.intent.score === 100 ? 3 : 0);
      return bo - ao;
    });

    var ranked = jobs.slice(0, topN);
    var allWeak = ranked.length > 0 && ranked.every(function (j) { return j.match_score < 45; });

    return {
      ok: true,
      engine: 'evidence-based-v1',
      weights: weights,
      jobs: ranked,
      insufficient: ev.insufficient,
      all_weak: allWeak,
      notice: ev.insufficient
        ? '简历信息不足，以下推荐置信度较低，建议补充教育背景、工作年限、项目职责与量化成果。'
        : (allWeak ? '当前简历与自动生成的候选岗位匹配度均较低（<45），建议明确求职意向或补充关键经历。' : ''),
      questions: ev.insufficient
        ? ['您的最高学历与专业是？', '您有多少年相关工作经验？', '您期望的目标岗位/行业是什么？', '请补充 1-2 段具体项目职责与量化成果']
        : [],
      debug: {
        evidence: {
          education: ev.education, years: ev.years, skillsStrong: ev.skillsStrong,
          skillsWeak: ev.skillsWeak, domains: ev.domains, certs: ev.certs,
          achievements: ev.achievements, intent: ev.intent,
          transferable: ev.transferable, completeness: Math.round(ev.completeness * 100) / 100,
          insufficient: ev.insufficient, missingFields: ev.missingFields
        },
        directions: dirs,
        candidates: built.considered,
        job_debug: ranked.map(function (j) {
          return {
            job_title: j.job_title, match_score: j.match_score, raw_score: j.raw_score,
            dims: Object.keys(j.dimensions).map(function (k) {
              return { dim: k, label: j.dimensions[k].label, weight: j.dimensions[k].weight, score: j.dimensions[k].score };
            }),
            calculation: j._debug.calculation, caps: j._debug.caps, deductions: j._debug.deductions
          };
        })
      }
    };
  }

  /* ========================= 10. LLM 增强（可选） ========================= */
  /* 关键：LLM 只输出「各维度证据 + 分项评分」，最终总分仍由 scoreJob 计算。
   * 这里让 LLM 输出候选岗位及其要求(JSON)，再用同一套确定性评分器打分，
   * 以保证不同岗位分数可比较、可解释，且不受模型主观高分影响。 */
  var AI_SYSTEM_PROMPT = [
    '你是中立、严谨的职业分类与招聘分析助手。你的任务是根据【简历原文】判断候选人真正适合的岗位。',
    '严格要求：',
    '1. 只能依据简历中实际存在的证据（专业、课程、实习/工作经历、项目职责、技能工具、证书、可量化成果）。',
    '2. 严禁默认或优先推荐 AI、互联网、产品经理、运营等热门方向；只有当简历确有相应证据时才可推荐。',
    '3. 候选岗位必须覆盖候选人真实的专业领域（例如机械/财务/教育/设计/医疗/法律/供应链等），不要只给互联网岗位。',
    '4. 输出 3-5 个岗位，尽量覆盖不同的行业方向（除非简历证据只支持单一行业）。',
    '5. 每个岗位给出该岗位的关键要求（核心技能、典型工作任务、领域知识、硬性证书/资格）。',
    '6. 不要输出匹配分数，不要输出综合评价，只要岗位与要求。',
    '7. 只输出 JSON，不要任何解释文字。'
  ].join('\n');

  function aiUserPrompt(resumeText) {
    return [
      '【简历原文】',
      String(resumeText || '').slice(0, 4000),
      '',
      '请输出如下 JSON（严格遵守结构）：',
      '{"jobs":[{"job_title":"岗位名称","industry":"所属行业","core_skills":["..."],"tasks":["..."],"domain":["..."],"hard_certs":["..."]}]}'
    ].join('\n');
  }

  function parseAIJobs(text) {
    try {
      var s = String(text || '');
      var a = s.indexOf('{'), b = s.lastIndexOf('}');
      if (a === -1 || b === -1) return null;
      var obj = JSON.parse(s.slice(a, b + 1));
      if (obj && Array.isArray(obj.jobs)) return obj.jobs;
      return null;
    } catch (e) { return null; }
  }

  /* aiCaller(messages, temperature, stage) -> Promise<{ok,text}>（与 index.html 的 callAI 同签名） */
  function recommendJobsWithAI(resumeText, parsed, opts) {
    opts = opts || {};
    var aiCaller = opts.aiCaller;
    var base = recommendJobs(resumeText, parsed, opts);
    if (!aiCaller || typeof aiCaller !== 'function') return Promise.resolve(base);

    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; base.debug.ai = { used: false, reason: 'AI 调用超时，已回退本地证据评分' }; resolve(base); }
      }, opts.aiTimeout || 45000);

      try {
        aiCaller([
          { role: 'system', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: aiUserPrompt(resumeText) }
        ], 0.3, 'match').then(function (res) {
          if (done) return;
          done = true; clearTimeout(timer);
          if (!res || !res.ok) { base.debug.ai = { used: false, reason: (res && res.error) || 'AI 不可用，已回退本地证据评分' }; return resolve(base); }
          var list = parseAIJobs(res.text);
          if (!list || !list.length) { base.debug.ai = { used: false, reason: 'AI 返回无法解析，已回退本地证据评分' }; return resolve(base); }

          var ev = extractEvidence(resumeText, parsed || null);
          var weights = opts.weights || DEFAULT_WEIGHTS;
          var dirs = identifyDirections(ev);
          var localReqs = buildCandidates(dirs, ev, opts.topN || 5).candidates;

          /* 合并策略：按岗位名合并「关键要求」的【并集】，再统一用同一套确定性规则打分。
           * —— 绝不能让 AI 版本的岗位直接替换本地版本：AI 用词与简历用词不一致时
           *    会把一个本该高分的岗位打成 0 分（实测出现过）。 */
          var merged = {}, order = [];
          function addReq(r) {
            var k = String(r.job_title);
            if (!merged[k]) {
              merged[k] = {
                job_title: k, industry: r.industry || '未分类', familyId: r.familyId || 'ai',
                core: [], tasks: [], domain: [], hardCerts: [], edu: r.edu || '', source: r.source || ''
              };
              order.push(k);
            }
            var m = merged[k];
            m.core = uniq(m.core.concat(r.core || []));
            m.tasks = uniq(m.tasks.concat(r.tasks || []));
            m.domain = uniq(m.domain.concat(r.domain || []));
            m.hardCerts = uniq(m.hardCerts.concat(r.hardCerts || []));
            if (!m.edu && r.edu) m.edu = r.edu;
            /* 本地分类优先决定行业归属，保证展示稳定 */
            if (r.source && String(r.source).indexOf('taxonomy') === 0) { m.familyId = r.familyId; m.industry = r.industry; }
            if (String(m.source).indexOf('ai') === -1 && r.source === 'ai') m.source = 'taxonomy+ai';
          }
          localReqs.forEach(addReq);
          list.slice(0, 6).forEach(function (j) {
            if (!j || !j.job_title) return;
            var core = Array.isArray(j.core_skills) ? j.core_skills : [];
            var tasks = Array.isArray(j.tasks) ? j.tasks : [];
            var domain = Array.isArray(j.domain) ? j.domain : [];
            /* 丢弃完全没有要求的 AI 岗位，避免产生 0 分噪声 */
            if (!core.length && !tasks.length && !domain.length) return;
            addReq({
              job_title: String(j.job_title).slice(0, 30),
              industry: String(j.industry || '未分类').slice(0, 20),
              familyId: 'ai', core: core, tasks: tasks, domain: domain,
              hardCerts: Array.isArray(j.hard_certs) ? j.hard_certs : [],
              edu: '本科及以上', source: 'ai'
            });
          });

          var all = order.map(function (k) { return scoreJob(merged[k], ev, weights); });
          all.sort(function (a, b) { return b.match_score - a.match_score; });
          base.jobs = all.slice(0, opts.topN || 5);
          base.all_weak = base.jobs.length > 0 && base.jobs.every(function (j) { return j.match_score < 45; });
          base.debug.ai = { used: true, jobs: list.length };
          base.debug.job_debug = base.jobs.map(function (j) {
            return {
              job_title: j.job_title, match_score: j.match_score, raw_score: j.raw_score,
              dims: Object.keys(j.dimensions).map(function (k) {
                return { dim: k, label: j.dimensions[k].label, weight: j.dimensions[k].weight, score: j.dimensions[k].score };
              }),
              calculation: j._debug.calculation, caps: j._debug.caps, deductions: j._debug.deductions
            };
          });
          resolve(base);
        })['catch'](function (e) {
          if (done) return;
          done = true; clearTimeout(timer);
          base.debug.ai = { used: false, reason: 'AI 调用异常，已回退本地证据评分' };
          resolve(base);
        });
      } catch (e) {
        if (done) return;
        done = true; clearTimeout(timer);
        base.debug.ai = { used: false, reason: 'AI 调用异常，已回退本地证据评分' };
        resolve(base);
      }
    });
  }

  return {
    DEFAULT_WEIGHTS: DEFAULT_WEIGHTS,
    DIM_LABELS: DIM_LABELS,
    SCORE_BANDS: SCORE_BANDS,
    CAREER_FAMILIES: CAREER_FAMILIES,
    CERT_DICT: CERT_DICT,
    PENALTY: PENALTY,
    bandOf: bandOf,
    extractEvidence: extractEvidence,
    identifyDirections: identifyDirections,
    buildCandidates: buildCandidates,
    scoreJob: scoreJob,
    recommendJobs: recommendJobs,
    recommendJobsWithAI: recommendJobsWithAI,
    parseAIJobs: parseAIJobs
  };
});
