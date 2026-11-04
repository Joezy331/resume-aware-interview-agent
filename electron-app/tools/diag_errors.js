/* 诊断：加载 index.html，收集所有 console 错误 / 未捕获异常，遍历全部页面 + JD 模块交互
 * 运行：electron tools/diag_errors.js
 */
'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

let win = null;
const errs = [];
const logs = [];

ipcMain.handle('ai-chat', async (e, p) => ({ ok: false, error: 'DIAG_NO_AI' }));
ipcMain.handle('get-local-config', async () => ({ ok: false, error: 'DIAG' }));
ipcMain.handle('list-models', async () => ({ ok: false, error: 'DIAG' }));

app.whenReady().then(async () => {
  try {
    win = new BrowserWindow({
      width: 1440, height: 900, show: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true, nodeIntegration: false, webSecurity: false
      }
    });
    win.webContents.on('console-message', (e, level, message, line, sourceId) => {
      const rec = { level, message, line, source: String(sourceId || '').split('/').pop() };
      logs.push(rec);
      if (level >= 2) errs.push(rec);
    });
    win.webContents.on('render-process-gone', (e, d) => {
      errs.push({ level: 9, message: 'RENDER_PROCESS_GONE ' + JSON.stringify(d) });
    });
    await win.loadURL('file://' + path.join(__dirname, '..', 'index.html'));
    await new Promise(r => setTimeout(r, 1500));

    // 注入全局错误钩子
    await win.webContents.executeJavaScript(`
      window.__errs = [];
      window.addEventListener('error', function(e){ window.__errs.push('ERROR: ' + (e.message||'') + ' @' + (e.filename||'') + ':' + (e.lineno||0)); });
      window.addEventListener('unhandledrejection', function(e){ window.__errs.push('REJECTION: ' + String((e.reason && (e.reason.stack||e.reason.message)) || e.reason)); });
      true;
    `);

    // 1) 依赖模块是否加载
    const mods = await win.webContents.executeJavaScript(`({
      JobLibrary: typeof JobLibrary,
      JDCore: typeof JDCore,
      JobMatching: typeof JobMatching,
      Chart: typeof Chart,
      electronAPI: typeof window.electronAPI,
      jdFns: ['renderJDPage','jdpgOpenMode','jdpgAnalyzeManual','jdpgGenerate','jdpgCopy','jdpgSave','jdpgViewFull'].filter(function(n){return typeof window[n]!=='function';})
    })`);
    console.log('MODULES ' + JSON.stringify(mods));

    // 2) 逐页切换
    const pages = ['home', 'resume', 'jd', 'interview', 'report', 'agents', 'dashboard', 'history', 'settings'];
    for (const p of pages) {
      try {
        await win.webContents.executeJavaScript("showPage('" + p + "')");
        await new Promise(r => setTimeout(r, 350));
        const st = await win.webContents.executeJavaScript(`({
          active: !!document.getElementById('page-${p}') && document.getElementById('page-${p}').classList.contains('active'),
          title: (document.getElementById('tb-title')||{}).textContent,
          bodyLen: (document.getElementById('page-${p}')||{}).innerHTML.length
        })`);
        console.log('PAGE ' + p + ' ' + JSON.stringify(st));
      } catch (e) { errs.push({ level: 9, message: 'PAGE_SWITCH_FAIL ' + p + ' :: ' + (e && e.message) }); }
    }

    // 3) JD 模块交互（模式一 + 模式二）
    try {
      await win.webContents.executeJavaScript("showPage('jd'); jdpgOpenMode('manual');");
      await new Promise(r => setTimeout(r, 200));
      await win.webContents.executeJavaScript(`(function(){
        document.getElementById('jdpg-manual-input').value = '岗位职责：\\n1. 负责数据看板设计，输出 PRD\\n任职要求：\\n1. 本科及以上，精通 SQL';
        jdpgAnalyzeManual();
      })()`);
      await new Promise(r => setTimeout(r, 500));
      const m1 = await win.webContents.executeJavaScript("document.getElementById('jdpg-manual-result').style.display");
      console.log('MODE1_RESULT ' + m1);

      await win.webContents.executeJavaScript("jdpgOpenMode('gen'); jdpgUseSample(); jdpgConfirmResume();");
      await new Promise(r => setTimeout(r, 400));
      const m2 = await win.webContents.executeJavaScript("({recs: document.querySelectorAll('#jdpg-rec-grid .jdpg-rec').length, levels: document.querySelectorAll('#jdpg-levels .jdpg-level').length})");
      console.log('MODE2_STEP2 ' + JSON.stringify(m2));

      // 生成（无 AI，走本地兜底路径，验证不抛错）
      await win.webContents.executeJavaScript("jdpgGenerate()");
      await new Promise(r => setTimeout(r, 2500));
      const m3 = await win.webContents.executeJavaScript(`({
        shown: document.getElementById('jdpg-result').style.display,
        title: document.getElementById('jdpg-res-title').textContent,
        score: document.getElementById('jdpg-res-score').textContent,
        tabs: document.querySelectorAll('#jdpg-tabs .jdpg-tab').length,
        hist: JDCore.loadJDHistory().length
      })`);
      console.log('MODE2_RESULT ' + JSON.stringify(m3));

      // 逐个 Tab 点击
      for (let i = 0; i < 8; i++) {
        await win.webContents.executeJavaScript("document.querySelectorAll('#jdpg-tabs .jdpg-tab')[" + i + "].click()");
        await new Promise(r => setTimeout(r, 120));
        const len = await win.webContents.executeJavaScript("document.getElementById('jdpg-tab-body').innerHTML.length");
        console.log('TAB ' + i + ' len=' + len);
      }
      // 保存 / 复制 / 完整 JD / 去面试
      await win.webContents.executeJavaScript("jdpgSave(true)");
      await win.webContents.executeJavaScript("jdpgCopy()");
      await win.webContents.executeJavaScript("jdpgViewFull()");
      await new Promise(r => setTimeout(r, 300));
      await win.webContents.executeJavaScript("closeModal()");
      const acts = await win.webContents.executeJavaScript(`({
        saved: (document.getElementById('jdpg-save-status')||{}).textContent,
        modalVisible: document.getElementById('modal-overlay').classList.contains('active')
      })`);
      console.log('ACTIONS ' + JSON.stringify(acts));
      await win.webContents.capturePage().then(img => fs.writeFileSync(path.join(__dirname, '..', '_preview', 'diag_result.png'), img.toPNG()));
    } catch (e) { errs.push({ level: 9, message: 'JD_INTERACTION_FAIL :: ' + (e && e.stack || e) }); }

    // 4) 页面内捕获的错误
    const winErrs = await win.webContents.executeJavaScript("window.__errs || []");
    winErrs.forEach(m => errs.push({ level: 9, message: m }));

    console.log('--- CONSOLE_ERRORS(' + errs.length + ') ---');
    errs.forEach(e => console.log('  [' + e.level + '] ' + e.message + (e.source ? ' @' + e.source + ':' + e.line : '')));
    console.log('--- CONSOLE_WARNS_TAIL ---');
    logs.filter(l => l.level === 1).slice(-8).forEach(l => console.log('  ' + l.message));
    console.log('DIAG_ERRS=' + errs.length);
    app.quit();
  } catch (e) {
    console.log('DIAG_FATAL ' + (e && e.stack || e));
    app.quit();
  }
});
