# python-backend · 真实大模型后端工程

本目录是 **AI Career Copilot** 的**生产级 LLM 实现**，使用 Python + Streamlit，真实调用 SiliconFlow（Qwen / Qwen2.5-72B-Instruct）大模型。

> 与根目录 `index.html` 原型的关系：原型（V3.0）提供了**完整产品交互与 13-Agent 设计**（岗位推荐 / JD 解析 / 5 面试官评分等），但其 Agent 协作与评分采用**脚本化模拟**，以便免 Key 秒开。本后端是**真实调用大模型**的落地实现，当前覆盖核心闭环：简历解析 → Resume-Aware 面试 → 动态追问 → 6 维评分 → 总结报告。

## 已实现（真实 LLM）

- 简历解析（PDF / DOCX）+ 结构化能力画像
- Resume-Aware 问题生成（引用简历具体经历）
- 动态追问（回答过简时深挖）
- 6 维度 evidence-based 评分 + 雷达图
- 个性化改进报告 + 30 天成长计划

## 运行

```bash
pip install -r requirements.txt
cp .env.example .env          # 填入 SILICONFLOW_API_KEY
streamlit run app.py
```

## 目录

```
python-backend/
├── app.py              # Streamlit 主应用
├── config.py           # 模型/评分维度/Prompt 模板
├── agents/             # resume_parser / interview / score / summary
├── utils/              # llm_client(SiliconFlow) / file_parser
└── prompts/            # Prompt 工程文档
```

> 产品级的多面试官评分、岗位推荐、JD 解析的真实 LLM 实现，见根目录 `README.md` 第 11 节 Roadmap。
