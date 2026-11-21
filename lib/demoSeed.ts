import type { SQLiteDatabase } from 'expo-sqlite';

import { createHabit, listHabits, setLog } from '@/features/habits/api/habitRepository';
import { addDays, todayStr } from '@/features/habits/logic/dates';
import type { Cadence } from '@/features/habits/logic/types';

const daily: Cadence = { type: 'daily', config: {} };

const SAMPLE: { name: string; icon: string; color: string; cadence: Cadence; rate: number }[] = [
  { name: 'Morning walk', icon: 'walk', color: '#4FB286', cadence: daily, rate: 0.85 },
  { name: 'Read 10 pages', icon: 'book', color: '#5B8DEF', cadence: daily, rate: 0.65 },
  { name: 'Drink water', icon: 'water', color: '#4BB3C4', cadence: daily, rate: 0.9 },
  { name: 'Strength workout', icon: 'barbell', color: '#E07B5B', cadence: { type: 'x_per_week', config: { times: 3 } }, rate: 0.5 },
  { name: 'Evening journal', icon: 'pencil', color: '#8E7CE0', cadence: { type: 'weekly_days', config: { days: [1, 3, 5] } }, rate: 0.7 },
];

// Deterministic pseudo-random so the demo looks the same on every load.
const hit = (seed: number, rate: number) => ((Math.sin(seed * 9301 + 49297) + 1) / 2) < rate;

export async function seedDemoData(db: SQLiteDatabase): Promise<void> {
  if ((await listHabits(db)).length > 0) return;
  const today = todayStr();
  for (const [i, s] of SAMPLE.entries()) {
    const habit = await createHabit(db, {
      name: s.name, icon: s.icon, color: s.color, category: null, cadence: s.cadence, targetValue: 1, unit: null,
    });
    await db.runAsync('UPDATE habits SET start_date = ? WHERE id = ?', addDays(today, -110), habit.id);
    for (let d = 110; d >= 1; d--) {
      if (hit(i * 1000 + d, s.rate)) await setLog(db, habit.id, addDays(today, -d), 'done');
    }
    // Leave today open for some habits so the Today screen has something to tap.
    if (i % 2 === 0) await setLog(db, habit.id, today, 'done');
  }
}
