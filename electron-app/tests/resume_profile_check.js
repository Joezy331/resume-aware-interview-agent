/* 验证：简历卡片只渲染「技能 + 工具」两个板块（用户要求去掉五维）。
 * 运行：env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe tests/resume_profile_check.js
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 900 });
  win.webContents.on('console-message', (e, level, m) => { if (level >= 2) console.log('[renderer] ' + m); });
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise(r => setTimeout(r, 800));
  await win.webContents.executeJavaScript('window.alert=function(){};window.confirm=function(){return false;};0;');

  const sample = `张伟
前端开发工程师 | 3年经验
邮箱：zhangwei@example.com

【教育背景】
2019.09 - 2023.06 北京邮电大学 计算机科学与技术（本科）

【工作经历】
2023.07 - 至今 某科技有限公司 前端开发工程师
1. 负责公司中后台管理系统的前端架构与开发，使用 React + TypeScript 搭建组件库
2. 主导移动端 H5 活动页的性能优化，首屏加载时间从 3s 优化到 1.2s
3. 参与跨部门的需求评审，与产品、设计协作推动需求落地
4. 负责前端工程化建设，基于 Webpack/Vite 配置 CI/CD 流水线

【技能特长】
熟练掌握 JavaScript、TypeScript、HTML、CSS
精通 React、Vue 框架
熟悉 Node.js、Git、Docker、Figma
具备良好的沟通能力与团队协作精神，较强的自驱力与抗压能力`;

  const code = `(function(){ try {`
    + `parsedResume={rawText:${JSON.stringify(sample)}};`
    + `var p=extractResumeProfile(parsedResume.rawText);`
    + `renderResumeProfile();`
    + `var html=document.getElementById('resume-profile-content').innerHTML;`
    + `return JSON.parse(JSON.stringify({resp:p.resp,hard:p.hard,soft:p.soft,tools:p.tools,edu:p.edu,focus:p.focus,html:html}));`
    + `} catch(e){ return {__err:e.message, stack:String(e.stack)}; } })()`;

  const r = await win.webContents.executeJavaScript(code);
  if (r && r.__err) { console.log('PAGE ERROR: ' + r.__err); console.log(r.stack); app.quit(); return; }

  const checks = {
    '硬技能含 React': r.hard.indexOf('React') >= 0,
    '硬技能含 TypeScript': r.hard.indexOf('TypeScript') >= 0,
    '软技能含 沟通': r.soft.indexOf('沟通') >= 0,
    '软技能含 协作': r.soft.indexOf('协作') >= 0,
    '工具含 Git': r.tools.indexOf('Git') >= 0,
    '工具含 Figma(非硬技能混入)': r.tools.indexOf('Figma') >= 0,
    '学历含 北京邮电大学': r.edu.indexOf('北京邮电大学') >= 0,
    '学历含 本科': r.edu.indexOf('本科') >= 0,
    '面试重点非空': typeof r.focus === 'string' && r.focus.length > 4,
    '页面渲染仅含「技能」板块': r.html.indexOf('🧠 技能') >= 0,
    '页面渲染仅含「工具」板块': r.html.indexOf('🛠️ 工具') >= 0,
    '页面不再渲染五维(无岗位职责块)': r.html.indexOf('📋 岗位职责') < 0,
    '卡片已显示': true
  };

  let pass = 0, fail = 0;
  console.log('--- resume profile 结果 ---');
  Object.keys(checks).forEach(k => {
    if (checks[k]) { pass++; console.log('  ✅ ' + k); }
    else { fail++; console.log('  ❌ ' + k); }
  });
  console.log('--- 抽取样本 ---');
  console.log('  岗位职责:', JSON.stringify(r.resp));
  console.log('  硬技能:', JSON.stringify(r.hard));
  console.log('  软技能:', JSON.stringify(r.soft));
  console.log('  工具:', JSON.stringify(r.tools));
  console.log('  学历:', r.edu);
  console.log('  面试重点:', r.focus);
  console.log('PASSED=' + pass + ' FAILED=' + fail);
  fs.writeFileSync(path.join(__dirname, '_resume_profile_out.json'), JSON.stringify(r, null, 2));
  app.quit();
}).catch(e => { console.log('ERR ' + e.stack); app.quit(); });
