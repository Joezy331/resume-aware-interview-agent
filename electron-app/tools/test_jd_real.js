/* ============================================================
 * tools/test_jd_real.js — JD 模块真实模型 E2E（无 mock）
 * 真实走「渲染进程 callAI → IPC ai-chat → 本地 Cline 服务（带 Bearer）」
 * 链路，验证：行业标准 JD 真实生成 → 归一化 → 六维匹配 → 落库 → Tab 渲染。
 * 运行：electron tools/test_jd_real.js [jobTitle] [level]
 * ============================================================ */
'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const cfg = require('../local_api_config.json');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');
// 隔离 localStorage：每轮测试用独立 userData，避免历史记录累积影响断言
app.setPath('userData', path.join(os.tmpdir(), 'acc_jd_real_' + Date.now()));

const BASE = (cfg.base_url || 'http://localhost:8787/v1').replace(/\/$/, '');
const API_KEY = cfg.api_key || '';
const JOB = process.argv[2] || 'AI 产品经理';
const LEVEL = process.argv[3] || '实习生';
const outDir = path.join(__dirname, '..', '_preview');
fs.mkdirSync(outDir, { recursive: true });

const cfgPath = path.join(__dirname, '..', 'local_api_config.json');
const { createModelService } = require('../models-sync.js');
const modelSvc = createModelService({
  loadConfig: () => JSON.parse(fs.readFileSync(cfgPath, 'utf-8')),
  configPath: () => cfgPath
});
ipcMain.handle('get-local-config', () => modelSvc.getLocalConfig());
ipcMain.handle('list-models', () => modelSvc.listModels({}));

/* 真实 ai-chat 代理（与 main.js 等价：密钥/地址/model 三级兜底 + Bearer + 90s 超时） */
ipcMain.handle('ai-chat', async (event, payload) => {
  const p = payload || {};
  let local = {};
  try { local = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')); } catch (e) {}
  const apiKey = (p.apiKey && String(p.apiKey).trim()) ? p.apiKey : (local.api_key || '');
  const baseUrl = (p.baseUrl && String(p.baseUrl).trim()) ? p.baseUrl : (local.base_url || 'http://localhost:8787/v1');
  const model = (p.model && String(p.model).trim()) ? p.model : (local.model || '');
  if (!apiKey) return { ok: false, error: '未配置 API Key' };
  return new Promise(resolve => {
    const body = JSON.stringify({
      model: model, messages: Array.isArray(p.messages) ? p.messages : [],
      temperature: typeof p.temperature === 'number' ? p.temperature : 0.7,
      max_tokens: Math.min((p.maxTokens || 2048), 8192)
    });
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
    headers['Authorization'] = 'Bearer ' + apiKey;
    const url = new URL(String(baseUrl).replace(/\/+$/, '') + '/chat/completions');
    const req = http.request({
      hostname: url.hostname, port: url.port || 80, path: url.pathname, method: 'POST', headers, timeout: 150000
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve({ ok: false, error: 'HTTP ' + res.statusCode + ' :: ' + buf.slice(0, 120) });
        try {
          const j = JSON.parse(buf);
          const c = (j.choices && j.choices[0]) || {};
          const text = (c.message && c.message.content) || '';
          if (!text) return resolve({ ok: false, error: '空返回 finish=' + c.finish_reason });
          resolve({ ok: true, text, model: model, finish: c.finish_reason });
        } catch (e) { resolve({ ok: false, error: 'parse: ' + buf.slice(0, 150) }); }
      });
    });
    req.on('error', e => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(body); req.end();
  });
});

