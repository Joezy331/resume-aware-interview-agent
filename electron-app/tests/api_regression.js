/* =====================================================================
 * 回归测试：外接 API（Cline）+ 动态追问 + 岗位推荐 AI 路径
 *
 * ⚠️ 本脚本会【真实调用本地模型服务】，属于「真实模型评测」，
 *    与 tests/job_matching.test.js（本地确定性 Mock）区分开。
 *    若本地服务未启动，脚本会明确报「服务不可用」，不会伪装通过。
 *
 * 运行： node tests/api_regression.js
 * ===================================================================== */
const fs = require('fs');
const path = require('path');
const JM = require('../job-matching.js');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'local_api_config.json'), 'utf-8'));
const BASE = String(cfg.base_url || '').replace(/\/+$/, '');
const MODEL = cfg.model;

/* 与 index.html 的 callAI(messages, temperature, stage) 同签名 */
function callAI(messages, temperature, stage) {
  return fetch(BASE + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.api_key },
    body: JSON.stringify({ model: MODEL, messages: messages, temperature: temperature || 0.7, max_tokens: 800 })
  })
    .then(r => r.json())
    .then(j => {
      const t = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!t) return { ok: false, error: '模型返回空内容' };
      return { ok: true, text: t };
    })
    .catch(e => ({ ok: false, error: e.message }));
}

let pass = 0, fail = 0; const failures = [];
function check(cond, msg) { if (cond) pass++; else { fail++; failures.push(msg); } }

const MECH = `教育背景\n本科 机械设计制造及其自动化 华中科技大学\n\n工作经历\n2021-2024 某重工集团 机械设计工程师\n负责非标设备结构设计，使用 SolidWorks 完成三维建模与工程图出图\n参与产线设备改造，完成工装夹具设计并跟踪现场试制与装配调试\n\n项目经历\n自动化装配线设备设计：主导输送线与装配工位机械结构设计，输出 CAD 图纸 120 余张，设备节拍提升 25%\n\n专业技能\nSolidWorks AutoCAD 机械制图 有限元分析 ANSYS 公差配合 气动 液压 材料选型`;

const FIN = `教育背景\n本科 会计学 上海财经大学\n\n工作经历\n2020-2024 某会计师事务所 审计员\n负责年报审计底稿编制，执行实质性程序与函证程序\n参与制造业客户成本核算与内控测试，编制财务报表\n\n项目经历\n某上市公司年审：完成收入与存货循环审计，发现并调整差错金额 300 万元\n\n专业技能\n审计 财务报表 记账 凭证 Excel 用友 金蝶 税务申报 成本核算 财务分析\n\n证书\n注册会计师 CPA 已通过 中级会计职称`;

