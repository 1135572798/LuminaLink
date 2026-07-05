import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from 'electron';
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
  skipAssetTranslations,
  translateAssetById,
  translatePending,
  translateSelectedAssets
} from '../core/app-service.js';
import type { ReaderWindowPayload, ScanRootKind } from '../shared/types.js';
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
  let smokeExitCode = 0;
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
    smokeExitCode = 1;
  } finally {
    app.exit(smokeExitCode);
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
      const detailPane = document.querySelector('.detail-pane');
      const detailPaneRect = detailPane ? detailPane.getBoundingClientRect() : undefined;
      const logbar = document.querySelector('.logbar');
      const logbarRect = logbar ? logbar.getBoundingClientRect() : undefined;
      const resizer = document.querySelector('.pane-resizer');
      const readerButton = document.querySelector('.reader-button');
      const detailText = document.querySelector('.detail-body')?.textContent || '';
      const appShell = document.querySelector('.app-shell');
      const settingsWorkspace = document.querySelector('.workspace.settings-workspace');
      const settingsPanel = document.querySelector('.settings-panel');
      const settingsPanelRect = settingsPanel ? settingsPanel.getBoundingClientRect() : undefined;
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
        ),
        detailPaneWidth: detailPaneRect ? Math.round(detailPaneRect.width) : 0,
        resizerExists: Boolean(resizer),
        settingsWorkspaceSinglePane: Boolean(settingsWorkspace && !detailPane && !resizer),
        settingsPanelVisible: Boolean(
          settingsPanelRect &&
            settingsPanelRect.top >= 0 &&
            settingsPanelRect.bottom <= window.innerHeight &&
            settingsPanelRect.width > 0
        ),
        readerButtonVisible: Boolean(readerButton && readerButton.getBoundingClientRect().height > 0),
        escapedNewlineVisible: detailText.includes('\\\\n'),
        logbarPinnedToBottom: Boolean(
          logbarRect &&
            logbarRect.top >= 0 &&
            Math.abs(window.innerHeight - logbarRect.bottom) <= 2 &&
            logbarRect.height > 0
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
      const button = Array.from(document.querySelectorAll('button')).find((item) =>
        item.textContent && item.textContent.includes('关闭')
      );
      if (button) button.click();
      window.setTimeout(resolve, 500);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '02-no-notice-logbar.png');
  const noNoticeLayout = await collectLayoutMetrics();
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const row = Array.from(document.querySelectorAll('.asset-row')).find((item) =>
        item.textContent && item.textContent.includes('Spreadsheets')
      );
      if (row) row.click();
      window.setTimeout(resolve, 500);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '03-detail-actions.png');
  const readerOpened = await openReaderDuringSmoke();
  const detailLayout = await collectLayoutMetrics();
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const button = Array.from(document.querySelectorAll('.nav-item')).find((item) =>
        item.textContent && item.textContent.includes('Skill')
      );
      if (button) button.click();
      window.setTimeout(resolve, 700);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '04-skill-view.png');
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const button = Array.from(document.querySelectorAll('.nav-item')).find((item) =>
        item.textContent && item.textContent.includes('Plugin')
      );
      if (button) button.click();
      window.setTimeout(resolve, 700);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '05-plugin-view.png');
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const button = Array.from(document.querySelectorAll('.nav-item')).find((item) =>
        item.textContent && item.textContent.includes('Agent')
      );
      if (button) button.click();
      window.setTimeout(resolve, 700);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '06-agent-view.png');
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const button = Array.from(document.querySelectorAll('.nav-item')).find((item) =>
        item.textContent && item.textContent.includes('其他文件')
      );
      if (button) button.click();
      window.setTimeout(resolve, 700);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '07-files-view.png');
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const button = Array.from(document.querySelectorAll('.nav-item')).find((item) =>
        item.textContent && item.textContent.includes('未翻译')
      );
      if (button) button.click();
      window.setTimeout(resolve, 700);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '08-untranslated-view.png');
  const hoverAndContext = await runHoverAndContextMenuSmoke(screenshotDir);
  const bulkSelection = await runBulkSelectionSmoke(screenshotDir);
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const button = Array.from(document.querySelectorAll('.nav-item')).find((item) =>
        item.textContent && item.textContent.includes('设置')
      );
      if (button) button.click();
      window.setTimeout(resolve, 900);
    })
  `);
  if (process.env.LUMINALINK_SMOKE_SET_PROVIDER) {
    const provider = JSON.stringify(process.env.LUMINALINK_SMOKE_SET_PROVIDER);
    await mainWindow.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const select = document.querySelector('.settings-grid select');
        if (select) {
          select.value = ${provider};
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        window.setTimeout(resolve, 1400);
      })
    `);
  }
  await captureSmokeScreenshot(screenshotDir, '09-settings.png');
  const settingsLayout = await collectLayoutMetrics();
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const button = Array.from(document.querySelectorAll('.nav-item')).find((item) =>
        item.textContent && item.textContent.includes('Codex 协助')
      );
      if (button) button.click();
      window.setTimeout(resolve, 900);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '10-codex-assist.png');
  const finalLayout = await collectLayoutMetrics();
  return { noNotice: noNoticeLayout, detail: detailLayout, settings: settingsLayout, final: finalLayout, readerOpened, hoverAndContext, bulkSelection };
}

