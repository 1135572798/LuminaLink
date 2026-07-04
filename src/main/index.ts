import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import {
  addFile,
  addRoot,
  doctor,
  getDashboard,
  getStatus,
  listPendingTranslations,
  runScan,
  searchAssets,
  setTranslatorConfig,
  showAsset,
  translateAssetById,
  translatePending
} from '../core/app-service.js';
import type { ScanRootKind } from '../shared/types.js';
import type { TranslatorConfig } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | undefined;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 1024,
    minWidth: 1100,
    minHeight: 760,
    title: 'LuminaLink',
    backgroundColor: '#f7faf9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (app.isPackaged) {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  } else {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(async () => {
  registerIpc();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function registerIpc(): void {
  ipcMain.handle('lumina:status', () => getStatus());
  ipcMain.handle('lumina:dashboard', () => getDashboard());
  ipcMain.handle('lumina:assets', (_event, query: string, filter: string) => searchAssets(query, filter));
  ipcMain.handle('lumina:asset', (_event, id: string) => showAsset(id));
  ipcMain.handle('lumina:scan', () => runScan());
  ipcMain.handle('lumina:pending-translations', () => listPendingTranslations());
  ipcMain.handle('lumina:translate-asset', (_event, id: string) => translateAssetById(id));
  ipcMain.handle('lumina:translate-pending', (_event, limit: number) => translatePending(limit));
  ipcMain.handle('lumina:doctor', () => doctor());
  ipcMain.handle('lumina:add-root', (_event, pathExpression: string, kind: ScanRootKind) =>
    addRoot(pathExpression, kind)
  );
  ipcMain.handle('lumina:set-translator', (_event, translator: TranslatorConfig) => setTranslatorConfig(translator));
  ipcMain.handle('lumina:add-file', (_event, filePath: string, category: string) => addFile(filePath, category));
  ipcMain.handle('lumina:pick-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'Text Documents', extensions: ['md', 'txt', 'json', 'yaml', 'yml'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return result.canceled ? undefined : result.filePaths[0];
  });
  ipcMain.handle('lumina:pick-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    });
    return result.canceled ? undefined : result.filePaths[0];
  });
  ipcMain.handle('lumina:open-path', async (_event, target: string) => {
    const error = await shell.openPath(target);
    return { ok: !error, message: error || '已打开' };
  });
  ipcMain.handle('lumina:show-item', async (_event, target: string) => {
    shell.showItemInFolder(target);
    return { ok: true, message: '已定位文件' };
  });
}
