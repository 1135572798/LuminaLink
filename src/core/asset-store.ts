import fs from 'node:fs/promises';
import path from 'node:path';
import type { Database } from 'sql.js';
import type {
  Asset,
  AssetType,
  DashboardSummary,
  RiskLevel,
  ScanRoot,
  TranslationStatus
} from '../shared/types.js';
import { makeId, nowIso } from './fs-utils.js';
import { selectAll, selectOne, run } from './sql.js';

interface AssetRow {
  id: string;
  source_file_id: string;
  type: AssetType;
  name: string;
  display_name: string;
  source_path: string;
  source_root: string;
  original_description: string;
  chinese_description: string;
  content_hash: string;
  tags_json: string;
  project_name?: string;
  version?: string;
  last_modified_at: string;
  discovered_at: string;
  updated_at: string;
  translation_status: TranslationStatus;
  favorite: number;
  risk_level: RiskLevel;
}

export interface UpsertAssetInput {
  sourcePath: string;
  sourceRoot: string;
  type: AssetType;
  name: string;
  displayName: string;
  originalDescription: string;
  chineseDescription?: string;
  contentHash: string;
  fileKind: string;
  detectedLang: string;
  tags: string[];
  translationStatus: TranslationStatus;
  riskLevel: RiskLevel;
  categories: string[];
}

export async function upsertScanRoot(db: Database, root: ScanRoot): Promise<void> {
  run(
    db,
    `insert into scan_roots (id, label, path_expression, expanded_path, kind, enabled)
     values (?, ?, ?, ?, ?, ?)
     on conflict(id) do update set
       label = excluded.label,
       path_expression = excluded.path_expression,
       expanded_path = excluded.expanded_path,
       kind = excluded.kind,
       enabled = excluded.enabled`,
    [root.id, root.label, root.pathExpression, root.expandedPath, root.kind, root.enabled ? 1 : 0]
  );
}

export async function upsertAsset(db: Database, input: UpsertAssetInput): Promise<'created' | 'updated' | 'unchanged'> {
  const stat = await fs.stat(input.sourcePath);
  const now = nowIso();
  const sourceFileId = makeId('src', input.sourcePath);
  const existing = selectOne<{ content_hash: string }>(
    db,
    'select content_hash from assets where source_path = ?',
    [input.sourcePath]
  );
  const state = !existing ? 'created' : existing.content_hash === input.contentHash ? 'unchanged' : 'updated';
  const assetId = makeId('asset', input.sourcePath);

  run(
    db,
    `insert into source_files
      (id, path, content_hash, size, last_modified_at, file_kind, title, detected_lang, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(path) do update set
      content_hash = excluded.content_hash,
      size = excluded.size,
      last_modified_at = excluded.last_modified_at,
      file_kind = excluded.file_kind,
      title = excluded.title,
      detected_lang = excluded.detected_lang,
      updated_at = excluded.updated_at`,
    [
      sourceFileId,
      input.sourcePath,
      input.contentHash,
      stat.size,
      stat.mtime.toISOString(),
      input.fileKind,
      input.name,
      input.detectedLang,
      now
    ]
  );

  run(
    db,
    `insert into assets
      (id, source_file_id, type, name, display_name, source_path, source_root,
       original_description, chinese_description, content_hash, tags_json,
       last_modified_at, discovered_at, updated_at, translation_status, favorite, risk_level)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(source_path) do update set
       source_file_id = excluded.source_file_id,
       type = excluded.type,
       name = excluded.name,
       display_name = excluded.display_name,
       source_root = excluded.source_root,
       original_description = excluded.original_description,
       chinese_description = case
         when assets.content_hash = excluded.content_hash then assets.chinese_description
         when assets.translation_status in ('translated', 'stale') then assets.chinese_description
         else excluded.chinese_description
       end,
       content_hash = excluded.content_hash,
       tags_json = excluded.tags_json,
       last_modified_at = excluded.last_modified_at,
       updated_at = excluded.updated_at,
      translation_status = case
         when assets.content_hash = excluded.content_hash then assets.translation_status
         when assets.translation_status = 'skipped' then 'skipped'
         when assets.translation_status in ('translated', 'stale') then 'stale'
         else excluded.translation_status
       end,
       risk_level = excluded.risk_level`,
    [
      assetId,
      sourceFileId,
      input.type,
      input.name,
      input.displayName,
      input.sourcePath,
      input.sourceRoot,
      input.originalDescription,
      input.chineseDescription ?? '',
      input.contentHash,
      JSON.stringify(input.tags),
      stat.mtime.toISOString(),
      now,
      now,
      input.translationStatus,
      0,
      input.riskLevel
    ]
  );

  for (const category of input.categories) {
    addAssetToCategory(db, assetId, category);
  }

  return state;
}

