"""
Resume Parser Agent
负责从简历文本中提取结构化信息
"""

import json
from config import RESUME_PARSER_PROMPT


def parse_resume(client, model_name: str, resume_text: str) -> dict:
    """
    解析简历文本，返回结构化信息

    Args:
        client: OpenAI 客户端实例
        model_name: 模型名称
        resume_text: 简历原始文本

    Returns:
        解析后的结构化字典
    """
    prompt = RESUME_PARSER_PROMPT.format(resume_text=resume_text)

    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": "你是一位专业的简历解析专家，擅长从简历中提取关键信息并结构化输出。"},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=2048,
    )

    content = response.choices[0].message.content

    # 提取 JSON 部分
    try:
        json_str = _extract_json(content)
        parsed = json.loads(json_str)
    except (json.JSONDecodeError, ValueError):
        # Fallback: 返回原始文本
        parsed = {"raw_text": content, "parse_error": True}

    return parsed


def _extract_json(text: str) -> str:
    """从文本中提取 JSON 块"""
    # 尝试提取 ```json ... ``` 块
    if "```json" in text:
        start = text.index("```json") + 7
        end = text.index("```", start)
        return text[start:end].strip()
    elif "```" in text:
        start = text.index("```") + 3
        end = text.index("```", start)
        return text[start:end].strip()
    else:
        return text.strip()


def format_resume_summary(parsed: dict) -> str:
    """将解析结果格式化为简洁的摘要，供其他 Agent 使用"""
    lines = []

    if parsed.get("name"):
        lines.append(f"姓名：{parsed['name']}")

    # 教育背景
    for edu in parsed.get("education", []):
        lines.append(f"教育：{edu.get('school', '')} - {edu.get('major', '')} ({edu.get('degree', '')})")

    # 工作经历
    for exp in parsed.get("experience", []):
        highlights = "；".join(exp.get("highlights", []))
        lines.append(f"经历：{exp.get('company', '')} - {exp.get('role', '')} | {highlights}")

    # 项目经历
    for proj in parsed.get("projects", []):
        tech = ", ".join(proj.get("tech_stack", []))
        achievements = "；".join(proj.get("achievements", []))
        lines.append(f"项目：{proj.get('name', '')} ({tech}) | {achievements}")

    # 技能
    for category, skills in parsed.get("skills", {}).items():
        if skills:
            lines.append(f"技能·{category}：{', '.join(skills)}")

    return "\n".join(lines)
