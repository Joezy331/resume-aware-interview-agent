# -*- coding: utf-8 -*-
"""生成 AI Career Copilot 迭代版流程图（5 张短图，SVG 源文件）。
风格沿用既有 logic-flow.html：暖米底 #FAF7F0 + 淡粉 #C58A8A + 墨色 #3A352C。
所有图形基于 electron-app 真实代码绘制，不虚构接口。
输出：resume-aware-interview-agent/docs/flows/*.svg
"""
import pathlib

OUT = pathlib.Path(__file__).resolve().parent  # 脚本所在目录即输出目录
OUT.mkdir(parents=True, exist_ok=True)

FONT = "'Noto Sans SC','Inter','PingFang SC','Microsoft YaHei',sans-serif"
INK, SUB, ARROW = "#3A352C", "#8A8475", "#A89F8C"
LINE, CREAM, CORAL, CORAL_D = "#E3DCCC", "#FAF7F0", "#C58A8A", "#A97070"

BOX_STYLE = {
    "proc": f'fill="#FFFFFF" stroke="{LINE}" stroke-width="1.5"',
    "ext": f'fill="#FFFFFF" stroke="{CORAL}" stroke-width="1.5" stroke-dasharray="6 4"',
    "store": f'fill="#F2EFE7" stroke="#8A8475" stroke-width="1.5" stroke-dasharray="3 3"',
    "note": f'fill="#FBF8F2" stroke="#DCD3C2" stroke-width="1.2"',
    "io": f'fill="#3A352C" stroke="none"',
}


def head(w, h, title, subtitle):
    return f'''<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" xmlns="http://www.w3.org/2000/svg" font-family="{FONT}">
<defs>
<linearGradient id="hg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{CORAL}"/><stop offset="1" stop-color="{CORAL_D}"/></linearGradient>
<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="{ARROW}"/></marker>
</defs>
<rect x="0" y="0" width="{w}" height="{h}" fill="{CREAM}"/>
<rect x="0" y="0" width="{w}" height="84" fill="url(#hg)"/>
<text x="{w//2}" y="46" text-anchor="middle" font-size="26" font-weight="700" fill="#FFFFFF">{title}</text>
<text x="{w//2}" y="70" text-anchor="middle" font-size="13" fill="#FFFFFF" opacity="0.9">{subtitle}</text>'''


def box(x, y, w, h, title, sub=None, kind="proc"):
    st = BOX_STYLE[kind]
    tcol = "#FFFFFF" if kind == "io" else INK
    scol = "rgba(255,255,255,.85)" if kind == "io" else SUB
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" {st}/>'
    if sub:
        s += (f'<text x="{x+w//2}" y="{y+24}" text-anchor="middle" font-size="14.5" font-weight="600" fill="{tcol}">{title}</text>'
              f'<text x="{x+w//2}" y="{y+44}" text-anchor="middle" font-size="11.5" fill="{scol}">{sub}</text>')
    else:
        s += f'<text x="{x+w//2}" y="{y+h//2+5}" text-anchor="middle" font-size="14" font-weight="600" fill="{tcol}">{title}</text>'
    return s


def diamond(x, y, w, h, text):
    cx, cy = x + w // 2, y + h // 2
    return (f'<polygon points="{cx},{y} {x+w},{cy} {cx},{y+h} {x},{cy}" fill="#F6ECEC" stroke="{CORAL}" stroke-width="1.5"/>'
            f'<text x="{cx}" y="{cy+4}" text-anchor="middle" font-size="13" font-weight="600" fill="#8A5A5A">{text}</text>')


def term(x, y, w, h, text, fill="#3A352C"):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h//2}" fill="{fill}"/>'
            f'<text x="{x+w//2}" y="{y+h//2+5}" text-anchor="middle" font-size="14" font-weight="700" fill="#FFFFFF">{text}</text>')


def arrow(*pts, label=None, lx=None, ly=None):
    d = "M" + " L".join(f"{p[0]},{p[1]}" for p in pts)
    s = f'<path d="{d}" stroke="{ARROW}" stroke-width="1.7" fill="none" marker-end="url(#ah)"/>'
    if label:
        s += f'<text x="{lx}" y="{ly}" text-anchor="middle" font-size="11.5" fill="{SUB}">{label}</text>'
    return s


def layer_label(x, y, text):
    return f'<text x="{x}" y="{y}" font-size="13" font-weight="700" fill="{CORAL_D}">{text}</text>'


