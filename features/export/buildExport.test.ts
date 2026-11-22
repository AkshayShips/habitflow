import { Device, FakeServer, H1, adapt, t } from '@/features/sync/testing/harness';
import { buildExport, exportFileName, serializeExport } from './buildExport';

const setup = () => {
  const d = new Device('A', new FakeServer());
  d.addHabit(H1, 'Read', t(1));
  d.setLog('aaaaaaaa-0000-4000-8000-000000000001', H1, '2026-11-17', 'done', t(2));
  d.setLog('aaaaaaaa-0000-4000-8000-000000000002', H1, '2026-11-18', 'done', t(3));
  d.clearLog(H1, '2026-11-18', t(4)); // soft-deleted: must not be exported
  d.raw.prepare("INSERT INTO journal_entries (id, entry_date, body, mood, created_at, updated_at) VALUES ('j1','2026-11-17','private text',4,'x','x')").run();
  d.raw.prepare("INSERT INTO journal_entries (id, entry_date, body, created_at, updated_at, deleted_at) VALUES ('j2','2026-11-16','deleted','x','x','x')").run();
  d.raw.prepare("INSERT INTO habit_effort_levels (id, habit_id, level, target_value, created_at, updated_at) VALUES ('e1', ?, 'minimum', 2, 'x', 'x')").run(H1);
  return adapt(d.raw) as never;
};

describe('buildExport', () => {
  it('exports only live rows, without internal sync fields', async () => {
    const e = await buildExport(setup(), ['habits', 'checkins', 'journal'], new Date('2026-11-22T10:00:00Z'));
    expect(e.exportedAt).toBe('2026-11-22T10:00:00.000Z');
    expect(e.habits).toHaveLength(1);
    expect(e.checkins).toEqual([expect.objectContaining({ habit_id: H1, log_date: '2026-11-17', status: 'done' })]);
    expect(e.journal).toEqual([expect.objectContaining({ entry_date: '2026-11-17', body: 'private text', mood: 4 })]);
    expect(e.habitEffortLevels).toEqual([{ habit_id: H1, level: 'minimum', target_value: 2 }]);
    expect(JSON.stringify(e)).not.toMatch(/"dirty"|"deleted_at"/);
  });

  it('parses cadence_config into an object', async () => {
    const e = await buildExport(setup(), ['habits']);
    expect((e.habits?.[0] as { cadence_config: unknown }).cadence_config).toEqual({});
  });

  it('includes only the chosen sets', async () => {
    const e = await buildExport(setup(), ['journal']);
    expect(e.journal).toBeDefined();
    expect(e.habits).toBeUndefined();
    expect(e.checkins).toBeUndefined();
  });

  it('serializes to valid JSON and names the file by date', async () => {
    const e = await buildExport(setup(), ['habits', 'journal'], new Date('2026-11-22T10:00:00Z'));
    expect(JSON.parse(serializeExport(e)).formatVersion).toBe(1);
    expect(exportFileName(new Date('2026-11-22T10:00:00Z'))).toBe('habitflow-export-2026-11-22.json');
  });
});
