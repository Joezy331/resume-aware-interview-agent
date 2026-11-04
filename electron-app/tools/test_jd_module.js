/* ============================================================
 * tools/test_jd_module.js — JD 智能分析模块 E2E（Electron）
 * 验证：双入口 UI、模式一手动分析（含历史 manual 记录+原文保留）、
 * 模式二三步向导（简历确认→岗位推荐→生成与匹配，mock AI）、
 * 结果 Tab、操作按钮（查看完整JD/编辑/重新生成/保存/复制/进面试）、
 * 历史记录（industry_reference 记录+匹配分）。
 * 输出截图到 _preview/jd_e2e_*.png，结尾 E2E_OK / E2E_FAIL。
 * 运行：env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe tools/test_jd_module.js
 * ============================================================ */
'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '..', '_preview');
fs.mkdirSync(outDir, { recursive: true });
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

let pass = 0, fail = 0;
let win = null;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + ' :: ' + JSON.stringify(detail).slice(0, 300)); }
}
async function shot(name) {
  await new Promise(r => setTimeout(r, 420));   // 等 fade-in 动画结束，避免截图半透明发灰
  await win.webContents.capturePage();
  await new Promise(r => setTimeout(r, 250));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outDir, name), img.toPNG());
  console.log('SHOT_OK ' + name);
}
async function evaljs(code) { return win.webContents.executeJavaScript(code); }

/* mock AI：返回标准 JD JSON（首次）/ 匹配 JSON（第二次），供 E2E 无外部服务验证 */
const MOCK_JD = {
  job_title: 'AI 产品经理', industry: '人工智能与大模型', job_function: '产品部', job_level: '实习生',
  job_type: '实习', work_direction: 'AI 应用产品设计与迭代',
  job_summary: '协助团队挖掘大模型应用场景，参与 AI 产品从需求分析到上线的全流程，沉淀 Prompt 与评估方法论。',
  responsibilities: [
    { task: '调研大模型在知识管理场景的应用机会', action: '竞品拆解与用户访谈', outcome: '输出场景机会清单' },
    { task: '撰写 AI 功能 PRD', action: '需求分析与方案设计', outcome: 'PRD 评审通过' },
    { task: '设计 Prompt 并评估模型效果', action: '构造测试集与评分', outcome: '效果评估报告' }
  ],
  required_qualifications: ['本科在读及以上', '熟悉常见 AI 产品形态', '具备基础数据分析能力'],
  preferred_qualifications: ['有大模型应用项目经历', '会用 Figma/Axure'],
  professional_skills: [
    { category: '专业基础知识', skill: '产品管理基础', level: '必须掌握' },
    { category: '技术与工具技能', skill: 'Prompt 设计', level: '必须掌握' },
    { category: '数据分析能力', skill: 'SQL', level: '熟悉即可' }
  ],
  experience_requirements: ['实习生以课程项目、实习经历作为经验参考（行业参考）'],
  kpi_indicators: [{ name: '需求文档质量', note: '行业参考' }, { name: '功能上线及时率', note: '行业参考' }],
  work_scenarios: ['与算法团队对齐模型能力边界', '整理用户反馈并形成迭代需求'],
  career_path: ['专业路线：AI 产品经理 → 资深 AI 产品经理', '管理路线：产品负责人'],
  generation_type: 'industry_reference',
  confidence_notes: ['本 JD 为行业标准参考，非真实企业招聘信息']
};
const MOCK_MATCH = {
  overall_match: 82,
  dimensions: [
    { name: '专业技能匹配', weight: 25, score: 85, evidence: '简历含 Prompt 设计、AI 产品设计技能' },
    { name: '核心岗位职责匹配', weight: 25, score: 80, evidence: '实习经历为 AI 产品部产品实习生' },
    { name: '项目及实践经验', weight: 20, score: 78, evidence: '大模型问答机器人项目覆盖 RAG/Agent' },
    { name: '行业与业务理解', weight: 15, score: 75, evidence: '竞品调研经历' },
    { name: '学历及专业背景', weight: 10, score: 90, evidence: '本科在读' },
    { name: '通用能力', weight: 5, score: 80, evidence: '用户调研与文档撰写经历' }
  ],
  satisfied: [{ item: '熟悉常见 AI 产品形态', evidence: 'AI 产品部实习 + 大模型项目' }],
  partial: [{ item: '基础数据分析能力', evidence: 'SQL/Python 技能', gap: '缺少业务指标体系实践' }],
  missing: [{ item: 'Figma/Axure', note: '简历未体现（未体现≠不具备）' }],
  to_confirm: ['英文文献阅读能力'],
  strengths: ['AI 产品实习与项目双重背景'], gaps: ['设计工具使用'],
  resume_suggestions: ['量化项目成果（如准确率提升 x%）'],
  interview_suggestions: ['准备 1 个 Prompt 迭代案例'],
  learning_path: ['学习评估指标体系', '练习 Figma 基础']
};
let mockCalls = 0;
ipcMain.handle('ai-chat', async (event, payload) => {
  mockCalls++;
  const isMatch = (payload.messages[1] && payload.messages[1].content.indexOf('匹配分析') >= 0);
  const text = isMatch ? JSON.stringify(MOCK_MATCH) : JSON.stringify(MOCK_JD);
  return { ok: true, text, model: payload.model || 'mock' };
});
ipcMain.handle('get-local-config', async () => ({ ok: true, config: {} }));

