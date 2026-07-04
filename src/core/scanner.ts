import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import type { ScanRoot, ScanSummary, TranslationStatus } from '../shared/types.js';
import { upsertAsset, upsertScanRoot } from './asset-store.js';
import { loadConfig, expandScanRoots } from './config.js';
import { openIndexStore, openTranslationStore } from './database.js';
import { getFileHash, makeId, nowIso, pathExists } from './fs-utils.js';
import { needsChineseTranslation } from './language.js';
import { parseAssetFile } from './parser.js';
import { run } from './sql.js';
import { getTranslation } from './translation-store.js';

const defaultIgnores = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/release/**',
  '**/.venv/**',
  '**/target/**'
];

const supportedGenericExt = new Set(['.md', '.txt', '.json', '.toml', '.yaml', '.yml']);

export async function scanAll(): Promise<ScanSummary> {
  const config = await loadConfig();
  const roots = expandScanRoots(config).filter((root) => root.enabled);
  const indexStore = await openIndexStore();
  const translationStore = await openTranslationStore();
  const runId = makeId('scan');
  const startedAt = nowIso();
  const summary = {
    runId,
    startedAt,
    finishedAt: '',
    scannedRoots: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    removed: 0,
    failed: 0
  };

  run(
    indexStore.db,
    'insert into scan_runs (id, started_at, scanned_roots) values (?, ?, ?)',
    [runId, startedAt, roots.length]
  );

  for (const root of roots) {
    await upsertScanRoot(indexStore.db, root);
    if (!(await pathExists(root.expandedPath))) {
      logScanEvent(indexStore.db, runId, 'warn', `扫描目录不存在: ${root.expandedPath}`, root.expandedPath);
      continue;
    }
    summary.scannedRoots += 1;
    const files = await findAssetFiles(root);
    for (const filePath of files) {
      try {
        const state = await parseAndUpsertFile(root, filePath, translationStore.db, indexStore.db);
        summary[state] += 1;
      } catch (error) {
        summary.failed += 1;
        logScanEvent(
          indexStore.db,
          runId,
          'error',
          error instanceof Error ? error.message : String(error),
          filePath
        );
      }
    }
  }

  summary.finishedAt = nowIso();
  run(
    indexStore.db,
    `update scan_runs
     set finished_at = ?, scanned_roots = ?, created = ?, updated = ?, unchanged = ?, removed = ?, failed = ?
     where id = ?`,
    [
      summary.finishedAt,
      summary.scannedRoots,
      summary.created,
      summary.updated,
      summary.unchanged,
      summary.removed,
      summary.failed,
      runId
    ]
  );
  await indexStore.save();
  await translationStore.save();
  indexStore.close();
  translationStore.close();
  return summary;
}

export async function addGenericFile(filePath: string, category = '其他文件'): Promise<ScanSummary> {
  const absolutePath = path.resolve(filePath);
  const root: ScanRoot = {
    id: makeId('direct-root', absolutePath),
    label: 'Direct File',
    pathExpression: path.dirname(absolutePath),
    expandedPath: path.dirname(absolutePath),
    kind: 'custom',
    enabled: true
  };
  const indexStore = await openIndexStore();
  const translationStore = await openTranslationStore();
  const startedAt = nowIso();
  const runId = makeId('scan');
  run(
    indexStore.db,
    'insert into scan_runs (id, started_at, scanned_roots) values (?, ?, ?)',
    [runId, startedAt, 1]
  );
  const state = await parseAndUpsertFile(root, absolutePath, translationStore.db, indexStore.db, [category]);
  const finishedAt = nowIso();
  const summary: ScanSummary = {
    runId,
    startedAt,
    finishedAt,
    scannedRoots: 1,
    created: state === 'created' ? 1 : 0,
    updated: state === 'updated' ? 1 : 0,
    unchanged: state === 'unchanged' ? 1 : 0,
    removed: 0,
    failed: 0
  };
  run(
    indexStore.db,
    `update scan_runs
     set finished_at = ?, scanned_roots = ?, created = ?, updated = ?, unchanged = ?
     where id = ?`,
    [finishedAt, 1, summary.created, summary.updated, summary.unchanged, runId]
  );
  await indexStore.save();
  await translationStore.save();
  indexStore.close();
  translationStore.close();
  return summary;
}

async function findAssetFiles(root: ScanRoot): Promise<string[]> {
  const cwd = root.expandedPath;
  const patterns = patternsForRoot(root);
  const results = await fg(patterns, {
    cwd,
    absolute: true,
    onlyFiles: true,
    ignore: defaultIgnores,
    dot: true,
    unique: true
  });
  return results.sort();
}

function patternsForRoot(root: ScanRoot): string[] {
  if (root.kind === 'codex_skills' || root.kind === 'agents_skills') {
    return ['**/SKILL.md'];
  }
  if (root.kind === 'codex_plugins') {
    return ['**/SKILL.md', '**/README.md', '**/plugin.json', '**/package.json'];
  }
  if (root.kind === 'codex_agents') {
    return ['**/*.toml'];
  }
  if (root.kind === 'project_root') {
    return ['**/AGENTS.md', '**/AGENT.md', '**/Agent.md', '**/CLAUDE.md', '**/.cursorrules'];
  }
  if (root.kind === 'docs_root') {
    return ['**/*.md', '**/*.txt'];
  }
  return [
    '**/SKILL.md',
    '**/AGENTS.md',
    '**/Agent.md',
    '**/README.md',
    '**/*.md',
    '**/*.txt',
    '**/*.toml',
    '**/*.json',
    '**/*.yaml',
    '**/*.yml'
  ];
}

