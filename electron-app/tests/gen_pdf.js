/* 生成测试样本（供 resume-extract / 图片 OCR 回归测试使用）：
 *   tests/fixtures/resume_mechanical.pdf —— 中文 + 双栏排版的真实简历 PDF
 *   tests/fixtures/resume_mechanical.png —— 同一份简历的截图（模拟「图片简历」上传）
 *
 * 运行（注意必须 unset ELECTRON_RUN_AS_NODE，否则 electron 会以纯 Node 启动）：
 *   env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe tests/gen_pdf.js
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HTML = `<!doctype html><html><head><meta charset="utf-8">
<style>
  body{font-family:"Microsoft YaHei","Noto Sans SC",sans-serif;font-size:12px;margin:36px;color:#000}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:#555;margin-bottom:14px}
  h2{font-size:13px;border-bottom:1px solid #999;margin:16px 0 8px;padding-bottom:3px}
  .row{display:flex;justify-content:space-between;margin-bottom:5px}
  .row .r{color:#333}
  .two{display:flex;gap:24px}
  .col{flex:1}
  ul{margin:4px 0 4px 16px;padding:0}
  li{margin-bottom:3px}
</style></head><body>
<h1>陈思远</h1>
<div class="sub">求职意向：机械设计工程师 · 电话 138-0000-1234 · 邮箱 chensiyuan@example.com</div>

<h2>教育背景</h2>
<div class="row"><span>北京理工大学 · 机械工程（本科）</span><span class="r">2017.09 - 2021.06</span></div>
<div class="row"><span>主修课程：机械原理、材料力学、机械设计、液压传动、互换性与测量技术</span><span class="r">GPA 3.7/4.0</span></div>

<h2>工作与实习经历</h2>
<div class="row"><span>上汽集团 · 机械设计实习生</span><span class="r">2020.07 - 2021.01</span></div>
<ul>
  <li>使用 SolidWorks 完成减速器壳体三维建模与工程图输出，完成 3 轮结构改进</li>
  <li>使用 ANSYS 对关键零部件进行静力学仿真，最大应力下降 18%</li>
  <li>参与装配工艺文件编制，整理 BOM 清单 200+ 项</li>
</ul>
<div class="row"><span>某自动化设备公司 · 结构设计工程师</span><span class="r">2021.07 - 2024.03</span></div>
<ul>
  <li>负责非标自动化设备整机结构设计，独立交付 6 台设备</li>
  <li>熟练使用 AutoCAD 出图，掌握 GD&T 形位公差标注</li>
</ul>

<h2>项目经历</h2>
<div class="row"><span>六自由度机械臂结构设计</span><span class="r">2023.03 - 2023.11</span></div>
<ul><li>完成臂体与关节模组设计，使用 MATLAB 做运动学仿真验证</li></ul>

<h2>专业技能</h2>
<div class="two">
  <div class="col">三维建模：SolidWorks / CATIA / Rhino</div>
  <div class="col">仿真分析：ANSYS / MATLAB</div>
</div>
<div class="two">
  <div class="col">工程图：AutoCAD / GD&T</div>
  <div class="col">其他：CET-6、普通话二级甲等</div>
</div>

<h2>证书与荣誉</h2>
<div>校级机械创新设计大赛二等奖（2019）· 全国大学生机械创新设计大赛省三等奖（2020）</div>
</body></html>`;

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 820, height: 1160 });
  // 必须放到临时目录：data: URL 过长会被 Chromium 拒绝，
  // 且本项目路径含空格，loadFile 在部分版本下会 ERR_FAILED
  const tmpHtml = path.join(os.tmpdir(), 'resume_src.html');
  fs.writeFileSync(tmpHtml, HTML, 'utf-8');
  await win.loadFile(tmpHtml);
  await new Promise(r => setTimeout(r, 800));

  const dir = path.join(__dirname, 'fixtures');
  fs.mkdirSync(dir, { recursive: true });

  const buf = await win.webContents.printToPDF({
    landscape: false, marginsType: 1, printBackground: true, pageSize: 'A4'
  });
  const out = path.join(dir, 'resume_mechanical.pdf');
  fs.writeFileSync(out, buf);
  console.log('WROTE ' + out + ' (' + buf.length + ' bytes)');

  // 截图：模拟用户上传「图片简历」（截图/扫描件）
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 820, height: 1160 });
  const png = img.toPNG();
  const outPng = path.join(dir, 'resume_mechanical.png');
  fs.writeFileSync(outPng, png);
  console.log('WROTE ' + outPng + ' (' + png.length + ' bytes)');
  app.quit();
}).catch(e => { console.log('ERR ' + e.stack); app.quit(); });
