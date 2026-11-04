/* 生成「高保真原型 · 功能全览」gallery.html。
 * 与低保真原型一页一页对齐：用户端 17 屏 + 管理员端 9 屏 = 26 屏。
 * 每屏配：低保真功能名 / 顺序编号 / 一句功能说明。iframe 嵌入已验证互不相同、能独立渲染的 screen。
 * 输出: web-prototype/hifi/gallery.html
 */
const fs = require('fs');
const path = require('path');
const base = __dirname;

/* 用户端 17 帧 —— 顺序、命名与 career-lowfi-user.html 的 17 个 frame 完全一致 */
const journey = [
  { file:'u_dashboard', label:'首页 Dashboard', step:'01', desc:'登录总览，进度 / 最近面试 / 下一站建议 / 能力雷达' },
  { file:'u_upload',    label:'上传简历',        step:'02', desc:'拖拽或选择简历文件，分阶段实时解析进度动画' },
  { file:'u_resume',    label:'简历解析',        step:'03', desc:'Resume Parser 抽取教育 / 项目 / 技能，生成能力画像' },
  { file:'u_jobs',      label:'岗位推荐',        step:'04', desc:'Job Match Agent 依据简历向量匹配 11 类岗位并给出匹配分' },
  { file:'u_jd',        label:'JD 分析',         step:'05', desc:'粘贴 / 截图目标公司 JD，解析关键词与简历命中率' },
  { file:'u_competency',label:'能力模型',        step:'06', desc:'由简历 + JD 生成岗位能力树与考察重点' },
  { file:'u_target',    label:'目标岗位',        step:'07', desc:'确认本次面试针对哪个岗位与哪套能力模型' },
  { file:'u_weight',    label:'动态权重',        step:'08', desc:'评分权重随岗位类型动态调整（5 套模板可切换重排）' },
  { file:'u_difficulty',label:'面试难度',        step:'09', desc:'轻量 / 标准 / 挑战 等档位可选，影响题量与追问深度' },
  { file:'u_interview', label:'AI 面试',         step:'10', desc:'基于简历 + JD 动态生成问题，实时观察与录音态' },
  { file:'u_followup',  label:'动态追问',        step:'11', desc:'Follow-up Agent 基于项目经历 + 岗位要求 + 当前回答触发追问' },
  { file:'u_multiagent',label:'多 Agent 评价',   step:'12', desc:'HR / 业务 / 专业 / Leader / Chief 五方独立评分并仲裁冲突' },
  { file:'u_finish',    label:'面试结束',        step:'13', desc:'问题数 / 时长 / 维度统计，引导查看报告与成长计划' },
  { file:'u_report',    label:'评分报告',        step:'14', desc:'六维评分 + 录用概率预测 + Top3 优势 / 待提升' },
  { file:'u_history',   label:'面试记录',        step:'15', desc:'本机持久化历史面试，时间轴 / 得分趋势 / 空态与删除态' },
  { file:'u_api',       label:'API / OCR 状态',  step:'16', desc:'外接大模型与百度 OCR 的调用态、失败兜底与配置来源' },
  { file:'u_growth',    label:'能力成长',        step:'17', desc:'短板分析 → 30/60/90 天成长计划 → 再次练习闭环' },
];

/* 管理员端 9 帧 —— 与 career-lowfi-admin.html 的 9 个 frame 完全一致 */
const admin = [
  { file:'a_dashboard',   label:'Overview 数据看板', step:'01', desc:'登录态 + 运营 KPI、转化漏斗与评分 / 岗位分布' },
  { file:'a_users',       label:'Users 用户数据',     step:'02', desc:'用户画像、目标岗位与面试完成情况分布' },
  { file:'a_interviews',  label:'Interviews 面试数据',step:'03', desc:'每一次面试的过程、评分与完成率记录' },
  { file:'a_scores',      label:'Scores 评分数据',    step:'04', desc:'六维均值与评分区间分布，用于校准动态权重' },
  { file:'a_jobs',        label:'Jobs 岗位数据',      step:'05', desc:'11 类岗位的匹配聚合、平均匹配与发展路径' },
  { file:'a_agents',      label:'Agents 运行监控',    step:'06', desc:'13 个 Agent 的运行状态、调用量与成功率' },
  { file:'a_agent_detail',label:'Agent Detail 详情',  step:'07', desc:'单个 Agent 的 Input → Process → Output 与延迟 / 异常' },
  { file:'a_logs',        label:'Logs 运行日志',      step:'08', desc:'运行日志 / 系统情况，错误兜底与恢复状态' },
  { file:'a_system',      label:'System 系统状态',    step:'09', desc:'13-Agent 架构图、API 可用率 / 队列 / 存储' },
];

