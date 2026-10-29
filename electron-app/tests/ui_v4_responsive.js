/* UI v4 响应式检查（单进程单尺寸，规避同进程多窗口加载失败）
 * 用法：electron tests/ui_v4_responsive.js <width> <height>
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

const W = parseInt(process.argv[2] || '1280', 10);
const H = parseInt(process.argv[3] || '800', 10);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: W, height: H, show: false });
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise(r => setTimeout(r, 1500));

  const m = await win.webContents.executeJavaScript(`(function(){
    var sb=document.querySelector('.sidebar').getBoundingClientRect();
    var tb=document.querySelector('.topbar').getBoundingClientRect();
    var pg=document.getElementById('page-home');
    var cs=getComputedStyle(pg);
    var label=document.querySelector('.sb-label');
    return {
      vw: innerWidth,
      sidebarW: Math.round(sb.width),
      topbarX: Math.round(tb.x),
      topbarH: Math.round(tb.height),
      pageML: cs.marginLeft,
      pagePadL: cs.paddingLeft,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      labelVisible: label ? getComputedStyle(label).display !== 'none' : false,
      contentW: Math.round(pg.getBoundingClientRect().width)
    };
  })()`);

  const checks = [
    ['无横向溢出', !m.overflowX, m],
    ['顶栏与侧边栏对齐', Math.abs(m.topbarX - m.sidebarW) <= 1, m.topbarX + ' vs ' + m.sidebarW],
    ['内容区左边距 = 侧边栏宽', m.pageML === m.sidebarW + 'px', m.pageML],
    ['内容宽度 > 600', m.contentW > 600, m.contentW],
    ['顶栏高度 = 72', Math.abs(m.topbarH - 72) <= 1, m.topbarH]
  ];
  console.log(`--- ${W}x${H} （侧栏 ${m.sidebarW}px / 标签${m.labelVisible ? '显示' : '收起'} / 内容 ${m.contentW}px）---`);
  let pass = 0, fail = 0;
  checks.forEach(([n, ok, d]) => {
    if (ok) { pass++; console.log('  ✅ ' + n); }
    else { fail++; console.log('  ❌ ' + n + ' :: ' + JSON.stringify(d)); }
  });
  console.log('RESPONSIVE_PASSED=' + pass + ' FAILED=' + fail);
  app.quit();
}).catch(e => { console.log('ERR ' + (e && e.stack ? e.stack : e)); app.quit(); });
