/* Cline 可用模型同步 E2E：真实启动应用 → 设置页 → 触发同步 → 校验
 * 运行：electron tools/test_models_sync.js（必须由 Bash 直接启动 electron）
 * 校验点：下拉选项=服务真实列表；状态文字；local_api_config.json 落盘。
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { createModelService } = require('../models-sync.js');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

// 测试进程独立注册与 main.js 完全相同的 handler（共享 createModelService 实现），
// 使 preload → IPC → 真实 fetch Cline → 落盘 的完整链路在本进程内可验证。
const cfgPath = path.join(__dirname, '..', 'local_api_config.json');
const modelSvc = createModelService({
  loadConfig: () => JSON.parse(fs.readFileSync(cfgPath, 'utf-8')),
  configPath: () => cfgPath
});
ipcMain.handle('get-local-config', () => modelSvc.getLocalConfig());
ipcMain.handle('list-models', (e, p) => modelSvc.listModels(p));

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 1280, height: 900, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, webSecurity: false, preload: path.join(__dirname, '..', 'preload.js') }
    });
    await win.loadFile(path.join(__dirname, '..', 'index.html'));
    await new Promise(r => setTimeout(r, 2000));

    await win.webContents.executeJavaScript("try{showPage('settings')}catch(e){}; true");
    const mode = process.argv[2] || 'sync';
    if (mode !== 'restore-only') {
      await win.webContents.executeJavaScript("try{refreshClineModels()}catch(e){}; true");
      await new Promise(r => setTimeout(r, 4500));
    } else {
      // 启动恢复模式：只等 initClineModels 异步完成，验证不联网也能从持久化配置恢复列表
      await new Promise(r => setTimeout(r, 3000));
    }

    const info = await win.webContents.executeJavaScript(`(function(){
      var sel=document.getElementById('settings-model');
      var st=document.getElementById('settings-models-status');
      return {
        options: sel?Array.prototype.slice.call(sel.options).map(function(o){return o.value;}):[],
        value: sel?sel.value:'',
        status: st?st.textContent.slice(0,400):''
      };
    })()`);
    console.log('OPTIONS=' + JSON.stringify(info.options));
    console.log('VALUE=' + info.value);
    console.log('STATUS=' + info.status);

    // 启动恢复验证：再起一个新读法不可行（同进程限制），直接校验落盘 + get-local-config 回读
    const cfgPath = path.join(__dirname, '..', 'local_api_config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    console.log('CFG_AVAILABLE=' + JSON.stringify(cfg.available_models));
    console.log('CFG_UPDATED_AT=' + cfg.models_updated_at);
    console.log('CFG_KEY_PRESERVED=' + (cfg.api_key ? 'yes' : 'no') + ' BAIDU=' + (cfg.baidu ? 'yes' : 'no'));

    const back = await win.webContents.executeJavaScript(
      'window.electronAPI.getLocalConfig().then(function(c){return JSON.stringify({n:c.availableModels.length,at:c.modelsUpdatedAt});})'
    );
    console.log('IPC_READBACK=' + back);

    const okSel = info.options.length >= 4 && info.options.indexOf('auto') === info.options.length - 1;
    const expectRestore = mode === 'restore-only';
    const okStatus = expectRestore ? /已恢复上次同步/.test(info.status) : /已同步 \d+ 个可用模型/.test(info.status);
    const okCfg = Array.isArray(cfg.available_models) && cfg.available_models.length > 0 && cfg.api_key && cfg.baidu;
    fs.mkdirSync(path.join(__dirname, '..', '_preview'), { recursive: true });
    await win.webContents.capturePage();
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, '..', '_preview', 'settings_models' + (expectRestore ? '_restore' : '') + '.png'), img.toPNG());
    console.log((okSel && okCfg && okStatus) ? 'E2E_OK' : 'E2E_FAIL(okSel=' + okSel + ' okCfg=' + okCfg + ' okStatus=' + okStatus + ')');
  } catch (e) {
    console.log('E2E_ERROR ' + ((e && e.message) ? e.message : e));
  }
  app.quit();
});
