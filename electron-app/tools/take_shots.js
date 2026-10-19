/* 桌面版真实截图导出（Electron 无头渲染 index.html 各页面）
 * 用法：electron tools/take_shots.js <输出目录>
 * 说明：截图来自真实页面；为避免泄露，不截图包含密钥的设置页输入框内容
 *      （设置页以「已配置」状态呈现，Key 输入框留空）。
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  const outDir = path.resolve(process.argv[2] || '.');
  fs.mkdirSync(outDir, { recursive: true });

  const win = new BrowserWindow({ width: 1440, height: 900, show: false });
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise(r => setTimeout(r, 1800));

  async function shot(page, file, before) {
    try {
      if (before) await win.webContents.executeJavaScript(before);
      await win.webContents.executeJavaScript(`showPage('${page}')`);
      await new Promise(r => setTimeout(r, 900));
      await win.webContents.capturePage(); // 丢弃第一次捕获（强制合成新帧，规避软件渲染滞后一帧问题）
      await new Promise(r => setTimeout(r, 300));
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(outDir, file), img.toPNG());
      console.log('SHOT_OK ' + file);
    } catch (e) {
      console.log('SHOT_FAIL ' + file + ' :: ' + (e && e.message ? e.message : e));
    }
  }

  // 1. 首页
  await shot('home', '01_home.png');
  // 2. 简历上传（三入口 + OCR 说明）
  await shot('resume', '02_resume_upload.png');
  // 3. 岗位推荐（先构造一个解析结果）
  await shot('resume', '03_job_match.png', `(function(){
    if (typeof lastJobMatchResult === 'undefined' || !lastJobMatchResult) {
      try { analyzeResumeText && analyzeResumeText(SAMPLE_RESUME_TEXT || ''); } catch(e) {}
    }
    return true;
  })()`);
  // 4. 设置页（Key 状态展示，不填真实 Key）
  await shot('settings', '04_settings.png');
  // 5. 历史记录（构造一条演示记录说明状态；标注为非真实用户数据）
  await shot('history', '05_history.png', `(function(){
    try {
      localStorage.removeItem('acc_history_v1');
      var demo = {id:'iv_demo',version:1,createdAt:Date.now()-86400000,job:'AI 产品经理（演示数据）',jobType:'ai',jobTypeName:'AI 工程师',difficulty:4,difficultyLabel:'字节/腾讯/阿里/美团',status:'completed',totalScore:76,verdict:'谨慎推荐',scores:{comm:80,biz:70,tech:85,leader:60,strategy:75,culture:72},interviewerScores:{hr:[80,78],biz:[70,72],pro:[85,88],lead:[60,58],chief:[75]},interviewerAvgs:{hr:79,biz:71,pro:87,lead:59,chief:75},conflict:{has:true,gap:28},answers:[{q:'请描述你将 LLM API 落地到生产环境的案例。',a:'在智能客服项目中……',score:85,comment:'技术扎实，有量化结果',dimension:'tech',interviewer:'pro'}],questionCount:6,durationMs:183000};
      localStorage.setItem('acc_history_v1', JSON.stringify([demo]));
    } catch(e) {}
    return true;
  })()`);
  // 6. Agent 架构页
  await shot('agents', '06_agents.png');

  app.quit();
});
