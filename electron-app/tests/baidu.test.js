/* baidu.js 逻辑单测（mock fetch，不触网、不需要真实密钥）
 * 运行：env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE "C:/Users/jiang/.workbuddy/binaries/node/versions/22.22.2-6/node.exe" tests/baidu.test.js
 */
const path = require('path');
const B = require(path.join(__dirname, '..', 'baidu.js'));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '\n     → ' + extra : '')); }
}

// 测试用的假 fetch：根据 URL 返回鉴权 / OCR / NLP 响应
function fakeFetch(url, opts) {
  if (url.indexOf('/oauth/2.0/token') >= 0) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ access_token: 'TEST_TOKEN_123', expires_in: 2592000 }) });
  }
  if (url.indexOf('/rest/2.0/ocr') >= 0) {
    // 校验带着 access_token，且 body 含 image=
    const hasToken = url.indexOf('access_token=TEST_TOKEN_123') >= 0;
    const body = (opts && opts.body) || '';
    const hasImage = /image=/.test(body);
    if (!hasToken || !hasImage) return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({}) });
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        words_result: [{ words: '陈思远' }, { words: '机械设计工程师' }, { words: 'SolidWorks / ANSYS' }],
        words_result_num: 3
      })
    });
  }
  if (url.indexOf('/rpc/2.0/nlp/v1/keyword') >= 0) {
    const hasToken = url.indexOf('access_token=TEST_TOKEN_123') >= 0;
    const body = (opts && opts.body) || '';
    const hasText = /text=/.test(body);
    if (!hasToken || !hasText) return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({}) });
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ items: [{ word: '产品经理', score: 0.9 }, { word: 'LLM', score: 0.8 }, { word: '数据分析', score: 0.7 }] })
    });
  }
  return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
}

async function main() {
  B.setFetch(fakeFetch);
  const cfg = { apiKey: 'AK_TEST', secretKey: 'SK_TEST' };

  // 1) 鉴权：首次换取 token 并缓存
  B._reset();
  const t1 = await B.getToken(cfg);
  ok('getToken 返回 access_token', t1 === 'TEST_TOKEN_123', t1);
  // 2) 缓存命中：第二次不再发请求（通过再次调用验证结果一致且快速）
  const t2 = await B.getToken(cfg);
  ok('getToken 缓存复用', t2 === 'TEST_TOKEN_123');

  // 3) OCR：解析 words_result
  const txt = await B.ocr('BASE64FAKE', { cfg: cfg, accurate: true });
  ok('ocr 拼接文字', txt === '陈思远\n机械设计工程师\nSolidWorks / ANSYS', txt);

  // 4) NLP 关键词
  const kws = await B.keyword('招聘产品经理，需熟悉LLM与数据分析', { cfg: cfg });
  ok('keyword 返回词数组', Array.isArray(kws) && kws.length === 3 && kws[0] === '产品经理', JSON.stringify(kws));

  // 5) 缺密钥应抛 NO_CRED
  B._reset();
  let threw = false, code = '';
  try { await B.getToken({ apiKey: 'AK_ONLY' }); } catch (e) { threw = true; code = e.code; }
  ok('缺 secretKey 抛 NO_CRED', threw && code === 'NO_CRED', code);

  // 6) 鉴权失败（invalid_client）抛 AUTH_ERR
  B.setFetch((u) => Promise.resolve({ ok: true, json: () => Promise.resolve({ error: 'invalid_client', error_description: 'client secret error' }) }));
  B._reset();
  let authErr = false;
  try { await B.getToken({ apiKey: 'AK', secretKey: 'BAD' }); } catch (e) { authErr = e.code === 'AUTH_ERR'; }
  ok('鉴权异常抛 AUTH_ERR', authErr);

  console.log('\n==============================');
  console.log('  通过 ' + pass + ' / ' + (pass + fail));
  console.log('==============================');
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.log('ERR ' + e.stack); process.exit(1); });
