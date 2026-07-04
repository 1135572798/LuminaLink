import type { Database } from 'sql.js';
import type { TranslationRecord, TranslatorConfig } from '../shared/types.js';
import { hashText, makeId, nowIso } from './fs-utils.js';
import { selectAll, selectOne, run } from './sql.js';

interface TranslationRow {
  id: string;
  source_hash: string;
  source_lang: string;
  target_lang: string;
  scope: string;
  source_text: string;
  translated_text: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

export function getTranslation(
  db: Database,
  sourceHash: string,
  targetLang = 'zh-CN',
  scope = 'full'
): TranslationRecord | undefined {
  const row = selectOne<TranslationRow>(
    db,
    'select * from translation_records where source_hash = ? and target_lang = ? and scope = ?',
    [sourceHash, targetLang, scope]
  );
  return row ? mapTranslation(row) : undefined;
}

export function upsertTranslation(
  db: Database,
  input: {
    sourceHash: string;
    sourceLang: string;
    targetLang: string;
    scope: string;
    sourceText: string;
    translatedText: string;
    provider: string;
  }
): TranslationRecord {
  const now = nowIso();
  const id = makeId('tr', `${input.sourceHash}:${input.targetLang}:${input.scope}`);
  run(
    db,
    `insert into translation_records
      (id, source_hash, source_lang, target_lang, scope, source_text, translated_text, provider, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(source_hash, target_lang, scope) do update set
       source_text = excluded.source_text,
       translated_text = excluded.translated_text,
       provider = excluded.provider,
       updated_at = excluded.updated_at`,
    [
      id,
      input.sourceHash,
      input.sourceLang,
      input.targetLang,
      input.scope,
      input.sourceText,
      input.translatedText,
      input.provider,
      now,
      now
    ]
  );
  return getTranslation(db, input.sourceHash, input.targetLang, input.scope)!;
}

export function listTranslations(db: Database): TranslationRecord[] {
  return selectAll<TranslationRow>(db, 'select * from translation_records order by updated_at desc').map(mapTranslation);
}

export function makeTranslationHash(sourceText: string): string {
  return hashText(sourceText);
}

export function isProviderConfigured(config: TranslatorConfig): boolean {
  if (config.provider === 'noop') return false;
  if (config.provider === 'openai') return Boolean(resolveApiKey(config.apiKeySource));
  if (config.provider === 'openai-compatible') return Boolean(config.baseUrl);
  return false;
}

export function resolveApiKey(source?: string): string | undefined {
  if (!source) return undefined;
  if (source.startsWith('env:')) {
    return process.env[source.slice(4)];
  }
  return undefined;
}

function mapTranslation(row: TranslationRow): TranslationRecord {
  return {
    id: row.id,
    sourceHash: row.source_hash,
    sourceLang: row.source_lang,
    targetLang: row.target_lang,
    scope: row.scope,
    sourceText: row.source_text,
    translatedText: row.translated_text,
    provider: row.provider,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
