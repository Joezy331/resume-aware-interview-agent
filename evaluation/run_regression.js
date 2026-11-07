/* =====================================================================
 * run_regression.js — Test 4 子模块：核心回归测试通过率
 *
 *  运行产品自带回归套件（与在 electron-app/ 下手动运行等价）：
 *   - job_matching.test.js（纯 Node，确定性评分）
 *   - round4_check / flow_check / jd_analyze_check / step4_type_check
 *     / radar_reload_check / dom_smoke（Electron，headless 已禁 GPU）
 *
 *  使用 execSync + shell，复刻文档命令：
 *    env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE <electron> tests/X.js
 *  解析各测试打印的 PASSED/FAILED/FAILCOUNT，汇总通过率。
 *  所有数字来自真实运行，不预设。
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APP_DIR = path.join(__dirname, '..', 'electron-app');
const OUT = path.join(__dirname, 'out', 'regression.json');
const ELECTRON = path.join(APP_DIR, 'node_modules', 'electron', 'dist', 'electron.exe');

function runOne(name, file, pureNode){
  const cmd = pureNode
    ? `node tests/${file}`
    : `env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE "${ELECTRON}" tests/${file}`;
  let out = '', code = null;
  try {
    out = execSync('bash', ['-c', cmd], { cwd: APP_DIR, encoding: 'utf8', timeout: 180000, maxBuffer: 30 * 1024 * 1024 });
    code = 0;
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
    code = (typeof e.status === 'number') ? e.status : (e.signal ? -1 : null);
  }
  const text = out;
  let passed = 0, failed = 0, detail = '';
  const p = text.match(/PASSED=(\d+)\s+FAILED=(\d+)/);
  const fc = text.match(/FAILCOUNT=(\d+)/);
  if (p){ passed = +p[1]; failed = +p[2]; }
  else if (fc){ failed = +fc[1]; passed = 0; }
  else if (/（无 console error/.test(text) && !/❌/.test(text)){ passed = 1; failed = 0; } // dom_smoke 无显式 PASSED
  // 记录首个失败项（若有）用于透明说明
  const failLine = text.split('\n').find(l => /❌/.test(l));
  if (failLine) detail = failLine.trim().slice(0, 120);
  return { name, file, pureNode, status: code, passed, failed, pass: failed === 0 && passed > 0, detail };
}

const suite = [
  { name: 'job_matching', file: 'job_matching.test.js', pureNode: true },
  { name: 'round4_check', file: 'round4_check.js', pureNode: false },
  { name: 'flow_check', file: 'flow_check.js', pureNode: false },
  { name: 'jd_analyze_check', file: 'jd_analyze_check.js', pureNode: false },
  { name: 'step4_type_check', file: 'step4_type_check.js', pureNode: false },
  { name: 'radar_reload_check', file: 'radar_reload_check.js', pureNode: false },
  { name: 'dom_smoke', file: 'dom_smoke.js', pureNode: false }
];

function run(){
  const results = suite.map(t => runOne(t.name, t.file, t.pureNode));
  const totalPassed = results.reduce((a, r) => a + r.passed, 0);
  const totalFailed = results.reduce((a, r) => a + r.failed, 0);
  const suitesPassed = results.filter(r => r.pass).length;
  const out = {
    test: 'Test4-regression-suite',
    electron_path: ELECTRON,
    note: 'round4_check 等 Electron 测试可能因 DOM 时序出现偶发失败，以真实运行输出为准',
    results,
    summary: {
      suites_total: results.length,
      suites_passed: suitesPassed,
      suites_pass_rate: +(suitesPassed / results.length).toFixed(4),
      total_assertions_passed: totalPassed,
      total_assertions_failed: totalFailed,
      overall_pass: totalFailed === 0
    }
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log('=== 回归套件完成 ===');
  results.forEach(r => console.log(`  ${r.pass ? '✔' : '✘'} ${r.name}: PASSED=${r.passed} FAILED=${r.failed} (exit ${r.status}) ${r.detail ? '| ' + r.detail : ''}`));
  console.log(`套件通过率: ${out.summary.suites_pass_rate} | 断言通过 ${totalPassed} / 失败 ${totalFailed}`);
  console.log('已写入', OUT);
}

run();