async function runHoverAndContextMenuSmoke(screenshotDir: string): Promise<unknown> {
  if (!mainWindow) return undefined;
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const copy = document.querySelector('.asset-copy');
      const rect = copy?.getBoundingClientRect();
      if (copy && rect) {
        copy.dispatchEvent(new MouseEvent('mouseenter', {
          clientX: rect.left + 60,
          clientY: rect.top + 18
        }));
      }
      window.setTimeout(resolve, 500);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '08-description-tooltip.png');
  const tooltip = await mainWindow.webContents.executeJavaScript(`
    (() => ({
      visible: Boolean(document.querySelector('.description-tooltip')),
      textLength: document.querySelector('.description-tooltip')?.textContent?.length ?? 0,
      label: document.querySelector('.description-tooltip strong')?.textContent || '',
      nativeTitle: document.querySelector('.asset-copy')?.getAttribute('title') || ''
    }))()
  `);
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const copy = document.querySelector('.asset-copy');
      const rect = copy?.getBoundingClientRect();
      if (copy && rect) {
        copy.dispatchEvent(new MouseEvent('mouseleave', {
          clientX: rect.left + 60,
          clientY: rect.top + 18
        }));
      }
      window.setTimeout(resolve, 250);
    })
  `);
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const row = document.querySelector('.asset-row');
      const rect = row?.getBoundingClientRect();
      if (row && rect) {
        row.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 220,
          clientY: rect.top + 18
        }));
      }
      window.setTimeout(resolve, 500);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '08-context-menu.png');
  const menu = await mainWindow.webContents.executeJavaScript(`
    (() => ({
      visible: Boolean(document.querySelector('.asset-context-menu')),
      selectedRows: document.querySelectorAll('.asset-row.context-open').length,
      actions: Array.from(document.querySelectorAll('.asset-context-menu button')).map((item) =>
        item.textContent?.trim() || ''
      )
    }))()
  `);
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const button = Array.from(document.querySelectorAll('.asset-context-menu button')).find((item) =>
        item.textContent && item.textContent.includes('复制路径')
      );
      if (button) button.click();
      window.setTimeout(resolve, 500);
    })
  `);
  const afterCopy = await mainWindow.webContents.executeJavaScript(`
    (() => ({
      menuVisible: Boolean(document.querySelector('.asset-context-menu')),
      noticeText: document.querySelector('.notice')?.textContent || ''
    }))()
  `);
  return { tooltip, menu, afterCopy };
}

async function runBulkSelectionSmoke(screenshotDir: string): Promise<unknown> {
  if (!mainWindow) return undefined;
  const before = await mainWindow.webContents.executeJavaScript(`
    (() => ({
      visibleRows: document.querySelectorAll('.asset-row').length,
      rowChecksVisible: document.querySelectorAll('.row-check').length,
      pendingNavText: Array.from(document.querySelectorAll('.nav-item')).find((item) =>
        item.textContent && item.textContent.includes('未翻译')
      )?.textContent || ''
    }))()
  `);
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const button = document.querySelector('.selection-mode-button');
      if (button) button.click();
      window.setTimeout(resolve, 500);
    })
  `);
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const checks = Array.from(document.querySelectorAll('.row-check')).slice(0, 2);
      for (const check of checks) check.click();
      window.setTimeout(resolve, 500);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '08-bulk-selection.png');
  const selected = await mainWindow.webContents.executeJavaScript(`
    (() => ({
      bulkActionsVisible: Boolean(document.querySelector('.bulk-actions')),
      selectedRows: document.querySelectorAll('.asset-row.checked').length,
      rowChecksVisible: document.querySelectorAll('.row-check').length,
      selectedText: document.querySelector('.bulk-actions')?.textContent || ''
    }))()
  `);
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const button = Array.from(document.querySelectorAll('.bulk-actions button')).find((item) =>
        item.textContent && item.textContent.includes('跳过翻译')
      );
      if (button) button.click();
      window.setTimeout(resolve, 1000);
    })
  `);
  await captureSmokeScreenshot(screenshotDir, '08-skip-result.png');
  const after = await mainWindow.webContents.executeJavaScript(`
    (() => ({
      visibleRows: document.querySelectorAll('.asset-row').length,
      bulkActionsVisible: Boolean(document.querySelector('.bulk-actions')),
      rowChecksVisible: document.querySelectorAll('.row-check').length,
      skippedBadges: Array.from(document.querySelectorAll('.status')).filter((item) =>
        item.textContent && item.textContent.includes('已跳过')
      ).length,
      pendingNavText: Array.from(document.querySelectorAll('.nav-item')).find((item) =>
        item.textContent && item.textContent.includes('未翻译')
      )?.textContent || ''
    }))()
  `);
  return { before, selected, after };
}

