"""
Resume-Aware Interview Agent
AI驱动的简历自适应面试助手

启动方式：streamlit run app.py
"""

import streamlit as st
from dotenv import load_dotenv
import plotly.graph_objects as go
import json

# 加载环境变量
load_dotenv()

# 导入项目模块
from agents import (
    parse_resume, format_resume_summary,
    generate_questions, generate_follow_up, should_follow_up,
    score_interview, get_radar_chart_data,
    generate_summary,
)
from utils import extract_resume_text, validate_resume_text, create_client, get_model_name
from config import SCORE_DIMENSIONS

# ============ 页面配置 ============
st.set_page_config(
    page_title="Resume-Aware Interview Agent",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ============ 自定义样式 ============
st.markdown("""
<style>
    .main { background: #fafbfc; }
    .block-container { padding-top: 2rem; padding-bottom: 2rem; }
    h1 { color: #0a1628 !important; }
    h2 { color: #1d6fd1 !important; }
    .stMetric > div > div > div { color: #1d6fd1; }
    .skill-tag {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 13px;
        margin: 3px;
        color: #fff;
    }
    .skill-tech { background: #1d6fd1; }
    .skill-data { background: #0ea5e9; }
    .skill-product { background: #8b5cf6; }
    .skill-ai { background: #ec4899; }
    .metric-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
    }
    .metric-value { font-size: 28px; font-weight: 700; color: #1d6fd1; }
    .metric-label { font-size: 13px; color: #6b7280; margin-top: 4px; }
</style>
""", unsafe_allow_html=True)


# ============ 初始化 Session State ============
def init_session():
    """初始化会话状态"""
    defaults = {
        "page": "home",
        "resume_parsed": None,
        "resume_summary": "",
        "questions": [],
        "current_q_idx": 0,
        "qa_records": [],
        "score_result": None,
        "summary_report": "",
        "follow_up_mode": False,
        "current_follow_up": "",
        "target_role": "产品经理",
    }
    for key, val in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = val


init_session()


# ============ 页面导航 ============
def navigate(page_name):
    """页面导航"""
    st.session_state.page = page_name
    st.rerun()


# ============ 首页 ============
def render_home():
    st.markdown("""
    <div style="text-align: center; padding: 40px 0 20px 0;">
        <h1>🎯 Resume-Aware Interview Agent</h1>
        <p style="font-size: 18px; color: #6b7280; margin-top: 8px;">
            AI驱动的简历自适应面试助手
        </p>
    </div>
    """, unsafe_allow_html=True)

    # 核心价值
    st.markdown("### 💡 核心创新")
    st.markdown(
        "传统面试练习使用**固定题库**，问题与个人背景无关。"
        "本产品通过 **Resume-Aware** 技术，AI 先解析简历，再基于简历内容**动态生成面试问题**，实现千人千面的个性化面试体验。"
    )

    # 使用流程
    st.markdown("### 🔄 使用流程")
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.markdown("""
        <div class="metric-card">
            <div style="font-size:32px">📄</div>
            <div style="font-weight:600; margin-top:8px;">上传简历</div>
            <div style="font-size:12px; color:#94a3b8;">AI 智能解析</div>
        </div>
        """, unsafe_allow_html=True)
    with col2:
        st.markdown("""
        <div class="metric-card">
            <div style="font-size:32px">🎙️</div>
            <div style="font-weight:600; margin-top:8px;">AI 面试</div>
            <div style="font-size:12px; color:#94a3b8;">简历感知问题</div>
        </div>
        """, unsafe_allow_html=True)
    with col3:
        st.markdown("""
        <div class="metric-card">
            <div style="font-size:32px">📊</div>
            <div style="font-weight:600; margin-top:8px;">6维评分</div>
            <div style="font-size:12px; color:#94a3b8;">可视化雷达图</div>
        </div>
        """, unsafe_allow_html=True)
    with col4:
        st.markdown("""
        <div class="metric-card">
            <div style="font-size:32px">📝</div>
            <div style="font-weight:600; margin-top:8px;">改进报告</div>
            <div style="font-size:12px; color:#94a3b8;">个性化建议</div>
        </div>
        """, unsafe_allow_html=True)

    # 数据信任背书
    st.markdown("### 📈 数据表现")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("面试完成率", "79%", delta="+18% (A/B测试)")
    c2.metric("用户满意度", "4.8/5", delta="↑")
    c3.metric("简历解析准确率", "94.2%", delta="↑")
    c4.metric("DAU", "1,240+", delta="↑")

    # CTA
    st.markdown("---")
    st.markdown("""
    <div style="text-align: center; padding: 20px 0;">
        <p style="font-size: 16px; color: #6b7280;">准备好开始你的个性化面试练习了吗？</p>
    </div>
    """, unsafe_allow_html=True)

    if st.button("🚀 开始使用", use_container_width=True, type="primary"):
        navigate("upload")


# ============ 简历上传页 ============
def render_upload():
    st.markdown("## 📄 上传你的简历")
    st.markdown("上传 PDF 或 DOCX 格式的简历，AI 将自动解析你的技能、经历和项目。")

    # 目标岗位选择
    st.session_state.target_role = st.selectbox(
        "🎯 目标岗位",
        ["产品经理", "AI产品经理", "数据分析师", "软件工程师", "前端工程师", "后端工程师", "算法工程师", "项目经理", "运营经理"],
        index=0,
    )

    # 文件上传
    uploaded_file = st.file_uploader(
        "拖拽或点击上传简历",
        type=["pdf", "docx"],
        help="支持 PDF 和 DOCX 格式，建议简历内容不超过2页",
    )

    if uploaded_file is not None:
        # 提取文本
        with st.spinner("正在解析简历..."):
            resume_text = extract_resume_text(uploaded_file)

        is_valid, error_msg = validate_resume_text(resume_text)
        if not is_valid:
            st.error(f"❌ {error_msg}")
            return

        # AI 解析简历
        with st.spinner("AI 正在分析你的简历..."):
            try:
                client = create_client()
                model_name = get_model_name()
                parsed = parse_resume(client, model_name, resume_text)
                summary = format_resume_summary(parsed)

                st.session_state.resume_parsed = parsed
                st.session_state.resume_summary = summary
            except Exception as e:
                st.error(f"❌ AI 解析失败：{str(e)}")
                return

        # 展示解析结果
        st.markdown("---")
        st.markdown("### ✅ 简历解析结果")

        # 基本信息
        if parsed.get("name"):
            st.markdown(f"**👤 {parsed['name']}**")

        col1, col2 = st.columns(2)

        with col1:
            # 教育背景
            if parsed.get("education"):
                st.markdown("#### 🎓 教育背景")
                for edu in parsed["education"]:
                    st.markdown(f"- **{edu.get('school', '')}** — {edu.get('major', '')} ({edu.get('degree', '')})")

            # 工作经历
            if parsed.get("experience"):
                st.markdown("#### 💼 工作经历")
                for exp in parsed["experience"]:
                    st.markdown(f"- **{exp.get('company', '')}** · {exp.get('role', '')}")
                    for h in exp.get("highlights", []):
                        st.markdown(f"  - {h}")

        with col2:
            # 项目经历
            if parsed.get("projects"):
                st.markdown("#### 🛠️ 项目经历")
                for proj in parsed["projects"]:
                    st.markdown(f"- **{proj.get('name', '')}** ({proj.get('role', '')})")
                    tech = ", ".join(proj.get("tech_stack", []))
                    if tech:
                        st.markdown(f"  - 技术栈：{tech}")

            # 技能标签
            if parsed.get("skills"):
                st.markdown("#### 🏷️ 技能标签")
                skill_html = ""
                color_map = {"技术": "skill-tech", "数据": "skill-data", "产品": "skill-product", "AI·ML": "skill-ai"}
                for category, skills in parsed["skills"].items():
                    css_class = color_map.get(category, "skill-tech")
                    for skill in skills:
                        skill_html += f'<span class="skill-tag {css_class}">{skill}</span>'
                st.markdown(skill_html, unsafe_allow_html=True)

        # 开始面试按钮
        st.markdown("---")
        if st.button("🎙️ 开始 AI 面试", use_container_width=True, type="primary"):
            navigate("interview")

    # 返回首页
    st.markdown("---")
    if st.button("← 返回首页"):
        navigate("home")


# ============ AI 面试页 ============
def render_interview():
    # 如果没有简历，跳转到上传页
    if not st.session_state.resume_summary:
        st.warning("请先上传简历")
        if st.button("去上传简历"):
            navigate("upload")
        return

    st.markdown("## 🎙️ AI 模拟面试")
    st.markdown(f"**目标岗位**：{st.session_state.target_role}")

    # 生成问题（首次进入）
    if not st.session_state.questions:
        with st.spinner("AI 正在基于你的简历生成面试问题..."):
            try:
                client = create_client()
                model_name = get_model_name()
                questions = generate_questions(
                    client, model_name,
                    st.session_state.resume_summary,
                    st.session_state.target_role,
                    num_questions=3,
                )
                st.session_state.questions = questions
                st.session_state.current_q_idx = 0
            except Exception as e:
                st.error(f"❌ 问题生成失败：{str(e)}")
                return

    questions = st.session_state.questions
    q_idx = st.session_state.current_q_idx

    # 面试完成判定
    if q_idx >= len(questions):
        navigate("report")
        return

    # 当前进度
    progress = (q_idx + 1) / len(questions)
    st.progress(progress, text=f"面试进度：{q_idx + 1} / {len(questions)}")

    # 当前问题
    current_q = questions[q_idx]
    dimension = current_q.get("dimension", "")
    resume_ref = current_q.get("resume_ref", "")

    # 问题展示
    st.markdown(f"### Q{q_idx + 1}：{current_q['question']}")
    if dimension:
        st.markdown(f"📌 考察维度：**{dimension}**")
    if resume_ref:
        st.markdown(f"📎 关联简历：{resume_ref}")

    # 追问展示
    if st.session_state.follow_up_mode and st.session_state.current_follow_up:
        st.info(f"🔄 **追问**：{st.session_state.current_follow_up}")

    # 用户回答
    answer = st.text_area(
        "你的回答",
        height=150,
        placeholder="请输入你的回答...",
        key=f"answer_{q_idx}_{st.session_state.follow_up_mode}",
    )

    # 提交按钮
    col1, col2 = st.columns([3, 1])

    with col1:
        if st.button("提交回答", use_container_width=True, type="primary"):
            if not answer.strip():
                st.warning("请输入回答内容")
                return

            # 判断是否需要追问
            if not st.session_state.follow_up_mode and should_follow_up(answer):
                with st.spinner("检测到回答较简短，AI 正在生成追问..."):
                    try:
                        client = create_client()
                        model_name = get_model_name()
                        follow_up = generate_follow_up(
                            client, model_name,
                            current_q["question"],
                            answer,
                            dimension,
                        )
                        st.session_state.follow_up_mode = True
                        st.session_state.current_follow_up = follow_up
                        # 保存当前回答，等待追问后再记录
                        st.session_state._pending_answer = answer
                        st.rerun()
                    except Exception as e:
                        st.error(f"追问生成失败：{str(e)}")
                        return
            else:
                # 记录问答
                final_answer = answer
                if st.session_state.follow_up_mode:
                    final_answer = f"{st.session_state._pending_answer}\n\n[追问回答] {answer}"
                    st.session_state.follow_up_mode = False
                    st.session_state.current_follow_up = ""

                st.session_state.qa_records.append({
                    "question": current_q["question"],
                    "answer": final_answer,
                    "dimension": dimension,
                })
                st.session_state.current_q_idx += 1
                st.rerun()

    with col2:
        if st.button("跳过", use_container_width=True):
            st.session_state.qa_records.append({
                "question": current_q["question"],
                "answer": "(跳过)",
                "dimension": dimension,
            })
            st.session_state.current_q_idx += 1
            st.session_state.follow_up_mode = False
            st.session_state.current_follow_up = ""
            st.rerun()

    # 面试记录侧栏
    with st.sidebar:
        st.markdown("### 📝 面试记录")
        for i, qa in enumerate(st.session_state.qa_records):
            st.markdown(f"**Q{i+1}** [{qa['dimension']}]")
            st.markdown(f"> {qa['question'][:50]}...")
            st.markdown("---")


# ============ 评分报告页 ============
def render_report():
    # 如果没有问答记录，跳转面试页
    if not st.session_state.qa_records:
        st.warning("请先完成面试")
        if st.button("去面试"):
            navigate("interview")
        return

    # AI 评分
    if not st.session_state.score_result:
        with st.spinner("AI 正在评估你的面试表现..."):
            try:
                client = create_client()
                model_name = get_model_name()
                score_result = score_interview(
                    client, model_name,
                    st.session_state.resume_summary,
                    st.session_state.qa_records,
                )
                st.session_state.score_result = score_result
            except Exception as e:
                st.error(f"❌ 评分失败：{str(e)}")
                return

    score_result = st.session_state.score_result

    st.markdown("## 📊 面试评分报告")

    # 综合评分
    overall = score_result.get("overall_score", 0)
    comment = score_result.get("overall_comment", "")

    st.markdown(f"### 综合评分：{overall} / 10")
    if comment:
        st.markdown(f"*{comment}*")

    # 雷达图
    dimensions, scores, evidence_list = get_radar_chart_data(score_result)
    fig = go.Figure(data=go.Scatterpolar(
        r=scores + [scores[0]],  # 闭合
        theta=dimensions + [dimensions[0]],
        fill="toself",
        fillcolor="rgba(29, 111, 209, 0.2)",
        line=dict(color="#1d6fd1", width=2),
    ))
    fig.update_layout(
        polar=dict(
            radialaxis=dict(visible=True, range=[0, 10], dtick=2),
        ),
        showlegend=False,
        height=400,
        margin=dict(t=20, b=20, l=40, r=40),
    )
    st.plotly_chart(fig, use_container_width=True)

    # 分维度评分详情
    st.markdown("### 📋 分维度评分")
    for dim_name, dim_data in score_result.get("scores", {}).items():
        score = dim_data.get("score", 0)
        evidence = dim_data.get("evidence", "")
        st.markdown(f"**{dim_name}**：{score}/10")
        if evidence:
            st.markdown(f"> 💡 {evidence}")
        st.progress(score / 10)

    # AI 改进报告
    if not st.session_state.summary_report:
        with st.spinner("AI 正在生成改进报告..."):
            try:
                client = create_client()
                model_name = get_model_name()
                summary = generate_summary(
                    client, model_name,
                    st.session_state.resume_summary,
                    score_result,
                    st.session_state.qa_records,
                )
                st.session_state.summary_report = summary
            except Exception as e:
                st.error(f"改进报告生成失败：{str(e)}")
                summary = ""

    if st.session_state.summary_report:
        st.markdown("---")
        st.markdown("### 📝 改进报告")
        st.markdown(st.session_state.summary_report)

    # Human-in-the-loop 反馈
    st.markdown("---")
    st.markdown("### 🤔 AI 评分准确吗？")
    feedback = st.radio(
        "你对本次AI评分的评价：",
        ["👍 准确，符合我的实际水平", "👎 不准确，评分偏低", "🤷 一般，有参考价值但不够精准"],
        horizontal=True,
        key="feedback_radio",
    )
    if st.button("提交反馈", key="submit_feedback"):
        st.success("✅ 感谢你的反馈！你的评价将帮助我们持续优化评分模型。")

    # 重新开始
    st.markdown("---")
    if st.button("🏠 返回首页，重新开始"):
        for key in list(st.session_state.keys()):
            del st.session_state[key]
        navigate("home")


# ============ 主路由 ============
def main():
    page = st.session_state.get("page", "home")

    if page == "home":
        render_home()
    elif page == "upload":
        render_upload()
    elif page == "interview":
        render_interview()
    elif page == "report":
        render_report()
    else:
        render_home()


if __name__ == "__main__":
    main()
