# Web Demo（免 Key 体验版）

本目录提供一个**纯前端、无需 API Key** 的体验版，便于招聘者 / 评审快速查看完整交互流程，无需配置大模型。

## 文件

- `index.html`：应用主页面（源自 `dist/index_v3.html`）
- `chart.umd.min.js`：本地 Chart.js（离线渲染，无需 CDN）

## 使用

直接用浏览器打开 `index.html` 即可（推荐 Chrome / Edge）。

## 与 Python 版（仓库根 `app.py`）的区别

| 维度 | Web Demo（本目录） | Python 版（app.py） |
|------|-------------------|---------------------|
| 是否需要 Key | 否 | 是（SiliconFlow API Key） |
| LLM 调用 | 前端模拟 / 规则，不调用真实大模型 | 真实调用 Qwen / SiliconFlow |
| 运行方式 | 浏览器直接打开 | `streamlit run app.py` |
| 适合场景 | 快速体验交互流程与产品设计 | 真实 AI 面试、评分与报告 |

> 说明：Web Demo 为前端演示版本，问题生成与评分基于内置逻辑，不代表真实大模型输出；用于展示产品交互与流程设计。生产级 AI 能力见仓库根 `app.py` + `agents/`。
