"""
Interview Agent
负责基于简历生成个性化面试问题 + 动态追问
"""

import json
from config import INTERVIEW_QUESTION_PROMPT, FOLLOW_UP_PROMPT


def generate_questions(client, model_name: str, resume_summary: str,
                       target_role: str = "产品经理", num_questions: int = 3) -> list:
    """
    基于简历摘要生成面试问题

    Args:
        client: OpenAI 客户端实例
        model_name: 模型名称
        resume_summary: 简历摘要文本
        target_role: 目标岗位
        num_questions: 问题数量

    Returns:
        问题列表 [{"id": 1, "question": "...", "dimension": "...", "resume_ref": "..."}]
    """
    prompt = INTERVIEW_QUESTION_PROMPT.format(
        resume_summary=resume_summary,
        target_role=target_role,
        num_questions=num_questions,
    )

    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": "你是一位资深面试官，擅长根据候选人简历设计有针对性的面试问题。"},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=2048,
    )

    content = response.choices[0].message.content

    try:
        json_str = _extract_json(content)
        result = json.loads(json_str)
        questions = result.get("questions", [])
    except (json.JSONDecodeError, ValueError):
        # Fallback: 将整段文本作为单个问题
        questions = [{"id": 1, "question": content, "dimension": "综合", "resume_ref": ""}]

    return questions


def generate_follow_up(client, model_name: str, original_question: str,
                       candidate_answer: str, dimension: str) -> str:
    """
    检测到回答过短时，生成追问

    Args:
        client: OpenAI 客户端实例
        model_name: 模型名称
        original_question: 原始问题
        candidate_answer: 候选人回答
        dimension: 考察维度

    Returns:
        追问文本
    """
    prompt = FOLLOW_UP_PROMPT.format(
        original_question=original_question,
        candidate_answer=candidate_answer,
        dimension=dimension,
    )

    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": "你是一位善于引导的面试官，擅长通过追问深入评估候选人能力。"},
            {"role": "user", "content": prompt},
        ],
        temperature=0.6,
        max_tokens=512,
    )

    return response.choices[0].message.content.strip()


def should_follow_up(answer: str, threshold: int = 120) -> bool:
    """
    判断是否需要追问

    Args:
        answer: 候选人回答
        threshold: 字数阈值，低于此值触发追问

    Returns:
        是否需要追问
    """
    return len(answer.strip()) < threshold


def _extract_json(text: str) -> str:
    """从文本中提取 JSON 块"""
    if "```json" in text:
        start = text.index("```json") + 7
        end = text.index("```", start)
        return text[start:end].strip()
    elif "```" in text:
        start = text.index("```") + 3
        end = text.index("```", start)
        return text[start:end].strip()
    return text.strip()
