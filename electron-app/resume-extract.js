/* =====================================================================
 * resume-extract.js
 * 简历文件纯文本提取（PDF / DOCX / TXT）
 *
 * 独立成模块的原因：main.js 依赖 electron，无法脱离 Electron 单独跑测试；
 * 这里没有任何 Electron 依赖，可以直接在 Node 里对提取质量做回归测试。
 * ===================================================================== */
const fs = require('fs');
const path = require('path');
const os = require('os');

/* ===== 文本规范化：修复 PDF/DOCX 抽取常见瑕疵 =====
 *  - 控制字符 / 零宽字符 / 不换行空格 / 全角空格
 *  - 连字 ﬁ ﬂ
 *  - 中文之间的多余空格（PDF 常把整句按字拆成多个 text item）
 *  - 中文被无故换行
 */
function normalizeResumeText(s) {
  return String(s || '')
    .replace(/\u0000/g, '')
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')               // 零宽 / 方向控制
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')   // 控制字符
    .replace(/[\u00A0\u3000]/g, ' ')                                   // 不换行空格 / 全角空格
    .replace(/\uFB01/g, 'fi').replace(/\uFB02/g, 'fl')                 // 连字 ﬁ ﬂ
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/([\u4e00-\u9fa5])[ \t]+(?=[\u4e00-\u9fa5])/g, '$1')      // 中文之间的多余空格
    /* 注意：不要再做「中文之间的换行合并」。简历每一行都是独立语义行
     * （姓名 / 学校 / 岗位职责 / 技能），一旦把 \n 吃掉，
     * 后续的分段（splitSections）与证据抽取会全线错乱。 */
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ===== 布局感知的 PDF 单页渲染：按 Y 分行、按 X 排序，保留原始排版结构 =====
 * pdf-parse 默认渲染把整页拼成一段、丢失换行，多栏/表格式简历会串行错乱。
 * 这里基于 textContent 的 transform 坐标重建行结构。 */
function renderPdfPageLayout(pageData) {
  /* 与 pdf-parse 默认渲染保持一致的文本项合并策略（normalizeWhitespace + combineTextItems），
   * 只改变「换行判定」与「行内排序」两件事：
   *   1) 默认渲染用 y 严格相等判行，亚像素抖动会把一行劈成多行；这里用 3pt 容差聚合成行。
   *   2) 默认渲染按内容流顺序拼接，多栏/右对齐日期会串行；这里按 x 升序重排。
   * 注意不能用 disableCombineTextItems + normalizeWhitespace:false，
   * 那会把 SolidWorks 按字体切成 "S"+"olidWorks"，再补空格就变成 "S olidWorks"。 */
  return pageData.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false })
    .then(function (tc) {
      var items = (tc && tc.items) || [];
      var buckets = [];
      items.forEach(function (it) {
        var str = it && it.str != null ? String(it.str) : '';
        if (!str) return;
        var tr = it.transform || [1, 0, 0, 1, 0, 0];
        var x = tr[4] || 0, y = tr[5] || 0;
        var w = (typeof it.width === 'number') ? it.width : 0;
        var row = null;
        for (var i = 0; i < buckets.length; i++) {
          if (Math.abs(buckets[i].y - y) <= 3) { row = buckets[i]; break; }  // 同行容差 3pt
        }
        if (!row) { row = { y: y, items: [] }; buckets.push(row); }
        row.items.push({ x: x, w: w, str: str });
      });
      buckets.sort(function (a, b) { return b.y - a.y; });      // 自上而下
      return buckets.map(function (row) {
        row.items.sort(function (a, b) { return a.x - b.x; });  // 自左而右
        var line = '', prevRight = null;
        row.items.forEach(function (it) {
          var t = it.str;
          if (line) {
            // 只在「存在明显水平间隙」时补空格：词内切分间隙≈0，分栏/分词的间隙>0
            var gap = (prevRight == null) ? 0 : (it.x - prevRight);
            var needSpace = gap > 1 && !/[\s]$/.test(line) && !/^[\s]/.test(t);
            if (needSpace) line += ' ';
          }
          line += t;
          prevRight = it.x + it.w;
        });
        return line.replace(/\s+/g, ' ').trim();
      }).filter(isMeaningfulLine).join('\n') + '\n';
    });
}

