/* ============================================================
   AI Career Copilot · High-Fidelity Interactive Prototype
   Classic-script SPA (opens via file://). No build step.
   ============================================================ */
(function(){
'use strict';

/* ---------------- helpers ---------------- */
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function go(h){location.hash=h;}
function tag(t,cls){return `<span class="tag ${cls||''}">${esc(t)}</span>`;}
function avatar(ch,cls){return `<div class="avatar ${cls||''}">${ch}</div>`;}
function meter(lab,val,color){return `<div class="meter"><span class="lab">${lab}</span><span class="track"><i style="width:${val}%;background:${color||'#18181B'}"></i></span><span class="val">${val}</span></div>`;}

/* SVG 文本宽度估算：Ardot 导入会丢失 text-anchor/dominant-baseline，
   故所有图表文字一律使用默认 start 锚点 + 计算偏移实现居中/右对齐 */
function estW(s,fs){s=String(s);var w=0;for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);w+=((c>=0x2E80&&c<=0x9FFF)||(c>=0xFF00&&c<=0xFFEF))?fs:fs*0.56;}return w;}
/* 居中/右对齐：返回 start 锚点 x；超宽自动缩字号（下限 8px） */
function fitFs(s,fs,maxW){var w=estW(s,fs);return w>maxW?Math.max(8,fs*maxW/w):fs;}
function txC(cx,s,fs,maxW){fs=fitFs(s,fs,maxW||1e4);return [ (cx-estW(s,fs)/2).toFixed(1), fs ];}
function txR(rx,s,fs){return (rx-estW(s,fs)).toFixed(1);}

function toast(msg){
  var t=document.getElementById('toast');
  t.innerHTML=`<div class="toast-card"><span class="ic">✓</span>${esc(msg)}</div>`;
  t.classList.add('show');
  clearTimeout(toast._t);toast._t=setTimeout(function(){t.classList.remove('show');},1900);
}
function modal(title,body,ok){
  var root=document.getElementById('modal-root');
  root.innerHTML=`<div class="modal-mask" onclick="if(event.target===this)closeModal()"><div class="modal"><h3>${esc(title)}</h3><p>${body}</p><div class="flex gap-12 right"><button class="btn btn-primary" onclick="closeModal()">${ok||'好的'}</button></div></div></div>`;
}
function closeModal(){document.getElementById('modal-root').innerHTML='';}

