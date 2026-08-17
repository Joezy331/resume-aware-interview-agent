# Score Agent — Prompt 设计（多维度评分）

> 对应代码：`agents/score.py` + `config.SCORE_PROMPT` + `config.SCORE_DIMENSIONS`

## 目标
基于完整面试问答记录，输出 **6 维度评分 + 证据 + 综合评语**，为雷达图与改进报告提供数据。

## 评分维度（来自 `config.SCORE_DIMENSIONS`）
| 维度 | 评估重点 |
|------|----------|
| 沟通能力 | 语言表达清晰度、逻辑连贯性、观点传达准确性 |
| 技术深度 | 技术栈理解、岗位硬技能掌握 |
| 项目经验 | 项目细节、个人贡献与成果体现 |
| 问题解决 | 追问应变、思路清晰度 |
| 文化匹配 | 价值观与岗位匹配、团队协作意识 |
| 成长潜力 | 学习能力、自驱力、职业规划清晰度 |

## Prompt 模板（最终下发形态）
```
你是一位专业的面试评估专家。请基于以下面试记录，对候选人进行6维度评分。

【候选人简历摘要】
{resume_summary}

【面试问答记录】
{qa_records}

评分维度及标准：
{dimension_descriptions}

请以 JSON 格式输出评分结果：
{
  "scores": {
    "沟通能力": {"score": 0, "evidence": "评分依据"},
    "技术深度": {"score": 0, "evidence": "评分依据"},
    "项目经验": {"score": 0, "evidence": "评分依据"},
    "问题解决": {"score": 0, "evidence": "评分依据"},
    "文化匹配": {"score": 0, "evidence": "评分依据"},
    "成长潜力": {"score": 0, "evidence": "评分依据"}
  },
  "overall_score": 0,
  "overall_comment": "综合评价（2-3句话）"
}
评分范围：1-10 分，1 为最低，10 为最高。
```

## 设计要点（AI PM 视角）
- **Evidence-based 评分**：每个维度强制返回 `evidence`（评分依据），将「主观印象」转为「可追溯证据」，是缓解「单一 AI 评分偏差」的关键设计。
- **维度与问题对齐**：`dimension_descriptions` 由 `SCORE_DIMENSIONS` 注入，与 Interview Agent 的问题维度一致，保证「问什么、评什么」。
- **结构化可消费**：`scores` 字段直接驱动前端雷达图（`get_radar_chart_data`）与维度进度条，形成数据闭环。
- **容错默认**：代码层对解析失败做兜底（默认 5 分 + 说明），保证极端情况下体验不崩。
