const { contextBridge, ipcRenderer } = require('electron');

const api = {
  status: () => ipcRenderer.invoke('lumina:status'),
  dashboard: () => ipcRenderer.invoke('lumina:dashboard'),
  assets: (query = '', filter = 'all') => ipcRenderer.invoke('lumina:assets', query, filter),
  asset: (id) => ipcRenderer.invoke('lumina:asset', id),
  scan: () => ipcRenderer.invoke('lumina:scan'),
  pendingTranslations: () => ipcRenderer.invoke('lumina:pending-translations'),
  agentGuide: () => ipcRenderer.invoke('lumina:agent-guide'),
  translateAsset: (id) => ipcRenderer.invoke('lumina:translate-asset', id),
  translatePending: (limit = 10) => ipcRenderer.invoke('lumina:translate-pending', limit),
  doctor: () => ipcRenderer.invoke('lumina:doctor'),
  addRoot: (pathExpression, kind) => ipcRenderer.invoke('lumina:add-root', pathExpression, kind),
  setTranslator: (translator) => ipcRenderer.invoke('lumina:set-translator', translator),
  addFile: (filePath, category) => ipcRenderer.invoke('lumina:add-file', filePath, category),
  pickFile: () => ipcRenderer.invoke('lumina:pick-file'),
  pickDirectory: () => ipcRenderer.invoke('lumina:pick-directory'),
  openPath: (target) => ipcRenderer.invoke('lumina:open-path', target),
  showItem: (target) => ipcRenderer.invoke('lumina:show-item', target)
};

contextBridge.exposeInMainWorld('lumina', api);
