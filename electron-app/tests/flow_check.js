/* 验证 Round 5：JD 流程不再自动跳转 + 必须填 JD / 选标准 JD 才能进入第 3 步。
 * 运行：env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe tests/flow_check.js
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');
const errors = [];
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 800 });
  win.webContents.on('console-message', (e, level, m) => { if (level >= 2) errors.push('[console] ' + m); });
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise(r => setTimeout(r, 1000));

  // 屏蔽弹窗，避免 headless 下阻塞（结尾补 0，避免 executeJavaScript 返回函数导致 DataCloneError）
  await win.webContents.executeJavaScript(`window.alert=function(){};window.confirm=function(){return false;};0;`);

  async function step(label, code){
    try { return await win.webContents.executeJavaScript(code); }
    catch(e){ console.log('  ⚠️ '+label+' 报错: '+e.message); return {__err:e.message}; }
  }

  // 1) 选岗位不应自动跳到第3步，且 jdSource 变 standard
  await step('selectJobMatch', `(function(){ selectedJobMatch=undefined; jdSource='none'; selectJobMatch('AI 产品经理', null); return true; })()`);
  await new Promise(r => setTimeout(r, 1000)); // 等 selectJobMatch 内部 800ms setTimeout

  const r1 = await step('checkAfterSelect', `(function(){
    return {
      step3AfterSelect: document.getElementById('resume-step-3').style.display,
      jdSourceAfterSelect: jdSource,
      selected: selectedJobMatch
    };
  })()`);

  // 2) 已选岗位(jdSource=standard) 点下一步应跳到第3步
  const r2 = await step('goToJDAnalysis(standard)', `(function(){
    goToJDAnalysis();
    return { step3AfterNext: document.getElementById('resume-step-3').style.display, jdSource: jdSource };
  })()`);

  // 3) 未选岗位 + 未填 JD → 点下一步不应跳转
  const r3 = await step('goToJDAnalysis(blocked)', `(function(){
    selectedJobMatch=undefined; jdSource='none';
    document.getElementById('resume-step-3').style.display='none';
    goToJDAnalysis();
    return { step3Blocked: document.getElementById('resume-step-3').style.display };
  })()`);

  // 4) 粘贴 JD 后 jdSource=pasted，且可见第3步卡片含岗位职责/学历等字段
  const r4 = await step('parseJDPaste', `(function(){
    document.getElementById('jd-paste-input').value='岗位名称：数据分析师\\n岗位职责：\\n1. 负责数据分析\\n任职要求：\\n1. 本科\\n2. 精通 SQL';
    selectedJobMatch=undefined;
    parseJDPaste();
    var html=document.getElementById('jd-display-content').innerHTML;
    return {
      jdSource: jdSource,
      hasResp: html.indexOf('📋 岗位职责')>=0, hasSkill: html.indexOf('🔧 硬技能要求')>=0,
      hasSoft: html.indexOf('🧠 软技能要求')>=0,
      hasTool: html.indexOf('🛠️ 工具要求')>=0,
      hasEdu: html.indexOf('🎓 学历要求')>=0, hasFocus: html.indexOf('🎯 面试重点')>=0,
      hasKw: html.indexOf('🔑 JD 关键词')>=0
    };
  })()`);

  console.log('--- flow 结果 ---');
  const checks = {
    '选岗位不自动跳(step3=none)': r1.step3AfterSelect === 'none',
    '选岗位后jdSource=standard': r1.jdSourceAfterSelect === 'standard',
    '已选岗位点下一步跳入(step3=block)': r2.step3AfterNext === 'block',
    '未选未填被拦截(step3=none)': r3.step3Blocked === 'none',
    '粘贴后jdSource=pasted': r4.jdSource === 'pasted',
    '解析含岗位职责': r4.hasResp,
    '解析含技能要求': r4.hasSkill,
    '解析含软技能分区': r4.hasSoft,
    '解析含工具要求': r4.hasTool,
    '解析含学历要求': r4.hasEdu,
    '解析含面试重点': r4.hasFocus,
    '解析含关键词块': r4.hasKw
  };
  let pass = 0, fail = 0;
  Object.keys(checks).forEach(k => {
    if (checks[k]) { pass++; console.log('  ✅ ' + k); }
    else { fail++; console.log('  ❌ ' + k); }
  });
  console.log('--- 错误 ---');
  if (!errors.length) console.log('  （无 console error）'); else errors.forEach(e => console.log('  ' + e));
  console.log('PASSED=' + pass + ' FAILED=' + fail);
  fs.writeFileSync(path.join(__dirname, '_flow_out.json'), JSON.stringify({ r1, r2, r3, r4, errors }, null, 2));
  app.quit();
}).catch(e => { console.log('ERR ' + e.stack); app.quit(); });