function cell(it, isUser) {
  return `<div class="cell">
    <div class="head">
      <span class="no ${isUser ? 'u' : 'a'}">${it.step}</span>
      <span class="label">${it.label}</span>
      <span class="route">${isUser ? 'USER' : 'ADMIN'}</span>
    </div>
    <div class="thumb"><iframe src="screens/${it.file}.html" loading="lazy" title="${it.label}"></iframe></div>
    <div class="desc">${it.desc}</div>
  </div>`;
}

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AI Career Copilot · 高保真原型 · 功能全览（26 屏）</title>
<style>
  :root{
    --bg:#F5F6F7; --panel:#FFFFFF; --line:#E8EAED; --ink:#202124; --ink-2:#7B818A; --ink-3:#9AA0A6;
    --lime:#C8F36A; --lime-ink:#2E3B13; --line-lime:#D9ECA0;
    --accent:#6B8CAE; --green:#5B8C4A;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;background:var(--bg);color:var(--ink);
    font-family:Inter,"Noto Sans SC",-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}
  .wrap{max-width:1320px;margin:0 auto;padding:40px 28px 80px;}
  .topbar{display:flex;align-items:flex-end;justify-content:space-between;
    padding:28px 32px;background:var(--panel);border:1px solid var(--line);
    border-radius:22px;margin-bottom:28px;}
  .topbar .brand{font-size:23px;font-weight:700;letter-spacing:.2px;}
  .topbar .topic{font-size:12px;color:var(--ink-2);margin-top:6px;letter-spacing:1px;}
  .topbar .meta{text-align:right;font-size:12px;color:var(--ink-2);line-height:1.9;}
  .topbar .meta b{color:var(--ink);font-weight:600;}
  .group{margin:40px 0 4px;font-size:14px;font-weight:700;letter-spacing:.5px;color:var(--ink);
    display:flex;align-items:center;gap:12px;}
  .group .chip{font-size:11px;font-weight:700;letter-spacing:.04em;padding:3px 10px;border-radius:999px;
    background:var(--lime);color:var(--lime-ink);}
  .group .hint{font-size:11.5px;font-weight:400;letter-spacing:0;color:var(--ink-2);}
  .group::after{content:"";flex:1;height:1px;background:var(--line);}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:18px;}
  .cell{background:var(--panel);border:1px solid var(--line);border-radius:16px;
    overflow:hidden;display:flex;flex-direction:column;box-shadow:0 1px 3px rgba(32,33,36,.04);}
  .cell .head{display:flex;align-items:center;gap:10px;padding:11px 14px;
    border-bottom:1px solid var(--line);}
  .cell .no{width:26px;height:26px;border-radius:8px;color:#fff;
    display:grid;place-items:center;font-size:12px;font-weight:700;flex:0 0 26px;}
  .cell .no.u{background:var(--accent);}
  .cell .no.a{background:var(--lime-ink);}
  .cell .label{font-size:13.5px;font-weight:650;color:var(--ink);white-space:nowrap;}
  .cell .route{margin-left:auto;font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--ink-3);
    font-family:ui-monospace,monospace;border:1px solid var(--line);padding:2px 7px;border-radius:6px;}
  .thumb{position:relative;width:100%;height:340px;background:#fff;overflow:hidden;border-bottom:1px solid var(--line);}
  .thumb iframe{position:absolute;top:0;left:0;width:1920px;height:1080px;
    border:0;transform:scale(0.312);transform-origin:top left;}
  .desc{font-size:12px;color:var(--ink-2);line-height:1.6;padding:11px 14px 14px;min-height:56px;}
  .note{margin-top:34px;font-size:12px;color:var(--ink-2);line-height:1.9;
    border-top:1px solid var(--line);padding-top:18px;}
  .note b{color:var(--ink);}
  code{background:var(--line);padding:1px 6px;border-radius:5px;font-size:11px;}
  .align-note{margin-top:14px;font-size:12px;color:var(--lime-ink);background:#F1FBD4;
    border:1px solid var(--line-lime);border-radius:12px;padding:12px 16px;line-height:1.8;}
</style>
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <div>
      <div class="brand">AI Career Copilot</div>
      <div class="topic">高保真原型 · 功能全览 · 与低保真逐页对齐</div>
    </div>
    <div class="meta">
      <div>简历感知 · AI 面试 · 多 Agent 评估</div>
      <div><b>desktop 1440×900</b> · 用户端 17 + 管理员端 9</div>
      <div>2026.10.29 · UI v4 · 共 26 屏</div>
    </div>
  </div>

  <div class="align-note">
    ✅ 本高保真原型严格参照低保真原型「一页一页」绘制：用户端 17 屏、管理员端 9 屏，逐帧对应低保真的每个功能页；
    每屏在低保真线框基础上做了更仔细的高保真表达（真实图表、Mock 数据、状态与交互）。26 屏已用 jsdom 验证画面互不相同。
  </div>

  <div class="group"><span class="chip">USER</span> 用户端 · 17 个功能页 <span class="hint">从「首页 Dashboard」到「能力成长」，逐页对应低保真用户端</span></div>
  <div class="grid">
    ${journey.map(it=>cell(it,true)).join('')}
  </div>

  <div class="group"><span class="chip">ADMIN</span> 管理员端 · 9 个功能页 <span class="hint">运营概览 / 用户 / 面试 / 评分 / 岗位 / Agent / 日志 / 系统</span></div>
  <div class="grid">
    ${admin.map(it=>cell(it,false)).join('')}
  </div>

  <div class="note">
    本页为离线展示页，<b>26 个模块均为独立渲染的 screen</b>（已用 jsdom 逐屏验证：0 运行时错误、画面互不相同、图表均存在）。
    对应源文件：<code>web-prototype/hifi/screens/*.html</code>，生成脚本 <code>gen_screens.js</code>，逻辑源 <code>app.js</code> + <code>data.js</code> + <code>styles.css</code>。
    低保真参照：<code>career-lowfi-user.html</code>（17 帧）/ <code>career-lowfi-admin.html</code>（9 帧）。
  </div>
</div>
</body>
</html>`;

const out = path.join(base, 'gallery.html');
fs.writeFileSync(out, html, 'utf8');
console.log('wrote', out, '(', html.length, 'bytes )');
console.log('USER', journey.length, '+ ADMIN', admin.length, '=', journey.length + admin.length, 'screens');
