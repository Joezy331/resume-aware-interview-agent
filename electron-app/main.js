const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 保持对 window 对象的引用，防止被垃圾回收
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'AI Career Copilot',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,  // 允许加载本地资源和 CDN
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,  // 先隐藏，加载完再显示（避免白屏闪烁）
    backgroundColor: '#0a1628',  // 深蓝色背景，匹配产品配色
    autoHideMenuBar: true  // 隐藏菜单栏，更像小程序
  });

  // 加载本地 HTML 文件
  mainWindow.loadFile('index.html');

  // 页面加载完成后显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // 居中显示
    mainWindow.center();
  });

  // 窗口关闭时清理引用
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 处理外部链接（在系统浏览器中打开）
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const { shell } = require('electron');
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ========== 简历文件解析 ==========
// 文本提取逻辑放在 resume-extract.js（纯 Node 模块，可脱离 Electron 单独测试）
const { extractDocxText, extractPdfText, normalizeResumeText } = require('./resume-extract.js');

ipcMain.handle('parse-resume-file', async (event, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return { ok: false, error: '未获取到文件路径' };
    }
    if (!fs.existsSync(filePath)) {
      return { ok: false, error: '文件不存在或已被移动' };
    }
    const ext = path.extname(filePath).toLowerCase();
    let text = '';
    if (ext === '.txt') {
      text = fs.readFileSync(filePath, 'utf-8');
    } else if (ext === '.docx') {
      text = await extractDocxText(filePath);
    } else if (ext === '.pdf') {
      text = await extractPdfText(filePath);
    } else if (ext === '.doc') {
      return { ok: false, error: 'DOC 为旧版 Word 格式，暂不支持。请将简历另存为 .docx 或 .pdf 后重试。' };
    } else {
      return { ok: false, error: '暂不支持该文件类型（' + ext + '）。请上传 .pdf / .docx / .txt 简历。' };
    }
    text = normalizeResumeText(text);
    if (text.length < 20) {
      return { ok: false, error: '未能从文件中提取到足够的文字内容（可能是扫描件/图片型 PDF）。请改用「上传图片」或「粘贴文本」方式。' };
    }
    return { ok: true, text: text, filename: path.basename(filePath) };
  } catch (err) {
    return { ok: false, error: '解析失败：' + (err && err.message ? err.message : err) };
  }
});

// ========== 本地安全配置（API Key / Base URL / Model）==========
// 密钥不可硬编码在源码中，统一从本地文件读取：
//  - 生产 EXE：通过 extraResources 落在 asar 之外的 resources/ 目录
//  - 开发模式：与 main.js 同目录的 local_api_config.json
// 该文件必须加入 .gitignore，禁止提交/打包进可提取的 asar 源码。
const LOCAL_CFG_NAME = 'local_api_config.json';

// 列出所有可能存放本地安全配置的路径（按优先级），覆盖：
//  - 便携版：exe 所在目录（electron-builder portable 注入 PORTABLE_EXECUTABLE_DIR）
//  - 运行中可执行文件目录
//  - resources/（extraResources 落点）
//  - resources/app.asar.unpacked/（asarUnpack 落点，内容在 asar 之外）
//  - 应用源码目录（开发模式 / asar 内）
function candidateConfigPaths() {
  const list = [];
  const push = (p) => { if (p && list.indexOf(p) === -1) list.push(p); };
  try { if (process.env.PORTABLE_EXECUTABLE_DIR) push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, LOCAL_CFG_NAME)); } catch (e) {}
  try { push(path.join(path.dirname(process.execPath), LOCAL_CFG_NAME)); } catch (e) {}
  try { if (process.resourcesPath) push(path.join(process.resourcesPath, LOCAL_CFG_NAME)); } catch (e) {}
  try { if (process.resourcesPath) push(path.join(process.resourcesPath, 'app.asar.unpacked', LOCAL_CFG_NAME)); } catch (e) {}
  try { push(path.join(__dirname, LOCAL_CFG_NAME)); } catch (e) {}
  return list;
}

function loadLocalApiConfig() {
  const tried = [];
  for (const fp of candidateConfigPaths()) {
    tried.push(fp);
    try {
      if (fs.existsSync(fp)) {
        const obj = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        // 只接受含有效 key 的配置；空/损坏配置则继续向下查找
        if (obj && typeof obj === 'object' && (obj.api_key || obj.apiKey)) {
          console.log('[local-config] 已加载密钥配置：' + fp);
          return obj;
        }
      }
    } catch (e) { /* 忽略损坏或不可读的配置 */ }
  }
  console.log('[local-config] 未找到有效配置，已查找：\n  ' + tried.join('\n  '));
  return {};
}


