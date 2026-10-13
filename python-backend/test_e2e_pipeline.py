"""
端到端真实链路测试（不走 UI）
=====================================================================
验证：简历解析 → JD 感知出题 → 追问决策 → 四面试官 → Chief → 报告
全部使用真实模型调用，任何一步失败都会明确打印，绝不用假数据顶替。

用法：
    cd python-backend
    python test_e2e_pipeline.py
"""

from __future__ import annotations

import json
import sys
import time

from agents.interview import decide_followup, generate_questions_jd_aware
from agents.interviewers import (
    aggregate_dimensions,
    chief_evaluation,
    evaluate_by_role,
    generate_report,
)
from agents.resume_parser import format_resume_summary, parse_resume
from config import INTERVIEWER_ROLES
from utils.llm_client import create_client, get_model_name
from utils.stats import snapshot as stats_snapshot

SAMPLE_RESUME = """
张思远 | 求职意向：AI 产品经理（实习） | shichang@example.com | 138-0000-0000

教育背景
2022-2026  XX大学  信息管理与信息系统  本科  GPA 3.7/4.0

实习经历
2025.03-2025.09  XX科技有限公司  产品实习生
- 负责 AI 客服助手的需求梳理与 Prompt 设计，迭代 12 版提示词，意图识别准确率从 71% 提升至 89%
- 搭建埋点与 A/B 测试框架，对比 3 种对话策略，人均会话轮次提升 1.8 轮
- 协同算法、前端、运营三方，推动功能在 6 周内上线，覆盖 4.2 万月活用户

项目经历
2024.11-2025.02  AI 简历助手（个人项目）
- 角色：产品负责人，带领 4 人小组
- 技术栈：Python / FastAPI / LLM API / Streamlit
- 成果：完成 3 轮用户访谈与 2 次可用性测试，留存率从 22% 提升至 41%

技能
技术：Python、SQL、Figma、Axure
数据：SQL 取数、A/B 实验设计、漏斗分析
产品：需求文档、竞品分析、用户访谈
AI·ML：Prompt 工程、RAG 基础、大模型评测
"""

SAMPLE_JD = """
岗位：AI 产品经理实习生
职责：
1. 负责 AI 应用产品的需求分析与方案设计
2. 设计并持续优化 Prompt，跟进大模型效果评测
3. 用数据驱动产品迭代，设计 A/B 实验并解读结果
4. 跨部门协作推动项目落地
要求：
- 熟悉大语言模型基本原理与应用方式，有 Prompt 工程经验
- 具备数据分析能力，能独立完成 SQL 取数与指标拆解
- 沟通协作能力强，有跨团队推动经验
- 有 AI 相关项目经历者优先
"""


