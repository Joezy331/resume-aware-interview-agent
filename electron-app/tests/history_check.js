/* 面试历史记录模块测试（Phase 3/4）
 * 运行：env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe tests/history_check.js
 * 覆盖：页面结构 / 保存-加载往返 / 防重复保存 / 不覆盖旧记录 / 损坏数据隔离 /
 *       删除确认 / 旧记录兼容详情 / 渲染无异常
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

const errors = [];

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 800 });
  win.webContents.on('console-message', (e, level, message) => {
    if (level >= 2) errors.push('[console] ' + message);
  });
  win.webContents.on('did-fail-load', (e, code, desc) => errors.push('[load-fail] ' + code + ' ' + desc));

  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise(r => setTimeout(r, 1200));

  const result = await win.webContents.executeJavaScript(`(function(){
    var r = {};
    var pass = 0, fail = 0;
    function check(name, cond){ if(cond){pass++;} else {fail++; r['FAIL_' + name] = true;} }

    // —— 1. 页面与导航结构 ——
    check('page_history_exists', !!document.getElementById('page-history'));
    check('history_stats_exists', !!document.getElementById('history-stats'));
    check('history_list_exists', !!document.getElementById('history-list'));
    check('history_empty_exists', !!document.getElementById('history-empty'));
    check('history_detail_wrap_exists', !!document.getElementById('history-detail-wrap'));
    var navTexts = Array.prototype.map.call(document.querySelectorAll('.nav-link'), function(l){return l.textContent;});
    check('nav_has_history', navTexts.some(function(t){return t.indexOf('面试记录')>=0;}));
    check('nav_keeps_original', navTexts.some(function(t){return t.indexOf('设置')>=0;}) && navTexts.length >= 8);

    // —— 2. 模块函数就位 ——
    check('fns_defined', typeof loadHistory==='function' && typeof persistHistory==='function'
      && typeof buildInterviewRecord==='function' && typeof saveCurrentInterview==='function'
      && typeof renderHistoryPage==='function' && typeof openHistoryDetail==='function'
      && typeof deleteHistory==='function' && typeof renderHistoryDetailHTML==='function');

    // —— 3. 保存-加载往返（构造一场已完成的真实面试状态）——
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(HISTORY_CORRUPT_KEY);
    selectedJobMatch = 'AI 产品经理'; selectedJobType = 'ai';
    interviewState = {
      started:true, completed:true, historySaved:false,
      currentQ:5, totalQ:5, difficulty:4,
      scores:{comm:80,biz:70,tech:85,leader:60,strategy:75,culture:72},
      interviewerScores:{hr:[80,78],biz:[70,72],pro:[85,88],lead:[60,58],chief:[75]},
      chatHistory:[], answers:[
        {q:'第1题',a:'回答1',score:80,comment:'表达清晰',dimension:'comm',interviewer:'hr'},
        {q:'第2题',a:'回答2',score:85,comment:'技术扎实',dimension:'tech',interviewer:'pro'}
      ],
      startTime:Date.now()-180000
    };
    var rec = saveCurrentInterview();
    check('save_returns_record', !!rec && rec.id && rec.totalScore > 0);
    var list1 = loadHistory();
    check('load_after_save', list1.length === 1);
    check('record_fields', list1[0].job === 'AI 产品经理' && list1[0].difficultyLabel === '字节/腾讯/阿里/美团'
      && list1[0].answers.length === 2 && list1[0].questionCount === 2 && list1[0].status === 'completed');
    check('record_iv_avgs', list1[0].interviewerAvgs.hr === 79 && list1[0].interviewerAvgs.pro === 87);

    // —— 4. 同一场面试不重复保存 ——
    saveCurrentInterview();
    check('no_duplicate_save', loadHistory().length === 1);

    // —— 5. 新面试不覆盖旧记录 ——
    interviewState.historySaved = false;
    interviewState.scores.comm = 50;
    interviewState.startTime = Date.now()-60000;
    var rec2 = saveCurrentInterview();
    var list2 = loadHistory();
    check('append_not_overwrite', list2.length === 2 && list2[0].id !== list2[1].id);
    check('old_record_intact', list2[1].scores.comm === 80);

    // —— 6. 损坏数据隔离 ——
    localStorage.setItem(HISTORY_KEY, '{broken json!!!');
    var list3 = loadHistory();
    check('corrupt_isolated', Array.isArray(list3) && list3.length === 0);
    check('corrupt_quarantined', !!localStorage.getItem(HISTORY_CORRUPT_KEY));
    check('corrupt_key_cleared', !localStorage.getItem(HISTORY_KEY));

    // —— 7. 删除需确认（取消 = 不删）——
    localStorage.setItem(HISTORY_KEY, JSON.stringify([rec, rec2]));
    window.confirm = function(){ return false; };
    deleteHistory(rec2.id);
    check('delete_cancelled_kept', loadHistory().length === 2);
    window.confirm = function(){ return true; };
    deleteHistory(rec2.id);
    check('delete_confirmed_removed', loadHistory().length === 1 && loadHistory()[0].id === rec.id);

    // —— 8. 旧记录（缺新字段）兼容详情 ——
    var legacy = {id:'iv_old',createdAt:1690000000000,job:'旧记录岗位',difficulty:2,totalScore:65,verdict:'谨慎推荐'};
    var html = renderHistoryDetailHTML(legacy);
    check('legacy_detail_no_crash', typeof html === 'string' && html.length > 100);
    check('legacy_detail_compat', html.indexOf('旧版本数据兼容展示') >= 0);
    check('legacy_detail_escaped', html.indexOf('旧记录岗位') >= 0);

    // XSS 转义检查
    var evil = {id:'x',createdAt:1690000000000,job:'<script>alert(1)</script>',answers:[{q:'<img src=x onerror=1>',a:'<b>答</b>',score:50,dimension:'comm'}]};
    var html2 = renderHistoryDetailHTML(evil);
    check('detail_xss_escaped', html2.indexOf('<script>alert(1)</script>') < 0 && html2.indexOf('&lt;script&gt;') >= 0);

    // —— 9. 列表/详情/统计渲染无异常 ——
    localStorage.setItem(HISTORY_KEY, JSON.stringify([rec]));
    var renderErr = null;
    try {
      renderHistoryPage();
      openHistoryDetail(rec.id);
      var dw = document.getElementById('history-detail-wrap');
      check('detail_visible_after_open', dw && dw.style.display !== 'none');
      backToHistoryList();
    } catch(e){ renderErr = e; }
    check('render_no_exception', renderErr === null);

    // —— 10. showPage 路由到 history ——
    var routeErr = null;
    try { showPage('history'); } catch(e){ routeErr = e; }
    check('showpage_history_ok', routeErr === null && document.getElementById('page-history').classList.contains('active'));

    r.pass = pass; r.fail = fail;
    return r;
  })()`);

  const jsErrors = errors.filter(e => !/favicon|net::ERR/i.test(e));
  console.log('PASSED=' + result.pass + ' FAILED=' + result.fail);
  if (result.fail) console.log('FAIL_DETAIL=' + JSON.stringify(result));
  if (jsErrors.length) console.log('JS_ERRORS=' + JSON.stringify(jsErrors.slice(0, 5)));
  app.exit(result.fail === 0 && jsErrors.length === 0 ? 0 : 1);
});
