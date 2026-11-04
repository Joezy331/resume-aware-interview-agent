/* Generate standalone per-screen high-fidelity HTML files.
 * Each file is a complete mini-SPA that statically renders ONE route,
 * reusing the exact design-system CSS, data.js and app.js render logic.
 * Output: web-prototype/hifi/screens/<route>.html
 */
const fs = require('fs');
const path = require('path');

const base = __dirname;
const styles = fs.readFileSync(path.join(base, 'styles.css'), 'utf8');
const dataJs = fs.readFileSync(path.join(base, 'data.js'), 'utf8');
const appJs  = fs.readFileSync(path.join(base, 'app.js'), 'utf8');

/* 与低保真原型帧一一对应：用户端 17 帧 + 管理员端 9 帧 = 26 屏。
 * route 必须与 app.js 的 PAGES 键完全一致（注意 a/agent-detail 是连字符）。
 * 用户端按低保真「Dashboard→上传→解析→岗位→JD→能力→目标→权重→难度→面试→追问→多Agent→结束→报告→历史→API/OCR→成长」顺序；
 * 管理员端按「Overview→Users→Interviews→Scores→Jobs→Agents→AgentDetail→Logs→System」顺序。 */
const screens = [
  /* ===== 用户端 USER · 17 ===== */
  ['u/dashboard',   'u_dashboard',   '首页 Dashboard'],
  ['u/upload',      'u_upload',      '上传简历'],
  ['u/resume',      'u_resume',      '简历解析'],
  ['u/jobs',        'u_jobs',        '岗位推荐'],
  ['u/jd',          'u_jd',          'JD 分析'],
  ['u/competency',  'u_competency',  '能力模型'],
  ['u/target',      'u_target',      '目标岗位'],
  ['u/weight',      'u_weight',      '动态权重'],
  ['u/difficulty',  'u_difficulty',  '面试难度'],
  ['u/interview',   'u_interview',   'AI 面试'],
  ['u/followup',    'u_followup',    '动态追问'],
  ['u/multiagent',  'u_multiagent',  '多 Agent 评价'],
  ['u/finish',      'u_finish',      '面试结束'],
  ['u/report',      'u_report',      '评分报告'],
  ['u/history',     'u_history',     '面试记录'],
  ['u/api',         'u_api',         'API / OCR 状态'],
  ['u/growth',      'u_growth',      '能力成长'],
  /* ===== 管理员端 ADMIN · 9 ===== */
  ['a/dashboard',   'a_dashboard',   'Overview 数据看板'],
  ['a/users',       'a_users',       'Users 用户数据'],
  ['a/interviews',  'a_interviews',  'Interviews 面试数据'],
  ['a/scores',      'a_scores',      'Scores 评分数据'],
  ['a/jobs',        'a_jobs',        'Jobs 岗位数据'],
  ['a/agents',      'a_agents',      'Agents 运行监控'],
  ['a/agent-detail','a_agent_detail','Agent Detail 详情'],
  ['a/logs',        'a_logs',        'Logs 运行日志'],
  ['a/system',      'a_system',      'System 系统状态']
];

const outDir = path.join(base, 'screens');
fs.mkdirSync(outDir, { recursive: true });

function build(route, label) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AI Career Copilot · ${label}</title>
<style>${styles}</style>
</head>
<body>
<div class="app">
  <div id="sidebar"></div>
  <div class="main">
    <header class="topbar" id="topbar"></header>
    <main class="view" id="view"></main>
  </div>
</div>
<div id="toast"></div>
<div id="modal-root"></div>
<script>${dataJs}</script>
<script>${appJs}</script>
<script>window.location.hash = '#/${route}';</script>
</body>
</html>`;
}

for (const [route, file, label] of screens) {
  const html = build(route, label);
  fs.writeFileSync(path.join(outDir, file + '.html'), html, 'utf8');
  console.log('wrote', file + '.html', '(' + route + ')');
}
console.log('DONE:', screens.length, 'screens');
