import { contextBridge, ipcRenderer } from 'electron';
import type { ReaderWindowPayload, ScanRootKind, TranslationProgressEvent, TranslatorConfig } from '../shared/types.js';

const api = {
  status: () => ipcRenderer.invoke('lumina:status'),
  dashboard: () => ipcRenderer.invoke('lumina:dashboard'),
  assets: (query = '', filter = 'all') => ipcRenderer.invoke('lumina:assets', query, filter),
  asset: (id: string) => ipcRenderer.invoke('lumina:asset', id),
  scan: () => ipcRenderer.invoke('lumina:scan'),
  pendingTranslations: () => ipcRenderer.invoke('lumina:pending-translations'),
  agentGuide: () => ipcRenderer.invoke('lumina:agent-guide'),
  translateAsset: (id: string) => ipcRenderer.invoke('lumina:translate-asset', id),
  translateAssetLive: (id: string) => ipcRenderer.invoke('lumina:translate-asset-live', id),
  translatePending: (limit = 10) => ipcRenderer.invoke('lumina:translate-pending', limit),
  translateSelected: (assetIds: string[]) => ipcRenderer.invoke('lumina:translate-selected', assetIds),
  skipTranslations: (assetIds: string[]) => ipcRenderer.invoke('lumina:skip-translations', assetIds),
  onTranslationProgress: (listener: (event: TranslationProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: TranslationProgressEvent) => listener(payload);
    ipcRenderer.on('lumina:translation-progress', handler);
    return () => ipcRenderer.removeListener('lumina:translation-progress', handler);
  },
  doctor: () => ipcRenderer.invoke('lumina:doctor'),
  addRoot: (pathExpression: string, kind: ScanRootKind) =>
    ipcRenderer.invoke('lumina:add-root', pathExpression, kind),
  setTranslator: (translator: TranslatorConfig) => ipcRenderer.invoke('lumina:set-translator', translator),
  addFile: (filePath: string, category: string) => ipcRenderer.invoke('lumina:add-file', filePath, category),
  copyText: (text: string) => ipcRenderer.invoke('lumina:copy-text', text),
  pickFile: () => ipcRenderer.invoke('lumina:pick-file'),
  pickDirectory: () => ipcRenderer.invoke('lumina:pick-directory'),
  openPath: (target: string) => ipcRenderer.invoke('lumina:open-path', target),
  showItem: (target: string) => ipcRenderer.invoke('lumina:show-item', target),
  openReader: (payload: ReaderWindowPayload) => ipcRenderer.invoke('lumina:open-reader', payload)
};

contextBridge.exposeInMainWorld('lumina', api);

export type LuminaApi = typeof api;
