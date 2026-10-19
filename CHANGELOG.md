# 更新日志 · CHANGELOG

本项目遵循「诚实记录」原则：仅记录真实完成的改动，不虚构功能与数据。

---

## [2026-10-19] 桌面版增量迭代：外接 API + 百度 OCR + 历史记录

### Added（新增）

- **外接大模型 API 接入桌面版产品流程**
  - 设置页支持 API Key / 模型 / Base URL 配置与「测试连接」；密钥默认从 `local_api_config.json` 读取（asar 之外，不硬编码）。
  - 主进程 `ai-chat` IPC 代理 fetch（90s 超时，401/404/429/502 分类错误提示）。
  - 出题 / 追问 / 评分 / 报告全链路经外接模型真实生成；动态追问使用用户最新回答 + 完整上下文。
- **百度智能云 OCR 接入**
  - 简历图片识别：`accurate_basic` 高精度版优先，失败自动回退多模态竞速。
  - JD 截图识别：上传图片 → OCR → 结构化 + 关键词块。
  - JD 粘贴文本 → 渲染 PNG → 百度 OCR 高精度版提取关键词（替代权限受限的 NLP 关键词接口）。
- **面试历史记录（localStorage 持久化）**
  - 新增「面试记录」页：统计（次数/平均/最高/最近）、列表、详情还原（问答/追问/评分/报告）、删除二次确认、空状态、加载失败重试、损坏数据隔离。
  - 数据结构见 `docs/history-data-spec.md`；测试 `electron-app/tests/history_check.js`（27 断言全过）。
- **流程图集**（`docs/flows/`，SVG 源 + PNG 导出）
  - 用户主流程（含文件类型分支：PDF/DOCX/TXT 不走 OCR，图片才走）、API 调用流程、OCR 子流程、历史记录流程、13-Agent 架构图（区分 LLM Agent / 规则模块 / 外部服务 / 本地存储）。
- **低保真原型更新**（`web-prototype/gen_lowfi.py` 重新生成）
  - 上传页新增图片 OCR 入口与「识别中/成功/失败」三态。
  - 历史记录页重做为真实形态（统计 + 列表 + 空态/加载中/删除确认三态说明）。
  - 新增「API 与 OCR 状态」页（第 17 帧）。
- **文档**：README 重写（三版本区分、新增能力、测试方法、已知限制）；新增 `docs/history-data-spec.md`；`.gitignore` 增加 Electron 桌面版规则；新增 `electron-app/local_api_config.example.json` 模板。
- **仓库结构**：桌面版源码纳入仓库 `electron-app/`（不含 node_modules / 构建产物 / 密钥）。

### Changed（变更）

- `index.html`（桌面版）：侧边栏新增「面试记录」；`showPage` 路由挂接 history 页；报告生成后自动保存历史（同场只保存一次）。
- 旧版超长流程图 `docs/logic_flow.svg` 保留，README 主推 `docs/flows/` 多张短图。

### Fixed（修复）

- **JD 硬技能独立分区丢失（round4_check 真实失败项）**：桌面版 `index.html` 原先将硬/软技能合并渲染为「🧠 技能要求」，丢失硬技能独立分区（`pasteHasHard=false`）。新增 `jdSkillSections()`，三处渲染点（粘贴解析 / 图片解析 / 岗位推荐）拆回「🔧 硬技能要求」与「🧠 软技能要求」。`flow_check.js` 同步对齐（新增软技能分区断言，11 → 12）。修复后复跑全绿：round4 22/22、flow_check 12/12。
- 清理项目冗余文件：21 个历史 release 目录中保留当前构建（release21）、删除旧构建目录与根目录旧 EXE、`__pycache__`、`.bak/.prerevert`、构建日志与调试脚本（约 7.4GB；少量被系统锁定的 asar 文件已排期重启后清除）。

### Known Issues（已知未解决）

- 百度 NLP 关键词接口权限受限（error 6），已弃用，走 OCR 替代实现。
- Muse Spark 1.3 模型上游 502（地区限制），属服务端问题。

---

## [2026-10-16] Round4 修复（桌面版）

- 简历图片 OCR 优先百度 `accurate_basic`，失败回退多模态竞速。
- JD 图片上传（`parseJDImage`）与粘贴文本渲染 PNG 走百度 OCR。
- 步骤 4 职位推荐动态化：空推荐时重算，进入步骤 4 自动选用 top 推荐岗位并同步评分权重。

## [2026-09-29] 高保真原型全模块图表化

- `web-prototype/hifi/` 24 路由 SPA；修复 hash 路由前导斜杠导致的跳转失效 Bug。

## [2026-06-24] V3.0（13-Agent 完整版）

- 完整实现 10 个新增模块：Job Match（11 职位）、JD 双模式、Competency 能力树、混合出题（50/30/20）、动态追问、5 面试官、Chief 冲突检测（>15 分）、增强报告、Dashboard、13-Agent 可视化。

## [2026-06-24] V3.0 中文版

- 保持原有风格排版，全部界面翻译为中文。

## [早期] V1.0 / V2.0

- V1.0：基础版，5 个 Agent，单面试官。
- V2.0：11-Agent 架构，5 位面试官（功能实现不完整）。
