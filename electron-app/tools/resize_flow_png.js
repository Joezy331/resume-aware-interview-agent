const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

const SRC = 'E:/codex_projects/A Career Copilot/resume-aware-interview-agent/docs/flows';
const OUT = 'C:/Users/jiang/AppData/Local/Temp/acc_web';
const TARGET_WIDTH = 1120;

app.whenReady().then(() => {
  fs.mkdirSync(OUT, { recursive: true });
  const files = ['user_flow', 'api_call_flow', 'ocr_flow', 'history_flow', 'agent_architecture'];
  for (const f of files) {
    const src = path.join(SRC, f + '.png');
    const img = nativeImage.createFromPath(src);
    const before = img.getSize();
    const resized = img.resize({ width: TARGET_WIDTH, quality: 'best' });
    const after = resized.getSize();
    const outPath = path.join(OUT, f + '.png');
    fs.writeFileSync(outPath, resized.toPNG());
    console.log(f + ': ' + before.width + 'x' + before.height + ' -> ' + after.width + 'x' + after.height + ' (' + Math.round(fs.statSync(outPath).size / 1024) + 'KB)');
  }
  app.quit();
});
