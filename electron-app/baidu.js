/* =====================================================================
 * baidu.js — 百度智能云 OCR / NLP 封装（纯 Node 模块，无 Electron 依赖）
 *
 * 职责：
 *   - getToken(cfg)   用 API Key + Secret Key 换取 access_token（带缓存）
 *   - ocr(b64, opts)  图片 base64 → 识别文字（general_basic / accurate_basic）
 *   - keyword(text)   JD 文本 → 关键词数组（自然语言处理 关键词提取）
 *
 * 安全：密钥绝不硬编码，仅由调用方（main.js）从 local_api_config.json 注入。
 * 本模块不读取任何文件、不持有任何密钥。
 * ===================================================================== */
const OAUTH_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const OCR_GENERAL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic';
const OCR_ACCURATE = 'https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic';
const NLP_KEYWORD = 'https://aip.baidubce.com/rpc/2.0/nlp/v1/keyword';

let _token = null;
let _expireAt = 0;
let _fetch = (typeof fetch !== 'undefined') ? fetch : null; // 可注入，便于单测

function setFetch(fn) { _fetch = fn; }
function _reset() { _token = null; _expireAt = 0; }

function _now() { return Date.now(); }

async function getToken(cfg) {
  const ak = cfg && (cfg.apiKey || cfg.api_key);
  const sk = cfg && (cfg.secretKey || cfg.secret_key);
  if (!ak || !sk) {
    const e = new Error('百度密钥未配置：local_api_config.json 的 baidu 段需要 apiKey 与 secretKey');
    e.code = 'NO_CRED';
    throw e;
  }
  // 提前 2 分钟刷新，避免临界过期
  if (_token && _now() < _expireAt - 120000) return _token;
  if (!_fetch) throw new Error('运行环境不支持 fetch');

  const url = OAUTH_URL + '?grant_type=client_credentials&client_id=' +
    encodeURIComponent(ak) + '&client_secret=' + encodeURIComponent(sk);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let r;
  try {
    r = await _fetch(url, { signal: ctrl.signal });
  } finally { clearTimeout(timer); }
  if (!r || !r.ok) {
    const e = new Error('百度鉴权 HTTP ' + (r ? r.status : '?'));
    e.code = 'AUTH_HTTP';
    throw e;
  }
  const data = await r.json();
  if (!data || !data.access_token) {
    const e = new Error('百度鉴权失败：' + (data && data.error_description ? data.error_description : JSON.stringify(data)));
    e.code = 'AUTH_ERR';
    throw e;
  }
  _token = data.access_token;
  _expireAt = _now() + (parseInt(data.expires_in, 10) || 2592000) * 1000;
  return _token;
}

async function ocr(base64NoPrefix, opts) {
  const cfg = (opts && opts.cfg) || {};
  const token = await getToken(cfg);
  const endpoint = (opts && opts.accurate) ? OCR_ACCURATE : OCR_GENERAL;
  const url = endpoint + '?access_token=' + encodeURIComponent(token);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  let r;
  try {
    r = await _fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'image=' + encodeURIComponent(base64NoPrefix),
      signal: ctrl.signal
    });
  } finally { clearTimeout(timer); }
  if (!r || !r.ok) {
    const e = new Error('百度 OCR HTTP ' + (r ? r.status : '?'));
    e.code = 'OCR_HTTP';
    throw e;
  }
  const data = await r.json();
  if (data && data.error_code) {
    const e = new Error('百度 OCR 错误 ' + data.error_code + '：' + (data.error_msg || ''));
    e.code = 'OCR_ERR';
    throw e;
  }
  const list = (data && data.words_result) || [];
  return list.map(x => x.words).join('\n');
}

async function keyword(text, opts) {
  const cfg = (opts && opts.cfg) || {};
  const token = await getToken(cfg);
  const url = NLP_KEYWORD + '?access_token=' + encodeURIComponent(token);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let r;
  try {
    r = await _fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'text=' + encodeURIComponent(text),
      signal: ctrl.signal
    });
  } finally { clearTimeout(timer); }
  if (!r || !r.ok) {
    const e = new Error('百度 NLP HTTP ' + (r ? r.status : '?'));
    e.code = 'NLP_HTTP';
    throw e;
  }
  const data = await r.json();
  if (data && data.error_code) {
    const e = new Error('百度 NLP 错误 ' + data.error_code + '：' + (data.error_msg || ''));
    e.code = 'NLP_ERR';
    throw e;
  }
  const items = (data && data.items) || [];
  return items.map(x => x.word);
}

module.exports = { getToken, ocr, keyword, setFetch, _reset,
  _endpoints: { OAUTH_URL, OCR_GENERAL, OCR_ACCURATE, NLP_KEYWORD } };
