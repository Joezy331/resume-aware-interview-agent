"""
Interview Agent
负责基于简历生成个性化面试问题 + 动态追问

本次改造新增（JD 感知 + 模型驱动的追问决策）：
    generate_questions_jd_aware()  简历 + JD 联合出题
    decide_followup()              由模型判断"追问 or 下一题"
"""

import json
from config import (
    FOLLOWUP_DECIDE_PROMPT,
    FOLLOW_UP_PROMPT,
    INTERVIEW_QUESTION_PROMPT,
    JD_AWARE_QUESTION_PROMPT,
)
from utils.llm_client import chat_json, chat_text


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


# ====================================================================
# 新增：JD 感知出题 + 模型驱动的追问决策
# ====================================================================

def generate_questions_jd_aware(
    client,
    resume_summary: str,
    jd_text: str = "",
    target_role: str = "AI 产品经理",
    num_questions: int = 5,
) -> tuple[list, str | None]:
    """
    简历 + JD 联合出题（真实模型调用）。

    Returns:
        (questions, error)
        - 成功：questions 为 [{"id","question","dimension","resume_ref","jd_ref","focus"}]
        - 失败：([] , "错误原因") —— 调用方必须显式标注，不得用假题顶替
    """
    prompt = JD_AWARE_QUESTION_PROMPT.format(
        resume_summary=resume_summary or "（未提供简历，请基于岗位通用能力出题）",
        jd_text=jd_text or "（JD 未提供，请基于岗位通用要求出题）",
        target_role=target_role or "（未指定岗位）",
        num_questions=num_questions,
    )

    obj, err = chat_json(
        client,
        system="你是一位资深面试官，擅长结合候选人简历与目标岗位 JD 设计有区分度的面试问题。",
        user=prompt,
        temperature=0.7,
        max_tokens=2048,
        fallback=None,
    )
    if err or not isinstance(obj, dict):
        return [], err or "出题返回结构异常"

    raw = obj.get("questions") or []
    if not isinstance(raw, list) or not raw:
        return [], "模型未返回任何题目"

    questions = []
    for i, q in enumerate(raw, 1):
        if not isinstance(q, dict):
            continue
        text = str(q.get("question", "")).strip()
        if not text:
            continue
        questions.append(
            {
                "id": len(questions) + 1,
                "question": text,
                "dimension": str(q.get("dimension", "综合")).strip(),
                "resume_ref": str(q.get("resume_ref", "")).strip(),
                "jd_ref": str(q.get("jd_ref", "")).strip(),
                "focus": str(q.get("focus", "")).strip(),
            }
        )

    if not questions:
        return [], "模型返回的题目全部为空"
    return questions, None


def decide_followup(
    client,
    question: str,
    answer: str,
    dimension: str,
    followup_count: int = 0,
) -> tuple[dict, str | None]:
    """
    由模型判断：这个回答是「继续追问」还是「进入下一题」。

    Returns:
        ({"need_followup": bool, "reason": str, "followup_question": str}, error)
    """
    # 硬规则兜底：已追问过一次，直接进入下一题
    if followup_count >= 1:
        return {"need_followup": False, "reason": "已达到追问上限（1 次）", "followup_question": ""}, None

    if not answer or len(answer.strip()) < 5:
        return {
            "need_followup": False,
            "reason": "回答为空或过短，无法追问（按无效回答处理）",
            "followup_question": "",
        }, None

    prompt = FOLLOWUP_DECIDE_PROMPT.format(
        question=question,
        dimension=dimension,
        answer=answer,
        followup_count=followup_count,
    )

    obj, err = chat_json(
        client,
        system="你是严谨的面试流程控制器，只依据回答内容本身做判断。",
        user=prompt,
        temperature=0.2,
        max_tokens=1024,
        fallback=None,
    )
    if err or not isinstance(obj, dict):
        return {"need_followup": False, "reason": f"追问决策失败：{err}", "followup_question": ""}, err

    need = bool(obj.get("need_followup"))
    fu = str(obj.get("followup_question", "")).strip() if need else ""
    if need and not fu:
        # 模型说要追问但没给问题 → 降级为不追问，避免流程卡死
        return {
            "need_followup": False,
            "reason": "模型判定需追问但未给出追问内容，已降级进入下一题",
            "followup_question": "",
        }, None

    return {
        "need_followup": need,
        "reason": str(obj.get("reason", ""))[:200],
        "followup_question": fu,
    }, None


def generate_follow_up_safe(
    client,
    original_question: str,
    candidate_answer: str,
    dimension: str,
) -> tuple[str, str | None]:
    """兜底追问生成（模型决策失败时的备用路径）"""
    try:
        out = chat_text(
            client,
            system="你是一位善于引导的面试官，擅长通过追问深入评估候选人能力。",
            user=FOLLOW_UP_PROMPT.format(
                original_question=original_question,
                candidate_answer=candidate_answer,
                dimension=dimension,
            ),
            temperature=0.6,
            max_tokens=512,
        )
    except Exception as e:  # noqa: BLE001
        return "", f"追问生成失败：{e}"
    if not out.strip():
        return "", "追问生成失败：模型返回空内容"
    return out.strip(), None
