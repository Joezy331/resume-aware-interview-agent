/* =====================================================================
 * resume-extract.js 回归测试
 *  node tests/resume_extract.test.js
 *
 * 覆盖：
 *  1) normalizeResumeText 对 PDF 抽取常见瑕疵的修复（拆字空格 / 连字 / 零宽字符）
 *     以及「不得吃掉合法换行」的反向约束
 *  2) renderPdfPageLayout 的布局重建（同一行 y 聚合、行内 x 排序、多栏不串行）
 *  3) extractPdfText 对真实中文 PDF 的提取质量（对照 pdf-parse 默认渲染）
 * ===================================================================== */
const fs = require('fs');
const path = require('path');
const os = require('os');

const RE = require(path.join(__dirname, '..', 'resume-extract.js'));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '\n     → ' + extra : '')); }
}

/* ---------- 1. normalizeResumeText ---------- */
console.log('\n[1] normalizeResumeText —— 文本规范化');
{
  // 简历的每一行都是独立语义行，绝不能被合并
  const t0 = RE.normalizeResumeText('陈思远\n求职意向：机械设计工程师\n教育背景');
  ok('保留合法换行（中文行间 \n 不被吃掉）', t0.split('\n').length === 3, JSON.stringify(t0));

  // 中文之间被插入空格（PDF 按字切 item）
  const t2 = RE.normalizeResumeText('熟 练 使 用 Python 与 SQL');
  ok('中文之间多余空格被去掉', t2.indexOf('熟 练') === -1 && t2.indexOf('熟练') === 0, JSON.stringify(t2));
  ok('英文单词内部空格保留', t2.indexOf('Python') >= 0 && t2.indexOf('SQL') >= 0, JSON.stringify(t2));

  // 零宽字符 / 不换行空格 / 全角空格
  const t3 = RE.normalizeResumeText('项目经历\u200B\u00A0\u3000阿里巴巴');
  ok('零宽/不换行/全角空格清理', /\u200B|\u00A0|\u3000/.test(t3) === false, JSON.stringify(t3));

  // 连字
  const t4 = RE.normalizeResumeText('proﬁle ﬂow');
  ok('ﬁ/ﬂ 连字还原', t4 === 'profile flow', JSON.stringify(t4));

  // 空行压缩
  ok('连续空行压缩', RE.normalizeResumeText('A\n\n\n\n\nB') === 'A\n\nB');
  ok('null / undefined 安全', RE.normalizeResumeText(null) === '' && RE.normalizeResumeText(undefined) === '');
}

/* ---------- 2. renderPdfPageLayout（用假 pageData 精确验证算法） ---------- */
console.log('\n[2] renderPdfPageLayout —— 坐标重建行结构');
function runSection2() {
  function item(str, x, y, w) { return { str: str, transform: [1, 0, 0, 1, x, y], width: (w == null ? str.length * 6 : w) }; }
  const items = [
    item('张', 60, 720, 12), item('三', 72, 720, 12), item('丰', 84, 720, 12),   // y=720 一行
    item('应聘岗位：机械设计工程师', 60, 700, 156),
    item('2021.09', 480, 700, 40), item('-', 524, 700, 5), item('2025.06', 532, 700, 40), // 同行右侧日期
    item('∗', 200, 660, 6), item('†', 210, 660, 6)  // 纯符号噪声行，应被过滤
  ];
  const fakePage = { getTextContent: () => Promise.resolve({ items: items }) };
  return RE.renderPdfPageLayout(fakePage).then(function (out) {
    const lines = out.split('\n').filter(l => l.length);
    ok('重建出 2 行（噪声行被过滤）', lines.length === 2, JSON.stringify(lines));
    ok('第 1 行 = 姓名', lines[0] === '张三丰', JSON.stringify(lines[0]));
    ok('第 2 行含岗位 + 右对齐日期', lines[1].indexOf('机械设计工程师') >= 0 && lines[1].indexOf('2021.09') >= 0, JSON.stringify(lines[1]));
    ok('第 2 行日期排在岗位之后（x 升序）', lines[1].indexOf('机械设计工程师') < lines[1].indexOf('2021.09'), JSON.stringify(lines[1]));
    ok('分栏之间补了空格（不是粘连）', /工程师\s+2021\.09/.test(lines[1]), JSON.stringify(lines[1]));

    // 词内切分（同一词被字体切成两段，间隙≈0）不应被插空格
    const p2 = { getTextContent: () => Promise.resolve({ items: [item('S', 60, 600, 7), item('olidWorks', 67, 600, 50)] }) };
    return RE.renderPdfPageLayout(p2).then(function (o2) {
      ok('词内切分不插空格（不是 "S olidWorks"）', o2.trim() === 'SolidWorks', JSON.stringify(o2.trim()));
    });
  });
}

