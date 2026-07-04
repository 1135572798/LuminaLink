import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Asset,
  DashboardSummary,
  DoctorReport,
  OperationResult,
  ScanRootKind,
  ScanSummary,
  TranslatorConfig
} from '../shared/types.js';
import { addScanRoot, expandScanRoots, loadConfig, saveConfig } from './config.js';
import { openIndexStore, openTranslationStore } from './database.js';
import { dashboardSummary, getAsset, listAssets, updateAssetTranslation } from './asset-store.js';
import { ensureDir, makeId, pathExists } from './fs-utils.js';
import { getLuminaPaths } from './paths.js';
import { addGenericFile, scanAll } from './scanner.js';
import { selectAll } from './sql.js';
import { isProviderConfigured, getTranslation, upsertTranslation } from './translation-store.js';
import { translateText } from './translator.js';

export async function getStatus(): Promise<OperationResult> {
  const config = await loadConfig();
  const paths = getLuminaPaths();
  const indexExists = await pathExists(paths.indexDbPath);
  const translationExists = await pathExists(paths.translationDbPath);
  return {
    ok: true,
    message: 'LuminaLink 状态已读取',
    data: {
      paths,
      scanRoots: expandScanRoots(config),
      translator: {
        provider: config.translator.provider,
        configured: isProviderConfigured(config.translator)
      },
      databases: {
        indexExists,
        translationExists
      }
    }
  };
}

export async function runScan(): Promise<ScanSummary> {
  return scanAll();
}

export async function addRoot(pathExpression: string, kind: ScanRootKind, label?: string): Promise<OperationResult> {
  const id = makeId('root', `${kind}:${pathExpression}`);
  await addScanRoot({
    id,
    label: label ?? (path.basename(pathExpression) || kind),
    pathExpression,
    kind,
    enabled: true
  });
  return {
    ok: true,
    message: `已添加扫描目录: ${pathExpression}`
  };
}

export async function setTranslatorConfig(translator: TranslatorConfig): Promise<OperationResult> {
  const config = await loadConfig();
  config.translator = translator;
  await saveConfig(config);
  return {
    ok: true,
    message: `翻译 Provider 已设置为 ${translator.provider}`
  };
}

export async function addFile(filePath: string, category = '其他文件'): Promise<ScanSummary> {
  return addGenericFile(filePath, category);
}

export async function searchAssets(query = '', filter = 'all'): Promise<Asset[]> {
  const store = await openIndexStore();
  const assets = listAssets(store.db, query, filter);
  store.close();
  return assets;
}

export async function showAsset(id: string): Promise<(Asset & { sourceText: string; translatedText: string }) | undefined> {
  const indexStore = await openIndexStore();
  const translationStore = await openTranslationStore();
  const asset = getAsset(indexStore.db, id);
  if (!asset) {
    indexStore.close();
    translationStore.close();
    return undefined;
  }
  const sourceText = await fs.readFile(asset.sourcePath, 'utf8');
  const cached = getTranslation(translationStore.db, asset.contentHash, 'zh-CN', 'full');
  indexStore.close();
  translationStore.close();
  return {
    ...asset,
    sourceText,
    translatedText: cached?.translatedText ?? asset.chineseDescription
  };
}

export async function getDashboard(): Promise<DashboardSummary> {
  const store = await openIndexStore();
  const summary = dashboardSummary(store.db);
  store.close();
  return summary;
}

export async function listPendingTranslations(): Promise<Asset[]> {
  return searchAssets('', 'untranslated');
}

