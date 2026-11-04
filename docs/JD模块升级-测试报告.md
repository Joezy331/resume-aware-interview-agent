# JD 智能分析模块升级 · 功能测试报告

**项目**：AI Career Copilot（Resume-Aware Interview Agent）
**版本**：V4.2（JD 模块双模式升级）
**交付构建**：`electron-app/release_v9`（71.7MB）→ 项目根 `AI-Career-Copilot-20261102c.exe`
**日期**：2026-11-02
**范围**：在现有项目基础上增强 JD 分析模块，未新建系统；原有页面框架、Electron 打包、模型 API、简历解析、岗位匹配、模拟面试、面试历史全部保留。

---

## 一、本次升级内容

| 能力 | 说明 |
|---|---|
| 双入口 | 新增侧栏「JD 智能分析」页：模式一「已有目标岗位？」手动输入 / 模式二「还不确定适合什么岗位？」AI 生成 |
| 模式一 | 粘贴 JD 文本、上传 TXT/PDF/DOCX、上传截图（百度 OCR 高精度版）、可关联当前简历；保留 JD 原文不改写；输出职责/硬技能/软技能/工具/学历/面试重点 + AI 深度分析（硬性必备 vs 优先加分） |
| 模式二 | 三步向导：简历信息确认（可编辑）→ 岗位推荐与选择（3–5 卡片、主推荐/拓展、可改岗位名、5 档职级）→ 生成与分析（进度、8 个结果 Tab） |
| 岗位库 | `job-library.js`：12 行业、51 岗位、能力标签 + 匹配关键词，支持 `register()` 运行时扩展，岗位数据与前端业务逻辑分离 |
| JD 生成 Agent | `jd-core.js` 内置需求给定的资深 HR 系统提示词：职级差异（实习生/应届生/初级/中级/高级）、九段结构 A–I、质量约束、JSON 输出 |
| 匹配分析 | 六维权重（25/25/20/15/10/5，技术岗自动调权 30/20/20/12/10/8），已体现 / 部分满足 / 未体现 / 待确认，结论关联简历与 JD 证据 |
| 结果操作 | 查看完整 JD、编辑目标岗位、重新生成、保存、复制、进入模拟面试（均真实可用） |
| 数据模型 | `acc_jd_v1`（localStorage）：manual / industry_reference 两类，保存 ID/来源/岗位/行业/级别/原文或生成内容/结构化要求/匹配分/时间戳；复用项目既有 localStorage 机制，与 `acc_history_v1` 互不冲突 |
| 容错 | 模型输出经 `extractJSON` + `normalizeGeneratedJD` / `normalizeMatchResult` 归一化；模型不可用时生成本地兜底 JD、匹配走本地启发式（带证据），流程不中断 |

## 二、修改文件清单

**新增**
| 文件 | 作用 |
|---|---|
| `electron-app/job-library.js` | 行业岗位库（12 行业 / 51 岗位）+ 岗位推荐算法（主推荐 + 拓展），浏览器全局 + Node require 双用 |
| `electron-app/jd-core.js` | JD 生成系统提示词、六维匹配提示词、权重策略、输出归一化、本地兜底匹配、JD 数据模型与历史存取、JD→文本 |
| `electron-app/tests/jd_module.test.js` | 纯 Node 单测（47 断言） |
| `electron-app/tools/test_jd_module.js` | Electron E2E（24 断言 + 6 张截图，mock 模型驱动全流程） |
| `electron-app/tools/jd_gen_acceptance.js` | 12 测试岗位 + 职级差异化真实模型验收脚本（支持 `levels` 参数只跑职级对照） |
| `electron-app/tools/test_jd_real.js` | 真实模型端到端 E2E（真实 IPC 代理 + 独立 userData 隔离） |
| `electron-app/tools/diag_errors.js` | 全页面错误诊断（console/未捕获异常 + 逐页 + JD 交互，0 错误的回归依据） |
| `docs/JD模块升级-测试报告.md` | 本报告 |

**修改**
| 文件 | 改动 |
|---|---|
| `electron-app/index.html` | ① 引入 `job-library.js` / `jd-core.js`；② 侧栏新增「JD 智能分析」导航（`data-page="jd"`）；③ 新增 `page-jd` 页面（双入口卡、模式一面板、三步向导、8 Tab 结果、历史记录）与 `jd-page-css` 作用域样式；④ 新增 JD 模块 JS（约 480 行：`jdpg*` 系列函数）；⑤ `showPage` 增加 jd 渲染分支；⑥ 顶栏标题映射补 `jd`；⑦ 修复 `analyzeJDText` 两处既有解析缺陷（JD 标题被抽成「职责」；含 PRD 的职责行被误判为工具行吞掉；hard 为空时用工具项兜底） |
| `electron-app/package.json` | `build.files` 补入 `job-library.js`、`jd-core.js`（否则打包后 require 失败） |
| `electron-app/tests/ui_v4_audit.js` | 导航断言 8→9，页面清单加入 `jd`（含截图 `02b_jd.png`），断言 43→47 |

