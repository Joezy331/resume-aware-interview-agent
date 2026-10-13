"""
Resume-Aware Interview Agent
配置文件 - 模型参数、评分维度、Prompt 模板

模型接口：Cline 提供的本地 OpenAI 兼容 API（非 SiliconFlow）
API Key 只从 .streamlit/secrets.toml 的 LLM_API_KEY 读取，本文件不含任何密钥。
"""

# ============ 模型配置 ============
# Base URL 与模型名可被环境变量覆盖（LLM_BASE_URL / MODEL_NAME）
MODEL_CONFIG = {
    "base_url": "http://localhost:8787/v1",
    "model_name": "cline-free/mimo-v2.6-flash",
    "temperature": 0.7,
    "max_tokens": 2048,
    # —— 稳定性参数 ——
    "timeout": 90.0,          # 单次请求超时（秒）
    "max_retries": 2,         # SDK 内置重试
    "retry_attempts": 3,      # 本项目的兜底重试次数
    "retry_backoff": 1.6,     # 指数退避基数
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


# ====================================================================
# 以下内容为本次改造新增：JD 感知出题、追问决策、四面试官、Chief 综合评价
# ====================================================================

# ============ JD 感知出题 ============
JD_AWARE_QUESTION_PROMPT = """你是一位资深面试官。请为一位候选人设计面试问题。

【候选人简历摘要】
{resume_summary}

【目标岗位 JD】
{jd_text}

【目标岗位名称】{target_role}

请生成 {num_questions} 个面试问题，要求：
1. 必须同时结合【简历摘要】与【JD】：命中简历中的真实项目/经历，并指向 JD 明确要求的能力
2. 若 JD 为空，则退化为纯简历驱动出题，并在 resume_ref 中标注"JD未提供"
3. 覆盖不同维度，从简到难排列
4. 每个问题用一句中文说明考察点

严格按以下 JSON 输出（不要输出其他文字）：
{{
  "questions": [
    {{
      "id": 1,
      "question": "问题正文",
      "dimension": "考察维度（技术深度/项目经验/问题解决/沟通能力/文化匹配/成长潜力 之一）",
      "resume_ref": "引用的简历具体内容",
      "jd_ref": "对应的 JD 要求（无则填 未提供）",
      "focus": "一句话考察点"
    }}
  ]
}}"""

# ============ 追问决策 ============
FOLLOWUP_DECIDE_PROMPT = """你是面试流程控制器。判断候选人这个回答是否需要追问。

【原始问题】{question}
【考察维度】{dimension}
【候选人回答】{answer}
【已追问次数】{followup_count}（最多再追问 1 次）

判断标准：
- 回答过于简短、空泛、缺少具体数据/方法/结果 → 需要追问
- 已经充分展开、有细节和结论 → 不需要追问
- 已追问次数 >= 1 → 直接判定不需要追问

严格按以下 JSON 输出：
{{
  "need_followup": true,
  "reason": "一句话判断理由",
  "followup_question": "如果需要追问，写出追问内容；不需要则填空字符串"
}}"""

# ============ 四维面试官角色定义 ============
INTERVIEWER_ROLES = {
    "hr": {
        "key": "hr",
        "name": "HR 面试官",
        "title": "HR · 招聘负责人",
        "focus": "求职动机、沟通表达、稳定性、文化匹配、职业规划清晰度",
        "system": "你是一位资深 HR 面试官，关注候选人的求职动机、沟通表达、价值观与文化匹配、稳定性与职业规划。评价要基于真实回答内容，引用原话作为依据。",
        "dims": ["沟通能力", "文化匹配", "成长潜力"],
    },
    "business": {
        "key": "business",
        "name": "业务面试官",
        "title": "Business · 业务负责人",
        "focus": "业务理解、商业敏感度、数据分析与指标意识、跨部门协作",
        "system": "你是一位业务线负责人面试官，关注候选人对业务的理解、商业敏感度、数据驱动决策能力、跨部门协作与结果导向。评价要基于真实回答内容。",
        "dims": ["问题解决", "沟通能力", "成长潜力"],
    },
    "professional": {
        "key": "professional",
        "name": "专业面试官",
        "title": "Professional · 领域专家",
        "focus": "专业深度、技术/方法掌握、项目细节真实性、问题拆解能力",
        "system": "你是一位专业领域面试官（技术/产品专家），关注候选人的专业深度、方法论掌握程度、项目细节的真实性与严谨性、复杂问题拆解能力。评价要基于真实回答内容，对含糊其辞要明确指出。",
        "dims": ["技术深度", "项目经验", "问题解决"],
    },
    "leader": {
        "key": "leader",
        "name": "Leader 面试官",
        "title": "Leader · 团队负责人",
        "focus": "Owner 意识、抗压能力、影响力与推动力、复盘与成长",
        "system": "你是一位团队 Leader 面试官，关注候选人的 Owner 意识、抗压与韧性、对他人的影响力与推动力、复盘习惯与长期成长潜力。评价要基于真实回答内容。",
        "dims": ["成长潜力", "文化匹配", "项目经验"],
    },
}

INTERVIEWER_SCORE_PROMPT = """请以【{role_name}】的视角，基于下方真实面试记录评价候选人。

你的关注重点：{focus}
你负责评分的维度：{dims}

【候选人简历摘要】
{resume_summary}

【目标岗位】{target_role}

【面试问答记录】
{qa_records}

严格按以下 JSON 输出（分数为 1-10 整数，必须给出引用原话的依据）：
{{
  "role": "{role_key}",
  "scores": {{
    "<维度名>": {{"score": 8, "evidence": "引用的候选人原话或具体行为"}}
  }},
  "strengths": ["1-2 条，来自真实回答"],
  "concerns": ["1-2 条，来自真实回答"],
  "comment": "2-3 句总体评价",
  "recommendation": "strong_hire / hire / hold / no_hire 之一"
}}"""

# ============ Chief 综合评价 ============
CHIEF_EVALUATION_PROMPT = """你是 Chief Evaluation（首席评估官）。四位面试官已分别给出独立评价，请你汇总并给出最终结论。

【目标岗位】{target_role}

【四位面试官评价】
{interviewer_reports}

【面试问答记录】
{qa_records}

请完成：
1. 汇总六维度加权总评（1-10）
2. 明确指出面试官之间的分歧（若某维度最高与最低分差 >= 3，必须点名说明）
3. 给出最终录用建议与理由
4. 指出面试中信息不足、需要补问的地方

严格按以下 JSON 输出：
{{
  "dimension_summary": {{
    "<维度名>": {{"avg": 8.2, "spread": 2, "note": "一致性说明"}}
  }},
  "overall_score": 8.1,
  "verdict": "strong_hire / hire / hold / no_hire 之一",
  "confidence": "high / medium / low",
  "conflicts": ["分歧描述（无则空数组）"],
  "key_reasons": ["2-4 条决定性理由"],
  "gaps_to_probe": ["还需补问的问题（无则空数组）"],
  "final_comment": "3-5 句最终评价"
}}"""

# ============ 面试报告 ============
REPORT_PROMPT = """你是职业发展顾问。请基于以下真实面试评估结果，生成一份改进报告。

【目标岗位】{target_role}

【Chief 综合评估】
{chief_result}

【各面试官评价】
{interviewer_reports}

【面试问答记录】
{qa_records}

输出 Markdown，包含：
1. ## 一句话结论
2. ## 核心优势（2-3 条，须对应真实回答）
3. ## 关键短板（2-3 条，须对应真实回答）
4. ## 30/60/90 天行动计划（每个阶段 2-3 条可执行动作）
5. ## 建议补充练习（针对面试中暴露的问题）

只输出 Markdown 正文，不要包裹在代码块里。"""
