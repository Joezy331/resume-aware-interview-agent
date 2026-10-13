"""
AI Career Copilot · Streamlit 主应用
=====================================================================
真实模型链路：Cline 本地 OpenAI 兼容 API
    Base URL : http://localhost:8787/v1
    Model    : cline-free/mimo-v2.6-flash
    API Key  : .streamlit/secrets.toml 的 LLM_API_KEY（不出现在代码/日志/界面）

流程：
    ① 简历 + JD 上传/粘贴
    ② Resume Parser（真实模型）解析
    ③ 简历+JD 感知出题（真实模型）
    ④ 多轮作答：每题由模型决定「追问」还是「进入下一题」
    ⑤ 四位面试官（HR/业务/专业/Leader）独立评价
    ⑥ Chief Evaluation 汇总
    ⑦ 面试报告 + 运行统计

凡是调用失败或解析失败的模块，界面一律以 ⚠️ 明示「未取得真实模型结果」，
不使用任何静态假数据顶替。
"""

from __future__ import annotations

import io
import sys
import time
import traceback
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

# 保证以 `streamlit run streamlit_app.py` 启动时能 import 到 config / utils / agents
sys.path.insert(0, str(Path(__file__).resolve().parent))

from agents.interview import decide_followup, generate_questions_jd_aware  # noqa: E402
from agents.interviewers import (  # noqa: E402
    aggregate_dimensions,
    chief_evaluation,
    evaluate_by_role,
    generate_report,
)
from agents.resume_parser import format_resume_summary, parse_resume  # noqa: E402
from config import INTERVIEWER_ROLES, MODEL_CONFIG, SCORE_DIMENSIONS  # noqa: E402
from utils.file_parser import extract_resume_text, validate_resume_text  # noqa: E402
from utils.llm_client import create_client, get_base_url, get_model_name  # noqa: E402
from utils.stats import snapshot as stats_snapshot  # noqa: E402

