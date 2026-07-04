import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import {
  addFile,
  addRoot,
  doctor,
  getAgentGuide,
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
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#667579',
      height: 36
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.once('did-finish-load', () => {
    void runSmokeTestIfRequested();
  });

  if (app.isPackaged) {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  } else {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

async function runSmokeTestIfRequested(): Promise<void> {
  const outputFile = process.env.LUMINALINK_SMOKE_TEST_FILE;
  if (!outputFile || !mainWindow) return;
  try {
    const screenshotDir = process.env.LUMINALINK_SMOKE_SCREENSHOT_DIR;
    const result = await mainWindow.webContents.executeJavaScript(`
      (async () => {
        const hasLumina = Boolean(window.lumina);
        const methods = hasLumina ? Object.keys(window.lumina).sort() : [];
        const status = hasLumina ? await window.lumina.status() : undefined;
        const scan = hasLumina ? await window.lumina.scan() : undefined;
        const guide = hasLumina ? await window.lumina.agentGuide() : undefined;
        return {
          hasLumina,
          methods,
          statusOk: Boolean(status && status.ok),
          scanOk: Boolean(scan && typeof scan.scannedRoots === 'number'),
          agentGuideOk: Boolean(guide && guide.ok && guide.data && guide.data.runbookPath),
          scan,
          agentRunbookPath: guide && guide.data ? guide.data.runbookPath : undefined,
          menuBarVisible: ${mainWindow.isMenuBarVisible()}
        };
      })()
    `);
    let layout;
    if (screenshotDir) {
      await ensureSmokeScreenshotDir(screenshotDir);
      layout = await runUiSmokeInteractions(screenshotDir);
    }
    await fs.writeFile(outputFile, `${JSON.stringify({ ...result, layout }, null, 2)}\n`, 'utf8');
  } catch (error) {
    await fs.writeFile(
      outputFile,
      `${JSON.stringify(
        {
          hasLumina: false,
          error: error instanceof Error ? error.message : String(error)
        },
        null,
        2
      )}\n`,
      'utf8'
    );
  } finally {
    app.quit();
  }
}

async function ensureSmokeScreenshotDir(screenshotDir: string): Promise<void> {
  await fs.mkdir(screenshotDir, { recursive: true });
}

async function captureSmokeScreenshot(screenshotDir: string, fileName: string): Promise<void> {
  if (!mainWindow) return;
  const image = await mainWindow.webContents.capturePage();
  await fs.writeFile(path.join(screenshotDir, fileName), image.toPNG());
}

async function collectLayoutMetrics(): Promise<unknown> {
  if (!mainWindow) return undefined;
  return mainWindow.webContents.executeJavaScript(`
    (() => {
      const detailActions = document.querySelector('.detail-actions');
      const actionsRect = detailActions ? detailActions.getBoundingClientRect() : undefined;
      const appShell = document.querySelector('.app-shell');
      const root = document.documentElement;
      return {
        outerScroll: root.scrollHeight > window.innerHeight || document.body.scrollHeight > window.innerHeight,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        documentHeight: root.scrollHeight,
        bodyHeight: document.body.scrollHeight,
        appShellHeight: appShell ? appShell.getBoundingClientRect().height : 0,
        detailActionsVisible: Boolean(
          actionsRect &&
            actionsRect.top >= 0 &&
            actionsRect.bottom <= window.innerHeight &&
            actionsRect.height > 0
        )
      };
    })()
  `);
}

async function runUiSmokeInteractions(screenshotDir: string): Promise<unknown> {
  if (!mainWindow) return;
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const button = Array.from(document.querySelectorAll('button')).find((item) =>
        item.textContent && item.textContent.includes('扫描资产')
      );
      if (button) button.click();
      window.setTimeout(resolve, 1200);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '01-scan-result.png');
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const row = Array.from(document.querySelectorAll('.asset-row')).find((item) =>
        item.textContent && item.textContent.includes('Spreadsheets')
      );
      if (row) row.click();
      window.setTimeout(resolve, 500);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '02-detail-actions.png');
  const detailLayout = await collectLayoutMetrics();
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const button = Array.from(document.querySelectorAll('button')).find((item) =>
        item.textContent && item.textContent.trim() === 'Agent'
      );
      if (button) button.click();
      window.setTimeout(resolve, 700);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '03-agent-filter.png');
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const button = Array.from(document.querySelectorAll('button')).find((item) =>
        item.textContent && item.textContent.includes('Codex 协助')
      );
      if (button) button.click();
      window.setTimeout(resolve, 900);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '04-codex-assist.png');
  const finalLayout = await collectLayoutMetrics();
  return { detail: detailLayout, final: finalLayout };
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
  ipcMain.handle('lumina:agent-guide', () => getAgentGuide());
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
        { name: 'Text Documents', extensions: ['md', 'txt', 'json', 'toml', 'yaml', 'yml'] },
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
