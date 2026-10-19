# 测试报告 · 2026-10-19 桌面版增量迭代

> 所有结果为**真实运行**产出（2026-10-19），分三类标注：自动化测试 / 真实 API 调用测试 / 人工视觉检查。
> 未虚构任何数据；已知失败项如实记录，未修改测试预期凑绿灯。

## 一、测试环境

| 项 | 值 |
|---|---|
| 桌面版源码 | `electron-app/`（index.html + main.js + baidu.js + job-matching.js） |
| Electron | 28.x（`electron-app/node_modules`） |
| 本地模型服务 | `http://localhost:8787/v1`（健康检查 ok:true，api_key_configured:true） |
| 默认模型 | `cline-free/mimo-v2.6-flash` |
| OCR | 百度智能云文字识别（高精度版 accurate_basic），密钥来自本地配置 |

## 二、测试结果总表

| 测试项 | 测试方法 | 预期结果 | 实际结果 | 状态 |
|---|---|---|---|---|
| 岗位匹配引擎 | 自动化（纯 Node，69 断言） | 69 通过 | 69 通过 / 0 失败 | ✅ 通过 |
| 百度 OCR 封装 | 自动化（纯 Node，6 断言） | 6 通过 | 6 通过 / 6 | ✅ 通过 |
| 简历文本抽取 | 自动化（纯 Node，26 断言） | 26 通过 | 26 通过 / 26 | ✅ 通过 |
| 外接 API 回归（追问/岗位 AI 路径） | **真实 API 调用**（14 断言） | 14 通过 | 14 通过 / 0 失败 | ✅ 通过 |
| OCR 回归（图片→文字→结构化） | **真实 API 调用**（百度 OCR + 模型，20 断言） | 20 通过 | 20 通过 / 20 | ✅ 通过 |
| 模型可用性探针 | **真实 API 调用**（探针，不计通过率） | 记录可用性 | mimo/step-5/solar 可用；muse-spark 502 地区限制（已知） | ℹ️ 信息项 |
| round4 检查（粘贴 JD/OCR/步骤4） | 自动化（Electron DOM，22 断言） | 22 通过 | 22 通过 / 0 失败（硬技能分区缺陷已修复，见下注） | ✅ 通过 |
| 面试流程 | 自动化（Electron DOM，12 断言） | 12 通过 | 12 通过 / 0 失败 | ✅ 通过 |
| JD 分析 | 自动化（Electron DOM） | 0 失败 | FAILCOUNT=0 | ✅ 通过 |
| 步骤4 岗位类型 | 自动化（Electron DOM，5 断言） | 5 通过 | 5 通过 / 0 失败 | ✅ 通过 |
| 雷达图重载 | 自动化（Electron DOM，7 断言） | 7 通过 | 7 通过 / 0 失败 | ✅ 通过 |
| DOM 冒烟（全局函数/模型选项/无 console 错误） | 自动化（Electron DOM 探针） | 0 真实错误 | 0 真实错误（仅既有 CSP 警告） | ✅ 通过 |
| **面试历史记录（本次新增）** | 自动化（Electron DOM，27 断言） | 27 通过 | 27 通过 / 0 失败 | ✅ 通过 |

**汇总：12 个测试套件，188 断言；通过 188，失败 0。**

> 注 1：`ocr_regression.js` 本轮修复了测试脚本自身的 `const` 自减崩溃（`pending` 改 `let`），属测试基础设施修复，未改任何断言预期。
>
> 注 2：报告初版记录 round4 检查 1 项失败（粘贴 JD 硬技能提取 `pasteHasHard=false`），已于当日修复：桌面版 `index.html` 新增 `jdSkillSections()`，将 JD 解析结果拆回「🔧 硬技能要求」与「🧠 软技能要求」两个独立分区（原先合并为「🧠 技能要求」，硬技能独立分区丢失）。`flow_check.js` 同步对齐新结构（`hasSkill` 改探「🔧 硬技能要求」，新增 `hasSoft` 断言，11 → 12 断言）。修复后复跑：round4 22/22、flow_check 12/12，其余套件不受影响。

## 三、历史记录模块验证明细（history_check.js · 27 断言）

| 验证点 | 结果 |
|---|---|
| 页面结构（page-history / 统计 / 列表 / 空态 / 详情容器） | ✅ |
| 侧边栏「面试记录」入口 + 原有导航保留 | ✅ |
| 保存-加载往返（字段完整：岗位/难度标签/问答/面试官均分） | ✅ |
| 同一场面试不重复保存 | ✅ |
| 新面试追加且旧记录不被覆盖 | ✅ |
| 损坏 JSON 隔离（转移 `acc_history_v1_corrupt`） | ✅ |
| 删除取消 = 保留；删除确认 = 移除 | ✅ |
| 旧记录（缺新字段）详情兼容展示 | ✅ |
| 详情页 XSS 转义（`<script>` 不执行） | ✅ |
| 列表/详情/统计渲染无异常 | ✅ |
| showPage 路由到 history 页 | ✅ |

## 四、人工视觉检查（真实截图）

| 截图 | 检查结果 |
|---|---|
| `screenshots/01_home.png` | 首页正常，导航与 CTA 完整 |
| `screenshots/02_resume_upload.png` | 三入口（文件/图片/粘贴）+ OCR 说明展示正确 |
| `screenshots/03_job_match.png` | 岗位推荐渲染正常 |
| `screenshots/04_settings.png` | 设置页显示「✅ 已配置 Key」，**输入框为空，无密钥泄露** |
| `screenshots/05_history.png` | 历史页统计 + 列表 + 评分徽章渲染正确（演示数据已标注） |
| `screenshots/06_agents.png` | 13-Agent 架构页渲染正常 |
| `docs/flows/*.png` | 5 张流程图完整无裁切 |

## 五、可复现测试命令

```bash
cd electron-app

# 纯 Node 测试
env -u NODE_OPTIONS node tests/job_matching.test.js   # 69/0
env -u NODE_OPTIONS node tests/baidu.test.js          # 6/6
env -u NODE_OPTIONS node tests/resume_extract.test.js # 26/26

# 真实 API 测试（需本地服务与百度密钥）
env -u NODE_OPTIONS node tests/api_regression.js      # 14/0
env -u NODE_OPTIONS node tests/ocr_regression.js      # 20/20

# Electron DOM 测试（逐文件运行，避免同进程多窗口 GPU 崩溃）
for t in round4_check flow_check jd_analyze_check step4_type_check radar_reload_check history_check dom_smoke; do
  env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe tests/$t.js
done
```

> 注：`ocr_regression.js` 本轮修复了测试脚本自身的 `const` 自减崩溃（`pending` 改 `let`），属测试基础设施修复，未改任何断言预期。

## 六、未测试 / 无法测试项

| 项 | 原因 |
|---|---|
| 便携 EXE 打包构建（`npm run dist-portable`） | 需完整 electron-builder 构建环境与图标资源，本轮未执行打包；源码与配置已就绪 |
| 云端同步 / 多账号 | 产品明确不支持（单用户本机应用），无测试对象 |
| 真实用户效果数据 | 无真实用户，不虚构 |