# ---------------------------------------------------------------- 页面配置
st.set_page_config(
    page_title="AI Career Copilot · 真实模型面试",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
<style>
  .block-container { padding-top: 2rem; max-width: 1200px; }
  .stChatMessage { border-radius: 12px; }
  .warn-box { background:#FFF4E5; border-left:4px solid #F59E0B; padding:10px 14px;
              border-radius:6px; margin:8px 0; color:#7C4A03; font-size:14px; }
  .ok-box   { background:#ECFDF5; border-left:4px solid #10B981; padding:10px 14px;
              border-radius:6px; margin:8px 0; color:#065F46; font-size:14px; }
  .meta     { color:#6B7280; font-size:12px; }
</style>
""",
    unsafe_allow_html=True,
)


# ---------------------------------------------------------------- 会话状态
def init_state() -> None:
    defaults = {
        "stage": "setup",          # setup → interviewing → evaluating → done
        "client": None,
        "resume_text": "",
        "jd_text": "",
        "target_role": "AI 产品经理",
        "num_questions": 4,
        "parsed_resume": None,
        "resume_error": None,
        "resume_summary": "",
        "questions": [],
        "questions_error": None,
        "q_index": 0,
        "qa_records": [],
        "pending_followup": None,   # {"question":..., "reason":...}
        "followup_count": 0,
        "reports": [],
        "reports_errors": [],
        "chief": None,
        "chief_error": None,
        "report_md": "",
        "report_error": None,
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v


init_state()


def get_client():
    """懒加载客户端，避免 Key 缺失时直接崩页面"""
    if st.session_state.client is None:
        st.session_state.client = create_client()
    return st.session_state.client


def warn(msg: str) -> None:
    st.markdown(f'<div class="warn-box">⚠️ {msg}</div>', unsafe_allow_html=True)


def ok(msg: str) -> None:
    st.markdown(f'<div class="ok-box">✅ {msg}</div>', unsafe_allow_html=True)


# ---------------------------------------------------------------- 侧边栏
def render_sidebar() -> None:
    with st.sidebar:
        st.title("🎯 AI Career Copilot")
        st.markdown('<div class="meta">Resume-Aware Interview Agent</div>', unsafe_allow_html=True)
        st.divider()

        st.subheader("模型配置")
        st.code(
            f"Base URL : {get_base_url()}\n"
            f"Model    : {get_model_name()}\n"
            f"Timeout  : {MODEL_CONFIG['timeout']}s",
            language="text",
        )
        st.caption("API Key 从 .streamlit/secrets.toml 读取，界面与日志均不显示。")

        st.divider()
        st.subheader("运行统计")
        s = stats_snapshot()
        c1, c2 = st.columns(2)
        c1.metric("模型调用", s["calls"])
        c2.metric("成功率", f"{s['success_rate']}%")
        c1.metric("成功 / 失败", f"{s['ok']} / {s['failed']}")
        c2.metric("平均耗时", f"{s['avg_latency']}s")
        st.metric("累计 tokens", s["total_tokens"])
        if s["errors"]:
            st.caption("错误分布：" + "，".join(f"{k}×{v}" for k, v in s["errors"].items()))

        st.divider()
        st.subheader("面试进度")
        total = len(st.session_state.questions)
        cur = st.session_state.q_index
        if total:
            st.progress(min(cur / total, 1.0))
            st.caption(f"第 {min(cur + 1, total)} / {total} 题 · 已记录 {len(st.session_state.qa_records)} 轮")
        else:
            st.caption("尚未开始")

        if st.button("🔄 重置本轮面试", use_container_width=True):
            for k in list(st.session_state.keys()):
                del st.session_state[k]
            st.rerun()


render_sidebar()


# ================================================================ ① 准备阶段
def stage_setup() -> None:
    st.header("① 上传简历与目标 JD")
    st.caption("简历与 JD 都会送入真实模型进行解析与出题。")

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("简历")
        up = st.file_uploader("上传 PDF / DOCX / TXT", type=["pdf", "docx", "txt"], key="resume_up")
        manual = st.text_area(
            "或直接粘贴简历文本",
            height=180,
            key="resume_manual",
            placeholder="粘贴简历全文…（留空则使用上传文件）",
        )
        if up is not None:
            try:
                text = extract_resume_text(io.BytesIO(up.read()), up.name)
                st.session_state.resume_text = text
                ok(f"已读取 {up.name}（{len(text)} 字）")
            except Exception as e:  # noqa: BLE001
                warn(f"文件解析失败：{e}")
        elif manual.strip():
            st.session_state.resume_text = manual.strip()
        with st.expander("查看当前简历文本", expanded=False):
            st.text(st.session_state.resume_text[:1500] or "（空）")

    with col2:
        st.subheader("目标岗位 JD")
        jd_up = st.file_uploader("上传 JD（TXT）", type=["txt", "md"], key="jd_up")
        jd_manual = st.text_area(
            "或直接粘贴 JD",
            height=180,
            key="jd_manual",
            placeholder="粘贴岗位描述…（可留空，退化为纯简历驱动）",
        )
        if jd_up is not None:
            st.session_state.jd_text = jd_up.read().decode("utf-8", errors="ignore")
        elif jd_manual.strip():
            st.session_state.jd_text = jd_manual.strip()
        st.text_input("目标岗位名称", key="target_role")
        st.slider("面试题目数量", min_value=2, max_value=8, value=4, key="num_questions")
        with st.expander("查看当前 JD", expanded=False):
            st.text(st.session_state.jd_text[:1000] or "（空，将按岗位通用要求出题）")

    st.divider()

    if st.button("🚀 解析简历并开始面试", type="primary", use_container_width=True):
        if not st.session_state.resume_text.strip():
            warn("请先提供简历内容（上传或粘贴）。")
            return

        # —— 简历解析（真实模型）——
        with st.spinner("Resume Parser 正在解析简历（真实模型调用，约需 10-60 秒）…"):
            try:
                parsed = parse_resume(get_client(), get_model_name(), st.session_state.resume_text[:6000])
            except Exception as e:  # noqa: BLE001
                st.session_state.resume_error = f"{type(e).__name__}: {e}"
                st.error(f"简历解析失败：{e}")
                st.code(traceback.format_exc()[-800:])
                return

        if parsed.get("parse_error") or parsed.get("error"):
            st.session_state.resume_error = parsed.get("error") or "解析失败"
            warn(f"简历结构化解析未成功：{st.session_state.resume_error}")
            st.info("已降级：将使用简历原文前 1500 字作为摘要继续，出题质量会下降但流程可用。")
            st.session_state.parsed_resume = None
            st.session_state.resume_summary = st.session_state.resume_text[:1500]
        else:
            st.session_state.parsed_resume = parsed
            st.session_state.resume_summary = format_resume_summary(parsed)
            st.session_state.resume_error = None
            ok("简历解析成功（真实模型输出）")

        with st.expander("查看解析结果", expanded=False):
            st.code(st.session_state.resume_summary or "（空）", language="text")

        # —— 出题（真实模型）——
        with st.spinner("Interview Agent 正在结合简历与 JD 出题…"):
            qs, err = generate_questions_jd_aware(
                get_client(),
                resume_summary=st.session_state.resume_summary,
                jd_text=st.session_state.jd_text,
                target_role=st.session_state.target_role,
                num_questions=st.session_state.num_questions,
            )

        if err:
            st.session_state.questions_error = err
            warn(f"出题失败，未取得真实模型题目：{err}")
            st.info("流程已停止。请检查本地 API 服务后重试，系统不会用预置题目冒充模型输出。")
            return

        st.session_state.questions = qs
        st.session_state.questions_error = None
        st.session_state.q_index = 0
        st.session_state.qa_records = []
        st.session_state.pending_followup = None
        st.session_state.followup_count = 0
        st.session_state.stage = "interviewing"
        ok(f"已生成 {len(qs)} 道真实模型题目，面试开始。")
        time.sleep(0.4)
        st.rerun()


# ================================================================ ② 面试阶段
def stage_interviewing() -> None:
    st.header("② 多轮 AI 面试")

    questions = st.session_state.questions
    idx = st.session_state.q_index

    if idx >= len(questions):
        st.session_state.stage = "evaluating"
        st.rerun()
        return

    # —— 历史对话 ——
    for rec in st.session_state.qa_records:
        with st.chat_message("assistant"):
            st.markdown(f"**Q{rec['id']}** · `{rec['dimension']}`\n\n{rec['question']}")
            if rec.get("focus"):
                st.caption(f"考察点：{rec['focus']}")
        with st.chat_message("user"):
            st.markdown(rec["answer"])
        for fu in rec.get("followups", []):
            with st.chat_message("assistant"):
                st.markdown(f"↳ **追问**：{fu['question']}")
                if fu.get("reason"):
                    st.caption(f"追问理由：{fu['reason']}")
            with st.chat_message("user"):
                st.markdown(fu["answer"])

    # —— 待处理的追问 ——
    pending = st.session_state.pending_followup
    if pending:
        with st.chat_message("assistant"):
            st.markdown(f"↳ **追问**：{pending['question']}")
            if pending.get("reason"):
                st.caption(f"追问理由：{pending['reason']}")
        answer = st.chat_input("回答追问…")
        if answer:
            rec = st.session_state.qa_records[-1]
            rec.setdefault("followups", []).append(
                {"question": pending["question"], "answer": answer, "reason": pending.get("reason", "")}
            )
            st.session_state.pending_followup = None
            st.session_state.followup_count += 1
            st.session_state.q_index += 1
            st.rerun()
        return

    # —— 当前问题 ——
    q = questions[idx]
    with st.chat_message("assistant"):
        st.markdown(f"**Q{q['id']}** · `{q['dimension']}`\n\n{q['question']}")
        if q.get("focus"):
            st.caption(f"考察点：{q['focus']}")
        if q.get("jd_ref") and q["jd_ref"] != "未提供":
            st.caption(f"对应 JD 要求：{q['jd_ref']}")

    answer = st.chat_input("输入你的回答…")
    if not answer:
        st.info("在下方输入框作答后，模型会判断是「继续追问」还是「进入下一题」。")
        return

    with st.chat_message("user"):
        st.markdown(answer)

    st.session_state.qa_records.append(
        {
            "id": q["id"],
            "question": q["question"],
            "dimension": q["dimension"],
            "answer": answer,
            "followups": [],
        }
    )

    # —— 追问决策（真实模型）——
    with st.spinner("Follow-up Agent 正在判断是否需要追问…"):
        decision, err = decide_followup(
            get_client(),
            question=q["question"],
            answer=answer,
            dimension=q["dimension"],
            followup_count=st.session_state.followup_count,
        )

    if err:
        warn(f"追问决策未取得真实模型结果：{err}。已按「进入下一题」处理。")
        st.session_state.q_index += 1
        st.session_state.followup_count = 0
    elif decision.get("need_followup") and decision.get("followup_question"):
        st.session_state.pending_followup = {
            "question": decision["followup_question"],
            "reason": decision.get("reason", ""),
        }
    else:
        st.caption(f"无需追问（{decision.get('reason', '模型判定回答已充分')}），进入下一题。")
        st.session_state.q_index += 1
        st.session_state.followup_count = 0

    st.rerun()


# ================================================================ ③ 评估阶段
def stage_evaluating() -> None:
    st.header("③ 多面试官评估")
    st.caption("四位面试官各自独立调用模型评价，互不参考；随后由 Chief Evaluation 汇总。")

    if not st.session_state.qa_records:
        warn("没有有效问答记录，无法评估。")
        if st.button("返回准备阶段"):
            st.session_state.stage = "setup"
            st.rerun()
        return

    if st.button("▶️ 开始评估（4 位面试官 + Chief）", type="primary", use_container_width=True):
        # —— 四位面试官 ——
        progress = st.progress(0.0)
        status = st.empty()
        reports, errors = [], []
        keys = list(INTERVIEWER_ROLES.keys())

        for i, key in enumerate(keys):
            status.info(f"正在调用 {INTERVIEWER_ROLES[key]['name']} 评价…（{i + 1}/{len(keys)}）")
            rep_obj, err = evaluate_by_role(
                get_client(),
                key,
                st.session_state.resume_summary,
                st.session_state.target_role,
                st.session_state.qa_records,
            )
            reports.append(rep_obj)
            if err or not rep_obj.get("is_real"):
                errors.append(f"{INTERVIEWER_ROLES[key]['name']}：{err or rep_obj.get('comment', '未知错误')}")
            progress.progress((i + 1) / (len(keys) + 2))

        st.session_state.reports = reports
        st.session_state.reports_errors = errors

        status.info("Chief Evaluation 正在汇总…")
        chief, chief_err = chief_evaluation(
            get_client(),
            reports,
            st.session_state.target_role,
            st.session_state.qa_records,
        )
        st.session_state.chief = chief
        st.session_state.chief_error = chief_err
        progress.progress((len(keys) + 1) / (len(keys) + 2))

        if chief.get("is_real"):
            status.info("正在生成面试报告…")
            md, rpt_err = generate_report(
                get_client(),
                chief,
                reports,
                st.session_state.target_role,
                st.session_state.qa_records,
            )
            st.session_state.report_md = md
            st.session_state.report_error = rpt_err
        else:
            st.session_state.report_md = ""
            st.session_state.report_error = "Chief 评估无效，报告未生成"

        progress.progress(1.0)
        status.empty()
        st.session_state.stage = "done"
        st.rerun()


# ================================================================ ④ 结果阶段
def _radar(dims: dict) -> go.Figure:
    labels = list(dims.keys())
    values = [dims[d]["avg"] for d in labels]
    if not labels:
        return go.Figure()
    fig = go.Figure(
        data=go.Scatterpolar(
            r=values + [values[0]],
            theta=labels + [labels[0]],
            fill="onself",
            line=dict(color="#1D6FD1"),
        )
    )
    fig.update_layout(
        polar=dict(radialaxis=dict(visible=True, range=[0, 10])),
        showlegend=False,
        height=380,
        margin=dict(l=40, r=40, t=30, b=30),
    )
    return fig


def stage_done() -> None:
    st.header("④ 面试报告")

    reports = st.session_state.reports
    chief = st.session_state.chief or {}

    # —— 未取得真实结果的模块，先集中告警 ——
    problems = []
    if st.session_state.resume_error:
        problems.append(f"简历解析：{st.session_state.resume_error}")
    if st.session_state.questions_error:
        problems.append(f"出题：{st.session_state.questions_error}")
    problems += st.session_state.reports_errors
    if st.session_state.chief_error:
        problems.append(f"Chief 评估：{st.session_state.chief_error}")
    if st.session_state.report_error:
        problems.append(f"面试报告：{st.session_state.report_error}")

    if problems:
        st.error("以下模块**未取得真实模型结果**，报告中不含这些内容，也未用任何假数据填充：")
        for p in problems:
            st.markdown(f"- {p}")

    # —— 总分 ——
    if chief.get("is_real"):
        c1, c2, c3 = st.columns(3)
        c1.metric("Chief 综合评分", f"{chief.get('overall_score')} / 10")
        c2.metric("确定性汇总校验", f"{chief.get('computed_overall')} / 10")
        c3.metric("录用建议", str(chief.get("verdict", "-")).upper())
        st.caption(
            f"置信度：{chief.get('confidence')} · "
            f"基于 {chief.get('based_on')}/{chief.get('total_roles')} 位面试官的有效评价"
        )
        if chief.get("final_comment"):
            st.markdown("#### 最终评价")
            st.write(chief["final_comment"])
        if chief.get("conflicts"):
            st.markdown("#### ⚠️ 面试官分歧")
            for c in chief["conflicts"]:
                st.markdown(f"- {c}")
        elif chief.get("conflicts") == []:
            st.caption("未检测到显著分歧。")
        if chief.get("key_reasons"):
            st.markdown("#### 决定性理由")
            for r in chief["key_reasons"]:
                st.markdown(f"- {r}")
        if chief.get("gaps_to_probe"):
            st.markdown("#### 建议补问")
            for g in chief["gaps_to_probe"]:
                st.markdown(f"- {g}")
    else:
        warn(f"Chief 评估未取得真实模型结果：{chief.get('error') or st.session_state.chief_error}")

    # —— 雷达图 ——
    agg = aggregate_dimensions([r for r in reports if r.get("is_real")])
    if agg.get("dims"):
        st.markdown("#### 六维度评分（来自各面试官真实评分的确定性汇总）")
        left, right = st.columns([1, 1])
        with left:
            st.plotly_chart(_radar(agg["dims"]), use_container_width=True)
        with right:
            st.dataframe(
                pd.DataFrame(
                    [
                        {
                            "维度": d,
                            "均分": v["avg"],
                            "最低": v["min"],
                            "最高": v["max"],
                            "极差": v["spread"],
                            "样本": v["n"],
                        }
                        for d, v in agg["dims"].items()
                    ]
                ),
                hide_index=True,
                use_container_width=True,
            )
            big_spread = {d: v for d, v in agg["dims"].items() if v["spread"] >= 3}
            if big_spread:
                st.caption("⚠️ 极差 ≥3 的维度：" + "、".join(big_spread.keys()))

    # —— 四位面试官 ——
    st.markdown("#### 四位面试官独立评价")
    cols = st.columns(2)
    for i, r in enumerate(reports):
        with cols[i % 2]:
            name = r.get("role_name") or r.get("role")
            st.markdown(f"**{name}** · {r.get('role_title', '')}")
            if not r.get("is_real"):
                warn(f"未取得真实模型结果：{r.get('comment', '')}")
                continue
            if r.get("scores"):
                st.dataframe(
                    pd.DataFrame(
                        [{"维度": d, "分数": v["score"], "依据": v["evidence"][:80]} for d, v in r["scores"].items()]
                    ),
                    hide_index=True,
                    use_container_width=True,
                )
            else:
                warn("该角色未返回任何维度评分")
            if r.get("missing_dims"):
                st.caption(f"⚠️ 缺失维度：{', '.join(r['missing_dims'])}")
            st.caption(f"建议：{r.get('recommendation')}")
            if r.get("comment"):
                st.write(r["comment"])

    # —— 报告正文 ——
    st.markdown("#### 个性化改进报告")
    if st.session_state.report_md:
        st.markdown(st.session_state.report_md)
    else:
        warn(f"报告未生成：{st.session_state.report_error or '未知原因'}")

    # —— 问答回顾 ——
    with st.expander("查看完整问答记录", expanded=False):
        for rec in st.session_state.qa_records:
            st.markdown(f"**Q{rec['id']}** · `{rec['dimension']}` — {rec['question']}")
            st.markdown(f"> {rec['answer']}")
            for fu in rec.get("followups", []):
                st.markdown(f"　↳ 追问：{fu['question']}")
                st.markdown(f"> 　{fu['answer']}")
            st.divider()

    # —— 运行统计 ——
    st.markdown("#### 运行统计")
    s = stats_snapshot()
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("模型调用次数", s["calls"])
    m2.metric("成功率", f"{s['success_rate']}%")
    m3.metric("累计 tokens", s["total_tokens"])
    m4.metric("平均耗时", f"{s['avg_latency']}s")
    st.caption(
        f"本次会话运行时长 {s['elapsed_sec']}s · 最长单次 {s['max_latency']}s · "
        f"按环节：{s['by_tag']}"
    )

    st.divider()
    if st.button("🔁 再面一次", use_container_width=True):
        for k in list(st.session_state.keys()):
            del st.session_state[k]
        st.rerun()


# ---------------------------------------------------------------- 路由
stage = st.session_state.stage
if stage == "setup":
    stage_setup()
elif stage == "interviewing":
    stage_interviewing()
elif stage == "evaluating":
    stage_evaluating()
elif stage == "done":
    stage_done()
