import type { Database } from 'sql.js';

export function selectAll<T extends object>(
  db: Database,
  sql: string,
  params: any[] = []
): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

export function selectOne<T extends object>(
  db: Database,
  sql: string,
  params: any[] = []
): T | undefined {
  return selectAll<T>(db, sql, params)[0];
}

export function run(db: Database, sql: string, params: any[] = []): void {
  db.run(sql, params);
}