## 三、验收标准逐条结果（需求第八节）

| # | 验收项 | 结果 | 依据 |
|---|---|---|:--|
| 1 | 不上传简历时，手动输入 JD 可正常分析 | ✅ | E2E「模式一解析结果展示 / 保留 JD 原文」，取消关联简历后仍输出完整解析 |
| 2 | 支持上传已有 JD 文件并解析 | ✅ | 实现 TXT（渲染进程直读）+ PDF/DOCX（复用主进程 `parse-resume-file`）；`jdpgManualFile` |
| 3 | 支持 JD 截图 OCR（原项目已具备） | ✅ | 复用百度 OCR 高精度版 `baiduOcr` + `maybeDownscaleForOCR`；未配置时明确提示改用粘贴 |
| 4 | 上传简历后正确提取简历信息 | ✅ | 第一步展示并允许编辑教育/经验/技能/项目/亮点；无简历时提供内联粘贴/示例简历入口 |
| 5 | 能根据简历推荐多个不同岗位 | ✅ | 单测「推荐返回 3-5 个岗位」「主推荐/拓展标注」「跨族多样性」；E2E「3-5 张推荐卡片」 |
| 6 | 不同岗位生成差异化 JD | ✅ | 12 岗位真实验收「行业差异化（关键词命中）」12/12 通过 |
| 7 | 不同职级职责/资格明显区别 | ✅ | 职级对照 4/4（实习生「协助/在指导下/无全职经验要求」vs 高级「策略/体系/结果负责」） |
| 8 | 生成后自动进入简历匹配分析 | ✅ | `jdpgGenerate` 生成完成即调用 `jdpgRunMatch`，真实 E2E 六维匹配 + 匹配分落库 |
| 9 | 匹配结果展示具体证据与差距 | ✅ | 六维 `evidence`、已满足/部分满足/未体现/待确认、优势/差距/建议分区 |
| 10 | 支持编辑岗位和重新生成 | ✅ | E2E「编辑目标岗位 → 回第二步」「重新生成再次入库」 |
| 11 | JD 历史记录可保存和查看 | ✅ | E2E「manual 记录」「industry_reference + 匹配分」「两类来源展示」「查看/复制/删除」 |
| 12 | 原有模块不受影响 | ✅ | `tools/diag_errors.js` 全 9 页 0 错误 + round4（22/22）、jd_analyze（0 fail）、job_matching（69）、models_sync（22）、dom_smoke（0 错误）、ui_v4_audit（47/47） |

## 四、测试执行汇总

| 套件 | 命令 | 结果 |
|---|---|---|
| JD 模块单测（纯 Node） | `env -u NODE_OPTIONS node tests/jd_module.test.js` | **47 / 47 通过** |
| JD 模块 E2E（Electron，mock 模型） | `electron tools/test_jd_module.js` | **24 / 24 通过**，截图 6 张 |
| JD 模块真实模型 E2E | `electron tools/test_jd_real.js "数据分析师" "初级"` | **12 / 12 通过**，真实生成 51s |
| 12 岗位真实生成验收 | `node tools/jd_gen_acceptance.js` | **76 / 76 通过**（12×6 + 职级对照 4） |
| 全页面错误诊断 | `electron tools/diag_errors.js` | **0 错误**（9 页 + JD 双模式 + 8 Tab） |
| UI v4 审计 | `electron tests/ui_v4_audit.js` | **47 / 47 通过**（新增 jd 页 4 断言） |
| 第 4 轮回归 | `electron tests/round4_check.js` | **22 / 22 通过** |
| JD 解析回归 | `electron tests/jd_analyze_check.js` | **FAILCOUNT=0** |
| 岗位匹配引擎 | `node tests/job_matching.test.js` | **69 断言 0 失败** |
| 模型同步 | `node tests/models_sync.test.js` | **22 / 22 通过** |
| DOM 冒烟 | `electron tests/dom_smoke.js` | **0 错误**（仅 CSP 常规警告） |

### 12 测试岗位真实生成验收

脚本：`env -u NODE_OPTIONS node tools/jd_gen_acceptance.js`（前置：本地 Cline 服务 `http://localhost:8787/v1` 在线，配置读取 `local_api_config.json` 的 `base_url` 与 `api_key`）

覆盖岗位：AI 产品经理（实习生）、产品经理（应届生）、数据分析师（初级）、前端开发工程师（中级）、后端开发工程师（初级）、UI 设计师（应届生）、市场营销（实习生）、产品运营（应届生）、金融分析师（初级）、人力资源专员（实习生）、机械工程师（中级）、销售顾问（应届生），外加 AI 产品经理「实习生 vs 高级」职级对照。每例校验：九段字段结构、行业关键词差异化、职级标注、必备/优先区分、技能分级、无虚构企业招聘信息。