export function addAssetToCategory(db: Database, assetId: string, categoryName: string): void {
  const id = makeId('cat', categoryName);
  run(
    db,
    `insert into categories (id, name, created_at)
     values (?, ?, ?)
     on conflict(name) do nothing`,
    [id, categoryName, nowIso()]
  );
  const category = selectOne<{ id: string }>(db, 'select id from categories where name = ?', [categoryName]);
  if (category) {
    run(
      db,
      `insert into asset_categories (asset_id, category_id)
       values (?, ?)
       on conflict(asset_id, category_id) do nothing`,
      [assetId, category.id]
    );
  }
}

export function listAssets(db: Database, query = '', filter = 'all'): Asset[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (query.trim()) {
    where.push('(display_name like ? or original_description like ? or chinese_description like ? or source_path like ?)');
    const like = `%${query.trim()}%`;
    params.push(like, like, like, like);
  }
  if (filter !== 'all') {
    if (filter === 'untranslated') {
      where.push("translation_status in ('none', 'stale', 'failed')");
    } else {
      where.push('type = ?');
      params.push(filter);
    }
  }

  const sql = `
    select * from assets
    ${where.length ? `where ${where.join(' and ')}` : ''}
    order by updated_at desc
    limit 500
  `;
  return selectAll<AssetRow>(db, sql, params).map((row) => mapAssetRow(db, row));
}

export function getAsset(db: Database, id: string): Asset | undefined {
  const row = selectOne<AssetRow>(db, 'select * from assets where id = ?', [id]);
  return row ? mapAssetRow(db, row) : undefined;
}

export function getAssetBody(db: Database, id: string): string {
  const row = selectOne<{ source_path: string }>(db, 'select source_path from assets where id = ?', [id]);
  if (!row) return '';
  return row.source_path;
}

export function updateAssetTranslation(
  db: Database,
  assetId: string,
  translatedText: string,
  status: TranslationStatus
): void {
  run(
    db,
    `update assets
     set chinese_description = ?, translation_status = ?, updated_at = ?
     where id = ?`,
    [translatedText, status, nowIso(), assetId]
  );
}

export function updateAssetTranslationStatus(
  db: Database,
  assetId: string,
  status: TranslationStatus,
  translatedText?: string
): void {
  if (translatedText !== undefined) {
    updateAssetTranslation(db, assetId, translatedText, status);
    return;
  }
  run(
    db,
    `update assets
     set translation_status = ?, updated_at = ?
     where id = ?`,
    [status, nowIso(), assetId]
  );
}

export function dashboardSummary(db: Database): DashboardSummary {
  const count = (sql: string, params: unknown[] = []) =>
    Number(selectOne<{ count: number }>(db, sql, params)?.count ?? 0);
  return {
    assetsTotal: count('select count(*) as count from assets'),
    skillTotal: count("select count(*) as count from assets where type = 'skill'"),
    pluginTotal: count("select count(*) as count from assets where type = 'plugin'"),
    agentTotal: count("select count(*) as count from assets where type = 'agent_file'"),
    fileTotal: count(
      "select count(*) as count from assets where type in ('generic_file', 'markdown_doc', 'text_doc', 'project_doc')"
    ),
    translatedTotal: count("select count(*) as count from assets where translation_status = 'translated'"),
    pendingTranslationTotal: count("select count(*) as count from assets where translation_status in ('none', 'stale', 'failed')"),
    staleTranslationTotal: count("select count(*) as count from assets where translation_status = 'stale'"),
    failedTotal: count("select count(*) as count from assets where translation_status = 'failed'"),
    skippedTotal: count("select count(*) as count from assets where translation_status = 'skipped'"),
    riskTotal: count("select count(*) as count from assets where risk_level != 'none'"),
    recentAssets: selectAll<AssetRow>(db, 'select * from assets order by discovered_at desc limit 8').map((row) =>
      mapAssetRow(db, row)
    )
  };
}

function mapAssetRow(db: Database, row: AssetRow): Asset {
  const categories = selectAll<{ name: string }>(
    db,
    `select c.name
     from categories c
     join asset_categories ac on ac.category_id = c.id
     where ac.asset_id = ?
     order by c.name`,
    [row.id]
  ).map((item) => item.name);

  return {
    id: row.id,
    sourceFileId: row.source_file_id,
    type: row.type,
    name: row.name,
    displayName: row.display_name,
    sourcePath: row.source_path,
    sourceRoot: row.source_root,
    originalDescription: row.original_description,
    chineseDescription: row.chinese_description,
    contentHash: row.content_hash,
    tags: JSON.parse(row.tags_json || '[]') as string[],
    categories,
    projectName: row.project_name,
    version: row.version,
    lastModifiedAt: row.last_modified_at,
    discoveredAt: row.discovered_at,
    updatedAt: row.updated_at,
    translationStatus: row.translation_status,
    favorite: Boolean(row.favorite),
    riskLevel: row.risk_level
  };
}