/* 过滤掉纯符号噪声行（脚注标记 ∗ † ‡、孤立标点等），
 * 这类行在简历里无意义，却会污染后续的分段与证据抽取。 */
function isMeaningfulLine(l) {
  if (!l || !l.trim()) return false;
  var cjk = (l.match(/[\u4e00-\u9fa5]/g) || []).length;
  var alnum = (l.match(/[A-Za-z0-9]/g) || []).length;
  if (cjk >= 1) return true;
  if (alnum >= 2) return true;
  return false;
}

/* ===== PDF ===== */
async function extractPdfText(filePath) {
  const pdfParse = require('pdf-parse/lib/pdf-parse.js');
  const dataBuffer = fs.readFileSync(filePath);

  // 1) 布局感知提取（保留行结构）
  try {
    const res = await pdfParse(dataBuffer, { pagerender: renderPdfPageLayout, max: 0 });
    const t = normalizeResumeText(res && res.text);
    if (t.length > 30) return t;
  } catch (e) { /* 继续回退 */ }

  // 2) pdf-parse 默认渲染
  try {
    const res2 = await pdfParse(dataBuffer);
    const t2 = normalizeResumeText(res2 && res2.text);
    if (t2.length > 30) return t2;
  } catch (e) { /* 继续回退 */ }

  // 3) 兜底：直接从内容流提取括号字符串（对多数文本型 PDF 有效）
  const buf = fs.readFileSync(filePath, 'latin1');
  let out = '';
  (buf.match(/BT[\s\S]*?ET/g) || []).forEach(function (c) {
    const m = c.match(/\((?:[^()\\]|\\.)*\)/g);
    if (m) m.forEach(function (s) { out += s.slice(1, -1).replace(/\\(.)/g, '$1') + ' '; });
  });
  if (out.trim().length < 20) {
    const all = buf.match(/\((?:[^()\\]|\\.)*\)/g) || [];
    out = all.map(function (s) { return s.slice(1, -1).replace(/\\(.)/g, '$1'); }).join(' ');
  }
  return normalizeResumeText(out);
}

/* ===== DOCX ===== */
async function extractDocxText(filePath) {
  // 优先用 mammoth
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    if (result && result.value && result.value.trim().length > 20) {
      return normalizeResumeText(result.value);
    }
  } catch (e) { /* 回退到手动解析 */ }
  // 兜底：DOCX 本质是 ZIP，解压后读取 word/document.xml
  // 注意：extract-zip 只是传递依赖，打包后可能不存在，故整段兜底都要可失败
  let extractZip = null;
  try { extractZip = require('extract-zip'); } catch (e) { extractZip = null; }
  if (!extractZip) {
    throw new Error('DOCX 解析组件不可用，请将简历另存为 .pdf 或 .txt 后重试。');
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-'));
  await extractZip(filePath, { dir: tmpDir });
  const xml = fs.readFileSync(path.join(tmpDir, 'word', 'document.xml'), 'utf-8');
  // 先按段落切分，再取段落内文本，保留换行结构
  const paras = xml.split(/<\/w:p>/g).map(function (p) {
    const t = [];
    const r2 = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let mm;
    while ((mm = r2.exec(p)) !== null) t.push(mm[1]);
    return t.join('');
  }).filter(function (s) { return s.trim().length > 0; });
  let out = paras.join('\n');
  if (out.trim().length < 20) {
    const texts = [];
    const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let m;
    while ((m = re.exec(xml)) !== null) texts.push(m[1]);
    out = texts.join('');
  }
  return normalizeResumeText(out
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
}

/* ===== 统一入口 ===== */
async function extractResumeText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.txt') return normalizeResumeText(fs.readFileSync(filePath, 'utf-8'));
  if (ext === '.docx') return extractDocxText(filePath);
  if (ext === '.pdf') return extractPdfText(filePath);
  throw new Error('不支持的扩展名：' + ext);
}

module.exports = { normalizeResumeText, renderPdfPageLayout, extractPdfText, extractDocxText, extractResumeText };
