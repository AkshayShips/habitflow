import * as SQLite from 'expo-sqlite';

import { IS_DEMO } from './demo';
import { seedDemoData } from './demoSeed';
import { MIGRATIONS } from './localMigrations';

const cache = new Map<string, Promise<SQLite.SQLiteDatabase>>();

const fileName = (userId: string) => `habitflow-${userId}.db`;

async function open(userId: string): Promise<SQLite.SQLiteDatabase> {
  // Preview build: keep the database in memory (no persistence, nothing to clean up).
  const db = await SQLite.openDatabaseAsync(IS_DEMO ? ':memory:' : fileName(userId));
  await db.execAsync(IS_DEMO ? 'PRAGMA foreign_keys = ON;' : 'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  for (let v = row?.user_version ?? 0; v < MIGRATIONS.length; v++) {
    const sql = MIGRATIONS[v];
    if (!sql) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
  if (IS_DEMO) await seedDemoData(db);
  return db;
}

export function getDb(userId: string): Promise<SQLite.SQLiteDatabase> {
  let p = cache.get(userId);
  if (!p) {
    p = open(userId);
    cache.set(userId, p);
    p.catch(() => cache.delete(userId)); // allow retry after a failed open
  }
  return p;
}

/** Closes and deletes a user's local database (used when discarding a guest session). */
export async function deleteLocalDb(userId: string): Promise<void> {
  const p = cache.get(userId);
  cache.delete(userId);
  if (p) {
    try {
      await (await p).closeAsync();
    } catch {
      // already closed
    }
  }
  try {
    await SQLite.deleteDatabaseAsync(fileName(userId));
  } catch {
    // nothing to delete
  }
}