/* ---------------- charts ---------------- */
function radar(scores){
  var dims=['comm','biz','tech','leader','strategy','culture'],N=dims.length,cx=140,cy=128,R=92;
  var ang=function(i){return -Math.PI/2+i*2*Math.PI/N;};
  var pt=function(r,i){return [cx+r*Math.cos(ang(i)),cy+r*Math.sin(ang(i))];};
  var grid='';[0.25,0.5,0.75,1].forEach(function(f){
    var p=dims.map(function(_,i){return pt(R*f,i).map(function(n){return n.toFixed(1);}).join(',');}).join(' ');
    grid+=`<polygon points="${p}" fill="none" stroke="#ECECE8" stroke-width="1"/>`;
  });
  var axes='',labels='';
  dims.forEach(function(d,i){
    var q=pt(R,i);axes+=`<line x1="${cx}" y1="${cy}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="#ECECE8"/>`;
    var t=DB.DIM[d];var l=pt(R+22,i);var tc=txC(l[0],t,10.5,72);
    labels+=`<text x="${tc[0]}" y="${(l[1]+3.5).toFixed(1)}" font-size="${tc[1].toFixed(1)}" fill="#777">${t}</text>`;
  });
  var dp=dims.map(function(d,i){return pt(R*scores[d]/100,i).map(function(n){return n.toFixed(1);}).join(',');}).join(' ');
  var dots=dims.map(function(d,i){var q=pt(R*scores[d]/100,i);return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3" fill="#C8F36A"/>`;}).join('');
  return `<svg viewBox="0 0 280 256" width="100%">${grid}${axes}<polygon points="${dp}" fill="rgba(200,243,106,.18)" stroke="#C8F36A" stroke-width="2"/>${dots}${labels}</svg>`;
}
function donut(segs){
  var total=segs.reduce(function(a,s){return a+s.v;},0),cx=90,cy=90,r=62,sw=22,acc=0,paths='';
  segs.forEach(function(s){
    var f=s.v/total,a0=acc*2*Math.PI-Math.PI/2,a1=(acc+f)*2*Math.PI-Math.PI/2,lg=f>0.5?1:0;
    var x0=cx+r*Math.cos(a0),y0=cy+r*Math.sin(a0),x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1);
    paths+=`<path d="M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${lg} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-linecap="butt"/>`;
    acc+=f;
  });
  return `<span class="ring-wrap"><svg viewBox="0 0 180 180" width="150" height="150"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F0F0EC" stroke-width="${sw}"/>${paths}</svg><span class="ring-center"><b style="font-size:20px">${total}</b><i>份</i></span></span>`;
}
function hbars(rows){
  return rows.map(function(r){return `<div class="meter"><span class="lab">${r.label}</span><span class="track"><i style="width:${r.val}%;background:${r.color||'#18181B'}"></i></span><span class="val">${r.val}</span></div>`;}).join('');
}
function lineChart(vals){
  var W=580,H=160,pad=12,max=Math.max.apply(null,vals)*1.12,n=vals.length;
  var xs=function(i){return pad+i*(W-2*pad)/(n-1);};
  var ys=function(v){return H-pad-v/(max)*(H-2*pad);};
  var pts=vals.map(function(v,i){return xs(i).toFixed(1)+','+ys(v).toFixed(1);}).join(' ');
  var area=pad+','+(H-pad)+' '+pts+' '+(W-pad)+','+(H-pad);
  var grid='';[0.25,0.5,0.75].forEach(function(f){var y=pad+f*(H-2*pad);grid+=`<line x1="${pad}" y1="${y.toFixed(1)}" x2="${W-pad}" y2="${y.toFixed(1)}" stroke="#EFEFEA"/>`;});
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">${grid}<polygon points="${area}" fill="rgba(200,243,106,.10)"/><polyline points="${pts}" fill="none" stroke="#C8F36A" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${xs(n-1).toFixed(1)}" cy="${ys(vals[n-1]).toFixed(1)}" r="4" fill="#C8F36A"/></svg>`;
}
var PAL=['#C8F36A','#7C9A78','#6B8CAE','#9A7BB5','#C9A227','#52525B'];

/* ---------- 统一图表工具库（每个功能模块共用） ---------- */
var MOCK='<span class="mock-tag">MOCK</span> 原型演示数据，非真实统计';
function chartCard(title,inner,sub,note){
  return `<div class="card"><div class="card-title"><span class="dot"></span>${title}</div>`+
    (sub?`<div class="card-sub">${sub}</div>`:'')+
    `<div class="mt-12">${inner}</div>`+
    (note?`<div class="chart-note">${note}</div>`:'')+`</div>`;
}
function legend(items){
  return `<div class="chart-legend">${items.map(function(i){return `<div class="li"><span class="sw" style="background:${i.color}"></span>${esc(i.name)}</div>`;}).join('')}</div>`;
}
/* 垂直柱状图 */
function vBars(rows,opt){
  opt=opt||{};
  var H=opt.h||184,padT=22,padB=30,padL=30,padR=22,n=rows.length;
  var W=opt.w||Math.max(320,padL+padR+n*(opt.step||66)),plotH=H-padT-padB,step=(W-padL-padR)/n;
  var max=opt.max||Math.max.apply(null,rows.map(function(r){return r.val;}))*1.16;
  var bw=Math.min(34,step*0.56),g='';
  [0,0.5,1].forEach(function(f){
    var y=padT+plotH*(1-f);
    g+=`<line class="grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}"/>`+
       `<text class="axis-lab" x="4" y="${(y+3.5).toFixed(1)}">${Math.round(max*f)}</text>`;
  });
  var bars=rows.map(function(r,i){
    var x=padL+step*i+(step-bw)/2,h=plotH*(r.val/max),y=padT+plotH-h,c=r.color||'#18181B';
    var vt=String(r.val)+(opt.unit||''),tc=txC(x+bw/2,vt,10.5,step);
    return `<rect class="anim-y" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="5" fill="${c}"/>`+
      `<text class="bar-val" x="${tc[0]}" y="${(y-6).toFixed(1)}" font-size="${tc[1].toFixed(1)}">${vt}</text>`+
      (function(){var tl=txC(x+bw/2,r.label,10.5,step-2);return `<text class="bar-lab" x="${tl[0]}" y="${(H-padB+16).toFixed(1)}" font-size="${tl[1].toFixed(1)}">${esc(r.label)}</text>`;})();
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${g}${bars}</svg>`;
}
/* 水平条形图（标签 + 数值） */
function hBarsRich(rows,opt){
  opt=opt||{};
  var rowH=28,W=opt.w||480,labW=opt.labW||108,valW=46,padX=4;
  var H=rows.length*rowH+10;
  var asPct=(opt.unit==='%');
  var max=opt.max||(asPct?100:Math.max.apply(null,rows.map(function(r){return r.val;}))*1.05);
  var tx=labW+8,tw=W-labW-8-valW-padX;
  var out=rows.map(function(r,i){
    var y=i*rowH+9,w=tw*(r.val/max),c=r.color||'#18181B';
    var lt=esc(r.label),lf=fitFs(lt,10.5,labW-12),vt=String(r.val)+(opt.unit||'');
    return `<text class="bar-lab" x="6" y="${y+14}" font-size="${lf.toFixed(1)}">${lt}</text>`+
      `<rect x="${tx}" y="${y+3}" width="${tw}" height="12" rx="6" fill="#EEEEEA"/>`+
      `<rect class="anim-x" x="${tx}" y="${y+3}" width="${Math.max(4,w).toFixed(1)}" height="12" rx="6" fill="${c}"/>`+
      `<text class="bar-val" x="${txR(W-padX,vt,10.5)}" y="${y+14}">${vt}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${out}</svg>`;
}
/* 分组柱状图（两组对比） */
function gBars(rows,aLab,bLab,opt){
  opt=opt||{};
  var H=opt.h||200,padT=28,padB=30,padL=32,n=rows.length;
  var W=Math.max(280,n*76),step=(W-padL-12)/n,plotH=H-padT-padB;
  var max=opt.max||Math.max.apply(null,rows.map(function(r){return Math.max(r.a,r.b);}))*1.2;
  var bw=Math.min(15,step*0.28),g='';
  [0,0.5,1].forEach(function(f){
    var y=padT+plotH*(1-f);
    g+=`<line class="grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${W-10}" y2="${y.toFixed(1)}"/>`+
       `<text class="axis-lab" x="4" y="${(y+3).toFixed(1)}">${Math.round(max*f)}</text>`;
  });
  var bars=rows.map(function(r,i){
    var cx=padL+step*i+step/2;
    var ha=plotH*(r.a/max),hb=plotH*(r.b/max);
    var tl=txC(cx,r.label,10.5,step-2);
    return `<rect class="anim-y" x="${(cx-bw-2).toFixed(1)}" y="${(padT+plotH-ha).toFixed(1)}" width="${bw}" height="${ha.toFixed(1)}" rx="4" fill="#C8F36A"/>`+
      `<rect class="anim-y" x="${(cx+2).toFixed(1)}" y="${(padT+plotH-hb).toFixed(1)}" width="${bw}" height="${hb.toFixed(1)}" rx="4" fill="#18181B"/>`+
      `<text class="bar-lab" x="${tl[0]}" y="${(H-padB+16).toFixed(1)}" font-size="${tl[1].toFixed(1)}">${esc(r.label)}</text>`;
  }).join('');
  var lg=`<rect x="${padL}" y="9" width="9" height="9" rx="2" fill="#C8F36A"/><text class="axis-lab" x="${padL+14}" y="17">${esc(aLab)}</text>`+
         `<rect x="${padL+72}" y="9" width="9" height="9" rx="2" fill="#18181B"/><text class="axis-lab" x="${padL+86}" y="17">${esc(bLab)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${g}${bars}${lg}</svg>`;
}
/* 环形指标 */
function ring(pct,opt){
  opt=opt||{};
  var size=opt.size||116,sw=opt.sw||12,r=(size-sw)/2,cx=size/2,cy=size/2,C=2*Math.PI*r;
  var off=C*(1-Math.min(100,pct)/100),c=opt.color||'#C8F36A';
  return `<span class="ring-wrap"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`+
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F0F0EC" stroke-width="${sw}"/>`+
    `<circle ${opt.id?'id="'+opt.id+'" ':''}cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`+
    `</svg><span class="ring-center"><b style="font-size:${(size*0.23).toFixed(0)}px">${pct}${opt.unit||'%'}</b>`+
    (opt.cap?`<i>${esc(opt.cap)}</i>`:'')+`</span></span>`;
}
/* 迷你趋势线 */
function spark(vals,opt){
  opt=opt||{};
  var W=opt.w||130,H=opt.h||36,pad=4,n=vals.length;
  var max=Math.max.apply(null,vals),min=Math.min.apply(null,vals),rng=(max-min)||1;
  var pts=vals.map(function(v,i){return [pad+i*(W-2*pad)/(n-1),H-pad-((v-min)/rng)*(H-2*pad)];});
  var d=pts.map(function(p,i){return (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' ');
  var c=opt.color||'#C8F36A';
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`+
    `<path d="${d} L ${pts[n-1][0].toFixed(1)} ${H-pad} L ${pts[0][0].toFixed(1)} ${H-pad} Z" fill="${c}" opacity=".10"/>`+
    `<path d="${d}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/>`+
    `<circle cx="${pts[n-1][0].toFixed(1)}" cy="${pts[n-1][1].toFixed(1)}" r="2.6" fill="${c}"/></svg>`;
}
/* 多序列趋势图 */
function trendChart(series,opt){
  opt=opt||{};
  var W=opt.w||560,H=opt.h||210,padL=36,padR=14,padT=16,padB=28,n=series.labels.length;
  var all=[];series.items.forEach(function(s){all=all.concat(s.vals);});
  var mx=Math.max.apply(null,all),mn=opt.zero?0:Math.min.apply(null,all)*0.88;
  var max=mx*1.08,plotH=H-padT-padB,plotW=W-padL-padR;
  var X=function(i){return padL+plotW*(n<2?0.5:i/(n-1));};
  var Y=function(v){return padT+plotH*(1-(v-mn)/((max-mn)||1));};
  var g='';
  [0,0.5,1].forEach(function(f){
    var y=padT+plotH*f,v=mn+(max-mn)*(1-f);
    g+=`<line class="grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}"/>`+
       `<text class="axis-lab" x="2" y="${(y+3).toFixed(1)}">${(Math.round(v*10)/10)}</text>`;
  });
  var paths=series.items.map(function(s){
    var d=s.vals.map(function(v,i){return (i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1);}).join(' ');
    var area=(series.items.length===1)?`<path d="${d} L ${X(n-1).toFixed(1)} ${(padT+plotH).toFixed(1)} L ${X(0).toFixed(1)} ${(padT+plotH).toFixed(1)} Z" fill="${s.color}" opacity=".08"/>`:'';
    var dots=s.vals.map(function(v,i){return `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3" fill="${s.color}"/>`;}).join('');
    return area+`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round"/>${dots}`;
  }).join('');
  var labs=series.labels.map(function(l,i){var tl=txC(X(i),l,10,plotW/Math.max(1,n-1)||60);return `<text class="axis-lab" x="${tl[0]}" y="${(H-padB+16).toFixed(1)}" font-size="${tl[1].toFixed(1)}">${esc(l)}</text>`;}).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${g}${paths}${labs}</svg>`;
}
/* 通用雷达图（任意维度数组） */
function radarFrom(rows,opt){
  opt=opt||{};
  var N=rows.length,cx=150,cy=142,R=opt.R||100;
  var ang=function(i){return -Math.PI/2+i*2*Math.PI/N;};
  var pt=function(r,i){return [cx+r*Math.cos(ang(i)),cy+r*Math.sin(ang(i))];};
  var g='';
  [0.25,0.5,0.75,1].forEach(function(f){
    g+=`<polygon points="${rows.map(function(_,i){return pt(R*f,i).map(function(n){return n.toFixed(1);}).join(',');}).join(' ')}" fill="none" stroke="#ECECE8"/>`;
  });
  var ax='',lb='';
  rows.forEach(function(r,i){
    var q=pt(R,i);
    ax+=`<line x1="${cx}" y1="${cy}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="#ECECE8"/>`;
    var l=pt(R+24,i);var tl=txC(l[0],r.label,10,80);
    lb+=`<text class="axis-lab" x="${tl[0]}" y="${(l[1]+3.5).toFixed(1)}" font-size="${tl[1].toFixed(1)}">${esc(r.label)}</text>`;
  });
  var dp=rows.map(function(r,i){return pt(R*r.val/100,i).map(function(n){return n.toFixed(1);}).join(',');}).join(' ');
  var dots=rows.map(function(r,i){var q=pt(R*r.val/100,i);return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3" fill="#C8F36A"/>`;}).join('');
  return `<svg class="chart" viewBox="0 0 300 285" preserveAspectRatio="xMidYMid meet">${g}${ax}<polygon points="${dp}" fill="rgba(200,243,106,.18)" stroke="#C8F36A" stroke-width="2"/>${dots}${lb}</svg>`;
}
/* 环形动画（上传/加载场景） */
function animateRing(id,pct){
  var el=document.getElementById(id);if(!el)return;
  var r=parseFloat(el.getAttribute('r')),C=2*Math.PI*r;
  el.style.transition='stroke-dashoffset .9s cubic-bezier(.2,.7,.3,1)';
  el.setAttribute('stroke-dasharray',C.toFixed(1));
  el.setAttribute('stroke-dashoffset',(C*(1-Math.max(0,Math.min(100,pct))/100)).toFixed(1));
  var t=el.parentNode.querySelector('text');if(t)t.textContent=Math.round(pct)+'%';
}

/* ---------------- layout ---------------- */
/* 对齐 exe 主面板：单一侧边栏 6 项 + 13 Agents 状态 + 开始使用 */
var NAV=[
  {i:'🏠',t:'首页',h:'#/u/dashboard'},
  {i:'📄',t:'简历解析',h:'#/u/upload'},
  {i:'💬',t:'AI 面试',h:'#/u/difficulty'},
  {i:'📊',t:'评分报告',h:'#/u/report',star:true},
  {i:'🧩',t:'Agent 架构',h:'#/a/agents'},
  {i:'📈',t:'数据看板',h:'#/a/dashboard'}
];
function sidebar(hash){
  var cur='#/'+hash;
  var isAdmin=/^a\//.test(hash);
  var links=NAV.map(function(n){
    var on=cur.indexOf(n.h)===0?'active':'';
    var star=n.star?' <span class="nav-star">★</span>':'';
    return `<a class="nav-link ${on}" href="${n.h}"><span class="ico">${n.i}</span>${n.t}${star}</a>`;
  }).join('');
  return `<aside class="sidebar">
    <div class="brand"><div class="logo">🐱</div><div><div class="name">AI Career Copilot</div><div class="sub">${isAdmin?'后台 · 架构视角':'用户 · 求职视角'}</div></div></div>
    <div class="nav-group">${links}</div>
    <div class="sidebar-foot">
      <div class="agents-active"><span class="pulse"></span>13 Agents Active</div>
      <button class="btn btn-primary btn-block" onclick="go('#/u/upload')">开始使用 →</button>
    </div>
  </aside>`;
}

/* ---------- 简历解析 4 步向导（对齐 exe 面板） ---------- */
var RESUME_WIZARD=[
  {n:'①',t:'上传简历',sub:'PDF / 粘贴 / 示例'},
  {n:'②',t:'解析 · 匹配',sub:'Resume Parser + Job Match'},
  {n:'③',t:'JD · 建模',sub:'JD Agent + 能力树'},
  {n:'④',t:'确认 · 权重',sub:'目标岗位 / 动态权重'}
];
function resumeWizard(active){
  var html=RESUME_WIZARD.map(function(s,i){
    var cls=i===active?'on':(i<active?'done':'');
    var sep=i<RESUME_WIZARD.length-1?'<span class="wz-line"></span>':'';
    return `<div class="wz-step ${cls}"><span class="wz-n">${s.n}</span><div class="wz-t">${s.t}</div><div class="wz-s">${s.sub}</div></div>${sep}`;
  }).join('');
  return `<div class="wizard">${html}</div>`;
}

/* ---------- 面试页 AGENT 状态（对齐 exe 侧栏） ---------- */
var AGENT_STATE=[
  {k:'Resume Parser',label:'Resume Parser Agent',st:'done'},
  {k:'Interview',label:'Interview Agent',st:'run'},
  {k:'Follow-up',label:'Follow-up Agent',st:'run'},
  {k:'Score',label:'Score Agent',st:'wait'},
  {k:'Summary',label:'Summary Agent',st:'wait'}
];
function setAgentDone(k){var a=AGENT_STATE.filter(function(x){return x.k===k;});a.forEach(function(x){x.st='done';});}
function agentStateHtml(){
  return AGENT_STATE.map(function(a){
    var st=a.st==='done'?'✓ 完成':(a.st==='run'?'● 运行中':'○ 待命');
    var tag=a.st==='done'?'tag-green':(a.st==='run'?'tag-blue':'tag-gray');
    return `<div class="agent-row sm"><span class="status-dot ${a.st}"></span>
      <div class="main"><div class="ttl" style="font-size:13px">${esc(a.label)}</div></div>
      <span class="tag ${tag}" style="font-size:11px">${st}</span></div>`;
  }).join('');
}

/* ============================================================
   PAGE RENDERERS
   ============================================================ */
var PAGES={};

/* ---------- U01 Dashboard ---------- */
PAGES['u/dashboard']={title:'我的求职空间',crumb:'首页 · 工作台',render:function(){
  var p=DB.profile;
  return `<div class="page-head"><div class="eyebrow">MY CAREER SPACE</div><h2>准备好开始下一次面试了吗？</h2>
    <p>你当前处于「求职 → 面试 → 成长」的循环中。先看看这一程的进度。</p></div>
    <div class="flex gap-8 mt-16" style="flex-wrap:wrap">
      <span class="tag tag-soft">📄 Resume Aware</span>
      <span class="tag tag-soft">🧠 Multi Agent</span>
      <span class="tag tag-soft">13 Agents 在线</span>
    </div>
    <div class="grid cols-4">
      ${card('目标岗位',`<div class="stat"><div class="k">正在准备</div><div class="v" style="font-size:20px">${esc(p.target)}</div><div class="d">简历已完成</div></div>`)}
      ${card('最近一次面试',`<div class="stat"><div class="v">${p.lastScore}<small> / 100</small></div><div class="d">较上次 +6</div></div>`)}
      ${card('能力成长',`<div class="stat"><div class="v" style="color:var(--green)">+${p.growth}%</div><div class="d">近 30 天</div></div>`)}
      ${card('简历状态',`<div class="stat"><div class="v" style="font-size:20px">✓ 已解析</div><div class="d">${esc(DB.resume.file)}</div></div>`)}
    </div>
    <div class="grid cols-3 mt-20">
      ${chartCard('综合得分趋势',
        trendChart({labels:DB.charts.scoreTrend.labels,items:[{name:'综合得分',vals:DB.charts.scoreTrend.vals,color:'#C8F36A'}]}),
        '近 5 次面试 · 逐次提升', MOCK)}
      ${chartCard('简历结构完整度',
        `<div class="ring-row">${ring(88,{size:104,color:'#7C9A78',cap:'完整度'})}<div class="ring-meta">${hBarsRich(DB.charts.resumeSections,{w:236,labW:62,valW:36,unit:'%'})}</div></div>`,
        'Resume Parser 对各模块的解析覆盖度', MOCK)}
      ${chartCard('近 8 周活跃度',
        vBars(DB.charts.activity.map(function(v,i){return {label:'W'+(i+1),val:v};}),{h:168}),
        '每周完成的面试 / 练习次数', MOCK)}
    </div>
    <div class="grid cols-2 mt-20">
      <div class="card">
        <div class="card-title"><span class="dot"></span>最近面试</div>
        <div class="mt-12">${DB.history.map(function(h){return `<div class="row"><div class="avatar sm">📝</div><div class="main"><div class="ttl">${h.diff}难度 · ${h.score}分</div><div class="meta">${h.date} · 薄弱项：${h.weak}</div></div><span class="tag tag-green">${h.trend}</span></div>`;}).join('')}</div>
        <div class="mt-16 flex gap-12"><button class="btn btn-primary" onclick="go('#/u/difficulty')">继续面试</button><button class="btn btn-secondary" onclick="go('#/u/report')">查看报告</button></div>
      </div>
      <div class="card">
        <div class="card-title"><span class="dot"></span>下一步建议</div>
        <div class="mt-12">
          <div class="note-line mb-12">你的数据指标表达偏弱，建议先补「数据分析」能力再进入挑战难度。</div>
          ${meter('简历解析',100)} ${meter('岗位匹配',92)} ${meter('能力模型',80)} ${meter('面试完成',68)}
          <div class="mt-16"><button class="btn btn-pink btn-sm" onclick="go('#/u/growth')">查看成长计划 →</button></div>
        </div>
      </div>
    </div>`;
}};

/* ---------- U02 Upload ---------- */
PAGES['u/upload']={title:'上传你的简历',crumb:'首页 · 上传简历',render:function(){
  return `<div class="page-head"><div class="eyebrow">STEP 1 / 简历录入</div><h2>先让我们认识你</h2>
    <p>上传你的简历，我们会从你的经历中提取能力与优势，并为你匹配岗位。</p></div>
    <div class="mt-8">${resumeWizard(0)}</div>
    <div class="split">
      <div>
        <div class="upload-zone" id="uz" ondragover="event.preventDefault();this.classList.add('drag')" ondragleave="this.classList.remove('drag')" ondrop="event.preventDefault();this.classList.remove('drag');uploadResume()">
          <div class="upload-ill">📄</div>
          <h3>拖拽简历到此处</h3>
          <p>支持 PDF / DOC / DOCX / TXT · 单文件 ≤ 10MB</p>
          <div class="mt-16 flex gap-12">
            <button class="btn btn-primary" onclick="uploadResume()">上传简历</button>
            <button class="btn btn-ghost btn-sm" onclick="uploadResume()">使用示例简历</button>
          </div>
          <div class="muted small mt-12">🐱 小提示：识别过程不会离开你的设备原型</div>
        </div>
        <div class="card mt-16" id="filecard" style="display:none">
          <div class="row" style="border:none"><div class="avatar">📄</div><div class="main"><div class="ttl" id="fname">${esc(DB.resume.file)}</div><div class="meta" id="fmeta">${DB.resume.size} · <span id="fstatus">解析中…</span></div></div><span class="tag tag-blue" id="ftag">处理中</span></div>
          <div class="mt-16 ring-row">
            ${ring(0,{id:'upRing',size:100,cap:'解析进度'})}
            <div class="ring-meta" id="upStages">${hBarsRich(UP_STAGES,{w:250,labW:66,valW:36,unit:'%',max:100})}</div>
          </div>
          <div class="chart-note">${MOCK} · 各阶段进度为动画演示</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="dot"></span>为什么从这里开始</div>
        <div class="mt-12 muted" style="line-height:1.8">简历是整个系统的起点：<br>• <b>Resume Parser Agent</b> 抽取教育与项目经历<br>• 自动生成能力画像，驱动岗位推荐<br>• 后续面试问题均来自你的真实经历<br><br>上传后无需手动填表，我们帮你理解。</div>
        <div class="divider"></div>
        <div class="section-note">🔒 原型演示 · 文件不会真实上传</div>
      </div>
    </div>`;
}};
var UP_STAGES=[{label:'文本抽取',val:0},{label:'结构识别',val:0},{label:'能力抽取',val:0},{label:'画像生成',val:0}];
var UP_TARGET=[100,94,88,82];
function drawUpStages(){document.getElementById('upStages').innerHTML=hBarsRich(UP_STAGES,{w:250,labW:66,valW:36,unit:'%',max:100});}
function uploadResume(){
  document.getElementById('filecard').style.display='block';
  var st=document.getElementById('fstatus'),tg=document.getElementById('ftag');
  st.textContent='解析中…';tg.textContent='处理中';tg.className='tag tag-blue';
  UP_STAGES.forEach(function(s){s.val=0;});drawUpStages();animateRing('upRing',0);
  var i=0;
  (function step(){
    if(i>=UP_STAGES.length){
      st.textContent='已解析';tg.textContent='完成';tg.className='tag tag-green';
      animateRing('upRing',100);
      toast('简历解析完成，已生成能力画像');return;
    }
    UP_STAGES[i].val=UP_TARGET[i];drawUpStages();animateRing('upRing',(i+1)*25);
    i++;setTimeout(step,330);
  })();
}

/* ---------- U03 Resume ---------- */
PAGES['u/resume']={title:'简历分析',crumb:'上传 · 解析结果',render:function(){
  var r=DB.resume;
  return `<div class="page-head"><div class="eyebrow">STEP 2 / 简历理解</div><h2>正在了解你的经历</h2>
    <p>系统从简历中识别到以下能力与经历标签。</p></div>
    <div class="mt-8">${resumeWizard(1)}</div>
    <div class="split">
      <div class="card">
        <div class="card-title"><span class="dot"></span>简历预览</div>
        <div class="mt-12">
          <div class="row" style="border:none"><div class="avatar lg">🐱</div><div class="main"><div class="ttl">${esc(r.basic.name)}</div><div class="meta">${esc(r.basic.edu)} · ${r.basic.years}经验 · ${esc(r.basic.field)}</div></div></div>
          <div class="kv"><span class="k">教育背景</span><span class="v">${esc(r.education[0].school)}</span></div>
          <div class="kv"><span class="k">项目经历</span><span class="v">${r.projects.length} 个</span></div>
          <div class="kv"><span class="k">实习经历</span><span class="v">${esc(r.interns[0].co)}</span></div>
          <div class="kv"><span class="k">技能</span><span class="v">${r.skills.length} 项</span></div>
          <div class="mt-12 flex wrap gap-8">${r.skills.map(function(s){return tag(s,'tag-soft');}).join('')}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="dot"></span>能力画像</div>
        <div class="mt-12">${r.ability.map(function(a){var c=a.v>=80?'var(--green)':(a.v>=74?'var(--ink)':'var(--pink)');return meter(a.k,a.v,c);}).join('')}</div>
        <div class="divider"></div>
        <div class="section-note">🤖 AI 识别自简历原文（原型示意）</div>
        <div class="mt-16"><button class="btn btn-primary" onclick="go('#/u/jobs')">查看岗位推荐 →</button></div>
      </div>
    </div>
    <div class="grid cols-2 mt-20">
      ${chartCard('简历模块完整度', hBarsRich(DB.charts.resumeSections,{unit:'%'}), 'Resume Parser 对各模块的识别置信度', MOCK)}
      ${chartCard('能力结构分布', vBars(DB.charts.skillDist.map(function(x,i){return {label:x[0],val:x[1],color:PAL[i]};}),{unit:'%'}), '按简历技能标签聚类后的能力占比', MOCK)}
    </div>`;
}};

/* ---------- U04 Jobs ---------- */
function shortJob(n){return n.replace('产品经理','PM').replace('工程师','').replace('开发','').replace('分析师','分析').slice(0,6);}
PAGES['u/jobs']={title:'岗位推荐',crumb:'解析 · 岗位匹配',render:function(){
  var jobs=DB.jobs;
  var cards=jobs.map(function(j,i){
    var c=j.score>=85?'var(--green)':(j.score>=75?'var(--ink)':'var(--ink-3)');
    return `<div class="card hov" style="cursor:pointer" onclick="selectJob('${esc(j.name)}')">
      <div class="between"><div class="ttl" style="font-size:15px;font-weight:700">${esc(j.name)}</div><div style="font-size:22px;font-weight:700;color:${c}">${j.score}<span style="font-size:12px;color:var(--ink-3)">%</span></div></div>
      <div class="muted small mt-8">${esc(j.reason)}</div>
      <div class="mt-12 flex wrap gap-8">${j.skills.map(function(s){return tag(s,'tag-soft');}).join('')}</div>
      <div class="mt-12 small" style="color:var(--pink-ink)">⚠ 差距：${esc(j.gap)}</div>
      <div class="mt-8 small muted">路径：${esc(j.path)}</div>
    </div>`;
  }).join('');
  var bins=[{label:'≥90',val:0},{label:'85-89',val:0},{label:'80-84',val:0},{label:'75-79',val:0},{label:'<75',val:0}];
  DB.jobs.forEach(function(j){
    if(j.score>=90)bins[0].val++;else if(j.score>=85)bins[1].val++;
    else if(j.score>=80)bins[2].val++;else if(j.score>=75)bins[3].val++;else bins[4].val++;
  });
  return `<div class="page-head"><div class="eyebrow">STEP 3 / 岗位匹配</div><h2>这些方向与你比较匹配</h2>
    <p>Job Match Agent 基于「简历能力 + 岗位要求」向量匹配，推荐 11 个适配职位。选择目标岗位以继续。</p></div>
    <div class="mt-8">${resumeWizard(1)}</div>
    <div class="grid cols-2">
      ${chartCard('Top 8 岗位匹配度',
        vBars(DB.jobs.slice(0,8).map(function(j){
          return {label:shortJob(j.name),val:j.score,color:j.score>=85?'#7C9A78':(j.score>=75?'#18181B':'#C8F36A')};
        }),{unit:'%'}),
        'Job Match Agent 输出的匹配得分（11 个岗位取前 8）', MOCK)}
      ${chartCard('匹配度区间分布', vBars(bins,{unit:' 个',h:168}), '全部 11 个推荐岗位落在各分数段的个数', MOCK)}
    </div>
    <div class="grid cols-3 mt-20">${cards}</div>
    <div class="mt-20 center"><button class="btn btn-primary" id="toJd" disabled onclick="go('#/u/jd')">选择目标岗位以继续 →</button></div>`;
}};
function selectJob(name){
  DB.selectedJob=name;
  document.querySelectorAll('.card.hov').forEach(function(c){c.style.outline='';});
  event.currentTarget.style.outline='2px solid var(--pink)';
  document.getElementById('toJd').disabled=false;
  toast('已选择：'+name);
}

/* ---------- U05 JD ---------- */
PAGES['u/jd']={title:'JD 分析',crumb:'岗位 · JD 解析',render:function(){
  var job=DB.selectedJob||'AI 产品经理';var j=DB.jd[job]||DB.jdFallback;
  var kwv=DB.charts.jdKwWeight[job]||DB.charts.jdKwWeightFallback;
  return `<div class="page-head"><div class="eyebrow">STEP 4 / JD 理解</div><h2>把你真正想申请的岗位告诉我</h2>
    <p>可粘贴目标 JD，或使用推荐岗位「${esc(job)}」的示例 JD。</p></div>
    <div class="mt-8">${resumeWizard(2)}</div>
    <div class="split">
      <div class="card">
        <label class="field">粘贴岗位 JD</label>
        <textarea class="input" placeholder="在此粘贴招聘信息文本…">${esc(job)} · ${esc(j.resp[0])}；要求 ${j.hard.join('、')}。">${j.kw.map(function(k){return tag(k,'tag-pink');}).join('')}</textarea>
        <div class="mt-12"><button class="btn btn-secondary btn-sm" onclick="toast('已分析 JD（原型）')">分析 JD</button></div>
      </div>
      <div class="card">
        <div class="card-title"><span class="dot"></span>JD 解析结果 · ${esc(job)}</div>
        <div class="mt-12 grid cols-2" style="gap:14px">
          <div><div class="small muted mb-8">岗位职责</div>${j.resp.map(function(x){return `<div class="row" style="padding:6px 0;border:none">• ${esc(x)}</div>`;}).join('')}</div>
          <div><div class="small muted mb-8">硬技能 / 软技能</div>${j.hard.map(function(x){return tag(x,'tag-blue');}).join(' ')}<br><br>${j.soft.map(function(x){return tag(x,'tag-soft');}).join(' ')}</div>
        </div>
        <div class="kv mt-8"><span class="k">工具要求</span><span class="v">${j.tools.join('、')}</span></div>
        <div class="kv"><span class="k">经验要求</span><span class="v">${esc(j.edu)}</span></div>
        <div class="kv"><span class="k">面试重点</span><span class="v">${esc(j.focus)}</span></div>
        <div class="divider"></div>
        <div class="section-note">🔑 关键词将连接到「能力模型」</div>
        <div class="mt-16"><button class="btn btn-primary" onclick="go('#/u/competency')">确认 JD →</button></div>
      </div>
    </div>
    <div class="grid cols-2 mt-20">
      ${chartCard('JD 关键词权重',
        vBars(j.kw.map(function(k,i){return {label:k,val:(kwv[i]!==undefined?kwv[i]:14)};})),
        '权重 = JD 文本频次 × 岗位类型系数', MOCK)}
      ${chartCard('简历关键词命中率',
        hBarsRich(j.kw.map(function(k,i){return {label:k,val:(DB.charts.jdHit[i]!==undefined?DB.charts.jdHit[i]:58)};}),{unit:'%'}),
        '你的简历对各关键词的覆盖程度', MOCK)}
    </div>`;
}};

/* ---------- U06 Competency ---------- */
PAGES['u/competency']={title:'能力模型',crumb:'JD · 能力模型',render:function(){
  var job=DB.selectedJob||'AI 产品经理';var tree=DB.competency[job]||DB.competencyFallback;
  var keys=Object.keys(tree);
  var left=keys.map(function(k,i){return `<div class="card card-pad-sm hov" style="cursor:pointer;margin-bottom:10px" onclick="showComp('${esc(k)}')"><div class="between"><b>${esc(k)}</b><span class="muted">${tree[k].length} 项 ▾</span></div></div>`;}).join('');
  var detail=keys.map(function(k){return `<div id="comp-${CSSesc(k)}" style="display:${k===keys[0]?'block':'none'}"><div class="small muted mb-8">${esc(k)} · 二级能力</div>${tree[k].map(function(s){return `<span class="tag tag-soft" style="margin:0 6px 6px 0">${esc(s)}</span>`;}).join('')}</div>`;}).join('');
  var w=DB.weights[DB.jobType(job)].weights;
  var bars=Object.keys(w).map(function(d){return meter(DB.DIM[d],w[d],'var(--pink)');}).join('');
  return `<div class="page-head"><div class="eyebrow">STEP 5 / 能力模型</div><h2>这场面试，会从哪些能力判断你？</h2>
    <p>根据简历 + JD 建立岗位能力模型。「${esc(job)}」的重点能力已用权重标出。</p></div>
    <div class="mt-8">${resumeWizard(2)}</div>
    <div class="split">
      <div>${left}<div class="mt-12">${detail}</div></div>
      <div class="card"><div class="card-title"><span class="dot"></span>本岗位重点能力（权重）</div><div class="mt-12">${bars}</div><div class="divider"></div><div class="section-note">权重随岗位类型动态变化</div><div class="mt-16"><button class="btn btn-primary" onclick="go('#/u/target')">下一步 →</button></div></div>
    </div>
    <div class="grid cols-2 mt-20">
      ${chartCard('你的水平 vs 岗位要求',
        gBars(DB.charts.targetFit.map(function(t){return {label:t.k,a:t.you,b:t.req};}),'你的水平','岗位要求'),
        '差值即为本次面试的重点考察方向', MOCK)}
      ${chartCard('当前能力雷达',
        radarFrom(DB.resume.ability.map(function(a){return {label:a.k,val:a.v};})),
        '来自 Resume Parser 的能力画像', MOCK)}
    </div>`;
}};
function CSSesc(s){return s.replace(/[^a-zA-Z0-9_-]/g,'_');}
function showComp(k){var tree=DB.competency[DB.selectedJob]||DB.competencyFallback;Object.keys(tree).forEach(function(x){var el=document.getElementById('comp-'+CSSesc(x));if(el)el.style.display=(x===k?'block':'none');});}

/* ---------- U07 Target ---------- */
PAGES['u/target']={title:'目标岗位确认',crumb:'能力模型 · 确认',render:function(){
  var job=DB.selectedJob||'AI 产品经理';var j=DB.jd[job]||DB.jdFallback;
  var _j=DB.jobs.filter(function(x){return x.name===job;})[0];var fit=_j?_j.score:88;
  return `<div class="page-head"><div class="eyebrow">STEP 6 / 目标确认</div><h2>你准备挑战哪个岗位？</h2></div>
    <div class="mt-8">${resumeWizard(3)}</div>
    <div class="grid cols-2">
      <div class="card">
        <div class="between"><div class="ttl" style="font-size:18px;font-weight:700">${esc(job)}</div>${tag('已选择','tag-green')}</div>
        <div class="kv mt-8"><span class="k">JD 摘要</span><span class="v">${esc(j.focus)}</span></div>
        <div class="kv"><span class="k">核心能力</span><span class="v">${j.hard.slice(0,3).join('、')}</span></div>
        <div class="kv"><span class="k">当前匹配度</span><span class="v" style="color:var(--green)">${fit}%</span></div>
      </div>
      <div class="card"><div class="card-title"><span class="dot"></span>为什么需要确认</div><div class="muted mt-8" style="line-height:1.9">进入面试前，系统需要明确：<br>• 本次面试针对<b>哪个岗位</b><br>• 使用<b>哪套能力模型</b><br>• 采用<b>哪组评分权重</b><br><br>确认后不可在面试中切换。</div></div>
    </div>
    <div class="grid cols-2 mt-20">
      ${chartCard('岗位契合度拆解',
        gBars(DB.charts.targetFit.map(function(t){return {label:t.k,a:t.you,b:t.req};}),'你的水平','岗位要求'),
        '整体契合度 '+fit+'%', MOCK)}
      ${chartCard('匹配度总览',
        `<div class="ring-row">${ring(fit,{size:120,color:'#7C9A78',cap:'匹配度'})}<div class="ring-meta">${hBarsRich(DB.charts.targetFit.map(function(t){return {label:t.k,val:t.you};}),{w:250,labW:66,valW:36,unit:'%'})}</div></div>`,
        '各能力项当前得分', MOCK)}
    </div>
    <div class="mt-20 flex gap-12"><button class="btn btn-primary" onclick="go('#/u/weight')">确认目标岗位 →</button><button class="btn btn-ghost" onclick="go('#/u/jobs')">重新选择</button></div>`;
}};

/* ---------- U08 Weight (dynamic) ---------- */
PAGES['u/weight']={title:'动态评分权重',crumb:'目标岗位 · 评分权重',render:function(){
  var job=DB.selectedJob||'AI 产品经理';var type=DB.jobType(job);
  var opts=Object.keys(DB.weights).map(function(k){return `<button class="${k===type?'on':''}" onclick="switchWeight('${k}')">${DB.weights[k].icon} ${DB.weights[k].name}</button>`;}).join('');
  var w=DB.weights[type].weights;
  var bars=Object.keys(w).map(function(d){return meter(DB.DIM[d],w[d],'var(--pink)');}).join('');
  return `<div class="page-head"><div class="eyebrow">STEP 7 / 动态权重</div><h2>本次面试评分将根据岗位类型动态调整</h2>
    <p>评分标准不是固定的——它会随目标岗位的类型与 JD 要求自动变化。</p></div>
    <div class="mt-8">${resumeWizard(3)}</div>
    <div class="grid cols-2">
      <div class="card">
        <div class="card-title"><span class="dot"></span>岗位类型</div>
        <div class="mt-12"><div class="tabs" id="wtabs">${opts}</div></div>
        <div class="mt-16" id="wbars">${bars}</div>
        <div class="mt-16" id="wchart">${vBars(Object.keys(w).map(function(d){return {label:DB.DIM[d],val:w[d]};}),{unit:'%'})}</div>
        <div class="chart-note">${MOCK} · 切换岗位类型可看到权重重排</div>
        <div class="divider"></div>
        <div class="note-line">评分权重会根据岗位类型与 JD 要求自动调整。当前岗位：<b>${esc(job)}</b></div>
      </div>
      <div class="card"><div class="card-title"><span class="dot"></span>产品逻辑</div>
        <div class="muted mt-8" style="line-height:1.9">传统面试对所有候选人用同一把尺子。<br>这里：<br>• AI PM → 重「商业洞察 / 战略思维」<br>• 数据岗 → 重「技术深度 / 策略思维」<br>• 技术岗 → 重「技术深度」至 35%<br><br>让评分更贴合岗位真实要求。</div>
        <div class="mt-16"><button class="btn btn-primary" onclick="go('#/u/difficulty')">继续：选择难度 →</button></div>
      </div>
    </div>`;
}};
function switchWeight(k){
  var btns=document.querySelectorAll('#wtabs button');
  btns.forEach(function(b){b.classList.remove('on');});
  var btn=(window.event&&window.event.currentTarget)||btns[0];
  if(btn)btn.classList.add('on');
  var w=DB.weights[k].weights;
  var html=Object.keys(w).map(function(d){return meter(DB.DIM[d],w[d],'var(--pink)');}).join('');
  var box=document.getElementById('wbars');box.innerHTML=html;
  box.querySelectorAll('.track>i').forEach(function(i){var w=i.style.width;i.style.width='0%';setTimeout(function(){i.style.width=w;},30);});
  document.getElementById('wchart').innerHTML=vBars(Object.keys(w).map(function(d){return {label:DB.DIM[d],val:w[d]};}),{unit:'%'});
  toast('已切换至：'+DB.weights[k].name);
}

/* ---------- U09 Difficulty ---------- */
PAGES['u/difficulty']={title:'面试难度',crumb:'权重 · 难度',render:function(){
  var opts=[
    {k:'校招',name:'校招',d:'基础能力',x:'适合应届生',icon:'🌱'},
    {k:'普通社招',name:'普通社招',d:'完整面试',x:'覆盖核心能力',icon:'💼',on:1},
    {k:'大厂',name:'大厂',d:'高标准',x:'深度业务考察',icon:'🏢'},
    {k:'BAT',name:'字节腾讯阿里美团',d:'顶级考核',x:'极限追问',icon:'🔥'},
    {k:'Leader',name:'Leader',d:'管理岗',x:'潜力 / Owner 意识',icon:'👑'}
  ];
  var cards=opts.map(function(o){return `<div class="card hov" style="cursor:pointer;text-align:center;padding:22px" data-k="${o.k}" onclick="pickDiff(this)">
    <div style="font-size:30px">${o.icon}</div>
    <div class="ttl mt-8" style="font-weight:700;font-size:15px">${o.name}</div>
    <div class="muted small mt-4">${o.d}</div>
    <div class="small mt-8" style="color:var(--ink-2)">${o.x}</div></div>`;}).join('');
  return `<div class="page-head"><div class="eyebrow">STEP 8 / 面试难度</div><h2>选择适合你的面试难度</h2>
    <p>对齐真实考核梯度：从校招到字节 / 腾讯 / 阿里 / 美团专项，再到 Leader 管理岗。</p></div>
    <div class="grid cols-5">${cards}</div>
    <div class="grid cols-3 mt-20">
      ${chartCard('题目数量',
        vBars(DB.charts.diffMeta.map(function(d){return {label:d.k,val:d.q};}),{unit:' 题',h:170}),
        '本场面试的问题总数', MOCK)}
      ${chartCard('追问触发率',
        vBars(DB.charts.diffMeta.map(function(d){return {label:d.k,val:d.fu};}),{unit:'%',h:170}),
        'Follow-up Agent 触发追问的比例', MOCK)}
      ${chartCard('项目挖掘深度',
        vBars(DB.charts.diffMeta.map(function(d){return {label:d.k,val:d.depth};}),{h:170}),
        '对简历项目的追问层数（指数化）', MOCK)}
    </div>
    <div class="mt-20 center"><button class="btn btn-primary" id="startIv" disabled onclick="go('#/u/interview')">开始面试 →</button></div>`;
}};
function pickDiff(el){
  document.querySelectorAll('[data-k]').forEach(function(c){c.style.outline='';});
  el.style.outline='2px solid var(--pink)';
  document.getElementById('startIv').disabled=false;
  DB.diff=el.getAttribute('data-k');toast('难度：'+DB.diff);
}

/* ---------- U10 Interview ---------- */
PAGES['u/interview']={title:'AI 面试',crumb:'难度 · 面试中',render:function(){
  var steps=['简历了解','项目经历','岗位能力','情景问题','综合追问'];
  var stepHtml=steps.map(function(s,i){return `<div class="flow-step ${i===0?'on':''}" data-i="${i}"><span class="badge-step">${i+1}</span>${s}</div>`;}).join('');
  var q=DB.questions[0];
  return `<div class="page-head"><div class="eyebrow">STEP 9 / 在线面试</div><h2>正式 AI 面试</h2>
    <p>像真实的线上面试系统，而不是聊天机器人。</p></div>
    <div class="grid" style="grid-template-columns:200px 1fr 220px;gap:20px;align-items:start">
      <div class="card card-pad-sm"><div class="card-title"><span class="dot"></span>面试进度</div><div class="mt-12" id="steps">${stepHtml}</div>
        <div class="divider"></div><div class="small muted">Round <b id="round">1</b> / 5</div></div>
      <div class="card">
        <div class="between mb-12"><div class="flex items-center gap-12"><div class="avatar blue">🧑‍💼</div><div><div class="ttl" style="font-weight:700">面试官 · Mike</div><div class="meta small">业务经理</div></div></div><span class="tag tag-gray">录制中</span></div>
        <div class="chat" id="chat"><div class="bubble q"><span class="who">面试官</span>${esc(q.q)}</div></div>
        <div class="mt-12 flex gap-8"><input class="input" id="ans" placeholder="输入你的回答…"/><button class="btn btn-primary" onclick="submitAns()">发送</button></div>
      </div>
      <div class="card card-pad-sm"><div class="card-title"><span class="dot"></span>AGENT 状态</div>
        <div class="mt-12" id="agentState">${agentStateHtml()}</div></div>
      <div class="card card-pad-sm mt-16"><div class="card-title"><span class="dot"></span>实时观察</div>
        <div class="mt-12">${LIVE.map(function(x){return meter(x.t,x.v,'var(--ink-3)');}).join('')}</div>
        <div class="divider"></div>
        <div class="small muted mb-8">本轮表现趋势</div>
        <div>${spark(DB.charts.livePerf,{w:186,h:44})}</div>
        <div class="ring-row mt-12">${ring(20,{id:'ivRing',size:78,sw:9,cap:'完成度'})}<div class="ring-meta small muted">已完成 <b id="ivDone">1</b> / 5 轮<br>预计剩余 6 分钟</div></div>
        <div class="divider"></div><div class="note-line" style="font-size:11px">仅作为过程参考，不代表最终评分</div></div>
    </div>`;
}};
var LIVE=[{t:'逻辑表达',v:78},{t:'项目深度',v:72},{t:'岗位匹配',v:81},{t:'沟通能力',v:85}];
var ivIdx=0;
function submitAns(){
  var inp=document.getElementById('ans');var v=inp.value.trim();if(!v){toast('请先输入回答');return;}
  var chat=document.getElementById('chat');
  chat.innerHTML+=`<div class="bubble a"><span class="who">你</span>${esc(v)}</div>`;
  inp.value='';
  var q=DB.questions[ivIdx];
  var iv=DB.interviewers.find(function(x){return x.id===q.iv;});
  setTimeout(function(){
    var fu='为什么问这个？ '+['项目经历','岗位要求','当前回答'].join(' + ')+' → 触发追问';
    chat.innerHTML+=`<div class="bubble q"><span class="who">${iv.name} · 追问</span>${esc('能否具体讲讲你当时是如何确定核心需求的？')}</div><div class="small muted mt-8" style="margin-left:4px">${fu}</div>`;
    chat.scrollTop=chat.scrollHeight;
    ivIdx++;
    if(ivIdx<DB.questions.length){
      document.querySelectorAll('.flow-step').forEach(function(s){s.classList.remove('on');});
      var st=document.querySelector('.flow-step[data-i="'+ivIdx+'"]');if(st)st.classList.add('on');
      document.getElementById('round').textContent=ivIdx+1;
      var dn=document.getElementById('ivDone');if(dn)dn.textContent=Math.min(5,ivIdx+1);
      animateRing('ivRing',Math.min(100,(ivIdx+1)/5*100));
      chat.innerHTML+=`<div class="bubble q mt-8"><span class="who">面试官</span>${esc(DB.questions[ivIdx].q)}</div>`;
    } else {
      chat.innerHTML+=`<div class="bubble q mt-8"><span class="who">系统</span>面试已完成，正在进入综合评估…</div>`;
      animateRing('ivRing',100);var dn2=document.getElementById('ivDone');if(dn2)dn2.textContent=5;
      setAgentDone('Score');setAgentDone('Summary');setAgentDone('Interview');setAgentDone('Follow-up');
      var ags=document.getElementById('agentState');if(ags)ags.innerHTML=agentStateHtml();
      setTimeout(function(){go('#/u/multiagent');},900);
    }
    chat.scrollTop=chat.scrollHeight;
  },500);
}

/* ---------- U10b Follow-up（动态追问，对齐低保真帧11） ---------- */
PAGES['u/followup']={title:'动态追问',crumb:'面试 · 追问',render:function(){
  return `<div class="page-head"><div class="eyebrow">STEP 9b / 动态追问</div><h2>AI 动态追问</h2>
    <p>追问不是随机的，而是基于「项目经历 + 岗位要求 + 当前回答」的共同上下文触发，用于强化薄弱维度的证据采集。</p></div>
    <div class="grid cols-2" style="align-items:start">
      <div class="card"><div class="card-title"><span class="dot"></span>面试对话</div>
        <div class="chat mt-12">
          <div class="bubble q"><span class="who">面试官 · Mike</span>请介绍一个你参与过的 AI 产品项目，以及你承担的工作。</div>
          <div class="bubble a"><span class="who">你</span>我负责该项目的产品设计，从 0 到 1 搭建对话框架，上线后留存提升 18%。</div>
          <div class="bubble q"><span class="who">Follow-up Agent · 追问</span>你刚才提到负责产品设计——当时是如何确定核心需求的？是否用数据验证过这个判断？</div>
        </div>
        <div class="mt-16 flex gap-8"><input class="input" placeholder="继续回答…"/><button class="btn btn-primary" onclick="toast('已记录回答')">发送</button></div>
      </div>
      <div class="card"><div class="card-title"><span class="dot"></span>为什么问这个问题？</div>
        <div class="mt-12 muted" style="line-height:1.9">追问由三方上下文共同触发：<br>• <b>项目经历</b>：命中「0→1 产品设计」<br>• <b>岗位要求</b>：JD 强调数据驱动决策<br>• <b>当前回答</b>：给出结果但缺少「如何验证」</div>
        <div class="divider"></div>
        <div class="note-line">Context（Resume + JD + Answer）→ 触发追问，聚焦「数据分析」薄弱维度的证据采集。</div>
        <div class="mt-16"><button class="btn btn-ghost" onclick="go('#/u/finish')">结束本轮面试 →</button></div>
      </div>
    </div>
    <div class="grid cols-2 mt-20">
      ${chartCard('追问触发来源占比', hBarsRich([{label:'项目经历',val:42},{label:'岗位要求',val:33},{label:'当前回答',val:25}],{unit:'%'}), '本轮追问的上下文来源构成', MOCK)}
      ${chartCard('薄弱维度证据采集', vBars([{label:'数据分析',val:3},{label:'业务洞察',val:2},{label:'技术深度',val:1},{label:'沟通表达',val:1}],{unit:' 次'}), '追问聚焦的维度与命中次数', MOCK)}
    </div>`;
}};

/* ---------- U10c Finish（面试结束，对齐低保真帧13） ---------- */
PAGES['u/finish']={title:'面试完成',crumb:'面试 · 完成',render:function(){
  return `<div class="page-head"><div class="eyebrow">STEP 9c / 面试结束</div><h2>面试完成</h2>
    <p>感谢你的参与，报告正在由 5 位虚拟面试官 + Chief Evaluation Agent 汇总生成。</p></div>
    <div class="card center" style="padding:38px 20px">
      <div style="font-size:52px">🐱</div>
      <div style="font-size:22px;font-weight:700;margin-top:8px">面试完成</div>
      <div class="muted mt-8">感谢你的参与，报告正在生成…</div>
      <div class="tag tag-green mt-12">✓ 本次面试已完成</div>
    </div>
    <div class="grid cols-4 mt-20">
      <div class="card center stat"><div class="k">完成问题数</div><div class="v">8</div></div>
      <div class="card center stat"><div class="k">面试时长</div><div class="v">17<small>′</small></div></div>
      <div class="card center stat"><div class="k">评价维度</div><div class="v">6</div></div>
      <div class="card center stat"><div class="k">是否完成</div><div class="v" style="color:var(--green)">是</div></div>
    </div>
    <div class="grid cols-2 mt-20">
      ${chartCard('本轮实时表现', trendChart({labels:['R1','R2','R3','R4','R5'],items:[{name:'实时表现',vals:DB.charts.livePerf,color:'#C8F36A'}]}), '每完成一轮的实时表现评估', MOCK)}
      ${chartCard('录用概率随轮次变化', vBars(DB.charts.offerProb.map(function(v,i){return {label:'R'+(i+1),val:v};}),{unit:'%'}), '每完成一轮后的概率更新', MOCK)}
    </div>
    <div class="card mt-20"><div class="card-title"><span class="dot"></span>下一步</div>
      <div class="mt-8 muted" style="line-height:1.8">查看多维度评分报告，了解优势与待提升，并获取 30/60/90 天成长计划。</div>
      <div class="mt-16 flex gap-12"><button class="btn btn-primary" onclick="go('#/u/multiagent')">查看多 Agent 评估 →</button><button class="btn btn-ghost" onclick="go('#/u/report')">直接看评分报告</button></div>
    </div>`;
}};

/* ---------- U11 Multi-Agent ---------- */
PAGES['u/multiagent']={title:'多 Agent 评估',crumb:'面试 · 评估',render:function(){
  var rows=DB.interviewers.map(function(a,i){var st=i<4?'done':'run';var cls=i<4?'done':'run';
    return `<div class="agent-row"><span class="status-dot ${cls}"></span>${avatar(a.initials[0], a.id==='hr'?'':a.id==='biz'?'blue':a.id==='pro'?'purple':a.id==='lead'?'green':'amber')}<div class="main"><div class="ttl">${esc(a.name)} · ${esc(a.role)}</div><div class="meta">${esc(a.focus)}</div></div><span class="tag ${i<4?'tag-green':'tag-blue'}">${i<4?'✓ completed':'● analyzing'}</span></div>`;
  }).join('');
  return `<div class="page-head"><div class="eyebrow">STEP 10 / 综合评估</div><h2>正在完成综合评估</h2>
    <p>Multi-Interviewer Evaluation System · 5 位虚拟面试官：五位面试官独立打分，由 Chief Evaluation 汇总并仲裁冲突。</p></div>
    <div class="grid cols-2">
      <div class="card"><div class="card-title"><span class="dot"></span>面试官状态</div><div class="mt-12">${rows}</div>
        <div class="mt-16"><button class="btn btn-primary" onclick="go('#/u/report')">查看评分报告 →</button></div></div>
      <div class="card"><div class="card-title"><span class="dot"></span>评估逻辑</div>
        <div class="muted mt-8" style="line-height:1.9">• 每位面试官聚焦不同维度<br>• 独立打分，避免相互影响<br>• Chief 检测 &gt;15 分差异并仲裁<br>• 最终输出可解释评分报告</div>
        <div class="divider"></div><div class="note-line">评估过程与真实多 Agent 架构一致（见管理员端 Agent Architecture）</div></div>
    </div>
    <div class="grid cols-3 mt-20">
      ${chartCard('各面试官评分',
        hBarsRich(DB.charts.agentScores.map(function(a){return {label:a.n,val:a.v};}),{labW:128}),
        '五位面试官独立打分结果', MOCK)}
      ${chartCard('各 Agent 耗时',
        vBars(DB.charts.agentLatency.map(function(a){return {label:a.n,val:a.v};}),{unit:'s'}),
        '单轮评估耗时（秒）', MOCK)}
      ${chartCard('评分分歧度',
        hBarsRich(DB.charts.agentScores.map(function(a){
          return {label:a.n,val:Math.abs(a.v-80),color:a.v>=80?'#7C9A78':'#C8F36A'};
        }),{labW:128,unit:' 分'}),
        '与 Chief 基准（80）的偏离，>15 分触发仲裁', MOCK)}
    </div>`;
}};

/* ---------- U12 Report ---------- */
PAGES['u/report']={title:'面试评分报告',crumb:'评估 · 报告',render:function(){
  var r=DB.report;
  var dims=Object.keys(r.dims).map(function(d){return `<div class="row" style="border:none;padding:6px 0"><span style="width:70px;display:inline-block" class="small">${DB.DIM[d]}</span><span class="track" style="flex:1;height:7px;background:var(--line-2);border-radius:9px;overflow:hidden;display:inline-block"><i style="display:block;height:100%;width:${r.dims[d]}%;background:var(--ink)"></i></span><b style="width:34px;text-align:right;display:inline-block" class="small">${r.dims[d]}</b></div>`;}).join('');
  return `<div class="page-head"><div class="eyebrow">STEP 11 / 评分报告</div><h2>面试评分报告</h2></div>
    <div class="split">
      <div class="card" style="text-align:center">
        <div class="muted small">本次面试</div><div style="font-size:60px;font-weight:800;letter-spacing:-.03em;line-height:1">${r.overall}<span style="font-size:22px;color:var(--ink-3)">/100</span></div>
        <div class="tag tag-green mt-8">${esc(r.band)}</div>
        <div class="mt-12">${radar(r.dims)}</div>
      </div>
      <div>
        <div class="card mb-16"><div class="card-title"><span class="dot"></span>能力维度</div><div class="mt-12">${dims}</div></div>
        <div class="grid cols-2">
          <div class="card"><div class="card-title" style="color:var(--green)">优势</div><div class="mt-8">${r.strengths.map(function(s){return `<div class="row" style="border:none;padding:5px 0">✓ ${esc(s)}</div>`;}).join('')}</div></div>
          <div class="card"><div class="card-title" style="color:var(--pink-ink)">待提升</div><div class="mt-8">${r.weaknesses.map(function(s){return `<div class="row" style="border:none;padding:5px 0">○ ${esc(s)}</div>`;}).join('')}</div></div>
        </div>
      </div>
    </div>
    <div class="grid cols-2 mt-16">
      ${chartCard('与上次面试对比',
        gBars(Object.keys(r.dims).map(function(d){return {label:DB.DIM[d],a:DB.charts.prevDims[d],b:r.dims[d]};}),'上次','本次'),
        '六维度逐项对比', MOCK)}
      ${chartCard('历史得分趋势',
        trendChart({labels:DB.charts.scoreTrend.labels,items:[{name:'综合得分',vals:DB.charts.scoreTrend.vals,color:'#18181B'}]}),
        '近 5 次面试综合得分', MOCK)}
    </div>
    <div class="grid cols-2 mt-16">
      ${chartCard('录用概率预测',
        `<div class="ring-row">${ring(83,{size:118,color:'#6B8CAE',cap:'综合预测'})}<div class="ring-meta"><div class="kv"><span class="k">岗位匹配</span><span class="v">92%</span></div><div class="kv"><span class="k">面试表现</span><span class="v">78 / 100</span></div><div class="kv"><span class="k">表达稳定度</span><span class="v">高</span></div></div></div>`,
        '由 Chief Evaluation Agent 汇总推算', MOCK)}
      ${chartCard('录用概率随轮次变化',
        vBars(DB.charts.offerProb.map(function(v,i){return {label:'R'+(i+1),val:v};}),{unit:'%'}),
        '每完成一轮后的概率更新', MOCK)}
    </div>
    <div class="mt-16 flex gap-12"><button class="btn btn-pink" onclick="go('#/u/growth')">查看能力短板 →</button><button class="btn btn-ghost" onclick="go('#/u/multiagent')">回看评估</button></div>`;
}};

/* ---------- U13 Growth ---------- */
PAGES['u/growth']={title:'能力短板与提升',crumb:'报告 · 成长',render:function(){
  var cards=DB.growth.map(function(g){return `<div class="card"><div class="between"><b style="font-size:15px">${esc(g.k)}</b><span class="tag tag-amber">差距 ${g.gap}</span></div>
    <div class="mt-8 flex items-center gap-12"><span class="small muted">当前 ${g.cur}</span><span class="track" style="flex:1;height:7px;background:var(--line-2);border-radius:9px;overflow:hidden"><i style="display:block;height:100%;width:${g.cur}%;background:var(--pink)"></i></span><span class="small muted">目标 ${g.tgt}</span></div>
    <div class="mt-12 muted small">为什么：${esc(g.why)}</div>
    <div class="mt-8 small" style="color:var(--ink-2)">建议：${g.tips.map(function(t){return '· '+esc(t);}).join('　')}</div></div>`;}).join('');
  return `<div class="page-head"><div class="eyebrow">STEP 12 / 成长闭环</div><h2>下一步提升什么？</h2>
    <p>面试 → 评分 → 发现问题 → 提升 → 再次面试。</p></div>
    <div class="grid cols-3">${cards}</div>
    <div class="grid cols-2 mt-20">
      ${chartCard('当前 vs 目标',
        gBars(DB.growth.map(function(g){return {label:g.k,a:g.cur,b:g.tgt};}),'当前','目标'),
        '三项待提升能力的差距（分）', MOCK)}
      ${chartCard('近三次能力变化',
        trendChart(DB.charts.historySeries)+legend(DB.charts.historySeries.items.map(function(i){return {name:i.name,color:i.color};})),
        '历史面试中关键维度的走势', MOCK)}
    </div>
    <div class="mt-20 center"><button class="btn btn-primary" onclick="go('#/u/difficulty')">再次练习 ↺</button></div>`;
}};

/* ---------- U14 History ---------- */
PAGES['u/history']={title:'面试历史',crumb:'成长 · 历史',render:function(){
  var rows=DB.history.map(function(h){return `<div class="row"><div class="avatar sm">📊</div><div class="main"><div class="ttl">${h.date} · ${h.diff}难度</div><div class="meta">薄弱项：${h.weak}</div></div><span class="tag tag-green">${h.score} 分</span><span class="tag tag-soft">${h.trend}</span></div>`;}).join('');
  var dm={};DB.history.forEach(function(h){(dm[h.diff]=dm[h.diff]||[]).push(h.score);});
  var diffAvg=Object.keys(dm).map(function(k){
    return {label:k,val:Math.round(dm[k].reduce(function(a,b){return a+b;},0)/dm[k].length)};
  });
  return `<div class="page-head"><div class="eyebrow">HISTORY</div><h2>我的面试时间轴</h2></div>
    <div class="grid cols-2">
      <div class="card"><div class="card-title"><span class="dot"></span>历史记录</div><div class="mt-12">${rows}</div>
        <div class="muted small mt-12">分数逐步上升，数据指标维度提升最明显。</div></div>
      ${chartCard('能力变化趋势',
        trendChart(DB.charts.historySeries)+legend(DB.charts.historySeries.items.map(function(i){return {name:i.name,color:i.color};})),
        '近三次面试的多维度走势', MOCK)}
    </div>
    <div class="grid cols-2 mt-20">
      ${chartCard('各次得分',
        vBars(DB.history.map(function(h){return {label:h.date.slice(5),val:h.score};}),{unit:' 分'}),
        '按时间顺序排列', MOCK)}
      ${chartCard('各难度平均分',
        vBars(diffAvg,{unit:' 分'}),
        '不同难度下的平均表现', MOCK)}
    </div>`;
}};

/* ---------- U16 API / OCR 状态（对齐低保真帧16） ---------- */
PAGES['u/api']={title:'API / OCR 状态',crumb:'设置 · 接口状态',render:function(){
  var llm=[
    ['调用中','面试官正在思考…','单次请求最长 90 秒超时','tag-blue'],
    ['调用失败','网络失败 / 401 Key 无效 / 429 限流 / 502 区域限制','明确文案提示，不泄露 Key','tag-amber'],
    ['返回格式异常','空内容或无法解析','提示重试，页面不崩溃','tag-amber'],
    ['重试 / 切换模型','设置页提供 5 个模型选项与「测试连接」','可一键重试或换模型','tag-green']
  ].map(function(r){return `<div class="row"><span class="tag ${r[3]}" style="flex:0 0 116px;justify-content:center">${r[0]}</span><div class="main"><div class="meta">${esc(r[1])}</div></div><div class="small muted" style="max-width:230px;text-align:right">${esc(r[2])}</div></div>`;}).join('');
  var ocr=[
    ['识别中','上传 JD 截图 / 简历图片 → 高精度版识别','3–8 秒','tag-blue'],
    ['识别失败','格式不支持 / 网络异常 / 权限错误 / 空结果','保留原文本输入流程','tag-amber'],
    ['识别成功','文字回填 JD / 简历解析模块','用户确认后继续','tag-green'],
    ['重试','失败后可重新上传识别','或改用粘贴文本','tag-gray']
  ].map(function(r){return `<div class="row"><span class="tag ${r[3]}" style="flex:0 0 116px;justify-content:center">${r[0]}</span><div class="main"><div class="meta">${esc(r[1])}</div></div><div class="small muted" style="max-width:200px;text-align:right">${esc(r[2])}</div></div>`;}).join('');
  return `<div class="page-head"><div class="eyebrow">SYSTEM / 接口状态</div><h2>API 与 OCR 状态</h2>
    <p>外接大模型与百度 OCR 的调用状态、失败兜底与配置来源，面向「可用、可解释、可恢复」。</p></div>
    <div class="grid cols-2" style="align-items:start">
      <div class="card"><div class="card-title"><span class="dot"></span>🤖 外接大模型调用状态</div><div class="mt-8">${llm}</div></div>
      <div class="card"><div class="card-title"><span class="dot"></span>🖼️ 百度 OCR 调用状态</div><div class="mt-8">${ocr}</div></div>
    </div>
    <div class="grid cols-2 mt-20">
      <div class="card"><div class="card-title"><span class="dot"></span>🔑 配置来源（设置页）</div>
        <div class="mt-8 muted" style="line-height:1.85">API Key / Base URL / 模型默认从本地安全配置 <code>local_api_config.json</code> 读取（asar 之外，不硬编码）；用户可在设置页覆盖并保存到 localStorage。</div>
        <div class="divider"></div><div class="section-note">⚙ 设置项仅为原型示意</div></div>
      <div class="card"><div class="card-title"><span class="dot"></span>🧭 适用范围</div>
        <div class="mt-8 muted" style="line-height:1.85">OCR 仅用于 <b>简历图片</b> 与 <b>JD 截图</b>；PDF / DOCX / TXT 走本地文本抽取，不经过 OCR。百度 NLP 关键词接口因权限受限已弃用，JD 关键词改由「文本渲染 PNG → OCR 高精度版」实现。</div></div>
    </div>
    <div class="grid cols-2 mt-20">
      ${chartCard('近 7 次大模型调用成功率', vBars([{label:'T1',val:100},{label:'T2',val:100},{label:'T3',val:98},{label:'T4',val:100},{label:'T5',val:99},{label:'T6',val:100},{label:'T7',val:100}],{unit:'%',max:100}), '单次请求成功率（示意）', MOCK)}
      ${chartCard('OCR 与模型响应时延', hBarsRich([{label:'OCR 高精度',val:5.2},{label:'问题生成',val:1.8},{label:'追问',val:1.1},{label:'报告汇总',val:2.4}],{unit:'s',labW:88}), '平均响应时延（秒，示意）', MOCK)}
    </div>`;
}};

/* ---------- U15 Profile ---------- */
PAGES['u/profile']={title:'个人中心',crumb:'设置 · 个人',render:function(){
  var p=DB.profile;
  return `<div class="page-head"><div class="eyebrow">PROFILE</div><h2>个人中心</h2></div>
    <div class="grid cols-2"><div class="card"><div class="row" style="border:none"><div class="avatar lg">🐱</div><div class="main"><div class="ttl" style="font-weight:700">${esc(p.name)}</div><div class="meta">${esc(p.role)}</div></div></div>
      <div class="kv"><span class="k">邮箱</span><span class="v">${esc(p.email)}</span></div><div class="kv"><span class="k">目标岗位</span><span class="v">${esc(p.target)}</span></div><div class="kv"><span class="k">简历</span><span class="v">${esc(DB.resume.file)}</span></div></div>
    <div class="card"><div class="card-title"><span class="dot"></span>偏好</div><div class="muted mt-8" style="line-height:1.9">· 通知：临期/结果推送（预留）<br>· 主题：浅色 · 极简<br>· 数据：原型演示数据</div>
      <div class="divider"></div>
      <div class="small muted mb-8">近 8 周活跃度</div>
      <div>${spark(DB.charts.activity,{w:230,h:52,color:'#6B8CAE'})}</div>
      <div class="chart-note">${MOCK}</div>
      <div class="divider"></div><div class="section-note">⚙ 设置项仅为原型示意</div></div></div>`;
}};

/* ============================ ADMIN ============================ */
/* ---------- A01 Dashboard ---------- */
PAGES['a/dashboard']={title:'数据看板',crumb:'Admin · Overview',render:function(){
  var a=DB.admin;
  var kpis=a.kpis.map(function(k){return `<div class="card">${stat(k.k,k.v,k.d)}</div>`;}).join('');
  return `<div class="page-head"><div class="eyebrow">ADMIN · SYSTEM OVERVIEW</div><span class="mock-tag">MOCK DATA</span><h2>系统数据看板</h2>
    <p>面向管理员的产品运行全景。以下为演示数据。</p></div>
    <div class="grid cols-4">${kpis}</div>
    <div class="grid cols-2 mt-20">
      <div class="card"><div class="card-title"><span class="dot"></span>面试趋势（近 12 周）</div><div class="mt-12">${lineChart(a.trend)}</div></div>
      <div class="card"><div class="card-title"><span class="dot"></span>岗位分布</div><div class="mt-12 flex gap-20 items-center">${donut(a.jobDist.map(function(x,i){return {v:x[1],color:PAL[i]};}))}<div class="legend">${a.jobDist.map(function(x,i){return `<div class="li"><span class="sw" style="background:${PAL[i]}"></span>${x[0]} · ${x[1]}%</div>`;}).join('')}</div></div></div>
    </div>
    <div class="grid cols-2 mt-20">
      <div class="card"><div class="card-title"><span class="dot"></span>能力维度分布</div><div class="mt-12">${hbars(a.abilityDist.map(function(x,i){return {label:x[0],val:x[1],color:PAL[i]};}))}</div></div>
      <div class="card"><div class="card-title"><span class="dot"></span>面试难度分布</div><div class="mt-12">${hbars(a.diffDist.map(function(x,i){return {label:x[0],val:x[1],color:PAL[i]};}))}</div>
        <div class="divider"></div><div class="card-title"><span class="dot"></span>Agent 健康度</div><div class="mt-8">${a.agentHealth.map(function(x){return meter(x.n+' '+x.rate+'%', x.rate,'var(--green)');}).join('')}</div></div>
    </div>
    <div class="grid cols-2 mt-20">
      ${chartCard('用户增长趋势',
        trendChart({labels:DB.charts.userTrend.labels,items:[{name:'注册用户',vals:DB.charts.userTrend.vals,color:'#6B8CAE'}]}),
        '近 8 周累计用户数', MOCK)}
      ${chartCard('面试完成率趋势',
        trendChart({labels:DB.charts.doneTrend.labels,items:[{name:'完成率',vals:DB.charts.doneTrend.vals,color:'#7C9A78'}]}),
        '近 30 周完成率（%）', MOCK)}
    </div>
    <div class="grid cols-2 mt-20">
      ${chartCard('评分分布',
        vBars(DB.charts.scoreDist.map(function(x){return {label:x[0],val:x[1]};}),{unit:'%'}),
        '全平台面试得分分布', MOCK)}
      ${chartCard('任务队列积压',
        vBars(DB.charts.queueTrend.map(function(v,i){return {label:'T'+(i+1),val:v};}),{unit:' 个'}),
        '近 8 个时间片的待处理任务数', MOCK)}
    </div>
    <div class="card mt-20"><div class="card-title"><span class="dot"></span>后台模块</div>
      <div class="grid cols-3 mt-12" style="gap:12px">
        ${['用户数据:#/a/users','面试数据:#/a/interviews','岗位数据:#/a/jobs','Agent 详情:#/a/agent-detail','模型调用:#/a/models','系统状态:#/a/system'].map(function(s){var p=s.split(':');return `<div class="card hov card-pad-sm" style="cursor:pointer;text-align:center" onclick="go('${p[1]}')"><div class="muted small">${p[0]}</div></div>`;}).join('')}
      </div>
    </div>`;
}};
function stat(k,v,d){var up=d&&d.indexOf('+')===0;return `<div class="stat"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="d ${up?'':'down'}">${esc(d)}</div></div>`;}

/* ---------- A02 Users ---------- */
PAGES['a/users']={title:'用户数据',crumb:'Admin · Users',render:function(){
  var rows=[['江同学','AI 产品经理','8','78','09-29','活跃'],['林同学','数据分析师','5','71','09-25','活跃'],['王同学','产品经理','3','69','09-20','沉默'],['赵同学','AI 运营','6','74','09-28','活跃']];
  var body=rows.map(function(r){return `<tr><td><div class="flex items-center gap-12"><div class="avatar sm">🐱</div>${r[0]}</div></td><td>${r[1]}</td><td>${r[2]}</td><td><b>${r[3]}</b></td><td>${r[4]}</td><td>${r[5]==='活跃'?tag('活跃','tag-green'):tag('沉默','tag-gray')}</td></tr>`;}).join('');
  return adminTable('用户数据','MOCK DATA','用户 · 目标岗位 · 面试数 · 平均分',body)
    +`<div class="grid cols-2 mt-20">
      ${chartCard('用户增长趋势',
        trendChart({labels:DB.charts.userTrend.labels,items:[{name:'注册用户',vals:DB.charts.userTrend.vals,color:'#6B8CAE'}]}),
        '近 8 周累计注册用户数', MOCK)}
      ${chartCard('活跃 / 沉默占比',
        `<div class="ring-row">${ring(77,{size:120,color:'#7C9A78',cap:'活跃率'})}<div class="ring-meta">${hBarsRich(DB.charts.userStatus.map(function(x,i){return {label:x[0],val:x[1],color:PAL[i]};}),{w:236,labW:56,valW:44})}</div></div>`,
        '共 1,284 位注册用户', MOCK)}
    </div>`;
}};

/* ---------- A03 Interviews ---------- */
PAGES['a/interviews']={title:'面试数据',crumb:'Admin · Interviews',render:function(){
  var rows=[['INT-2041','AI 产品经理','标准','78','92%'],['INT-2040','数据分析师','挑战','71','88%'],['INT-2039','产品经理','标准','69','90%'],['INT-2038','AI 运营','轻量','74','95%']];
  var body=rows.map(function(r){return `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${tag(r[2],'tag-soft')}</td><td><b>${r[3]}</b></td><td>${r[4]}</td></tr>`;}).join('');
  return adminTable('面试数据','MOCK DATA','面试编号 · 岗位 · 难度 · 评分 · 完成率',body)
    +`<div class="grid cols-2 mt-20">
      ${chartCard('完成率趋势',
        trendChart({labels:DB.charts.doneTrend.labels,items:[{name:'完成率',vals:DB.charts.doneTrend.vals,color:'#7C9A78'}]}),
        '近 30 周（%）', MOCK)}
      ${chartCard('评分分布',
        vBars(DB.charts.scoreDist.map(function(x){return {label:x[0],val:x[1]};}),{unit:'%'}),
        '全部面试得分的区间占比', MOCK)}
    </div>`;
}};

/* ---------- A04 Jobs ---------- */
PAGES['a/jobs']={title:'岗位数据',crumb:'Admin · Jobs',render:function(){
  var rows=DB.jobs.slice(0,8).map(function(j){return [j.name,j.score,j.path,j.gap];});
  var body=rows.map(function(r){return `<tr><td><b>${esc(r[0])}</b></td><td><span style="color:var(--green);font-weight:700">${r[1]}%</span></td><td class="muted">${esc(r[2])}</td><td class="muted">${esc(r[3])}</td></tr>`;}).join('');
  return adminTable('岗位数据','实时（来自 Job Match Agent）','岗位 · 平均匹配 · 发展路径 · 常见差距',body)
    +`<div class="grid cols-2 mt-20">
      ${chartCard('岗位匹配度 Top 8',
        vBars(DB.jobs.slice(0,8).map(function(j){
          return {label:shortJob(j.name),val:j.score,color:j.score>=85?'#7C9A78':(j.score>=75?'#18181B':'#C8F36A')};
        }),{unit:'%'}),
        'Job Match Agent 输出', MOCK)}
      ${chartCard('岗位类型分布',
        hBarsRich(DB.admin.jobDist.map(function(x,i){return {label:x[0],val:x[1],color:PAL[i]};}),{unit:'%',labW:110}),
        '用户选择目标岗位的占比', MOCK)}
    </div>`;
}};

/* ---------- A04b Scores（评分数据，对齐低保真帧7） ---------- */
PAGES['a/scores']={title:'评分数据',crumb:'Admin · Scores',render:function(){
  var mean=[['comm',82],['biz',76],['tech',71],['leader',80],['strategy',74],['culture',83]];
  var radarObj={};mean.forEach(function(x){radarObj[x[0]]=x[1];});
  return `<div class="page-head"><div class="eyebrow">ADMIN · SCORES</div><span class="mock-tag">MOCK DATA</span><h2>评分数据</h2>
    <p>全站面试评分的六维均值与区间分布，用于校准动态权重模板。</p></div>
    <div class="grid cols-2" style="align-items:start">
      <div class="card"><div class="card-title"><span class="dot"></span>📐 六维均值</div>
        <div class="mt-12">${mean.map(function(x){return meter(DB.DIM[x[0]],x[1],x[1]>=80?'var(--green)':'var(--ink)');}).join('')}</div>
        <div class="chart-note">${MOCK}</div></div>
      <div class="card"><div class="card-title"><span class="dot"></span>六维能力雷达</div>
        <div class="mt-8 center">${radar(radarObj)}</div></div>
    </div>
    <div class="grid cols-2 mt-20">
      ${chartCard('评分分布', vBars(DB.charts.scoreDist.map(function(x){return {label:x[0],val:x[1]};}),{unit:'%'}), '全部面试得分的区间占比', MOCK)}
      ${chartCard('六维均值', hBarsRich(mean.map(function(x){return {label:DB.DIM[x[0]],val:x[1]};}),{labW:80,unit:' 分',max:100}), '沟通/文化较高，技术维度偏低', MOCK)}
    </div>
    <div class="card mt-20"><div class="card-title"><span class="dot"></span>维度均值用于校准动态权重模板</div>
      <div class="mt-8 muted" style="line-height:1.85">Score Agent 依据岗位类型套用不同权重模板（product / tech / ai / data / ops）。六维均值用于持续校准各模板的区分度，技术深度相对偏低时可针对性提升该维度题目权重。</div></div>`;
}};

/* ---------- A05 Agents ---------- */
PAGES['a/agents']={title:'Agent 运行监控',crumb:'Admin · Agents',render:function(){
  var cls={run:'run',done:'done',wait:'wait',warn:'warn'};
  var stc={run:0,done:0,wait:0,warn:0};DB.admin.monitor.forEach(function(m){stc[m.st]=(stc[m.st]||0)+1;});
  var rows=DB.admin.monitor.map(function(m){return `<div class="agent-row"><span class="status-dot ${cls[m.st]}"></span><div class="main"><div class="ttl">${esc(m.n)}</div><div class="meta">${esc(m.calls)} 次调用 · 成功率 ${m.succ}% · 最后 ${m.last}</div></div><div class="right"><span class="small muted" style="width:54px;text-align:right;display:inline-block">${m.t}</span>${m.token!=='—'?tag(m.token+' tok','tag-soft'):''}</div></div>`;}).join('');
  return `<div class="page-head"><div class="eyebrow">ADMIN · AGENT MONITOR</div><span class="mock-tag">DEMO</span><h2>Agent 运行监控</h2>
    <p>13 个 Agent 的实时运行状态。点击任一 Agent 查看详情。</p></div>
    <div class="card"><div class="card-title"><span class="dot"></span>Agent 列表</div><div class="mt-12" onclick="go('#/a/agent-detail')" style="cursor:pointer">${rows}</div></div>
    <div class="grid cols-2 mt-20">
      ${chartCard('平均耗时趋势',
        trendChart({labels:DB.charts.agentTrend.labels,items:[{name:'平均耗时',vals:DB.charts.agentTrend.vals,color:'#9A7BB5'}]}),
        '近 30 分钟（秒）', MOCK)}
      ${chartCard('Token 消耗分布',
        hBarsRich(DB.charts.tokenDist.map(function(t){return {label:t.label,val:t.v};}),{unit:' tok',labW:112}),
        '各 Agent 单轮 Token 消耗', MOCK)}
    </div>
    <div class="grid cols-2 mt-20">
      ${chartCard('调用次数分布',
        hBarsRich(DB.admin.monitor.map(function(m){return {label:m.n,val:m.calls};}),{labW:150,valW:52}),
        '近 24 小时累计调用次数', MOCK)}
      ${chartCard('运行状态分布',
        vBars([{label:'running',val:stc.run},{label:'done',val:stc.done},{label:'waiting',val:stc.wait},{label:'warning',val:stc.warn}],{unit:' 个',h:172}),
        '13 个 Agent 的实时状态', MOCK)}
    </div>`;
}};

/* ---------- A06 Agent Detail ---------- */
PAGES['a/agent-detail']={title:'Agent 详情',crumb:'Admin · Agent',render:function(){
  var d=DB.admin.agentDetail;
  return `<div class="page-head"><div class="eyebrow">ADMIN · AGENT DETAIL</div><span class="mock-tag">DEMO DATA</span><h2>${esc(d.name)}</h2></div>
    <div class="split">
      <div class="card"><div class="kv"><span class="k">状态</span><span class="v">${esc(d.status)} ${tag('ok','tag-green')}</span></div>
        <div class="kv"><span class="k">耗时</span><span class="v">${esc(d.latency)}</span></div>
        <div class="kv"><span class="k">Token</span><span class="v">${esc(d.token)}</span></div>
        <div class="kv"><span class="k">模型</span><span class="v">${esc(d.model)}</span></div>
        <div class="kv"><span class="k">错误</span><span class="v">${esc(d.errors)}</span></div></div>
      <div class="card"><div class="card-title"><span class="dot"></span>本次执行</div>
        <div class="kv"><span class="k">Input</span><span class="v">${esc(d.input)}</span></div>
        <div class="mt-12 small muted mb-8">Process</div>${d.process.map(function(x){return `<div class="row" style="border:none;padding:5px 0">↓ ${esc(x)}</div>`;}).join('')}
        <div class="kv mt-8"><span class="k">Output</span><span class="v">${esc(d.output)}</span></div></div>
    </div>
    <div class="grid cols-2 mt-16">
      ${chartCard('该 Agent 耗时趋势',
        trendChart({labels:DB.charts.agentTrend.labels,items:[{name:'耗时',vals:DB.charts.agentTrend.vals,color:'#9A7BB5'}]}),
        '近 30 分钟（秒）', MOCK)}
      ${chartCard('Token 消耗对比',
        vBars(DB.charts.tokenDist.map(function(t){return {label:t.label,val:t.v};}),{unit:' tok'}),
        '与其他 Agent 的单轮对比', MOCK)}
    </div>
    <div class="grid cols-3 mt-16">
      ${chartCard('成功率',
        `<div class="ring-row">${ring(98,{size:104,color:'#7C9A78',cap:'近 24h'})}<div class="ring-meta small muted">3,602 次调用<br>失败 42 次<br>错误：无</div></div>`,
        '', MOCK)}
      ${chartCard('各阶段耗时',
        hBarsRich(d.process.map(function(p,i){return {label:p,val:[0.6,0.9,0.8,0.5][i]||0.5};}),{unit:'s',labW:118,max:1}),
        'Pipeline 单步骤耗时', MOCK)}
      ${chartCard('Token / 调用',
        vBars([{label:'本次',val:1284},{label:'均值',val:1180}],{unit:' tok'}),
        '与历史均值对比', MOCK)}
    </div>
    <div class="mt-16"><button class="btn btn-secondary" onclick="go('#/a/agents')">← 返回监控</button></div>`;
}};

/* ---------- A07 Models ---------- */
PAGES['a/models']={title:'模型调用情况',crumb:'Admin · Models',render:function(){
  var rows=DB.admin.models.map(function(m){return `<tr><td><b>${esc(m.m)}</b></td><td class="muted">${esc(m.role)}</td><td>${m.calls}</td><td>${esc(m.cost)}</td><td>${m.lat}</td></tr>`;}).join('');
  return adminTable('模型调用情况','MOCK DATA','模型 · 用途 · 调用次数 · 成本 · 时延',body2(rows))
    +`<div class="grid cols-2 mt-20">
      ${chartCard('成本对比',
        hBarsRich(DB.charts.modelCost.map(function(t){return {label:t.label,val:t.v};}),{unit:' $',labW:104}),
        '近 30 天各模型支出', MOCK)}
      ${chartCard('调用次数',
        vBars(DB.admin.models.map(function(m){return {label:m.m.split(' ')[0],val:m.calls};}),{}),
        '近 30 天调用次数', MOCK)}
    </div>`;
}};

/* ---------- A08 System ---------- */
PAGES['a/system']={title:'系统运行状态',crumb:'Admin · System',render:function(){
  var rows=DB.admin.system.map(function(s){return `<div class="row"><div class="main"><div class="ttl">${esc(s.k)}</div></div>${s.ok?tag(esc(s.v),'tag-green'):tag(esc(s.v),'tag-amber')}</div>`;}).join('');
  return `<div class="page-head"><div class="eyebrow">ADMIN · SYSTEM</div><span class="mock-tag">DEMO</span><h2>系统运行状态</h2></div>
    <div class="grid cols-2"><div class="card"><div class="card-title"><span class="dot"></span>运行状态</div><div class="mt-12">${rows}</div></div>
    <div class="card"><div class="card-title"><span class="dot"></span>13-Agent 架构</div><div class="mt-12">${DB.admin.pipeline.map(function(n,i){return `<span class="tag tag-soft" style="margin:0 6px 8px 0">${i+1}. ${esc(n)}</span>`;}).join('')}</div>
      <div class="divider"></div><div class="section-note">架构与真实多 Agent 管线一致（见 docs/competency_framework.md）</div></div></div>
    <div class="grid cols-2 mt-20">
      ${chartCard('API 可用率',
        trendChart({labels:DB.charts.uptimeTrend.labels,items:[{name:'可用率',vals:DB.charts.uptimeTrend.vals,color:'#7C9A78'}]}),
        '近 8 周（%）', MOCK)}
      ${chartCard('队列积压',
        vBars(DB.charts.queueTrend.map(function(v,i){return {label:'T'+(i+1),val:v};}),{unit:' 个'}),
        '近 8 个时间片待处理任务数', MOCK)}
    </div>
    <div class="grid cols-3 mt-20">
      ${chartCard('可用率', `<div class="ring-row">${ring(99.7,{size:104,color:'#7C9A78',cap:'24h'})}</div>`, '目标 ≥ 99.5%', MOCK)}
      ${chartCard('存储使用', `<div class="ring-row">${ring(41,{size:104,color:'#6B8CAE',cap:'已用'})}</div>`, '41% / 200 GB', MOCK)}
      ${chartCard('错误率', `<div class="ring-row">${ring(0.3,{size:104,color:'#C8F36A',cap:'24h'})}</div>`, '阈值 ≤ 1%', MOCK)}
    </div>`;
}};

/* ---------- A09 Quality ---------- */
PAGES['a/quality']={title:'面试质量分析',crumb:'Admin · Quality',render:function(){
  var rows=DB.admin.quality.map(function(q){return `<div class="row"><div class="main"><div class="ttl">${esc(q.k)}</div><div class="meta">${esc(q.note)}</div></div><b>${esc(q.v)}</b></div>`;}).join('');
  return `<div class="page-head"><div class="eyebrow">ADMIN · QUALITY</div><span class="mock-tag">MOCK DATA</span><h2>面试质量分析</h2></div>
    <div class="grid cols-2"><div class="card"><div class="card-title"><span class="dot"></span>质量指标</div><div class="mt-12">${rows}</div></div>
      ${chartCard('评分一致性趋势',
        trendChart({labels:DB.charts.qualityTrend.labels,items:[{name:'Cohen κ',vals:DB.charts.qualityTrend.vals,color:'#9A7BB5'}]}),
        '近 8 周跨面试官一致性', MOCK)}
    </div>
    <div class="grid cols-3 mt-20">
      ${chartCard('评分一致性', `<div class="ring-row">${ring(86,{size:104,color:'#7C9A78',cap:'κ 指数'})}</div>`, '目标 ≥ 0.80', MOCK)}
      ${chartCard('冲突仲裁触发率', `<div class="ring-row">${ring(7.2,{size:104,color:'#C9A227',cap:'触发率'})}</div>`, '>15 分差异时触发', MOCK)}
      ${chartCard('追问命中率', `<div class="ring-row">${ring(83,{size:104,color:'#6B8CAE',cap:'命中率'})}</div>`, '用户主观反馈', MOCK)}
    </div>
    <div class="grid cols-2 mt-20">
      <div class="card"><div class="card-title"><span class="dot"></span>说明</div><div class="muted mt-8" style="line-height:1.9">· 评分一致性衡量多面试官打分相关度<br>· 冲突仲裁触发率反映分歧程度<br>· 追问命中率体现动态追问相关性<br><br>这些指标帮助持续校准 Agent。</div></div>
      ${chartCard('低分申诉率',
        vBars([{label:'W1',val:2.8},{label:'W3',val:2.4},{label:'W5',val:2.2},{label:'W8',val:2.1}],{unit:'%'}),
        '用户反馈的评分异议比例', MOCK)}
    </div>`;
}};

/* ---------- A09b Logs（运行日志，对齐低保真帧9） ---------- */
PAGES['a/logs']={title:'运行日志',crumb:'Admin · Logs',render:function(){
  var rows=[['11:02','INFO','Agent 管线启动','tag-gray'],['10:47','WARN','Scorer 延迟升高','tag-amber'],['10:21','ERROR','Interview JSON 解析失败→兜底','tag-pink'],['09:58','INFO','新增 12 场面试','tag-gray'],['09:40','INFO','Chief 仲裁 1 处评分冲突','tag-gray']]
    .map(function(r){return `<tr><td class="muted">${r[0]}</td><td><span class="tag ${r[3]}">${r[1]}</span></td><td>${esc(r[2])}</td><td>${tag('已恢复','tag-green')}</td></tr>`;}).join('');
  return adminTable('运行日志 / 系统情况','MOCK DATA','时间 · 级别 · 消息 · 状态',rows)
    +`<div class="grid cols-3 mt-20">
      <div class="card center stat"><div class="k">系统整体</div><div class="v" style="color:var(--green);font-size:22px">正常</div></div>
      <div class="card center stat"><div class="k">近 1h 错误</div><div class="v">2</div></div>
      <div class="card center stat"><div class="k">已自动恢复</div><div class="v">2</div></div>
    </div>
    <div class="grid cols-2 mt-20">
      ${chartCard('日志级别分布', vBars([{label:'INFO',val:38},{label:'WARN',val:7},{label:'ERROR',val:2}],{unit:' 条'}), '近 24 小时各级别日志数量', MOCK)}
      ${chartCard('近 8 时段日志量', trendChart({labels:['T1','T2','T3','T4','T5','T6','T7','T8'],items:[{name:'日志量',vals:[42,55,38,61,49,72,58,47],color:'#6B8CAE'}]}), '日志吞吐趋势（示意）', MOCK)}
    </div>
    <div class="card mt-20"><div class="card-title"><span class="dot"></span>说明</div>
      <div class="mt-8 muted" style="line-height:1.85">系统运行情况视图为规划方向，日志样本用于演示监控形态。ERROR 均已触发兜底逻辑（JSON 解析失败回退默认问题），页面不崩溃。</div></div>`;
}};

function adminTable(title,flag,cols,body){
  return `<div class="page-head"><div class="eyebrow">ADMIN</div><span class="mock-tag">${flag}</span><h2>${title}</h2></div>
    <div class="card"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;color:var(--ink-3);border-bottom:1px solid var(--line)">${cols.split('·').map(function(c){return '<th style="padding:10px 8px;font-weight:600">'+c.trim()+'</th>';}).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function body2(r){return r;}

/* card helper used by dashboard */
function card(title,body){return `<div class="card"><div class="card-title"><span class="dot"></span>${title}</div><div class="mt-12">${body}</div></div>`;}

/* ---------------- router ---------------- */
function render(){
  var hash=(location.hash.replace(/^#/,'')||'u/dashboard').replace(/^\/+/,'');
  var role=hash.charAt(0)==='a'?'a':'u';
  var page=PAGES[hash]||PAGES[role+'/dashboard'];
  if(!PAGES[hash])hash=role+'/dashboard';
  var def=PAGES[hash];
  document.getElementById('sidebar').innerHTML=sidebar(hash);
  document.getElementById('topbar').innerHTML=
    `<div><h1>${esc(def.title)}</h1><div class="crumb">${esc(def.crumb||'')}</div></div>
     <div class="topbar-right"><span class="proto-flag">HIGH-FI PROTOTYPE</span><div class="avatar sm">🐱</div></div>`;
  var view=document.getElementById('view');
  view.innerHTML=def.render();
  view.scrollTop=0;window.scrollTo(0,0);
}
window.addEventListener('hashchange',render);
window.addEventListener('DOMContentLoaded',function(){
  if(!location.hash)location.hash='#/u/dashboard';
  render();
});
/* expose for inline handlers */
window.go=go;window.toast=toast;window.modal=modal;window.closeModal=closeModal;
window.uploadResume=uploadResume;window.selectJob=selectJob;window.toast=toast;
window.showComp=showComp;window.switchWeight=switchWeight;window.pickDiff=pickDiff;
window.submitAns=submitAns;
})();
