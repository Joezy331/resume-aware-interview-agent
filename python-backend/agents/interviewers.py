"""
Multi-Interviewer Agents（HR / 业务 / 专业 / Leader）+ Chief Evaluation
=====================================================================
设计原则：
  * 每个角色独立调用真实模型，互不共享上下文，互不"参考"他人结论。
  * 任何一次调用失败 / 解析失败，都会返回带 error 字段的结果，
    并在 Streamlit 界面上以 ⚠️ 明确标注「未取得真实模型结果」。
  * **绝不用静态假数据冒充模型输出**：失败时 scores 为空，不填默认分。

对外接口：
    evaluate_by_role(client, role_key, ...)      -> (report, error)
    run_all_interviewers(client, ...)            -> (reports, errors)
    chief_evaluation(client, reports, ...)       -> (result, error)
    generate_report(client, chief, reports, ...) -> (markdown, error)
"""

from __future__ import annotations

import json

from config import (
    CHIEF_EVALUATION_PROMPT,
    INTERVIEWER_ROLES,
    INTERVIEWER_SCORE_PROMPT,
    REPORT_PROMPT,
    SCORE_DIMENSIONS,
)
from utils.llm_client import chat_json, chat_text

# 失败占位：明确标注，不含任何伪造分数
_FALLBACK_REPORT = {
    "role": "",
    "scores": {},
    "strengths": [],
    "concerns": [],
    "comment": "",
    "recommendation": "unknown",
    "is_real": False,
}


def _fmt_qa(qa_records: list) -> str:
    """把问答记录格式化为 Prompt 片段（含追问）"""
    if not qa_records:
        return "（本次面试没有有效问答记录）"

    lines = []
    for i, qa in enumerate(qa_records, 1):
        lines.append(f"Q{i} [{qa.get('dimension', '未标注')}]：{qa.get('question', '')}")
        lines.append(f"A{i}：{qa.get('answer', '')}")
        for j, fu in enumerate(qa.get("followups", []) or [], 1):
            lines.append(f"  └ 追问{i}.{j}：{fu.get('question', '')}")
            lines.append(f"  └ 补充回答{i}.{j}：{fu.get('answer', '')}")
        lines.append("")
    return "\n".join(lines)


def evaluate_by_role(
    client,
    role_key: str,
    resume_summary: str,
    target_role: str,
    qa_records: list,
) -> tuple[dict, str | None]:
    """
    单个面试官角色的独立评价。

    Returns:
        (report, error) —— error 为 None 表示真实模型结果
    """
    role = INTERVIEWER_ROLES.get(role_key)
    if not role:
        return dict(_FALLBACK_REPORT, role=role_key, comment=f"未知角色 {role_key}"), f"未知角色 {role_key}"

    prompt = INTERVIEWER_SCORE_PROMPT.format(
        role_name=role["name"],
        focus=role["focus"],
        dims="、".join(role["dims"]),
        resume_summary=resume_summary or "（未提供简历）",
        target_role=target_role or "（未指定岗位）",
        qa_records=_fmt_qa(qa_records),
        role_key=role_key,
    )

    obj, err = chat_json(
        client,
        system=role["system"],
        user=prompt,
        temperature=0.3,
        max_tokens=2048,
        fallback=None,
    )

    if err or not isinstance(obj, dict):
        return dict(_FALLBACK_REPORT, role=role_key, comment=f"评价失败：{err}"), err or "返回结构异常"

    # 规范化：只保留合法维度与 1-10 的分值
    scores = {}
    raw_scores = obj.get("scores") or {}
    for dim in role["dims"]:
        item = raw_scores.get(dim)
        if isinstance(item, dict) and isinstance(item.get("score"), (int, float)):
            scores[dim] = {
                "score": max(1, min(10, round(float(item["score"])))),
                "evidence": str(item.get("evidence", ""))[:300],
            }
        elif isinstance(item, (int, float)):
            scores[dim] = {"score": max(1, min(10, round(float(item)))), "evidence": ""}

    report = {
        "role": role_key,
        "role_name": role["name"],
        "role_title": role["title"],
        "focus": role["focus"],
        "scores": scores,
        "strengths": [str(s) for s in (obj.get("strengths") or [])][:3],
        "concerns": [str(s) for s in (obj.get("concerns") or [])][:3],
        "comment": str(obj.get("comment", ""))[:600],
        "recommendation": str(obj.get("recommendation", "unknown")),
        "is_real": True,
    }

    # 维度缺失也算异常，但不至于判失败——标注出来
    if len(scores) < len(role["dims"]):
        report["partial"] = True
        report["missing_dims"] = [d for d in role["dims"] if d not in scores]

    return report, None


def run_all_interviewers(
    client,
    resume_summary: str,
    target_role: str,
    qa_records: list,
    role_keys: list[str] | None = None,
) -> tuple[list[dict], list[str]]:
    """
    依次调用四位面试官（HR / 业务 / 专业 / Leader）。

    Returns:
        (reports, errors) —— errors 非空时，UI 必须告警
    """
    keys = role_keys or ["hr", "business", "professional", "leader"]
    reports, errors = [], []

    for key in keys:
        report, err = evaluate_by_role(client, key, resume_summary, target_role, qa_records)
        reports.append(report)
        if err:
            errors.append(f"{INTERVIEWER_ROLES.get(key, {}).get('name', key)}：{err}")

    return reports, errors


