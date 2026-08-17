# 项目截图 Screenshots

本目录用于存放应用界面截图，帮助招聘者 30 秒内建立直观印象。

## 当前状态

⚠️ **真实运行截图待补充**。为避免虚构，本仓库当前不含运行截图。请本地运行后补拍并提交（见下方「如何生成」）。

> 架构图 / 流程图已生成在 [`docs/`](./docs)：`agent_architecture.png`、`user_flow.png`、`system_architecture.png`，可直接用于 README 与作品集。

## 建议截图清单（命名规范 `01-xx.png`，≤10 张）

| 文件名 | 对应功能 | 可截图状态 |
|--------|----------|-----------|
| `01-home.png` | 首页 / 产品定位 | ✅ 已实现，可截图 |
| `02-resume-upload.png` | 简历上传（PDF / DOCX） | ✅ 已实现，可截图 |
| `03-resume-analysis.png` | 简历解析 + 能力画像 | ✅ 已实现，可截图 |
| `04-ai-interview.png` | Resume-Aware 面试 | ✅ 已实现，可截图 |
| `05-followup.png` | 动态追问 | ✅ 已实现，可截图 |
| `06-score-report.png` | 6 维评分 + 雷达图 | ✅ 已实现，可截图 |
| `07-30day-plan.png` | 改进报告 + 30 天计划 | ✅ 已实现，可截图 |
| `08-job-match.png` | 岗位推荐 | 🔜 规划功能，实现后补 |
| `09-jd-analysis.png` | JD 解析 | 🔜 规划功能，实现后补 |
| `10-dashboard.png` | 能力看板 | 🔜 规划功能，实现后补 |

## 如何生成

1. 按仓库根 README 配置 `.env` 并 `streamlit run app.py`
2. 走通「上传 → 解析 → 面试 → 评分 → 报告」流程
3. 对每个关键页面截图，按上表命名存入本目录
4. 提交前确认 `.gitignore` 未误伤 `.png`（当前 png 均纳入版本控制）

> 请勿在截图中包含真实个人信息（姓名 / 手机号 / 邮箱密码 / 身份证）。演示请使用**虚拟简历**。
