/* 回归：能力模型雷达图“又不加载”的缺陷。
 * 缺陷成因：renderCompetencyRadar 的重试计数 _t 在面板隐藏时超限后不再重置，
 * 之后即使面板已可见，每次调用都会立刻降级为文字版。
 * 本测试复现：面板隐藏 → 计数污染到 999 → 切到第 3 步 → 应恢复为雷达图。
 * 运行：env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe tests/radar_reload_check.js
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

process.on('uncaughtException', e => console.error('TEST uncaughtException:', e && e.message));
process.on('unhandledRejection', e => console.error('TEST unhandledRejection:', e && e.message));

async function main() {
  const win = new BrowserWindow({ show: false, width: 1400, height: 900 });
  const errs = [];
  win.webContents.on('console-message', (e, level, m) => { if (level >= 2) errs.push('[console] ' + m); });
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise(r => setTimeout(r, 900));
  await win.webContents.executeJavaScript('window.alert=function(){};window.confirm=function(){return false;};0;');

  const chartLoaded = await win.webContents.executeJavaScript('typeof Chart');

  // 复现旧 bug：先进入简历页（真实场景），第 3 步仍隐藏 → 构建能力树 →
  // 人为把重试计数打到超限（模拟“已在隐藏时放弃”）→ 切到第 3 步。
  await win.webContents.executeJavaScript(`(function(){
    showPage('resume');
    setResumeStep(1);
    document.getElementById('resume-step-3').style.display='none';
    buildCompetencyTree('AI 产品经理');
    renderCompetencyRadar._t = 999;
    setResumeStep(3);
    return true;
  })()`);

  // 等 setResumeStep 的 60ms 延迟 + 渲染
  await new Promise(r => setTimeout(r, 1600));

  const r = await win.webContents.executeJavaScript(`(function(){
    var cv=document.getElementById('competency-radar');
    var fb=document.getElementById('competency-fallback');
    return {
      radarExists: !!radarChart,
      canvasDisplay: cv?cv.style.display:'(no canvas)',
      canvasWidth: cv?cv.clientWidth:0,
      fbDisplay: fb?fb.style.display:'(no fb)',
      treeCols: document.querySelectorAll('#ctree-left .ctree-l1').length,
      retryCount: renderCompetencyRadar._t,
      scores: competencyScores
    };
  })()`);

  const checks = {
    'Chart.js 已加载': chartLoaded === 'function',
    '污染后切入第3步仍创建雷达图': r.radarExists === true,
    'canvas 可见(未降级)': r.canvasDisplay !== 'none',
    'canvas 有宽度': r.canvasWidth > 0,
    '文字降级块已隐藏': r.fbDisplay === 'none',
    '能力树已渲染': r.treeCols >= 1,
    '能力分数已生成': !!(r.scores && Object.keys(r.scores).length === 6)
  };

  let pass = 0, fail = 0;
  console.log('--- radar reload 结果 ---');
  Object.keys(checks).forEach(k => {
    if (checks[k]) { pass++; console.log('  ✅ ' + k); }
    else { fail++; console.log('  ❌ ' + k); }
  });
  console.log('--- 明细 ---');
  console.log('  chartType:', chartLoaded);
  console.log('  radarExists:', r.radarExists, ' canvasDisplay:', r.canvasDisplay, ' width:', r.canvasWidth);
  console.log('  fbDisplay:', r.fbDisplay, ' treeCols:', r.treeCols, ' retryCount:', r.retryCount);
  console.log('  scores:', JSON.stringify(r.scores));
  if (errs.length) { console.log('--- console errors ---'); errs.forEach(e => console.log('  ' + e)); }
  console.log('PASSED=' + pass + ' FAILED=' + fail);
  win.destroy();
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

function boot() {
  var ready = (app && typeof app.whenReady === 'function') ? app.whenReady() : new Promise(function (res) { app.on('ready', res); });
  Promise.resolve(ready)
    .then(main)
    .catch(function (e) { console.error('TEST ERROR:', e && (e.stack || e.message || e)); })
    .then(function () { try { app.quit(); } catch (_) {} });
}
boot();