def legend(y, items, x0=60, x1=1040):
    s = f'<line x1="{x0}" y1="{y-14}" x2="{x1}" y2="{y-14}" stroke="{LINE}" stroke-width="1.2"/>'
    x = x0
    for kind, label in items:
        if kind == "proc":
            s += f'<rect x="{x}" y="{y}" width="26" height="16" rx="4" fill="#FFFFFF" stroke="{LINE}" stroke-width="1.3"/>'
        elif kind == "ext":
            s += f'<rect x="{x}" y="{y}" width="26" height="16" rx="4" fill="#FFFFFF" stroke="{CORAL}" stroke-width="1.3" stroke-dasharray="5 3"/>'
        elif kind == "store":
            s += f'<rect x="{x}" y="{y}" width="26" height="16" rx="4" fill="#F2EFE7" stroke="#8A8475" stroke-width="1.3" stroke-dasharray="3 3"/>'
        elif kind == "dec":
            s += f'<polygon points="{x+13},{y} {x+26},{y+8} {x+13},{y+16} {x},{y+8}" fill="#F6ECEC" stroke="{CORAL}" stroke-width="1.3"/>'
        elif kind == "io":
            s += f'<rect x="{x}" y="{y}" width="26" height="16" rx="8" fill="#3A352C"/>'
        x += 34
        s += f'<text x="{x}" y="{y+12}" font-size="12" fill="{SUB}">{label}</text>'
        x += 20 + len(label) * 12
    return s


# ============ 图 1：用户主流程（含文件类型分支） ============
def user_flow():
    s = head(1100, 1120, "用户主流程 · User Flow", "上传 → 解析 → 岗位/JD/能力模型 → 面试 → 评分报告 → 历史记录闭环")
    s += term(460, 100, 180, 44, "开始")
    s += arrow((550, 144), (550, 172))
    s += box(400, 176, 300, 52, "上传简历 / 输入简历信息", "三种入口并行")
    s += box(80, 268, 300, 56, "📄 文件上传", "PDF / DOCX / TXT")
    s += box(400, 268, 300, 56, "🖼️ 图片上传", "截图 / 扫描件 / 图片型 PDF")
    s += box(720, 268, 300, 56, "粘贴文本", "直接键入或粘贴")
    s += arrow((470, 228), (230, 268))
    s += arrow((550, 228), (550, 268))
    s += arrow((630, 228), (870, 268))
    s += box(80, 356, 300, 56, "本地文本抽取", "resume-extract.js（主进程）")
    s += box(400, 356, 300, 56, "百度 OCR 识别文字", "accurate_basic 高精度版", kind="ext")
    s += arrow((230, 324), (230, 356))
    s += arrow((550, 324), (550, 356))
    s += box(400, 444, 300, 50, "OCR 失败 → 多模态竞速回退", "Mimo V2.6 Flash / Step 5 Preview", kind="note")
    s += arrow((550, 412), (550, 444), label="失败", lx=580, ly=430)
    s += arrow((700, 469), (760, 469), (760, 384), (700, 384))
    s += arrow((870, 324), (870, 356))
    s += box(330, 524, 440, 52, "简历结构化信息", "Resume Parser · 基本信息 / 教育 / 工作 / 项目 / 技能")
    s += arrow((230, 412), (230, 524))
    s += arrow((550, 494), (550, 524))
    s += arrow((870, 356), (870, 524))
    s += arrow((550, 576), (550, 604))
    s += box(330, 608, 440, 52, "岗位推荐", "Job Match · 确定性匹配引擎 · 11 个职位")
    s += arrow((550, 660), (550, 688))
    s += box(330, 692, 440, 52, "JD 生成 / JD 解析", "粘贴文本 · JD 截图（走百度 OCR）")
    s += arrow((550, 744), (550, 772))
    s += box(330, 776, 440, 52, "岗位能力模型", "Competency · 6 维 24 项 + 动态评分权重")
    s += arrow((550, 828), (550, 856))
    s += box(330, 860, 440, 52, "AI 面试 + 动态追问", "Interview 50% 简历 + 30% JD + 20% 能力模型")
    s += arrow((550, 912), (550, 940))
    s += box(60, 940, 300, 52, "多面试官评价 + Chief 仲裁", "HR / 业务 / 专业 / 主管 · >15 分冲突检测", kind="note")
    s += box(400, 940, 300, 52, "加权评分 + 报告", "Score + Summary · 优势 / 待提升 / 成长计划")
    s += box(740, 940, 300, 52, "保存面试历史", "localStorage 持久化", kind="store")
    s += arrow((360, 966), (400, 966))
    s += arrow((700, 966), (740, 966))
    s += arrow((890, 916), (890, 940))
    s += arrow((890, 992), (890, 1030))
    s += term(400, 1030, 300, 44, "历史回顾 · 再次面试", fill=CORAL)
    s += arrow((740, 1052), (700, 1052))
    s += legend(1104, [("io", "开始/结束"), ("proc", "处理"), ("ext", "外部服务(OCR/大模型)"), ("store", "本地存储")])
    s += "</svg>"
    (OUT / "user_flow.svg").write_text(s, encoding="utf-8")


