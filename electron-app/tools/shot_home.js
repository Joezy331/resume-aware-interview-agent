/* 首页落地页版式预览截图：electron tools/shot_home.js <输出目录>
 * 仅截 page-home 首屏，用于核对 p1 排版改造效果。 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  const outDir = path.resolve(process.argv[2] || '.');
  fs.mkdirSync(outDir, { recursive: true });

  const tag = process.argv[3] || '1440';
  const sizes = [tag === '1920' ? { w: 1920, h: 1080, tag: '1920' } : { w: 1440, h: 900, tag: '1440' }];

  for (const s of sizes) {
    const win = new BrowserWindow({ width: s.w, height: s.h, show: false });
    await win.loadFile(path.join(__dirname, '..', 'index.html'));
    await new Promise(r => setTimeout(r, 1800));
    await win.webContents.executeJavaScript("try{showPage('home')}catch(e){}");
    await new Promise(r => setTimeout(r, 900));
    await win.webContents.capturePage(); // 丢弃首帧
    await new Promise(r => setTimeout(r, 320));
    const img = await win.webContents.capturePage();
    const file = path.join(outDir, 'lp_home_' + s.tag + '.png');
    fs.writeFileSync(file, img.toPNG());
    console.log('SHOT_OK ' + file);
    win.destroy();
  }

  app.quit();
});
