/* models-sync.js 单元测试（纯 Node，无 Electron 依赖）
 * 覆盖：/models 响应解析（OpenAI 标准格式）、排序（is_default → cline-free → 字母序）、
 * 去重、异常输入、配置合并字段保留、视觉模型派生。
 * 运行：env -u NODE_OPTIONS node tests/models_sync.test.js
 */
const { parseModelsResponse, mergeModelsIntoConfig, deriveVisionModels } = require('../models-sync.js');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

/* 1. 实测的 Cline 响应（2026-11-02 抓包，OpenAI 标准格式） */
const realResp = {
  object: 'list',
  data: [
    { id: 'reflection/beam-free', object: 'model', owned_by: 'reflection', label: 'Beam', is_default: true },
    { id: 'cline-free/nemotron-3.5-super-vl', object: 'model', owned_by: 'cline-free', label: 'cline-free/nemotron-3.5-super-vl' },
    { id: 'nvidia/nemotron-3.5-lightning-free', object: 'model', owned_by: 'nvidia', label: 'Nemotron 3.5 Lightning' },
    { id: 'cline-free/solar-mini4', object: 'model', owned_by: 'cline-free', label: 'Solar Mini 4' }
  ]
};
console.log('[1] parseModelsResponse — OpenAI 标准格式');
let ms = parseModelsResponse(realResp);
ok(Array.isArray(ms) && ms.length === 4, '解析出 4 个模型');
ok(ms[0].id === 'reflection/beam-free', 'is_default 模型排第一（' + ms[0].id + '）');
ok(ms[1].id === 'cline-free/nemotron-3.5-super-vl' && ms[2].id === 'cline-free/solar-mini4',
  'cline-free/ 前缀优先于其它 owned_by（第2/3位）');
ok(ms[3].id === 'nvidia/nemotron-3.5-lightning-free', '其余按字母序殿后');
ok(ms[0].label === 'Beam', 'label 保留（Beam）');
ok(ms[1].label === 'cline-free/nemotron-3.5-super-vl', 'label 与 id 相同时回退为 id');

console.log('[2] parseModelsResponse — 去重与兼容形状');
let dup = parseModelsResponse({ data: [{ id: 'a' }, { id: 'a' }, { id: 'b' }] });
ok(dup.length === 2, '重复 id 去重');
ok(parseModelsResponse([{ id: 'x' }, { id: 'y' }]).length === 2, '裸数组形状兼容');
ok(parseModelsResponse({ models: [{ id: 'x' }] }).length === 1, '{models:[]} 形状兼容');
ok(parseModelsResponse(null).length === 0 && parseModelsResponse({}).length === 0, '空/非法输入 → 空列表');
ok(parseModelsResponse({ data: [null, 'junk', { id: '  ' }, { id: 'ok' }] }).length === 1, '脏条目被跳过');

console.log('[3] mergeModelsIntoConfig — 字段保留');
const cfg = { api_key: 'sk-xxx', base_url: 'http://localhost:8787/v1', model: 'auto', baidu: { apiKey: 'a', secretKey: 'b' } };
const merged = mergeModelsIntoConfig(cfg, ms, '2026-11-02T06:00:00.000Z');
ok(merged.api_key === 'sk-xxx' && merged.base_url === 'http://localhost:8787/v1', 'api_key / base_url 保留');
ok(merged.baidu && merged.baidu.apiKey === 'a' && merged.baidu.secretKey === 'b', 'baidu 段完整保留');
ok(Array.isArray(merged.available_models) && merged.available_models.length === 4, 'available_models 写入 4 个 id');
ok(merged.available_models[0] === 'reflection/beam-free', 'available_models 顺序与解析排序一致');
ok(merged.models_updated_at === '2026-11-02T06:00:00.000Z', 'models_updated_at 写入');
ok(cfg.available_models === undefined, '原配置对象未被修改（纯函数）');
ok(JSON.stringify(mergeModelsIntoConfig(null, [], 't')).includes('available_models'), 'null 配置可安全合并');

console.log('[4] deriveVisionModels — 视觉模型派生');
let vis = deriveVisionModels(ms);
ok(vis && vis.length === 1 && vis[0] === 'cline-free/nemotron-3.5-super-vl', '识别 -vl 后缀为视觉模型');
ok(deriveVisionModels([{ id: 'a/plain' }, { id: 'b/text' }]) === null, '无视觉模型 → null（保留现有兜底）');
ok(deriveVisionModels([{ id: 'x/vision-mini' }])[0] === 'x/vision-mini', 'vision 字样可识别');

console.log('[5] 排序稳定性 — 全部同 owned_by 时按字母序');
let flat = parseModelsResponse({ data: [{ id: 'c' }, { id: 'a' }, { id: 'b' }] });
ok(flat.map(m => m.id).join(',') === 'a,b,c', '同前缀按字母序');

console.log('\n' + (fail === 0 ? 'ALL PASSED' : 'FAILED') + '  pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
