"""
Resume-Aware Interview Agent
配置文件 - 模型参数、评分维度、Prompt 模板
"""

# ============ 模型配置 ============
MODEL_CONFIG = {
    "base_url": "https://api.siliconflow.cn/v1",
    "model_name": "Qwen/Qwen2.5-72B-Instruct",
    "temperature": 0.7,
    "max_tokens": 2048,
}

# ============ 评分维度 ============
SCORE_DIMENSIONS = {
    "沟通能力": "语言表达是否清晰、逻辑是否连贯、是否能准确传达观点",
    "技术深度": "对技术栈的理解程度、是否具备项目所需的硬技能",
    "项目经验": "项目描述是否有细节、是否体现个人贡献和成果",
    "问题解决": "面对追问时的应变能力、思路是否清晰",
    "文化匹配": "价值观是否与目标岗位匹配、团队协作意识",
    "成长潜力": "学习能力、自我驱动力、职业规划清晰度",
}

# ============ Agent Prompt 模板 ============

RESUME_PARSER_PROMPT = """你是一位专业的简历解析专家。请从以下简历文本中提取结构化信息。

要求提取的信息：
1. 基本信息：姓名、邮箱、电话
2. 教育背景：学校、专业、学历、时间段
3. 工作经历：公司、职位、时间段、核心职责（不超过3条）
4. 项目经历：项目名、角色、技术栈、核心成果（不超过3条）
5. 技能清单：按类别分组（技术/数据/产品/AI·ML）

请以 JSON 格式输出，结构如下：
```json
{{
  "name": "",
  "email": "",
  "phone": "",
  "education": [{{"school": "", "major": "", "degree": "", "period": ""}}],
  "experience": [{{"company": "", "role": "", "period": "", "highlights": []}}],
  "projects": [{{"name": "", "role": "", "tech_stack": [], "achievements": []}}],
  "skills": {{
    "技术": [],
    "数据": [],
    "产品": [],
    "AI·ML": []
  }}
}}
```

简历文本：
{resume_text}"""

INTERVIEW_QUESTION_PROMPT = """你是一位资深的面试官。你正在面试一位候选人，他/她的简历信息如下：

【简历摘要】
{resume_summary}

【目标岗位】{target_role}

请基于候选人的简历内容，生成 {num_questions} 个面试问题。

要求：
1. 问题必须与简历内容直接相关（引用具体的项目或经历）
2. 覆盖不同维度：技术深度、项目经验、问题解决、成长潜力
3. 从简到难排列
4. 每个问题后标注考察维度（如：[技术深度]）

请以 JSON 格式输出：
```json
{{
  "questions": [
    {{"id": 1, "question": "...", "dimension": "技术深度", "resume_ref": "引用的简历内容"}},
    ...
  ]
}}
```"""

FOLLOW_UP_PROMPT = """候选人对上一个问题的回答过于简短（不足120字），需要追问以深入评估。

【原始问题】{original_question}
【候选人回答】{candidate_answer}
【考察维度】{dimension}

请生成一个追问，要求：
1. 针对回答中的薄弱点或模糊处深挖
2. 引导候选人提供更具体的细节（数据、方法、成果）
3. 语气友善但专业

直接输出追问内容，不要输出 JSON。"""

SCORE_PROMPT = """你是一位专业的面试评估专家。请基于以下面试记录，对候选人进行6维度评分。

【候选人简历摘要】
{resume_summary}

【面试问答记录】
{qa_records}

评分维度及标准：
{dimension_descriptions}

请以 JSON 格式输出评分结果：
```json
{{
  "scores": {{
    "沟通能力": {{"score": 0, "evidence": "评分依据"}},
    "技术深度": {{"score": 0, "evidence": "评分依据"}},
    "项目经验": {{"score": 0, "evidence": "评分依据"}},
    "问题解决": {{"score": 0, "evidence": "评分依据"}},
    "文化匹配": {{"score": 0, "evidence": "评分依据"}},
    "成长潜力": {{"score": 0, "evidence": "评分依据"}}
  }},
  "overall_score": 0,
  "overall_comment": "综合评价（2-3句话）"
}}
```

评分范围：1-10 分，1 为最低，10 为最高。"""

SUMMARY_PROMPT = """你是一位职业发展顾问。请基于以下面试评分结果，生成一份个性化的改进报告。

【面试评分】
{score_result}

【候选人简历摘要】
{resume_summary}

【面试问答记录】
{qa_records}

请输出以下内容：

1. **核心优势**（2-3条）：候选人最突出的能力
2. **关键短板**（2-3条）：最需要提升的维度
3. **改进建议**（每个短板对应1-2条可行动的建议）
4. **30天行动计划**：具体的、可执行的学习/练习计划

请以 Markdown 格式输出。"""
