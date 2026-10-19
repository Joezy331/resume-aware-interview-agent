/* 验证 JD Agent 面板抽取质量：岗位职责应为完整短语（非单词碎裂）、
 * 硬技能应反映真实 JD（非泛化 Java/Python/Go）、面试重点应匹配真实岗位（非错配 AI产品策略）。
 * 运行（仅开发自测，非应用本体）：
 *   env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe tests/jd_analyze_check.js
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

process.on('uncaughtException', (e) => { console.error('TEST uncaughtException:', e && e.message); });
process.on('unhandledRejection', (e) => { console.error('TEST unhandledRejection:', e && e.message); });

async function main() {
  const win = new BrowserWindow({ show: false, width: 1280, height: 900 });
  win.webContents.on('console-message', (e, level, m) => { if (level >= 2) console.log('[renderer] ' + m); });
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise(r => setTimeout(r, 800));
  await win.webContents.executeJavaScript('window.alert=function(){};window.confirm=function(){return false;};0;');

  const report = await win.webContents.executeJavaScript(`(function(){
    function check(name, jd){
      var issues=[];
      jd.resp.forEach(function(r){ if(String(r).length<5) issues.push('岗位职责碎裂: '+JSON.stringify(r)); });
      var generic=['Java','Python','Go','C++'];
      var onlyGeneric = jd.hard.filter(function(h){return generic.indexOf(h)>=0;}).length>0 && jd.hard.length<=generic.length;
      if(onlyGeneric) issues.push('硬技能泛化: '+JSON.stringify(jd.hard));
      return {name:name, resp:jd.resp, hard:jd.hard, soft:jd.soft, tools:jd.tools, edu:jd.edu, focus:jd.focus, issues:issues};
    }
    var fe = '岗位名称：前端开发工程师\\n\\n岗位职责：\\n1. 负责公司核心产品 Web 前端的架构设计与开发；\\n2. 参与复杂交互模块的性能优化与体验打磨；\\n3. 与产品、设计协作推动需求高质量落地。\\n\\n任职要求：\\n1. 本科及以上学历，计算机相关专业；\\n2. 精通 React / Vue，熟练 TypeScript 与前端工程化；\\n3. 熟悉 Webpack / Vite 构建工具；\\n4. 具备良好的沟通能力与团队协作精神。';
    var ai = '岗位名称：AI 产品经理\\n\\n岗位职责：\\n1. 负责 AI 产品规划与 LLM 应用落地；\\n2. 主导 A/B 实验并基于数据迭代优化。\\n\\n任职要求：\\n1. 3 年以上产品经验；\\n2. 熟悉 Prompt Engineering 与数据分析；\\n3. 具备战略思维与跨团队推动力。';
    var data = '岗位名称：数据分析师\\n\\n岗位职责：\\n1. 搭建数据分析体系并撰写洞察报告；\\n2. 设计 A/B 实验支持业务决策。\\n\\n任职要求：\\n1. 精通 SQL 与 Python；\\n2. 熟悉 Tableau 等 BI 工具；\\n3. 具备统计基础与业务理解。';
    var messy = '我们正在招聘一名后端开发工程师，希望你精通 Java 与 Spring，熟悉 MySQL 和 Redis，能够独立完成微服务架构设计，有分布式系统经验者优先。你将负责核心交易系统的开发与性能调优，参与技术方案评审，与前端协作联调接口。';
    return {
      fe: check('前端JD', window.analyzeJDText(fe)),
      ai: check('AI产品JD', window.analyzeJDText(ai)),
      data: check('数据JD', window.analyzeJDText(data)),
      messy: check('无表头JD', window.analyzeJDText(messy))
    };
  })()`);

  console.log(JSON.stringify(report, null, 2));
  var fails = [];
  ['fe','ai','data','messy'].forEach(function(k){
    var r = report[k];
    r.issues.forEach(function(i){ fails.push('['+r.name+'] '+i); });
    if(k==='fe' && /AI\s*产品策略/.test(r.focus)) fails.push('[前端JD] 面试重点错配AI产品策略: '+r.focus);
    if(k==='data' && /AI\s*产品策略/.test(r.focus)) fails.push('[数据JD] 面试重点错配AI产品策略: '+r.focus);
    if(k==='ai' && !/AI|LLM|Prompt/.test(r.focus)) fails.push('[AI产品JD] 面试重点未命中AI: '+r.focus);
    if(k==='messy'){
      r.resp.forEach(function(x){ if(String(x).length<5) fails.push('[无表头JD] 职责碎裂: '+JSON.stringify(x)); });
      if(!/Java|Spring|MySQL|Redis|微服务|分布式/.test(r.hard.concat(r.tools).join(','))) fails.push('[无表头JD] 未命中真实技术栈: '+JSON.stringify(r.hard)+' / '+JSON.stringify(r.tools));
      if(/AI\s*产品策略/.test(r.focus)) fails.push('[无表头JD] 面试重点错配AI产品策略: '+r.focus);
    }
  });
  console.log('\n=== FAILS ===');
  if(fails.length===0) console.log('NONE'); else fails.forEach(function(f){console.log('❌ '+f);});
  console.log('\nFAILCOUNT='+fails.length);
  win.destroy();
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

function boot(){
  var ready = (app && typeof app.whenReady === 'function') ? app.whenReady() : new Promise(function(res){ app.on('ready', res); });
  Promise.resolve(ready)
    .then(main)
    .catch(function(e){ console.error('TEST ERROR:', e && (e.stack || e.message || e)); })
    .then(function(){ try{ app.quit(); }catch(_){} });
}
boot();