// ========== LLM 对话 IPC ==========
// 渲染进程将 {apiKey,baseUrl,model,messages,temperature} 发给主进程，
// 主进程代理 fetch 外部大模型（兼容 OpenAI 接口），避免 CORS 与 key 暴露
// 默认接入本地 Cline 服务：http://localhost:8787/v1 · 模型 cline-free/mimo-v2.6-flash
ipcMain.handle('ai-chat', async (event, payload) => {
  const p = payload || {};
  // 读取本地安全配置（密钥优先来源，用户在「设置」页手动填写的 key 仍可覆盖）
  let localCfg = {};
  try { localCfg = loadLocalApiConfig(); } catch (e) {}

  const apiKey = (p.apiKey && String(p.apiKey).trim()) ? p.apiKey : (localCfg.api_key || localCfg.apiKey || '');
  const baseUrl = (p.baseUrl && String(p.baseUrl).trim()) ? p.baseUrl : (localCfg.base_url || localCfg.baseUrl || 'http://localhost:8787/v1');
  const model = (p.model && String(p.model).trim()) ? p.model : (localCfg.model || 'cline-free/mimo-v2.6-flash');

  if (!apiKey) {
    return { ok: false, error: '未配置 API Key：请从本地安全配置（local_api_config.json）读取，或在「设置」页填写。' };
  }

  const cleanBase = String(baseUrl).replace(/\/+$/, '');
  const messages = Array.isArray(p.messages) ? p.messages : [];
  const temperature = typeof p.temperature === 'number' ? p.temperature : 0.7;
  // 图片 OCR / 长报告需要更大的输出上限
  const maxTokens = (typeof p.maxTokens === 'number' && p.maxTokens > 0) ? Math.min(p.maxTokens, 8192) : 2048;
  const url = cleanBase + '/chat/completions';

  const controller = new AbortController();
  // 单模型实测最慢约 24s，留足 90s；多模型兜底时每次调用独立计时
  const timer = setTimeout(() => controller.abort(), 90000);
  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: model, messages: messages, temperature: temperature, max_tokens: maxTokens }),
      signal: controller.signal
    });
  } catch (netErr) {
    clearTimeout(timer);
    if (netErr && netErr.name === 'AbortError') {
      return { ok: false, error: '请求超时（60秒），请检查网络或重试。' };
    }
    const msg = (netErr && netErr.message) ? netErr.message : String(netErr);
    if (msg.includes('ECONNREFUSED') || msg.toLowerCase().includes('connect')) {
      return { ok: false, error: '无法连接到 API 服务（' + cleanBase + '）。请确认本地大模型服务已启动。' };
    }
    return { ok: false, error: '网络请求失败：' + msg };
  }
  clearTimeout(timer);

  if (!resp || !resp.ok) {
    const errText = resp ? await resp.text() : '无响应';
    if (resp && resp.status === 401) {
      return { ok: false, error: 'API Key 无效或权限不足（401）。请检查 local_api_config.json 中的 api_key。' };
    }
    if (resp && resp.status === 404) {
      return { ok: false, error: '模型不可用或接口路径错误（404）：' + model };
    }
    if (resp && resp.status === 502) {
      // 本地 Cline 池常见：上游模型对当前地区/账号不可用
      if (/not available in your region|access forbidden/i.test(errText)) {
        return { ok: false, error: '模型「' + model + '」在当前地区不可用（上游 502 access forbidden）。这是服务端区域限制，请在「设置」中改用 Mimo V2.6 Flash / Step 5 Preview / Solar Mini 4。' };
      }
      return { ok: false, error: '上游服务错误（502），模型：' + model + '。可稍后重试或改用其它模型。' + (errText || '').slice(0, 200) };
    }
    if (resp && resp.status === 429) {
      return { ok: false, error: '模型「' + model + '」额度冷却中（429），请稍后重试或改用其它模型。' };
    }
    return { ok: false, error: 'API 返回错误 ' + (resp ? resp.status : '?') + '：' + (errText || '').slice(0, 400) };
  }

  try {
    const data = await resp.json();
    const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    if (!text) return { ok: false, error: 'AI 返回了空内容，请重试。' };
    return { ok: true, text: text, raw: data };
  } catch (e) {
    return { ok: false, error: '响应解析失败：' + (e && e.message ? e.message : e) };
  }
});

// ========== 百度智能云 OCR / NLP ==========
// 简历图片文字识别（比多模态更快更准）+ JD 关键词提取。
// 密钥只从 local_api_config.json 的 baidu 段读取，绝不硬编码。
const baidu = require('./baidu.js');

function baiduCfg() {
  const cfg = (typeof loadLocalApiConfig === 'function') ? loadLocalApiConfig() : {};
  return (cfg && cfg.baidu) || {};
}

ipcMain.handle('baidu-ocr', async (event, payload) => {
  const p = payload || {};
  const b64 = String(p.base64 || '').replace(/^data:image\/\w+;base64,/, '');
  if (!b64) return { ok: false, error: '未收到图片数据' };
  try {
    const text = await baidu.ocr(b64, { cfg: baiduCfg(), accurate: p.accurate === true });
    if (!text || text.trim().length < 5) return { ok: false, error: '百度 OCR 未返回有效文字' };
    return { ok: true, text: text };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
});

ipcMain.handle('baidu-nlp-keyword', async (event, payload) => {
  const p = payload || {};
  const text = String(p.text || '').trim();
  if (text.length < 5) return { ok: false, error: '文本过短' };
  try {
    const words = await baidu.keyword(text, { cfg: baiduCfg() });
    return { ok: true, keywords: words };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
});

// Electron 初始化完成后创建窗口
app.whenReady().then(() => {
  // 设置极简菜单（修复 Windows 下 Menu.setApplicationMenu(null) 导致输入框无法输入的 bug）
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      role: 'editMenu',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    }
  ]));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用（Windows/Linux）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
