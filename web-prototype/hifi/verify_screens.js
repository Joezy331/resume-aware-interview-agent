/* 真正在 jsdom 里渲染每个 screen，提取 #view 的首个 h2 + 首张图表类型，判断是否彼此不同 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dir = __dirname;
const screens = fs.readdirSync(path.join(dir, 'screens'))
  .filter(f => f.endsWith('.html'))
  .sort();

(async () => {
  const report = [];
  for (const f of screens) {
    const html = fs.readFileSync(path.join(dir, 'screens', f), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true });
    // 等待脚本执行 + DOMContentLoaded + 可能的 hashchange
    await new Promise(r => setTimeout(r, 400));
    const doc = dom.window.document;
    const view = doc.getElementById('view');
    const h2 = view ? (view.querySelector('h2') ? view.querySelector('h2').textContent : '(no h2)') : '(no view)';
    const svgCount = view ? view.querySelectorAll('svg').length : 0;
    const title = doc.querySelector('.topbar h1') ? doc.querySelector('.topbar h1').textContent : '(no title)';
    report.push({ file: f, title, h2, svg: svgCount });
  }
  console.log('总计', report.length, '个 screen：');
  const seen = {};
  let dup = 0;
  for (const r of report) {
    const key = r.title + '|' + r.h2;
    if (seen[key]) { dup++; console.log('  ⚠ 重复:', r.file, '<= 与', seen[key], '相同  [' + key + ']'); }
    else { seen[key] = r.file; console.log('  ✓', r.file.padEnd(22), 'title=', r.title, '| h2=', r.h2, '| svg=', r.svg); }
  }
  console.log(dup ? ('发现 ' + dup + ' 个重复 screen（渲染结果相同）') : '全部 screen 渲染结果互不相同 ✅');
})();