async function openReaderDuringSmoke(): Promise<boolean> {
  if (!mainWindow) return false;
  const before = BrowserWindow.getAllWindows().length;
  await mainWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const button = document.querySelector('.reader-button');
      if (button) button.click();
      window.setTimeout(resolve, 500);
    })
  `);
  const windows = BrowserWindow.getAllWindows();
  const readerOpened = windows.length > before;
  for (const window of windows) {
    if (window !== mainWindow) {
      window.close();
    }
  }
  return readerOpened;
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
  ipcMain.handle('lumina:translate-asset-live', (event, id: string) =>
    translateAssetById(id, {
      stream: true,
      onProgress: (payload) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('lumina:translation-progress', payload);
        }
      }
    })
  );
  ipcMain.handle('lumina:translate-pending', (_event, limit: number) => translatePending(limit));
  ipcMain.handle('lumina:translate-selected', (_event, assetIds: string[]) => translateSelectedAssets(assetIds));
  ipcMain.handle('lumina:skip-translations', (_event, assetIds: string[]) => skipAssetTranslations(assetIds));
  ipcMain.handle('lumina:doctor', () => doctor());
  ipcMain.handle('lumina:add-root', (_event, pathExpression: string, kind: ScanRootKind) =>
    addRoot(pathExpression, kind)
  );
  ipcMain.handle('lumina:set-translator', (_event, translator: TranslatorConfig) => setTranslatorConfig(translator));
  ipcMain.handle('lumina:add-file', (_event, filePath: string, category: string) => addFile(filePath, category));
  ipcMain.handle('lumina:copy-text', (_event, text: string) => {
    clipboard.writeText(String(text ?? ''));
    return true;
  });
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
  ipcMain.handle('lumina:open-reader', async (_event, payload: ReaderWindowPayload) => openReaderWindow(payload));
}

async function openReaderWindow(payload: ReaderWindowPayload): Promise<{ ok: boolean; message: string }> {
  const reader = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 680,
    minHeight: 480,
    title: `${payload.title} - LuminaLink`,
    backgroundColor: '#fbfdfc',
    autoHideMenuBar: true,
    parent: mainWindow,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  reader.setMenuBarVisibility(false);
  await reader.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildReaderHtml(payload))}`);
  return { ok: true, message: '已打开阅读窗口' };
}

function buildReaderHtml(payload: ReaderWindowPayload): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(payload.title)} - LuminaLink</title>
  <style>
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body {
      margin: 0;
      color: #172326;
      background: #fbfdfc;
      font-family: Inter, "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 1;
      border-bottom: 1px solid #dfe8e6;
      background: rgba(251, 253, 252, 0.96);
      padding: 22px 32px 18px;
      backdrop-filter: blur(10px);
    }
    h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.25;
    }
    p {
      margin: 6px 0 0;
      color: #667579;
      font-size: 13px;
    }
    main {
      max-width: 920px;
      margin: 0 auto;
      padding: 28px 32px 48px;
    }
    article {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: #253538;
      font-size: 16px;
      line-height: 1.82;
    }
    article.source {
      border: 1px solid #dfe8e6;
      border-radius: 8px;
      background: #ffffff;
      padding: 18px;
      font-family: "Cascadia Mono", Consolas, monospace;
      font-size: 13px;
      line-height: 1.68;
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(payload.title)}</h1>
    <p>${escapeHtml(payload.subtitle || modeLabel(payload.mode))}</p>
  </header>
  <main>
    <article class="${payload.mode === 'source' || payload.mode === 'metadata' ? 'source' : ''}">${escapeHtml(payload.content)}</article>
  </main>
</body>
</html>`;
}

function modeLabel(mode: ReaderWindowPayload['mode']): string {
  if (mode === 'translation') return '中文译文';
  if (mode === 'source') return '原文';
  return '元数据';
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
