/* =====================================================================
 * harness.js — 评测公共脚手架（不修改任何产品代码 / API 配置）
 *
 *  - loadApiConfig(): 读取 electron-app/local_api_config.json 的
 *    base_url / model / api_key。** api_key 仅用于本地调用，绝不打印、不写入任何输出文件。**
 *  - callModel(): 复刻 index.html + main.js 的真实调用方式，
 *    向 http://localhost:8787/v1/chat/completions 发 OpenAI 兼容请求。
 *  - requireJobMatching(): 直接复用产品的确定性引擎 job-matching.js。
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '..', 'electron-app');
const CFG_PATH = path.join(APP_DIR, 'local_api_config.json');

function loadApiConfig() {
  const raw = fs.readFileSync(CFG_PATH, 'utf8');
  const cfg = JSON.parse(raw);
  return {
    apiKey: cfg.api_key || cfg.apiKey || '',
    baseUrl: cfg.base_url || cfg.baseUrl || 'http://localhost:8787/v1',
    model: cfg.model || 'cline-free/mimo-v2.6-flash'
  };
}

// 评测元数据（不含任何密钥）
function configMeta() {
  const c = loadApiConfig();
  return { baseUrl: c.baseUrl, model: c.model, hasKey: !!c.apiKey };
}

async function callModel(opts) {
  const c = loadApiConfig();
  const url = String(c.baseUrl).replace(/\/+$/, '') + '/chat/completions';
  // 支持直接传入多轮 messages（用于多轮对话状态保留测试）；
  // 否则由 system/user 构造单轮
  const messages = Array.isArray(opts.messages) && opts.messages.length
    ? opts.messages.slice()
    : (function(){ const m = []; if (opts.system) m.push({ role: 'system', content: opts.system }); if (opts.user) m.push({ role: 'user', content: opts.user }); return m; })();
  const body = {
    model: opts.model || c.model,
    messages: messages,
    temperature: (typeof opts.temperature === 'number') ? opts.temperature : 0.7,
    max_tokens: opts.maxTokens || 1024
  };
  const maxRetries = opts.maxRetries != null ? opts.maxRetries : 4;
  let attempt = 0;
  const t0 = Date.now();
  while (true) {
    attempt++;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || 90000);
      let resp;
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.apiKey },
          body: JSON.stringify(body),
          signal: ctrl.signal
        });
      } finally {
        clearTimeout(timer);
      }
      const latency = Date.now() - t0;
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        if ((resp.status === 429 || resp.status === 502) && attempt <= maxRetries) {
          const wait = Math.min(8000, 500 * attempt * attempt);
          await new Promise(r => setTimeout(r, wait));
          continue; // 重试
        }
        return { ok: false, error: 'HTTP ' + resp.status + ' ' + errText.slice(0, 200), httpStatus: resp.status, latencyMs: latency };
      }
      const data = await resp.json();
      const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
      if (!text) return { ok: false, error: '空响应', httpStatus: 200, latencyMs: latency };
      return { ok: true, text: text, httpStatus: 200, latencyMs: latency };
    } catch (e) {
      const latency = Date.now() - t0;
      if (e && e.name === 'AbortError') {
        if (attempt <= maxRetries) { await new Promise(r => setTimeout(r, 1000)); continue; }
        return { ok: false, error: '超时', httpStatus: 0, latencyMs: latency };
      }
      if (attempt <= maxRetries) { await new Promise(r => setTimeout(r, 1000)); continue; }
      return { ok: false, error: (e && e.message) ? e.message : String(e), httpStatus: 0, latencyMs: latency };
    }
  }
}

function requireJobMatching() {
  return require(path.join(APP_DIR, 'job-matching.js'));
}

module.exports = { loadApiConfig, configMeta, callModel, requireJobMatching, APP_DIR };