| 项目 | 结果 |
|---|---|
| 12 岗位 × 6 项校验 | **72 / 72 通过** |
| 职级差异化对照（4 项） | **4 / 4 通过** |
| 合计 | **76 / 76 通过**，结果留存 `electron-app/_preview/jd_acceptance_results.json` |

关键样例（AI 产品经理 · 实习生，真实模型产出）：岗位概述含「在导师指导下参与 AI 场景探索、Prompt 设计与模型效果评估」；8 项职责均以「协助/在指导下/参与」表述；必备条件为在读本科 + 基础认知 + 工具；经验要求明确「无全职经验要求，允许以课程项目、个人项目、竞赛、实习经历作为参考」——未把高级管理要求套用到实习生。高级同岗位则输出策略、体系与结果负责类要求，两档差异明显。

### 真实模型端到端（应用内链路，非 mock）

脚本：`electron tools/test_jd_real.js "数据分析师" "初级"`（真实走 渲染进程 callAI → IPC → 主进程代理 → 本地服务，带 Bearer 认证）

| 岗位 | 耗时 | 结果 |
|---|---|---|
| AI 产品经理 · 实习生 | 81s | 12/12 断言通过（未走本地兜底） |
| 数据分析师 · 初级 | 51s | 12/12 断言通过（未走本地兜底） |

覆盖：结果渲染、九段字段完整性、岗位与职级正确、六维匹配、证据分区、落库含匹配分、8 Tab 遍历、保存/复制/完整 JD、历史不重复堆积。

> **本轮排查记录（"全部报错"根因）**：① 验收脚本直连模型服务未带 `Authorization: Bearer` → 全部 401，已在脚本内补认证（并区分 401/429/截断三类错误提示）；② 真实调用测试的 IPC 桩返回结构与 `createModelService.getLocalConfig()` 不一致（缺 `availableModels`），导致应用未恢复同步模型列表、继续使用已下线的 `cline-free/mimo-v2.6-flash` → 调用失败降级；改为复用真实 `createModelService` 后恢复正常，应用因此新增 **多模型兜底重试**（`jdpgAIWithRetry`：当前阶段模型失败自动换用已同步的其它模型，最多 3 个），避免单模型下线导致整体降级。

## 五、关键页面截图

| 文件 | 内容 |
|---|---|
| `electron-app/_preview/jd_e2e_1_entry.png` | JD 智能分析双入口（模式一 / 模式二） |
| `electron-app/_preview/jd_e2e_2_manual.png` | 模式一解析结果（职责 / 技能 / 原文折叠） |
| `electron-app/_preview/jd_e2e_3_step2.png` | 第二步岗位推荐（主推荐、拓展、匹配度、优势/待提升） |
| `electron-app/_preview/jd_e2e_4_result_overview.png` | 第三步结果 · 岗位概览（8 Tab + 匹配分 82） |
| `electron-app/_preview/jd_e2e_5_result_match.png` | 简历匹配度 · 六维评分条 + 证据 |
| `electron-app/_preview/jd_e2e_6_history.png` | JD 历史记录（两类来源 + 查看/复制/删除） |
| `electron-app/_preview/jd_real_overview.png` | **真实模型**生成 · 数据分析师（初级）· 匹配 72 分 |
| `electron-app/_preview/jd_real_match.png` | **真实模型**六维匹配详情 |
| `screenshots_v4/02b_jd.png` | UI v4 审计中的 JD 页整页截图 |

## 六、数据结构

```js
// localStorage: acc_jd_v1（数组，最多 50 条；损坏数据隔离到 acc_jd_v1_corrupt）
{
  id: 'jd_<ts>', version: 1,
  source_type: 'manual' | 'industry_reference',
  job_title, industry, job_level,
  raw_text,      // manual：JD 原文（不改写）
  content,       // industry_reference：生成的标准 JD（结构化九段）
  structured,    // manual：本地解析结果（resp/hard/soft/tools/edu/focus）
  match,         // 匹配分析结果（六维 + 证据分区）
  match_score, resume_id, resume_title,
  createdAt, updatedAt
}
```

## 七、已知限制

1. 岗位库为内置初始数据（`job-library.js`），可通过 `JobLibrary.register()` / `registerIndustry()` 扩展；尚未接入远程岗位库接口（架构已预留）。
2. 模式一的「硬性/优先条件」区分依赖 AI 深度分析，服务不可用时仅展示本地解析结果（不伪造结论）。
3. 模型生成 JD 属行业参考，`confidence_notes` 会标注「需根据企业实际情况确认」，不包含真实企业招聘信息。
4. 匹配分析的「未体现」明确标注「≠ 不具备」，作为面试确认项。
