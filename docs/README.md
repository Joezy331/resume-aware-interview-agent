# Docs — 文档说明

本目录存放项目的产品文档、设计文档和架构图，供面试官深入了解项目。

## 📂 文件清单

| 文件名 | 类型 | 内容说明 | 来源 |
|--------|------|----------|------|
| `PRD.pdf` | PDF | 产品需求文档（作品集精简版，约2000字） | 导出自 `PRD_Simplified.md` |
| `Product_Flow.png` | 图片 | 产品核心流程图（5步：上传→解析→面试→评分→报告） | 截图自 `Product_Flow_Design.html` |
| `Agent_Architecture.png` | 图片 | 4个Agent协同架构图 | 截图自 `Agent_Architecture_Diagram.html` |
| `HITL_Design.png`（可选） | 图片 | Human-in-the-Loop 机制流程图 | 截图自 `HITL_Flowchart.html` |

## 📄 各文件详情

### PRD.pdf — 产品需求文档

内容结构：
- 项目背景 + 行业现状
- 用户痛点（3个具体场景）
- 用户画像（3类目标用户）
- 为什么做这个项目（差异化分析）
- 产品方案设计（核心流程 + 设计原则）
- Agent 架构设计（4 Agent 职责 + 数据流）

**如何生成 PDF**：
1. 打开 `PRD_Simplified.md`（项目根目录的上层）
2. 使用 Typora 或 VS Code Markdown Preview
3. 导出为 PDF（推荐 A4，含目录）

### Product_Flow.png — 产品流程图

**推荐导出方式**：
1. 用浏览器打开 `Product_Flow_Design.html`
2. Chrome DevTools → `Ctrl+Shift+P` → `Capture full size screenshot`
3. 裁剪为 1200×600 px

### Agent_Architecture.png — Agent 架构图

**推荐导出方式**：
1. 用浏览器打开 `Agent_Architecture_Diagram.html`
2. 完整截图（含 Mermaid 图和 Agent 职责表）
3. 裁剪为 1200×800 px

## 💡 使用建议

- **面试展示顺序**：`PRD.pdf` → `Product_Flow.png` → `Agent_Architecture.png`
- **GitHub README 嵌入**：将 `Product_Flow.png` 嵌入 README 的"产品流程"章节
- **作品集 PDF**：将所有文档整合为一份完整的作品集 PDF（建议顺序：背景→痛点→方案→架构→成果）
