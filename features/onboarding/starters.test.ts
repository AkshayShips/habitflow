import { planStarters, reminderFor } from './starters';

describe('planStarters', () => {
  it('creates daily habits from picks', () => {
    const r = planStarters(['Drink water', 'Stretch'], [], 5);
    expect(r.map((h) => h.name)).toEqual(['Drink water', 'Stretch']);
    expect(r.every((h) => h.cadence.type === 'daily' && /^#[0-9A-F]{6}$/i.test(h.color))).toBe(true);
  });
  it('skips ones you already have, ignoring case', () => {
    expect(planStarters(['Drink water', 'Stretch'], ['drink WATER'], 5).map((h) => h.name)).toEqual(['Stretch']);
  });
  it('respects free-plan room and the cap of 3', () => {
    expect(planStarters(['Drink water', 'Stretch', 'Meditate'], [], 1)).toHaveLength(1);
    expect(planStarters(['Drink water'], [], 0)).toHaveLength(0);
    expect(planStarters(['Drink water', 'Stretch', 'Meditate', 'Read 5 pages'], [], 9)).toHaveLength(3);
  });
  it('ignores unknown names', () => {
    expect(planStarters(['Nope'], [], 5)).toEqual([]);
  });
});

describe('reminderFor', () => {
  it('maps choices to times', () => {
    expect(reminderFor('Evening')).toEqual({ enabled: true, hour: 18, minute: 0 });
    expect(reminderFor('No reminders').enabled).toBe(false);
  });
});
