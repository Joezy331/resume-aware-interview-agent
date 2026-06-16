"""
Summary Agent
负责生成个性化改进报告
"""

from config import SUMMARY_PROMPT


def generate_summary(client, model_name: str, resume_summary: str,
                     score_result: dict, qa_records: list) -> str:
    """
    生成个性化改进报告

    Args:
        client: OpenAI 客户端实例
        model_name: 模型名称
        resume_summary: 简历摘要
        score_result: 评分结果
        qa_records: 问答记录

    Returns:
        Markdown 格式的改进报告
    """
    # 格式化评分结果
    score_text = f"综合评分：{score_result.get('overall_score', 0)}/10\n"
    score_text += f"综合评价：{score_result.get('overall_comment', '')}\n\n"
    for dim_name, dim_data in score_result.get("scores", {}).items():
        score_text += f"- {dim_name}：{dim_data.get('score', 0)}/10 — {dim_data.get('evidence', '')}\n"

    # 格式化问答记录
    qa_text = ""
    for i, qa in enumerate(qa_records, 1):
        qa_text += f"\nQ{i}：{qa.get('question', '')}\nA{i}：{qa.get('answer', '')}\n"

    prompt = SUMMARY_PROMPT.format(
        score_result=score_text,
        resume_summary=resume_summary,
        qa_records=qa_text,
    )

    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": "你是一位职业发展顾问，擅长基于面试表现给出可行动的改进建议。"},
            {"role": "user", "content": prompt},
        ],
        temperature=0.6,
        max_tokens=2048,
    )

    return response.choices[0].message.content.strip()
