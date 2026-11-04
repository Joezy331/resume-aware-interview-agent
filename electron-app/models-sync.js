/* Cline /v1/models 响应解析 + 本地配置合并（纯函数，可脱离 Electron 单测）
 * Cline 本地模型池会不定时更新可用模型，应用侧所有模型来源都必须以此为准。
 */
const fs = require('fs');

/* 解析 /models 响应 → [{id,label,isDefault}]
 * 兼容三种形状：OpenAI 标准 {data:[{id,...}]}、{models:[...]}、裸数组 [...]
 * 排序规则：is_default 优先 → cline-free/ 前缀优先 → 字母序，
 * 保证列表第一个就是「最合适」的兜底模型（智能切换降级用 AVAILABLE_MODELS[0]）。 */
function parseModelsResponse(data) {
  var list = [];
  if (Array.isArray(data)) list = data;
  else if (data && Array.isArray(data.data)) list = data.data;
  else if (data && Array.isArray(data.models)) list = data.models;
  var seen = {}, out = [];
  list.forEach(function (m) {
    if (!m || typeof m !== 'object') return;
    var id = String(m.id || m.model || m.name || '').trim();
    if (!id || seen[id]) return;
    seen[id] = true;
    var label = String(m.label || m.owned_by || '').trim();
    out.push({ id: id, label: label && label !== id ? label : id, isDefault: m.is_default === true });
  });
  out.sort(function (a, b) {
    function rank(x) { return (x.isDefault ? 0 : 1) * 2 + (x.id.indexOf('cline-free/') === 0 ? 0 : 1); }
    var ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return out;
}

/* 把最新模型列表合并进本地配置对象（保留 api_key/base_url/model/baidu 等全部既有字段） */
function mergeModelsIntoConfig(cfg, models, updatedAt) {
  var obj = Object.assign({}, cfg || {});
  obj.available_models = (models || []).map(function (m) { return m.id; });
  obj.models_updated_at = updatedAt;
  return obj;
}

/* 从模型列表派生多模态（图片简历 OCR）候选：id 带 vl/vision/vlm 字样者优先；
 * 一个都筛不出来时返回 null（调用方保留现有 VISION_MODELS 兜底）。 */
function deriveVisionModels(models) {
  var ids = (models || []).map(function (m) { return (m && m.id) || m; }).filter(Boolean);
  var vis = ids.filter(function (id) { return /(^|\/)[^\/]*(vl|vision|vlm)[^\/]*$/i.test(id); });
  return vis.length ? vis : null;
}

/* 创建模型同步服务（get-local-config / list-models 的共享实现）。
 * main.js 与测试脚本各自传入 loadConfig / configPath 后注册到 ipcMain，
 * 保证「真实应用」与「E2E 测试」走完全相同的逻辑与持久化路径。 */
function createModelService(deps) {
  const loadConfig = deps.loadConfig || function () { return {}; };
  const configPath = deps.configPath || function () { return ''; };
  const timeoutMs = deps.timeoutMs || 15000;

  function cachedResult(cfg, err) {
    const cached = Array.isArray(cfg.available_models) ? cfg.available_models : [];
    if (cached.length) {
      return {
        ok: true,
        models: cached.map(function (id) { return { id: id, label: id, isDefault: false }; }),
        updatedAt: cfg.models_updated_at || '',
        source: 'cache',
        error: err
      };
    }
    return { ok: false, error: err };
  }

  function getLocalConfig() {
    let cfg = {};
    try { cfg = loadConfig() || {}; } catch (e) {}
    return Promise.resolve({
      ok: true,
      model: cfg.model || '',
      baseUrl: cfg.base_url || cfg.baseUrl || '',
      hasKey: !!(cfg.api_key || cfg.apiKey),
      availableModels: Array.isArray(cfg.available_models) ? cfg.available_models : [],
      modelsUpdatedAt: cfg.models_updated_at || ''
    });
  }

  function listModels(payload) {
    const p = payload || {};
    let cfg = {};
    try { cfg = loadConfig() || {}; } catch (e) {}
    const apiKey = (p.apiKey && String(p.apiKey).trim()) ? p.apiKey : (cfg.api_key || cfg.apiKey || '');
    const baseUrl = (p.baseUrl && String(p.baseUrl).trim()) ? p.baseUrl : (cfg.base_url || cfg.baseUrl || 'http://localhost:8787/v1');
    const cleanBase = String(baseUrl).replace(/\/+$/, '');

    if (typeof fetch !== 'function') {
      return Promise.resolve(cachedResult(cfg, '当前运行环境无 fetch（需 Electron 28+ / Node 18+）'));
    }
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;

    return fetch(cleanBase + '/models', { method: 'GET', headers: headers, signal: controller.signal })
      .then(async function (resp) {
        clearTimeout(timer);
        if (!resp || !resp.ok) {
          const errText = resp ? await resp.text() : '无响应';
          return cachedResult(cfg, '服务返回 ' + (resp ? resp.status : '?') + '：' + (errText || '').slice(0, 160));
        }
        let data;
        try { data = await resp.json(); } catch (e) {
          return cachedResult(cfg, '响应解析失败：' + ((e && e.message) || e));
        }
        const models = parseModelsResponse(data);
        if (!models.length) return cachedResult(cfg, '服务返回了空模型列表');
        const ts = new Date().toISOString();
        try {
          const fp = configPath();
          if (fp) fs.writeFileSync(fp, JSON.stringify(mergeModelsIntoConfig(cfg, models, ts), null, 2), 'utf-8');
        } catch (e) { /* 写入失败不影响本次会话（内存中已更新） */ }
        return { ok: true, models: models, updatedAt: ts, source: 'live' };
      })
      .catch(function (netErr) {
        clearTimeout(timer);
        if (netErr && netErr.name === 'AbortError') {
          return cachedResult(cfg, '请求超时（' + Math.round(timeoutMs / 1000) + '秒），请确认 Cline 本地服务已启动');
        }
        const msg = (netErr && netErr.message) ? netErr.message : String(netErr);
        return cachedResult(cfg, '无法连接 ' + cleanBase + '：' + msg);
      });
  }

  return { getLocalConfig: getLocalConfig, listModels: listModels, cachedResult: cachedResult };
}

module.exports = { parseModelsResponse: parseModelsResponse, mergeModelsIntoConfig: mergeModelsIntoConfig, deriveVisionModels: deriveVisionModels, createModelService: createModelService };
