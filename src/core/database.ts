import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { ensureDir, pathExists } from './fs-utils.js';
import { getLuminaPaths } from './paths.js';
import { indexSchema, translationSchema } from './schema.js';

const require = createRequire(import.meta.url);

let sqlPromise: Promise<SqlJsStatic> | undefined;

async function getSql(): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs({
    locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm')
  });
  return sqlPromise;
}

export class SqliteStore {
  private constructor(
    private readonly dbPath: string,
    public readonly db: Database
  ) {}

  static async open(dbPath: string, schema: string): Promise<SqliteStore> {
    const SQL = await getSql();
    await ensureDir(path.dirname(dbPath));
    const exists = await pathExists(dbPath);
    const db = exists ? new SQL.Database(await fs.readFile(dbPath)) : new SQL.Database();
    db.run(schema);
    const store = new SqliteStore(dbPath, db);
    await store.save();
    return store;
  }

  async save(): Promise<void> {
    const data = this.db.export();
    await fs.writeFile(this.dbPath, Buffer.from(data));
  }

  close(): void {
    this.db.close();
  }
}

export async function openIndexStore(): Promise<SqliteStore> {
  return SqliteStore.open(getLuminaPaths().indexDbPath, indexSchema);
}

export async function openTranslationStore(): Promise<SqliteStore> {
  return SqliteStore.open(getLuminaPaths().translationDbPath, translationSchema);
}
