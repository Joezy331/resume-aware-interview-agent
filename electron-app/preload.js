const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 IPC 接口给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 简历文件解析
  parseResumeFile: (filePath) => ipcRenderer.invoke('parse-resume-file', filePath),
  // LLM 对话（主进程代理 fetch，绕过 CORS）
  aiChat: (payload) => ipcRenderer.invoke('ai-chat', payload),
  // 百度智能云 OCR（图片 → 文字）
  baiduOcr: (payload) => ipcRenderer.invoke('baidu-ocr', payload),
  // 百度智能云 NLP（JD 文本 → 关键词）
  baiduNlpKeyword: (payload) => ipcRenderer.invoke('baidu-nlp-keyword', payload),
  // Cline 可用模型：读取本地持久化列表（启动时恢复）
  getLocalConfig: () => ipcRenderer.invoke('get-local-config'),
  // Cline 可用模型：实时同步 GET {baseUrl}/models（结果持久化到 local_api_config.json）
  listModels: () => ipcRenderer.invoke('list-models')
});