# ============ 图 2：外接大模型 API 调用流程 ============
def api_flow():
    s = head(1100, 960, "外接大模型 API 调用流程 · LLM Call Flow", "出题 / 追问 / 评分 / 报告 / OCR 兜底均走同一链路（ai-chat IPC 代理）")
    s += term(430, 100, 240, 44, "用户操作")
    s += arrow((550, 144), (550, 172))
    s += box(360, 176, 380, 52, "前端业务模块", "出题 / 追问 / 评分 / 报告")
    s += arrow((550, 228), (550, 256))
    s += box(360, 260, 380, 56, "请求组装 messages", "系统 Prompt + 用户输入 + 历史问答上下文")
    s += arrow((550, 316), (550, 344))
    s += box(330, 348, 440, 56, "API 配置读取", "localStorage 覆盖 → 否则 local_api_config.json")
    s += arrow((550, 404), (550, 432))
    s += box(360, 436, 380, 52, "IPC: ai-chat", "渲染进程 → 主进程（避免 CORS 与 Key 暴露）", kind="note")
    s += arrow((550, 488), (550, 516))
    s += box(330, 520, 440, 52, "主进程代理 fetch", "POST /chat/completions · 90s 超时 · max_tokens≤8192")
    s += arrow((550, 572), (550, 600))
    s += box(400, 604, 300, 52, "外接大模型服务", "OpenAI 兼容 · localhost:8787/v1", kind="ext")
    s += arrow((700, 630), (770, 630))
    s += box(770, 604, 280, 52, "返回结果解析", "choices[0].message.content")
    s += arrow((910, 656), (910, 684))
    s += diamond(770, 688, 280, 64, "内容有效？")
    s += arrow((910, 752), (910, 776), label="是", lx=936, ly=766)
    s += box(400, 776, 300, 52, "更新面试状态 / 页面", "动态追问使用最新回答 + 完整上下文")
    s += arrow((550, 828), (550, 856))
    s += box(400, 856, 300, 52, "保存必要历史数据", "面试结束后写入 localStorage", kind="store")
    # 异常分支（左侧）
    s += arrow((770, 720), (300, 720), label="否", lx=520, ly=712)
    s += box(60, 688, 240, 64, "异常处理", "网络失败 / 401 / 404 / 429 / 502 / 空内容 → 明确提示，不泄露 Key", kind="note")
    s += arrow((180, 752), (180, 800))
    s += box(60, 800, 240, 52, "用户可重试或切换模型", "设置页提供 5 个模型选项", kind="note")
    s += arrow((300, 720), (550, 720), (550, 776))
    s += legend(920, [("io", "用户操作"), ("proc", "处理"), ("ext", "外部模型服务"), ("store", "本地存储")])
    s += "</svg>"
    (OUT / "api_call_flow.svg").write_text(s, encoding="utf-8")