async function parseAndUpsertFile(
  root: ScanRoot,
  filePath: string,
  translationDb: import('sql.js').Database,
  indexDb: import('sql.js').Database,
  extraCategories: string[] = []
): Promise<'created' | 'updated' | 'unchanged'> {
  const ext = path.extname(filePath);
  if (!supportedGenericExt.has(ext) && path.basename(filePath) !== '.cursorrules') {
    throw new Error(`暂不支持的文件类型: ${filePath}`);
  }
  await fs.access(filePath);
  const parsed = await parseAssetFile(filePath, root.kind);
  const hash = await getFileHash(filePath);
  const cached = getTranslation(translationDb, hash, 'zh-CN', 'full');
  const translationStatus: TranslationStatus = cached
    ? 'translated'
    : needsChineseTranslation(`${parsed.name}\n${parsed.description}\n${parsed.body}`)
      ? 'none'
      : 'translated';

  const categories = inferCategories(parsed.type, extraCategories);
  return upsertAsset(indexDb, {
    sourcePath: filePath,
    sourceRoot: root.expandedPath,
    type: parsed.type,
    name: parsed.name,
    displayName: parsed.displayName,
    originalDescription: parsed.description || parsed.body.slice(0, 800),
    chineseDescription: cached?.translatedText.slice(0, 1200) ?? '',
    contentHash: hash,
    fileKind: ext || path.basename(filePath),
    detectedLang: parsed.detectedLang,
    tags: parsed.tags,
    translationStatus,
    riskLevel: parsed.riskLevel,
    categories
  });
}

function inferCategories(type: string, extra: string[]): string[] {
  const base =
    type === 'skill'
      ? 'Skill'
      : type === 'plugin'
        ? 'Plugin'
        : type === 'agent_file'
          ? 'Agent 配置'
          : type === 'project_doc'
            ? '项目文档'
            : '其他文件';
  return Array.from(new Set([base, ...extra].filter(Boolean)));
}

function logScanEvent(
  db: import('sql.js').Database,
  runId: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  sourcePath?: string
): void {
  run(
    db,
    `insert into scan_events (id, run_id, level, message, source_path, created_at)
     values (?, ?, ?, ?, ?, ?)`,
    [makeId('event'), runId, level, message, sourcePath ?? null, nowIso()]
  );
}
