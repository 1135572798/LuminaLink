import { contextBridge, ipcRenderer } from 'electron';
import type { ScanRootKind, TranslatorConfig } from '../shared/types.js';

const api = {
  status: () => ipcRenderer.invoke('lumina:status'),
  dashboard: () => ipcRenderer.invoke('lumina:dashboard'),
  assets: (query = '', filter = 'all') => ipcRenderer.invoke('lumina:assets', query, filter),
  asset: (id: string) => ipcRenderer.invoke('lumina:asset', id),
  scan: () => ipcRenderer.invoke('lumina:scan'),
  pendingTranslations: () => ipcRenderer.invoke('lumina:pending-translations'),
  translateAsset: (id: string) => ipcRenderer.invoke('lumina:translate-asset', id),
  translatePending: (limit = 10) => ipcRenderer.invoke('lumina:translate-pending', limit),
  doctor: () => ipcRenderer.invoke('lumina:doctor'),
  addRoot: (pathExpression: string, kind: ScanRootKind) =>
    ipcRenderer.invoke('lumina:add-root', pathExpression, kind),
  setTranslator: (translator: TranslatorConfig) => ipcRenderer.invoke('lumina:set-translator', translator),
  addFile: (filePath: string, category: string) => ipcRenderer.invoke('lumina:add-file', filePath, category),
  pickFile: () => ipcRenderer.invoke('lumina:pick-file'),
  pickDirectory: () => ipcRenderer.invoke('lumina:pick-directory'),
  openPath: (target: string) => ipcRenderer.invoke('lumina:open-path', target),
  showItem: (target: string) => ipcRenderer.invoke('lumina:show-item', target)
};

contextBridge.exposeInMainWorld('lumina', api);

export type LuminaApi = typeof api;
