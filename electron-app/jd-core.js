/* ============================================================
 * jd-core.js — JD 智能分析核心逻辑（Prompt 工程 + 数据模型）
 * ------------------------------------------------------------
 * - JD_GEN_SYSTEM_PROMPT：行业标准 JD 生成 Agent 核心系统提示词
 *   （职级区分 实习生→高级；九段结构 A–I；JSON 输出）
 * - MATCH_SYSTEM_PROMPT：简历 × 标准 JD 六维匹配分析提示词
 *   （25/25/20/15/10/5，技术岗自动调权；已体现/未体现/待确认）
 * - 数据模型：acc_jd_v1（manual=真实 JD / industry_reference=生成 JD），
 *   与面试历史 acc_history_v1 同机制（localStorage，互不冲突）
 * - localMatchFallback：模型不可用时的本地启发式匹配（带证据）
 * - 纯 JS；浏览器全局 + Node require（测试用）
 * ============================================================ */
(function (root) {
  'use strict';

  var LEVELS = ['实习生', '应届生', '初级', '中级', '高级'];

  /* ==========================================================
   * 一、行业标准 JD 生成 Agent — 核心系统提示词
   * ========================================================== */
  var JD_GEN_SYSTEM_PROMPT = [
'你是一名拥有丰富招聘经验的资深 HR 专家、行业人才分析师和职业能力模型顾问。',
'你熟悉中国大陆主流行业的招聘体系，能够从岗位职责、岗位能力、专业技能、工作经验、学历要求和绩效目标等维度，构建符合行业通用招聘标准的 Job Description（JD）。',
'',
'你的任务不是简单地根据用户简历改写岗位描述，而是：',
'以行业通用岗位标准为基准，结合用户的真实简历信息，生成一份客观、完整、符合目标岗位和职级要求的参考 JD，并分析用户与岗位要求之间的差距。',
'',
'【输入信息】',
'你可能收到：用户简历原文、简历结构化解析结果、目标行业、目标岗位、岗位级别、用户的学历/专业/技能/项目经历/工作经验、求职偏好。请优先使用已有结构化简历数据，必要时结合简历原文补充。',
'',
'【岗位标准判断】',
'生成 JD 前，必须先判断：岗位所属行业、职能、核心工作目标、职级，以及岗位需要的专业知识、业务能力、工具和技术能力、沟通协作能力、典型工作成果。',
'必须区分不同职级的要求：',
'实习生：基础专业知识；基本工具使用能力；学习能力和执行能力；在指导下完成任务；有相关课程、项目或实习经历优先。',
'应届生：具备岗位基础知识；能独立完成基础工作任务；有相关项目实践或实习经历；具备基本的数据分析、沟通和协作能力。',
'初级岗位：能独立承担常规业务任务；熟悉岗位常用工具和工作流程；具备一定的问题分析与解决能力。',
'中级岗位：能独立负责完整业务模块；具备跨部门协作和项目推进能力；能够承担业务目标和结果。',
'高级岗位：能够制定业务策略和体系；具备复杂项目管理及团队协作能力；能够对关键业务结果负责。',
'不得将高级岗位的管理要求直接套用到实习生和应届生身上。',
'',
'【JD 标准结构】生成的 JD 必须包含：',
'A. 岗位基本信息：标准岗位名称、所属行业、所属职能部门、岗位级别、岗位类型、典型工作方向。',
'B. 岗位概述：100–150 字描述该岗位存在的目的、主要价值及在企业中的作用。',
'C. 核心岗位职责：5–8 项。每项必须包含具体工作内容、主要执行动作、对应业务目标或交付结果。禁止只写空泛描述（如"负责产品相关工作""完成领导安排的任务"）。',
'D. 任职资格：分必备条件（学历要求、专业要求（如确有必要）、工作经验要求、基础知识要求、必须掌握的技能）与优先条件（相关项目经验、相关实习经验、行业背景、额外工具或技术能力、专业证书或竞赛经历）。必须区分必备与加分项，不能把所有要求都写成硬性门槛。',
'E. 专业技能要求：按类别分类——专业基础知识、核心业务技能、技术与工具技能、数据分析能力、沟通协作能力、解决问题能力；每项技能标记"必须掌握/熟悉即可/加分项"。',
'F. 工作经验要求：典型工作年限范围、相关行业经验、项目经验类型、工作复杂度、独立负责程度。若目标为实习生或应届生，允许以课程项目、个人项目、竞赛和实习经历作为相关经验参考，不得机械要求多年全职经验。',
'G. 关键绩效指标 KPI/交付成果：3–5 个该岗位可能关注的绩效维度（如项目交付质量、业务增长、用户满意度、运营效率、数据分析准确性）。这些是岗位参考指标，不得伪装成某家真实公司的实际考核标准。',
'H. 典型工作场景：3–5 个真实、合理的工作场景，说明该岗位通常会处理哪些问题。',
'I. 发展路径：常见的职业发展方向，区分专业晋升与管理晋升。',
'',
'【生成质量要求】',
'- JD 必须符合目标岗位真实工作内容；不同岗位必须有明显的职责和技能差异；不得将所有岗位都生成成相似模板。',
'- 不得无依据地堆砌 Python、SQL、AI、大数据等技术词汇；不得将学历、证书、工作年限等非必要条件全部设置为必备项。',
'- 不得编造企业名称、招聘薪资、真实招聘人数和具体招聘信息；对缺乏依据的信息标注"行业参考"或"需根据企业实际情况确认"。',
'- 生成内容应专业、具体、清晰，符合招聘人员阅读习惯。',
'',
'【行业差异化要求】根据目标行业自动调整 JD 的职责和技能。例如：',
'AI 产品经理：重点关注 AI 场景挖掘、用户需求分析、产品规划、Prompt 设计、Agent 工作流、模型能力评估、数据分析、AI 产品迭代。',
'数据分析师：重点关注 SQL、Python、统计分析、数据清洗、可视化、指标体系、业务分析及决策支持。',
'前端开发工程师：重点关注 HTML、CSS、JavaScript、前端框架、组件开发、接口联调、性能优化和工程化。',
'UI/UX 设计师：重点关注用户研究、需求分析、交互设计、视觉规范、原型设计、可用性测试及设计交付。',
'市场营销专员：重点关注市场调研、用户洞察、品牌传播、营销策划、渠道运营、活动执行及营销数据分析。',
'',
'【输出格式】只输出一个 JSON 对象（不要输出任何 JSON 之外的文字、解释或 markdown 代码块围栏），字段如下：',
'{',
'  "job_title": "标准岗位名称",',
'  "industry": "所属行业",',
'  "job_function": "所属职能部门",',
'  "job_level": "岗位级别（实习生/应届生/初级/中级/高级）",',
'  "job_type": "岗位类型（如全职/实习，可附工作方向）",',
'  "work_direction": "典型工作方向",',
'  "job_summary": "岗位概述 100-150 字",',
'  "responsibilities": [{"task": "具体工作内容", "action": "主要执行动作", "outcome": "对应业务目标或交付结果"}],',
'  "required_qualifications": ["必备条件（学历/专业/经验/基础知识/必须掌握的技能，分条）"],',
'  "preferred_qualifications": ["优先条件（项目/实习/行业背景/额外工具/证书竞赛，分条）"],',
'  "professional_skills": [{"category": "专业基础知识|核心业务技能|技术与工具技能|数据分析能力|沟通协作能力|解决问题能力", "skill": "技能项", "level": "必须掌握|熟悉即可|加分项"}],',
'  "experience_requirements": ["典型工作年限范围/行业经验/项目经验类型/复杂度/独立负责程度，分条"],',
'  "kpi_indicators": [{"name": "绩效维度", "note": "参考说明（标注为行业参考）"}],',
'  "work_scenarios": ["典型工作场景"],',
'  "career_path": ["职业发展方向（区分专业晋升与管理晋升）"],',
'  "generation_type": "industry_reference",',
'  "confidence_notes": ["说明哪些内容属于行业参考、需根据企业实际情况确认"]',
'}',
'responsibilities 输出 5-8 项；kpi_indicators 输出 3-5 项；work_scenarios 输出 3-5 项；professional_skills 每个类别至少 1 项。'
  ].join('\n');

  /* 组装 JD 生成消息 */
  function buildJDGenMessages(input){
    input = input || {};
    var lines = [];
    lines.push('请基于以下信息生成「' + (input.jobTitle||'目标岗位') + ' · ' + (input.level||'实习生') + '」的行业标准参考 JD。');
    lines.push('');
    lines.push('【目标岗位】' + (input.jobTitle||''));
    lines.push('【所属行业】' + (input.industry||''));
    lines.push('【岗位级别】' + (input.level||''));
    if (input.extraNote) lines.push('【用户补充说明】' + input.extraNote);
    if (input.resumeStruct){
      var r = input.resumeStruct;
      lines.push('');
      lines.push('【简历结构化数据】');
      if (r.name) lines.push('- 姓名：' + r.name);
      if (r.education) lines.push('- 教育背景：' + r.education);
      if (r.experience) lines.push('- 工作经验：' + r.experience);
      if (Array.isArray(r.skills) && r.skills.length) lines.push('- 专业技能：' + r.skills.join('、'));
      if (Array.isArray(r.projects) && r.projects.length){
        lines.push('- 项目/实习经历：');
        r.projects.forEach(function(p,i){ lines.push('  ' + (i+1) + '. ' + (p.name||'') + (p.desc?('：' + p.desc):'')); });
      }
      if (Array.isArray(r.highlights) && r.highlights.length) lines.push('- 成果与亮点：' + r.highlights.join('；'));
    }
    if (input.resumeText){
      lines.push('');
      lines.push('【简历原文】（结构化数据缺失时参考）');
      lines.push(String(input.resumeText).slice(0, 3000));
    }
    lines.push('');
    lines.push('请严格按照系统提示词中的 JSON 输出格式返回。生成要求以行业通用岗位标准为基准，简历信息仅用于校准职级与参考性，不得虚构简历中不存在的经历为岗位要求。');
    return [
      { role:'system', content: JD_GEN_SYSTEM_PROMPT },
      { role:'user',   content: lines.join('\n') }
    ];
  }

  /* ==========================================================
   * 二、简历 × 标准 JD 匹配分析提示词
   * ========================================================== */
  var MATCH_SYSTEM_PROMPT = [
'你是一名资深 AI 招聘评估顾问。',
'请根据用户真实简历和目标岗位行业标准 JD，对候选人的岗位适配程度进行客观分析。',
'',
'分析原则：',
'1. 不得因为简历中没有写某项技能，就直接判断用户完全不具备该技能。',
'2. 区分"已体现""未体现""待确认"三种情况。',
'3. 不得将项目经历中的技能夸大成企业实际工作经验。',
'4. 不得把 JD 中的加分项与必备条件混为一谈。',
'5. 评价必须指出具体简历证据。',
'6. 匹配分数必须有可解释的评分依据。',
'',
'匹配维度与参考权重（技术岗位适当提高技术技能权重；非技术岗提高业务理解、沟通协作和项目推进权重）：',
'- 专业技能匹配 25%',
'- 核心岗位职责匹配 25%',
'- 项目及实践经验 20%',
'- 行业与业务理解 15%',
'- 学历及专业背景 10%',
'- 通用能力 5%',
'',
'输出内容：综合岗位匹配度、六维能力匹配评分、已满足的岗位要求、部分满足的岗位要求、简历中未体现的岗位要求、需要进一步确认的能力、核心优势、主要能力差距、简历优化建议、面试准备建议、推荐学习路径。',
'所有匹配结果必须能够关联到简历中的具体经历或 JD 中的具体要求。如果证据不足，应明确标记"无法判断"，而不是强行给出结论。',
'',
'【输出格式】只输出一个 JSON 对象（不要输出 JSON 之外的任何文字）：',
'{',
'  "overall_match": 0-100 的整数,',
'  "dimensions": [{"name": "维度名", "weight": 权重整数, "score": 0-100 整数, "evidence": "评分依据（引用简历或 JD 原文）"}],',
'  "satisfied": [{"item": "已满足的岗位要求", "evidence": "简历中的具体证据"}],',
'  "partial": [{"item": "部分满足的岗位要求", "evidence": "现有证据", "gap": "还差什么"}],',
'  "missing": [{"item": "简历中未体现的岗位要求", "note": "说明（未体现≠不具备）"}],',
'  "to_confirm": ["需要进一步确认的能力"],',
'  "strengths": ["核心优势（带证据）"],',
'  "gaps": ["主要能力差距"],',
'  "resume_suggestions": ["简历优化建议"],',
'  "interview_suggestions": ["面试准备建议"],',
'  "learning_path": ["推荐学习路径（按优先级排序）"]',
'}'
  ].join('\n');

  /* 六维权重：默认 + 技术岗调权 */
  var DEFAULT_WEIGHTS = [
    { name:'专业技能匹配', weight:25 },
    { name:'核心岗位职责匹配', weight:25 },
    { name:'项目及实践经验', weight:20 },
    { name:'行业与业务理解', weight:15 },
    { name:'学历及专业背景', weight:10 },
    { name:'通用能力', weight:5 }
  ];
  var TECH_WEIGHTS = [
    { name:'专业技能匹配', weight:30 },
    { name:'核心岗位职责匹配', weight:20 },
    { name:'项目及实践经验', weight:20 },
    { name:'行业与业务理解', weight:12 },
    { name:'学历及专业背景', weight:10 },
    { name:'通用能力', weight:8 }
  ];
  function weightsFor(jobTitle, isTech){
    if (isTech || /工程师|开发|算法|架构师|运维|测试|数据开发|大模型/i.test(String(jobTitle||''))) return TECH_WEIGHTS;
    return DEFAULT_WEIGHTS;
  }

  function buildMatchMessages(input){
    input = input || {};
    var lines = [];
    lines.push('请对以下候选人与目标岗位进行匹配分析。');
    lines.push('');
    lines.push('【目标岗位】' + (input.jobTitle||'') + '（级别：' + (input.level||'') + '，行业：' + (input.industry||'') + '）');
    lines.push('【权重配置】' + weightsFor(input.jobTitle, input.isTech).map(function(w){ return w.name + ' ' + w.weight + '%'; }).join('；'));
    lines.push('');
    lines.push('【行业标准 JD（结构化）】');
    lines.push(JSON.stringify(input.jd || {}, null, 1).slice(0, 6000));
    lines.push('');
    lines.push('【候选人简历】');
    lines.push(String(input.resumeText||'').slice(0, 3000));
    if (input.resumeStruct){
      var r = input.resumeStruct;
      if (Array.isArray(r.skills) && r.skills.length) lines.push('（结构化技能：' + r.skills.join('、') + '）');
    }
    lines.push('');
    lines.push('请严格按照系统提示词中的 JSON 输出格式返回，所有结论必须引用具体证据。');
    return [
      { role:'system', content: MATCH_SYSTEM_PROMPT },
      { role:'user',   content: lines.join('\n') }
    ];
  }

  /* ==========================================================
   * 三、模型输出归一化（容错：字符串/对象混合数组等）
   * ========================================================== */
  function asStr(v, fb){ return (v===null||v===undefined||v==='')?(fb||''):String(v); }
  function asArr(v){ return Array.isArray(v)?v:[]; }
  function itemText(v){
    if (v===null||v===undefined) return '';
    if (typeof v==='string') return v.trim();
    if (typeof v==='number') return String(v);
    if (typeof v==='object'){
      var keys=['task','item','name','skill','note','text','desc','title','content','scenario','path','suggestion'];
      for (var i=0;i<keys.length;i++){ if (v[keys[i]]) return String(v[keys[i]]).trim(); }
    }
    return String(v).trim();
  }
  function strList(v){
    return asArr(v).map(itemText).filter(function(s){ return s && s.length>1; });
  }
  /* 归一化 JD 生成结果 → 前端展示安全结构 */
  function normalizeGeneratedJD(raw){
    if (!raw || typeof raw!=='object') return null;
    var skills = asArr(raw.professional_skills).map(function(s){
      if (typeof s==='string') return { category:'核心业务技能', skill:s.trim(), level:'必须掌握' };
      return {
        category: asStr(s && s.category, '核心业务技能'),
        skill: asStr(s && (s.skill||s.name||s.item)),
        level: asStr(s && s.level, '必须掌握')
      };
    }).filter(function(s){ return s.skill; });
    var resp = asArr(raw.responsibilities).map(function(r){
      if (typeof r==='string') return { task:r.trim(), action:'', outcome:'' };
      return { task:asStr(r && (r.task||r.item||r.name)), action:asStr(r && r.action), outcome:asStr(r && (r.outcome||r.result)) };
    }).filter(function(r){ return r.task; });
    var kpi = asArr(raw.kpi_indicators).map(function(k){
      if (typeof k==='string') return { name:k.trim(), note:'' };
      return { name:asStr(k && (k.name||k.item||k.dimension)), note:asStr(k && (k.note||k.desc)) };
    }).filter(function(k){ return k.name; });
    var lv = asStr(raw.job_level);
    if (LEVELS.indexOf(lv)<0){
      var guess = LEVELS.filter(function(l){ return lv.indexOf(l)>=0; })[0];
      lv = guess || lv || '';
    }
    return {
      job_title: asStr(raw.job_title),
      industry: asStr(raw.industry),
      job_function: asStr(raw.job_function),
      job_level: lv,
      job_type: asStr(raw.job_type),
      work_direction: asStr(raw.work_direction),
      job_summary: asStr(raw.job_summary),
      responsibilities: resp,
      required_qualifications: strList(raw.required_qualifications),
      preferred_qualifications: strList(raw.preferred_qualifications),
      professional_skills: skills,
      experience_requirements: strList(raw.experience_requirements),
      kpi_indicators: kpi,
      work_scenarios: strList(raw.work_scenarios),
      career_path: strList(raw.career_path),
      generation_type: 'industry_reference',
      confidence_notes: strList(raw.confidence_notes)
    };
  }
  /* 归一化匹配结果 */
  function normalizeMatchResult(raw, weights){
    if (!raw || typeof raw!=='object') return null;
    var dims = asArr(raw.dimensions).map(function(d){
      var w = parseInt(d && d.weight, 10) || 0;
      if (!w){
        var m = (weights||[]).filter(function(x){ return x.name===asStr(d && (d.name||d.dimension)); })[0];
        w = m ? m.weight : 0;
      }
      return {
        name: asStr(d && (d.name||d.dimension)),
        weight: w,
        score: Math.max(0, Math.min(100, parseInt(d && d.score, 10) || 0)),
        evidence: asStr(d && d.evidence)
      };
    }).filter(function(d){ return d.name; });
    var obj2 = function(v){ return asArr(v).map(function(x){
      if (typeof x==='string') return { item:x.trim(), evidence:'', gap:'', note:'' };
      return { item:asStr(x && (x.item||x.name||x.skill)), evidence:asStr(x && (x.evidence||x.reason)), gap:asStr(x && x.gap), note:asStr(x && (x.note||x.desc)) };
    }).filter(function(o){ return o.item; }); };
    var overall = parseInt(raw.overall_match,10);
    if (isNaN(overall)){
      var wsum=0, acc=0;
      var ws = weights || DEFAULT_WEIGHTS;
      dims.forEach(function(d){
        var w = d.weight; if (!w){ var m = ws.filter(function(x){ return x.name===d.name; })[0]; w = m?m.weight:0; }
        wsum += w; acc += d.score * w;
      });
      overall = wsum ? Math.round(acc/wsum) : 0;
    }
    overall = Math.max(0, Math.min(100, overall));
    return {
      overall_match: overall,
      dimensions: dims,
      satisfied: obj2(raw.satisfied),
      partial: obj2(raw.partial),
      missing: obj2(raw.missing),
      to_confirm: strList(raw.to_confirm),
      strengths: strList(raw.strengths),
      gaps: strList(raw.gaps),
      resume_suggestions: strList(raw.resume_suggestions),
      interview_suggestions: strList(raw.interview_suggestions),
      learning_path: strList(raw.learning_path)
    };
  }

  /* ==========================================================
   * 四、本地启发式匹配兜底（模型不可用/解析失败时）
   * ========================================================== */
  function localMatchFallback(jd, resumeText, parsedResume, weights){
    var text = String(resumeText||'');
    var skills = (parsedResume && Array.isArray(parsedResume.skills)) ? parsedResume.skills : [];
    var allReq = [].concat(strList(jd && jd.required_qualifications), strList(jd && jd.preferred_qualifications));
    var hardSkills = ((jd && jd.professional_skills)||[]).map(function(s){ return s.skill; });
    /* 需求条目拆词匹配：整句没命中时拆出核心词（去掉虚词/通用词）任一命中即视为已体现 */
    var STOP_TOKENS = /^(的|与|及|和|或|等|能力|技能|经验|熟悉|掌握|精通|了解|具备|具有|较强|良好|一定|相关|以上|学历|专业|优先|基础|意识|精神|沟通协作|协调)$/i;
    function reqTokens(t){
      return String(t).split(/[，,、；;\s/／与和及或的]+/).map(function(s){ return s.trim(); })
        .filter(function(s){ return s.length>=2 && !STOP_TOKENS.test(s); });
    }
    function hit(t){
      if (!t) return false;
      var ts = reqTokens(t);
      if (ts.length){
        return ts.some(function(tok){
          try { return new RegExp(String(tok).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(text); }
          catch(e){ return text.indexOf(tok)>=0; }
        });
      }
      try { return new RegExp(String(t).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').slice(0,24),'i').test(text); }
      catch(e){ return text.indexOf(String(t))>=0; }
    }
    var satisfied=[], partial=[], missing=[], toConfirm=[];
    allReq.concat(hardSkills).forEach(function(req){
      if (hit(req)){
        satisfied.push({ item:req, evidence:'简历文本中出现相关表述「' + String(req).slice(0,20) + '」相关内容' });
      } else if (skills.some(function(s){ return req.indexOf(String(s))>=0 || String(s).indexOf(String(req).slice(0,4))>=0; })){
        partial.push({ item:req, evidence:'结构化技能中包含「' + String(req).slice(0,10) + '」相近技能', gap:'简历未展开具体应用场景，建议补充' });
      } else {
        missing.push({ item:req, note:'简历中未体现（未体现≠不具备，可在面试中确认）' });
        toConfirm.push(String(req).slice(0,20));
      }
    });
    var ws = weights || DEFAULT_WEIGHTS;
    var base = { '专业技能匹配':0, '核心岗位职责匹配':0, '项目及实践经验':0, '行业与业务理解':0, '学历及专业背景':0, '通用能力':0 };
    var totalReq = allReq.length + hardSkills.length || 1;
    var cov = (satisfied.length + partial.length*0.5) / totalReq;
    base['专业技能匹配'] = Math.round(40 + cov*55);
    base['核心岗位职责匹配'] = Math.round(45 + cov*45);
    var proj = (parsedResume && Array.isArray(parsedResume.projects)) ? parsedResume.projects.length : (text.match(/项目|实习|经历/g)||[]).length>=2?2:1;
    base['项目及实践经验'] = Math.min(90, 40 + proj*12);
    base['行业与业务理解'] = hit((jd&&jd.industry)) ? 70 : 55;
    base['学历及专业背景'] = hit('本科')||hit('硕士')||hit('大学') ? 70 : 55;
    base['通用能力'] = 65;
    var dimensions = ws.map(function(w){ return { name:w.name, weight:w.weight, score:base[w.name]||60, evidence:'本地启发式评估（基于简历关键词与结构化技能覆盖），建议以 AI 分析为准' }; });
    var overall = Math.round(dimensions.reduce(function(s,d){ return s + d.score*d.weight/100; },0));
    return normalizeMatchResult({
      overall_match: overall,
      dimensions: dimensions,
      satisfied: satisfied,
      partial: partial,
      missing: missing,
      to_confirm: toConfirm.slice(0,6),
      strengths: satisfied.slice(0,3).map(function(s){ return s.item; }),
      gaps: missing.slice(0,3).map(function(m){ return m.item; }),
      resume_suggestions: ['将「' + (missing[0] ? String(missing[0].item).slice(0,14) : '核心技能') + '」相关的项目成果量化补充进简历', '按目标岗位关键词调整技能描述'],
      interview_suggestions: ['针对「' + (missing[0] ? String(missing[0].item).slice(0,14) : '岗位核心要求') + '」准备 STAR 案例', '准备 1 分钟岗位匹配度自我介绍'],
      learning_path: missing.slice(0,3).map(function(m){ return '学习并实践：' + String(m.item).slice(0,20); })
    }, ws);
  }

  /* ==========================================================
   * 五、JD 数据模型与历史记录（localStorage acc_jd_v1）
   * ========================================================== */
  var JD_HISTORY_KEY = 'acc_jd_v1';
  var JD_CORRUPT_KEY = 'acc_jd_v1_corrupt';
  var _memStore = {};   // 非浏览器环境的兜底（测试用）

  function _storeGet(key){
    try { if (typeof localStorage!=='undefined') return localStorage.getItem(key); } catch(e){}
    return (_memStore[key] !== undefined) ? _memStore[key] : null;
  }
  function _storeSet(key, val){
    try { if (typeof localStorage!=='undefined'){ localStorage.setItem(key, val); return { ok:true }; } } catch(e){
      return { ok:false, error:(e && e.name==='QuotaExceededError')?'浏览器存储空间已满，请删除部分旧记录后重试':String(e && e.message || e) };
    }
    _memStore[key]=val; return { ok:true };
  }
  function _storeDel(key){
    try { if (typeof localStorage!=='undefined') localStorage.removeItem(key); } catch(e){}
    delete _memStore[key];
  }

  function loadJDHistory(){
    var raw = _storeGet(JD_HISTORY_KEY);
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) throw new Error('JD 历史记录不是数组');
      return arr;
    } catch(e){
      var bad = _storeGet(JD_HISTORY_KEY);
      if (bad) _storeSet(JD_CORRUPT_KEY, bad);
      _storeDel(JD_HISTORY_KEY);
      return [];
    }
  }
  function saveJDRecord(rec){
    if (!rec) return { ok:false, error:'记录为空' };
    if (!rec.id) rec.id = 'jd_' + Date.now();
    rec.updatedAt = Date.now();
    if (!rec.createdAt) rec.createdAt = rec.updatedAt;
    if (rec.match && rec.match.overall_match!=null) rec.match_score = rec.match.overall_match;
    var list = loadJDHistory();
    var idx = -1;
    for (var i=0;i<list.length;i++) if (list[i].id===rec.id){ idx=i; break; }
    if (idx>=0) list[idx]=rec; else list.unshift(rec);
    if (list.length>50) list = list.slice(0,50);   // 与面试历史同策略：上限 50 条
    var r = _storeSet(JD_HISTORY_KEY, JSON.stringify(list));
    return r.ok ? { ok:true, id:rec.id } : r;
  }
  function deleteJDRecord(id){
    var list = loadJDHistory().filter(function(r){ return r.id!==id; });
    return _storeSet(JD_HISTORY_KEY, JSON.stringify(list));
  }
  function getJDRecord(id){
    var list = loadJDHistory();
    for (var i=0;i<list.length;i++) if (list[i].id===id) return list[i];
    return null;
  }
  /* 组装一条 JD 记录（统一数据模型） */
  function newJDRecord(input){
    input = input || {};
    return {
      id: input.id || ('jd_' + Date.now()),
      version: 1,
      source_type: (input.sourceType==='manual') ? 'manual' : 'industry_reference',
      job_title: input.jobTitle || '',
      industry: input.industry || '',
      job_level: input.level || '',
      raw_text: input.rawText || '',          // manual：JD 原文（不得改写）
      content: input.content || null,         // industry_reference：生成的标准 JD（结构化）
      structured: input.structured || null,   // manual：本地解析结果（职责/技能/学历等）
      match: input.match || null,             // 匹配分析结果
      match_score: (input.match && input.match.overall_match) || null,
      resume_id: input.resumeId || '',
      resume_title: input.resumeTitle || '',
      created_at_label: '',
      createdAt: input.createdAt || Date.now(),
      updatedAt: input.updatedAt || Date.now()
    };
  }
  /* sourceType 中文标签 */
  function sourceLabel(t){ return t==='manual' ? '手动输入' : '行业标准'; }

  /* ==========================================================
   * 六、JD → 纯文本（完整 JD 查看 / 复制）
   * ========================================================== */
  function jdToText(jd){
    if (!jd) return '';
    var L = [];
    L.push('【' + (jd.job_title||'目标岗位') + '】' + (jd.job_level?('（' + jd.job_level + '）'):''));
    if (jd.industry || jd.job_function) L.push('行业/职能：' + [jd.industry, jd.job_function].filter(Boolean).join(' · '));
    if (jd.job_summary) { L.push(''); L.push('【岗位概述】'); L.push(jd.job_summary); }
    if (jd.responsibilities && jd.responsibilities.length){
      L.push(''); L.push('【核心岗位职责】');
      jd.responsibilities.forEach(function(r,i){
        L.push((i+1) + '. ' + r.task + (r.action?('（' + r.action + '）'):'') + (r.outcome?(' → ' + r.outcome):''));
      });
    }
    if (jd.required_qualifications && jd.required_qualifications.length){
      L.push(''); L.push('【任职资格 · 必备条件】');
      jd.required_qualifications.forEach(function(q){ L.push('- ' + q); });
    }
    if (jd.preferred_qualifications && jd.preferred_qualifications.length){
      L.push(''); L.push('【任职资格 · 优先条件】');
      jd.preferred_qualifications.forEach(function(q){ L.push('- ' + q); });
    }
    if (jd.professional_skills && jd.professional_skills.length){
      L.push(''); L.push('【专业技能要求】');
      jd.professional_skills.forEach(function(s){ L.push('- [' + s.level + '] ' + s.skill + '（' + s.category + '）'); });
    }
    if (jd.experience_requirements && jd.experience_requirements.length){
      L.push(''); L.push('【工作经验要求】');
      jd.experience_requirements.forEach(function(q){ L.push('- ' + q); });
    }
    if (jd.kpi_indicators && jd.kpi_indicators.length){
      L.push(''); L.push('【关键绩效指标 KPI（行业参考）】');
      jd.kpi_indicators.forEach(function(k){ L.push('- ' + k.name + (k.note?('：' + k.note):'')); });
    }
    if (jd.work_scenarios && jd.work_scenarios.length){
      L.push(''); L.push('【典型工作场景】');
      jd.work_scenarios.forEach(function(s,i){ L.push((i+1) + '. ' + s); });
    }
    if (jd.career_path && jd.career_path.length){
      L.push(''); L.push('【发展路径】');
      jd.career_path.forEach(function(p){ L.push('- ' + p); });
    }
    if (jd.confidence_notes && jd.confidence_notes.length){
      L.push(''); L.push('【说明】');
      jd.confidence_notes.forEach(function(n){ L.push('- ' + n); });
    }
    return L.join('\n');
  }
  /* 手动 JD（结构化解析结果）→ 纯文本 */
  function manualJDToText(jd){
    if (!jd) return '';
    var L = [];
    L.push('【' + (jd.title||'目标岗位') + '】');
    L.push(''); L.push('【岗位职责】'); (jd.resp||[]).forEach(function(r,i){ L.push((i+1)+'. '+r); });
    L.push(''); L.push('【硬技能要求】'); (jd.hard||[]).forEach(function(h){ L.push('- '+h); });
    L.push(''); L.push('【软技能要求】'); (jd.soft||[]).forEach(function(s){ L.push('- '+s); });
    L.push(''); L.push('【工具要求】'); (jd.tools||[]).forEach(function(t){ L.push('- '+t); });
    L.push(''); L.push('【学历要求】'); L.push(jd.edu||'');
    L.push(''); L.push('【面试重点】'); L.push(jd.focus||'');
    return L.join('\n');
  }

  var API = {
    LEVELS: LEVELS,
    JD_HISTORY_KEY: JD_HISTORY_KEY,
    JD_GEN_SYSTEM_PROMPT: JD_GEN_SYSTEM_PROMPT,
    MATCH_SYSTEM_PROMPT: MATCH_SYSTEM_PROMPT,
    DEFAULT_WEIGHTS: DEFAULT_WEIGHTS,
    TECH_WEIGHTS: TECH_WEIGHTS,
    weightsFor: weightsFor,
    buildJDGenMessages: buildJDGenMessages,
    buildMatchMessages: buildMatchMessages,
    normalizeGeneratedJD: normalizeGeneratedJD,
    normalizeMatchResult: normalizeMatchResult,
    localMatchFallback: localMatchFallback,
    loadJDHistory: loadJDHistory,
    saveJDRecord: saveJDRecord,
    deleteJDRecord: deleteJDRecord,
    getJDRecord: getJDRecord,
    newJDRecord: newJDRecord,
    sourceLabel: sourceLabel,
    jdToText: jdToText,
    manualJDToText: manualJDToText
  };

  root.JDCore = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