app.whenReady().then(async () => {
  try {
    const win2 = win = new BrowserWindow({
      width: 1440, height: 900, show: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false
      }
    });
    await win.loadURL('file://' + path.join(__dirname, '..', 'index.html'));
    await new Promise(r => setTimeout(r, 1200));

    /* 1. 双入口 */
    await evaljs("showPage('jd')");
    await new Promise(r => setTimeout(r, 400));
    const entry = await evaljs(`({
      modes: document.querySelectorAll('#jdpg-entry .jdpg-mode').length,
      m1: document.querySelector('#jdpg-entry .jdpg-mode:nth-child(1) .jdpg-mode-title').textContent,
      m2: document.querySelector('#jdpg-entry .jdpg-mode:nth-child(2) .jdpg-mode-title').textContent,
      navActive: document.querySelector('.nav-link.active').getAttribute('data-page')
    })`);
    ok('双入口卡片渲染', entry.modes === 2, entry);
    ok('模式一标题 = 已有目标岗位？', entry.m1.indexOf('已有目标岗位') >= 0, entry.m1);
    ok('模式二标题 = 还不确定适合什么岗位？', entry.m2.indexOf('还不确定适合什么岗位') >= 0, entry.m2);
    ok('jd 页导航高亮', entry.navActive === 'jd', entry.navActive);
    await shot('jd_e2e_1_entry.png');

    /* 2. 模式一：手动输入（无关联简历场景先测） */
    await evaljs(`(function(){
      document.getElementById('jdpg-manual-link-resume').checked=false;
      jdpgOpenMode('manual');
      document.getElementById('jdpg-manual-input').value='岗位职责：\\n1. 负责数据看板的规划与设计，输出 PRD 并跟进落地\\n2. 与研发协作完成数据接口定义\\n任职要求：\\n1. 本科及以上学历，2 年以上数据分析经验\\n2. 精通 SQL，熟悉 Python 与 Tableau\\n3. 具备良好的沟通表达能力，有 BI 工具经验优先';
      jdpgAnalyzeManual();
      return true;
    })()`);
    await new Promise(r => setTimeout(r, 600));
    const manual = await evaljs(`({
      shown: document.getElementById('jdpg-manual-result').style.display,
      title: document.querySelector('#jdpg-manual-result .card-title').textContent,
      hasRaw: document.getElementById('jdpg-manual-result').innerHTML.indexOf('查看 JD 原文') >= 0,
      histManual: JDCore.loadJDHistory().filter(r=>r.source_type==='manual').length,
      rawKept: (JDCore.loadJDHistory().find(r=>r.source_type==='manual')||{}).raw_text ? JDCore.loadJDHistory().find(r=>r.source_type==='manual').raw_text.indexOf('数据看板')>=0 : false
    })`);
    ok('模式一解析结果展示', manual.shown === 'block' && manual.title.indexOf('JD 解析结果') >= 0, manual);
    ok('保留 JD 原文（未改写）', manual.hasRaw && manual.rawKept, manual);
    ok('历史记录保存 manual 类型', manual.histManual >= 1, manual.histManual);
    await shot('jd_e2e_2_manual.png');

    /* 3. 模式二 · 第一步：简历确认（示例简历） */
    await evaljs("jdpgOpenMode('gen')");
    await new Promise(r => setTimeout(r, 200));
    await evaljs("jdpgUseSample(); jdpgFillResumeForm();");
    const w1 = await evaljs(`({
      editShown: document.getElementById('jdpg-w1-edit').style.display,
      skills: document.getElementById('jdpg-f-skills').value.length>0,
      projects: document.getElementById('jdpg-f-projects').value.length>0
    })`);
    ok('第一步简历字段可编辑', w1.editShown === 'block' && w1.skills && w1.projects, w1);
    await evaljs("jdpgConfirmResume()");
    await new Promise(r => setTimeout(r, 300));

    /* 4. 模式二 · 第二步：岗位推荐 */
    const w2 = await evaljs(`({
      cards: document.querySelectorAll('#jdpg-rec-grid .jdpg-rec').length,
      primary: document.querySelectorAll('#jdpg-rec-grid .jdpg-badge-primary').length,
      levels: document.querySelectorAll('#jdpg-levels .jdpg-level').length,
      reasons: document.getElementById('jdpg-rec-grid').innerHTML.indexOf('推荐原因')>=0 || document.getElementById('jdpg-rec-grid').innerHTML.indexOf('吻合')>=0 || document.getElementById('jdpg-rec-grid').innerHTML.indexOf('信号')>=0
    })`);
    ok('第二步：3-5 张推荐卡片', w2.cards >= 3 && w2.cards <= 5, w2.cards);
    ok('第二步：主推荐/拓展标注', w2.primary >= 1, w2.primary);
    ok('第二步：5 个级别可选', w2.levels === 5, w2.levels);
    ok('第二步：卡片含推荐原因/优势/差距', w2.reasons, w2);
    await evaljs("jdpgSetLevel('实习生')");
    await shot('jd_e2e_3_step2.png');

    /* 5. 模式二 · 第三步：生成与匹配（mock AI） */
    await evaljs("jdpgGenerate()");
    await new Promise(r => setTimeout(r, 900));
    const w3 = await evaljs(`({
      shown: document.getElementById('jdpg-result').style.display,
      title: document.getElementById('jdpg-res-title').textContent,
      score: document.getElementById('jdpg-res-score').textContent,
      tabs: document.querySelectorAll('#jdpg-tabs .jdpg-tab').length,
      overviewHasSummary: document.getElementById('jdpg-tab-body').textContent.indexOf('岗位概述')>=0,
      refRecord: JDCore.loadJDHistory().filter(r=>r.source_type==='industry_reference').length,
      refScore: (JDCore.loadJDHistory().find(r=>r.source_type==='industry_reference')||{}).match_score
    })`);
    ok('第三步：结果渲染', w3.shown === 'block' && w3.title.indexOf('AI 产品经理') >= 0, w3);
    ok('第三步：匹配分展示', w3.score.indexOf('82') >= 0, w3.score);
    ok('第三步：8 个 Tab', w3.tabs === 8, w3.tabs);
    ok('第三步：概览含岗位概述', w3.overviewHasSummary, null);
    ok('历史记录保存 industry_reference + 匹配分', w3.refRecord >= 1 && w3.refScore === 82, w3);
    await shot('jd_e2e_4_result_overview.png');

    /* 6. Tab 切换：匹配度 / 任职资格 / 建议 */
    await evaljs(`(function(){
      document.querySelectorAll('#jdpg-tabs .jdpg-tab')[5].click();
    })()`);
    await new Promise(r => setTimeout(r, 200));
    const matchTab = await evaljs(`({
      dims: document.querySelectorAll('#jdpg-tab-body .jdpg-dim').length,
      satisfied: document.getElementById('jdpg-tab-body').textContent.indexOf('已满足的岗位要求')>=0,
      missing: document.getElementById('jdpg-tab-body').textContent.indexOf('未体现')>=0
    })`);
    ok('匹配度 Tab：六维评分条', matchTab.dims === 6, matchTab.dims);
    ok('匹配度 Tab：已满足/未体现分区', matchTab.satisfied && matchTab.missing, matchTab);
    await shot('jd_e2e_5_result_match.png');

    /* 7. 操作按钮 */
    const acts = await evaljs(`({
      full: typeof jdpgViewFull==='function',
      edit: typeof jdpgEditJob==='function',
      regen: typeof jdpgGenerate==='function',
      save: typeof jdpgSave==='function',
      copy: typeof jdpgCopy==='function',
      interview: typeof jdpgGoInterview==='function',
      modalFn: typeof showModal==='function'
    })`);
    ok('操作按钮齐全（完整JD/编辑/重生成/保存/复制/进面试）', acts.full&&acts.edit&&acts.regen&&acts.save&&acts.copy&&acts.interview, acts);
    /* 编辑岗位 → 回到第二步再生成（重新生成链路） */
    await evaljs("jdpgEditJob()");
    await new Promise(r => setTimeout(r, 200));
    const backToStep2 = await evaljs("document.getElementById('jdpg-w2').style.display");
    ok('编辑目标岗位 → 回第二步', backToStep2 === 'block', backToStep2);
    await evaljs("jdpgGenerate()");
    await new Promise(r => setTimeout(r, 900));
    const regen = await evaljs("JDCore.loadJDHistory().filter(r=>r.source_type==='industry_reference').length");
    ok('重新生成再次入库', regen >= 2, regen);

    /* 8. 历史记录区渲染 + 查看/删除 */
    const hist = await evaljs(`({
      rows: document.querySelectorAll('#jdpg-history-list > div').length,
      badges: document.getElementById('jdpg-history-list').textContent.indexOf('手动输入')>=0 && document.getElementById('jdpg-history-list').textContent.indexOf('行业标准')>=0
    })`);
    ok('历史记录区分两类来源展示', hist.rows >= 3 && hist.badges, hist);
    await shot('jd_e2e_6_history.png');

    /* 9. 旧模块不受影响 */
    const old = await evaljs(`({
      resumePage: !!document.getElementById('page-resume'),
      jdPaste: typeof parseJDPaste==='function',
      interview: typeof startInterview==='function',
      history: typeof loadHistory==='function',
      jobMatch: typeof JobMatching!=='undefined'
    })`);
    ok('旧模块不受影响（简历页/JD粘贴/面试/历史/匹配引擎）', old.resumePage&&old.jdPaste&&old.interview&&old.history&&old.jobMatch, old);

    console.log('---');
    console.log('E2E_OK PASS=' + pass + ' FAIL=' + fail);
    app.quit();
  } catch (e) {
    console.log('E2E_FAIL ' + ((e && e.stack) || e));
    app.quit();
  }
});
