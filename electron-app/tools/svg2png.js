/* SVG → PNG 导出工具（Electron 无头渲染，2x 缩放）
 * 用法：electron tools/svg2png.js <svg目录>
 * 输出：同目录同名 .png（单张失败不影响其余）
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

function svgSize(file) {
  const txt = fs.readFileSync(file, 'utf-8');
  const m = txt.match(/<svg[^>]*width="(\d+)"[^>]*height="(\d+)"/);
  return m ? { w: parseInt(m[1], 10), h: parseInt(m[2], 10) } : { w: 1100, h: 800 };
}

app.whenReady().then(async () => {
  const target = path.resolve(process.argv[2] || '.');
  const stat = fs.statSync(target);
  const files = stat.isDirectory()
    ? fs.readdirSync(target).filter(f => f.toLowerCase().endsWith('.svg')).sort().map(f => path.join(target, f))
    : [target];
  for (const full of files) {
    const f = path.basename(full);
    try {
      const { w, h } = svgSize(full);
      const b64 = fs.readFileSync(full).toString('base64');
      const win = new BrowserWindow({
        width: w * 2 + 20, height: h * 2 + 20, show: false,
      });
      win.setSize(w * 2 + 20, h * 2 + 20);
      win.webContents.setZoomFactor(2);
      await win.loadURL('data:image/svg+xml;base64,' + b64);
      await new Promise(r => setTimeout(r, 900)); // 等字体渲染
      const img = await win.webContents.capturePage();
      const out = full.replace(/\.svg$/i, '.png');
      fs.writeFileSync(out, img.toPNG());
      console.log('PNG_OK ' + path.basename(out) + ' ' + img.getSize().width + 'x' + img.getSize().height);
      win.destroy();
    } catch (e) {
      console.log('PNG_FAIL ' + f + ' :: ' + (e && e.message ? e.message : e));
    }
  }
  app.quit();
});