# ============ 图 3：百度 OCR 子流程 ============
def ocr_flow():
    s = head(1100, 880, "百度智能云 OCR 子流程 · OCR Sub-Flow", "仅支持简历图片与 JD 截图；PDF/DOCX/TXT 不走 OCR")
    s += term(430, 100, 240, 44, "用户选择图片")
    s += arrow((550, 144), (550, 172))
    s += box(380, 176, 340, 52, "格式与大小校验", "image/* · 超大图自动压缩")
    s += arrow((550, 228), (550, 256))
    s += box(380, 260, 340, 52, "读取图片 → base64", "去除 data:image 前缀")
    s += arrow((550, 312), (550, 340))
    s += box(380, 344, 340, 52, "IPC: baidu-ocr", "密钥仅主进程从本地配置读取")
    s += arrow((550, 396), (550, 424))
    s += box(380, 428, 340, 52, "百度文字识别（高精度版）", "accurate_basic · 专用 OCR 3-8 秒", kind="ext")
    s += arrow((550, 480), (550, 508))
    s += diamond(400, 512, 300, 64, "识别有效？")
    s += arrow((700, 544), (770, 544), label="是", lx=735, ly=536)
    s += box(770, 512, 280, 64, "文本清洗", "OCR 只识别文字；语义理解与信息抽取由后续 LLM 模块完成")
    s += arrow((910, 576), (910, 604))
    s += box(700, 604, 380, 52, "填充简历 / JD 解析模块", "用户确认、修改或重新识别")
    # 失败分支
    s += arrow((400, 544), (330, 544), label="否", lx=365, ly=536)
    s += box(60, 512, 270, 64, "失败处理", "未配置 / 网络异常 / 权限错误 / 空结果 → 明确提示", kind="note")
    s += arrow((195, 576), (195, 640))
    s += box(60, 640, 270, 64, "回退策略", "简历图片 → 多模态竞速；JD 图片 → 提示改用粘贴文本")
    s += arrow((195, 704), (195, 740))
    s += box(60, 740, 270, 52, "不破坏原文本输入流程", "OCR 失败可继续手动输入", kind="note")
    s += f'<line x1="60" y1="812" x2="1040" y2="812" stroke="{LINE}" stroke-width="1.2"/>'
    s += f'<text x="60" y="838" font-size="12" fill="{SUB}">注：百度 NLP 关键词接口因权限受限（error 6）已弃用；「粘贴 JD 文本 → 渲染 PNG → 百度 OCR 高精度版提取关键词」为当前替代实现。</text>'
    s += "</svg>"
    (OUT / "ocr_flow.svg").write_text(s, encoding="utf-8")


# ============ 图 4：历史记录数据流程 ============
def history_flow():
    s = head(1100, 800, "用户历史记录流程 · History Data Flow", "本次迭代新增：localStorage 持久化（键 acc_history_v1），关闭重开不丢失")
    s += term(430, 100, 240, 44, "面试完成")
    s += arrow((550, 144), (550, 172))
    s += box(330, 176, 440, 56, "组装面试记录", "会话 ID · 时间 · 目标岗位 · 难度 · 状态 · 总分")
    s += arrow((550, 232), (550, 260))
    s += box(330, 264, 440, 56, "附完整过程数据", "每轮问答 / 追问 / 各面试官评分 / 最终报告 / 成长建议")
    s += arrow((550, 320), (550, 348))
    s += box(360, 352, 380, 52, "写入 localStorage", "JSON 数组 · 时间倒序 · 容量异常时提示", kind="store")
    s += arrow((550, 404), (550, 432))
    s += diamond(400, 436, 300, 60, "保存成功？")
    s += arrow((550, 496), (550, 524), label="是", lx=576, ly=514)
    s += box(360, 524, 380, 52, "历史记录列表", "时间 / 岗位 / 难度 / 状态 / 总分 · 空状态引导")
    s += arrow((550, 576), (550, 604))
    s += box(360, 604, 380, 56, "历史详情还原", "问题 · 回答 · 追问 · 评分 · 报告 · 旧记录缺字段兼容展示")
    s += arrow((740, 632), (830, 632))
    s += box(830, 604, 220, 64, "删除记录", "弹窗确认后移除", kind="note")
    s += arrow((940, 668), (940, 700), (200, 700), (200, 632))
    s += box(60, 604, 220, 56, "再次面试", "回到面试流程闭环", kind="note")
    s += arrow((400, 466), (330, 466), label="否", lx=365, ly=458)
    s += box(60, 436, 270, 60, "保存失败提示", "明确告知用户，不静默丢失数据", kind="note")
    s += arrow((195, 496), (195, 532))
    s += box(60, 532, 270, 56, "数据兼容策略", "旧版本无记录 → 空状态；新字段缺失 → 默认值展示")
    s += legend(720, [("io", "开始/结束"), ("proc", "处理"), ("store", "本地存储(localStorage)"), ("note", "提示/分支")])
    s += "</svg>"
    (OUT / "history_flow.svg").write_text(s, encoding="utf-8")


