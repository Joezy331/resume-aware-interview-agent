/* UI v4 布局审计：逐页测量计算样式/几何、检查溢出与对比度，并导出 8 页截图。
 * 运行：env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe tests/ui_v4_audit.js <outDir>
 * 说明：只读渲染 + 截图，不写入任何业务状态（dashboard 解锁仅在本进程内临时置位）。
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

const PAGES = ['home', 'resume', 'interview', 'report', 'agents', 'dashboard', 'history', 'settings'];
const FILES = {
  home: '01_home.png', resume: '02_resume.png', interview: '03_interview.png',
  report: '04_report.png', agents: '05_agents.png', dashboard: '06_dashboard.png',
  history: '07_history.png', settings: '08_settings.png'
};

app.whenReady().then(async () => {
  const outDir = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'screenshots_v4'));
  fs.mkdirSync(outDir, { recursive: true });

  const win = new BrowserWindow({ width: 1440, height: 900, show: false });
  const errs = [];
  win.webContents.on('console-message', (e, level, msg) => {
    if (level >= 2 && !/Security Warning/.test(msg)) errs.push('[console] ' + msg);
  });
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise(r => setTimeout(r, 1800));

  const report = { viewport: null, pages: {}, errors: errs };

  const geom = await win.webContents.executeJavaScript(`(function(){
    function cs(sel,prop){var el=document.querySelector(sel);if(!el)return null;return getComputedStyle(el)[prop];}
    function rect(sel){var el=document.querySelector(sel);if(!el)return null;var r=el.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};}
    function lum(c){
      var m=c.match(/[\\d.]+/g); if(!m) return 1;
      var v=m.slice(0,3).map(function(x){x=parseFloat(x)/255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4);});
      return .2126*v[0]+.7152*v[1]+.0722*v[2];
    }
    function ratio(fg,bg){var a=lum(fg),b=lum(bg);var hi=Math.max(a,b),lo=Math.min(a,b);return Math.round(((hi+.05)/(lo+.05))*100)/100;}
    var bodyBg=cs('body','backgroundColor');
    var navLinks=document.querySelectorAll('.nav-link');
    return {
      vw: window.innerWidth, vh: window.innerHeight,
      scrollW: document.documentElement.scrollWidth,
      sidebar: rect('.sidebar'),
      topbar: rect('.topbar'),
      page: rect('#page-home'),
      pageMarginLeft: cs('#page-home','marginLeft'),
      pagePaddingTop: cs('#page-home','paddingTop'),
      bodyBg: bodyBg,
      titleColor: cs('.tb-title','color'),
      titleContrast: ratio(cs('.tb-title','color'), bodyBg),
      cardBg: cs('.card','backgroundColor'),
      cardRadius: cs('.card','borderTopLeftRadius'),
      activeNavBg: cs('.nav-link.active','backgroundColor'),
      activeNavColor: cs('.nav-link.active','color'),
      activeNavContrast: ratio(cs('.nav-link.active','color'), cs('.nav-link.active','backgroundColor')),
      navCount: navLinks.length,
      navWithDataPage: document.querySelectorAll('.nav-link[data-page]').length,
      activeNavCount: document.querySelectorAll('.nav-link.active').length,
      hasOverflowX: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  report.viewport = geom;

  async function shot(page) {
    try {
      if (page === 'dashboard') {
        await win.webContents.executeJavaScript(`(function(){try{isAdminAuthenticated=true;var g=document.getElementById('dashboard-lock');if(g)g.style.display='none';var c=document.getElementById('dashboard-content');if(c)c.style.display='block';renderDashboard();}catch(e){}})()`);
      }
      await win.webContents.executeJavaScript(`showPage('${page}')`);
      await new Promise(r => setTimeout(r, 850));
      const m = await win.webContents.executeJavaScript(`(function(){
        var el=document.getElementById('page-${page}');
        var active=el&&el.classList.contains('active');
        var tw=el?el.scrollWidth:0, cw=el?el.clientWidth:0;
        var links=[].slice.call(document.querySelectorAll('.nav-link'));
        var act=links.filter(function(l){return l.classList.contains('active');});
        return {
          active: !!active,
          display: el?getComputedStyle(el).display:null,
          overflowX: tw > cw + 1,
          overflowDelta: tw - cw,
          activeNav: act.length===1 ? act[0].getAttribute('data-page') : null,
          activeNavCount: act.length,
          title: (document.getElementById('tb-title')||{}).textContent,
          crumb: (document.getElementById('tb-current')||{}).textContent
        };
      })()`);
      report.pages[page] = m;
      await win.webContents.capturePage();
      await new Promise(r => setTimeout(r, 260));
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(outDir, FILES[page]), img.toPNG());
      console.log('SHOT_OK ' + page + ' -> ' + FILES[page]);
    } catch (e) {
      console.log('SHOT_FAIL ' + page + ' :: ' + (e && e.message ? e.message : e));
    }
  }

  for (const p of PAGES) await shot(p);

  // ---- 断言 ----
  const checks = [];
  const add = (name, cond, detail) => checks.push({ name, ok: !!cond, detail });
  const g = report.viewport;
  add('侧边栏宽度 = 236', g.sidebar && Math.abs(g.sidebar.w - 236) <= 1, g.sidebar);
  add('顶栏起点 = 236（与侧边栏对齐）', g.topbar && Math.abs(g.topbar.x - 236) <= 1, g.topbar);
  add('顶栏高度 = 72', g.topbar && Math.abs(g.topbar.h - 72) <= 1, g.topbar);
  add('内容区左边距 = 236', g.pageMarginLeft === '236px', g.pageMarginLeft);
  add('内容区顶部留白 ≥ 96', parseFloat(g.pagePaddingTop) >= 96, g.pagePaddingTop);
  add('无横向溢出', !g.hasOverflowX, g.scrollW + '/' + g.vw);
  add('导航项 = 8 且均带 data-page', g.navCount === 8 && g.navWithDataPage === 8, g.navCount + '/' + g.navWithDataPage);
  add('标题对比度 ≥ 4.5', g.titleContrast >= 4.5, g.titleContrast);
  add('选中项对比度 ≥ 4.5', g.activeNavContrast >= 4.5, g.activeNavContrast);
  add('选中项使用荧光绿强调', /200,\s*243,\s*106/.test(g.activeNavBg || ''), g.activeNavBg);
  add('卡片圆角 ≥ 14px', parseFloat(g.cardRadius) >= 14, g.cardRadius);

  PAGES.forEach(p => {
    const m = report.pages[p] || {};
    add('页面 ' + p + ' 可激活', m.active === true, m.display);
    add('页面 ' + p + ' 导航高亮正确', m.activeNav === p, m.activeNav);
    add('页面 ' + p + ' 无横向溢出', m.overflowX === false, 'Δ=' + m.overflowDelta);
    add('页面 ' + p + ' 顶栏标题非空', !!m.title && m.title.length > 0, m.title);
  });

  console.log('--- 审计 ---');
  let pass = 0, fail = 0;
  checks.forEach(c => { if (c.ok) { pass++; console.log('  ✅ ' + c.name); } else { fail++; console.log('  ❌ ' + c.name + ' :: ' + JSON.stringify(c.detail)); } });
  console.log('AUDIT_PASSED=' + pass + ' FAILED=' + fail);
  if (errs.length) { console.log('--- console errors ---'); errs.forEach(e => console.log('  ' + e)); }
  fs.writeFileSync(path.join(outDir, '_audit.json'), JSON.stringify({ report, checks }, null, 2), 'utf-8');
  app.quit();
}).catch(e => { console.log('ERR ' + (e && e.stack ? e.stack : e)); app.quit(); });