def _fmt_interviewer_reports(reports: list[dict]) -> str:
    """把四位面试官结果序列化给 Chief"""
    if not reports:
        return "（没有任何面试官给出有效评价）"

    blocks = []
    for r in reports:
        name = r.get("role_name") or r.get("role")
        if not r.get("is_real"):
            blocks.append(f"【{name}】⚠️ 未取得真实结果：{r.get('comment', '')}")
            continue
        score_txt = "；".join(
            f"{d}={v['score']}（{v['evidence'][:60]}）" for d, v in r.get("scores", {}).items()
        )
        blocks.append(
            f"【{name}】关注：{r.get('focus', '')}\n"
            f"  评分：{score_txt or '无'}\n"
            f"  优势：{'; '.join(r.get('strengths', []))}\n"
            f"  顾虑：{'; '.join(r.get('concerns', []))}\n"
            f"  结论：{r.get('recommendation')} — {r.get('comment', '')}"
        )
    return "\n\n".join(blocks)


def chief_evaluation(
    client,
    reports: list[dict],
    target_role: str,
    qa_records: list,
) -> tuple[dict, str | None]:
    """
    Chief Evaluation：汇总四位面试官，识别分歧，给出最终建议。

    Returns:
        (result, error) —— error 非 None 时 result 不可用
    """
    real_reports = [r for r in reports if r.get("is_real")]
    if not real_reports:
        return {
            "is_real": False,
            "error": "四位面试官均未取得真实模型结果，Chief 评估无法进行",
        }, "无有效面试官结果，Chief 评估跳过"

    prompt = CHIEF_EVALUATION_PROMPT.format(
        target_role=target_role or "（未指定岗位）",
        interviewer_reports=_fmt_interviewer_reports(reports),
        qa_records=_fmt_qa(qa_records),
    )

    obj, err = chat_json(
        client,
        system=(
            "你是首席评估官，负责汇总多位面试官意见、识别分歧并给出最终录用建议。"
            "必须基于他人给出的真实评分证据，不得臆造。"
        ),
        user=prompt,
        temperature=0.2,
        max_tokens=2048,
        fallback=None,
    )

    if err or not isinstance(obj, dict):
        return {"is_real": False, "error": err or "返回结构异常"}, err or "返回结构异常"

    # 用面试官原始评分做一次确定性汇总，作为模型结论的交叉校验
    computed = aggregate_dimensions(real_reports)

    overall = obj.get("overall_score")
    try:
        overall = round(float(overall), 1) if overall is not None else None
    except (TypeError, ValueError):
        overall = None

    return {
        "is_real": True,
        "dimension_summary": obj.get("dimension_summary") or {},
        "overall_score": overall,
        "computed_overall": computed.get("overall"),
        "computed_dims": computed.get("dims", {}),
        "verdict": str(obj.get("verdict", "unknown")),
        "confidence": str(obj.get("confidence", "unknown")),
        "conflicts": [str(c) for c in (obj.get("conflicts") or [])],
        "key_reasons": [str(r) for r in (obj.get("key_reasons") or [])][:5],
        "gaps_to_probe": [str(g) for g in (obj.get("gaps_to_probe") or [])][:5],
        "final_comment": str(obj.get("final_comment", ""))[:800],
        "based_on": len(real_reports),
        "total_roles": len(reports),
    }, None


def aggregate_dimensions(reports: list[dict]) -> dict:
    """
    确定性汇总（不走模型）：把各面试官对自己维度的打分，
    按维度求平均与极差，用于交叉校验 Chief 的模型结论。
    """
    bucket: dict[str, list[int]] = {}
    for r in reports:
        for dim, val in (r.get("scores") or {}).items():
            bucket.setdefault(dim, []).append(int(val["score"]))

    dims = {}
    for dim, vals in bucket.items():
        dims[dim] = {
            "avg": round(sum(vals) / len(vals), 1),
            "min": min(vals),
            "max": max(vals),
            "spread": max(vals) - min(vals),
            "n": len(vals),
        }

    all_scores = [v for vals in bucket.values() for v in vals]
    overall = round(sum(all_scores) / len(all_scores), 1) if all_scores else None
    return {"dims": dims, "overall": overall}


def generate_report(
    client,
    chief: dict,
    reports: list[dict],
    target_role: str,
    qa_records: list,
) -> tuple[str, str | None]:
    """
    生成面试报告（Markdown）。

    Returns:
        (markdown, error) —— error 非 None 时 markdown 为空串
    """
    if not chief.get("is_real"):
        return "", "Chief 评估无效，无法生成报告"

    prompt = REPORT_PROMPT.format(
        target_role=target_role or "（未指定岗位）",
        chief_result=json.dumps(
            {
                "overall_score": chief.get("overall_score"),
                "verdict": chief.get("verdict"),
                "confidence": chief.get("confidence"),
                "key_reasons": chief.get("key_reasons"),
                "conflicts": chief.get("conflicts"),
                "final_comment": chief.get("final_comment"),
            },
            ensure_ascii=False,
            indent=2,
        ),
        interviewer_reports=_fmt_interviewer_reports(reports),
        qa_records=_fmt_qa(qa_records),
    )

    try:
        md = chat_text(
            client,
            system="你是职业发展顾问，输出结构清晰的 Markdown 报告。",
            user=prompt,
            temperature=0.5,
            max_tokens=2500,
        )
    except Exception as e:  # noqa: BLE001
        return "", f"报告生成失败：{e}"

    if not md.strip():
        return "", "报告生成失败：模型返回空内容"

    # 去掉可能的代码块包裹
    if md.strip().startswith("```markdown"):
        md = md.strip()[len("```markdown") :].strip()
        if md.endswith("```"):
            md = md[:-3].strip()
    elif md.strip().startswith("```"):
        md = md.strip()[3:].strip()
        if md.endswith("```"):
            md = md[:-3].strip()

    return md, None


def get_all_dimensions() -> list[str]:
    """返回六维度列表"""
    return list(SCORE_DIMENSIONS.keys())
