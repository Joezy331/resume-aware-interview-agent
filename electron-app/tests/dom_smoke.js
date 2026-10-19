/* Electron 内加载 index.html，捕获 JS 语法错误 / 未捕获异常 / 关键全局是否就位。
 * 运行：env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe tests/dom_smoke.js
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
  win.webContents.on('console-message', (e, level, message, line, sourceId) => {
    if (level >= 2) errors.push('[console] ' + message + ' @' + (sourceId || '') + ':' + line);
  });
  win.webContents.on('did-fail-load', (e, code, desc) => errors.push('[load-fail] ' + code + ' ' + desc));
  win.webContents.on('render-process-gone', (e, d) => errors.push('[render-gone] ' + JSON.stringify(d)));

  await win.loadFile(path.join(__dirname, '..', 'index.html'));

  await new Promise(r => setTimeout(r, 1500));

  /* —— 纯逻辑单测：extractJSON / mergeAIParsed / getAIModelForStage —— */
  const logic = await win.webContents.executeJavaScript(`(function(){
    var r = {};
    var j1 = extractJSON('\\\`\\\`\\\`json\\\\n{"name":"张三"}\\\\n\\\`\\\`\\\`');
    r.jsonFence = !!(j1 && j1.name === '张三');
    var j2 = extractJSON('好的，结果如下：{"skills":["SolidWorks","ANSYS"]} 以上。');
    r.jsonNoise = !!(j2 && j2.skills && j2.skills.length === 2);
    r.jsonNull = extractJSON('完全没有 JSON') === null;
    var j3 = extractJSON('{"name":"含\\\\"引号\\\\"的名字"}');
    r.jsonEscapedQuote = !!(j3 && j3.name.indexOf('引号') >= 0);

    var base = {name:'候选人',title:'候选人',experience:'经验待评估',education:'学历待确认',
                skills:['通用能力','学习能力强'],projects:[{name:'项目经历待补充',role:'--',desc:''}],
                highlights:['待补充亮点成就'],isTech:false,rawText:'x'};
    var ai = {name:'陈思远',target_job:'机械设计工程师',education:'本科 · 北京理工大学 · 机械工程',
              years:'3年',skills:['SolidWorks','ANSYS','AutoCAD'],
              projects:[{name:'六自由度机械臂',desc:'用 MATLAB 仿真'}],
              certs:['CET-6'],highlights:['最大应力下降 18%']};
    var m = mergeAIParsed(base, ai);
    r.fillName = m.name === '陈思远';
    r.fillEdu = m.education === '本科 · 北京理工大学 · 机械工程';
    r.fillYears = m.experience === '3年';
    r.replaceGenericSkills = JSON.stringify(m.skills) === JSON.stringify(['SolidWorks','ANSYS','AutoCAD']);
    r.fillProjects = m.projects[0].name === '六自由度机械臂';
    r.fillHighlights = m.highlights.indexOf('最大应力下降 18%') >= 0;
    r.targetJob = m.targetJob === '机械设计工程师';

    // 已有真实值不应被 AI 覆盖
    var base2 = {name:'李四',title:'软件工程师',experience:'5年经验',education:'硕士',
                 skills:['软件开发','数据分析'],projects:[{name:'真实项目',role:'负责人',desc:'d'}],
                 highlights:['真实亮点'],rawText:'x'};
    var m2 = mergeAIParsed(base2, ai);
    r.keepRealName = m2.name === '李四';
    r.keepRealEdu = m2.education === '硕士';
    r.keepRealProjects = m2.projects[0].name === '真实项目';
    r.appendSkills = m2.skills.indexOf('软件开发') >= 0 && m2.skills.indexOf('SolidWorks') >= 0;

    // 失效模型名应自动降级
    localStorage.setItem('sf_model','deepseek-v4-flash-free');
    r.staleModelFallback = getAIModelForStage('question');
    localStorage.setItem('sf_model','cline-free/solar-mini4');
    r.keepValidModel = getAIModelForStage('question');
    localStorage.setItem('sf_model','auto');
    r.autoQuestion = getAIModelForStage('question');
    r.autoReport = getAIModelForStage('report');
    localStorage.setItem('sf_model','cline-free/mimo-v2.6-flash');

    // ===== 步骤 4：职位推荐选择 =====
    r.hasGeneral = !!SCORING_WEIGHTS.general;
    r.mapMech = jobTypeForRecommendation({familyId:'engineering_mfg',job_title:'机械设计工程师'});
    r.mapSoftware = jobTypeForRecommendation({familyId:'software',job_title:'软件开发工程师'});
    r.mapData = jobTypeForRecommendation({familyId:'ai_data',job_title:'数据分析师'});
    r.mapAI = jobTypeForRecommendation({familyId:'ai_data',job_title:'算法工程师'});
    r.mapNull = jobTypeForRecommendation(null);

    // 渲染推荐岗位并自动选择
    selectedJobMatch = undefined;
    lastJobMatchResult = {jobs:[
      {job_title:'机械设计工程师',industry:'工程制造',match_score:80,familyId:'engineering_mfg'},
      {job_title:'软件工程师',industry:'互联网',match_score:52,familyId:'software'}
    ]};
    prepareStep4();
    r.autoPickTop = selectedJobMatch === '机械设计工程师';
    r.autoTypeGeneral = selectedJobType === 'general';
    r.chipsRendered = (document.getElementById('recommended-jobs').innerHTML.indexOf('机械设计工程师') >= 0);
    r.chipCount = document.querySelectorAll('#recommended-jobs [data-rjob]').length;

    // 选择第二个推荐岗位 → 类型应跟随变化
    selectRecommendedJob(1);
    r.pickSecond = selectedJobMatch === '软件工程师';
    r.pickSecondType = selectedJobType === 'tech';

    // 权重展示区应显示 tech 的权重
    r.weightsShown = document.getElementById('weights-display').innerHTML.indexOf('软件工程师') >= 0;

    // 自定义岗位不被覆盖
    selectedJobMatch = '我的自定义岗位';
    prepareStep4();
    r.keepCustom = selectedJobMatch === '我的自定义岗位';
    selectedJobMatch = '机械设计工程师';
    return r;
  })()`);

  console.log('--- 逻辑单测 ---');
  let lpass = 0, lfail = 0;
  Object.keys(logic).forEach(k => {
    const v = logic[k];
    const expect = {
      staleModelFallback:'cline-free/mimo-v2.6-flash',
      keepValidModel:'cline-free/solar-mini4',
      autoQuestion:'cline-free/step-5-preview',
      autoReport:'cline-free/mimo-v2.6-flash',
      mapMech:'general', mapSoftware:'tech', mapData:'data', mapAI:'ai', mapNull:'general',
      chipCount:2
    }[k];
    const good = (expect !== undefined) ? (v === expect)
      : (typeof v === 'boolean' ? v : true);
    if (good) { lpass++; console.log('  ✅ ' + k + ' = ' + JSON.stringify(v)); }
    else { lfail++; console.log('  ❌ ' + k + ' = ' + JSON.stringify(v)); }
  });

  const probe = await win.webContents.executeJavaScript(`(function(){
    var out = {};
    out.JobMatching = typeof window.JobMatching;
    out.callAI = typeof window.callAI;
    out.ocrImageResume = typeof window.ocrImageResume;
    out.aiExtractResume = typeof window.aiExtractResume;
    out.extractJSON = typeof window.extractJSON;
    out.mergeAIParsed = typeof window.mergeAIParsed;
    out.finalizeParsedResume = typeof window.finalizeParsedResume;
    out.renderParsedInfo = typeof window.renderParsedInfo;
    out.AVAILABLE_MODELS = (typeof window.AVAILABLE_MODELS!=='undefined')?window.AVAILABLE_MODELS:null;
    out.VISION_MODELS = (typeof window.VISION_MODELS!=='undefined')?window.VISION_MODELS:null;
    out.MODEL_MAP_question = (typeof window.MODEL_MAP!=='undefined')?window.MODEL_MAP.question.model:null;
    out.accept = (document.getElementById('resume-file')||{}).accept || null;
    var sel = document.getElementById('settings-model');
    out.modelOptions = sel ? Array.prototype.map.call(sel.options, function(o){return o.value;}) : null;
    out.IMAGE_EXTS = (typeof window.IMAGE_EXTS!=='undefined')?window.IMAGE_EXTS:null;
    return out;
  })()`);

  console.log('--- 探针 ---');
  Object.keys(probe).forEach(k => console.log('  ' + k + ' = ' + JSON.stringify(probe[k])));
  console.log('--- 错误 ---');
  if (!errors.length) console.log('  （无 console error / 加载失败）');
  else errors.forEach(e => console.log('  ' + e));

  fs.writeFileSync(path.join(__dirname, '_smoke_out.json'), JSON.stringify({ probe, errors }, null, 2), 'utf-8');
  app.quit();
}).catch(e => { console.log('ERR ' + e.stack); app.quit(); });
