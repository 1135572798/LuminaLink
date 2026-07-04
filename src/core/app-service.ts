import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Asset,
  AgentGuideInfo,
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

export async function getAgentGuide(): Promise<OperationResult<AgentGuideInfo>> {
  const paths = getLuminaPaths();
  const config = await loadConfig();
  const roots = expandScanRoots(config);
  await ensureDir(paths.appDataDir);
  await fs.writeFile(paths.agentRunbookPath, buildAgentRunbook(paths, config, roots), 'utf8');
  const promptText = buildAgentPrompt(paths);
  await fs.writeFile(paths.agentPromptPath, `${promptText}\n`, 'utf8');
  await fs.writeFile(paths.agentHelperPath, buildAgentHelperScript(), 'utf8');
  return {
    ok: true,
    message: 'Agent 操作手册已生成',
    data: {
      runbookPath: paths.agentRunbookPath,
      promptPath: paths.agentPromptPath,
      helperPath: paths.agentHelperPath,
      promptText,
      configPath: paths.configPath,
      indexDbPath: paths.indexDbPath,
      translationDbPath: paths.translationDbPath,
      logsDir: paths.logsDir,
      scanRoots: roots,
      translator: {
        provider: config.translator.provider,
        configured: isProviderConfigured(config.translator),
        apiKeySource: config.translator.apiKeySource
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

function buildAgentPrompt(paths: ReturnType<typeof getLuminaPaths>): string {
  return [
    `请先读取 LuminaLink 的 Agent 操作手册：${paths.agentRunbookPath}`,
    '然后帮我检查 LuminaLink 当前配置、扫描目录和翻译 Provider 状态。',
    `配置文件在：${paths.configPath}`,
    `本机 helper 在：${paths.agentHelperPath}`,
    '如果需要修改配置，请只修改 LuminaLink 本机配置，不要输出或保存 raw API key/token/cookie/私钥。',
    '扫描资产不依赖翻译 Provider；Provider 只影响翻译功能。'
  ].join('\n');
}

function buildAgentRunbook(
  paths: ReturnType<typeof getLuminaPaths>,
  config: Awaited<ReturnType<typeof loadConfig>>,
  roots: ReturnType<typeof expandScanRoots>
): string {
  const rootLines = roots
    .map((root) => `- ${root.label}: ${root.expandedPath} (${root.enabled ? 'enabled' : 'disabled'})`)
    .join('\n');
  return `# LuminaLink Agent Runbook

This file is generated by the installed LuminaLink client. It gives Codex or
another local agent a stable entry point for helping the user configure and
diagnose LuminaLink.

## Important Rule

Do not print raw API keys, tokens, cookies, passwords, or private keys. Report
only whether a secret source is configured and where the setting lives.

## Current Local Paths

Config:
${paths.configPath}

Index database:
${paths.indexDbPath}

Translation cache:
${paths.translationDbPath}

Logs:
${paths.logsDir}

Helper script:
${paths.agentHelperPath}

## Current Scan Roots

${rootLines || '- No scan roots configured'}

## Current Translator

- Provider: ${config.translator.provider}
- Configured: ${isProviderConfigured(config.translator) ? 'yes' : 'no'}
- API key source: ${config.translator.apiKeySource ?? 'not set'}

Important: scanning assets does not require a translation provider. Provider
configuration only affects translation.

## What To Do When The User Says "帮我配置 LuminaLink"

1. Inspect the config and environment with:

   \`\`\`powershell
   powershell -ExecutionPolicy Bypass -File "${paths.agentHelperPath}" status
   \`\`\`

2. If scan roots are missing, reset default scan roots:

   \`\`\`powershell
   powershell -ExecutionPolicy Bypass -File "${paths.agentHelperPath}" reset-default-roots
   \`\`\`

3. If the user wants OpenAI translation and has configured OPENAI_API_KEY as a
   user or machine environment variable:

   \`\`\`powershell
   powershell -ExecutionPolicy Bypass -File "${paths.agentHelperPath}" set-openai-env
   \`\`\`

4. Ask the user to open LuminaLink and click "扫描资产". After scanning, report
   the scan result shown in the app.

5. If the app has no assets after scanning, check whether these directories
   exist on the user's computer:

   \`\`\`text
   %USERPROFILE%/.codex/skills
   %USERPROFILE%/.codex/plugins/cache
   %USERPROFILE%/.agents/skills
   \`\`\`

## UI Hints

- Use "Codex 协助" to copy this prompt or open this runbook.
- Use "检查环境" to verify config, databases, provider, and scan roots.
- Use "扫描资产" to index local skills/plugins/Agent files.
- Use "添加目录" if the user's project or skill folder is outside default roots.
- Use "添加文件" to add one Markdown/text file into a category.
`;
}

function buildAgentHelperScript(): string {
  return `param(
  [Parameter(Position = 0)]
  [ValidateSet('status', 'reset-default-roots', 'set-openai-env')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$appDataDir = Join-Path $env:APPDATA 'LuminaLink'
$localDataDir = Join-Path $env:LOCALAPPDATA 'LuminaLink'
$configPath = Join-Path $appDataDir 'config.json'

function Get-DefaultConfig {
  return [ordered]@{
    version = 1
    language = 'zh-CN'
    theme = 'system'
    autoTranslate = $false
    scanRoots = @(
      [ordered]@{ id = 'codex-skills'; label = 'Codex Skills'; pathExpression = '%USERPROFILE%/.codex/skills'; kind = 'codex_skills'; enabled = $true },
      [ordered]@{ id = 'codex-plugins'; label = 'Codex Plugins'; pathExpression = '%USERPROFILE%/.codex/plugins/cache'; kind = 'codex_plugins'; enabled = $true },
      [ordered]@{ id = 'agent-skills'; label = 'User Agent Skills'; pathExpression = '%USERPROFILE%/.agents/skills'; kind = 'agents_skills'; enabled = $true }
    )
    translator = [ordered]@{ provider = 'noop'; targetLang = 'zh-CN' }
  }
}

function Read-Config {
  if (Test-Path -LiteralPath $configPath) {
    return Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
  }
  return Get-DefaultConfig
}

function Write-Config($config) {
  New-Item -ItemType Directory -Force -Path $appDataDir | Out-Null
  $json = $config | ConvertTo-Json -Depth 12
  [System.IO.File]::WriteAllText($configPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

function Test-EnvKey($name) {
  return [bool](
    [Environment]::GetEnvironmentVariable($name, 'Process') -or
    [Environment]::GetEnvironmentVariable($name, 'User') -or
    [Environment]::GetEnvironmentVariable($name, 'Machine')
  )
}

if ($Action -eq 'reset-default-roots') {
  $config = Read-Config
  $defaults = Get-DefaultConfig
  $config.scanRoots = $defaults.scanRoots
  if (-not $config.translator) { $config | Add-Member -NotePropertyName translator -NotePropertyValue $defaults.translator }
  Write-Config $config
}

if ($Action -eq 'set-openai-env') {
  $config = Read-Config
  $config.translator = [ordered]@{
    provider = 'openai'
    model = 'gpt-4.1-mini'
    targetLang = 'zh-CN'
    apiKeySource = 'env:OPENAI_API_KEY'
  }
  Write-Config $config
}

$config = Read-Config
[pscustomobject]@{
  ok = $true
  action = $Action
  configPath = $configPath
  indexDbPath = Join-Path $localDataDir 'luminalink.sqlite'
  translationDbPath = Join-Path $localDataDir 'translation-cache.sqlite'
  indexExists = Test-Path -LiteralPath (Join-Path $localDataDir 'luminalink.sqlite')
  translationDbExists = Test-Path -LiteralPath (Join-Path $localDataDir 'translation-cache.sqlite')
  scanRoots = $config.scanRoots
  translator = $config.translator
  openaiApiKeyVisibleToUserOrMachine = Test-EnvKey 'OPENAI_API_KEY'
  note = 'Scanning is done in the LuminaLink app with the Scan Assets button. Translation requires a configured provider.'
} | ConvertTo-Json -Depth 12
`;
}
