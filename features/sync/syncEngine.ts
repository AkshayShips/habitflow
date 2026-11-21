import {
  SyncRemoteError,
  type Cursor,
  type LocalStore,
  type PullPage,
  type RemoteApi,
  type SyncResult,
  type SyncTable,
} from './types';

const PUSH_BATCH = 100;
const PULL_PAGE = 500;
const MAX_PAGES = 200; // safety valve: 100k rows per table per sync

interface Deps {
  local: LocalStore;
  remote: RemoteApi;
}

/**
 * One full sync pass: push local changes, then pull remote changes.
 *
 * Order matters:
 *   push habits -> push logs   (logs reference habits)
 *   pull habits -> pull logs   (same reason, locally: foreign key)
 *
 * Failure model:
 *   - transient error (network/auth/5xx): abort the pass; everything unsent stays dirty.
 *   - server REJECTS data (validation/RLS/FK): that row is skipped and stays dirty so one bad row
 *     can never block every other change. It is retried (and re-reported) on the next pass.
 */
export async function runSync({ local, remote }: Deps): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, skipped: 0, rejected: 0 };

  await pushTable('habits', result, {
    read: (exclude) => local.getDirtyHabits(PUSH_BATCH, exclude),
    send: (rows) => remote.upsertHabits(rows),
    mark: (rows) => local.markPushed('habits', rows),
  });

  await pushTable('habit_logs', result, {
    read: (exclude) => local.getDirtyLogs(PUSH_BATCH, exclude),
    send: (rows) => remote.upsertLogs(rows),
    mark: (rows) => local.markPushed('habit_logs', rows),
  });

  await pullTable('habits', result, local, (cursor) => remote.pullHabits(cursor, PULL_PAGE), (rows) =>
    local.applyRemoteHabits(rows),
  );
  await pullTable('habit_logs', result, local, (cursor) => remote.pullLogs(cursor, PULL_PAGE), (rows) =>
    local.applyRemoteLogs(rows),
  );

  return result;
}

interface PushOps<T extends { id: string; updated_at: string }> {
  read: (exclude: string[]) => Promise<T[]>;
  send: (rows: T[]) => Promise<void>;
  mark: (rows: { id: string; updated_at: string }[]) => Promise<void>;
}

async function pushTable<T extends { id: string; updated_at: string }>(
  _table: SyncTable,
  result: SyncResult,
  ops: PushOps<T>,
): Promise<void> {
  // Rows the server rejected stay dirty; remember them so we don't loop on them within this pass.
  const rejectedIds = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await ops.read([...rejectedIds]);
    if (batch.length === 0) return;

    try {
      await ops.send(batch);
      await ops.mark(batch.map((r) => ({ id: r.id, updated_at: r.updated_at })));
      result.pushed += batch.length;
    } catch (e) {
      if (isRetryable(e)) throw e;
      // The server rejected something in this batch. Find out which rows are fine.
      for (const row of batch) {
        try {
          await ops.send([row]);
          await ops.mark([{ id: row.id, updated_at: row.updated_at }]);
          result.pushed += 1;
        } catch (rowError) {
          if (isRetryable(rowError)) throw rowError;
          rejectedIds.add(row.id);
          result.rejected += 1;
        }
      }
    }
  }
}

async function pullTable<T>(
  table: SyncTable,
  result: SyncResult,
  local: LocalStore,
  fetchPage: (cursor: Cursor | null) => Promise<PullPage<T>>,
  apply: (rows: T[]) => Promise<{ applied: number; skipped: number }>,
): Promise<void> {
  let cursor = await local.getCursor(table);

  for (let page = 0; page < MAX_PAGES; page++) {
    const { rows, rawCount, last } = await fetchPage(cursor);
    if (rawCount === 0 || last === null) return;

    const counts = await apply(rows);
    result.pulled += counts.applied;
    result.skipped += counts.skipped + (rawCount - rows.length); // include rows dropped by validation

    // Advance only after the page is safely applied, so a crash re-reads it (apply is idempotent).
    cursor = last;
    await local.setCursor(table, cursor);

    if (rawCount < PULL_PAGE) return;
  }
}

function isRetryable(e: unknown): boolean {
  // Unknown errors are treated as transient: better to retry later than to silently drop data.
  return !(e instanceof SyncRemoteError) || e.retryable;
}
