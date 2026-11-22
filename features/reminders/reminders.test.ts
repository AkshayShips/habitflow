import { applyReminder, type NotificationsDriver } from './reminderScheduler';
import { formatTime, parseReminderSettings, DEFAULT_REMINDER } from './reminderSettings';

function fake(perm: 'granted' | 'denied' | 'undetermined', askResult: 'granted' | 'denied' = 'granted') {
  const calls: string[] = [];
  const d: NotificationsDriver = {
    getPermission: async () => perm,
    requestPermission: async () => (calls.push('ask'), askResult),
    cancelAll: async () => void calls.push('cancel'),
    scheduleDaily: async (h, m) => void calls.push(`sched ${h}:${m}`),
  };
  return { d, calls };
}

describe('applyReminder', () => {
  it('clears then schedules once when permitted', async () => {
    const { d, calls } = fake('granted');
    expect(await applyReminder(d, { enabled: true, hour: 8, minute: 30 })).toEqual({ ok: true, scheduled: true });
    expect(calls).toEqual(['cancel', 'sched 8:30']);
  });
  it('asks permission only when undetermined', async () => {
    const { d, calls } = fake('undetermined');
    await applyReminder(d, { enabled: true, hour: 7, minute: 0 });
    expect(calls).toEqual(['cancel', 'ask', 'sched 7:0']);
  });
  it('schedules nothing when permission is denied', async () => {
    const { d, calls } = fake('denied');
    expect(await applyReminder(d, { enabled: true, hour: 7, minute: 0 })).toEqual({ ok: false, reason: 'permission-denied' });
    expect(calls).toEqual(['cancel']);
  });
  it('turning off cancels without asking for permission', async () => {
    const { d, calls } = fake('undetermined');
    expect(await applyReminder(d, { enabled: false, hour: 7, minute: 0 })).toEqual({ ok: true, scheduled: false });
    expect(calls).toEqual(['cancel']);
  });
  it('reports unavailable without a driver (web)', async () => {
    expect(await applyReminder(null, { enabled: true, hour: 7, minute: 0 })).toEqual({ ok: false, reason: 'unavailable' });
  });
  it('reports error when the OS call throws', async () => {
    const d = { ...fake('granted').d, scheduleDaily: async () => { throw new Error('x'); } };
    expect(await applyReminder(d, { enabled: true, hour: 7, minute: 0 })).toEqual({ ok: false, reason: 'error' });
  });
});

describe('settings', () => {
  it('formats times', () => {
    expect(formatTime(0, 5)).toBe('12:05 AM');
    expect(formatTime(12, 30)).toBe('12:30 PM');
    expect(formatTime(21, 0)).toBe('9:00 PM');
  });
  it('rejects bad stored data', () => {
    expect(parseReminderSettings('{"enabled":true,"hour":25,"minute":0}')).toEqual(DEFAULT_REMINDER);
    expect(parseReminderSettings('nope')).toEqual(DEFAULT_REMINDER);
    expect(parseReminderSettings(null)).toEqual(DEFAULT_REMINDER);
    expect(parseReminderSettings('{"enabled":true,"hour":9,"minute":15}')).toEqual({ enabled: true, hour: 9, minute: 15 });
  });
});
