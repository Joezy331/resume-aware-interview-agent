/* 生成 Ardot 导入用的「预渲染聚合画板」。
 * 用 jsdom 把每个 screen 路由渲染成静态 DOM（去掉 JS），纵向堆叠固定帧，
 * 与低保真 career-lowfi-user/admin.html 的组织方式完全一致。
 * 输出: board_user.html（用户端 17 帧）、board_admin.html（管理员端 9 帧）
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { convertBreaks } = require('./brk');
const dir = __dirname;

const styles = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const dataJs = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
const appJs  = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');

const USER = [
  ['u/dashboard','首页 Dashboard'],['u/upload','上传简历'],['u/resume','简历解析'],
  ['u/jobs','岗位推荐'],['u/jd','JD 分析'],['u/competency','能力模型'],
  ['u/target','目标岗位'],['u/weight','动态权重'],['u/difficulty','面试难度'],
  ['u/interview','AI 面试'],['u/followup','动态追问'],['u/multiagent','多 Agent 评价'],
  ['u/finish','面试结束'],['u/report','评分报告'],['u/history','面试记录'],
  ['u/api','API / OCR 状态'],['u/growth','能力成长']
];
const ADMIN = [
  ['a/dashboard','Overview 数据看板'],['a/users','Users 用户数据'],['a/interviews','Interviews 面试数据'],
  ['a/scores','Scores 评分数据'],['a/jobs','Jobs 岗位数据'],['a/agents','Agents 运行监控'],
  ['a/agent-detail','Agent Detail 详情'],['a/logs','Logs 运行日志'],['a/system','System 系统状态']
];

/* 单个 JSDOM 实例，循环切 hash 抓 .app 渲染快照 */
const shell = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>${styles}</style></head>
<body><div class="app"><div id="sidebar"></div><div class="main"><header class="topbar" id="topbar"></header><main class="view" id="view"></main></div></div>
<div id="toast"></div><div id="modal-root"></div></body></html>`;
const dom = new JSDOM(shell, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'file://' + dir.replace(/\\/g,'/') + '/index.html' });
const w = dom.window;
w.scrollTo = function(){};
w.eval(dataJs);
w.eval(appJs);
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));

function snap(route){
  w.location.hash = '#/' + route;
  w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  const t = w.document.getElementById('toast'); if(t) t.innerHTML='';
  const m = w.document.getElementById('modal-root'); if(m) m.innerHTML='';
  const app = w.document.querySelector('.app');
  convertBreaks(w.document, app);   // Ardot 会丢 <br>，转成独立块级节点防行重叠
  return app.outerHTML;
}

const BOARD_CSS = `
/* ===== 聚合画板专用覆盖（Ardot 静态渲染） ===== */
*{animation:none!important;transition:none!important}
html,body{height:auto}
body{background:#EDEEF0}
.board{width:1440px;margin:0 auto;padding:44px 0 90px;display:flex;flex-direction:column;gap:34px;align-items:center}
.board-head{width:1360px;background:#FFFFFF;border:1px solid #E8EAED;border-radius:18px;padding:30px 34px;
  display:flex;align-items:center;gap:18px;box-shadow:0 6px 22px rgba(32,33,36,.05)}
.board-head .chip{font-size:13px;font-weight:800;letter-spacing:.08em;padding:7px 14px;border-radius:999px;
  background:#C8F36A;color:#2E3B13;flex:0 0 auto}
.board-head.admin .chip{background:#2E3B13;color:#C8F36A}
.board-head .htxt h1{font-size:24px;font-weight:750;letter-spacing:-.02em;margin:0}
.board-head .htxt .sub{font-size:13px;color:#7B818A;margin-top:5px}
.board-head .hmeta{margin-left:auto;flex:0 0 auto;text-align:right;font-size:12px;color:#5A616B;line-height:20px;display:flex;flex-direction:column;gap:4px}
.board-head .hmeta .hm-line{display:block;white-space:nowrap;line-height:20px;height:20px}
.frame-wrap{width:1440px}
.frame-label{width:1360px;margin:0 auto 12px;display:flex;align-items:center;gap:12px}
.frame-label .no{width:30px;height:30px;border-radius:9px;background:#6B8CAE;color:#fff;display:grid;place-items:center;
  font-size:13px;font-weight:800;flex:0 0 30px}
.frame-wrap.admin .frame-label .no{background:#2E3B13;color:#C8F36A}
.frame-label .fl{font-size:16px;font-weight:700;color:#202124}
.frame-label code{margin-left:auto;font-size:11px;color:#9AA0A6;background:#FFFFFF;border:1px solid #E8EAED;
  padding:3px 9px;border-radius:7px;font-family:ui-monospace,monospace}
.frame-box{width:1440px;min-height:900px;background:#FFFFFF;border:1px solid #E8EAED;border-radius:14px;
  overflow:hidden;display:flex}
.frame-box .app{min-height:900px!important;width:1440px}
.frame-box .sidebar{position:relative!important;top:auto!important;height:auto!important;align-self:stretch}
.frame-box .topbar{position:relative!important}
.frame-box .view{animation:none!important}
/* br 换行转块级节点：每行独立，Ardot 不再重叠 */
.brk-li{display:block;min-height:1em}
.brk-sp{display:block;height:10px}
`;

function build(items, cfg){
  const frames = items.map(function(it,i){
    const route=it[0], label=it[1];
    const no=String((cfg.startNo||0)+i+1).padStart(2,'0');
    return `<div class="frame-wrap ${cfg.cls}">
      <div class="frame-label"><span class="no">${no}</span><span class="fl">${label}</span><code>${route}</code></div>
      <div class="frame-box">${snap(route)}</div>
    </div>`;
  }).join('\n');
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>${cfg.title}</title>
<style>${styles}\n${BOARD_CSS}</style></head>
<body><div class="board">
  <div class="board-head ${cfg.cls}">
    <span class="chip">${cfg.chip}</span>
    <div class="htxt"><h1>${cfg.title}</h1><div class="sub">${cfg.sub}</div></div>
    <div class="hmeta">
      <div class="hm-line">简历感知 · AI 面试 · 多 Agent 评估</div>
      <div class="hm-line">desktop 1440 · UI v4 · 2026.10.29</div>
      <div class="hm-line">共 ${items.length} 个功能页</div>
    </div>
  </div>
  ${frames}
</div></body></html>`;
}

/* 用户端 17 帧拆成上下两段，规避 Ardot 单节点高度 16384px 上限 */
const USER_A = USER.slice(0,9);   // 01–09
const USER_B = USER.slice(9);     // 10–17
const userAHtml = build(USER_A, {
  cls:'user', chip:'USER', title:'用户端 · 高保真原型（上）01–09',
  sub:'与低保真用户端逐页对齐 · 首页 → 上传 → 解析 → 岗位 → JD → 能力 → 目标 → 权重 → 难度',
  startNo:0
});
const userBHtml = build(USER_B, {
  cls:'user', chip:'USER', title:'用户端 · 高保真原型（下）10–17',
  sub:'与低保真用户端逐页对齐 · AI 面试 → 动态追问 → 多 Agent → 结束 → 报告 → 记录 → API/OCR → 成长',
  startNo:9
});
const adminHtml = build(ADMIN, {
  cls:'admin', chip:'ADMIN', title:'管理员端 · 高保真原型全览',
  sub:'与低保真管理员端 9 帧逐页对齐 · 运营 / 用户 / 面试 / 评分 / 岗位 / Agent / 日志 / 系统'
});

fs.writeFileSync(path.join(dir,'board_user_a.html'), userAHtml, 'utf8');
fs.writeFileSync(path.join(dir,'board_user_b.html'), userBHtml, 'utf8');
fs.writeFileSync(path.join(dir,'board_admin.html'), adminHtml, 'utf8');
console.log('wrote board_user_a.html  (', userAHtml.length, 'bytes,', USER_A.length, 'frames )');
console.log('wrote board_user_b.html  (', userBHtml.length, 'bytes,', USER_B.length, 'frames )');
console.log('wrote board_admin.html (', adminHtml.length, 'bytes,', ADMIN.length, 'frames )');
