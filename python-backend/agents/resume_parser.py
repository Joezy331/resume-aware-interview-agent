"""
Resume Parser Agent
负责从简历文本中提取结构化信息
"""

import json
from config import RESUME_PARSER_PROMPT
from utils.llm_client import chat_json


def parse_resume(client, model_name: str, resume_text: str) -> dict:
    """
    解析简历文本，返回结构化信息（真实模型调用）。

    失败时返回带 parse_error / error 字段的字典，
    **不填充任何假的结构化字段**，调用方须据此显式标注。
    """
    prompt = RESUME_PARSER_PROMPT.format(resume_text=resume_text)

    parsed, err = chat_json(
        client,
        system="你是一位专业的简历解析专家，擅长从简历中提取关键信息并结构化输出。",
        user=prompt,
        temperature=0.3,
        max_tokens=2048,
        fallback=None,
    )

    if err or not isinstance(parsed, dict):
        return {"parse_error": True, "error": err or "返回结构异常", "raw_text": ""}

    if parsed.get("parse_error"):
        return parsed

    # 补齐缺省键，保证下游 format_resume_summary 不会 KeyError
    parsed.setdefault("education", [])
    parsed.setdefault("experience", [])
    parsed.setdefault("projects", [])
    parsed.setdefault("skills", {})
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