/* ---------- 3. 真实中文 PDF 提取 ---------- */
function runSection3() {
  console.log('\n[3] extractPdfText —— 真实中文简历 PDF');
  const F = path.join(__dirname, 'fixtures', 'resume_mechanical.pdf');
  if (!fs.existsSync(F)) {
    ok('测试样本存在（tests/fixtures/resume_mechanical.pdf）', false,
      '缺少样本。请运行： <electron.exe> tests/gen_pdf.js 生成');
    return Promise.resolve();
  }
  let pdfParse;
  try { pdfParse = require(path.join(__dirname, '..', 'node_modules', 'pdf-parse', 'lib', 'pdf-parse.js')); }
  catch (e) { pdfParse = null; }

  const defP = pdfParse
    ? pdfParse(fs.readFileSync(F)).then(r => r.text).catch(() => '')
    : Promise.resolve('');

  return defP.then(function (defaultText) {
    return RE.extractPdfText(F).then(function (text) {
      console.log('  --- 布局提取结果 ---\n' + text.split('\n').map(l => '  | ' + l).join('\n'));
      const L = text.split('\n').length;
      ok('提取到非空文本', text && text.length > 100, 'len=' + (text || '').length);
      ok('姓名完整', text.indexOf('陈思远') >= 0);
      ok('求职意向完整', text.indexOf('机械设计工程师') >= 0);
      ok('学校与专业完整', text.indexOf('北京理工大学') >= 0 && text.indexOf('机械工程') >= 0);
      ok('右栏日期保留', text.indexOf('2017.09 - 2021.06') >= 0);
      ok('公司名称完整', text.indexOf('上汽集团') >= 0);
      ok('技能词未被字体切碎（SolidWorks）', text.indexOf('SolidWorks') >= 0 && text.indexOf('S olidWorks') === -1);
      ok('年份未被切碎（2019 而非 2 019）', text.indexOf('（2019）') >= 0, JSON.stringify(text.slice(-80)));
      ok('行结构完整（>= 18 行）', L >= 18, 'lines=' + L);
      ok('双栏技能未被串行粘连', /Rhino\s+仿真分析/.test(text), JSON.stringify(text.match(/Rhino.{0,10}/)));
      ok('主修课程段完整', text.indexOf('互换性与测量技术') >= 0);

      // 与 pdf-parse 默认渲染对照：布局提取至少不更差
      if (defaultText) {
        ok('不劣于 pdf-parse 默认渲染（信息量 >= 95%）',
          text.length >= defaultText.length * 0.95,
          'layout=' + text.length + ' default=' + defaultText.length);
      }

      // 兜底：损坏 PDF 不抛异常
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-bad-'));
      const bad = path.join(tmp, 'bad.pdf');
      fs.writeFileSync(bad, Buffer.from('not a pdf at all', 'latin1'));
      return RE.extractPdfText(bad).then(function (t2) {
        ok('损坏 PDF 不抛异常（返回字符串）', typeof t2 === 'string', JSON.stringify(t2));
      });
    });
  });
}

runSection2()
  .then(runSection3)
  .then(function () {
    console.log('\n==============================');
    console.log('  通过 ' + pass + ' / ' + (pass + fail));
    console.log('==============================\n');
    process.exit(fail ? 1 : 0);
  })
  .catch(function (e) { console.log('  ❌ 异常：' + e.stack); process.exit(1); });