(async function main() {
  console.log('='.repeat(90));
  console.log('回归测试（真实模型）：外接 API / 动态追问 / 岗位推荐 AI 路径');
  console.log('服务: ' + BASE + ' | 模型: ' + MODEL);
  console.log('='.repeat(90));

  /* ---------- T1 连通性 ---------- */
  const t1 = await callAI([{ role: 'user', content: '请只回复四个字：连接成功' }], 0.3);
  console.log('\n[T1] 连通性: ' + (t1.ok ? 'OK → ' + t1.text.trim().slice(0, 20) : 'FAIL → ' + t1.error));
  check(t1.ok, 'T1 外接 API 连通性失败: ' + t1.error);
  if (!t1.ok) { report(); return; }

  /* ---------- T2 评分提示词（submitAnswer 回归：动态追问依赖它） ---------- */
  const sys2 = '你是「刘博士（技术专家，侧重专业深度与技术）」，正在对候选人做结构化面试评估。请对候选人的本轮回答给出专业评审。';
  const usr2 = '目标岗位：机械设计工程师。\n候选人回答：我主导了自动化装配线的机械结构设计，用 SolidWorks 出图 120 余张，设备节拍提升 25%。\n请严格按三行输出：\n【评分】0-100 的整数\n【评价】一句 15-30 字中文点评\n【追问】针对该回答的一个深入追问，或「无」';
  const t2 = await callAI([{ role: 'system', content: sys2 }, { role: 'user', content: usr2 }], 0.4);
  console.log('\n[T2] 评分+追问提示词: ' + (t2.ok ? 'OK' : 'FAIL → ' + t2.error));
  if (t2.ok) {
    const mS = t2.text.match(/评分[：:】)\s]*(\d{1,3})/);
    const mC = t2.text.match(/评价[：:】)\s]*([^\n]+)/);
    const mF = t2.text.match(/追问[：:】)\s]*([^\n]+)/);
    console.log('     原文片段: ' + t2.text.replace(/\n/g, ' | ').slice(0, 160));
    console.log('     解析 → 评分=' + (mS ? mS[1] : 'NA') +
                ' | 评价=' + (mC ? mC[1].trim().slice(0, 24) : 'NA') +
                ' | 追问=' + (mF ? mF[1].trim().slice(0, 40) : 'NA'));
    check(!!mS, 'T2 未解析出【评分】');
    check(!!mC, 'T2 未解析出【评价】');
    check(!!mF, 'T2 未解析出【追问】（动态追问失效）');
    if (mF) {
      const f = mF[1].trim();
      check(f !== '无' && f.length > 6, 'T2 追问内容为空或无效');
      // 追问应与回答内容相关（不是静态题库的通用问题）
      check(/装配线|结构|图纸|节拍|SolidWorks|设计|工艺|试制/.test(f) || f.length > 12,
            'T2 追问与回答内容无关（疑似回退静态题库）→ ' + f);
    }
  } else { check(false, 'T2 调用失败'); }

  /* ---------- T3 出题提示词（askNextQuestionV3 回归） ---------- */
  const sys3 = '你是「Sarah Chen（HR 经理，侧重动机与沟通）」，正在对候选人进行结构化面试（目标岗位：机械设计工程师）。每次只输出一个面试问题：一句话，简洁、专业、有深度，不要自我介绍、不要编号、不要任何前后缀说明。';
  const usr3 = '简历摘要：机械设计工程师，3 年经验，熟练 SolidWorks/AutoCAD。\n已进行的问答：\nQ: 请介绍你的机械设计项目。\nA: 我主导自动化装配线设计，出图 120 余张，节拍提升 25%。\n请生成下一个问题，必须承上启下、针对上一轮回答深入。';
  const t3 = await callAI([{ role: 'system', content: sys3 }, { role: 'user', content: usr3 }], 0.85);
  console.log('\n[T3] 出题提示词: ' + (t3.ok ? 'OK → ' + t3.text.trim().slice(0, 70) : 'FAIL → ' + t3.error));
  if (t3.ok) {
    check(t3.text.trim().length > 5, 'T3 未生成问题');
    check(!/^\d+[\.、]/.test(t3.text.trim()), 'T3 输出带了编号前缀');
  } else { check(false, 'T3 调用失败'); }

  /* ---------- T4/T5 岗位推荐 AI 路径（真实模型） ---------- */
  async function aiRec(name, resume, expectNot) {
    const r = await JM.recommendJobsWithAI(resume, null, { aiCaller: callAI, topN: 5, aiTimeout: 60000 });
    const used = r.debug && r.debug.ai ? r.debug.ai.used : false;
    console.log('\n[' + name + '] AI 参与: ' + (used ? '是' : '否（' + ((r.debug.ai && r.debug.ai.reason) || '回退本地') + '）'));
    r.jobs.forEach((j, i) => {
      console.log('   ' + (i + 1) + '. ' + j.job_title + ' | ' + j.industry +
                  ' | ' + j.match_score + ' | ' + j.band + ' | 置信' + j.confidence + ' | 覆盖' + j.evidence_coverage);
    });
    check(r.jobs.length > 0, name + ' 未产出候选岗位');
    if (expectNot) {
      const hit = r.jobs.filter(j => expectNot.test(j.job_title));
      check(hit.length === 0 || r.jobs[0].job_title !== 'AI 产品经理',
            name + ' 首选不应为 AI 产品经理');
    }
    return r;
  }

  const rMech = await aiRec('T4 机械简历(AI路径)', MECH, /AI 产品经理|产品经理/);
  const rFin = await aiRec('T5 财务简历(AI路径)', FIN, /AI 产品经理|产品经理/);

  check(!/AI 产品经理/.test(rMech.jobs[0].job_title), 'T4 机械简历首选不得是 AI 产品经理');
  check(!/AI 产品经理/.test(rFin.jobs[0].job_title), 'T5 财务简历首选不得是 AI 产品经理');

  report();

  function report() {
    console.log('\n' + '='.repeat(90));
    console.log('断言通过: ' + pass + ' | 失败: ' + fail + '   （真实模型评测）');
    if (failures.length) { console.log('失败明细:'); failures.forEach(f => console.log('  ✗ ' + f)); }
    console.log('='.repeat(90));
    process.exit(fail === 0 ? 0 : 1);
  }
})();
