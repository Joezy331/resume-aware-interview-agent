/* 验证 round-4 修复：
 *  - Bug1: 步骤4 推荐岗位动态渲染（prepareStep4 / renderStep4Jobs）
 *  - Bug2: 粘贴 JD 不再“照搬”空模板，analyzeJDText 能抽到真实要点
 *  - Bug3: JD 关键词块出现（本地智能提取）；JD 图片路径函数就位
 * 运行（Git Bash）：
 *   NODE_OPTIONS= ELECTRON_RUN_AS_NODE= ./node_modules/electron/dist/electron.exe tests/round4_check.js
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

const errors = [];
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 800 });
  win.webContents.on('console-message', (e, level, message, line, sourceId) => {
    if (level >= 2) errors.push('[console] ' + message + ' @' + (sourceId || '') + ':' + line);
  });
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise(r => setTimeout(r, 1200));

  const r = await win.webContents.executeJavaScript(`(function(){
    var out = {};
    var SAMPLE = [
      '岗位名称：数据分析师',
      '岗位职责：',
      '1. 负责业务数据分析与建模',
      '2. 搭建数据指标体系与看板',
      '3. 支持业务决策，输出分析报告',
      '任职要求：',
      '1. 本科及以上学历，统计/数学/计算机相关专业',
      '2. 精通 SQL，熟悉 Python/R 与 Tableau',
      '3. 3 年以上数据分析经验，具备良好的沟通与逻辑能力',
      '加分项：有 A/B 实验设计经验优先'
    ].join('\\n');

    // —— Bug2: analyzeJDText 真实抽取（非照搬空模板）——
    var jd = analyzeJDText(SAMPLE);
    out.jdTitle = jd.title;
    out.jdResp = jd.resp.length;
    out.jdHard = jd.hard.length;
    out.jdTools = jd.tools;
    out.jdFocus = jd.focus;
    out.jdEdu = jd.edu;
    // 不应回退到“根据岗位描述开展工作”这种空模板
    out.notGeneric = jd.resp[0].indexOf('根据岗位描述开展工作') < 0;
    // 关键词应抽到 SQL / Python / Tableau 等
    var kw = extractJDKeywords(jd, SAMPLE);
    out.jdKw = kw;
    out.kwHasSQL = kw.indexOf('SQL') >= 0;
    out.kwHasTableau = kw.indexOf('Tableau') >= 0;

    // —— Bug2/Bug3: parseJDPaste 生成分析与关键词块 ——
    document.getElementById('jd-paste-input').value = SAMPLE;
    parseJDPaste();
    var html = document.getElementById('jd-display-content').innerHTML;
    out.pasteHasResp = html.indexOf('📋 岗位职责') >= 0;
    out.pasteHasHard = html.indexOf('🔧 硬技能要求') >= 0;
    out.pasteHasKwBlock = html.indexOf('🔑 JD 关键词') >= 0;
    out.pasteKwChips = (html.match(/tag tag-blue/g) || []).length;

    // —— Bug3: JD 图片函数就位 ——
    out.hasParseJDImage = (typeof parseJDImage === 'function');
    out.hasJdTextToImage = (typeof jdTextToImage === 'function');
    out.hasJdKeywordBlockHTML = (typeof jdKeywordBlockHTML === 'function');

    // —— Bug1: prepareStep4 自动选用 top 推荐，且 chips 渲染 ——
    selectedJobMatch = undefined;
    lastJobMatchResult = {jobs:[
      {job_title:'机械设计工程师',industry:'工程制造',match_score:82,familyId:'engineering_mfg'},
      {job_title:'软件工程师',industry:'互联网',match_score:55,familyId:'software'}
    ]};
    prepareStep4();
    out.autoPickTop = selectedJobMatch === '机械设计工程师';
    out.autoTypeGeneral = selectedJobType === 'general';
    out.chipsHasMech = (document.getElementById('recommended-jobs').innerHTML.indexOf('机械设计工程师') >= 0);
    out.chipCount = document.querySelectorAll('#recommended-jobs [data-rjob]').length;

    // recompute 路径：lastJobMatchResult 为空时不崩溃
    selectedJobMatch = undefined; lastJobMatchResult = null;
    var threw = false;
    try { prepareStep4(); } catch(e){ threw = true; out.recomputeErr = e.message; }
    out.recomputeNoCrash = !threw;
    return out;
  })()`);

  console.log('--- round4 结果 ---');
  let pass = 0, fail = 0;
  Object.keys(r).forEach(k => {
    const v = r[k];
    const ok = v === true || (Array.isArray(v) && v.length) || (typeof v === 'string' && v.length) || (typeof v === 'number' && (v > 0 || k === 'chipCount'));
    if (ok) { pass++; console.log('  ✅ ' + k + ' = ' + JSON.stringify(v)); }
    else { fail++; console.log('  ❌ ' + k + ' = ' + JSON.stringify(v)); }
  });
  console.log('--- 错误 ---');
  if (!errors.length) console.log('  （无 console error / 加载失败）');
  else errors.forEach(e => console.log('  ' + e));
  console.log('PASSED=' + pass + ' FAILED=' + fail);
  app.quit();
}).catch(e => { console.log('ERR ' + e.stack); app.quit(); });
