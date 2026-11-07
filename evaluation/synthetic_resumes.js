/* =====================================================================
 * synthetic_resumes.js
 * 32 份跨行业合成简历（评测用，非真实个人数据）
 *
 * 设计原则：
 *  - 每份简历都带有评估者（人）设定的「参考岗位族」 referenceFamily，
 *    以及参考岗位名 referenceTitles。这是**独立判定标准**，不由模型自判，
 *    用于衡量推荐是否合理（Top1/Top3 是否命中参考族）。
 *  - 覆盖机械、财务、教育、设计、软件开发、AI 数据、市场营销、人力资源、
 *    医药、法律、物流等方向，以及 2 份信息不完整的简历。
 *  - 其中医药/法律部分简历刻意缺失硬性资格（执业药师/法律职业资格），
 *    用于检验「缺少关键岗位要求时的识别率」。
 *  - 参考族取值 = job-matching.js 的 CAREER_FAMILIES.id：
 *    software / ai_data / product_pm / design / biz_ops / finance_admin /
 *    education / engineering_mfg / medical_bio / legal / logistics_supply
 *    incomplete / generic 为特殊标记（无清晰单一职业族）。
 * ===================================================================== */

const RESUMES = [
  /* ---------------- 软件开发 / software ---------------- */
  {
    id: 'R01_frontend', family: 'software', referenceTitles: ['前端开发工程师'],
    text: `教育背景
本科 计算机科学与技术 某大学
工作经历
2021-2024 某互联网公司 前端开发工程师
负责 React 与 Vue 项目的前端页面开发，使用 TypeScript 编写组件
参与前端工程化建设，优化首屏加载性能，LCP 降低 40%
项目经历
电商中台前端：基于 React + TypeScript 搭建组件库，使用 Webpack 构建，覆盖 30+ 页面
专业技能
HTML CSS JavaScript TypeScript React Vue Webpack Git 性能优化 前端工程化`
  },
  {
    id: 'R02_backend', family: 'software', referenceTitles: ['软件开发工程师'],
    text: `教育背景
硕士 软件工程 某高校
工作经历
2019-2024 某科技公司 后端开发工程师
使用 Java + Spring Boot 开发微服务，设计高并发订单系统，QPS 提升至 8000
负责 MySQL 分库分表与 Redis 缓存设计，接口平均响应时间从 320ms 降到 60ms
项目经历
支付清结算平台：基于 Kafka 做最终一致性，对账准确率 99.99%
专业技能
Java Spring Boot MySQL Redis Kafka 微服务 分布式 Docker Kubernetes Git`
  },
  {
    id: 'R03_test', family: 'software', referenceTitles: ['测试工程师'],
    text: `教育背景
本科 软件工程 某大学
工作经历
2020-2024 某软件公司 测试工程师
编写自动化测试用例，使用 Selenium + Python 搭建回归测试框架
负责缺陷管理与版本质量门禁，线上缺陷率下降 35%
项目经历
电商 App 质量保障：搭建 API 自动化测试平台，覆盖 1200+ 接口
专业技能
Python Selenium 测试用例 自动化测试 缺陷管理 回归测试 JMeter 性能测试`
  },

  /* ---------------- AI 与数据 / ai_data ---------------- */
  {
    id: 'R04_dataanalyst', family: 'ai_data', referenceTitles: ['数据分析师'],
    text: `教育背景
本科 统计学 某大学
工作经历
2021-2024 某零售企业 数据分析师
搭建经营分析看板（Tableau），输出周报与专题分析，支撑 GMV 决策
通过 A/B 实验优化首页推荐位，转化率提升 12%
项目经历
用户流失预警：基于逻辑回归建模，提前 14 天识别高流失用户
专业技能
SQL Python Tableau BI 数据清洗 特征工程 A/B 实验 统计分析 可视化`
  },
  {
    id: 'R05_algorithm', family: 'ai_data', referenceTitles: ['算法工程师'],
    text: `教育背景
博士 机器学习 某高校
工作经历
2020-2024 某 AI 公司 算法工程师
负责推荐系统排序模型，使用 PyTorch 训练深度模型，CTR 提升 8%
参与大模型微调（LoRA），落地客服问答 Agent
项目经历
多模态检索：基于 CLIP 做图文检索，Recall@10 达 0.86
专业技能
Python PyTorch TensorFlow 机器学习 深度学习 大模型 NLP 微调 RAG 特征工程`
  },
  {
    id: 'R06_llm', family: 'ai_data', referenceTitles: ['大模型应用工程师'],
    text: `教育背景
硕士 自然语言处理 某高校
工作经历
2022-2024 某创业公司 大模型应用工程师
基于 LLM + RAG 搭建企业知识库问答，命中率 82%
设计 Prompt 工程框架与 Agent 编排，自动化处理工单 40%
项目经历
智能客服 Agent：结合工具调用与记忆，解决率 76%
专业技能
Python LLM 大模型 Prompt RAG Agent 微调 PyTorch 向量库 语义检索`
  },

  /* ---------------- 工程与制造 / engineering_mfg ---------------- */
  {
    id: 'R07_mech', family: 'engineering_mfg', referenceTitles: ['机械设计工程师'],
    text: `教育背景
本科 机械设计制造及其自动化 某大学
工作经历
2018-2024 某装备制造企业 机械设计工程师
使用 SolidWorks 进行非标设备结构设计，出图 200+ 张
负责有限元分析（ANSYS），优化机架刚度，减重 15%
项目经历
自动化装配线：设计工装夹具与传送机构，节拍 12s/件
专业技能
SolidWorks AutoCAD 机械制图 机械设计 有限元 ANSYS 公差 GD&T 工艺 夹具 CNC`
  },
  {
    id: 'R08_elec', family: 'engineering_mfg', referenceTitles: ['电气/自动化工程师'],
    text: `教育背景
本科 电气工程及其自动化 某大学
工作经历
2019-2024 某工厂 电气自动化工程师
使用 PLC（西门子）编写梯形图，完成产线电气控制
负责伺服与变频调试，设备 OEE 提升至 88%
项目经历
立体仓库控制系统：基于 PLC + 视觉定位，出入库效率提升 25%
专业技能
PLC 电气 电路 梯形图 伺服 变频 自动化 液压 气动 调试 设备维护`
  },
  {
    id: 'R09_quality', family: 'engineering_mfg', referenceTitles: ['质量工程师'],
    text: `教育背景
本科 质量管理工程 某大学
工作经历
2020-2024 某汽车零部件厂 质量工程师
推行 ISO9001 与 IATF16949，主导 FMEA 与 SPC 管控
负责客诉分析与 8D 整改，批量不良率下降 42%
项目经历
六西格玛绿带项目：优化焊接良率，Cpk 从 0.9 提升到 1.5
专业技能
ISO9001 FMEA SPC 六西格玛 质检 不良 质量管控 8D 体系 审核`
  },

  /* ---------------- 财务与行政 / finance_admin ---------------- */
  {
    id: 'R10_account', family: 'finance_admin', referenceTitles: ['会计'],
    text: `教育背景
本科 会计学 某财经院校
工作经历
2019-2024 某制造企业 会计
负责全盘账务处理，使用用友 NC 编制报表与报税
每月完成成本归集与对账，出具经营分析报告
项目经历
ERP 财务模块上线：主导科目体系与凭证模板配置
专业技能
会计 财务 税务 报表 记账 凭证 Excel ERP 用友 金蝶 成本核算 对账 开票`
  },
  {
    id: 'R11_fa', family: 'finance_admin', referenceTitles: ['财务分析师'],
    text: `教育背景
硕士 金融学 某高校
工作经历
2020-2024 某集团公司 财务分析师
搭建经营分析模型，输出预算与滚动预测，偏差控制在 3% 内
通过本量利分析与敏感性测试支撑定价决策
项目经历
新业务投资测算：建立财务模型，IRR 评估支持立项
专业技能
财务分析 预算 成本核算 经营分析 建模 Excel SAP 报表 税务 投资评估`
  },
  {
    id: 'R12_hr', family: 'finance_admin', referenceTitles: ['人力资源专员'],
    text: `教育背景
本科 人力资源管理 某大学
工作经历
2021-2024 某互联网公司 HR
负责全流程招聘，年度到岗 120+ 人，关键岗位 fill rate 85%
搭建绩效考核与薪酬体系，组织培训 30+ 场
项目经历
人才盘点项目：建立胜任力模型与九宫格盘点
专业技能
招聘 绩效 薪酬 培训 社保 劳动合同 入离职 员工关系 组织发展`
  },
  {
    id: 'R13_admin', family: 'finance_admin', referenceTitles: ['行政专员'],
    text: `教育背景
大专 行政管理 某学院
工作经历
2020-2024 某贸易公司 行政专员
负责办公后勤、档案管理与会议组织
管理固定资产与印章流程，年降本 8%
项目经历
办公楼搬迁项目：统筹 200+ 工位与物资调度
专业技能
行政 档案 会议 办公 后勤 采购 印章 接待 流程 文档`
  },

  /* ---------------- 教育与语言 / education ---------------- */
  {
    id: 'R14_teacher', family: 'education', referenceTitles: ['学科教师'],
    text: `教育背景
本科 汉语言文学 某师范大学
工作经历
2018-2024 某中学 语文教师
负责高一高二语文教学，所带班级平均分年级前列
组织教研与公开课，参与教材二次开发
项目经历
整本书阅读课程：设计《乡土中国》导读与测评体系
专业技能
教学 备课 授课 课堂管理 课程设计 教研 教案 学科知识 辅导 批改`
  },
  {
    id: 'R15_curriculum', family: 'education', referenceTitles: ['教研/课程设计'],
    text: `教育背景
硕士 课程与教学论 某高校
工作经历
2019-2024 某教育科技公司 课程设计
负责 K12 数学课程体系搭建与课件开发
基于学习数据分析迭代教学内容，完课率提升 18%
项目经历
AI 自适应学习：设计知识图谱与错因诊断路径
专业技能
教研 课程设计 教案 课件 教材 教学 数据分析 测评 学习科学`
  },
  {
    id: 'R16_translator', family: 'education', referenceTitles: ['翻译'],
    text: `教育背景
硕士 翻译学 某高校（英语专业八级）
工作经历
2020-2024 某本地化公司 笔译/本地化工程师
负责技术文档与产品 UI 中英互译，年交付 50 万字
参与术语库与翻译记忆库建设，一致性 95%
项目经历
某手机系统本地化：统筹 12 语种 release notes 翻译
专业技能
笔译 口译 翻译 本地化 术语 英语 双语 校对 CAT 工具 技术文档`
  },

  /* ---------------- 设计与创意 / design ---------------- */
  {
    id: 'R17_ui', family: 'design', referenceTitles: ['UI 设计师'],
    text: `教育背景
本科 视觉传达设计 某大学
工作经历
2021-2024 某互联网公司 UI 设计师
负责 C 端 App 界面设计，使用 Figma 搭建组件库
参与交互走查与可用性测试，核心流程转化率提升 9%
项目经历
金融 App 改版：重建设计规范与暗色模式
专业技能
Figma Sketch 交互 界面 组件库 视觉 PS 配色 原型 用户体验`
  },
  {
    id: 'R18_visual', family: 'design', referenceTitles: ['平面/视觉设计师'],
    text: `教育背景
本科 平面设计 某艺术学院
工作经历
2019-2024 某品牌公司 视觉设计师
负责品牌 VI 与包装设计，产出 30+ 物料
操刀电商详情页与海报，大促点击率提升 22%
项目经历
新品上市视觉：从 logo 到包装一体化设计
专业技能
Photoshop Illustrator InDesign 版式 配色 视觉 品牌 包装 海报 手绘 渲染`
  },
  {
    id: 'R19_industrial', family: 'design', referenceTitles: ['工业设计师'],
    text: `教育背景
本科 工业设计 某大学
工作经历
2020-2024 某消费电子公司 工业设计师
负责智能硬件外观与 CMF 设计，出图至手板
做用户研究与竞品拆解，量产良率 91%
项目经历
蓝牙耳机设计：ID 草图到 Render，斩获红点概念奖
专业技能
SolidWorks Rhino Keyshot 建模 渲染 手板 草图 CMF 用户研究 结构`
  },

  /* ---------------- 商业与运营 / biz_ops ---------------- */
  {
    id: 'R20_mkt', family: 'biz_ops', referenceTitles: ['市场营销专员'],
    text: `教育背景
本科 市场营销 某大学
工作经历
2020-2024 某快消公司 市场营销专员
负责小红书/抖音内容投放，单月曝光 2000 万+
策划品牌活动，ROI 达 1:4.5
项目经历
新品种草 campaign：搭建 KOC 矩阵，互动率 6%
专业技能
市场营销 品牌 策划 文案 投放 社群 SEO SEM 抖音 小红书 增长 转化`
  },
  {
    id: 'R21_ops', family: 'biz_ops', referenceTitles: ['运营专员'],
    text: `教育背景
本科 电子商务 某大学
工作经历
2021-2024 某电商平台 运营专员
负责商家社群与活动运营，30 日留存提升 15%
搭建用户分层体系，复购率提升 11%
项目经历
会员体系搭建：设计权益与成长路径，月活破 50 万
专业技能
运营 社群 活动 留存 转化 内容运营 用户分层 复盘 增长 数据分析`
  },
  {
    id: 'R22_sales', family: 'biz_ops', referenceTitles: ['销售/客户成功'],
    text: `教育背景
本科 国际贸易 某大学
工作经历
2019-2024 某 SaaS 公司 客户成功经理
负责重点客户续约与增购，NRR 达 118%
通过谈判与回款管理，年度回款完成率 105%
项目经历
大客户交付：从 POC 到规模化落地，客单价提升 30%
专业技能
销售 客户 CRM 谈判 签约 回款 客户维护 商务 招投标 增长 关系`
  },

  /* ---------------- 产品与项目 / product_pm ---------------- */
  {
    id: 'R23_pm', family: 'product_pm', referenceTitles: ['产品经理'],
    text: `教育背景
本科 信息管理与信息系统 某大学
工作经历
2018-2024 某互联网公司 产品经理
负责 B 端 SaaS 产品规划，输出 PRD 与原型（Axure）
通过用户研究与竞品分析定义路线图，NPS 提升 14
项目经历
数据中台产品：从 0 到 1 立项，年营收 2000 万
专业技能
需求分析 PRD 原型 Axure Figma 用户研究 竞品分析 产品策略 路线图 敏捷 数据驱动`
  },
  {
    id: 'R24_pm_edge', family: 'product_pm', referenceTitles: ['产品经理', '项目管理'],
    text: `教育背景
本科 工商管理 某大学
工作经历
2020-2024 某传统企业 项目经理
负责信息化项目推进，用敏捷/Scrum 管理跨团队交付
编写项目章程与里程碑，准时交付率 90%
项目经历
ERP 升级项目：协调 5 个部门，按期上线无重大回退
专业技能
项目管理 PMP 敏捷 Scrum 里程碑 甘特图 风险管理 协调 文档 沟通 推进`
  },

  /* ---------------- 医疗与生命科学 / medical_bio ---------------- */
  {
    id: 'R25_clinic', family: 'medical_bio', referenceTitles: ['临床医师/医技'],
    hasHardCert: true, certTest: 'present',
    text: `教育背景
本科 临床医学 某医科大学
资格
执业医师资格证（已在岗注册）
工作经历
2017-2024 某三甲医院 住院医师
负责内科常见病诊疗与病历书写，年门诊 3000+ 人次
参与临床路径管理与病例讨论
项目经历
慢病管理项目：建立随访档案，依从性提升 20%
专业技能
临床 诊断 治疗 病历 护理 医学 药理 诊疗 查房 处方`
  },
  {
    id: 'R26_pharma_nocert', family: 'medical_bio', referenceTitles: ['药师'],
    hasHardCert: false, certTest: 'missing',
    text: `教育背景
本科 药学 某大学
工作经历
2021-2024 某药店 营业员/调剂协助
负责药品陈列与顾客用药咨询，熟悉常见 OTC 药物
协助药师进行处方药核对
项目经历
会员用药档案：整理慢病人群购药记录
专业技能
药理 处方 配药 GSP 药品 药学 咨询 零售 健康`
  },
  {
    id: 'R27_lab', family: 'medical_bio', referenceTitles: ['实验室技术员'],
    text: `教育背景
硕士 生物化学 某高校
工作经历
2020-2024 某生物公司 实验室技术员
负责 PCR、ELISA 与细胞培养，执行 GMP 标准操作
维护实验记录与试剂管理
项目经历
抗体检测试剂盒：参与工艺转移与批间一致性验证
专业技能
PCR ELISA 细胞 试剂 离心 培养 实验 GLP GMP 检验 生物 数据`
  },

  /* ---------------- 法律 / legal ---------------- */
  {
    id: 'R28_legal', family: 'legal', referenceTitles: ['法务专员'],
    hasHardCert: true, certTest: 'present',
    text: `教育背景
本科 法学 某政法大学
资格
法律职业资格证书（A 证）
工作经历
2019-2024 某集团公司 法务专员
负责合同审核与诉讼支持，年审合同 800+
参与合规内控与风险评估，处理劳动争议
项目经历
海外投资尽调：出具法律意见与风险清单
专业技能
法务 诉讼 合规 内控 合同 风险 法律 案件 谈判 尽调`
  },
  {
    id: 'R29_compliance_nocert', family: 'legal', referenceTitles: ['合规专员'],
    hasHardCert: false,
    text: `教育背景
本科 工商管理 某大学
工作经历
2021-2024 某金融科技公司 合规助理
负责反洗钱名单筛查与可疑交易报送
整理监管报送材料，对接合规检查
项目经历
反洗钱系统上线：梳理规则与流程，预警准确率提升
专业技能
合规 内控 反洗钱 风险 监管 报送 流程 审核 公文`
  },

  /* ---------------- 物流与供应链 / logistics_supply ---------------- */
  {
    id: 'R30_supply', family: 'logistics_supply', referenceTitles: ['供应链/物流'],
    text: `教育背景
本科 物流管理 某大学
工作经历
2019-2024 某零售集团 供应链专员
负责采购计划与库存周转，库存周转天数从 45 降到 32
优化配送路由，履约成本下降 11%
项目经历
仓配一体化：设计区域仓网络，次日达覆盖率 85%
专业技能
供应链 物流 采购 库存 仓储 配送 路由 计划 周转 降本 调度`
  },

  /* ---------------- 特殊样本 ---------------- */
  {
    id: 'R31_incomplete', family: 'incomplete', referenceTitles: [],
    text: `工作经历
做过一些工作和项目，负责相关工作，取得了一些成绩。
技能：沟通、协调、学习能力强。`
  },
  {
    id: 'R32_generic', family: 'generic', referenceTitles: [],
    text: `教育背景
本科 某专业 某大学
工作经历
2020-2024 某公司 员工
负责需求、规划、迭代、推动、协调、调研、方案、上线、验收、复盘、跟进、落地、推进、优化。
参与产品与业务相关工作，取得良好成果。
专业技能
沟通 执行 配合 支持 团队合作`
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RESUMES };
}
