import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

type Db = Pick<SQLiteDatabase, 'getAllAsync' | 'getFirstAsync' | 'runAsync'>;

export const MAX_BODY = 4000;

export interface JournalEntry {
  date: string;
  body: string;
  mood: number | null;
}

const now = () => new Date().toISOString();

export async function listEntries(db: Db): Promise<JournalEntry[]> {
  const rows = await db.getAllAsync<{ entry_date: string; body: string; mood: number | null }>(
    'SELECT entry_date, body, mood FROM journal_entries WHERE deleted_at IS NULL ORDER BY entry_date DESC',
  );
  return rows.map((r) => ({ date: r.entry_date, body: r.body, mood: r.mood }));
}

/**
 * One entry per date. Saving revives a previously deleted entry for that date. An entry with no text AND no mood is
 * treated as "nothing to keep" and removes the day's entry. A mood alone is a valid entry.
 */
export async function saveEntry(db: Db, date: string, body: string, mood: number | null): Promise<void> {
  const text = body.trim();
  if (text.length > MAX_BODY) throw new Error(`Entries can be up to ${MAX_BODY} characters.`);
  if (mood !== null && !(mood >= 1 && mood <= 5)) throw new Error('Mood must be between 1 and 5.');
  if (text === '' && mood === null) return deleteEntry(db, date);
  const at = now();
  await db.runAsync(
    `INSERT INTO journal_entries (id, entry_date, body, mood, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT (entry_date) DO UPDATE SET body = excluded.body, mood = excluded.mood, deleted_at = NULL,
       updated_at = excluded.updated_at, dirty = 1`,
    [Crypto.randomUUID(), date, text, mood, at, at],
  );
}

export async function deleteEntry(db: Db, date: string): Promise<void> {
  const at = now();
  await db.runAsync(
    'UPDATE journal_entries SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE entry_date = ? AND deleted_at IS NULL',
    [at, at, date],
  );
}