def hr(title: str) -> None:
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def main() -> int:
    t0 = time.time()
    client = create_client()
    model = get_model_name()
    failures: list[str] = []

    hr("① Resume Parser（真实模型）")
    parsed = parse_resume(client, model, SAMPLE_RESUME)
    if parsed.get("parse_error") or parsed.get("error"):
        print(f"❌ 解析失败：{parsed.get('error')}")
        failures.append("简历解析")
        summary = SAMPLE_RESUME[:1500]
    else:
        print("✅ 解析成功")
        print(f"   姓名={parsed.get('name')} 教育{len(parsed.get('education', []))}条 "
              f"经历{len(parsed.get('experience', []))}条 项目{len(parsed.get('projects', []))}条")
        summary = format_resume_summary(parsed)
        print("   摘要前 120 字：", summary[:120].replace("\n", " | "))

    hr("② JD 感知出题（真实模型）")
    questions, q_err = generate_questions_jd_aware(
        client, resume_summary=summary, jd_text=SAMPLE_JD,
        target_role="AI 产品经理实习生", num_questions=3,
    )
    if q_err:
        print(f"❌ 出题失败：{q_err}")
        failures.append("出题")
        return 1
    print(f"✅ 生成 {len(questions)} 题")
    for q in questions:
        print(f"   Q{q['id']} [{q['dimension']}] {q['question'][:60]}…")

    hr("③ 多轮作答 + 追问决策（真实模型）")
    qa_records = []
    answer_pool = [
        "我在 XX 科技做 AI 客服助手时，先梳理了 6 类高频意图，然后设计分层 Prompt：系统层固定角色与约束，示例层放 3 组 few-shot，输出层要求 JSON。迭代 12 版后意图识别准确率从 71% 提到 89%。",
        "我会先定北极星指标，再拆过程指标。比如客服场景，结果是问题解决率，过程是首轮命中率和会话轮次。A/B 实验我会控制流量分配、设定观察周期，并用置信区间判断显著性。",
        "跨团队协作时我习惯先对齐目标和验收标准。上次推 AI 客服功能，算法关注效果、前端关注体验、运营关注投诉率，我拉了一份三方指标看板，每周同步一次，最后 6 周上线。",
    ]
    for i, q in enumerate(questions):
        ans = answer_pool[i % len(answer_pool)]
        qa_records.append({"id": q["id"], "question": q["question"],
                           "dimension": q["dimension"], "answer": ans, "followups": []})
        print(f"   Q{q['id']} 已作答（{len(ans)} 字）")
        # 只在第一题演示追问决策，节省调用时间
        if i == 0:
            d, err = decide_followup(client, q["question"], ans, q["dimension"], followup_count=0)
            if err:
                print(f"   ⚠️ 追问决策失败：{err}")
                failures.append("追问决策")
            else:
                print(f"   追问决策：need={d['need_followup']} · {d['reason'][:60]}")
                if d.get("followup_question"):
                    print(f"   追问内容：{d['followup_question'][:60]}…")
                # 第二次调用验证上限规则
                d2, _ = decide_followup(client, q["question"], ans, q["dimension"], followup_count=1)
                print(f"   已追问1次后再次判定：need={d2['need_followup']} · {d2['reason'][:40]}")

    hr("④ 四位面试官独立评价（真实模型 ×4）")
    reports, errors = [], []
    for key, role in INTERVIEWER_ROLES.items():
        rep, err = evaluate_by_role(client, key, summary, "AI 产品经理实习生", qa_records)
        reports.append(rep)
        if err or not rep.get("is_real"):
            errors.append(f"{role['name']}：{err or rep.get('comment')}")
            print(f"   ❌ {role['name']}：{err or rep.get('comment')}")
        else:
            sc = " ".join(f"{d}={v['score']}" for d, v in rep["scores"].items())
            print(f"   ✅ {role['name']}：{sc} · 建议={rep['recommendation']}")
        if rep.get("missing_dims"):
            print(f"      ⚠️ 缺失维度：{rep['missing_dims']}")
    if errors:
        failures.append("面试官评价")

    hr("⑤ Chief Evaluation（真实模型）")
    chief, chief_err = chief_evaluation(client, reports, "AI 产品经理实习生", qa_records)
    if chief_err or not chief.get("is_real"):
        print(f"❌ Chief 失败：{chief_err or chief.get('error')}")
        failures.append("Chief 评估")
    else:
        print(f"✅ 总分 {chief['overall_score']}（确定性汇总校验 {chief['computed_overall']}）")
        print(f"   建议={chief['verdict']} 置信度={chief['confidence']} "
              f"基于 {chief['based_on']}/{chief['total_roles']} 位面试官")
        print(f"   分歧：{chief['conflicts'] or '无'}")
        print(f"   结论：{chief['final_comment'][:160]}…")
        agg = aggregate_dimensions([r for r in reports if r.get("is_real")])
        print(f"   维度汇总：{json.dumps(agg['dims'], ensure_ascii=False)}")

    hr("⑥ 面试报告（真实模型）")
    if chief.get("is_real"):
        md, rpt_err = generate_report(client, chief, reports, "AI 产品经理实习生", qa_records)
        if rpt_err:
            print(f"❌ 报告失败：{rpt_err}")
            failures.append("报告生成")
        else:
            print(f"✅ 报告生成 {len(md)} 字，前 200 字：")
            print("   " + md[:200].replace("\n", "\n   "))
    else:
        print("⏭ Chief 无效，跳过报告（不用假数据顶替）")

    hr("运行统计")
    s = stats_snapshot()
    print(f"调用 {s['calls']} 次 · 成功 {s['ok']} · 失败 {s['failed']} · 成功率 {s['success_rate']}%")
    print(f"tokens {s['total_tokens']}（提示 {s['prompt_tokens']} / 生成 {s['completion_tokens']}）")
    print(f"平均耗时 {s['avg_latency']}s · 最长 {s['max_latency']}s · 总耗时 {time.time() - t0:.1f}s")
    if s["errors"]:
        print(f"错误分布：{s['errors']}")

    hr("结论")
    if failures:
        print("❌ 以下环节未取得真实模型结果：")
        for f in failures:
            print(f"   - {f}")
        return 1
    print("✅ 全链路真实模型调用成功")
    return 0


if __name__ == "__main__":
    sys.exit(main())
