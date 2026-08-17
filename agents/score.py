"""
Score Agent
负责6维度评分 + 可视化雷达图数据
"""

import json
from config import SCORE_PROMPT, SCORE_DIMENSIONS


def score_interview(client, model_name: str, resume_summary: str,
                    qa_records: list) -> dict:
    """
    对面试表现进行6维度评分

    Args:
        client: OpenAI 客户端实例
        model_name: 模型名称
        resume_summary: 简历摘要
        qa_records: 问答记录 [{"question": "...", "answer": "...", "dimension": "..."}]

    Returns:
        评分结果字典
    """
    # 格式化维度描述
    dimension_descriptions = "\n".join(
        [f"- {k}：{v}" for k, v in SCORE_DIMENSIONS.items()]
    )

    # 格式化问答记录
    qa_text = ""
    for i, qa in enumerate(qa_records, 1):
        qa_text += f"\nQ{i} [{qa.get('dimension', '')}]：{qa.get('question', '')}\n"
        qa_text += f"A{i}：{qa.get('answer', '')}\n"

    prompt = SCORE_PROMPT.format(
        resume_summary=resume_summary,
        qa_records=qa_text,
        dimension_descriptions=dimension_descriptions,
    )

    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": "你是一位专业的面试评估专家，擅长从多个维度客观评价候选人表现。"},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=2048,
    )

    content = response.choices[0].message.content

    try:
        json_str = _extract_json(content)
        result = json.loads(json_str)
    except (json.JSONDecodeError, ValueError):
        result = {
            "scores": {dim: {"score": 5, "evidence": "解析失败，默认评分"} for dim in SCORE_DIMENSIONS},
            "overall_score": 5,
            "overall_comment": "评分解析失败，请重新评分",
            "parse_error": True,
        }

    return result


def get_radar_chart_data(score_result: dict) -> tuple:
    """
    从评分结果中提取雷达图数据

    Returns:
        (dimensions, scores, evidence_list)
    """
    dimensions = []
    scores = []
    evidence_list = []

    for dim_name in SCORE_DIMENSIONS.keys():
        dim_data = score_result.get("scores", {}).get(dim_name, {})
        dimensions.append(dim_name)
        scores.append(dim_data.get("score", 0))
        evidence_list.append(dim_data.get("evidence", ""))

    return dimensions, scores, evidence_list


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