let win = null;
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + ' :: ' + JSON.stringify(detail).slice(0, 300)); }
}
async function shot(name) {
  await new Promise(r => setTimeout(r, 400));
  await win.webContents.capturePage();
  await new Promise(r => setTimeout(r, 250));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outDir, name), img.toPNG());
  console.log('SHOT_OK ' + name);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  try {
    win = new BrowserWindow({
      width: 1440, height: 900, show: false,
      webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, nodeIntegration: false, webSecurity: false }
    });
    await win.loadURL('file://' + path.join(__dirname, '..', 'index.html'));
    await sleep(1200);
    // 拦截 alert（隐藏窗口里 alert 会阻塞渲染进程）
    await win.webContents.executeJavaScript(`
      window.__alerts=[];
      window.alert=function(m){ window.__alerts.push(String(m)); };
      window.confirm=function(){ return true; };
      true;
    `);

    const probe = await win.webContents.executeJavaScript(`(function(){
      return { hasApi: !!(window.electronAPI && window.electronAPI.aiChat),
               models: (typeof AVAILABLE_MODELS!=='undefined') ? AVAILABLE_MODELS.slice(0,3) : null,
               stageModel: (typeof getAIModelForStage==='function') ? getAIModelForStage('jd_gen') : null };
    })()`);
    console.log('PROBE ' + JSON.stringify(probe));
    ok('渲染进程具备 AI 调用能力', probe.hasApi === true, probe);

    // 进入模式二向导
    await win.webContents.executeJavaScript("showPage('jd'); jdpgOpenMode('gen'); jdpgUseSample(); jdpgConfirmResume();");
    await sleep(600);
    await win.webContents.executeJavaScript(`(function(){
      document.getElementById('jdpg-job-input').value=${JSON.stringify(JOB)};
      jdpgSetLevel(${JSON.stringify(LEVEL)});
      return true;
    })()`);
    const recs = await win.webContents.executeJavaScript("document.querySelectorAll('#jdpg-rec-grid .jdpg-rec').length");
    ok('推荐卡片已渲染', recs >= 3, recs);

    console.log('GEN_START ' + JOB + ' · ' + LEVEL + '（真实模型，最长等待 300s）');
    const t0 = Date.now();
    await win.webContents.executeJavaScript("jdpgGenerate()");

    // 轮询等待结果（结果卡显示 或 出现 alert 错误）
    let shown = false;
    for (let i = 0; i < 100; i++) {
      await sleep(3000);
      const st = await win.webContents.executeJavaScript(`({
        result: document.getElementById('jdpg-result').style.display,
        progress: document.getElementById('jdpg-progress-text').textContent,
        alerts: window.__alerts || []
      })`);
      if (st.alerts.length) { console.log('ALERT ' + st.alerts.join(' | ')); break; }
      if (st.result === 'block') { shown = true; break; }
      if (i % 5 === 0) console.log('  ... ' + Math.round((Date.now() - t0) / 1000) + 's ' + st.progress);
    }
    const secs = Math.round((Date.now() - t0) / 1000);
    console.log('GEN_DONE ' + secs + 's shown=' + shown);

    const res = await win.webContents.executeJavaScript(`(function(){
      var jd=jdpgState.jd, m=jdpgState.match, rec=jdpgState.record;
      return {
        shown: document.getElementById('jdpg-result').style.display,
        title: document.getElementById('jdpg-res-title').textContent,
        score: document.getElementById('jdpg-res-score').textContent,
        jobTitle: jd && jd.job_title, level: jd && jd.job_level,
        summaryLen: jd && jd.job_summary ? jd.job_summary.length : 0,
        resp: jd ? jd.responsibilities.length : 0,
        req: jd ? jd.required_qualifications.length : 0,
        pref: jd ? jd.preferred_qualifications.length : 0,
        skills: jd ? jd.professional_skills.length : 0,
        kpi: jd ? jd.kpi_indicators.length : 0,
        scenes: jd ? jd.work_scenarios.length : 0,
        path: jd ? jd.career_path.length : 0,
        fallback: !!(jd && jd._fallback),
        dims: m ? m.dimensions.length : 0,
        overall: m ? m.overall_match : null,
        satisfied: m ? m.satisfied.length : 0,
        missing: m ? m.missing.length : 0,
        hist: JDCore.loadJDHistory().length,
        recScore: rec ? rec.match_score : null,
        jdText: (jd ? JDCore.jdToText(jd) : '')
      };
    })()`);

    ok('真实生成结果渲染', res.shown === 'block', res);
    ok('未走本地兜底（真实模型产出）', res.fallback === false, res.fallback);
    ok('JD 九段字段齐全', res.summaryLen > 50 && res.resp >= 4 && res.req >= 2 && res.pref >= 1 && res.skills >= 4 && res.kpi >= 3 && res.scenes >= 3 && res.path >= 1, res);
    ok('岗位与职级正确', String(res.jobTitle).indexOf(JOB) >= 0 && String(res.level).indexOf(LEVEL) >= 0, { t: res.jobTitle, l: res.level });
    ok('六维匹配完成', res.dims === 6 && res.overall > 0, { dims: res.dims, overall: res.overall });
    ok('匹配含证据分区', res.satisfied + res.missing > 0, res);
    ok('真实生成已落库（含匹配分）', res.hist >= 1 && res.recScore === res.overall, { hist: res.hist, recScore: res.recScore, overall: res.overall });
    console.log('--- JD TEXT HEAD ---');
    console.log(String(res.jdText).slice(0, 700));

    // Tab 全遍历 + 截图
    for (let i = 0; i < 8; i++) {
      await win.webContents.executeJavaScript("document.querySelectorAll('#jdpg-tabs .jdpg-tab')[" + i + "].click()");
      await sleep(150);
      const len = await win.webContents.executeJavaScript("document.getElementById('jdpg-tab-body').innerHTML.length");
      if (len < 30) console.log('  ⚠ TAB ' + i + ' 内容过短 len=' + len);
    }
    await win.webContents.executeJavaScript("document.querySelectorAll('#jdpg-tabs .jdpg-tab')[0].click()");
    await shot('jd_real_overview.png');
    await win.webContents.executeJavaScript("document.querySelectorAll('#jdpg-tabs .jdpg-tab')[5].click()");
    await shot('jd_real_match.png');

    // 保存/复制/完整JD（真实可用）
    await win.webContents.executeJavaScript("jdpgSave(true)");
    const post = await win.webContents.executeJavaScript(`({
      saved: (document.getElementById('jdpg-save-status')||{}).textContent,
      fullTextLen: (function(){ jdpgViewFull(); var t=(document.getElementById('modal-body')||{}).textContent||''; closeModal(); return t.length; })(),
      hist: JDCore.loadJDHistory().length
    })`);
    ok('保存按钮真实生效', /已保存/.test(post.saved || ''), post.saved);
    ok('完整 JD 可查看', post.fullTextLen > 500, post.fullTextLen);
    ok('历史记录无重复堆积', post.hist <= 3, post.hist);

    console.log('---');
    console.log('REAL_E2E_OK PASS=' + pass + ' FAIL=' + fail);
    app.quit();
  } catch (e) {
    console.log('REAL_E2E_FAIL ' + (e && e.stack || e));
    app.quit();
  }
});
