/* 回归：前端简历进入「第 4 步：选择目标岗位」后，评分类型必须自动匹配为 tech（软件工程师），
 * 而不是永远停在产品经理。根因是 setResumeStep 被包装函数覆盖后未转调原函数，
 * 导致 prepareStep4() 从未执行（推荐岗位区为空、类型停留在默认值）。
 * 运行：env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe tests/step4_type_check.js
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

process.on('uncaughtException', e => console.error('TEST uncaughtException:', e && e.message));
process.on('unhandledRejection', e => console.error('TEST unhandledRejection:', e && e.message));

const FE = `教育背景
本科 计算机科学与技术 某大学

工作经历
2021-2024 某互联网公司 前端开发工程师
负责 React 与 Vue 项目的前端页面开发，使用 TypeScript 编写组件
参与前端工程化建设，优化首屏加载性能，LCP 降低 40%

项目经历
电商中台前端：基于 React + TypeScript 搭建组件库，使用 Webpack 构建，覆盖 30+ 页面

专业技能
HTML CSS JavaScript TypeScript React Vue Webpack Git 性能优化 前端工程化`;

let pass = 0, fail = 0;
function check(cond, msg) {
  if (cond) { pass++; console.log('  ✅ ' + msg); }
  else { fail++; console.log('  ❌ ' + msg); }
}

async function main() {
  const win = new BrowserWindow({ show: false, width: 1400, height: 900 });
  const errs = [];
  win.webContents.on('console-message', (e, level, m) => { if (level >= 2) errs.push('[console] ' + m); });
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise(r => setTimeout(r, 900));
  await win.webContents.executeJavaScript('window.alert=function(){};window.confirm=function(){return false;};0;');

  const r = await win.webContents.executeJavaScript(`(function(){
    var fe = ${JSON.stringify(FE)};
    parsedResume = { rawText: fe };
    lastJobMatchResult = JobMatching.recommendJobs(fe, parsedResume, { topN: 5 });
    selectedJobMatch = undefined;
    setResumeStep(4);
    var chip = document.querySelector('.job-type.selected');
    var rec = document.getElementById('recommended-jobs');
    var wd = document.getElementById('weights-display');
    var top = lastJobMatchResult.jobs[0];
    var dbg = {
      topJob: top ? top.job_title : null,
      topFamily: top ? top.family_id : null,
      jtfReturn: (typeof jobTypeForRecommendation==='function') ? jobTypeForRecommendation(top) : '(no fn)',
      hasTech: (typeof SCORING_WEIGHTS!=='undefined' && !!SCORING_WEIGHTS.tech),
      selectedJobMatchAfter: (typeof selectedJobMatch!=='undefined') ? selectedJobMatch : '(undefined)',
      selectedJobType: (typeof selectedJobType !== 'undefined') ? selectedJobType : '(undefined)',
      selectedChip: chip ? chip.getAttribute('data-type') : null,
      recCount: rec ? rec.children.length : -1,
      recText: rec ? (rec.textContent || '').slice(0, 60) : '',
      weightText: wd ? (wd.textContent || '').slice(0, 40) : ''
    };
    return dbg;
  })()`);

  console.log('--- 明细 ---');
  console.log('  TOP:', r.topJob, '/ family=', r.topFamily, '/ jobTypeForRecommendation=', r.jtfReturn, '/ SCORING_WEIGHTS.tech=', r.hasTech);
  console.log('  selectedJobMatch(after):', r.selectedJobMatchAfter);
  console.log('  selectedJobType:', r.selectedJobType, '| selectedChip:', r.selectedChip);
  console.log('  recommended-jobs 子节点数:', r.recCount, '| 文本:', r.recText);
  console.log('  weights 显示:', r.weightText);

  check(r.topFamily === 'software', '前端简历首选应为 software 族（实际 ' + r.topFamily + '）');
  check(r.selectedJobType === 'tech', '进入第4步后 selectedJobType 应为 tech（实际 ' + r.selectedJobType + '）');
  check(r.selectedChip === 'tech', '类型 chip 高亮应为 tech/软件工程师（实际 ' + r.selectedChip + '）');
  check(r.recCount > 0, '推荐岗位区应已渲染（实际子节点数 ' + r.recCount + '）');
  check(!/产品经理/.test(r.weightText), '权重显示不应是产品经理（实际 ' + r.weightText + '）');

  if (errs.length) { console.log('--- console 错误 ---'); errs.forEach(e => console.log('  ' + e)); }
  console.log('\nPASSED=' + pass + ' FAILED=' + fail);
  app.exit(fail === 0 ? 0 : 1);
}

app.whenReady().then(main);
