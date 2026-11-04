/* Headless smoke test: render every route, assert no runtime error + charts present */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'file://' + dir.replace(/\\/g, '/') + '/index.html',
  pretendToBeVisual: true,
  virtualConsole: vc
});
const w = dom.window;
w.scrollTo = function () {};
w.addEventListener('error', e => errors.push('window.error: ' + e.message));

w.eval(fs.readFileSync(path.join(dir, 'data.js'), 'utf8'));
w.eval(fs.readFileSync(path.join(dir, 'app.js'), 'utf8'));
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));

const crypto = require('crypto');
/* 与 gen_screens.js 完全一致的 26 屏：用户端 17 + 管理员端 9 */
const ROUTES = [
  /* USER · 17 */
  'u/dashboard','u/upload','u/resume','u/jobs','u/jd','u/competency','u/target',
  'u/weight','u/difficulty','u/interview','u/followup','u/multiagent','u/finish',
  'u/report','u/history','u/api','u/growth',
  /* ADMIN · 9 */
  'a/dashboard','a/users','a/interviews','a/scores','a/jobs',
  'a/agents','a/agent-detail','a/logs','a/system'
];

let fail = 0;
const report = [];
const hashOf = {};
ROUTES.forEach(r => {
  const before = errors.length;
  w.location.hash = '#/' + r;
  w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  const view = w.document.getElementById('view').innerHTML;
  const topbar = w.document.getElementById('topbar').innerHTML;
  const svgs = (view.match(/<svg/g) || []).length;
  const bad = /undefined|NaN/.test(view);
  if (bad) {
    const m = view.match(/.{60}(undefined|NaN).{40}/);
    console.log('   >> ' + r + ' ctx: ' + (m ? m[0].replace(/\s+/g, ' ') : '?'));
  }
  const newErr = errors.slice(before);
  const ok = svgs > 0 && !bad && newErr.length === 0;
  if (!ok) fail++;
  /* 用「标题 + 视图正文」做指纹，检测是否所有屏抓到同一画面（旧路由 bug） */
  const fingerprint = crypto.createHash('md5').update(topbar + view).digest('hex').slice(0, 10);
  hashOf[r] = fingerprint;
  report.push(`${ok ? 'PASS' : 'FAIL'}  ${r.padEnd(16)} svg=${String(svgs).padStart(2)}  hash=${fingerprint}  ${bad ? 'HAS undefined/NaN ' : ''}${newErr.join(' | ')}`);
});

console.log(report.join('\n'));

/* 互不相同校验：26 屏指纹必须 26 个不同值 */
const uniq = new Set(Object.values(hashOf));
if (uniq.size !== ROUTES.length) {
  console.log('\n[DUP] 检测到相同画面！unique=' + uniq.size + ' / routes=' + ROUTES.length);
  const byHash = {};
  Object.keys(hashOf).forEach(r => { (byHash[hashOf[r]] = byHash[hashOf[r]] || []).push(r); });
  Object.keys(byHash).forEach(h => { if (byHash[h].length > 1) console.log('   DUP ' + h + ' -> ' + byHash[h].join(', ')); });
  fail++;
} else {
  console.log('\n[UNIQUE] ' + uniq.size + ' / ' + ROUTES.length + ' 屏画面互不相同 ✓');
}

/* interaction smoke: upload ring + weight switch + interview submit */
try {
  w.location.hash = '#/u/upload'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  w.uploadResume();
  w.location.hash = '#/u/weight'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  const tab = Array.from(w.document.querySelectorAll('#wtabs button'))[2];
  tab.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  w.location.hash = '#/u/interview'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  w.document.getElementById('ans').value = '测试回答';
  w.submitAns();
  console.log('interaction: OK');
} catch (e) {
  console.log('interaction: FAIL -> ' + e.message);
  fail++;
}

console.log('\nroutes=' + ROUTES.length + '  fail=' + fail + '  errors=' + errors.length);
if (errors.length) console.log(errors.join('\n'));
process.exit(fail || errors.length ? 1 : 0);