# ============ 图 5：13-Agent 架构（分层 + 外部服务 + 存储） ============
def arch():
    s = head(1100, 780, "13-Agent 系统架构 · Agent Architecture", "区分：真实 LLM Agent / 规则与函数模块 / 外部服务 / 本地存储")
    s += layer_label(60, 122, "输入层")
    s += box(60, 132, 220, 50, "简历文件", "PDF / DOCX / TXT", kind="io")
    s += box(300, 132, 220, 50, "简历图片", "截图 / 扫描件", kind="io")
    s += box(540, 132, 220, 50, "粘贴简历文本", None, kind="io")
    s += box(780, 132, 250, 50, "JD 截图 / JD 文本", None, kind="io")
    s += layer_label(60, 224, "外部服务层")
    s += box(60, 234, 320, 50, "百度智能云 OCR", "accurate_basic 文字识别（工具调用，非 Agent）", kind="ext")
    s += box(400, 234, 320, 50, "外接大模型服务", "OpenAI 兼容 · 多 Agent 共用", kind="ext")
    s += box(740, 234, 290, 50, "本地安全配置", "local_api_config.json（Key 不入源码）", kind="store")
    s += layer_label(60, 326, "解析与岗位匹配层")
    s += box(60, 336, 220, 56, "① Resume Parser", "LLM Agent · 结构化抽取")
    s += box(300, 336, 220, 56, "② Job Match", "规则引擎 · 11 职位匹配")
    s += box(540, 336, 220, 56, "③ JD Agent", "LLM Agent · 生成/解析")
    s += box(780, 336, 250, 56, "④ Competency", "规则模块 · 6 维能力树")
    s += layer_label(60, 434, "面试与评价层")
    s += box(60, 444, 160, 56, "⑤ Interview", "LLM Agent · 出题")
    s += box(240, 444, 160, 56, "⑥ Follow-up", "LLM Agent · 追问")
    s += box(420, 444, 200, 56, "⑦-⑩ 四位面试官", "HR / 业务 / 专业 / 主管")
    s += box(640, 444, 180, 56, "⑪ Chief Eval", "LLM Agent · 冲突仲裁")
    s += box(840, 444, 190, 56, "⑫ Score", "规则 · 动态权重")
    s += layer_label(60, 542, "数据与报告层")
    s += box(60, 552, 220, 56, "⑬ Summary Agent", "LLM Agent · 报告+成长计划")
    s += box(300, 552, 220, 56, "报告渲染 + 雷达图", "Chart.js · 6 维可视化")
    s += box(540, 552, 220, 56, "历史记录存储", "localStorage（本次新增）", kind="store")
    s += box(780, 552, 250, 56, "Dashboard / Agent 监控", "指标 + 13-Agent 管线可视化")
    # 主干数据流
    s += arrow((170, 182), (170, 234))
    s += arrow((560, 182), (560, 234))
    s += arrow((170, 284), (170, 336))
    s += arrow((410, 284), (410, 336))
    s += arrow((900, 284), (900, 336))
    s += arrow((170, 392), (170, 444))
    s += arrow((410, 392), (410, 444))
    s += arrow((520, 472), (640, 472))
    s += arrow((820, 472), (840, 472))
    s += arrow((935, 500), (935, 552))
    s += arrow((410, 500), (410, 552))
    s += arrow((520, 580), (540, 580))
    s += arrow((760, 580), (780, 580))
    s += f'<line x1="60" y1="632" x2="1040" y2="632" stroke="{LINE}" stroke-width="1.2"/>'
    s += f'<text x="60" y="656" font-size="12" fill="{SUB}">①③⑤⑥⑦⑧⑨⑩⑪⑬ 为真实 LLM Agent（经外接大模型生成内容）；②④⑫ 为规则/函数模块；OCR 为外部工具调用；历史记录为本地存储。</text>'
    s += f'<text x="60" y="678" font-size="12" fill="{SUB}">追问链路：Follow-up 使用用户最新回答 + 完整历史上下文（interviewState.answers），非固定问题序列。</text>'
    s += legend(704, [("io", "输入"), ("proc", "LLM Agent"), ("ext", "外部服务"), ("store", "本地存储")])
    s += "</svg>"
    (OUT / "agent_architecture.svg").write_text(s, encoding="utf-8")


user_flow()
api_flow()
ocr_flow()
history_flow()
arch()
print("generated:", [p.name for p in sorted(OUT.glob("*.svg"))])
