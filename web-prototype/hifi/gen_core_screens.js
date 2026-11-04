/* 生成 6 张核心屏的「预渲染单帧静态 HTML」（去 JS，与聚合画板同源）。
 * 用于替换 Ardot 上仍是修复前版本的核心屏 25:1~29:1 / 36:1
 * （这些旧屏图表仍依赖被 Ardot 丢弃的 text-anchor/dominant-baseline）。
 * 输出: core_dashboard/resume/jobs/interview/report/multiagent.html
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { convertBreaks } = require('./brk');
const dir = __dirname;
const styles = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const dataJs = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
const appJs  = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');

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

const CORE_CSS = `
*{animation:none!important;transition:none!important}
html,body{height:auto;margin:0;padding:0}
body{background:#FFFFFF}
.core-wrap{width:1440px;background:#FFFFFF;display:flex}
.core-wrap .app{min-height:900px!important;width:1440px;display:flex}
.core-wrap .sidebar{position:relative!important;top:auto!important;left:auto!important;height:auto!important;align-self:stretch}
.core-wrap .topbar{position:relative!important}
.core-wrap .view{animation:none!important}
/* br 换行转块级节点：每行独立，Ardot 不再重叠 */
.brk-li{display:block;min-height:1em}
.brk-sp{display:block;height:10px}
`;

const CORE = [
  ['u/dashboard','core_dashboard'],
  ['u/resume','core_resume'],
  ['u/jobs','core_jobs'],
  ['u/interview','core_interview'],
  ['u/report','core_report'],
  ['u/multiagent','core_multiagent'],
];
for(const [route,name] of CORE){
  const body = snap(route);
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${name}</title><style>${styles}\n${CORE_CSS}</style></head><body><div class="core-wrap">${body}</div></body></html>`;
  fs.writeFileSync(path.join(dir, name + '.html'), html, 'utf8');
  console.log('wrote', name + '.html', html.length, 'bytes');
}