export async function translateAssetById(id: string): Promise<OperationResult> {
  const config = await loadConfig();
  if (!isProviderConfigured(config.translator)) {
    return {
      ok: false,
      message: '翻译 Provider 未配置。请在设置中配置 OpenAI 或本地 OpenAI-compatible Provider。'
    };
  }

  const indexStore = await openIndexStore();
  const translationStore = await openTranslationStore();
  const asset = getAsset(indexStore.db, id);
  if (!asset) {
    indexStore.close();
    translationStore.close();
    return { ok: false, message: `资产不存在: ${id}` };
  }

  const cached = getTranslation(translationStore.db, asset.contentHash, config.translator.targetLang, 'full');
  if (cached) {
    updateAssetTranslation(indexStore.db, asset.id, cached.translatedText.slice(0, 1200), 'translated');
    await indexStore.save();
    indexStore.close();
    translationStore.close();
    return { ok: true, message: '已复用翻译缓存', data: cached };
  }

  const sourceText = await fs.readFile(asset.sourcePath, 'utf8');
  try {
    const result = await translateText(config.translator, {
      sourceText: sourceText.slice(0, 24000),
      sourceLang: 'auto',
      targetLang: config.translator.targetLang,
      scope: 'full'
    });
    const record = upsertTranslation(translationStore.db, {
      sourceHash: asset.contentHash,
      sourceLang: 'auto',
      targetLang: config.translator.targetLang,
      scope: 'full',
      sourceText,
      translatedText: result.translatedText,
      provider: result.provider
    });
    updateAssetTranslation(indexStore.db, asset.id, record.translatedText.slice(0, 1200), 'translated');
    await indexStore.save();
    await translationStore.save();
    indexStore.close();
    translationStore.close();
    return { ok: true, message: '翻译完成', data: record };
  } catch (error) {
    updateAssetTranslation(indexStore.db, asset.id, asset.chineseDescription, 'failed');
    await indexStore.save();
    indexStore.close();
    translationStore.close();
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function translatePending(limit = 10): Promise<OperationResult> {
  const pending = (await listPendingTranslations()).slice(0, limit);
  const results = [];
  for (const asset of pending) {
    results.push({ assetId: asset.id, ...(await translateAssetById(asset.id)) });
  }
  return {
    ok: results.every((item) => item.ok),
    message: `处理翻译任务 ${results.length} 个`,
    data: results
  };
}

export async function exportMigration(outputFile: string): Promise<OperationResult> {
  const config = await loadConfig();
  const translationStore = await openTranslationStore();
  const translations = selectAll(translationStore.db, 'select * from translation_records order by updated_at desc');
  translationStore.close();
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'LuminaLink',
    version: 1,
    config: {
      ...config,
      translator: {
        ...config.translator,
        apiKeySource: config.translator.apiKeySource ? 'redacted' : undefined
      }
    },
    translations
  };
  await ensureDir(path.dirname(outputFile));
  await fs.writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return {
    ok: true,
    message: `迁移包已导出: ${outputFile}`
  };
}

export async function importMigration(inputFile: string): Promise<OperationResult> {
  const raw = await fs.readFile(inputFile, 'utf8');
  const payload = JSON.parse(raw) as {
    config?: Awaited<ReturnType<typeof loadConfig>>;
    translations?: Array<Record<string, unknown>>;
  };
  if (payload.config) {
    const current = await loadConfig();
    await saveConfig({
      ...current,
      scanRoots: payload.config.scanRoots ?? current.scanRoots,
      language: payload.config.language ?? current.language,
      theme: payload.config.theme ?? current.theme,
      autoTranslate: payload.config.autoTranslate ?? current.autoTranslate
    });
  }
  if (payload.translations?.length) {
    const store = await openTranslationStore();
    for (const item of payload.translations) {
      if (!item.source_hash || !item.translated_text) continue;
      upsertTranslation(store.db, {
        sourceHash: String(item.source_hash),
        sourceLang: String(item.source_lang ?? 'auto'),
        targetLang: String(item.target_lang ?? 'zh-CN'),
        scope: String(item.scope ?? 'full'),
        sourceText: String(item.source_text ?? ''),
        translatedText: String(item.translated_text),
        provider: String(item.provider ?? 'imported')
      });
    }
    await store.save();
    store.close();
  }
  return {
    ok: true,
    message: '迁移包已导入，建议重新扫描以匹配新电脑路径'
  };
}

export async function doctor(): Promise<DoctorReport> {
  const paths = getLuminaPaths();
  const config = await loadConfig();
  const roots = expandScanRoots(config);
  const checks = [
    {
      name: '配置文件',
      status: (await pathExists(paths.configPath)) ? 'pass' : 'fail',
      detail: paths.configPath
    },
    {
      name: '索引数据库目录',
      status: (await pathExists(paths.localDataDir)) ? 'pass' : 'warn',
      detail: paths.localDataDir
    },
    {
      name: '翻译 Provider',
      status: isProviderConfigured(config.translator) ? 'pass' : 'warn',
      detail: isProviderConfigured(config.translator)
        ? `${config.translator.provider} 已配置`
        : '未配置 Provider，仍可扫描和查看原文'
    },
    {
      name: '扫描目录',
      status: roots.some((root) => root.enabled) ? 'pass' : 'fail',
      detail: `启用 ${roots.filter((root) => root.enabled).length} 个扫描目录`
    }
  ] as DoctorReport['checks'];

  for (const root of roots.filter((item) => item.enabled)) {
    checks.push({
      name: `扫描目录: ${root.label}`,
      status: (await pathExists(root.expandedPath)) ? 'pass' : 'warn',
      detail: root.expandedPath
    });
  }

  return {
    checks,
    configPath: paths.configPath,
    indexDbPath: paths.indexDbPath,
    translationDbPath: paths.translationDbPath
  };
}
